import { getPayload } from 'payload'
import config from '@payload-config'
import { isBandSlot } from '@/lib/band-images'

/**
 * 카테고리 폼 맨 위의 가로 띠(관리자 A6 이미지 관리에서 올린 이미지).
 * 화면 폭 전체를 쓰고 콘텐츠 1440 제한을 받지 않는다. 비율은 globals.css 의 .image-band.
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
      <div style={{ width: '100%', background: 'var(--surface)' }}>
        <img
          src={`/api/band-image/${slot}?v=${encodeURIComponent(String(img.updatedAt))}`}
          width={img.width ?? undefined}
          height={img.height ?? undefined}
          alt={alt}
          style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'cover' }}
          className="image-band"
        />
      </div>
    )
  } catch {
    return null
  }
}
