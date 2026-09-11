import { NextResponse } from 'next/server'
import { AuthError, requireAdmin } from '@/lib/dal'
import { buildOrderWhere, parseOrderListParams } from '@/lib/admin/order-list-query'
import { findOrdersForExport } from '@/lib/admin/orders-data'
import { buildOrdersCsv } from '@/lib/admin/orders-csv'

/**
 * 주문 목록 CSV 내보내기(Figma [v2] A3 "내보내기").
 *
 * 게이트는 목록 화면·다른 관리자 API 와 같은 requireAdmin() — 이 경로가 목록 화면의 뒷문이
 * 되면 안 된다. 조회도 목록과 같은 findOrders* 통로(overrideAccess: false)를 탄다.
 * 필터는 목록 쿼리스트링을 그대로 받는다(status·q·period). 표에 보이는 열만 싣는다.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === 'UNAUTHENTICATED' ? 401 : 403
      const error = err.code === 'UNAUTHENTICATED' ? 'unauthenticated' : 'forbidden'
      return NextResponse.json({ error }, { status })
    }
    throw err
  }

  const url = new URL(req.url)
  const params = parseOrderListParams(Object.fromEntries(url.searchParams.entries()))
  const orders = await findOrdersForExport(buildOrderWhere(params))
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  return new Response(buildOrdersCsv(orders), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ayuta-orders-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
