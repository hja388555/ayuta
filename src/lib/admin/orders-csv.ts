import type { Order } from '../../payload-types'
import { formatAmount, formatDateTime } from './format'
import { categoryLabel } from './order-display'
import { statusLabel } from '../orders/transitions'

/** 엑셀이 UTF-8 로 열게 하는 BOM */
export const CSV_BOM = '\uFEFF'

export const ORDER_CSV_HEADER = ['주문번호', '주문일', '고객', '서비스', '금액', '상태'] as const

/**
 * 셀 하나를 CSV 로 옮긴다.
 * =,+,-,@ (그리고 탭·CR)로 시작하는 값은 스프레드시트가 수식으로 실행한다(CSV injection) —
 * 주문자명은 고객이 쓴 값이므로 앞에 ' 를 붙여 글자로 고정한다. 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다.
 */
export function csvCell(value: string): string {
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

type CsvOrder = Pick<Order, 'orderNumber' | 'createdAt' | 'orderer' | 'category' | 'amount' | 'currency' | 'status'>

/** 화면 표에 보이는 열만 내보낸다 — 연락처·이메일·주소·계약서는 싣지 않는다 */
export function buildOrdersCsv(orders: CsvOrder[]): string {
  const rows = [
    ORDER_CSV_HEADER as readonly string[],
    ...orders.map((o) => [
      o.orderNumber,
      formatDateTime(o.createdAt),
      o.orderer?.name ?? '',
      categoryLabel(o.category),
      formatAmount(o.amount, o.currency),
      statusLabel(o.status),
    ]),
  ]
  return CSV_BOM + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
