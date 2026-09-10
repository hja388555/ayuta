import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { AuthError, requireAdmin } from '@/lib/dal'

/** 견적 회수. 링크가 즉시 무효가 된다(요구사항 1-12 [견적 회수]) */
const BodySchema = z.object({ quoteId: z.number().int().positive() })

export async function POST(req: Request): Promise<Response> {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === 'UNAUTHENTICATED' ? 401 : 403
      return NextResponse.json({ error: status === 401 ? 'unauthenticated' : 'forbidden' }, { status })
    }
    throw err
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }
  const body = BodySchema.safeParse(raw)
  if (!body.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  const payload = await getPayload({ config })
  // 발행 상태인 것만 회수한다 — 조건부 UPDATE 로 이미 회수된 견적을 다시 건드리지 않는다
  const res = await payload.db.pool.query(
    `UPDATE quotes SET status = 'revoked', revoked_at = now(), updated_at = now() WHERE id = $1 AND status = 'issued' RETURNING id`,
    [body.data.quoteId],
  )
  if ((res.rowCount ?? 0) === 0) return NextResponse.json({ error: 'quote_failed' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
