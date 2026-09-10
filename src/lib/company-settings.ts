import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { companyFromSettings, contractFieldsOf, type CompanyInfo, type CompanySettingsRow } from './company'

/**
 * 관리자 설정(company-settings)에서 회사 정보를 읽는다. 캐시하지 않는다 — 설정을 바꾸면 다음
 * 요청의 계약서·견적서·푸터부터 바로 반영돼야 한다(단가·배수와 같은 판단).
 */
async function loadRow(): Promise<CompanySettingsRow & { sealImage?: unknown }> {
  const payload = await getPayload({ config })
  return (await payload.findGlobal({ slug: 'company-settings', depth: 0, overrideAccess: true })) as CompanySettingsRow & { sealImage?: unknown }
}

export async function loadCompany(locale: 'ko' | 'ja'): Promise<CompanyInfo> {
  return companyFromSettings(await loadRow(), locale)
}

export async function loadCompanyContractFields(locale: 'ko' | 'ja') {
  return contractFieldsOf(await loadCompany(locale))
}

/** 사업자정보 푸터 값. 담당자·통신판매업 신고번호는 비어 있으면 null — 푸터에서 뺀다 */
export async function loadFooterInfo(locale: 'ko' | 'ja') {
  const row = await loadRow()
  const c = companyFromSettings(row, locale)
  const opt = (v: string | null | undefined) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return { ...c, contactPhone: opt(row.contactPhone), mailOrderNo: opt(row.mailOrderNo) }
}
