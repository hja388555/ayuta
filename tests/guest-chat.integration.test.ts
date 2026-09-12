// 비회원 1:1 채팅(2026-09-12 "비회원도 채팅 가능")을 실제 서버·DB 앞에서 고정한다:
// 시작 폼 검증·동의, 쿠키로만 내 방, 채팅 링크 복원, 생성 제한, 관리자 "채팅 열기"·링크 재발급, 회원 채팅 유지, 진입점.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
// localApi 를 먼저 — .env 를 읽기 전에 payload config 를 가져오면 "missing secret key"
import { localPayload } from './helpers/localApi.js'
import { api, login } from './helpers/server.js'

const RUN = Date.now()
const PW = 'Ayuta!Test-2026'
const base = { name: '비회원채팅테스트', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }
const userIds: number[] = []
const inquiryIds: number[] = []
const tokens: Record<'member' | 'manager', string> = { member: '', manager: '' }
const auth = (who: keyof typeof tokens) => ({ Authorization: `JWT ${tokens[who]}` })
// 테스트마다 다른 IP 로 보여 서로의 생성 제한에 걸리지 않게 한다
let ipSeq = 0
const freshIp = () => `10.${(RUN % 200) + 1}.${Math.floor(RUN / 1000) % 250}.${++ipSeq}`
const guestEmail = (n: string) => `guest-${n}+${RUN}@ayuta.test`

const cookieFrom = (res: Response): string | null => {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith('ayuta_chat_guest='))
  return raw ? raw.split(';')[0]! : null
}

async function startGuest(n: string, ip = freshIp(), locale: 'ko' | 'ja' = 'ko') {
  const res = await api('/api/chat/guest', {
    method: 'POST',
    headers: { 'x-real-ip': ip },
    body: JSON.stringify({ name: `손님${n}`, email: guestEmail(n), phone: '010-1234-5678', consent: true, locale }),
  })
  return { res, cookie: cookieFrom(res) }
}

beforeAll(async () => {
  const payload = await localPayload()
  for (const [name, role] of [
    ['member', 'customer'],
    ['manager', 'manager'],
  ] as const) {
    const email = `guestchat-${name}+${RUN}@ayuta.test`
    const u = await payload.create({ collection: 'users', data: { email, password: PW, ...base, role }, overrideAccess: true, context: { allowRoleAssignment: true } })
    userIds.push(u.id as number)
    tokens[name] = (await login(email, PW)).token ?? ''
  }
})

afterAll(async () => {
  const payload = await localPayload()
  const pool = payload.db.pool
  const threads = `SELECT id FROM chat_threads WHERE customer_id = ANY($1) OR inquiry_id = ANY($2) OR guest_email LIKE $3`
  const args = [userIds, inquiryIds, `%+${RUN}@ayuta.test`]
  await pool.query(`DELETE FROM chat_messages WHERE thread_id IN (${threads})`, args)
  await pool.query(`DELETE FROM chat_threads WHERE id IN (${threads})`, args)
  for (const id of inquiryIds) await pool.query('DELETE FROM inquiries WHERE id = $1', [id])
  for (const id of userIds) await pool.query('DELETE FROM users WHERE id = $1', [id])
})

