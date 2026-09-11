// order-counter.ts 와 같은 사정: 'server-only' 는 설치돼 있지 않지만(의존성 추가 금지)
// Next.js 가 지정자를 자체 해석해 클라이언트 번들 유입을 막는다.
// vitest.config.ts 의 alias 가 테스트에서 이 import 를 빈 스텁으로 돌린다.
import 'server-only'
import { getPayload, ValidationError } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { calculate, fillContract, type Currency } from '@ayuta/pricing'
import { currentSealAssetId } from '../seal'
import { categoryBySlug } from '../categories'
import { formFor } from '../category-groups'
import { loadPriceBook } from '../price-book'
import { loadCategoryModel } from '../pricing-model'
import { nextOrderNumber } from '../order-counter'
import { loadCompanyContractFields } from '../company-settings'
import { OrdererSchema, buyerContractFields } from './orderer'
import { allRequiredChecked, type ConsentDef } from './consents'
import { buildContractItems, countryFactValue } from './contract-items'
import { filterPricedSelection } from './selection-from-query'
import { sanitizeCountries, sanitizePurpose } from '../cover-selection'

// 1. 입력 모양 검증. 금액 필드는 여기 아예 없다 — 클라이언트가 뭘 보내든 서버가 쓸 값은
// selection(선택 항목 키)뿐이고, 금액은 서버가 스스로 재계산한다
const CreateOrderInputSchema = z.object({
  categorySlug: z.string().trim().min(1).max(100),
  locale: z.enum(['ko', 'ja']),
  // 계산기(calculate)가 카테고리 종류(tier/sum/sumMultiplier/inquiry)별로 모양을 검증한다.
  // 여기서 한 번 더 좁히면 새 계산기 종류가 늘 때마다 이 스키마도 고쳐야 한다.
  // 화면이 필터링 없이 통째로 보낸다 — priced/unpriced를 가리는 건 calculate() 호출
  // 직전 한 곳뿐이어야 계약서에 "뭘 샀는지"가 온전히 남는다(country 같은 무료 선택이
  // 서버에 아예 안 알려지면 계약서에도 못 넣는다)
  selection: z.unknown(),
  consents: z.record(z.string(), z.boolean()).default({}),
  orderer: OrdererSchema,
  // 전자서명 이름. 화면은 동의 체크 시 orderer.name 을 그대로 채워 보내므로 정상 흐름에서는
  // 항상 orderer.name 과 같다 — 다르면 클라이언트가 조작했거나 화면이 고장난 것이다
  signature: z.string().trim().min(1).max(100),
  // 더블클릭·네트워크 재시도로 같은 주문이 두 번 만들어지지 않게 클라이언트가 붙이는 값
  // (Ruling 15). 서버는 이 키로 기존 주문이 있으면 새로 만들지 않고 그 결과를 그대로 돌려준다.
  // IP 기준 요청 제한은 여기서 다루지 않는다 — 보안 강화 큐(Q30)로 미룬다.
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
})

// idempotencyKey 유니크 인덱스 위반인지 본다. db-postgres 어댑터(handleUpsertError)가
// Postgres 23505를 이미 ValidationError로 감싸 올려보낸다 — 그 errors[].path에 위반된
// 필드명이 담긴다. 다른 필드(orderNumber·paymentId 등) 유니크 위반까지 재시도 경로로
// 삼키면 안 되므로 path가 idempotencyKey일 때만 본다.
// input.selection은 모양이 카테고리마다 다른 z.unknown()이다 — country·purpose만
// 안전하게 뽑아내는 작은 헬퍼. selection-from-query.ts가 이미 두 키를 항상 실어 보내지만,
// API를 직접 호출하는 경로(클라이언트 조작)까지 방어한다.
function selectionField(selection: unknown, key: string): unknown {
  if (typeof selection !== 'object' || selection === null) return undefined
  return (selection as Record<string, unknown>)[key]
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}
function asOptionalString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function isIdempotencyKeyViolation(err: unknown): boolean {
  if (!(err instanceof ValidationError)) return false
  const errors = (err.data as { errors?: { path?: unknown }[] } | null)?.errors
  return Array.isArray(errors) && errors.some((e) => e.path === 'idempotencyKey')
}

export type CreateOrderInput = z.input<typeof CreateOrderInputSchema>

export type CreateOrderResult =
  | { ok: true; orderId: number; orderNumber: string; amount: number; currency: Currency; orderer: { email: string; phone: string } }
  | { ok: false; reason: CreateOrderRejectionReason; detail?: unknown }

