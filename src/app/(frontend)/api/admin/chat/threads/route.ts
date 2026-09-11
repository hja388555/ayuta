import { NextResponse } from 'next/server'
import { chatGate, listThreadsForAdmin } from '@/lib/chat/service'

/** 관리자: 채팅 방 목록(최근 대화 순) */
export async function GET(): Promise<Response> {
  const g = await chatGate('admin')
  if ('response' in g) return g.response
  return NextResponse.json({ threads: await listThreadsForAdmin(g.payload) })
}
