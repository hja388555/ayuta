import 'server-only'
import { readFile } from 'fs/promises'
import path from 'path'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * 대표자 서명·날인 이미지(큐 Q25 3차).
 *
 * 날인 이미지는 위조에 쓰일 수 있어 공개 URL 을 두지 않는다(BrandAssets 참고). 그래서 계약서를
 * 보여주는 화면이 — 이미 그 주문을 볼 권한을 확인한 서버 컴포넌트가 — 파일을 읽어 data URI 로
 * 페이지에 직접 넣는다. 이미지만 따로 떼어 여는 주소가 생기지 않는다.
 *
 * 주문에는 결제 시점의 자산 id 를 고정한다(orders.sealAsset). 관리자가 나중에 도장을 바꿔도
 * 옛 계약서는 그때 찍힌 도장 그대로다. 업로드는 매번 새 자산을 만들고 지우지 않으므로 옛 파일이 남는다.
 */
type AssetRef = number | { id: number; filename?: string | null } | null | undefined

/** 지금 설정된 도장 자산 id. 없으면 null — 도장 없이도 주문은 된다 */
export async function currentSealAssetId(): Promise<number | null> {
  const payload = await getPayload({ config })
  const row = await payload.findGlobal({ slug: 'company-settings', depth: 0, overrideAccess: true })
  const seal = row.sealImage as unknown
  if (typeof seal === 'number') return seal
  if (seal && typeof seal === 'object' && typeof (seal as { id?: unknown }).id === 'number') return (seal as { id: number }).id
  return null
}

/** 자산을 data URI 로 읽는다. 없거나 파일이 사라졌으면 undefined — 계약서는 도장 없이 보인다 */
export async function sealDataUri(ref: AssetRef): Promise<string | undefined> {
  if (ref == null) return undefined
  const payload = await getPayload({ config })
  const asset =
    typeof ref === 'object' && ref.filename
      ? ref
      : await payload.findByID({ collection: 'brand-assets', id: typeof ref === 'object' ? ref.id : ref, depth: 0, overrideAccess: true }).catch(() => null)
  const filename = path.basename(String(asset?.filename ?? ''))
  if (!filename) return undefined
  const staticDir = (payload.collections['brand-assets'].config.upload as { staticDir: string }).staticDir
  try {
    const buf = await readFile(path.join(staticDir, filename))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return undefined
  }
}

/** 목록 화면용 — 같은 도장을 쓰는 주문이 여러 개여도 파일은 한 번만 읽는다 */
export function createSealLoader(): (ref: AssetRef) => Promise<string | undefined> {
  const cache = new Map<number, Promise<string | undefined>>()
  return (ref) => {
    const id = ref == null ? null : typeof ref === 'object' ? ref.id : ref
    if (id == null) return Promise.resolve(undefined)
    if (!cache.has(id)) cache.set(id, sealDataUri(ref))
    return cache.get(id)!
  }
}
