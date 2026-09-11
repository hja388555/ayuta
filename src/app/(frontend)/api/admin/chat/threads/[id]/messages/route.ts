import { NextResponse } from 'next/server'
import { z } from 'zod'
import { chatGate, findThreadById, jsonError, listMessages, messageView, parseAfter, parseId, readJson, sendMessage, threadView } from '@/lib/chat/service'
import { MAX_BODY } from '@/lib/chat/rules'

type Ctx = { params: Promise<{ id: string }> }
const BodySchema = z.object({ body: z.string().min(1).max(MAX_BODY) }).strict()

/** 관리자: 방의 메시지(after 가 없으면 최근 50개) */
export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  const g = await chatGate('admin')
  if ('response' in g) return g.response
  const id = parseId((await params).id)
  const after = parseAfter(new URL(req.url).searchParams.get('after'))
  if (id === null || after === null) return jsonError('invalid_input', 400)
  const thread = await findThreadById(g.payload, id)
  if (!thread) return jsonError('not_found', 404)
  const messages = await listMessages(g.payload, thread.id, after)
  return NextResponse.json({ thread: threadView(thread), messages: messages.map((m) => messageView(m, true)) })
}

/** 관리자: 답장. 방 언어가 일본어면 일본어 번역을 함께 저장한다 */
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const g = await chatGate('admin')
  if ('response' in g) return g.response
  const id = parseId((await params).id)
  if (id === null) return jsonError('invalid_input', 400)
  const parsed = BodySchema.safeParse(await readJson(req))
  if (!parsed.success) return jsonError('invalid_input', 400)
  const thread = await findThreadById(g.payload, id)
  if (!thread) return jsonError('not_found', 404)
  const r = await sendMessage(g.payload, thread, 'admin', g.user, parsed.data.body)
  if ('error' in r) return jsonError(r.error, r.status)
  return NextResponse.json({ message: messageView(r.message, true) })
}
