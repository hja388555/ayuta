import type { OrderLines } from '../checkout/create-order'
import type { ContractItem } from '../checkout/contract-items'
import { formatCountries, sanitizeCountries } from '../cover-selection'
import type { QuoteLine } from './lines'

// 5번 견적 결제의 순수 규칙. DB·화면을 모른다 — 견적 화면 미리보기와 주문 생성이 같은 값을 쓰게 한 곳에 둔다.

export type QuoteAccess = 'ok' | 'revoked' | 'expired'

/** 견적 링크로 결제할 수 있는지. 회수가 만료보다 먼저다(회수된 견적은 기간이 남아도 막는다) */
export function quoteAccess(quote: { status?: unknown; expiresAt?: unknown }, now: number = Date.now()): QuoteAccess {
  if (quote.status === 'revoked') return 'revoked'
  const expiresAt = new Date(String(quote.expiresAt)).getTime()
  // 날짜를 못 읽으면 살아 있는 견적으로 두지 않는다
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return 'expired'
  return 'ok'
}

/**
 * 견적 한 건이 만드는 주문의 멱등키. 클라이언트 키가 아니라 견적 id 에서 서버가 만든다 —
 * 새로고침·다른 탭·재시도 어디서 보내도 같은 값이라 idempotencyKey 유니크 인덱스가 "견적 하나에
 * 주문 하나"를 DB 수준에서 보장한다. orders 에 견적 관계 칸이 없어 이 키가 주문→견적 연결도 겸한다.
 */
export const quoteOrderKey = (quoteId: number | string): string => `quote-${quoteId}`

const LABELS = {
  quoteNumber: { ko: '견적번호', ja: '見積番号' },
  quantity: { ko: '수량', ja: '数量' },
} as const

/**
 * 저장된 견적을 주문의 금액·항목·계약서 항목으로 옮긴다. 금액은 검증된 견적 라인 합계뿐이다.
 *
 * 계약서 항목({{items}})에는 금액을 섞지 않는다(contract-items.ts 와 같은 규칙) — 돈은 {{amount}}
 * 줄에만 나온다. 견적번호를 첫 줄에 두어 관리자가 주문에서 원래 견적을 바로 찾게 한다.
 */
export function quoteOrderLines(
  quote: { quoteNumber: string; lines: QuoteLine[]; total: number },
  countries: readonly string[],
  locale: 'ko' | 'ja',
): OrderLines {
  const contractItems: ContractItem[] = [
    { label: LABELS.quoteNumber[locale], value: quote.quoteNumber },
    ...quote.lines.map((l) => ({ label: l.label, value: `${LABELS.quantity[locale]} ${l.quantity}` })),
  ]
  return {
    amount: quote.total,
    items: quote.lines.map((l, i) => ({ code: `quote-line-${i + 1}`, label: l.label, unitAmount: l.unitAmount, quantity: l.quantity })),
    contractItems,
    contractFacts: {
      productName: quote.lines.map((l) => l.label).join(', '),
      // 견적에는 채널 선택이 없다 — 값을 모르는 칸은 대시로 채운다(buyerContractFields 와 같은 관례)
      channels: '-',
      country: formatCountries(countries, locale) || '-',
    },
    country: sanitizeCountries(countries),
  }
}

/**
 * 이미 만든 견적 주문을 이 요청에 돌려줘도 되는 같은 주문자인지 — 이메일(대소문자 무시)과
 * 연락처(숫자만)가 모두 같아야 한다. 다르면 링크를 받은 다른 사람이 앞 주문자의 주문을
 * 완료 화면으로 열게 되므로 돌려주지 않는다.
 */
export function isSameOrderer(a: { email: string; phone: string }, b: { email: string; phone: string }): boolean {
  const email = (v: string) => v.trim().toLowerCase()
  const phone = (v: string) => v.replace(/\D/g, '')
  return email(a.email) === email(b.email) && phone(a.phone) === phone(b.phone)
}
