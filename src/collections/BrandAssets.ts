import path from 'path'
import { fileURLToPath } from 'url'
import type { CollectionConfig } from 'payload'
import { isActiveAdmin } from '../lib/admin-access'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 관리자 설정에서 올리는 회사 자산 이미지 — 지금은 대표자 서명·날인(투명 PNG)뿐이다(큐 Q25).
 * 올리는 경로는 관리자 API(/api/admin/settings/seal) 하나다. 그 경로가 PNG·투명 채널을 확인한 뒤
 * Local API 로 저장한다 — REST create 를 닫는다.
 * 날인 이미지는 위조에 쓰일 수 있어 공개 URL 을 두지 않는다(읽기는 관리자만).
 *
 * ⚠ 지금은 로컬 디스크(uploads/, gitignore)에 저장한다. Supabase Storage 어댑터로 교체해야
 *   Vercel 배포가 가능하다(inquiry-files 와 같은 사정).
 */
export const BrandAssets: CollectionConfig = {
  slug: 'brand-assets',
  access: {
    create: () => false,
    read: ({ req }) => isActiveAdmin(req),
    update: () => false,
    delete: () => false,
    unlock: () => false,
    admin: () => false,
  },
  upload: {
    staticDir: path.resolve(dirname, '../../uploads/brand-assets'),
    mimeTypes: ['image/png'],
  },
  fields: [{ name: 'kind', type: 'select', required: true, options: ['seal'] }],
}
