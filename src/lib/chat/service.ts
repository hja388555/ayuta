import 'server-only'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { AuthError, getSessionUser, requireAdmin, requireUser, type SessionUser } from '@/lib/dal'
import type { ChatMessage, ChatThread } from '@/payload-types'
import { generateGuestToken, GUEST_COOKIE, hashGuestToken, isGuestTokenShape } from './guest'
import { cleanBody, fallbackTarget, isRateLimited, rateWindowStart, targetLang, toChatLocale, type ChatLocale } from './rules'
import { translate } from './translate'

/**
 * 1:1 채팅 서버 로직(큐 Q37). 컬렉션 REST 는 닫혀 있고 여기 함수들만 Local API 로 읽고 쓴다.
 * 고객 경로는 "세션 사용자 = 방 주인"으로만 방을 찾는다 — 방 id 를 받지 않으니 남의 방을 지목할 길이 없다.
 */

export const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status })

/** 비회원 토큰으로 방을 찾는다. 모양이 틀리거나 해시가 없으면 null(링크를 새로 발급하면 이전 토큰은 여기서 끊긴다) */
export async function findGuestThreadByToken(payload: Payload, token: unknown): Promise<ChatThread | null> {
  if (!isGuestTokenShape(token)) return null
  const { docs } = await payload.find({ collection: 'chat-threads', where: { guestTokenHash: { equals: hashGuestToken(token) } }, limit: 1, depth: 0, overrideAccess: true })
  return docs[0] ?? null
}

export async function guestThreadFromCookie(payload: Payload): Promise<ChatThread | null> {
  return findGuestThreadByToken(payload, (await cookies()).get(GUEST_COOKIE)?.value)
}

/** 보낸 사람 기록. 회원·관리자는 계정, 비회원은 방의 이메일만 */
export type Sender = { userId: number | null; email: string | null }

export type CustomerGate =
  | { payload: Payload; kind: 'member'; user: SessionUser; sender: Sender }
  | { payload: Payload; kind: 'guest'; thread: ChatThread; sender: Sender }

/**
 * 고객 경로의 문지기. 로그인했으면 회원(비회원 쿠키가 같이 있어도 회원이 우선), 아니면 비회원 쿠키의 방.
 * 둘 다 아니면 401. 어느 쪽도 방 id 를 받지 않는다 — 남의 방을 지목할 길이 없다.
 */
export async function customerGate(): Promise<CustomerGate | { response: Response }> {
  const payload = await getPayload({ config })
  const user = await getSessionUser()
  if (user) return { payload, kind: 'member', user, sender: { userId: user.id, email: user.email } }
  const thread = await guestThreadFromCookie(payload)
  if (thread) return { payload, kind: 'guest', thread, sender: { userId: null, email: thread.guestEmail ?? null } }
  return { response: jsonError('unauthenticated', 401) }
}

/** 고객 경로의 방: 회원은 내 방(없으면 null), 비회원은 쿠키의 방 */
export const customerThread = (g: CustomerGate): Promise<ChatThread | null> =>
  g.kind === 'guest' ? Promise.resolve(g.thread) : findOwnThread(g.payload, g.user.id)

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

