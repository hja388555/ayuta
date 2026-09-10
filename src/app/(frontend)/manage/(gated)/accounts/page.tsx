import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AuthError, requireSuper } from '@/lib/dal'
import { card } from '@/components/admin/styles'
import { AccountsManager } from '@/components/admin/SettingsForms'

/**
 * 관리자 계정 관리 — 최고관리자만(요구사항 1-16 규칙 2). 중간관리자에게는 화면 자체를 감춘다.
 * 관리자 권한이 있는 계정(manager·super, 탈퇴 제외)만 보여준다.
 */
export default async function AccountsPage() {
  let me
  try {
    me = await requireSuper()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    where: { and: [{ role: { in: ['manager', 'super'] } }, { deletedAt: { exists: false } }] },
    sort: 'email',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', color: '#3D4046', maxWidth: 760 }}>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/manage">← 관리자 홈</Link>
      </p>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>관리자 계정</h1>
      <section style={card}>
        <AccountsManager meId={me.id} accounts={docs.map((d) => ({ id: d.id as number, email: d.email as string, name: d.name as string, role: d.role as string }))} />
      </section>
    </main>
  )
}
