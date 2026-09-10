// 홈 화면 설치(큐 Q29)의 서버 쪽 조건을 고정한다: manifest 와 아이콘 세트가 실제로 나가고,
// 페이지 head 가 manifest·아이콘·테마 색을 가리키는지. 설치 배너가 뜨는지는 브라우저가 판단하므로
// 여기서는 그 판단의 재료(설치 가능 조건)를 확인한다.
import { describe, expect, it } from 'vitest'
import { api } from './helpers/server.js'

describe('/manifest.webmanifest', () => {
  it('설치에 필요한 항목이 모두 있다', async () => {
    const res = await api('/manifest.webmanifest')
    expect(res.status).toBe(200)
    const m = await res.json()
    expect(m.name).toContain('아유타')
    expect(m.short_name).toBeTruthy()
    expect(m.start_url).toBe('/ko')
    expect(m.display).toBe('standalone')
    expect(m.theme_color).toMatch(/^#[0-9A-F]{6}$/i)
    const sizes = (m.icons as Array<{ sizes: string; purpose?: string }>).map((i) => `${i.sizes}:${i.purpose ?? 'any'}`)
    expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']))
  })
})

describe('아이콘 파일', () => {
  for (const path of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/apple-icon.png', '/icon.png']) {
    it(`${path} 는 PNG 로 나간다`, async () => {
      const res = await api(path)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('image/png')
      const buf = new Uint8Array(await res.arrayBuffer())
      expect([...buf.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    })
  }
})

describe('페이지 head', () => {
  it('manifest·apple-touch-icon·파비콘·테마 색을 가리킨다', async () => {
    const html = await (await api('/ko')).text()
    const head = html.match(/<head>[\s\S]*?<\/head>/)?.[0] ?? html
    expect(head).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest"/)
    expect(head).toMatch(/<link rel="apple-touch-icon" href="\/apple-icon\.png/)
    expect(head).toMatch(/<link rel="icon" href="\/icon\.png/)
    expect(head).toMatch(/<meta name="theme-color" content="#[0-9A-Fa-f]{6}"/)
  })
})