describe('비회원 채팅 시작', () => {
  it('동의가 없거나 형식이 틀리면 400, 쿠키도 없다', async () => {
    const good = { name: '손님', email: guestEmail('v'), phone: '010-1234-5678', consent: true, locale: 'ko' }
    const noConsent = await api('/api/chat/guest', { method: 'POST', headers: { 'x-real-ip': freshIp() }, body: JSON.stringify({ ...good, consent: false }) })
    expect(noConsent.status).toBe(400)
    expect((await noConsent.json()).error).toBe('consent_required')
    expect(cookieFrom(noConsent)).toBeNull()
    for (const bad of [{ ...good, email: 'x' }, { ...good, phone: '1' }, { ...good, name: '' }, { ...good, locale: 'en' }]) {
      const res = await api('/api/chat/guest', { method: 'POST', headers: { 'x-real-ip': freshIp() }, body: JSON.stringify(bad) })
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('invalid_input')
    }
  })

  it('정상 입력이면 방이 생기고 httpOnly·SameSite=Lax 쿠키가 온다. DB 에는 해시만', async () => {
    const { res, cookie } = await startGuest('a', freshIp(), 'ja')
    expect(res.status).toBe(200)
    const raw = res.headers.getSetCookie().find((c) => c.startsWith('ayuta_chat_guest='))!
    expect(raw).toMatch(/HttpOnly/i)
    expect(raw).toMatch(/SameSite=Lax/i)
    expect(cookie).toMatch(/^ayuta_chat_guest=[A-Za-z0-9_-]{43}$/)
    const { thread } = await res.json()
    expect(thread.locale).toBe('ja')
    const payload = await localPayload()
    const doc = await payload.findByID({ collection: 'chat-threads', id: thread.id, overrideAccess: true })
    expect(doc.customer ?? null).toBeNull()
    expect(doc.guestTokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(doc.guestTokenHash).not.toContain(cookie!.split('=')[1])
    expect(doc.guestPrivacyConsentAt).toBeTruthy()
  })

  it('비회원이 /ko/chat 에 오면 로그인으로 보내지 않고 시작 폼을 보인다', async () => {
    const res = await api('/ko/chat', { redirect: 'manual' })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/id="guest-chat-title"[^>]*>로그인 없이 채팅 시작하기</)
    expect(html).toContain(`href="/ko/login?next=${encodeURIComponent('/ko/chat')}"`)
    const ja = await (await api('/ja/chat')).text()
    expect(ja).toMatch(/id="guest-chat-title"[^>]*>ログインせずにチャットを始める</)
  })
})

