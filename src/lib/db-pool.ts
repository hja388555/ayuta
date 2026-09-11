/**
 * Postgres 연결 풀 설정(큐 Q31).
 *
 * 운영(Supabase)은 인증서를 검증해 접속해야 한다 — 검증을 끄면 중간자가 DB 비밀번호와 데이터를
 * 가로챌 수 있다. DATABASE_CA_CERT 에 Supabase 루트 인증서(PEM)를 넣으면 그 인증서로 서버를 검증한다.
 * 비어 있으면 연결 문자열 그대로 쓴다(로컬 docker·CI 는 TLS 없이 붙는다).
 *
 * 인증서를 쓸 때는 연결 문자열의 sslmode 를 지운다. node-postgres 는 연결 문자열에서 읽은
 * ssl 설정이 아래 ssl 객체를 덮어써서, sslmode 가 남아 있으면 우리가 준 CA 가 무시된다.
 * 환경변수 화면에 한 줄로 넣느라 줄바꿈이 \n 글자로 들어온 PEM 도 받아 준다.
 */
export type PoolConfig = {
  connectionString: string
  max: number
  ssl?: { ca: string; rejectUnauthorized: true }
}

export function poolConfig(uri: string, caPem?: string | null, max = 10): PoolConfig {
  const ca = caPem?.trim()
  if (!ca) return { connectionString: uri, max }
  let connectionString = uri
  try {
    const url = new URL(uri)
    url.searchParams.delete('sslmode')
    connectionString = url.toString()
  } catch {
    // 파싱이 안 되는 값은 그대로 둔다 — 드라이버가 접속 단계에서 분명한 오류를 낸다
  }
  return { connectionString, max, ssl: { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true } }
}
