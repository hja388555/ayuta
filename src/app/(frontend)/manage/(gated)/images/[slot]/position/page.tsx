import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AuthError, requireAdmin } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import { BAND_FOCUS_DEFAULT, BAND_TITLES, isBandSlot } from '@/lib/band-images'
import { BandFocusEditor } from '@/components/admin/BandFocusEditor'
import s from '@/components/admin/admin-v2.module.css'

/**
 * A6-B 띠 이미지 위치 조정(Figma [v2] 294:2 PC / 295:2 Mobile). 셸은 (gated)/layout 이 그린다.
 * 조회는 관리자, 저장은 최고관리자만(API 가 최종 판정). 이미지가 없는 슬롯은 404.
 */
export const dynamic = 'force-dynamic'

export default async function BandPositionPage({ params }: { params: Promise<{ slot: string }> }) {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }
  const { slot } = await params
  if (!isBandSlot(slot)) notFound()

  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'band-images', where: { slot: { equals: slot } }, limit: 1, depth: 0, overrideAccess: true })
  const doc = docs[0]
  if (!doc) notFound()

  return (
    <div className={s.page}>
      <p className={s.crumb}>
        <Link href="/manage/images">이미지 관리</Link> · {BAND_TITLES[slot]}
      </p>
      <h1 className={s.title}>띠에 보일 부분 고르기</h1>
      <BandFocusEditor
        slot={slot}
        src={`/api/band-image/${slot}?v=${encodeURIComponent(String(doc.updatedAt))}`}
        width={doc.width ?? null}
        height={doc.height ?? null}
        initialFocus={doc.focusY ?? BAND_FOCUS_DEFAULT}
        canEdit={isSuperRole(user.role)}
      />
    </div>
  )
}
