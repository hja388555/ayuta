import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AuthError, requireUser } from '@/lib/dal'
import { isAdminRole } from '@/lib/roles'

/**
 * 회원 탈퇴(큐 Q21 · Q20-C).
 *
 * - 진행 중 주문이 있으면 막는다 — 결제·작업·환불이 걸린 상태에서 계정이 사라지면 연락·본인
 *   확인이 끊긴다.
 * - 계정 행을 지우지 않는다(소프트 삭제). orders 가 계정을 참조하고, 전자상거래법 제6조가
 *   계약·결제 기록 5년 보존을 요구한다. 대신 계정의 식별정보(이메일·이름·연락처·주소)는 파기한다.
 *   주문에는 결제 시점 주문자 정보가 값으로 따로 복사돼 있어(orderer 스냅샷) 기록은 남는다.
 * - 이메일을 파기용 주소로 바꾸므로 같은 이메일로 다시 가입할 수 있다.
 * - 관리자 계정은 이 경로로 탈퇴하지 않는다(관리자 권한 정리는 최고관리자가 한다).
 */
export const ACTIVE_ORDER_STATUSES = ['pending', 'paid', 'in_progress', 'fraud_suspected'] as const

export async function POST(): Promise<Response> {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    throw err
  }
  if (isAdminRole(user.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const payload = await getPayload({ config })
  const { totalDocs } = await payload.count({
    collection: 'orders',
    where: { and: [{ customer: { equals: user.id } }, { status: { in: [...ACTIVE_ORDER_STATUSES] } }] },
    overrideAccess: true,
  })
  if (totalDocs > 0) return NextResponse.json({ error: 'has_active_orders' }, { status: 409 })

  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      deletedAt: new Date().toISOString(),
      email: `deleted+${user.id}@deleted.invalid`,
      name: '탈퇴회원',
      phone: '-',
      postalCode: '-',
      address1: '-',
      address2: null,
      businessNo: null,
      // 알 수 없는 비밀번호로 바꿔 둔다 — deletedAt 게이트와 별개로 로그인 자체가 불가능해진다
      password: randomBytes(32).toString('hex'),
    },
    overrideAccess: true,
  })

  const res = NextResponse.json({ ok: true })
  // 세션 쿠키를 지운다(Payload 기본 쿠키 이름)
  res.cookies.set('payload-token', '', { path: '/', maxAge: 0 })
  return res
}
