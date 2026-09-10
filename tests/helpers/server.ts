// 실행 중인 Next.js 서버에 요청을 보내는 최소 헬퍼.
// 단위 테스트가 아니라 통합 테스트이므로 실제 HTTP 왕복을 그대로 쓴다.
export const BASE = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3210'

export const api = (path: string, init?: RequestInit) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })

export const login = async (email: string, password: string) => {
  const res = await api('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json()
  return { status: res.status, token: body.token as string | undefined, body }
}
