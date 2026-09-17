import { isValidPhone, type PhoneCountry } from '../phone'

export type GuestStartValues = { name: string; email: string; phone: string; phoneCountry: PhoneCountry; body: string; consent: boolean }
export type GuestStartErrors = Partial<Record<'name' | 'email' | 'phone' | 'body' | 'consent', 'required' | 'email' | 'phone' | 'tooLong' | 'consent_required'>>

/**
 * 비회원 채팅 시작 폼의 칸별 오류를 한 번에 모은다(하나 고치면 다음 오류가 나오는 식이 되지 않게).
 * 서버(GuestStartSchema)가 같은 규칙으로 다시 본다.
 */
export function validateGuestStart(v: GuestStartValues): GuestStartErrors {
  const e: GuestStartErrors = {}
  if (!v.name.trim()) e.name = 'required'
  if (!v.email.trim()) e.email = 'required'
  else if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'email'
  if (!v.phone.trim()) e.phone = 'required'
  else if (!isValidPhone(v.phone, v.phoneCountry)) e.phone = 'phone'
  // 문의 내용은 방을 열면서 첫 메시지로 들어간다 — 비어 있으면 담당자가 빈 방을 받는다
  if (!v.body.trim()) e.body = 'required'
  else if (v.body.trim().length > 500) e.body = 'tooLong'
  if (!v.consent) e.consent = 'consent_required'
  return e
}
