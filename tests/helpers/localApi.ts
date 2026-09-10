// Payload Local API로 DB에 직접 접근하는 헬퍼.
// beforeValidate 훅의 req.context.allowRoleAssignment 탈출구는 HTTP로는 절대
// 재현할 수 없으므로, 그 탈출구 자체를 양방향으로 pin하려면 Local API가 필요하다.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Payload } from 'payload'
import { getPayload } from 'payload'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// payload.config.ts는 import 시점에 process.env.DATABASE_URI / PAYLOAD_SECRET을
// 읽어 postgresAdapter를 만든다. vitest는 .env를 자동으로 읽지 않으므로,
// config를 import하기 전에 직접 파싱해서 process.env에 채워 넣는다.
// (payload run이 seed 스크립트에서 이 값들을 채워주는 것과 동일한 역할을 여기서 대신한다)
const loadDotEnv = () => {
  const envPath = path.resolve(dirname, '../../.env')
  let raw: string
  try {
    raw = readFileSync(envPath, 'utf-8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env) && value) process.env[key] = value
  }
}

loadDotEnv()

let cached: Promise<Payload> | null = null

export const localPayload = async (): Promise<Payload> => {
  if (!cached) {
    const { default: config } = await import('../../src/payload.config.js')
    cached = getPayload({ config })
  }
  return cached
}
