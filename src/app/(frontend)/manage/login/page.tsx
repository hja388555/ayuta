import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/dal'
import { isAdminRole } from '@/lib/roles'
import { AdminLoginForm } from '@/components/admin/AdminLoginForm'

/**
 * 관리자 로그인. (gated) 그룹 밖에 둔다 — 그 레이아웃은 로그인·2단계 인증을 요구하므로
 * 안에 두면 로그인 화면에 들어갈 방법이 없다(verify 와 같은 이유, (gated)/layout.tsx 주석).
 * 이미 로그인한 관리자는 코드 입력 화면으로 보낸다. 거기서 인증이 끝났으면 /manage 로 간다.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'AYUTA 관리자 로그인', robots: { index: false, follow: false } }

export default async function AdminLoginPage() {
  const user = await getSessionUser()
  if (user && isAdminRole(user.role)) redirect('/manage/verify')

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', color: '#3D4046' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>AYUTA 관리자 로그인</h1>
      <AdminLoginForm />
    </main>
  )
}
