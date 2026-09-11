import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendMail } from './send'

const input = { to: 'a@b.test', subject: 's', html: '<p>h</p>', text: 't' }

describe('sendMail', () => {
  const env = { ...process.env }
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    process.env = { ...env }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('키나 발신 주소가 없으면 보내지 않는다', async () => {
    delete process.env.RESEND_API_KEY
    process.env.MAIL_FROM = 'AYUTA <no-reply@x.test>'
    expect(await sendMail(input)).toEqual({ sent: false, reason: 'not_configured' })
    process.env.RESEND_API_KEY = 're_x'
    delete process.env.MAIL_FROM
    expect(await sendMail(input)).toEqual({ sent: false, reason: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('설정돼 있으면 Resend 로 보낸다', async () => {
    process.env.RESEND_API_KEY = 're_secret'
    process.env.MAIL_FROM = 'AYUTA <no-reply@x.test>'
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'm1' }), { status: 200 }))
    expect(await sendMail(input)).toEqual({ sent: true, id: 'm1' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer re_secret')
    expect(JSON.parse(init.body)).toMatchObject({ from: 'AYUTA <no-reply@x.test>', to: ['a@b.test'] })
  })

  it('실패·예외는 failed 로 삼키고 키를 로그에 남기지 않는다', async () => {
    process.env.RESEND_API_KEY = 're_secret'
    process.env.MAIL_FROM = 'AYUTA <no-reply@x.test>'
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }))
    expect(await sendMail(input)).toEqual({ sent: false, reason: 'failed' })
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    expect(await sendMail(input)).toEqual({ sent: false, reason: 'failed' })
    const logged = JSON.stringify((console.warn as unknown as { mock: { calls: unknown[] } }).mock.calls)
    expect(logged).not.toContain('re_secret')
  })
})