export async function sendMessage(payload: Payload, thread: ChatThread, sender: 'customer' | 'admin', who: Sender, rawBody: string): Promise<SendResult> {
  const body = cleanBody(rawBody)
  if (!body) return { error: 'invalid_input', status: 400 }

  // 회원·관리자는 계정 기준, 비회원은 방 기준(방 하나 = 비회원 한 명)으로 같은 한도를 건다
  const since = { createdAt: { greater_than: rateWindowStart().toISOString() } }
  const recent = await payload.count({
    collection: 'chat-messages',
    where:
      who.userId !== null
        ? { and: [{ senderUser: { equals: who.userId } }, since] }
        : { and: [{ thread: { equals: thread.id } }, { sender: { equals: sender } }, since] },
    overrideAccess: true,
  })
  if (isRateLimited(recent.totalDocs)) return { error: 'rate_limited', status: 429 }

  const locale = toChatLocale(thread.locale)
  const target = targetLang(sender, locale)
  let tr = target ? await translate(body, target) : null
  // 원문이 이미 목표 언어면(예: 일본어 방에서 관리자가 일본어로 씀) 반대 언어로 한 번 더 번역한다
  const retry = target && tr?.status === 'skipped' ? fallbackTarget(locale, target, tr.sourceLang) : null
  if (retry) tr = await translate(body, retry)
  const message = await payload.create({
    collection: 'chat-messages',
    data: {
      thread: thread.id,
      sender,
      senderUser: who.userId,
      senderEmail: who.email,
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
  guest: boolean
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  inquiryId: number | null
  preview: string | null
}

const relId = (v: number | { id: number } | null | undefined): number | null => (v == null ? null : typeof v === 'object' ? v.id : v)

/** 관리자 목록·방 머리글: 고객 이름·이메일(비회원은 방에 적힌 값), 마지막 메시지 미리보기(한국어 우선) */
export async function adminThreadItems(payload: Payload, threads: ChatThread[]): Promise<ThreadListItem[]> {
  if (threads.length === 0) return []
  const ids = [...new Set(threads.map((t) => relId(t.customer)).filter((id): id is number => id !== null))]
  const users = ids.length
    ? (await payload.find({ collection: 'users', where: { id: { in: ids } }, limit: ids.length, depth: 0, select: { name: true, email: true, phone: true }, overrideAccess: true })).docs
    : []
  const byId = new Map(users.map((u) => [u.id, u]))
  const lasts = await Promise.all(
    threads.map((t) => payload.find({ collection: 'chat-messages', where: { thread: { equals: t.id } }, sort: '-id', limit: 1, depth: 0, overrideAccess: true })),
  )
  return threads.map((t, i) => {
    const customerId = relId(t.customer)
    const u = customerId !== null ? byId.get(customerId) : undefined
    const last = lasts[i]?.docs[0]
    const text = last ? (last.translationStatus === 'ok' && last.translatedLang === 'KO' && last.translatedBody ? last.translatedBody : last.body) : null
    const guest = customerId === null
    return {
      ...threadView(t),
      guest,
      customerName: guest ? (t.guestName ?? null) : ((u?.name as string | undefined) ?? null),
      customerEmail: guest ? (t.guestEmail ?? null) : ((u?.email as string | undefined) ?? null),
      customerPhone: guest ? (t.guestPhone ?? null) : ((u?.phone as string | undefined) ?? null),
      inquiryId: relId(t.inquiry),
      preview: text ? text.slice(0, 80) : null,
    }
  })
}

/** 관리자 목록: 최근 대화 순 100개 */
export async function listThreadsForAdmin(payload: Payload): Promise<ThreadListItem[]> {
  const { docs: threads } = await payload.find({ collection: 'chat-threads', sort: '-lastMessageAt', limit: 100, depth: 0, overrideAccess: true })
  return adminThreadItems(payload, threads)
}

/** 비회원 방을 만든다. 토큰이 없으면(관리자가 문의에서 연 방) 링크를 발급하기 전까지 고객은 들어올 수 없다 */
export async function createGuestThread(
  payload: Payload,
  data: { name: string; email: string; phone: string; locale: ChatLocale; token?: string; ipHash?: string; consentAt?: string; inquiryId?: number },
): Promise<ChatThread> {
  return payload.create({
    collection: 'chat-threads',
    data: {
      guestName: data.name,
      guestEmail: data.email,
      guestPhone: data.phone,
      guestTokenHash: data.token ? hashGuestToken(data.token) : null,
      guestIpHash: data.ipHash ?? null,
      guestPrivacyConsentAt: data.consentAt ?? null,
      inquiry: data.inquiryId ?? null,
      locale: data.locale,
      status: 'open',
      unreadForAdmin: 0,
      unreadForCustomer: 0,
    },
    overrideAccess: true,
  })
}

/** 비회원 방의 토큰을 새로 만든다. 해시를 바꿔 끼우므로 이전 링크·이전 쿠키는 즉시 끊긴다. 원문은 호출자에게 한 번만 */
export async function rotateGuestToken(payload: Payload, threadId: number): Promise<string> {
  const token = generateGuestToken()
  await payload.update({ collection: 'chat-threads', id: threadId, data: { guestTokenHash: hashGuestToken(token) }, overrideAccess: true })
  return token
}

/**
 * 관리자 "채팅 열기"(문의 카드). 회원 문의면 그 회원의 방(없으면 문의 언어로 만든다),
 * 비회원 문의면 문의 하나당 비회원 방 하나(inquiry unique) — 이름·이메일·연락처는 문의에서 가져온다.
 */
export async function openThreadForInquiry(payload: Payload, inquiryId: number): Promise<ChatThread | null> {
  let inquiry
  try {
    inquiry = await payload.findByID({ collection: 'inquiries', id: inquiryId, depth: 0, overrideAccess: true })
  } catch {
    return null
  }
  const locale = toChatLocale(inquiry.locale)
  const customerId = relId(inquiry.customer as number | { id: number } | null | undefined)
  if (customerId !== null) return getOrCreateOwnThread(payload, customerId, locale)
  const find = async () =>
    (await payload.find({ collection: 'chat-threads', where: { inquiry: { equals: inquiryId } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] ?? null
  const found = await find()
  if (found) return found
  try {
    return await createGuestThread(payload, { name: inquiry.name, email: inquiry.email, phone: inquiry.phone, locale, inquiryId })
  } catch (err) {
    // 두 관리자가 동시에 누르면 inquiry unique 에 걸린다 — 먼저 만들어진 방을 쓴다
    const again = await find()
    if (again) return again
    throw err
  }
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
