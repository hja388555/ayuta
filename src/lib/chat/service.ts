import 'server-only'
import { NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { AuthError, requireAdmin, requireUser, type SessionUser } from '@/lib/dal'
import type { ChatMessage, ChatThread } from '@/payload-types'
import { cleanBody, isRateLimited, rateWindowStart, targetLang, toChatLocale, type ChatLocale } from './rules'
import { translate } from './translate'

/**
 * 1:1 채팅 서버 로직(큐 Q37). 컬렉션 REST 는 닫혀 있고 여기 함수들만 Local API 로 읽고 쓴다.
 * 고객 경로는 "세션 사용자 = 방 주인"으로만 방을 찾는다 — 방 id 를 받지 않으니 남의 방을 지목할 길이 없다.
 */

export const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status })

export async function chatGate(kind: 'user' | 'admin'): Promise<{ user: SessionUser; payload: Payload } | { response: Response }> {
  try {
    const user = kind === 'admin' ? await requireAdmin() : await requireUser()
    return { user, payload: await getPayload({ config }) }
  } catch (err) {
    if (err instanceof AuthError) {
      return { response: err.code === 'UNAUTHENTICATED' ? jsonError('unauthenticated', 401) : jsonError('forbidden', 403) }
    }
    throw err
  }
}

/** ?after= 는 양의 정수만. 없으면 undefined, 이상하면 null */
export function parseAfter(v: string | null): number | undefined | null {
  if (v === null || v === '') return undefined
  return /^\d{1,12}$/.test(v) ? Number(v) : null
}

export const parseId = (v: string): number | null => (/^\d{1,12}$/.test(v) ? Number(v) : null)

export type MessageView = {
  id: number
  sender: 'customer' | 'admin'
  body: string
  translatedBody: string | null
  sourceLang: string | null
  translatedLang: string | null
  translationStatus: 'ok' | 'failed' | 'skipped'
  createdAt: string
  senderEmail?: string | null
}

export function messageView(m: ChatMessage, forAdmin: boolean): MessageView {
  const v: MessageView = {
    id: m.id,
    sender: m.sender,
    body: m.body,
    translatedBody: m.translatedBody ?? null,
    sourceLang: m.sourceLang ?? null,
    translatedLang: m.translatedLang ?? null,
    translationStatus: m.translationStatus,
    createdAt: m.createdAt,
  }
  // 고객에게는 관리자 계정 이메일을 보이지 않는다
  if (forAdmin) v.senderEmail = m.senderEmail ?? null
  return v
}

export const threadView = (t: ChatThread) => ({
  id: t.id,
  locale: t.locale,
  status: t.status,
  lastMessageAt: t.lastMessageAt ?? null,
  unreadForAdmin: t.unreadForAdmin,
  unreadForCustomer: t.unreadForCustomer,
})

export async function findOwnThread(payload: Payload, userId: number): Promise<ChatThread | null> {
  const { docs } = await payload.find({ collection: 'chat-threads', where: { customer: { equals: userId } }, limit: 1, depth: 0, overrideAccess: true })
  return docs[0] ?? null
}

export async function getOrCreateOwnThread(payload: Payload, userId: number, locale: ChatLocale): Promise<ChatThread> {
  const found = await findOwnThread(payload, userId)
  if (found) return found
  try {
    return await payload.create({ collection: 'chat-threads', data: { customer: userId, locale, status: 'open', unreadForAdmin: 0, unreadForCustomer: 0 }, overrideAccess: true })
  } catch (err) {
    // 동시에 두 요청이 방을 만들면 unique 에 걸린다 — 먼저 만들어진 방을 쓴다
    const again = await findOwnThread(payload, userId)
    if (again) return again
    throw err
  }
}

export async function findThreadById(payload: Payload, id: number): Promise<ChatThread | null> {
  try {
    return await payload.findByID({ collection: 'chat-threads', id, depth: 0, overrideAccess: true })
  } catch {
    return null
  }
}

