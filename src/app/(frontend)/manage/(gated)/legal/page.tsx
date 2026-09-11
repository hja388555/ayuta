import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { AuthError, requireAdmin } from '@/lib/dal'
import { isSuperRole } from '@/lib/roles'
import s from '@/components/admin/admin-v2.module.css'
import { LegalEditor } from '@/components/admin/LegalEditor'
import { CONTRACT_CATEGORIES, defaultAgreeConsent } from '@/lib/legal/contract-defaults'

/**
 * 계약서·약관 관리(큐 Q25 2차). 계약서 1~5번(한·일)과 이용약관·개인정보처리방침 문구를 고친다.
 * 아직 없는 계약서(5번 기타 광고처럼 고정 원문이 없는 것)는 "아직 없음" 칸으로 보이고, 문구를 넣어 저장하면 만들어지며 결제가 열린다(Q38).
 * 조회는 관리자, 저장은 최고관리자만(API 가 최종 판정). 문서마다 최근 수정 이력 5건을 보여준다.
 * ?doc= 로 한 문서만 펼친다 — 본문이 길어 한 화면에 전부 펼치면 쓰기 어렵다.
 */
export const dynamic = 'force-dynamic'

const DOC_KINDS = [
  { kind: 'terms', name: '이용약관' },
  { kind: 'privacy', name: '개인정보처리방침' },
  { kind: 'refund', name: '환불 및 취소 정책' },
] as const
const LOCALES = ['ko', 'ja'] as const

type Props = { searchParams: Promise<{ doc?: string }> }

export default async function LegalPage({ searchParams }: Props) {
  let user
  try {
    user = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) notFound()
    throw err
  }
  const canEdit = isSuperRole(user.role)
  const { doc: selected } = await searchParams

  const payload = await getPayload({ config })
  const [{ docs: contracts }, { docs: documents }] = await Promise.all([
    payload.find({ collection: 'contract-templates', sort: 'category', limit: 50, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'legal-documents', limit: 20, depth: 0, overrideAccess: true }),
  ])

  const entries = [
    ...contracts
      .slice()
      .sort((a, b) => a.category - b.category || a.locale.localeCompare(b.locale))
      .map((c) => ({
        key: `contract-${c.id}`,
        name: `${c.category}번 계약서 (${c.locale})${c.active ? '' : ' — 내려 둠'}`,
        target: { target: 'contract' as const, id: c.id },
        title: c.title,
        body: c.body,
        consents: ((c.consents ?? []) as Array<{ key: string; label: string; required: boolean }>).map(({ key, label, required }) => ({ key, label, required })),
        revisionWhere: { and: [{ target: { equals: 'contract-templates' } }, { docId: { equals: c.id } }] } as Where | null,
      })),
    ...CONTRACT_CATEGORIES.flatMap((category) =>
      LOCALES.filter((locale) => !contracts.some((c) => c.category === category && c.locale === locale)).map((locale) => ({
        key: `contract-new-${category}-${locale}`,
        name: `${category}번 계약서 (${locale}) — 아직 없음 · 문구를 넣어 저장하면 결제가 열립니다`,
        target: { target: 'contract-new' as const, category, locale },
        title: '',
        body: '',
        consents: [defaultAgreeConsent(locale)] as Array<{ key: string; label: string; required: boolean }> | undefined,
        revisionWhere: null as Where | null,
      })),
    ),
    ...DOC_KINDS.flatMap(({ kind, name }) =>
      LOCALES.map((locale) => {
        const d = documents.find((x) => x.kind === kind && x.locale === locale)
        return {
          key: `${kind}-${locale}`,
          name: `${name} (${locale})${d ? '' : ' — 아직 없음'}`,
          target: { target: 'document' as const, kind, locale },
          title: d?.title ?? name,
          body: d?.body ?? '',
          consents: undefined,
          revisionWhere: (d ? { and: [{ target: { equals: 'legal-documents' } }, { docId: { equals: d.id } }] } : null) as Where | null,
        }
      }),
    ),
  ]
  const current = entries.find((e) => e.key === selected)
  const revisions =
    current?.revisionWhere
      ? (await payload.find({ collection: 'legal-revisions', where: current.revisionWhere, sort: '-at', limit: 5, depth: 0, overrideAccess: true })).docs
      : []

  return (
    <div className={s.page} style={{ maxWidth: 900 }}>
      <div className={s.head}>
        <h1 className={s.title}>계약서 · 약관</h1>
        <Link className={s.editLink} href="/manage/settings">
          설정으로
        </Link>
      </div>
      <p className={s.hint}>
        {canEdit ? '' : '중간관리자는 조회만 할 수 있습니다. '}
        저장하면 다음 주문부터 반영되고, 이미 체결된 계약서는 바뀌지 않습니다. 계약서의 {'{{amount}}'} 같은 빈칸은 주문 정보로 자동 채워지니 그대로 두세요.
      </p>

      <section className={s.card}>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 14 }}>
          {entries.map((e) => (
            <li key={e.key}>{e.key === selected ? <strong>{e.name}</strong> : <Link href={`/manage/legal?doc=${e.key}`}>{e.name}</Link>}</li>
          ))}
        </ul>
      </section>

      {current ? (
        <section className={s.card}>
          <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>{current.name}</h2>
          <LegalEditor key={current.key} target={current.target} initialTitle={current.title} initialBody={current.body} initialConsents={current.consents} canEdit={canEdit} />
          <h3 style={{ fontSize: 14, margin: '20px 0 8px' }}>최근 수정 이력</h3>
          {revisions.length === 0 ? (
            <p style={{ fontSize: 13, color: '#767B85', margin: 0 }}>아직 기록이 없습니다.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
              {revisions.map((r) => (
                <li key={r.id}>
                  <details>
                    <summary>
                      {new Date(r.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · {r.editorEmail}
                    </summary>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', background: '#F7F7F7', padding: 8 }}>{`${r.title}\n\n${r.body}${Array.isArray(r.consents) ? `\n\n[동의 문구]\n${(r.consents as Array<{ label: string }>).map((c) => `- ${c.label}`).join('\n')}` : ''}`}</pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
