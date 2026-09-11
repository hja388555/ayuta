import { NextResponse } from 'next/server'
import { customerGate, getOrCreateOwnThread, listMessages, messageView, threadView } from '@/lib/chat/service'
import { toChatLocale } from '@/lib/chat/rules'

/** 고객: 내 채팅 방 + 최근 메시지 50개. 회원은 방이 없으면 이 화면 언어로 만들고, 비회원은 쿠키의 방(POST /api/chat/guest 가 만든다) */
export async function GET(req: Request): Promise<Response> {
  const g = await customerGate()
  if ('response' in g) return g.response
  const locale = toChatLocale(new URL(req.url).searchParams.get('locale'))
  const thread = g.kind === 'guest' ? g.thread : await getOrCreateOwnThread(g.payload, g.user.id, locale)
  const messages = await listMessages(g.payload, thread.id)
  return NextResponse.json({ thread: threadView(thread), messages: messages.map((m) => messageView(m, false)) })
}
