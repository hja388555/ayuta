'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Modal } from './ui'
import s from './LoginRequiredModal.module.css'

/**
 * 로그인 유도 팝업(Figma [v2] 팝업 A ⑤ 227:153). 비회원이 헤더·탭바의 마이페이지를 누르면 뜬다.
 * 주소창으로 /mypage 에 바로 오면 서버가 로그인 화면으로 보낸다(그대로 둔다).
 * 1:1 채팅 버튼도 같은 팝업을 쓴다 — 돌아올 곳(next)과 안내 문구(body)만 바꾼다.
 */
export function LoginRequiredModal({
  locale,
  open,
  onClose,
  next: nextPath,
  body,
}: {
  locale: string
  open: boolean
  onClose: () => void
  next?: string
  body?: [string, string]
}) {
  const t = useTranslations('modal')
  const next = encodeURIComponent(nextPath ?? `/${locale}/mypage`)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('loginTitle')}
      closeLabel={t('close')}
      footer={
        <div className={s.foot}>
          <Link href={`/${locale}/login#guest-title`} className="btn btn-outline" onClick={onClose}>
            {t('loginGuest')}
          </Link>
          <Link href={`/${locale}/login?next=${next}`} className="btn btn-primary" onClick={onClose}>
            {t('loginGo')}
          </Link>
        </div>
      }
    >
      <div className={s.confirm}>
        <span className={s.icon}>
          <img src="/ui/modal-user.svg" alt="" width={30} height={30} />
        </span>
        <p className={s.title}>{t('loginTitle')}</p>
        <p className={s.text}>
          {body ? body[0] : t('loginBody1')}
          <br />
          {body ? body[1] : t('loginBody2')}
        </p>
      </div>
    </Modal>
  )
}
