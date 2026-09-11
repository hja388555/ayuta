/** 저장된 값과 입력칸이 다른가(저장 확인 팝업 227:168) — 앞뒤 공백만 다른 것은 바뀐 것으로 치지 않는다 */
export function isProfileDirty<T extends Record<string, string>>(saved: T, current: T): boolean {
  return Object.keys(saved).some((k) => (saved[k] ?? '').trim() !== (current[k] ?? '').trim())
}
