/**
 * 비회원이 보낼 수 있는 메시지 수(2026-09-17 사용자 결정).
 *
 * 비회원은 문의 폼을 내면 방이 열리고 그 내용이 첫 메시지로 들어간다. 거기서 한 번 더 보낼 수 있고,
 * 세 번째부터는 가입을 요구한다 — 상담을 이어가려면 계정이 있어야 파일 첨부·기록 확인이 된다.
 *
 * 세는 것은 고객이 보낸 메시지뿐이다. 담당자 답장은 세지 않는다 — 답이 올수록 문의 기회가 줄면
 * 고객이 손해를 본다.
 */
export const GUEST_MESSAGE_LIMIT = 2

/** 이미 보낸 고객 메시지 수로 더 보낼 수 있는지 본다 */
export function canGuestSend(sentCount: number, limit = GUEST_MESSAGE_LIMIT): boolean {
  return sentCount < limit
}

/** 남은 횟수. 화면이 「1회 남았습니다」처럼 미리 알려 줄 때 쓴다 */
export function guestSendsLeft(sentCount: number, limit = GUEST_MESSAGE_LIMIT): number {
  return Math.max(0, limit - sentCount)
}
