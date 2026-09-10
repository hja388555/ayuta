import { redirect } from 'next/navigation'

/**
 * 관리자 전용 로그인 화면은 두지 않는다 — 요구사항 1-16 "로그인 화면은 하나다. 별도의 관리자
 * 로그인 주소를 두지 않는다"(A1 폐기). 예전 주소로 들어와도 통합 로그인으로 보낸다.
 */
export default function ManageLoginRedirect() {
  redirect('/ko/login')
}
