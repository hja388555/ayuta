// 5번 문의 접수(POST /api/inquiry)와 관리자 문의 화면·첨부 다운로드 게이트를 실제 서버·DB
// 앞에서 고정한다. 첨부는 매직바이트로만 판별되는지, 문의 유형이 URL 값을 그대로 믿지 않는지를 본다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE, api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const marker = `문의테스트-${RUN}`

const userIds: number[] = []
const tokens: Record<string, string | undefined> = {}

// 실제로 열리는 1×1 PNG. Payload 도 업로드 내용을 검사하므로 시그니처만 있는 가짜 바이트는 쓰지 않는다
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)
// Payload validatePDF 기준(머리 %PDF-, 끝 1KB 안에 xref 와 %%EOF)을 만족하는 최소 PDF
const PDF = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\nxref\n0 1\n0000000000 65535 f \ntrailer<<>>\nstartxref\n9\n%%EOF\n')
// 시그니처(%PDF-)만 맞고 구조가 없는 파일 — 매직바이트는 통과하지만 Payload 가 저장 단계에서 거부한다
const CORRUPT_PDF = new TextEncoder().encode('%PDF-1.4\n% test\n')
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

const form = (over: Record<string, string> = {}, files: Array<{ bytes: Uint8Array; name: string; type: string }> = []) => {
  const fd = new FormData()
  const fields = { type: '', body: marker, region: '서울', name: '문의자', phone: '010-9999-0000', email: `inq+${RUN}@example.com`, locale: 'ko', consent: 'on', ...over }
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.set(k, v)
  if (!('country' in over)) fd.append('country', 'kr')
  for (const f of files) fd.append('files', new Blob([f.bytes], { type: f.type }), f.name)
  return fd
}
const submit = (fd: FormData, token?: string) =>
  fetch(`${BASE}/api/inquiry`, { method: 'POST', body: fd, headers: token ? { Authorization: `JWT ${token}` } : {} })

const findInquiry = async (id: number) => {
  const payload = await localPayload()
  return payload.findByID({ collection: 'inquiries', id, depth: 1, overrideAccess: true })
}
const markerCount = async () => {
  const payload = await localPayload()
  return (await payload.count({ collection: 'inquiries', where: { body: { equals: marker } }, overrideAccess: true })).totalDocs
}

beforeAll(async () => {
  const payload = await localPayload()
  for (const [name, role] of [
    ['customer', 'customer'],
    ['manager', 'manager'],
  ] as const) {
    const email = `inq-${name}+${RUN}@ayuta.test`
    const u = await payload.create({
      collection: 'users',
      data: { email, password: PW, ...base, role },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    userIds.push(u.id as number)
    tokens[name] = (await login(email, PW)).token
  }
})

afterAll(async () => {
  const payload = await localPayload()
  const errors: string[] = []
  const attempt = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const { docs } = await payload.find({ collection: 'inquiries', where: { body: { equals: marker } }, depth: 0, limit: 100, overrideAccess: true })
  for (const d of docs) {
    await attempt(`inquiry ${d.id}`, () => payload.db.pool.query('DELETE FROM inquiries WHERE id = $1', [d.id]))
    for (const fid of (d.files as number[] | undefined) ?? []) {
      await attempt(`file ${fid}`, () => payload.db.pool.query('DELETE FROM inquiry_files WHERE id = $1', [fid]))
    }
  }
  for (const id of userIds) await attempt(`user ${id}`, () => payload.delete({ collection: 'users', id, overrideAccess: true }))
  if (errors.length > 0) throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
})

describe('POST /api/inquiry — 접수', () => {
  it('필수값(내용·이름·연락처·이메일)이 빠지면 400 이고 저장되지 않는다', async () => {
    const before = await markerCount()
    for (const missing of ['body', 'name', 'phone', 'email']) {
      const res = await submit(form({ [missing]: '' }))
      expect(res.status).toBe(400)
    }
    expect(await markerCount()).toBe(before)
  })

  it('개인정보 동의가 없으면 400 consent_required 이고 저장되지 않는다', async () => {
    const before = await markerCount()
    for (const consent of ['', 'off']) {
      const res = await submit(form({ consent }))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('consent_required')
    }
    expect(await markerCount()).toBe(before)
  })

  it('국가는 kr·jp 만 여러 개 저장되고, 표에 없는 값·중복은 버린다', async () => {
    const fd = form({ country: '' })
    fd.delete('country')
    for (const c of ['kr', 'jp', 'jp', 'us']) fd.append('country', c)
    const res = await submit(fd)
    expect(res.status).toBe(200)
    const doc = await findInquiry((await res.json()).inquiryId)
    expect([...(doc.country ?? [])].sort()).toEqual(['jp', 'kr'])
  })

  it('비회원도 접수되고, 카테고리 표에 있는 유형은 그대로 저장된다', async () => {
    const res = await submit(form({ type: 'transit' }))
    expect(res.status).toBe(200)
    const { inquiryId } = await res.json()
    const doc = await findInquiry(inquiryId)
    expect(doc.type).toBe('transit')
    expect(doc.customer ?? null).toBeNull()
    expect(doc.status).toBe('new')
  })

  it('표에 없는 유형은 거부하지 않고 미선택으로 저장한다 (1-18)', async () => {
    const res = await submit(form({ type: '<script>' }))
    expect(res.status).toBe(200)
    const doc = await findInquiry((await res.json()).inquiryId)
    expect(doc.type ?? null).toBeNull()
  })

  it('로그인한 고객이 보내면 계정이 연결된다', async () => {
    const res = await submit(form(), tokens.customer)
    const doc = await findInquiry((await res.json()).inquiryId)
    const customerId = typeof doc.customer === 'object' && doc.customer ? (doc.customer as { id: number }).id : doc.customer
    expect(customerId).toBe(userIds[0])
  })

  it('PNG·PDF 첨부는 저장되고 원래 파일 이름이 남는다', async () => {
    const res = await submit(form({}, [
      { bytes: PNG, name: '사진.png', type: 'image/png' },
      { bytes: PDF, name: '기획서.pdf', type: 'application/pdf' },
    ]))
    expect(res.status).toBe(200)
    const doc = await findInquiry((await res.json()).inquiryId)
    const files = doc.files as Array<{ originalName: string; mimeType: string }>
    expect(files.map((f) => f.originalName).sort()).toEqual(['기획서.pdf', '사진.png'])
    expect(files.map((f) => f.mimeType).sort()).toEqual(['application/pdf', 'image/png'])
  })

  it('이름·MIME 을 PNG 로 꾸민 SVG 는 400 이고 문의 자체가 저장되지 않는다', async () => {
    const before = await markerCount()
    const res = await submit(form({}, [
      { bytes: PNG, name: 'ok.png', type: 'image/png' },
      { bytes: SVG, name: '사진.png', type: 'image/png' },
    ]))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_file' })
    expect(await markerCount()).toBe(before)
  })

  it('시그니처만 PDF 인 깨진 파일은 500 이 아니라 400 invalid_file 이고, 먼저 받은 첨부도 남지 않는다', async () => {
    const payload = await localPayload()
    const filesBefore = (await payload.count({ collection: 'inquiry-files', overrideAccess: true })).totalDocs
    const res = await submit(form({}, [
      { bytes: PNG, name: 'ok.png', type: 'image/png' },
      { bytes: CORRUPT_PDF, name: '깨짐.pdf', type: 'application/pdf' },
    ]))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_file' })
    expect((await payload.count({ collection: 'inquiry-files', overrideAccess: true })).totalDocs).toBe(filesBefore)
  })

  it('파일 6개는 400, 합계 4MB 초과는 413 이다', async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ bytes: PNG, name: `${i}.png`, type: 'image/png' }))
    expect((await submit(form({}, six))).status).toBe(400)
    const big = new Uint8Array(4 * 1024 * 1024 + 1)
    big.set(PNG)
    expect((await submit(form({}, [{ bytes: big, name: 'big.png', type: 'image/png' }]))).status).toBe(413)
  })

  it('Payload REST 로 문의를 직접 만들 수 없다 (확인 절차 우회 차단)', async () => {
    const res = await api('/api/inquiries', { method: 'POST', headers: { Authorization: `JWT ${tokens.manager}` }, body: JSON.stringify({ body: 'x', name: 'x', phone: 'x', email: 'x@x.com', locale: 'ko' }) })
    expect(res.status).toBe(403)
  })
})

