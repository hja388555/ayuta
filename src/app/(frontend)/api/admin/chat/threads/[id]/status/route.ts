import { NextResponse } from 'next/server'
import { z } from 'zod'
import { chatGate, findThreadById, jsonError, parseId, readJson } from '@/lib/chat/service'

type Ctx = { params: Promise<{ id: string }> }
const BodySchema = z.object({ status: z.enum(['open', 'closed']) }).strict()

/** 관리자: 방 종료·다시 열기 */
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const g = await chatGate('admin')
  if ('response' in g) return g.response
  const id = parseId((await params).id)
  if (id === null) return jsonError('invalid_input', 400)
  const parsed = BodySchema.safeParse(await readJson(req))
  if (!parsed.success) return jsonError('invalid_input', 400)
  const thread = await findThreadById(g.payload, id)
  if (!thread) return jsonError('not_found', 404)
  await g.payload.update({ collection: 'chat-threads', id: thread.id, data: { status: parsed.data.status }, overrideAccess: true })
  return NextResponse.json({ ok: true, status: parsed.data.status })
}
