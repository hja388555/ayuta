import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AuthError, requireAdmin } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import { companyFromSettings, type CompanySettingsRow } from '@/lib/company'
import { card } from '@/components/admin/styles'
import { CompanyForm, SealUploadForm } from '@/components/admin/SettingsForms'

/**
 * 관리자 설정(큐 Q25): 회사 정보(계약서 을 정보 · 사업자정보 푸터)와 대표자 서명·날인 이미지.
 * 조회는 관리자, 저장은 최고관리자만(API 가 최종 판정한다).
 */
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
  const row = (await payload.findGlobal({ slug: 'company-settings', depth: 0, overrideAccess: true })) as CompanySettingsRow & { sealImage?: unknown }
  const ko = companyFromSettings(row, 'ko')
  const ja = companyFromSettings(row, 'ja')

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', color: '#3D4046', maxWidth: 760 }}>
      <p style={{ margin: '0 0 8px' }}>
        <Link href="/manage">← 관리자 홈</Link>
      </p>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>설정</h1>
      {canEdit ? null : <p style={{ fontSize: 13, color: '#767B85' }}>중간관리자는 조회만 할 수 있습니다.</p>}

      <section style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>회사 정보 (계약서 을 정보 · 사업자정보 푸터)</h2>
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

      <section style={card}>
        <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>대표자 서명·날인</h2>
        <SealUploadForm hasSeal={Boolean(row.sealImage)} canEdit={canEdit} />
        <p style={{ fontSize: 12, color: '#767B85', marginBottom: 0 }}>계약서 화면에 서명·날인을 겹쳐 보여주는 기능은 다음 작업에서 붙습니다.</p>
      </section>
    </main>
  )
}
