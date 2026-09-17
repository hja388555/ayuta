import { getPayload } from 'payload'
import config from '@payload-config'
import { bandObjectPosition, isBandSlot } from '@/lib/band-images'

/**
 * 카테고리 폼 맨 위의 이미지(관리자 A6 이미지 관리에서 올린 이미지).
 * 고정 높이로 잘라서 보여 준다(v4, 2026-09-14): 모바일 88px / PC 215px.
 * 어디를 남길지는 관리자가 슬롯마다 정한다(focusY, 기본 가운데) — /manage/images/[slot]/position.
 * PC 는 콘텐츠 폭 960 제한.
 *
 * 이미지가 없으면 아무것도 그리지 않는다 — 빈 회색 박스도, 깨진 <img> 도 남기지 않는다.
 * 그래서 문서가 있는지 먼저 확인하고, 본문은 /api/band-image/[slot] 이 내려준다(운영 버킷은 비공개).
 * DB 오류도 렌더링 생략으로 처리해 나머지 화면은 그대로 뜬다.
 */
export async function ImageBand({ slot, locale }: { slot: string; locale?: string }) {
  if (!isBandSlot(slot)) return null
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({ collection: 'band-images', where: { slot: { equals: slot } }, limit: 1, depth: 0, overrideAccess: true })
    const img = docs[0]
    if (!img?.filename) return null
    const alt = (locale === 'ja' ? img.altJa : img.altKo) ?? ''

    return (
      <div className="image-full">
        <img
          src={`/api/band-image/${slot}?v=${encodeURIComponent(String(img.updatedAt))}`}
          width={img.width ?? undefined}
          height={img.height ?? undefined}
          style={{ objectPosition: bandObjectPosition(img.focusY) }}
          alt={alt}
        />
      </div>
    )
  } catch {
    return null
  }
}
