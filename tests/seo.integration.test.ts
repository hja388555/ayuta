// 검색 노출 설정(큐 Q27)을 실제 서버 앞에서 고정한다:
// ko/ja 가 hreflang 으로 서로를 가리키고, canonical 이 자기 자신이며, sitemap 에 alternates 가 들어가는지.
import { describe, expect, it } from 'vitest'
import { api } from './helpers/server.js'

const headOf = async (path: string) => {
  const html = await (await api(path)).text()
  return html.match(/<head>[\s\S]*?<\/head>/)?.[0] ?? html
}
const linkHref = (head: string, rel: string, hreflang?: string) => {
  const re = hreflang
    ? new RegExp(`<link[^>]*rel="${rel}"[^>]*hrefLang="${hreflang}"[^>]*href="([^"]+)"|<link[^>]*rel="${rel}"[^>]*href="([^"]+)"[^>]*hrefLang="${hreflang}"`, 'i')
    : new RegExp(`<link[^>]*rel="${rel}"[^>]*href="([^"]+)"`, 'i')
  const m = head.match(re)
  return m?.[1] ?? m?.[2] ?? null
}

describe('canonical · hreflang', () => {
  for (const [path, self] of [
    ['/ko', '/ko'],
    ['/ja', '/ja'],
    ['/ko/order/transit', '/ko/order/transit'],
    ['/ja/order/press-blog', '/ja/order/press-blog'],
  ] as const) {
    it(`${path} — canonical 은 자기 자신, ko·ja·x-default 가 서로를 가리킨다`, async () => {
      const head = await headOf(path)
      expect(linkHref(head, 'canonical')).toMatch(new RegExp(`${self}$`))
      const rest = self.replace(/^\/(ko|ja)/, '')
      expect(linkHref(head, 'alternate', 'ko')).toMatch(new RegExp(`/ko${rest}$`))
      expect(linkHref(head, 'alternate', 'ja')).toMatch(new RegExp(`/ja${rest}$`))
      expect(linkHref(head, 'alternate', 'x-default')).toMatch(new RegExp(`/ko${rest}$`))
    })
  }

  it('절대 주소로 나간다(metadataBase)', async () => {
    expect(linkHref(await headOf('/ko'), 'canonical')).toMatch(/^https?:\/\//)
  })

  it('로케일별 제목·설명이 있다', async () => {
    expect(await headOf('/ko')).toMatch(/<title>[^<]*아유타[^<]*<\/title>/)
    expect(await headOf('/ja')).toMatch(/<title>[^<]*アユタ[^<]*<\/title>/)
    expect(await headOf('/ko')).toMatch(/<meta name="description" content="[^"]+"/)
  })
})

describe('검색 제외 화면', () => {
  for (const path of ['/ko/login', '/ko/signup']) {
    it(`${path} 는 noindex 다`, async () => {
      expect(await headOf(path)).toMatch(/<meta name="robots" content="noindex, ?nofollow"/)
    })
  }
})

describe('/sitemap.xml', () => {
  it('공개 페이지를 ko·ja 로 담고, 항목마다 다른 언어 주소(alternates)를 단다', async () => {
    const res = await api('/sitemap.xml')
    expect(res.status).toBe(200)
    const xml = await res.text()
    expect(xml).toMatch(/<loc>[^<]*\/ko<\/loc>/)
    expect(xml).toMatch(/<loc>[^<]*\/ja\/order\/transit<\/loc>/)
    expect(xml).toMatch(/<xhtml:link rel="alternate" hreflang="ja" href="[^"]*\/ja\/order\/transit"/)
    // 개인 화면·관리자는 넣지 않는다
    expect(xml).not.toMatch(/mypage|login|manage|quote|checkout/)
  })
})

describe('/robots.txt', () => {
  it('관리자·API·개인 화면을 막고 sitemap 위치를 알린다', async () => {
    const res = await api('/robots.txt')
    expect(res.status).toBe(200)
    const txt = await res.text()
    for (const p of ['/manage', '/api/', '/*/mypage', '/*/login', '/*/quote/', '/*/order/*/checkout']) expect(txt).toContain(`Disallow: ${p}`)
    expect(txt).toMatch(/Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/)
  })
})
