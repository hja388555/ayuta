import { notFound } from 'next/navigation'
import { AuthError, requireAdmin } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import { authedPayload } from '@/lib/admin/orders-data'
import s from '@/components/admin/admin-v2.module.css'

/**
 * 광고 서비스 관리(Figma [v3] 13-A 423:2 / 429:2). 셸은 (gated)/layout 이 그린다 — 여기는 본문만.
 *
 * 조회는 관리자 전부, 편집·추가는 최고관리자만(저장 API 가 최종 판정한다).
 * 서비스 정의(번호·이름·계산 방식·계약서 방식·순서·공개)는 ad-services 가 정본이다.
 */
const MODEL_LABELS: Record<string, string> = {
  tier: '등급 선택',
  sum: '항목 합산',
  sumMultiplier: '항목 합산 + 기간',
  videoPairs: '종류 × 길이',
  inquiry: '문의형',
}

const CONTRACT_LABELS: Record<string, string> = {
  fixed: '고정 계약서',
  perQuote: '견적 발행 때 작성',
}

export default async function ServicesPage() {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }
  const canEdit = isSuperRole(user.role)

  const { payload, user: payloadUser } = await authedPayload()
  const { docs } = await payload.find({
    collection: 'ad-services',
    sort: 'sortOrder',
    limit: 100,
    depth: 0,
    user: payloadUser,
    overrideAccess: false,
  })

  // 묶음 수는 서비스마다 한 줄에 같이 보여 준다 — 항목까지 세면 화면이 느려져 여기서는 묶음만
  const groups = await payload.find({
    collection: 'ad-service-groups',
    where: { active: { equals: true } },
    limit: 500,
    depth: 0,
    user: payloadUser,
    overrideAccess: false,
  })
  const groupCount = new Map<number, number>()
  for (const g of groups.docs) {
    const serviceId = typeof g.service === 'object' && g.service ? (g.service as { id: number }).id : (g.service as number)
    groupCount.set(serviceId, (groupCount.get(serviceId) ?? 0) + 1)
  }

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1 className={s.title}>광고 서비스 관리</h1>
        <span className={s.superOnly}>최고관리자 전용</span>
      </div>
      <p className={s.lead}>
        메인 화면과 주문 화면에 나오는 광고 서비스입니다. 공개를 끄면 메인과 주문 주소에서 숨겨지고, 이미 받은 주문은 그대로 남습니다.
        {canEdit ? null : ' (중간관리자는 조회만 할 수 있습니다)'}
      </p>

      {docs.length === 0 ? (
        <p className={s.note}>등록된 서비스가 없습니다.</p>
      ) : (
        <section className={s.card}>
          {docs.map((d) => (
            <div key={d.id as number} className={`${s.listRow} ${s.listRowLine}`}>
              <div className={s.listMain}>
                <strong>
                  {String(d.no)}. {d.nameKo as string}
                </strong>
                <p className={s.hint}>
                  {MODEL_LABELS[d.model as string] ?? (d.model as string)} · {CONTRACT_LABELS[d.contractMode as string] ?? (d.contractMode as string)} ·
                  묶음 {groupCount.get(d.id as number) ?? 0}개 · 순서 {String(d.sortOrder)} · /order/{d.slug as string}
                </p>
              </div>
              <span className={s.pillGray}>{d.active ? '공개' : '비공개'}</span>
            </div>
          ))}
        </section>
      )}

      <p className={s.note}>
        항목과 금액은 단가 관리 화면에서 고칩니다. 서비스 추가와 묶음 편집은 다음 단계에서 열립니다.
      </p>
    </div>
  )
}
