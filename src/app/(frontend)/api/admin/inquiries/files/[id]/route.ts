import path from 'node:path'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AuthError, requireAdmin } from '@/lib/dal'
import { readUploadFile } from '@/lib/uploads/storage'

/**
 * 문의 첨부 다운로드. 관리자만 열 수 있다.
 *
 * 항상 첨부(attachment)로 내려보내고 nosniff 를 건다 — 업로드 시 매직바이트로 형식을
 * 확인했지만, 관리자 브라우저가 파일을 페이지처럼 해석해 스크립트를 돌릴 여지를 두 번째로 막는다.
 * 파일 본문은 운영에선 비공개 버킷, 로컬에선 디스크에서 읽는다(readUploadFile). 서명 URL 로
 * 넘기지 않는다 — 버킷 응답에는 위 헤더를 붙일 수 없다.
 */
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === 'UNAUTHENTICATED' ? 401 : 403
      return NextResponse.json({ error: status === 401 ? 'unauthenticated' : 'forbidden' }, { status })
    }
    throw err
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const payload = await getPayload({ config })
  let doc
  try {
    doc = await payload.findByID({ collection: 'inquiry-files', id, overrideAccess: true, depth: 0 })
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const filename = path.basename(String(doc.filename ?? ''))
  const data = await readUploadFile(payload, 'inquiry-files', doc)
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const downloadName = String(doc.originalName || filename)
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': String(doc.mimeType || 'application/octet-stream'),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
