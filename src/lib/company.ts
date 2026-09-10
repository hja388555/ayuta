// 을(아유타) 회사 정보.
//
// 전화번호가 계약서 원문마다 02-3393-8838/02-3394-8838로 따로 박혀 있다가 어긋난 적이
// 있다(2번 계약서 원문 오타) — 여러 곳에 값을 복사해 두면 한 곳만 고치고 나머지가 오타로
// 남는 사고가 반복된다. 계약서 본문은 {{companyName}} 등 플레이스홀더만 두고, 실제 값은
// 관리자 설정(company-settings global, 큐 Q25)에서 읽는다. 아래 상수는 그 설정의 기본값이다.
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

/** 설정 행 → 로케일별 회사 정보. 비어 있는 칸은 기본값으로 채운다(설정이 반쯤 비어도 계약서에 빈칸이 생기지 않게) */
export type CompanySettingsRow = Partial<{
  nameKo: string | null
  nameJa: string | null
  ceo: string | null
  businessNo: string | null
  addressKo: string | null
  addressJa: string | null
  phone: string | null
  email: string | null
  contactPhone: string | null
  mailOrderNo: string | null
}>

export function companyFromSettings(row: CompanySettingsRow | null | undefined, locale: 'ko' | 'ja'): CompanyInfo {
  const d = locale === 'ja' ? COMPANY_JA : COMPANY_KO
  const pick = (v: string | null | undefined, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback)
  return {
    name: pick(locale === 'ja' ? row?.nameJa : row?.nameKo, d.name),
    ceo: pick(row?.ceo, d.ceo),
    businessNo: pick(row?.businessNo, d.businessNo),
    address: pick(locale === 'ja' ? row?.addressJa : row?.addressKo, d.address),
    phone: pick(row?.phone, d.phone),
    email: pick(row?.email, d.email),
  }
}

/** fillContract 에 그대로 넘길 수 있는 모양으로 바꾼다 */
export function contractFieldsOf(c: CompanyInfo) {
  return {
    companyName: c.name,
    companyCeo: c.ceo,
    companyRegNo: c.businessNo,
    companyAddress: c.address,
    companyPhone: c.phone,
    companyEmail: c.email,
  }
}
