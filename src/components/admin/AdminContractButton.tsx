'use client'

import { NextIntlClientProvider } from 'next-intl'
import { ContractModal } from '@/components/ContractModal'

type Props = React.ComponentProps<typeof ContractModal> & { modalMessages: Record<string, string> }

/**
 * 관리자 상세의 "계약서 보기". 고객 화면의 ContractModal(보기 모드, onConfirm 없음)을 그대로 쓴다.
 * /manage 는 [locale] 밖이라 NextIntlClientProvider 가 없다 — 모달이 쓰는 modal.* 문구만 한국어로 넣어 준다.
 */
export function AdminContractButton({ modalMessages, ...props }: Props) {
  return (
    <NextIntlClientProvider locale="ko" messages={{ modal: modalMessages }} timeZone="Asia/Seoul">
      <ContractModal {...props} />
    </NextIntlClientProvider>
  )
}
