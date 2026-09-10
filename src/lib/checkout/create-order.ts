// order-counter.ts 와 같은 사정: 'server-only' 는 설치돼 있지 않지만(의존성 추가 금지)
// Next.js 가 지정자를 자체 해석해 클라이언트 번들 유입을 막는다.
// vitest.config.ts 의 alias 가 테스트에서 이 import 를 빈 스텁으로 돌린다.
import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { calculate, fillContract, type Currency } from '@ayuta/pricing'
import { categoryBySlug } from '../categories'
import { loadPriceBook } from '../price-book'
import { nextOrderNumber } from '../order-counter'
import { OrdererSchema, buyerContractFields } from './orderer'
import { allRequiredChecked, type ConsentDef } from './consents'

// 1. 입력 모양 검증. 금액 필드는 여기 아예 없다 — 클라이언트가 뭘 보내든 서버가 쓸 값은
// selection(선택 항목 키)뿐이고, 금액은 서버가 스스로 재계산한다
const CreateOrderInputSchema = z.object({
  categorySlug: z.string().trim().min(1).max(100),
  locale: z.enum(['ko', 'ja']),
  // 계산기(calculate)가 카테고리 종류(tier/sum/sumMultiplier/inquiry)별로 모양을 검증한다.
  // 여기서 한 번 더 좁히면 새 계산기 종류가 늘 때마다 이 스키마도 고쳐야 한다
  selection: z.unknown(),
  consents: z.record(z.string(), z.boolean()).default({}),
  orderer: OrdererSchema,
  // 전자서명 이름. 화면은 동의 체크 시 orderer.name 을 그대로 채워 보내므로 정상 흐름에서는
  // 항상 orderer.name 과 같다 — 다르면 클라이언트가 조작했거나 화면이 고장난 것이다
  signature: z.string().trim().min(1).max(100),
})

export type CreateOrderInput = z.input<typeof CreateOrderInputSchema>

export type CreateOrderResult =
  | { ok: true; orderId: number; orderNumber: string; amount: number; currency: Currency }
  | { ok: false; reason: CreateOrderRejectionReason; detail?: unknown }

export type CreateOrderRejectionReason =
  | 'invalid_input'
  | 'signature_mismatch'
  | 'unknown_category'
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

  const payload = await getPayload({ config })
  const currency: Currency = input.locale === 'ja' ? 'JPY' : 'KRW'

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

  // 3. 동의 확인 — 필수 항목이 전부 체크됐는지 서버가 다시 본다.
  // allRequiredChecked 는 defs 에 정의된 키만 보므로 클라이언트가 보낸 임의의 키는 무시된다
  if (!allRequiredChecked(consentDefs, input.consents)) return { ok: false, reason: 'consent_required' }

  // 4. DB 단가로 금액 재계산 — 실패하면 거부
  const book = await loadPriceBook(def.no, currency)
  const quote = calculate(def.model, book, input.selection)
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

  // 5. 계약서 템플릿을 읽어 빈칸을 채운다 — 템플릿이 없거나(3·5번) missing 이 있으면 거부.
  // 구멍 뚫린 계약서에 서명하게 두느니 결제를 막는 게 낫다
  if (!template) return { ok: false, reason: 'no_contract' }

  const { text: contractText, missing } = fillContract(template.body, {
    amount: quote.total,
    currency,
    contractDate,
    buyerName: input.orderer.name,
    signature: input.signature,
    items: quote.lines.map((line) => ({ label: line.label, value: line.amount.toLocaleString('en-US') })),
    ...buyerContractFields(input.orderer),
  })
  if (missing.length > 0) return { ok: false, reason: 'contract_incomplete', detail: missing }

  // 6. 주문번호 채번
  const orderNumber = await nextOrderNumber('AY', now)

  // 7. 주문 생성 — 금액·항목·계약서 전문을 값으로 저장한다. 참조만 남기면 나중에 단가나
  // 템플릿이 바뀔 때 이미 체결된 주문까지 함께 바뀐다
  const order = await payload.create({
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
    },
  })

  return { ok: true, orderId: order.id as number, orderNumber, amount: quote.total, currency }
}
