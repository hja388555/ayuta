import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * 카테고리 폼 맨 위의 가로 띠.
 * 화면 폭 전체를 쓰고 콘텐츠 1440 제한을 받지 않는다.
 *
 * `site-images` 컬렉션은 아직 만들어지지 않았다 (Q23). 그 컬렉션이 없는 채로
 * 이 컴포넌트가 먼저 배포될 수 있으므로, payload.find 가 "모르는 컬렉션" 으로
 * 던지는 경우까지 포함해 실패는 전부 렌더링 생략으로 처리한다 — 빈 회색 박스도,
 * 500 도 남기지 않는다.
 */
export async function ImageBand({ slot }: { slot: string }) {
  try {
    const payload = await getPayload({ config })
    if (!('site-images' in payload.collections)) return null

    const { docs } = await payload.find({
      collection: 'site-images' as never,
      where: { slot: { equals: slot } },
      limit: 1,
    })
    const img = docs[0] as
      | { url?: string | null; alt?: string | null; sizes?: Record<string, { url?: string | null; width?: number | null }> }
      | undefined
    if (!img?.url) return null

    const srcSet = img.sizes
      ? Object.values(img.sizes)
          .filter((s) => s?.url && s?.width)
          .map((s) => `${s.url} ${s.width}w`)
          .join(', ')
      : undefined

    return (
      <div style={{ width: '100%', background: 'var(--surface)' }}>
        <img
          src={img.url}
          srcSet={srcSet}
          sizes="100vw"
          alt={img.alt ?? ''}
          style={{ display: 'block', width: '100%', aspectRatio: '6 / 1', objectFit: 'cover' }}
          className="image-band"
        />
      </div>
    )
  } catch {
    // 컬렉션 미등록·DB 오류 어느 쪽이든 이미지 띠 없이 나머지 화면은 그대로 뜬다
    return null
  }
}
