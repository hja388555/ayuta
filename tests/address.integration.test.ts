// 일본 주소 프록시(/api/address/jp)의 입력 검증. 잘못된 우편번호는 바깥(zipcloud)에 가지 않고
// 곧바로 400 이어야 한다. 외부 API 가 살아 있어야 하는 테스트는 두지 않는다.
import { describe, expect, it } from 'vitest'
import { api } from './helpers/server.js'

describe('GET /api/address/jp', () => {
  it.each(['', 'abc', '12345', '12345678', '123-45678', '1234567%26callback%3Dx'])('잘못된 우편번호 %j → 400', async (zip) => {
    const res = await api(`/api/address/jp?zipcode=${zip}`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_zip' })
  })

  it('zipcode 가 없으면 400', async () => {
    const res = await api('/api/address/jp')
    expect(res.status).toBe(400)
  })
})
