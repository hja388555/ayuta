// 1:1 채팅(큐 Q37) API 를 실제 서버·DB 앞에서 고정한다: 비회원 차단, 본인 방만, 관리자만 관리자 경로,
// 번역 키가 없으면 네트워크 없이 skipped 로 저장, REST 는 전부 닫힘.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '채팅테스트', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const tokens: Record<'a' | 'b' | 'manager', string | undefined> = { a: undefined, b: undefined, manager: undefined }
const userIds: number[] = []
const auth = (who: keyof typeof tokens) => ({ Authorization: `JWT ${tokens[who]}` })

beforeAll(async () => {
  const payload = await localPayload()
  for (const [name, role] of [
    ['a', 'customer'],
    ['b', 'customer'],
    ['manager', 'manager'],
  ] as const) {
    const email = `chat-${name}+${RUN}@ayuta.test`
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    userIds.push(u.id as number)
    tokens[name] = (await login(email, PW)).token
  }
})

afterAll(async () => {
  const payload = await localPayload()
  await payload.db.pool.query('DELETE FROM chat_messages WHERE thread_id IN (SELECT id FROM chat_threads WHERE customer_id = ANY($1))', [userIds])
  await payload.db.pool.query('DELETE FROM chat_threads WHERE customer_id = ANY($1)', [userIds])
  for (const id of userIds) await payload.db.pool.query('DELETE FROM users WHERE id = $1', [id])
})

describe('1:1 채팅', () => {
  let threadId = 0
  let firstMessageId = 0

  it('비회원은 401', async () => {
    expect((await api('/api/chat/thread')).status).toBe(401)
    expect((await api('/api/chat/messages', { method: 'POST', body: JSON.stringify({ body: 'hi' }) })).status).toBe(401)
    expect((await api('/api/admin/chat/threads')).status).toBe(401)
  })

  it('고객이 방을 만들고 메시지를 보낸다', async () => {
    const res = await api('/api/chat/thread?locale=ja', { headers: auth('a') })
    expect(res.status).toBe(200)
    const data = await res.json()
    threadId = data.thread.id
    expect(data.thread.locale).toBe('ja')
    expect(data.messages).toEqual([])

    // 같은 고객이 다시 열면 같은 방
    const again = await (await api('/api/chat/thread?locale=ko', { headers: auth('a') })).json()
    expect(again.thread.id).toBe(threadId)

    const sent = await api('/api/chat/messages', { method: 'POST', headers: auth('a'), body: JSON.stringify({ body: `  東京の地下鉄広告 ${RUN} ` }) })
    expect(sent.status).toBe(200)
    const { message } = await sent.json()
    firstMessageId = message.id
    expect(message.body).toBe(`東京の地下鉄広告 ${RUN}`)
    expect(message.senderEmail).toBeUndefined()
    if (!process.env.DEEPL_API_KEY) expect(message.translationStatus).toBe('skipped')
    else expect(['ok', 'failed', 'skipped']).toContain(message.translationStatus)
  })

  it('잘못된 입력은 400', async () => {
    for (const body of [{ body: '' }, { body: 'x'.repeat(2001) }, { body: 'hi', thread: 1 }, { body: '   ' }]) {
      expect((await api('/api/chat/messages', { method: 'POST', headers: auth('a'), body: JSON.stringify(body) })).status).toBe(400)
    }
  })

  it('다른 고객은 남의 방을 읽지 못한다', async () => {
    // B 는 아직 방이 없다 — 남의 방이 보이지 않고 404
    expect((await api('/api/chat/messages', { headers: auth('b') })).status).toBe(404)
    expect((await api(`/api/admin/chat/threads/${threadId}/messages`, { headers: auth('b') })).status).toBe(403)
    // B 가 자기 방을 열어도 A 의 메시지는 없다
    const own = await (await api('/api/chat/thread', { headers: auth('b') })).json()
    expect(own.thread.id).not.toBe(threadId)
    expect(own.messages).toEqual([])
  })

  it('REST 로는 채팅 컬렉션을 못 읽는다', async () => {
    for (const who of ['a', 'manager'] as const) {
      const res = await api('/api/chat-messages', { headers: auth(who) })
      expect([401, 403]).toContain(res.status)
    }
  })

  it('관리자가 목록을 보고 답장하고, 고객은 폴링으로 받는다', async () => {
    const list = await (await api('/api/admin/chat/threads', { headers: auth('manager') })).json()
    const item = list.threads.find((t: { id: number }) => t.id === threadId)
    expect(item).toMatchObject({ unreadForAdmin: 1, customerName: base.name, locale: 'ja' })

    const reply = await api(`/api/admin/chat/threads/${threadId}/messages`, { method: 'POST', headers: auth('manager'), body: JSON.stringify({ body: '안녕하세요. 견적 안내드립니다.' }) })
    expect(reply.status).toBe(200)
    const { message } = await reply.json()
    expect(message.sender).toBe('admin')
    if (!process.env.DEEPL_API_KEY) expect(message.translationStatus).toBe('skipped')

    const polled = await (await api(`/api/chat/messages?after=${firstMessageId}`, { headers: auth('a') })).json()
    expect(polled.messages.map((m: { id: number }) => m.id)).toEqual([message.id])
    expect(polled.messages[0].senderEmail).toBeUndefined()

    expect((await api(`/api/admin/chat/threads/${threadId}/read`, { method: 'POST', headers: auth('manager') })).status).toBe(200)
    expect((await api('/api/chat/read', { method: 'POST', headers: auth('a') })).status).toBe(200)
    const payload = await localPayload()
    const t = await payload.findByID({ collection: 'chat-threads', id: threadId, overrideAccess: true })
    expect([t.unreadForAdmin, t.unreadForCustomer]).toEqual([0, 0])
  })

  it('관리자가 방을 닫고, 고객이 다시 쓰면 열린다', async () => {
    const closed = await api(`/api/admin/chat/threads/${threadId}/status`, { method: 'POST', headers: auth('manager'), body: JSON.stringify({ status: 'closed' }) })
    expect(closed.status).toBe(200)
    expect((await api(`/api/admin/chat/threads/${threadId}/status`, { method: 'POST', headers: auth('manager'), body: JSON.stringify({ status: 'deleted' }) })).status).toBe(400)
    await api('/api/chat/messages', { method: 'POST', headers: auth('a'), body: JSON.stringify({ body: '추가 문의' }) })
    const polled = await (await api('/api/chat/messages', { headers: auth('a') })).json()
    expect(polled.status).toBe('open')
    expect((await api('/api/admin/chat/threads/999999999/messages', { headers: auth('manager') })).status).toBe(404)
  })
})
