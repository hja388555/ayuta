/**
 * 메일 발송 — Resend HTTP API 를 fetch 로 직접 부른다(SDK 의존성 없음).
 * RESEND_API_KEY·MAIL_FROM 중 하나라도 없으면 보내지 않고 not_configured 를 돌려준다 —
 * 호출자가 "메일 대신 링크를 직접 전달" 같은 대안을 고른다.
 * 로그에는 수신 도메인·상태 코드만 남긴다. 키·본문(초대 링크 등)은 절대 찍지 않는다.
 */
export type MailInput = { to: string; subject: string; html: string; text: string }
export type MailResult = { sent: true; id?: string } | { sent: false; reason: 'not_configured' | 'failed' }

const ENDPOINT = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10_000

const domainOf = (email: string) => email.split('@')[1] ?? '?'

export async function sendMail({ to, subject, html, text }: MailInput): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY?.trim()
  const from = process.env.MAIL_FROM?.trim()
  if (!key || !from) {
    console.info('[mail] 발송 설정이 없어 보내지 않음')
    return { sent: false, reason: 'not_configured' }
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`[mail] 발송 실패 status=${res.status} to=*@${domainOf(to)}`)
      return { sent: false, reason: 'failed' }
    }
    const body = (await res.json().catch(() => ({}))) as { id?: unknown }
    return { sent: true, id: typeof body.id === 'string' ? body.id : undefined }
  } catch (err) {
    const name = err instanceof Error ? err.name : 'unknown'
    console.warn(`[mail] 발송 오류 ${name} to=*@${domainOf(to)}`)
    return { sent: false, reason: 'failed' }
  }
}
