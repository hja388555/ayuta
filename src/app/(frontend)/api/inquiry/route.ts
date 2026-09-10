import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { categoryBySlug } from '@/lib/categories'
import { getSessionUser } from '@/lib/dal'
import { EXTENSION_FOR, sniffFileType } from '@/lib/file-sniff'

/**
 * 5번(기타 광고) 문의 접수. 로그인을 요구하지 않는다(요구사항 1-12: 비회원 비중이 높다).
 *
 * 경로가 /api/inquiry(단수)인 이유: /api/inquiries 는 Payload 가 컬렉션 REST 로 연다.
 * 그 REST create 는 닫혀 있고(Inquiries access), 문의는 이 경로로만 만들어진다 —
 * 유형 대조·첨부 매직바이트 확인을 건너뛴 문의가 들어오지 않게 한다.
 *
 * 첨부 상한(5개·합계 4MB)은 Vercel 함수 요청 본문 상한(4.5MB) 때문이다. 저장소에 직접
 * 올리는 방식(서명 URL)으로 바꾸면 올린다.
 */
export const MAX_FILES = 5
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024

const FieldsSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  region: z.string().trim().max(200).optional().default(''),
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(200),
  locale: z.enum(['ko', 'ja']),
  type: z.string().max(50).optional().default(''),
})

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : undefined)

export async function POST(req: Request): Promise<Response> {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const parsed = FieldsSchema.safeParse({
    body: str(form.get('body')),
    region: str(form.get('region')),
    name: str(form.get('name')),
    phone: str(form.get('phone')),
    email: str(form.get('email')),
    locale: str(form.get('locale')),
    type: str(form.get('type')),
  })
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  const fields = parsed.data

  // 1-18: URL 에서 온 유형은 신뢰하지 않는다. 카테고리 표에 없으면 미선택으로 저장한다(거부하지 않는다)
  const type = fields.type && categoryBySlug(fields.type) ? fields.type : null

  const files = form.getAll('files').filter((f): f is File => typeof f !== 'string' && f.size > 0)
  if (files.length > MAX_FILES) return NextResponse.json({ error: 'too_many_files' }, { status: 400 })
  const total = files.reduce((sum, f) => sum + f.size, 0)
  if (total > MAX_TOTAL_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })

  // 전부 확인한 뒤에 저장한다 — 두 번째 파일이 거부되면 첫 번째도 남기지 않는다
  const checked: Array<{ buf: Buffer; mime: keyof typeof EXTENSION_FOR; originalName: string }> = []
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer())
    const mime = sniffFileType(buf)
    if (!mime) return NextResponse.json({ error: 'invalid_file' }, { status: 400 })
    checked.push({ buf, mime, originalName: f.name.slice(0, 200) })
  }

  const payload = await getPayload({ config })
  const sessionUser = await getSessionUser()

  const fileIds: number[] = []
  try {
    for (const c of checked) {
      const created = await payload.create({
        collection: 'inquiry-files',
        data: { originalName: c.originalName },
        // 저장 파일명은 서버가 정한다 — 고객 파일명의 경로·특수문자를 디스크에 쓰지 않는다
        file: { data: c.buf, mimetype: c.mime, name: `inquiry-${randomUUID()}.${EXTENSION_FOR[c.mime]}`, size: c.buf.length },
        overrideAccess: true,
      })
      fileIds.push(created.id as number)
    }
  } catch {
    // 앞머리 바이트는 맞지만 내용이 깨진 파일(예: 시그니처만 PDF 인 파일)은 Payload 가 저장 단계에서
    // 거부한다. 500 이 아니라 형식 오류로 돌려주고, 먼저 저장된 첨부는 지운다 — 문의 없이 떠도는
    // 파일을 남기지 않는다
    for (const id of fileIds) await payload.delete({ collection: 'inquiry-files', id, overrideAccess: true }).catch(() => {})
    return NextResponse.json({ error: 'invalid_file' }, { status: 400 })
  }

  const inquiry = await payload.create({
    collection: 'inquiries',
    data: {
      type,
      body: fields.body,
      region: fields.region || null,
      name: fields.name,
      phone: fields.phone,
      email: fields.email,
      locale: fields.locale,
      customer: sessionUser?.id ?? null,
      files: fileIds,
      status: 'new',
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, inquiryId: inquiry.id })
}
