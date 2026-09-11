import { LegalDocumentView, legalMetadata } from '@/components/LegalDocumentView'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props) {
  return legalMetadata('refund', (await params).locale)
}

/** 환불 및 취소 정책(Figma [v2] 13-C). 계약서 제7조가 참조하는 "결제 당시 고지된 환불규정" */
export default async function RefundPage({ params }: Props) {
  return <LegalDocumentView kind="refund" locale={(await params).locale} />
}
