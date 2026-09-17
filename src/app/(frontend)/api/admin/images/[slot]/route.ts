import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireSuperForApi } from '@/lib/admin/require-super'
import { BAND_FOCUS_DEFAULT, BAND_MAX_BYTES, checkBandUpload, isBandSlot, parseFocus } from '@/lib/band-images'

/**
 * 광고 서비스 띠 이미지 교체·삭제(Figma [v2] A6). 최고관리자만.
 * POST: multipart `file`. 내용으로 JPG·PNG·WEBP 확인, 5MB 까지. 슬롯에 있던 이미지는 지우고 새로 만든다.
 * PATCH: `{ focusY }` 띠에 보일 위아래 위치(0~100 정수). 빈 슬롯은 404.
 * DELETE: 문서와 저장 파일을 함께 지운다(Payload 가 업로드 파일을 같이 정리한다) — 되돌릴 수 없다.
 */
type Ctx = { params: Promise<{ slot: string }> }

async function removeSlot(slot: string) {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({ collection: 'band-images', where: { slot: { equals: slot } }, limit: 10, depth: 0, overrideAccess: true })
  for (const d of docs) await payload.delete({ collection: 'band-images', id: d.id, overrideAccess: true })
  return docs.length
}

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const gate = await requireSuperForApi()
  if ('response' in gate) return gate.response
  const { slot } = await params
  if (!isBandSlot(slot)) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // 본문을 다 읽기 전에 크기로 먼저 거른다(multipart 경계만큼 여유를 둔다)
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > BAND_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: 'band_image_too_large' }, { status: 413 })

  let file: File | null = null
  try {
    const f = (await req.formData()).get('file')
    file = typeof f === 'string' ? null : f
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'invalid_band_image' }, { status: 400 })
  if (file.size > BAND_MAX_BYTES) return NextResponse.json({ error: 'band_image_too_large' }, { status: 413 })

  const buf = Buffer.from(await file.arrayBuffer())
  const checked = checkBandUpload(buf)
  if (!checked.ok) {
    return NextResponse.json({ error: checked.status === 413 ? 'band_image_too_large' : 'invalid_band_image' }, { status: checked.status })
  }

  // 앞머리 바이트는 맞지만 내용이 깨진 파일을 지우기 전에 걸러낸다 — 실제로 디코딩되는지 확인한다.
  // 이 확인 없이 교체하면 이전 이미지를 지운 뒤 저장이 실패해 슬롯이 비어 버린다
  try {
    const meta = await sharp(buf).metadata()
    if (!meta.width || !meta.height) throw new Error('no dimensions')
  } catch {
    return NextResponse.json({ error: 'invalid_band_image' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  try {
    // slot 은 unique — 새 문서를 만들기 전에 이전 문서(와 파일)를 지운다. 새 파일은 위에서 디코딩을 확인했다
    await removeSlot(slot)
    await payload.create({
      collection: 'band-images',
      // 새 사진이라 이전 위치는 의미가 없다 — 가운데로 돌아간다
      data: { slot, focusY: BAND_FOCUS_DEFAULT },
      file: { data: buf, mimetype: checked.mime, name: `${slot}-${randomUUID()}.${checked.ext}`, size: buf.length },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch {
    // 앞머리 바이트는 맞지만 내용이 깨진 파일은 Payload(sharp)가 저장 단계에서 거부한다
    return NextResponse.json({ error: 'invalid_band_image' }, { status: 400 })
  }
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const gate = await requireSuperForApi()
  if ('response' in gate) return gate.response
  const { slot } = await params
  if (!isBandSlot(slot)) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  let focusY: number | null = null
  try {
    focusY = parseFocus(((await req.json()) as { focusY?: unknown } | null)?.focusY)
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (focusY === null) return NextResponse.json({ error: 'invalid_band_focus' }, { status: 400 })

  try {
    const payload = await getPayload({ config })
    // update 가 updatedAt 을 새로 찍는다 — 화면의 ?v= 가 바뀌어 캐시된 페이지·이미지 주소가 갈린다
    const { docs } = await payload.update({ collection: 'band-images', where: { slot: { equals: slot } }, data: { focusY }, depth: 0, overrideAccess: true })
    if (docs.length === 0) return NextResponse.json({ error: 'band_image_not_found' }, { status: 404 })
    return NextResponse.json({ ok: true, focusY })
  } catch {
    return NextResponse.json({ error: 'band_image_failed' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
  const gate = await requireSuperForApi()
  if ('response' in gate) return gate.response
  const { slot } = await params
  if (!isBandSlot(slot)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  try {
    const removed = await removeSlot(slot)
    if (removed === 0) return NextResponse.json({ error: 'band_image_not_found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'band_image_failed' }, { status: 500 })
  }
}
