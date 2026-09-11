import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AuthError, requireSuper } from '@/lib/dal'
import { AccountsManager } from '@/components/admin/SettingsForms'
import { listPendingInvites } from '@/lib/invites/service'
import s from '@/components/admin/admin-v2.module.css'

/**
 * 관리자 계정 관리 — 최고관리자만(요구사항 1-16 규칙 2). 중간관리자에게는 화면 자체를 감춘다.
 * 관리자 권한이 있는 계정(manager·super, 탈퇴 제외)만 보여준다. 설정 화면의 '관리자 계정' 카드와 같은 부품이다.
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
  const invites = await listPendingInvites(payload)
  const { docs } = await payload.find({
    collection: 'users',
    where: { and: [{ role: { in: ['manager', 'super'] } }, { deletedAt: { exists: false } }] },
    sort: 'email',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.title}>관리자 계정</h1>
        <span className={s.superOnly}>최고관리자 전용</span>
      </div>
      <section className={s.card} style={{ maxWidth: 720 }}>
        <AccountsManager meId={me.id} invites={invites} accounts={docs.map((d) => ({ id: d.id as number, email: d.email as string, name: (d.name as string) ?? '', role: d.role as string }))} />
      </section>
    </div>
  )
}
