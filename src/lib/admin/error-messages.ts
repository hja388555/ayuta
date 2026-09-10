/**
 * 관리자 API가 돌려주는 에러 코드를 사람이 읽는 문구로 바꾼다.
 *
 * 라우트들은 의도적으로 내부 사정(스택·SQL·zod 필드명)을 감추고 짧은 코드만 낸다.
 * 그 코드를 화면에 그대로 뿌리면 운영자는 무엇을 해야 할지 모른다 — 번역은 여기
 * 한 곳에서만 한다. 모르는 코드는 코드를 노출하지 않고 일반 문구로 떨어뜨린다.
 */
const MESSAGES: Record<string, string> = {
  unauthenticated: '로그인이 풀렸습니다. 다시 로그인해 주세요.',
  forbidden: '이 작업을 할 권한이 없습니다.',
  invalid_input: '입력값이 올바르지 않습니다. 다시 확인해 주세요.',
  invalid_transition: '지금 상태에서는 그 상태로 바꿀 수 없습니다. 화면을 새로고침해 주세요.',
  transition_failed: '상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.',
  invalid_schedule: '날짜가 올바르지 않습니다. 종료일이 시작일보다 빠르지 않은지 확인해 주세요.',
  schedule_failed: '계약기간을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  note_failed: '메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  empty_note: '메모 내용을 입력해 주세요.',
  price_failed: '단가를 저장하지 못했습니다. 금액은 0 이상의 정수여야 합니다.',
  invalid_multiplier: '기간 배수는 0보다 크고 100 이하인 숫자, 소수 둘째 자리까지 입력해 주세요.',
  settings_failed: '기간 배수를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  network: '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.',
  login_failed: '이메일 또는 비밀번호가 맞지 않거나, 관리자 계정이 아닙니다. 5회 틀리면 10분간 잠깁니다.',
}

export const GENERIC_ERROR = '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'

export function adminErrorMessage(code: unknown): string {
  if (typeof code !== 'string') return GENERIC_ERROR
  return MESSAGES[code] ?? GENERIC_ERROR
}
