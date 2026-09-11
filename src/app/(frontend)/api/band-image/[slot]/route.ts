import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { BAND_MIME_TYPES, isBandSlot } from '@/lib/band-images'
import { readUploadFile } from '@/lib/uploads/storage'

/**
 * 광고 서비스 띠 이미지 본문(공개). 운영 버킷은 비공개라 서버가 읽어 내려준다.
 * 교체 직후 반영을 위해 화면은 ?v=<updatedAt> 을 붙여 부른다 — CDN 캐시는 주소 단위다.
 */
const NOT_FOUND = () => NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })

export async function GET(_req: Request, { params }: { params: Promise<{ slot: string }> }): Promise<Response> {
  const { slot } = await params
  if (!isBandSlot(slot)) return NOT_FOUND()
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'band-images', where: { slot: { equals: slot } }, limit: 1, depth: 0, overrideAccess: true })
  const doc = docs[0]
  if (!doc) return NOT_FOUND()
  const data = await readUploadFile(payload, 'band-images', doc)
  if (!data) return NOT_FOUND()
  // DB 값을 그대로 헤더에 쓰지 않는다 — 허용 목록 밖이면 PNG 로 보지 않고 막는다
  const type = (BAND_MIME_TYPES as readonly string[]).includes(String(doc.mimeType)) ? String(doc.mimeType) : null
  if (!type) return NOT_FOUND()
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  })
}