/** after 가 있으면 그 뒤의 새 메시지(오래된 순), 없으면 최근 50개(오래된 순) */
export async function listMessages(payload: Payload, threadId: number, after?: number): Promise<ChatMessage[]> {
  if (after !== undefined) {
    const { docs } = await payload.find({
      collection: 'chat-messages',
      where: { and: [{ thread: { equals: threadId } }, { id: { greater_than: after } }] },
      sort: 'id',
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    return docs
  }
  const { docs } = await payload.find({ collection: 'chat-messages', where: { thread: { equals: threadId } }, sort: '-id', limit: 50, depth: 0, overrideAccess: true })
  return docs.reverse()
}

export type SendResult = { message: ChatMessage } | { error: string; status: number }

export async function sendMessage(payload: Payload, thread: ChatThread, sender: 'customer' | 'admin', user: SessionUser, rawBody: string): Promise<SendResult> {
  const body = cleanBody(rawBody)
  if (!body) return { error: 'invalid_input', status: 400 }

  const recent = await payload.count({
    collection: 'chat-messages',
    where: { and: [{ senderUser: { equals: user.id } }, { createdAt: { greater_than: rateWindowStart().toISOString() } }] },
    overrideAccess: true,
  })
  if (isRateLimited(recent.totalDocs)) return { error: 'rate_limited', status: 429 }

  const locale = toChatLocale(thread.locale)
  const target = targetLang(sender, locale)
  const tr = target ? await translate(body, target) : null
  const message = await payload.create({
    collection: 'chat-messages',
    data: {
      thread: thread.id,
      sender,
      senderUser: user.id,
      senderEmail: user.email,
      body,
      sourceLang: tr?.sourceLang ?? (sender === 'admin' && locale === 'ko' ? 'KO' : null),
      translatedBody: tr?.status === 'ok' ? tr.text : null,
      translatedLang: tr?.status === 'ok' ? tr.targetLang : null,
      translationStatus: tr?.status ?? 'skipped',
    },
    overrideAccess: true,
  })

  // 안 읽음 수는 동시에 여러 메시지가 와도 빠지지 않게 SQL 에서 더한다. 고객이 쓰면 닫힌 방이 다시 열린다
  const isCustomer = sender === 'customer'
  await payload.db.pool.query(
    `UPDATE chat_threads
        SET last_message_at = $1, updated_at = $1,
            unread_for_admin = unread_for_admin + $2,
            unread_for_customer = unread_for_customer + $3,
            status = CASE WHEN $4::boolean THEN 'open'::enum_chat_threads_status ELSE status END
      WHERE id = $5`,
    [message.createdAt, isCustomer ? 1 : 0, isCustomer ? 0 : 1, isCustomer, thread.id],
  )
  return { message }
}

export async function markRead(payload: Payload, threadId: number, who: 'customer' | 'admin') {
  await payload.update({
    collection: 'chat-threads',
    id: threadId,
    data: who === 'customer' ? { unreadForCustomer: 0 } : { unreadForAdmin: 0 },
    overrideAccess: true,
  })
}

export type ThreadListItem = ReturnType<typeof threadView> & {
  customerName: string | null
  customerEmail: string | null
  preview: string | null
}

/** 관리자 목록: 최근 대화 순 100개, 고객 이름·이메일, 마지막 메시지 미리보기(한국어 우선) */
export async function listThreadsForAdmin(payload: Payload): Promise<ThreadListItem[]> {
  const { docs: threads } = await payload.find({ collection: 'chat-threads', sort: '-lastMessageAt', limit: 100, depth: 0, overrideAccess: true })
  if (threads.length === 0) return []
  const ids = threads.map((t) => (typeof t.customer === 'object' ? t.customer.id : t.customer))
  const { docs: users } = await payload.find({
    collection: 'users',
    where: { id: { in: ids } },
    limit: ids.length,
    depth: 0,
    select: { name: true, email: true },
    overrideAccess: true,
  })
  const byId = new Map(users.map((u) => [u.id, u]))
  const lasts = await Promise.all(
    threads.map((t) => payload.find({ collection: 'chat-messages', where: { thread: { equals: t.id } }, sort: '-id', limit: 1, depth: 0, overrideAccess: true })),
  )
  return threads.map((t, i) => {
    const u = byId.get(ids[i] as number)
    const last = lasts[i]?.docs[0]
    const text = last ? (last.translationStatus === 'ok' && last.translatedLang === 'KO' && last.translatedBody ? last.translatedBody : last.body) : null
    return {
      ...threadView(t),
      customerName: (u?.name as string | undefined) ?? null,
      customerEmail: (u?.email as string | undefined) ?? null,
      preview: text ? text.slice(0, 80) : null,
    }
  })
}

export async function countUnreadThreads(payload: Payload): Promise<number> {
  const { totalDocs } = await payload.count({ collection: 'chat-threads', where: { unreadForAdmin: { greater_than: 0 } }, overrideAccess: true })
  return totalDocs
}

/** 요청 본문 JSON. 깨졌으면 undefined */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return undefined
  }
}
