import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'

export default async function ManagePage() {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    // 예상된 인증 실패만 404로 감춘다. 진짜 장애는 그대로 올려보내 500으로 드러낸다
    if (err instanceof AuthError) notFound()
    throw err
  }

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>AYUTA 관리자</h1>
      <p>
        {user.email} · {user.role}
      </p>
      <ul style={{ lineHeight: 2 }}>
        <li>
          <Link href="/manage/orders">주문 관리</Link>
        </li>
        <li>
          <Link href="/manage/inquiries">문의 관리 (5번 기타)</Link>
        </li>
        <li>
          <Link href="/manage/prices">단가 관리</Link>
        </li>
        <li>
          <Link href="/manage/settings">설정 (회사 정보 · 서명)</Link>
        </li>
        <li>
          <Link href="/manage/legal">계약서 · 약관</Link>
        </li>
        {user.role === 'super' ? (
          <li>
            <Link href="/manage/accounts">관리자 계정</Link>
          </li>
        ) : null}
      </ul>
    </main>
  )
}
