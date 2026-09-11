import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Shell } from '@/components/Shell'
import { ChatRoom } from '@/components/ChatRoom'
import { ChatFrame } from '@/components/ChatFrame'
import { GuestChatStart } from '@/components/GuestChatStart'
import { getSessionUser } from '@/lib/dal'
import { toChatLocale } from '@/lib/chat/rules'
import { guestThreadFromCookie } from '@/lib/chat/service'

/**
 * [v2] 12 1:1 채팅(Figma 232:418 PC / 232:489 Mobile).
 * 회원은 지금처럼 자기 방. 비회원은 쿠키의 방이 있으면 그 방, 없으면 시작 폼(12-B 285:2, 2026-09-12 "비회원도 채팅 가능").
 */
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ link?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'chat' })
  return { title: t('title'), robots: { index: false, follow: false } }
}

export default async function ChatPage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const chatLocale = toChatLocale(locale)
  const t = await getTranslations('chat')

  const user = await getSessionUser()
  const guestThread = user ? null : await guestThreadFromCookie(await getPayload({ config }))

  if (user || guestThread) {
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
        <ChatRoom locale={chatLocale} labels={labels} />
      </Shell>
    )
  }

  const { link } = await searchParams
  const errorCodes = ['required', 'consent_required', 'invalid_input', 'too_many_threads', 'generic', 'network'] as const
  return (
    <Shell bleed background="#f7f8fa">
      <ChatFrame title={t('title')} badge={t('badge')} notices={[t('notice1'), t('guestNotice2')]}>
        <GuestChatStart
          locale={chatLocale}
          linkInvalid={link === 'invalid'}
          labels={{
            title: t('guestTitle'),
            desc: t('guestDesc'),
            name: t('guestName'),
            namePlaceholder: t('guestNamePlaceholder'),
            email: t('guestEmail'),
            emailPlaceholder: t('guestEmailPlaceholder'),
            phone: t('guestPhone'),
            phonePlaceholder: t('guestPhonePlaceholder'),
            consent: t('guestConsent'),
            consentView: t('guestConsentView'),
            start: t('guestStart'),
            starting: t('guestStarting'),
            memberHint: t('guestMemberHint'),
            login: t('guestLogin'),
            linkInvalid: t('guestLinkInvalid'),
            errors: Object.fromEntries(errorCodes.map((code) => [code, t(`guestErrors.${code}`)])),
          }}
        />
      </ChatFrame>
    </Shell>
  )
}
