import { LegalDocumentView, legalMetadata } from '@/components/LegalDocumentView'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props) {
  return legalMetadata('privacy', (await params).locale)
}

export default async function PrivacyPage({ params }: Props) {
  return <LegalDocumentView kind="privacy" locale={(await params).locale} />
}
