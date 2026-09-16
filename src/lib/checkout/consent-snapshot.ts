import type { ConsentDef } from './consents'

/**
 * 주문에 남기는 동의 스냅샷(2026-09-17, Q53).
 *
 * 계약서 본문은 이미 주문에 통째로 저장한다(orders.contractText). 동의 항목은 그렇지 않아서,
 * 관리자가 나중에 문구를 고치면 「고객이 무엇에 동의했는지」를 되짚을 근거가 사라진다.
 * 그래서 화면에 보여 준 문구 그대로, 체크 결과와 함께 주문에 붙여 둔다.
 *
 * 정의에 없는 키는 버린다 — 클라이언트가 보낸 맵은 임의의 키를 담을 수 있다.
 */
export type ConsentSnapshotRow = { key: string; label: string; required: boolean; agreed: boolean }

export function consentSnapshot(defs: readonly ConsentDef[], checked: Record<string, boolean>): ConsentSnapshotRow[] {
  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    required: d.required,
    agreed: checked[d.key] === true,
  }))
}
