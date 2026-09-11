import { describe, expect, it } from 'vitest'
import { poolConfig } from './db-pool'

const PEM = '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----'

describe('poolConfig', () => {
  it('인증서가 없으면 연결 문자열을 그대로 쓰고 ssl 을 붙이지 않는다', () => {
    expect(poolConfig('postgres://u:p@localhost:5432/db?sslmode=disable')).toEqual({ connectionString: 'postgres://u:p@localhost:5432/db?sslmode=disable', max: 10 })
  })

  it('인증서가 있으면 검증을 켜고 연결 문자열의 sslmode 를 지운다', () => {
    const c = poolConfig('postgres://u:p@db.example.co:5432/postgres?sslmode=require&application_name=ayuta', PEM)
    expect(c.ssl).toEqual({ ca: PEM, rejectUnauthorized: true })
    expect(c.connectionString).not.toContain('sslmode')
    expect(c.connectionString).toContain('application_name=ayuta')
  })

  it('한 줄로 들어온 PEM(\\n 글자)을 줄바꿈으로 되돌린다', () => {
    expect(poolConfig('postgres://h/db', PEM.replace(/\n/g, '\\n')).ssl?.ca).toBe(PEM)
  })

  it('공백뿐인 인증서 값은 없는 것으로 본다', () => {
    expect(poolConfig('postgres://h/db', '   ').ssl).toBeUndefined()
  })
})
