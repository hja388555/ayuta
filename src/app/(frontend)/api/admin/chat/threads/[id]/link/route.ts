import { NextResponse } from 'next/server'
import { chatGate, findThreadById, jsonError, parseId, rotateGuestToken } from '@/lib/chat/service'

type Ctx = { params: Promise<{ id: string }> }

/**
 * 관리자: 비회원 방의 채팅 링크 발급. 매번 새 토큰으로 바꿔 끼운다 — 이전 링크와 고객 브라우저의 이전 쿠키는 바로 끊긴다.
 * 원문 토큰은 이 응답에만 담긴다(DB 에는 해시). 회원 방은 로그인으로 들어오므로 400.
 */
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const g = await chatGate('admin')
  if ('response' in g) return g.response
  const id = parseId((await params).id)
  if (id === null) return jsonError('invalid_input', 400)
  const thread = await findThreadById(g.payload, id)
  if (!thread) return jsonError('not_found', 404)
  if (thread.customer != null) return jsonError('not_guest', 400)
  const token = await rotateGuestToken(g.payload, thread.id)
  const path = `/${thread.locale === 'ja' ? 'ja' : 'ko'}/chat/g/${token}`
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(req.url).origin
  return NextResponse.json({ ok: true, path, url: `${site.replace(/\/+$/, '')}${path}` }, { headers: { 'Cache-Control': 'no-store' } })
}
