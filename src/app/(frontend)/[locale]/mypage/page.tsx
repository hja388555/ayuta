import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Shell } from '@/components/Shell'
import { PasswordForm, ProfileForm, WithdrawButton } from '@/components/MypageForms'
import { getSessionUser } from '@/lib/dal'
import { CATEGORIES } from '@/lib/categories'

/**
 * 마이페이지(큐 Q21): 주문 내역 · 정보 수정 · 비밀번호 변경 · 탈퇴.
 * 로그인하지 않았으면 로그인 화면으로 보내고, 돌아올 곳을 넘긴다.
 * 주문 상세는 기존 주문 완료 화면(/order/complete?order=)을 쓴다 — 회원 소유권 확인이 이미 있다.
 * 계약서 보관함은 Q21-B 에서 이 화면에 붙는다.
 */
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = { params: Promise<{ locale: string }> }

export default async function MyPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const session = await getSessionUser()
  if (!session) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/mypage`)}`)

  const t = await getTranslations('mypage')
  const tCat = await getTranslations('categories')
  const payload = await getPayload({ config })
  const me = await payload.findByID({ collection: 'users', id: session.id, depth: 0, overrideAccess: true })
  const { docs: orders } = await payload.find({
    collection: 'orders',
    where: { customer: { equals: session.id } },
    sort: '-createdAt',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const dateFmt = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
  const money = (n: number, c: string) => new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'ko-KR', { style: 'currency', currency: c }).format(n)
  const categorySlug = (no: number) => CATEGORIES.find((c) => c.no === no)?.slug
  const statusLabels = t.raw('status') as Record<string, string>
  const errors = t.raw('errors') as Record<string, string>
  const cell = { padding: '10px 8px', borderBottom: '1px solid var(--ink-100, #ECEEF1)', textAlign: 'left' as const }
  const section = { marginTop: 40 } as const

  return (
    <main>
      <Shell as="section">
        <div style={{ padding: '32px 0 64px', maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ fontSize: 'var(--fs-h1)' }}>{t('title')}</h1>
          <p style={{ color: 'var(--ink-500)' }}>
            {me.name as string} · {me.email as string}
          </p>

          <section style={section}>
            <h2 style={{ fontSize: 'var(--fs-h3, 18px)' }}>{t('ordersTitle')}</h2>
            {orders.length === 0 ? (
              <p style={{ color: 'var(--ink-500)' }}>{t('noOrders')}</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={cell}>{t('orderNumber')}</th>
                      <th style={cell}>{t('service')}</th>
                      <th style={{ ...cell, textAlign: 'right' }}>{t('amount')}</th>
                      <th style={cell}>{t('statusLabel')}</th>
                      <th style={cell}>{t('orderedAt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const slug = categorySlug(o.category as number)
                      return (
                        <tr key={o.id}>
                          <td style={cell}>
                            <Link href={`/${locale}/order/complete?order=${encodeURIComponent(o.orderNumber as string)}`}>{o.orderNumber as string}</Link>
                          </td>
                          <td style={cell}>{slug ? tCat(slug) : '-'}</td>
                          <td style={{ ...cell, textAlign: 'right' }}>{money(o.amount as number, o.currency as string)}</td>
                          <td style={cell}>{statusLabels[o.status as string] ?? (o.status as string)}</td>
                          <td style={cell}>{dateFmt.format(new Date(o.createdAt as string))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={section}>
            <h2 style={{ fontSize: 'var(--fs-h3, 18px)' }}>{t('profileTitle')}</h2>
            <ProfileForm
              initial={{
                name: (me.name as string) ?? '',
                phone: (me.phone as string) ?? '',
                postalCode: (me.postalCode as string) ?? '',
                address1: (me.address1 as string) ?? '',
                address2: (me.address2 as string) ?? '',
              }}
              labels={{ name: t('name'), phone: t('phone'), postalCode: t('postalCode'), address1: t('address1'), address2: t('address2'), save: t('save'), saved: t('saved') }}
              errors={errors}
            />
          </section>

          <section style={section}>
            <h2 style={{ fontSize: 'var(--fs-h3, 18px)' }}>{t('passwordTitle')}</h2>
            <PasswordForm labels={{ current: t('currentPassword'), next: t('newPassword'), hint: t('passwordHint'), save: t('changePassword'), saved: t('passwordChanged') }} errors={errors} />
          </section>

          <section style={section}>
            <h2 style={{ fontSize: 'var(--fs-h3, 18px)' }}>{t('withdrawTitle')}</h2>
            <p style={{ color: 'var(--ink-500)' }}>{t('withdrawNotice')}</p>
            <WithdrawButton locale={locale} labels={{ button: t('withdrawButton'), confirm: t('withdrawConfirm') }} errors={errors} />
          </section>
        </div>
      </Shell>
    </main>
  )
}