describe('비회원 대화', () => {
  let cookieA = ''
  let cookieB = ''
  let threadA = 0

  beforeAll(async () => {
    cookieA = (await startGuest('room-a')).cookie!
    cookieB = (await startGuest('room-b')).cookie!
  })

  it('쿠키로 내 방을 열고 메시지를 보내고 읽는다', async () => {
    const opened = await api('/api/chat/thread?locale=ja', { headers: { Cookie: cookieA } })
    expect(opened.status).toBe(200)
    const data = await opened.json()
    threadA = data.thread.id
    expect(data.thread.locale).toBe('ko') // 방 언어는 만들 때 정해진다
    const sent = await api('/api/chat/messages', { method: 'POST', headers: { Cookie: cookieA }, body: JSON.stringify({ body: `비회원 문의 ${RUN}` }) })
    expect(sent.status).toBe(200)
    const { message } = await sent.json()
    expect(message.sender).toBe('customer')
    expect(message.senderEmail).toBeUndefined()
    const list = await (await api('/api/chat/messages', { headers: { Cookie: cookieA } })).json()
    expect(list.messages.map((m: { id: number }) => m.id)).toContain(message.id)
    expect((await api('/api/chat/read', { method: 'POST', headers: { Cookie: cookieA } })).status).toBe(200)

    const payload = await localPayload()
    const saved = await payload.findByID({ collection: 'chat-messages', id: message.id, overrideAccess: true })
    expect(saved.senderUser ?? null).toBeNull()
    expect(saved.senderEmail).toBe(guestEmail('room-a'))
  })

  it('쿠키가 있는 채로 페이지를 열면 시작 폼이 아니라 대화방', async () => {
    // 문구는 번역 메시지 묶음으로 모든 HTML 에 실린다 — 폼이 실제로 그려졌는지는 요소 id 로 본다
    const html = await (await api('/ko/chat', { headers: { Cookie: cookieA } })).text()
    expect(html).not.toContain('id="guest-chat-title"')
    expect(html).toContain('/ui/chat-upload.svg')
  })

  it('다른 쿠키로는 남의 방이 보이지 않고, 모양만 맞는 가짜 쿠키는 401', async () => {
    const other = await (await api('/api/chat/thread', { headers: { Cookie: cookieB } })).json()
    expect(other.thread.id).not.toBe(threadA)
    expect(other.messages).toEqual([])
    const fake = `ayuta_chat_guest=${'A'.repeat(43)}`
    expect((await api('/api/chat/messages', { headers: { Cookie: fake } })).status).toBe(401)
    expect((await api('/api/chat/messages', { method: 'POST', headers: { Cookie: fake }, body: JSON.stringify({ body: 'x' }) })).status).toBe(401)
    expect((await api(`/api/admin/chat/threads/${threadA}/messages`, { headers: { Cookie: cookieA } })).status).toBe(401)
  })

  it('비회원도 1분 20개 한도에 걸린다', async () => {
    const { cookie } = await startGuest('rate')
    const statuses: number[] = []
    for (let i = 0; i < 21; i++) statuses.push((await api('/api/chat/messages', { method: 'POST', headers: { Cookie: cookie! }, body: JSON.stringify({ body: `m${i}` }) })).status)
    expect(statuses.slice(0, 20).every((st) => st === 200)).toBe(true)
    expect(statuses[20]).toBe(429)
  }, 30_000)

  it('이미 쿠키가 있으면 다시 시작해도 같은 방', async () => {
    const res = await api('/api/chat/guest', {
      method: 'POST',
      headers: { Cookie: cookieA, 'x-real-ip': freshIp() },
      body: JSON.stringify({ name: '다시', email: guestEmail('again'), phone: '010-1111-2222', consent: true, locale: 'ko' }),
    })
    expect((await res.json()).thread.id).toBe(threadA)
  })

  it('DELETE /api/chat/guest 는 요청한 브라우저의 쿠키만 만료시키고, 방·다른 쿠키는 그대로', async () => {
    const { cookie } = await startGuest('leave')
    const res = await api('/api/chat/guest', { method: 'DELETE', headers: { Cookie: cookie! } })
    expect(res.status).toBe(200)
    const set = res.headers.getSetCookie().find((c) => c.startsWith('ayuta_chat_guest='))!
    expect(set.split(';')[0]).toBe('ayuta_chat_guest=')
    expect(set).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i)
    // 쿠키 없이 들어오면 시작 폼, 다른 손님의 쿠키는 여전히 된다
    expect(await (await api('/ko/chat')).text()).toContain('id="guest-chat-title"')
    expect((await api('/api/chat/messages', { headers: { Cookie: cookieA } })).status).toBe(200)
    // 쿠키가 없어도 실패하지 않는다(로그아웃에서 무조건 부른다)
    expect((await api('/api/chat/guest', { method: 'DELETE' })).status).toBe(200)
  })

  it('채팅 화면에서는 하단 문의 박스를 그리지 않는다', async () => {
    const html = await (await api('/ko/chat', { headers: { Cookie: cookieA } })).text()
    expect(html).not.toContain('class="contact-box"')
  })
})

describe('생성 제한', () => {
  it('같은 IP 에서 한 시간에 5개까지, 6번째는 429', async () => {
    const ip = freshIp()
    for (let i = 0; i < 5; i++) expect((await startGuest(`limit-${i}`, ip)).res.status).toBe(200)
    const sixth = await startGuest('limit-5', ip)
    expect(sixth.res.status).toBe(429)
    expect((await sixth.res.json()).error).toBe('too_many_threads')
    expect(sixth.cookie).toBeNull()
    // 다른 IP 는 영향 없음
    expect((await startGuest('limit-other')).res.status).toBe(200)
  })
})

