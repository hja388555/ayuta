/**
 * 관리자 2단계 인증 코드를 어떻게 전달할지 정한다.
 *
 * Payload 는 메일 어댑터가 없으면 consoleEmailAdapter 로 떨어지는데, 그 어댑터는 받는 사람과
 * 제목만 로그에 찍고 본문(= 코드)은 버린다(payload/dist/email/consoleEmailAdapter.js).
 * 그대로 두면 코드가 어디에도 나타나지 않아 아무도 관리자 화면에 들어갈 수 없다.
 *
 * - 메일 어댑터가 있으면 메일로 보낸다
 * - 없고 개발 환경이면 서버 로그에 코드를 직접 남긴다(개발자가 로그에서 확인)
 * - 없고 운영 환경이면 발급 자체를 거부한다 — 읽을 수 없는 코드를 계속 만들면 발급 상한만
 *   소진되고, 운영 로그에 코드를 남기면 로그 열람 권한자가 2단계 인증을 대신 통과한다
 */
export type OtpDelivery = 'email' | 'log' | 'refuse'

export function otpDelivery(mailConfigured: boolean, nodeEnv: string | undefined): OtpDelivery {
  if (mailConfigured) return 'email'
  return nodeEnv === 'production' ? 'refuse' : 'log'
}
