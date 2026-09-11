import { describe, expect, it } from 'vitest'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

async function go(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(BASE + path, { redirect: 'manual', headers })
  return { status: res.status, location: res.headers.get('location') ? new URL(res.headers.get('location')!, BASE) : null }
}

describe('접속 국가(IP)로 언어 결정', () => {
  it('일본 IP 는 / 에서 /ja 로', async () => {
    const r = await go('/', { 'x-vercel-ip-country': 'JP', 'accept-language': 'ko-KR' })
    expect(r.status).toBe(307)
    expect(r.location?.pathname).toBe('/ja')
  })

  it('한국 IP 는 브라우저가 일본어여도 /ko 로', async () => {
    const r = await go('/', { 'x-vercel-ip-country': 'KR', 'accept-language': 'ja-JP', cookie: 'NEXT_LOCALE=ja' })
    expect(r.status).toBe(307)
    expect(r.location?.pathname).toBe('/ko')
  })

  it('국가 정보가 없으면 /ko 로', async () => {
    const r = await go('/', { 'accept-language': 'ja-JP' })
    expect(r.location?.pathname).toBe('/ko')
  })

  it('프리픽스 없는 하위 경로도 경로·쿼리를 유지한다', async () => {
    const r = await go('/order/transit?country=jp', { 'x-vercel-ip-country': 'JP' })
    expect(r.status).toBe(307)
    expect(r.location?.pathname).toBe('/ja/order/transit')
    expect(r.location?.searchParams.get('country')).toBe('jp')
  })

  it('이미 고른 언어 주소는 IP 와 상관없이 그대로', async () => {
    const r = await go('/ko', { 'x-vercel-ip-country': 'JP' })
    expect(r.status).toBe(200)
  })

  it('관리자 경로는 로케일을 붙이지 않는다', async () => {
    const r = await go('/manage', { 'x-vercel-ip-country': 'JP' })
    expect(r.location?.pathname ?? '').not.toMatch(/^\/(ko|ja)/)
  })
})
