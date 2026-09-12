/**
 * 결제 화면 주문자 입력 임시 저장(2026-09-12 QA) — "선택 내용 수정하기" 뒤 브라우저 뒤로가기·새로고침에도
 * 입력한 주문자 정보가 남게 한다. 탭을 닫으면 사라지는 sessionStorage 에 둔다.
 * 동의·서명은 저장하지 않는다 — 동의는 매번 화면에서 다시 받아야 한다. 주문이 만들어지면 지운다.
 */
export const ORDERER_DRAFT_FIELDS = ['name', 'phone', 'phoneCountry', 'email', 'postalCode', 'address1', 'address2', 'businessNo', 'representative'] as const

export type OrdererDraft = Partial<Record<(typeof ORDERER_DRAFT_FIELDS)[number], string>>

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const ordererDraftKey = (scope: string) => `ayuta:checkout-orderer:${scope}`

/** 저장된 초안. 없거나 깨졌거나 저장소를 못 쓰면(사파리 사생활 보호 등) null */
export function readOrdererDraft(storage: StorageLike | undefined, scope: string): OrdererDraft | null {
  try {
    const raw = storage?.getItem(ordererDraftKey(scope))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const draft: OrdererDraft = {}
    // 아는 칸의 문자열만 받는다 — 동의·서명 같은 값이 섞여 들어와도 버린다
    for (const f of ORDERER_DRAFT_FIELDS) {
      const v = (parsed as Record<string, unknown>)[f]
      if (typeof v === 'string') draft[f] = v.slice(0, 300)
    }
    return Object.values(draft).some((v) => v) ? draft : null
  } catch {
    return null
  }
}

export function writeOrdererDraft(storage: StorageLike | undefined, scope: string, orderer: Record<string, string>): void {
  try {
    const draft: OrdererDraft = {}
    for (const f of ORDERER_DRAFT_FIELDS) if (typeof orderer[f] === 'string') draft[f] = orderer[f]
    storage?.setItem(ordererDraftKey(scope), JSON.stringify(draft))
  } catch {
    // 저장소가 가득 찼거나 막혀 있으면 조용히 넘어간다 — 초안은 편의 기능이다
  }
}

export function clearOrdererDraft(storage: StorageLike | undefined, scope: string): void {
  try {
    storage?.removeItem(ordererDraftKey(scope))
  } catch {
    // 위와 같다
  }
}
