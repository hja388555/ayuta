import { type OrderStatus } from '../../collections/Orders'

/**
 * 상태 전이표. 여기가 유일한 원본이다 —
 * transitionOrder()(서버, DB 트랜잭션)와 관리자 상세 화면(어떤 버튼을 보여줄지)이
 * 같은 표를 봐야 한다. 화면이 자기 사본을 들고 있으면 "누를 수는 있는데 서버가 409로
 * 거부하는 버튼"이 생기고, 반대로 실제로 가능한 전이가 화면에서 사라진다.
 *
 * 이 모듈은 payload·DB를 모른다 — 순수 함수라 DB 없이 단위 테스트한다.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['paid', 'failed', 'cancelled', 'fraud_suspected'],
  paid: ['in_progress', 'cancelled', 'fraud_suspected'],
  in_progress: ['done', 'cancelled'],
  done: [],
  failed: [],
  cancelled: [],
  fraud_suspected: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

/**
 * 지금 이 사용자가 실제로 고를 수 있는 다음 상태.
 *
 * cancelled 는 환불·정산으로 이어지는 되돌릴 수 없는 전이라 super 만 한다 —
 * API(POST /api/admin/orders/transition)가 같은 규칙으로 403을 내므로, 화면에서도
 * 같이 빼야 manager 에게 "눌러도 거부당하는 버튼"이 남지 않는다.
 * 화면에서 뺐다고 서버 검사가 필요 없어지는 것은 아니다 — 화면은 안내일 뿐이고
 * 판정은 언제나 서버가 한다.
 */
export function availableTransitions(from: OrderStatus, opts: { isSuper: boolean }): OrderStatus[] {
  const allowed = ALLOWED_TRANSITIONS[from]
  if (!allowed) return []
  return allowed.filter((to) => (to === 'cancelled' ? opts.isSuper : true))
}

/**
 * 되돌릴 수 없는 전이인가 — 도착 상태에서 더 갈 곳이 없으면(완료·취소·결제실패·이상거래 의심)
 * 한 번 누르면 끝이다. 관리자 화면은 이 경우 확인 팝업을 한 번 더 띄운다.
 */
export function requiresTransitionConfirm(to: OrderStatus): boolean {
  const next = ALLOWED_TRANSITIONS[to]
  return !next || next.length === 0
}

/** 관리자 화면 표기. 화면은 한국어 고정이다(next-intl [locale] 세그먼트 밖) */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '결제대기',
  paid: '결제완료',
  in_progress: '진행중',
  done: '완료',
  failed: '결제실패',
  cancelled: '취소',
  fraud_suspected: '이상거래 의심',
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as OrderStatus] ?? status
}
