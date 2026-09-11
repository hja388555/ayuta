import { NextResponse } from 'next/server'
import { z } from 'zod'
import { chatGate, findOwnThread, jsonError, listMessages, messageView, parseAfter, readJson, sendMessage } from '@/lib/chat/service'
import { MAX_BODY } from '@/lib/chat/rules'

const BodySchema = z.object({ body: z.string().min(1).max(MAX_BODY) }).strict()

/** 고객: 내 방의 새 메시지(폴링). 방이 없으면 404 */
export async function GET(req: Request): Promise<Response> {
  const g = await chatGate('user')
  if ('response' in g) return g.response
  const after = parseAfter(new URL(req.url).searchParams.get('after'))
  if (after === null) return jsonError('invalid_input', 400)
  const thread = await findOwnThread(g.payload, g.user.id)
  if (!thread) return jsonError('not_found', 404)
  const messages = await listMessages(g.payload, thread.id, after)
  return NextResponse.json({ status: thread.status, messages: messages.map((m) => messageView(m, false)) })
}

/** 고객: 내 방에 메시지 보내기. 방은 GET /api/chat/thread 가 먼저 만든다 */
export async function POST(req: Request): Promise<Response> {
  const g = await chatGate('user')
  if ('response' in g) return g.response
  const parsed = BodySchema.safeParse(await readJson(req))
  if (!parsed.success) return jsonError('invalid_input', 400)
  const thread = await findOwnThread(g.payload, g.user.id)
  if (!thread) return jsonError('not_found', 404)
  const r = await sendMessage(g.payload, thread, 'customer', g.user, parsed.data.body)
  if ('error' in r) return jsonError(r.error, r.status)
  return NextResponse.json({ message: messageView(r.message, false) })
}
