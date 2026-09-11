import { NextResponse } from 'next/server'
import { chatGate, findThreadById, jsonError, markRead, parseId } from '@/lib/chat/service'

type Ctx = { params: Promise<{ id: string }> }

/** 관리자: 방의 관리자 안 읽음 수를 0으로 */
export async function POST(_req: Request, { params }: Ctx): Promise<Response> {
  const g = await chatGate('admin')
  if ('response' in g) return g.response
  const id = parseId((await params).id)
  if (id === null) return jsonError('invalid_input', 400)
  const thread = await findThreadById(g.payload, id)
  if (!thread) return jsonError('not_found', 404)
  await markRead(g.payload, thread.id, 'admin')
  return NextResponse.json({ ok: true })
}