export type CreateOrderRejectionReason =
  | 'invalid_input'
  | 'signature_mismatch'
  | 'unknown_category'
  | 'country_required'
  | 'consent_required'
  | 'pricing_failed'
  | 'no_contract'
  | 'contract_incomplete'

/**
 * 계약 이전 화면이 넘긴 선택을 서버가 재계산해 주문 한 건과 계약서 스냅샷을 만든다.
 *
 * 순서가 곧 설계다 — 뒤 단계일수록 비싸거나(DB 조회) 되돌릴 수 없다(주문 생성). 싼 검증을
 * 먼저 해서 공격자에게 불필요한 정보(어느 단계에서 막혔는지 이상의 것)를 주지 않는다.
 *
 * `customerId` 는 클라이언트 입력이 아니라 호출자가 세션에서 가져와 넘긴다 — 로그인
 * 여부를 이 함수가 클라이언트 body 로 판단하면 세션 없이도 남의 계정으로 주문을 만들 수
 * 있게 된다.
 */
export async function createOrder(rawInput: unknown, customerId: number | null = null): Promise<CreateOrderResult> {
  // 1. 입력 모양 검증
  const parsed = CreateOrderInputSchema.safeParse(rawInput)
  if (!parsed.success) return { ok: false, reason: 'invalid_input', detail: parsed.error.flatten() }
  const input = parsed.data

  // 전자서명은 손으로 그리는 서명이 아니라 동의 체크 시 자동 기입되는 이름이다 — 여기서
  // 다르면 화면을 거치지 않고 API 를 직접 호출해 남의 이름으로 서명한 것이다
  if (input.signature !== input.orderer.name) return { ok: false, reason: 'signature_mismatch' }

  // 2. 카테고리 확인 — 없는 슬러그면 거부
  const def = categoryBySlug(input.categorySlug)
  if (!def) return { ok: false, reason: 'unknown_category' }

  // 표지에서 나라를 선택해야 카테고리 화면으로 넘어갈 수 있다 — 규칙을 서버에서도 검증한다.
  // URL 주소창 타이핑 등으로 표지를 우회한 경우도 거부하려면 모든 카테고리에서 국가 확인이 필요하다
  const rawCountries = asStringArray(selectionField(input.selection, 'country'))
  const sanitized = sanitizeCountries(rawCountries)
  if (sanitized.length === 0) return { ok: false, reason: 'country_required' }

  const payload = await getPayload({ config })
  const currency: Currency = input.locale === 'ja' ? 'JPY' : 'KRW'

  // 0. 멱등키가 있고 이미 그 키로 만든 주문이 있으면 새로 만들지 않고 그 결과를 그대로
  // 돌려준다 — 결제 버튼 더블클릭이나 네트워크 재시도가 주문을 두 벌로 만들면 안 된다
  if (input.idempotencyKey) {
    const { docs: existing } = await payload.find({
      collection: 'orders',
      where: { idempotencyKey: { equals: input.idempotencyKey } },
      limit: 1,
      overrideAccess: true,
    })
    const dup = existing[0]
    if (dup) {
      return {
        ok: true,
        orderId: dup.id as number,
        orderNumber: dup.orderNumber as string,
        amount: dup.amount as number,
        currency: dup.currency as Currency,
        orderer: { email: (dup.orderer as { email: string }).email, phone: (dup.orderer as { phone: string }).phone },
      }
    }
  }

  // 계약서 템플릿을 한 번만 읽어 동의 확인(3)과 빈칸 채우기(5) 양쪽에 쓴다.
  // 3·5번처럼 템플릿이 없는 카테고리는 여기서 null 이 되고, 동의 항목이 없어 3번 검사는
  // 통과할 수 있지만 5번 검사(no_contract)에서 반드시 막힌다
  const { docs: templates } = await payload.find({
    collection: 'contract-templates',
    where: { and: [{ category: { equals: def.no } }, { locale: { equals: input.locale } }, { active: { equals: true } }] },
    limit: 1,
    overrideAccess: true,
  })
  const template = templates[0] ?? null
  const consentDefs: ConsentDef[] = (template?.consents as ConsentDef[] | undefined) ?? []

  // 템플릿은 있는데 동의 항목이 하나도 정의돼 있지 않으면(관리자 설정 실수) 동의 없이
  // 결제가 통과해 버린다 — allRequiredChecked([], ...)는 빈 배열에 대해 항상 참이다
  // (정의 자체가 없는 5번 카테고리에서는 정상 동작이라 그건 그대로 둔다. 템플릿이
  // '있는데' consents가 빈 경우만 막는다)
  if (template && consentDefs.length === 0) return { ok: false, reason: 'contract_incomplete', detail: ['consents'] }

  // 3. 동의 확인 — 필수 항목이 전부 체크됐는지 서버가 다시 본다.
  // allRequiredChecked 는 defs 에 정의된 키만 보므로 클라이언트가 보낸 임의의 키는 무시된다
  if (!allRequiredChecked(consentDefs, input.consents)) return { ok: false, reason: 'consent_required' }

  // 4. DB 단가로 금액 재계산 — 실패하면 거부.
  // calculate()에는 금액칸이 있는 항목만 넘긴다(priced:false 항목을 넣으면 "단가 없음"으로
  // 통째로 거부된다) — 하지만 계약서 항목(아래 5)에는 원본 선택(input.selection)을 그대로
  // 쓴다. 필터는 여기 계산 한 곳에서만 걸어야 국가·사이즈 같은 무료 선택이 계약서에서
  // 사라지지 않는다
  const book = await loadPriceBook(def.no, currency)
  const form = formFor(def.no)
  // 4번 기간 배수 등 관리자가 DB 에서 고치는 값을 채운 모델 — 견적 화면과 같은 로더를 쓴다
  const model = await loadCategoryModel(def)
  const pricedSelection = filterPricedSelection(model, form, input.selection)
  const quote = calculate(model, book, pricedSelection)
  if (!quote.ok) return { ok: false, reason: 'pricing_failed', detail: quote.errors }

  // 계약일은 Asia/Seoul 기준. 결제 확정 시점에 갱신하는 자리는 남겨 두고 지금은 주문
  // 생성 시각을 넣는다(계획서 Self-Review 항목)
  const now = new Date()
  const contractDate = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now)

  // 5. 계약서 템플릿을 읽어 빈칸을 채운다 — 템플릿이 없거나 missing 이 있으면 거부.
  // (5번은 문의 → 관리자 견적 → 계약 흐름이라 고정 템플릿이 없다. 위 계산 단계에서 먼저 막힌다)
  // 구멍 뚫린 계약서에 서명하게 두느니 결제를 막는 게 낫다
  if (!template) return { ok: false, reason: 'no_contract' }

  // 계약서 항목은 원본 선택(input.selection) 전체에서 뽑는다 — quote.lines는 금액칸이
  // 있는 항목만 담고 값도 금액이라(위 4 참고) 계약서 "무엇을 샀는지" 줄에 쓸 수 없다.
  // 돈은 {{amount}}(총 계약금액/계약금액) 줄에만 나온다
  const contractItems = buildContractItems(def, book, input.selection, input.locale)

  // 1번 계약서 제1조의 "선택 상품 / 선택 채널"은 {{items}}가 아니라 각자의 자리(productName/
  // channels)로 채운다 — 원문(§B)이 광고 국가·계약기간과 함께 줄마다 따로 라벨을 붙여 두기
  // 때문이다. contractItems는 tier 모델에서 "등급"/"플랫폼" 라벨로 쌓이므로(contract-items.ts)
  // 그 값을 그대로 꺼낸다. 플랫폼은 필수 선택이 아니라서(TierForm) 비어 있을 수 있는데,
  // 그 경우 undefined로 두면 missing 판정으로 카테고리 1 주문이 전부 막힌다 — 값을 모르는
  // 갑측 항목에 쓰는 것과 같은 관례(buyerContractFields)대로 명시적 대시로 채운다
  const productName = contractItems.find((item) => item.label === '등급')?.value ?? '-'
  const channels = contractItems.find((item) => item.label === '플랫폼')?.value ?? '-'
  // 표지에서 고른 나라 — 1번 계약서 제1조 "광고 국가" 줄({{country}})을 채운다.
  // 다른 카테고리 템플릿에는 {{country}} 자리가 없으므로 값을 넘겨도 조용히 무시된다
  // (fillContract는 템플릿에 없는 키를 치환하지 않는다).
  const country = countryFactValue(input.selection, input.locale)

  const { text: contractText, missing } = fillContract(template.body, {
    amount: quote.total,
    currency,
    contractDate,
    buyerName: input.orderer.name,
    signature: input.signature,
    items: contractItems,
    productName,
    channels,
    country,
    ...buyerContractFields(input.orderer),
    // 을 정보는 관리자 설정(company-settings)에서 읽는다 — 이 시점 값이 스냅샷에 고정된다
    ...(await loadCompanyContractFields(input.locale)),
  })
  if (missing.length > 0) return { ok: false, reason: 'contract_incomplete', detail: missing }

  // 6. 주문번호 채번
  const orderNumber = await nextOrderNumber('AY', now)

  // 7. 주문 생성 — 금액·항목·계약서 전문을 값으로 저장한다. 참조만 남기면 나중에 단가나
  // 템플릿이 바뀔 때 이미 체결된 주문까지 함께 바뀐다
  let order
  try {
    order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        orderNumber,
        // 실제 결제 연동(PortOne)은 이 계획 밖이다(Q17 나머지). 결제창을 아직 부르지 않았으므로
        // paymentId 는 임시로 주문번호 기반 자리표시자를 쓰고, 결제 단계가 실제 식별자로 덮어쓴다
        paymentId: `pending-${orderNumber}`,
        status: 'pending',
        currency,
        amount: quote.total,
        locale: input.locale,
        category: def.no,
        items: quote.lines.map((line) => ({ code: line.key, label: line.label, unitAmount: line.amount, quantity: 1 })),
        // 가격 없는 선택(국가, 사이즈, 채널 등)도 관리자가 주문 상세에서 볼 수 있어야 한다 —
        // 그렇지 않으면 CS 문의가 왔을 때 관리자가 계약서 전문을 처음부터 다시 읽어야 한다
        contractItems,
        // 표지의 나라·목적은 가격에 관여하지 않지만 "무엇을 파는지"를 설명하는 값이라
        // 카테고리와 무관하게 모든 주문에 저장한다(계약서 문구에 실릴지는 카테고리별
        // 소스 문서가 있는지에 달렸다 — contract-items.ts countryFactValue/buildContractItems 참고).
        country: sanitizeCountries(asStringArray(selectionField(input.selection, 'country'))),
        purpose: sanitizePurpose(asOptionalString(selectionField(input.selection, 'purpose'))),
        idempotencyKey: input.idempotencyKey || undefined,
        customer: customerId ?? undefined,
        orderer: {
          name: input.orderer.name,
          phone: input.orderer.phone,
          email: input.orderer.email,
          postcode: input.orderer.postalCode,
          address1: input.orderer.address1,
          address2: input.orderer.address2,
          businessNo: input.orderer.businessNo,
          representative: input.orderer.representative,
        },
        signature: input.signature,
        contractText,
        // 계약서 전문과 같은 이유로 도장도 이 시점 것을 고정한다(src/lib/seal.ts)
        sealAsset: (await currentSealAssetId()) ?? undefined,
      },
    })
  } catch (err) {
    // 동시에 같은 멱등키로 두 요청이 들어오면 둘 다 위 0번 조회를 통과한 뒤(아직 아무도
    // 만들지 않아서) 하나만 idempotencyKey 유니크 인덱스를 통과해 행을 만들고, 나머지는
    // 여기서 유니크 위반으로 막힌다 — 순차 재시도(0번)로는 못 잡는 경합이다. 멱등키를 둔
    // 목적이 "두 번 보내도 주문·주문번호 하나"이므로, 방금 다른 요청이 만든 그 주문을
    // 다시 읽어 성공으로 돌려준다. 같은 실패를 그대로 고객에게 500으로 보여주면 멱등키가
    // 없느니만 못하다
    if (input.idempotencyKey && isIdempotencyKeyViolation(err)) {
      const { docs: winner } = await payload.find({
        collection: 'orders',
        where: { idempotencyKey: { equals: input.idempotencyKey } },
        limit: 1,
        overrideAccess: true,
      })
      const dup = winner[0]
      if (dup) {
        return {
          ok: true,
          orderId: dup.id as number,
          orderNumber: dup.orderNumber as string,
          amount: dup.amount as number,
          currency: dup.currency as Currency,
          orderer: { email: (dup.orderer as { email: string }).email, phone: (dup.orderer as { phone: string }).phone },
        }
      }
    }
    throw err
  }

  return {
    ok: true,
    orderId: order.id as number,
    orderNumber,
    amount: quote.total,
    currency,
    orderer: { email: input.orderer.email, phone: input.orderer.phone },
  }
}
