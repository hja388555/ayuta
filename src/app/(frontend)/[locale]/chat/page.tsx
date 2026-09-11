import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { ChatRoom } from '@/components/ChatRoom'
import { getSessionUser } from '@/lib/dal'
import { toChatLocale } from '@/lib/chat/rules'

/** [v2] 12 1:1 채팅(Figma 232:418 PC / 232:489 Mobile). 로그인한 고객만 */
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'chat' })
  return { title: t('title'), robots: { index: false, follow: false } }
}

export default async function ChatPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await getSessionUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/chat`)}`)

  const t = await getTranslations('chat')
  const labels = {
    title: t('title'),
    badge: t('badge'),
    placeholder: t('placeholder'),
    send: t('send'),
    attach: t('attach'),
    notice1: t('notice1'),
    notice2: t('notice2'),
    empty: t('empty'),
    closed: t('closed'),
    sendError: t('sendError'),
    rateLimited: t('rateLimited'),
    loadError: t('loadError'),
    translationFailed: t('translationFailed'),
    loading: t('loading'),
  }
  return (
    <Shell bleed background="#f7f8fa">
      <ChatRoom locale={toChatLocale(locale)} labels={labels} />
    </Shell>
  )
}
