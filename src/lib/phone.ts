/**
 * 연락처 형식(비회원 채팅 시작·마이페이지 회원정보가 같이 쓴다). 브라우저·서버 공용이라 의존성이 없다.
 * 숫자·+·-·공백·괄호만, 숫자는 6개 이상. 나라마다 자릿수가 달라(한국·일본) 자릿수는 더 좁히지 않는다.
 */
export const PHONE_MAX = 40

export function isValidPhone(value: string): boolean {
  const v = value.trim()
  return v.length > 0 && v.length <= PHONE_MAX && /^[\d+\-() ]+$/.test(v) && v.replace(/\D/g, '').length >= 6
}
