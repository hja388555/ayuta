import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { TOLERANCE_SECONDS, verifyWebhook } from './verify-webhook'

const SECRET = 'whsec_dGVzdHNlY3JldA=='
const NOW = new Date('2026-09-18T03:00:00Z')
const TS = String(Math.floor(NOW.getTime() / 1000))
const BODY = '{"type":"Transaction.Paid","data":{"paymentId":"pay_1"}}'
const ID = 'msg_1'

function sign(id: string, ts: string, body: string, secret = SECRET): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const mac = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')
  return `v1,${mac}`
}

const headers = (over: Partial<Record<'id' | 'timestamp' | 'signature', string>> = {}) => ({
  id: ID,
  timestamp: TS,
  signature: sign(ID, TS, BODY),
  ...over,
})

describe('웹훅 서명 검증', () => {
  it('올바른 서명을 통과시킨다', () => {
    const res = verifyWebhook(BODY, headers(), SECRET, NOW)
    expect(res).toEqual({ ok: true, id: ID })
  })

  it('본문이 한 글자라도 다르면 거부한다', () => {
    const res = verifyWebhook(BODY + ' ', headers(), SECRET, NOW)
    expect(res.ok).toBe(false)
  })

  it('다른 시크릿으로 만든 서명을 거부한다', () => {
    const bad = sign(ID, TS, BODY, 'whsec_b3RoZXI=')
    const res = verifyWebhook(BODY, headers({ signature: bad }), SECRET, NOW)
    expect(res.ok).toBe(false)
  })

  it('5분을 넘게 지난 요청을 거부한다', () => {
    const old = new Date(NOW.getTime() + (TOLERANCE_SECONDS + 1) * 1000)
    const res = verifyWebhook(BODY, headers(), SECRET, old)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('시각')
  })

  it('5분을 넘게 앞선 요청도 거부한다', () => {
    const future = new Date(NOW.getTime() - (TOLERANCE_SECONDS + 1) * 1000)
    expect(verifyWebhook(BODY, headers(), SECRET, future).ok).toBe(false)
  })

  it('헤더가 없으면 거부한다', () => {
    expect(verifyWebhook(BODY, { id: null, timestamp: TS, signature: sign(ID, TS, BODY) }, SECRET, NOW).ok).toBe(false)
    expect(verifyWebhook(BODY, { id: ID, timestamp: null, signature: sign(ID, TS, BODY) }, SECRET, NOW).ok).toBe(false)
    expect(verifyWebhook(BODY, { id: ID, timestamp: TS, signature: null }, SECRET, NOW).ok).toBe(false)
  })

  it('서명 목록에 하나라도 맞으면 통과한다 (키 교체 중)', () => {
    const multi = `v1,AAAA ${sign(ID, TS, BODY)}`
    expect(verifyWebhook(BODY, headers({ signature: multi }), SECRET, NOW).ok).toBe(true)
  })
})
