import type { ZodError } from 'zod'

/**
 * zod 검증 실패에서 "어느 칸이 틀렸는지"만 뽑는다(첫 번째 이슈의 경로, 예: 'email' · 'consents.0.label').
 * 메시지·스키마 내부는 싣지 않는다 — 화면은 이 이름으로 칸 라벨을 찾아 보여준다.
 * 경로가 없는 이슈(모르는 키가 섞인 strict 위반 등)는 빈 객체다.
 */
export function issueField(error: ZodError): { field?: string } {
  const path = error.issues[0]?.path ?? []
  return path.length > 0 ? { field: path.join('.') } : {}
}
