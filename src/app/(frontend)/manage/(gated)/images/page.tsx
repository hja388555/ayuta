import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AuthError, requireAdmin } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import { BAND_SLOTS, BAND_TITLES } from '@/lib/band-images'
import { BandImageCard } from '@/components/admin/BandImageCard'
import s from '@/components/admin/admin-v2.module.css'

/**
 * A6 이미지 관리(Figma [v2] 229:650 PC / 229:798 Mobile). 셸은 (gated)/layout 이 그린다.
 * 조회는 관리자, 교체·삭제·위치 저장은 최고관리자만(API 가 최종 판정). 중간관리자가 누르면 A11 ⑧ 권한 없음.
 */
export const dynamic = 'force-dynamic'

export default async function ImagesPage() {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }
  const canEdit = isSuperRole(user.role)

  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'band-images', limit: BAND_SLOTS.length, depth: 0, overrideAccess: true })

  return (
    <div className={s.page}>
      <h1 className={s.title}>이미지 관리</h1>
      <p className={s.lead}>각 광고 서비스 페이지 상단에 들어가는 띠 이미지입니다. PC · 모바일 모두 표시되며, 띠에 보일 부분을 위아래로 조정할 수 있습니다.</p>
      <p className={s.info}>권장 크기 2400 × 250 이상 · JPG · PNG · WEBP · 5MB 이하</p>
      {canEdit ? null : <p className={s.note}>중간관리자는 조회만 할 수 있습니다. 교체 · 삭제 · 위치 저장은 최고관리자만 할 수 있습니다.</p>}
      <div className={s.bandGrid}>
        {BAND_SLOTS.map((slot) => {
          const doc = docs.find((d) => d.slot === slot)
          return (
            <BandImageCard
              key={slot}
              slot={slot}
              title={BAND_TITLES[slot]}
              version={doc ? String(doc.updatedAt) : null}
              focusY={doc?.focusY ?? null}
              canEdit={canEdit}
            />
          )
        })}
      </div>
    </div>
  )
}
