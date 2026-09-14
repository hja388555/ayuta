import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

/**
 * PC(≥768px) 전용 우측 하단 플로팅 버튼 두 개 — 1:1 채팅 · 전화(큐 클라이언트 4라운드 C).
 * 모바일은 하단 탭바(MobileTabBar)가 같은 기능을 이미 맡고 있어 여기서는 숨긴다(globals.css .floating-contact).
 * 주문 화면 결제 버튼을 가리지 않도록 body 하단 여백(--floating-contact-pad)을 PC 에서만 둔다.
 */
export async function FloatingContact({ locale, phone }: { locale: string; phone: string }) {
  const t = await getTranslations('tabs')
  return (
    <div className="floating-contact">
      <Link href={`/${locale}/chat`} className="floating-contact-btn floating-contact-chat">
        <img src="/ui/tab-chat.svg" alt="" width={20} height={20} />
        {t('chat')}
      </Link>
      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="floating-contact-btn floating-contact-call">
        <img src="/ui/tab-phone.svg" alt="" width={20} height={20} />
        {phone}
      </a>
    </div>
  )
}
