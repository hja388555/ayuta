import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { getPayload } from 'payload'
import config from '@payload-config'
import { BAND_MAX_WIDTH, BAND_MIME_TYPES, bandCacheControl, isBandSlot } from '@/lib/band-images'
import { readUploadFile } from '@/lib/uploads/storage'

/**
 * 광고 서비스 띠 이미지 본문(공개). 운영 버킷은 비공개라 서버가 읽어 내려준다.
 * 교체 직후 반영을 위해 화면은 ?v=<updatedAt> 을 붙여 부른다 — CDN 캐시는 주소 단위다.
 */
const NOT_FOUND = () => NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })

export async function GET(req: Request, { params }: { params: Promise<{ slot: string }> }): Promise<Response> {
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

  // 최적화 전에 올린 이미지(원본 JPG·PNG, 큰 WEBP)는 내려보낼 때 줄인다. 결과는 CDN 이 주소 단위로 캐시한다
  let body: Uint8Array = new Uint8Array(data)
  let contentType = type
  if (type !== 'image/webp' || Number(doc.width ?? 0) > BAND_MAX_WIDTH) {
    try {
      body = new Uint8Array(await sharp(data).rotate().resize({ width: BAND_MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer())
      contentType = 'image/webp'
    } catch {}
  }

  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': bandCacheControl(new URL(req.url).searchParams.get('v'), String(doc.updatedAt)),
    },
  })
}
