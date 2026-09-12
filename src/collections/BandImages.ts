import path from 'path'
import { fileURLToPath } from 'url'
import type { CollectionConfig } from 'payload'
import { BAND_FOCUS_DEFAULT, BAND_MIME_TYPES, BAND_SLOTS } from '../lib/band-images'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 광고 서비스 페이지 상단 띠 이미지(Figma [v2] A6). 슬롯마다 한 장.
 * 올리기·지우기는 관리자 API(/api/admin/images/[slot]) 하나로만 한다 — 거기서 최고관리자·형식·5MB 를 확인한다.
 * 공개 마케팅 이미지라 문서 읽기는 열어 두고, 파일 본문은 /api/band-image/[slot] 이 내려준다
 * (운영 버킷은 비공개라 버킷 주소로는 열리지 않는다).
 */
export const BandImages: CollectionConfig = {
  slug: 'band-images',
  access: {
    create: () => false,
    read: () => true,
    update: () => false,
    delete: () => false,
    unlock: () => false,
    admin: () => false,
  },
  upload: {
    staticDir: path.resolve(dirname, '../../uploads/band-images'),
    mimeTypes: [...BAND_MIME_TYPES],
  },
  fields: [
    { name: 'slot', type: 'select', required: true, unique: true, index: true, options: [...BAND_SLOTS] },
    { name: 'altKo', type: 'text' },
    { name: 'altJa', type: 'text' },
    // 띠에 보일 위아래 위치(0~100%). 위치 저장은 PATCH /api/admin/images/[slot], 교체하면 새 문서라 가운데로 돌아간다
    { name: 'focusY', type: 'number', required: true, defaultValue: BAND_FOCUS_DEFAULT, min: 0, max: 100 },
  ],
}
