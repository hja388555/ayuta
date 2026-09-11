import type { BadgeTone } from '@/components/ui'

/**
 * 마이페이지 주문 상태 표시 규칙(Figma [v2] 09-A 215:2 · 09-B 215:242).
 * 목록·상세가 같은 배지 색과 진행 단계를 쓰도록 한 곳에 둔다. 문구는 messages 의 mypage.badge.* 가 갖는다.
 */
export type OrderStatusKey = 'pending' | 'paid' | 'in_progress' | 'done' | 'failed' | 'cancelled' | 'fraud_suspected'

// 결제 후 계약이 체결된 상태. 취소도 한때 체결됐던 계약이라 보관함에 남긴다
export const SIGNED_STATUSES = ['paid', 'in_progress', 'done', 'cancelled'] as const

const TONES: Record<OrderStatusKey, BadgeTone> = {
  pending: 'neutral',
  paid: 'success',
  in_progress: 'warning',
  done: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  fraud_suspected: 'warning',
}

export const statusTone = (status: string): BadgeTone => TONES[status as OrderStatusKey] ?? 'neutral'

export const isSigned = (status: string): boolean => (SIGNED_STATUSES as readonly string[]).includes(status)

/** 요약 카드 묶음: 진행중 = 결제완료+진행중, 완료 = 완료, 환불 = 취소 */
export function summarize(statuses: string[]) {
  return {
    total: statuses.length,
    active: statuses.filter((s) => s === 'paid' || s === 'in_progress').length,
    done: statuses.filter((s) => s === 'done').length,
    refund: statuses.filter((s) => s === 'cancelled').length,
  }
}

export const PROGRESS_STEPS = ['paid', 'received', 'in_progress', 'done'] as const

/**
 * 4단계 진행 바에서 몇 칸이 켜지는지. "접수확인"을 따로 기록하는 상태값이 아직 없어
 * 결제완료는 1칸, 진행중은 접수를 거친 것이므로 3칸이다. 결제 전·실패·취소는 0칸.
 */
export function progressCount(status: string): number {
  if (status === 'paid') return 1
  if (status === 'in_progress') return 3
  if (status === 'done') return 4
  return 0
}