describe('관리자 문의 화면 · 첨부 다운로드', () => {
  let fileId: number
  let inquiryId: number

  beforeAll(async () => {
    const res = await submit(form({ type: 'other' }, [{ bytes: PDF, name: '자료.pdf', type: 'application/pdf' }]))
    inquiryId = (await res.json()).inquiryId
    const doc = await findInquiry(inquiryId)
    fileId = (doc.files as Array<{ id: number }>)[0]!.id
  })

  const get = (path: string, who?: string) => api(path, { headers: who && tokens[who] ? { Authorization: `JWT ${tokens[who]}` } : {} })

  it('목록·상세는 비로그인·고객에게 404 다', async () => {
    expect((await get('/manage/inquiries')).status).toBe(404)
    expect((await get(`/manage/inquiries/${inquiryId}`, 'customer')).status).toBe(404)
  })

  it('관리자에게는 연락처와 첨부 링크가 보인다', async () => {
    const html = await (await get(`/manage/inquiries/${inquiryId}`, 'manager')).text()
    expect(html).toContain('010-9999-0000')
    expect(html).toContain('자료.pdf')
  })

  it('첨부 다운로드: 비로그인 401, 고객 403, 관리자 200 attachment', async () => {
    expect((await get(`/api/admin/inquiries/files/${fileId}`)).status).toBe(401)
    expect((await get(`/api/admin/inquiries/files/${fileId}`, 'customer')).status).toBe(403)
    const res = await get(`/api/admin/inquiries/files/${fileId}`, 'manager')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF)
  })

  it('Payload 가 여는 파일 URL 도 고객에게는 막혀 있다', async () => {
    const payload = await localPayload()
    const f = await payload.findByID({ collection: 'inquiry-files', id: fileId, overrideAccess: true })
    const res = await get(`/api/inquiry-files/file/${f.filename}`, 'customer')
    expect(res.status).toBe(403)
  })
})

describe('상담신청 → 5번 문의 폼 (1-18, v2)', () => {
  it('문의 유형 선택 없이 국가·동의 항목이 있는 v2 폼이 열린다', async () => {
    const html = await (await api('/ko/order/other?type=transit')).text()
    expect(html).not.toContain('<select')
    expect(html).toContain('개인정보 수집 이용에 동의합니다')
    expect(html).toContain('/ko/privacy')
  })

  it('1~4번 폼 하단에 그 카테고리로 가는 상담신청 링크가 있다', async () => {
    const html = await (await api('/ko/order/press-blog')).text()
    expect(html).toContain('/ko/order/other?type=press-blog')
  })
})
