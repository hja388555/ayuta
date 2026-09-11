import path from 'path'
import { fileURLToPath } from 'url'
import type { CollectionConfig } from 'payload'
import { isActiveAdmin } from '../lib/admin-access'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 5번 문의에 붙은 첨부 파일.
 *
 * 저장은 제출 API(POST /api/inquiries)가 매직바이트를 확인한 뒤 Local API 로만 한다 —
 * REST create 를 닫아 확인을 건너뛴 업로드를 받지 않는다.
 * 열람도 관리자만: Payload 가 여는 파일 URL(/api/inquiry-files/file/…)은
 * 이 컬렉션의 read access 를 탄다.
 *
 * 운영은 Supabase Storage 비공개 버킷(inquiry-files/ 접두사), 로컬·CI 는 아래 staticDir 디스크에 저장한다
 * (payload.config 의 s3Storage, S3_ENABLED). 읽기는 src/lib/uploads/storage.ts.
 */
export const InquiryFiles: CollectionConfig = {
  slug: 'inquiry-files',
  access: {
    create: () => false,
    read: ({ req }) => isActiveAdmin(req),
    update: () => false,
    delete: () => false,
    unlock: () => false,
    admin: () => false,
  },
  upload: {
    staticDir: path.resolve(dirname, '../../uploads/inquiry-files'),
    // 매직바이트 확인은 제출 API 가 한다. 여기 목록은 그 뒤의 두 번째 선이다
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  fields: [
    // 고객이 올린 원래 파일 이름. 저장 파일명은 서버가 정한다(경로·특수문자 섞인 이름을 믿지 않는다)
    { name: 'originalName', type: 'text' },
  ],
}
