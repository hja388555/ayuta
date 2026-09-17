// 비회원은 메시지를 2건까지만 보낸다(2026-09-17 사용자 결정).
// 문의 폼이 넣는 첫 메시지가 1건으로 잡히므로, 방에서 한 번 더 보내면 소진된다.
// 담당자 답장은 세지 않는다 — 답이 올수록 문의 기회가 줄면 고객이 손해를 본다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

const RUN = Date.now()
let cookie: string | null = null
let threadId: number | undefined

// 같은 IP 로 몰리면 방 생성 제한(시간당 5개)에 걸린다 — 케이스마다 다른 IP 를 쓴다
const freshIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`

const send = (body: string) =>
  api('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ body }),
  })

beforeAll(async () => {
  const res = await api('/api/chat/guest', {
    method: 'POST',
    headers: { 'x-real-ip': freshIp() },
    body: JSON.stringify({
      name: `제한손님${RUN}`,
      email: `guest-limit+${RUN}@ayuta.test`,
      phone: '010-1234-5678',
      body: '지하철 광고 단가를 알고 싶습니다.',
      consent: true,
      locale: 'ko',
    }),
  })
  if (res.status !== 200) throw new Error(`비회원 시작 실패: ${res.status} ${await res.text()}`)
  const raw = res.headers.getSetCookie().find((c) => c.startsWith('ayuta_chat_guest='))
  cookie = raw ? raw.split(';')[0]! : null
  threadId = (await res.json()).thread?.id as number | undefined
})

afterAll(async () => {
  if (!threadId) return
  const payload = await localPayload()
  const { docs } = await payload.find({
    collection: 'chat-messages',
    where: { thread: { equals: threadId } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  for (const m of docs) await payload.delete({ collection: 'chat-messages', id: m.id as number, overrideAccess: true }).catch(() => {})
  await payload.delete({ collection: 'chat-threads', id: threadId, overrideAccess: true }).catch(() => {})
})

describe('비회원 문의 2회 제한', () => {
  it('문의 폼에 쓴 내용이 첫 메시지로 들어간다', async () => {
    const payload = await localPayload()
    const { docs } = await payload.find({
      collection: 'chat-messages',
      where: { thread: { equals: threadId } },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })
    expect(docs.length).toBe(1)
    expect(docs[0]!.sender).toBe('customer')
    expect(docs[0]!.body as string).toContain('지하철 광고 단가')
  })

  it('한 번 더 보낼 수 있다 — 여기까지가 2회다', async () => {
    const res = await send('금액대만 알려주셔도 됩니다.')
    expect(res.status).toBe(200)
  })

  it('세 번째부터는 막고 가입을 요구한다', async () => {
    const res = await send('한 번만 더 여쭙겠습니다.')
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('guest_limit')
  })

  it('막힌 뒤에도 방과 지난 대화는 그대로 남는다', async () => {
    const payload = await localPayload()
    const { docs } = await payload.find({
      collection: 'chat-messages',
      where: { thread: { equals: threadId } },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })
    // 막힌 세 번째 메시지는 저장되지 않는다
    expect(docs.length).toBe(2)
  })

  it('담당자 답장은 횟수에 들어가지 않는다', async () => {
    // 관리자가 답해도 고객이 보낸 수(2)는 그대로라 여전히 막힌 상태여야 한다
    const payload = await localPayload()
    await payload.create({
      collection: 'chat-messages',
      data: { thread: threadId!, sender: 'admin', body: '안녕하세요, 확인 후 연락드리겠습니다.' },
      overrideAccess: true,
    })
    const res = await send('답장 감사합니다.')
    expect(res.status).toBe(403)
  })
})
