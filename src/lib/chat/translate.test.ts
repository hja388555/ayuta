import { describe, expect, it, vi } from 'vitest'
import { deeplEndpoint, translate } from './translate'

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('deeplEndpoint', () => {
  it('무료 키(:fx)는 api-free, 그 밖은 api', () => {
    expect(deeplEndpoint('abc:fx')).toBe('https://api-free.deepl.com/v2/translate')
    expect(deeplEndpoint('abc')).toBe('https://api.deepl.com/v2/translate')
  })
})

describe('translate', () => {
  it('키가 없으면 네트워크를 타지 않고 skipped', async () => {
    const fetchImpl = vi.fn()
    const r = await translate('こんにちは', 'KO', { apiKey: '', fetchImpl })
    expect(r).toMatchObject({ status: 'skipped', text: null })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('번역 결과와 감지 언어를 돌려주고, 키는 헤더로만 보낸다', async () => {
    const fetchImpl = vi.fn(async () => ok({ translations: [{ detected_source_language: 'JA', text: '안녕하세요' }] }))
    const r = await translate('こんにちは', 'KO', { apiKey: 'k:fx', fetchImpl })
    expect(r).toEqual({ status: 'ok', text: '안녕하세요', sourceLang: 'JA', targetLang: 'KO' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api-free.deepl.com/v2/translate')
    expect((init.headers as Record<string, string>).Authorization).toBe('DeepL-Auth-Key k:fx')
    expect(JSON.parse(init.body as string)).toEqual({ text: ['こんにちは'], target_lang: 'KO' })
  })

  it('원문이 이미 목표 언어면 skipped', async () => {
    const fetchImpl = vi.fn(async () => ok({ translations: [{ detected_source_language: 'KO', text: '안녕' }] }))
    const r = await translate('안녕', 'KO', { apiKey: 'k', fetchImpl })
    expect(r).toMatchObject({ status: 'skipped', text: null, sourceLang: 'KO' })
  })

  it('HTTP 오류·예외·이상한 응답은 failed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const opts = { apiKey: 'secret-key-123' }
    const body = '비밀-본문-메시지'
    expect((await translate(body, 'JA', { ...opts, fetchImpl: vi.fn(async () => new Response('', { status: 456 })) })).status).toBe('failed')
    expect((await translate(body, 'JA', { ...opts, fetchImpl: vi.fn(async () => Promise.reject(new Error(body))) })).status).toBe('failed')
    expect((await translate(body, 'JA', { ...opts, fetchImpl: vi.fn(async () => ok({})) })).status).toBe('failed')
    // 본문·키가 로그에 새지 않는다
    expect(warn).toHaveBeenCalled()
    for (const call of warn.mock.calls) {
      expect(call.join(' ')).not.toContain('secret-key-123')
      expect(call.join(' ')).not.toContain(body)
    }
    warn.mockRestore()
  })

  it('시간 초과는 failed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'TimeoutError')))),
    ) as unknown as typeof fetch
    const r = await translate('x', 'JA', { apiKey: 'k', fetchImpl, timeoutMs: 20 })
    expect(r.status).toBe('failed')
  })
})
