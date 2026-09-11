import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { readUploadFile } from '@/lib/uploads/storage'
import { AuthError, requireAdmin } from '@/lib/dal'
import { requireSuperForApi } from '@/lib/admin/require-super'
import { isTransparentCapablePng } from '@/lib/png-alpha'

/**
 * 대표자 서명·날인 이미지(큐 Q25 — 투명 PNG).
 * POST: 최고관리자만 올린다. PNG 이고 투명 채널이 있어야 한다(흰 배경이면 계약서 글자를 가린다).
 *       2MB 까지. 이전 이미지는 지우지 않는다(언제 무엇이 쓰였는지 남긴다).
 * GET: 관리자 설정 화면 미리보기. 날인은 위조에 쓰일 수 있어 공개 URL 을 두지 않는다.
 */
const MAX_BYTES = 2 * 1024 * 1024

export async function POST(req: Request): Promise<Response> {
  const gate = await requireSuperForApi()
  if ('response' in gate) return gate.response

  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('file')
    file = typeof f === 'string' ? null : f
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!file || file.size === 0) return NextResponse.json({ error: 'invalid_image' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'invalid_image' }, { status: 413 })

  const buf = Buffer.from(await file.arrayBuffer())
  if (!isTransparentCapablePng(buf)) return NextResponse.json({ error: 'invalid_image' }, { status: 400 })

  const payload = await getPayload({ config })
  try {
    const asset = await payload.create({
      collection: 'brand-assets',
      data: { kind: 'seal' },
      file: { data: buf, mimetype: 'image/png', name: `seal-${randomUUID()}.png`, size: buf.length },
      overrideAccess: true,
    })
    await payload.updateGlobal({ slug: 'company-settings', data: { sealImage: asset.id }, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch {
    // 시그니처는 PNG 지만 내용이 깨진 파일은 Payload 가 저장 단계에서 거부한다
    return NextResponse.json({ error: 'invalid_image' }, { status: 400 })
  }
}

export async function GET(): Promise<Response> {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === 'UNAUTHENTICATED' ? 401 : 403
      return NextResponse.json({ error: status === 401 ? 'unauthenticated' : 'forbidden' }, { status })
    }
    throw err
  }
  const payload = await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'company-settings', depth: 1, overrideAccess: true })
  const seal = settings.sealImage
  if (!seal || typeof seal !== 'object') return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const data = await readUploadFile(payload, 'brand-assets', seal)
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' },
  })
}
