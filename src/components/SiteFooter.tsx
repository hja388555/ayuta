type Info = { businessNo: string; phone: string; ceo: string; contactPhone: string | null; address: string; mailOrderNo: string | null; name: string }
type Labels = { businessNo: string; phone: string; ceo: string; contact: string; mailOrder: string }

/**
 * 사업자정보 푸터(요구사항 "사업자정보 푸터" 2026-09-08 재확정, Figma [v2] 205:118).
 * 가로 한 줄, 작은 회색 글씨, 항목 사이 " | ". 좁은 화면에서는 줄바꿈된다.
 * 통신판매업 신고번호는 전자상거래법 제10조 표시 의무 항목. 담당자·신고번호가 아직 없으면
 * 자리표시(0000)를 찍지 않고 그 칸을 뺀다. 값은 관리자 설정(company-settings)에서 온다.
 * 약관 링크 줄은 시안에 없지만 가입 동의 대상 문서를 언제든 다시 볼 수 있어야 해서 둔다(Q25 2차).
 */
type LegalLinks = { terms: { href: string; label: string }; privacy: { href: string; label: string } }

export function SiteFooter({ info, labels, legal }: { info: Info; labels: Labels; legal: LegalLinks }) {
  const parts = [
    `${labels.businessNo} ${info.businessNo}`,
    `${labels.phone} ${info.phone}`,
    `${labels.ceo} ${info.ceo}`,
    info.contactPhone ? `${labels.contact} ${info.contactPhone}` : null,
    info.address,
    info.mailOrderNo ? `${labels.mailOrder} ${info.mailOrderNo}` : null,
  ].filter(Boolean) as string[]
  return (
    <footer data-site-footer="" className="site-footer">
      <div className="site-footer-inner">
        <p>
          {info.name} | {parts.join(' | ')}
        </p>
        <p style={{ marginTop: 6 }}>
          <a href={legal.terms.href}>{legal.terms.label}</a>
          {' · '}
          <a href={legal.privacy.href}>
            <strong>{legal.privacy.label}</strong>
          </a>
        </p>
      </div>
    </footer>
  )
}
