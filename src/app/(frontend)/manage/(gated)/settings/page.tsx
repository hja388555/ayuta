import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AuthError, requireAdmin } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import { companyFromSettings, type CompanySettingsRow } from '@/lib/company'
import { Badge } from '@/components/ui'
import { AccountsManager, AdminPasswordForm, CompanyForm, NotifyMailCard, SealUploadForm } from '@/components/admin/SettingsForms'
import { listPendingInvites } from '@/lib/invites/service'
import s from '@/components/admin/admin-v2.module.css'

/**
 * A10 설정(Figma [v2] 231:2 / 231:189) 본문. 셸은 (gated)/layout 이 그린다.
 * 조회는 관리자, 저장은 최고관리자만(API 가 최종 판정). 중간관리자가 저장·추가를 누르면 A11 ⑧ 권한 없음.
 */
export const dynamic = 'force-dynamic'

const DOC_KINDS = [
  { kind: 'terms', name: '이용약관' },
  { kind: 'privacy', name: '개인정보 처리방침' },
  { kind: 'refund', name: '환불 및 취소 정책' },
] as const

export default async function SettingsPage() {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }
  const canEdit = isSuperRole(user.role)

  const payload = await getPayload({ config })
  const [row, accounts, invites, { docs: contracts }, { docs: documents }] = await Promise.all([
    payload.findGlobal({ slug: 'company-settings', depth: 0, overrideAccess: true }) as Promise<CompanySettingsRow & { sealImage?: unknown }>,
    canEdit
      ? payload
          .find({
            collection: 'users',
            where: { and: [{ role: { in: ['manager', 'super'] } }, { deletedAt: { exists: false } }] },
            sort: 'email',
            limit: 100,
            depth: 0,
            overrideAccess: true,
          })
          .then((r) => r.docs.map((d) => ({ id: d.id as number, email: d.email as string, name: (d.name as string) ?? '', role: d.role as string })))
      : Promise.resolve(null),
    canEdit ? listPendingInvites(payload) : Promise.resolve([]),
    payload.find({ collection: 'contract-templates', sort: 'category', limit: 50, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'legal-documents', limit: 20, depth: 0, overrideAccess: true }),
  ])
  const ko = companyFromSettings(row, 'ko')
  const ja = companyFromSettings(row, 'ja')

  // 한·일 두 벌이 모두 있어야 '등록됨'. 편집 링크는 /manage/legal?doc= 의 키 규칙을 따른다
  const legalRows = [
    ...DOC_KINDS.map(({ kind, name }) => ({
      name,
      registered: ['ko', 'ja'].every((l) => documents.some((d) => d.kind === kind && d.locale === l && d.body)),
      doc: `${kind}-ko`,
    })),
    ...[1, 2, 3, 4].map((no) => {
      const list = contracts.filter((c) => c.category === no && c.active)
      const first = list.find((c) => c.locale === 'ko') ?? list[0]
      return { name: `${no}번 계약서`, registered: ['ko', 'ja'].every((l) => list.some((c) => c.locale === l)), doc: first ? `contract-${first.id}` : null }
    }),
  ]

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.title}>설정</h1>
        <span className={s.superOnly}>최고관리자 전용</span>
      </div>
      {canEdit ? null : <p className={s.lead}>중간관리자는 조회만 할 수 있습니다.</p>}

      <div className={s.cols}>
        <div className={s.col}>
          <section className={s.card}>
            <h2 className={s.cardTitle}>사업자 정보 (화면 하단 표기)</h2>
            <CompanyForm
              canEdit={canEdit}
              initial={{
                nameKo: ko.name,
                nameJa: ja.name,
                ceo: ko.ceo,
                businessNo: ko.businessNo,
                addressKo: ko.address,
                addressJa: ja.address,
                phone: ko.phone,
                email: ko.email,
                contactPhone: (row.contactPhone as string) ?? '',
                mailOrderNo: (row.mailOrderNo as string) ?? '',
              }}
            />
          </section>

          <section className={s.card}>
            <h2 className={s.cardTitle}>계약서 을(아유타) 서명 · 날인</h2>
            <p className={s.hint}>등록하신 이미지가 모든 계약서의 을 서명란에 자동으로 표시됩니다.</p>
            <SealUploadForm hasSeal={Boolean(row.sealImage)} canEdit={canEdit} />
          </section>

          {/* 내 비밀번호 변경 — 중간관리자도 자기 비밀번호는 바꾼다(Figma A10 282:2) */}
          <section className={s.card}>
            <h2 className={s.cardTitle}>비밀번호 변경</h2>
            <AdminPasswordForm />
          </section>
        </div>

        <div className={s.col}>
          <section className={s.card}>
            <h2 className={s.cardTitle}>관리자 계정</h2>
            <AccountsManager accounts={accounts} invites={invites} meId={user.id as number} />
          </section>

          <section className={s.card}>
            <h2 className={s.cardTitle}>알림 메일</h2>
            <NotifyMailCard email={ko.email} />
          </section>

          <section className={s.card}>
            <h2 className={s.cardTitle}>약관 · 계약서</h2>
            {legalRows.map((r) => (
              <div key={r.name} className={`${s.listRow} ${s.listRowLine}`}>
                <span className={s.listMain}>{r.name}</span>
                <Badge tone={r.registered ? 'success' : 'warning'}>{r.registered ? '등록됨' : '미등록'}</Badge>
                {r.doc ? (
                  <Link className={s.editLink} href={`/manage/legal?doc=${r.doc}`}>
                    편집
                  </Link>
                ) : null}
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