describe('관리자 채팅 열기 · 링크', () => {
  let guestInquiryThread = 0

  const createInquiry = async (n: string, customer: number | null) => {
    const payload = await localPayload()
    const doc = await payload.create({
      collection: 'inquiries',
      data: { body: '지하철 광고 문의', name: `문의자${n}`, phone: '090-1234-5678', email: guestEmail(`inq-${n}`), locale: 'ja', customer, status: 'new' },
      overrideAccess: true,
    })
    inquiryIds.push(doc.id as number)
    return doc.id as number
  }

  it('관리자가 아니면 못 연다, 잘못된 입력은 400', async () => {
    expect((await api('/api/admin/chat/open', { method: 'POST', body: JSON.stringify({ inquiryId: 1 }) })).status).toBe(401)
    expect((await api('/api/admin/chat/open', { method: 'POST', headers: auth('member'), body: JSON.stringify({ inquiryId: 1 }) })).status).toBe(403)
    expect((await api('/api/admin/chat/open', { method: 'POST', headers: auth('manager'), body: JSON.stringify({ inquiryId: 'x' }) })).status).toBe(400)
    expect((await api('/api/admin/chat/open', { method: 'POST', headers: auth('manager'), body: JSON.stringify({ inquiryId: 999999999 }) })).status).toBe(404)
    expect((await api('/api/admin/chat/open', { method: 'POST', headers: auth('manager'), body: JSON.stringify({ orderId: 999999999 }) })).status).toBe(404)
  })

  it('회원 문의는 그 회원의 방을 연다(없으면 만들고, 회원이 열어도 같은 방)', async () => {
    const inquiryId = await createInquiry('member', userIds[0]!)
    const res = await api('/api/admin/chat/open', { method: 'POST', headers: auth('manager'), body: JSON.stringify({ inquiryId }) })
    expect(res.status).toBe(200)
    const { threadId } = await res.json()
    const own = await (await api('/api/chat/thread', { headers: auth('member') })).json()
    expect(own.thread.id).toBe(threadId)
    expect(own.thread.locale).toBe('ja')
    const head = await (await api(`/api/admin/chat/threads/${threadId}/messages`, { headers: auth('manager') })).json()
    expect(head.thread).toMatchObject({ guest: false, customerName: base.name })
    // 회원 방은 링크를 발급하지 않는다
    expect((await api(`/api/admin/chat/threads/${threadId}/link`, { method: 'POST', headers: auth('manager') })).status).toBe(400)
  })

  it('비회원 문의는 문의 하나당 비회원 방 하나(이름·이메일·연락처는 문의에서)', async () => {
    const inquiryId = await createInquiry('guest', null)
    const first = await (await api('/api/admin/chat/open', { method: 'POST', headers: auth('manager'), body: JSON.stringify({ inquiryId }) })).json()
    const second = await (await api('/api/admin/chat/open', { method: 'POST', headers: auth('manager'), body: JSON.stringify({ inquiryId }) })).json()
    expect(second.threadId).toBe(first.threadId)
    guestInquiryThread = first.threadId
    const head = await (await api(`/api/admin/chat/threads/${guestInquiryThread}/messages`, { headers: auth('manager') })).json()
    expect(head.thread).toMatchObject({ guest: true, customerName: '문의자guest', customerEmail: guestEmail('inq-guest'), customerPhone: '090-1234-5678', inquiryId, locale: 'ja' })
    // 관리자 화면에서 ?thread= 로 바로 열 수 있다
    const page = await api(`/manage/inquiries?tab=chat&thread=${guestInquiryThread}`, { headers: auth('manager') })
    expect(page.status).toBe(200)
  })

  it('채팅 링크가 다른 기기에서 접속을 복원하고, 재발급하면 이전 링크·쿠키는 끊긴다', async () => {
    const issue = async () => {
      const res = await api(`/api/admin/chat/threads/${guestInquiryThread}/link`, { method: 'POST', headers: auth('manager') })
      expect(res.status).toBe(200)
      return (await res.json()) as { path: string; url: string }
    }
    const first = await issue()
    expect(first.path).toMatch(/^\/ja\/chat\/g\/[A-Za-z0-9_-]{43}$/)
    expect(first.url.endsWith(first.path)).toBe(true)

    const opened = await api(first.path, { redirect: 'manual' })
    expect([302, 303, 307]).toContain(opened.status)
    expect(new URL(opened.headers.get('location')!, 'http://x').pathname).toBe('/ja/chat')
    expect(opened.headers.get('location')).not.toContain(first.path.split('/').pop())
    const cookie = cookieFrom(opened)!
    expect(cookie).toBeTruthy()

    // 관리자가 보낸 메시지를 링크로 들어온 고객이 읽는다
    await api(`/api/admin/chat/threads/${guestInquiryThread}/messages`, { method: 'POST', headers: auth('manager'), body: JSON.stringify({ body: '채팅으로 안내드립니다.' }) })
    const read = await (await api('/api/chat/thread', { headers: { Cookie: cookie } })).json()
    expect(read.thread.id).toBe(guestInquiryThread)
    expect(read.messages.some((m: { sender: string }) => m.sender === 'admin')).toBe(true)

    const second = await issue()
    expect(second.path).not.toBe(first.path)
    // 이전 쿠키·이전 링크는 더 이상 안 된다
    expect((await api('/api/chat/messages', { headers: { Cookie: cookie } })).status).toBe(401)
    const stale = await api(first.path, { redirect: 'manual' })
    expect(stale.headers.get('location')).toContain('/ja/chat?link=invalid')
    expect(cookieFrom(stale)).toBeNull()
    // 새 링크는 된다
    const fresh = cookieFrom(await api(second.path, { redirect: 'manual' }))!
    expect((await api('/api/chat/messages', { headers: { Cookie: fresh } })).status).toBe(200)
  })

  it('방이 종료돼도 링크 쿠키로 읽을 수 있고, 고객이 쓰면 다시 열린다', async () => {
    const { path } = await (await api(`/api/admin/chat/threads/${guestInquiryThread}/link`, { method: 'POST', headers: auth('manager') })).json()
    const cookie = cookieFrom(await api(path, { redirect: 'manual' }))!
    await api(`/api/admin/chat/threads/${guestInquiryThread}/status`, { method: 'POST', headers: auth('manager'), body: JSON.stringify({ status: 'closed' }) })
    const closed = await (await api('/api/chat/messages', { headers: { Cookie: cookie } })).json()
    expect(closed.status).toBe('closed')
    await api('/api/chat/messages', { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify({ body: '추가 질문' }) })
    expect((await (await api('/api/chat/messages', { headers: { Cookie: cookie } })).json()).status).toBe('open')
  })
})

