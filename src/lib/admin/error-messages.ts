/**
 * 관리자 API가 돌려주는 에러 코드를 사람이 읽는 문구로 바꾼다.
 *
 * 라우트들은 의도적으로 내부 사정(스택·SQL·zod 필드명)을 감추고 짧은 코드만 낸다.
 * 그 코드를 화면에 그대로 뿌리면 운영자는 무엇을 해야 할지 모른다 — 번역은 여기
 * 한 곳에서만 한다. 모르는 코드는 코드를 노출하지 않고 일반 문구로 떨어뜨린다.
 */
const MESSAGES: Record<string, string> = {
  unauthenticated: '로그인이 풀렸습니다. 다시 로그인해 주세요.',
  wrong_password: '현재 비밀번호가 맞지 않습니다. 5회 틀리면 10분간 잠깁니다.',
  weak_password: '새 비밀번호는 영문 · 숫자 · 기호를 섞어 10자 이상이어야 합니다.',
  forbidden: '이 작업을 할 권한이 없습니다.',
  invalid_input: '입력값이 올바르지 않습니다. 다시 확인해 주세요.',
  invalid_transition: '지금 상태에서는 그 상태로 바꿀 수 없습니다. 화면을 새로고침해 주세요.',
  transition_failed: '상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.',
  invalid_schedule: '날짜가 올바르지 않습니다. 종료일이 시작일보다 빠르지 않은지 확인해 주세요.',
  schedule_failed: '계약기간을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  note_failed: '메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  empty_note: '메모 내용을 입력해 주세요.',
  price_failed: '단가를 저장하지 못했습니다. 금액은 0 이상의 정수여야 합니다.',
  price_too_large: '최대 10억까지 입력할 수 있습니다.',
  ad_date_outside_period: '광고 진행일은 계약기간 안이어야 합니다.',
  invalid_multiplier: '기간 배수는 0보다 크고 100 이하인 숫자, 소수 둘째 자리까지 입력해 주세요.',
  settings_failed: '기간 배수를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  network: '서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.',
  invalid_quote_lines: '견적 항목을 확인해 주세요. 항목명·수량(1~999)·금액(0~10억 정수)을 모두 넣고, 합계가 0원보다 커야 합니다.',
  quote_too_large: '견적 금액이 너무 큽니다. 수량은 1~999, 금액은 0~10억, 합계는 100억 이하여야 합니다.',
  quote_failed: '견적을 처리하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.',
  invalid_image: '투명 배경 PNG 파일만 올릴 수 있습니다(2MB 이하). 흰 배경 이미지나 JPG 는 받지 않습니다.',
  invalid_band_image: 'JPG · PNG · WEBP 이미지만 올릴 수 있습니다. 파일이 손상되지 않았는지 확인해 주세요.',
  band_image_too_large: '이미지는 5MB 이하만 올릴 수 있습니다.',
  band_image_failed: '이미지를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  band_image_not_found: '이미 삭제되었거나 없는 이미지입니다. 화면을 새로고침해 주세요.',
  account_failed: '계정을 처리하지 못했습니다. 이미 있는 이메일이 아닌지 확인해 주세요.',
  already_admin: '이미 관리자 계정인 이메일입니다. 권한은 목록에서 바꿔 주세요.',
  invite_failed: '초대를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.',
  cannot_change_self: '자기 자신의 권한은 바꿀 수 없습니다.',
  last_super: '마지막 최고관리자의 권한은 내릴 수 없습니다. 다른 최고관리자를 먼저 만들어 주세요.',
  password_too_short: '관리자 비밀번호는 10자 이상이어야 합니다.',
  unknown_placeholder: '계약서에 채울 수 없는 빈칸({{...}})이 있습니다. 오타가 없는지 확인해 주세요. 그대로 저장하면 해당 상품 주문이 막힙니다.',
  consent_keys_mismatch: '동의 항목 구성이 바뀌었습니다. 화면을 새로고침한 뒤 문구만 고쳐 주세요.',
  legal_failed: '문서를 저장하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.',
  contract_exists: '그사이 같은 계약서가 이미 만들어졌습니다. 화면을 새로고침한 뒤 그 문서를 고쳐 주세요.',
  login_failed: '이메일 또는 비밀번호가 맞지 않거나, 관리자 계정이 아닙니다. 5회 틀리면 10분간 잠깁니다.',
}

export const GENERIC_ERROR = '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'

export function adminErrorMessage(code: unknown): string {
  if (typeof code !== 'string') return GENERIC_ERROR
  return MESSAGES[code] ?? GENERIC_ERROR
}
