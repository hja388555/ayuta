import { NextResponse } from 'next/server'
import { mapZipcloud, normalizeJpZip } from '@/lib/address'

/**
 * 일본 우편번호 → 주소(zipcloud 프록시). 받는 값은 zipcode 하나뿐이고, 7자리로 정규화한 값만
 * 바깥으로 보낸다 — 다른 쿼리 값은 넘기지 않는다. 우편번호→주소는 거의 안 바뀌므로 하루 캐시.
 */
const UPSTREAM = 'https://zipcloud.ibsnet.co.jp/api/search'
const CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'

export async function GET(req: Request): Promise<Response> {
  const zip = normalizeJpZip(new URL(req.url).searchParams.get('zipcode') ?? '')
  if (!zip) return NextResponse.json({ error: 'invalid_zip' }, { status: 400 })

  try {
    const res = await fetch(`${UPSTREAM}?zipcode=${zip}`, { signal: AbortSignal.timeout(5000), next: { revalidate: 86400 } })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const results = mapZipcloud(await res.json())
    return NextResponse.json({ results }, { headers: { 'Cache-Control': CACHE } })
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 })
  }
}
