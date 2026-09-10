// 을(아유타) 회사 정보의 단일 출처.
//
// 전화번호가 계약서 원문마다 02-3393-8838/02-3394-8838로 따로 박혀 있다가 어긋난 적이
// 있다(2번 계약서 원문 오타) — 여러 곳에 값을 복사해 두면 한 곳만 고치고 나머지가 오타로
// 남는 사고가 반복된다. 계약서 본문은 {{companyName}} 등 플레이스홀더만 두고, 실제 값은
// 이 파일과 scripts/seed-contracts.ts(치환 시점)가 함께 본다.
//
// 관리자 설정 화면(Q25 "약관/계약서 편집")이 생기면 이 상수 대신 DB에서 읽어오는 걸로
// 바뀐다. 그 전까지는 대표전화 하나 바뀌어도 코드 배포가 필요하다.
export type CompanyInfo = {
  name: string
  ceo: string
  businessNo: string
  address: string
  phone: string
  email: string
}

export const COMPANY_KO: CompanyInfo = {
  name: 'AYUTA(아유타)',
  ceo: '황지원',
  businessNo: '259-23-02007',
  address: '서울특별시 동대문구 답십리동 323',
  phone: '02-3394-8838',
  email: 'gggwon@gmail.com',
}

export const COMPANY_JA: CompanyInfo = {
  name: 'AYUTA(アユタ)',
  ceo: '황지원',
  businessNo: '259-23-02007',
  address: 'ソウル特別市東大門区踏十里洞323',
  phone: '02-3394-8838',
  email: 'gggwon@gmail.com',
}

export function companyFor(locale: 'ko' | 'ja'): CompanyInfo {
  return locale === 'ja' ? COMPANY_JA : COMPANY_KO
}

/** fillContract 에 그대로 넘길 수 있는 모양으로 바꾼다 */
export function companyContractFields(locale: 'ko' | 'ja'): {
  companyName: string
  companyCeo: string
  companyRegNo: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
} {
  const c = companyFor(locale)
  return {
    companyName: c.name,
    companyCeo: c.ceo,
    companyRegNo: c.businessNo,
    companyAddress: c.address,
    companyPhone: c.phone,
    companyEmail: c.email,
  }
}
