import type { BadgeTone } from '@/components/ui'

/** 관리자 문의 화면(A9) 표시용 헬퍼 */
export const INQUIRY_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  new: { label: '대기', tone: 'warning' },
  quoted: { label: '견적 발행', tone: 'brand' },
  closed: { label: '종료', tone: 'neutral' },
}

export function inquiryStatus(status: unknown) {
  return INQUIRY_STATUS[status as string] ?? { label: String(status ?? '-'), tone: 'neutral' as BadgeTone }
}

/** 문의번호 필드가 따로 없어 접수일(KST)과 id 로 만든다. 예: INQ-20260918-0007 */
export function inquiryNumber(id: number, createdAt: string) {
  const d = new Date(new Date(createdAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '')
  return `INQ-${d}-${String(id).padStart(4, '0')}`
}

export function countryText(c: unknown) {
  return Array.isArray(c) && c.length ? c.map((v) => (v === 'jp' ? '일본' : '한국')).join(' · ') : '-'
}

export function firstLine(body: unknown) {
  return String(body ?? '').split('\n').find((l) => l.trim())?.trim() ?? ''
}
