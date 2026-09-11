import { NextResponse } from 'next/server'
import { chatGate, getOrCreateOwnThread, listMessages, messageView, threadView } from '@/lib/chat/service'
import { toChatLocale } from '@/lib/chat/rules'

/** 고객: 내 채팅 방(없으면 이 화면 언어로 만든다) + 최근 메시지 50개 */
export async function GET(req: Request): Promise<Response> {
  const g = await chatGate('user')
  if ('response' in g) return g.response
  const locale = toChatLocale(new URL(req.url).searchParams.get('locale'))
  const thread = await getOrCreateOwnThread(g.payload, g.user.id, locale)
  const messages = await listMessages(g.payload, thread.id)
  return NextResponse.json({ thread: threadView(thread), messages: messages.map((m) => messageView(m, false)) })
}
