import { NextResponse } from 'next/server'
import { chatGate, findOwnThread, jsonError, markRead } from '@/lib/chat/service'

/** 고객: 내 방의 안 읽음 수를 0으로 */
export async function POST(): Promise<Response> {
  const g = await chatGate('user')
  if ('response' in g) return g.response
  const thread = await findOwnThread(g.payload, g.user.id)
  if (!thread) return jsonError('not_found', 404)
  await markRead(g.payload, thread.id, 'customer')
  return NextResponse.json({ ok: true })
}
