type Info = { businessNo: string; phone: string; ceo: string; contactPhone: string | null; address: string; mailOrderNo: string | null; name: string }
type Labels = { businessNo: string; phone: string; ceo: string; contact: string; mailOrder: string }

/**
 * 사업자정보 푸터(요구사항 "사업자정보 푸터" 2026-09-08 재확정) — 전 페이지 하단, 아주 작은 글씨로
 * 가로 한 줄. 좁은 화면에서는 줄바꿈된다. 통신판매업 신고번호는 전자상거래법 제10조 표시 의무 항목.
 * 담당자 연락처·신고번호가 아직 없으면 자리표시(0000)를 찍지 않고 그 칸을 뺀다.
 * 값은 관리자 설정(company-settings)에서 온다.
 */
export function SiteFooter({ info, labels }: { info: Info; labels: Labels }) {
  const parts = [
    `${labels.businessNo} ${info.businessNo}`,
    `${labels.phone} ${info.phone}`,
    `${labels.ceo} ${info.ceo}`,
    info.contactPhone ? `${labels.contact} ${info.contactPhone}` : null,
    info.address,
    info.mailOrderNo ? `${labels.mailOrder} ${info.mailOrderNo}` : null,
  ].filter(Boolean) as string[]
  return (
    <footer data-site-footer="" style={{ borderTop: '1px solid var(--ink-100, #ECEEF1)', marginTop: 48 }}>
      <p style={{ margin: 0, padding: '12px var(--side)', fontSize: 9, lineHeight: 1.6, color: 'var(--ink-500, #767B85)' }}>
        {info.name} | {parts.join(' | ')}
      </p>
    </footer>
  )
}
