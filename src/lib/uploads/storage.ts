import 'server-only'
import { readFile } from 'fs/promises'
import path from 'path'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { Payload } from 'payload'
import { S3_PREFIX, s3Enabled, s3ClientConfig } from './s3-config'

/**
 * 업로드 파일(문의 첨부·도장) 본문을 읽는다(큐 Q31 2단계).
 *
 * 운영(S3_ENABLED=true)은 Supabase Storage 버킷에서, 로컬·CI 는 디스크(staticDir)에서 읽는다.
 * 두 컬렉션 모두 공개 주소를 두지 않으므로, 파일은 권한을 확인한 서버 코드가 이 함수로 읽어 내려준다.
 * 파일이 없거나 읽지 못하면 null — 호출부가 404 로 바꾼다.
 */
type UploadSlug = keyof typeof S3_PREFIX
type UploadDoc = { filename?: string | null; prefix?: string | null }

let client: S3Client | null = null
const s3 = () => (client ??= new S3Client(s3ClientConfig()))

export async function readUploadFile(payload: Payload, slug: UploadSlug, doc: UploadDoc): Promise<Buffer | null> {
  // 저장 파일명은 서버가 정했지만, DB 값으로 경로·키를 만들 때는 basename 으로 한 번 더 자른다
  const filename = path.basename(String(doc.filename ?? ''))
  if (!filename) return null
  try {
    if (s3Enabled()) {
      const prefix = (doc.prefix || S3_PREFIX[slug]).replace(/\/+$/, '')
      const res = await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: `${prefix}/${filename}` }))
      if (!res.Body) return null
      return Buffer.from(await res.Body.transformToByteArray())
    }
    const staticDir = (payload.collections[slug].config.upload as { staticDir: string }).staticDir
    return await readFile(path.join(staticDir, filename))
  } catch {
    return null
  }
}