describe('회원 채팅 · 진입점', () => {
  it('회원은 비회원 쿠키가 있어도 자기 방(회원 우선), 비회원 시작 API 는 409', async () => {
    const { cookie } = await startGuest('with-member')
    const own = await (await api('/api/chat/thread', { headers: { ...auth('member'), Cookie: cookie! } })).json()
    const payload = await localPayload()
    const t = await payload.findByID({ collection: 'chat-threads', id: own.thread.id, overrideAccess: true })
    expect(typeof t.customer === 'object' ? t.customer?.id : t.customer).toBe(userIds[0])
    const res = await api('/api/chat/guest', {
      method: 'POST',
      headers: { ...auth('member'), 'x-real-ip': freshIp() },
      body: JSON.stringify({ name: '회원', email: guestEmail('m'), phone: '010-1234-5678', consent: true, locale: 'ko' }),
    })
    expect(res.status).toBe(409)
  })

  it('주인 없는 방은 저장되지 않는다', async () => {
    const payload = await localPayload()
    await expect(payload.create({ collection: 'chat-threads', data: { locale: 'ko', status: 'open', unreadForAdmin: 0, unreadForCustomer: 0 }, overrideAccess: true })).rejects.toThrow()
  })

  it('비회원 헤더·탭바·문의 박스의 채팅 버튼이 /chat 을 바로 가리킨다(로그인 팝업 없음)', async () => {
    for (const locale of ['ko', 'ja'] as const) {
      const html = await (await api(`/${locale}`)).text()
      const nav = html.slice(html.indexOf('class="site-nav"'), html.indexOf('</nav>', html.indexOf('class="site-nav"')))
      expect(nav).toContain(`href="/${locale}/chat"`)
      const tabbar = html.slice(html.indexOf('class="tabbar"'))
      expect(tabbar).toContain(`href="/${locale}/chat"`)
      const box = html.slice(html.indexOf('class="contact-box"'))
      expect(box).toContain(`href="/${locale}/chat"`)
    }
  })
})
