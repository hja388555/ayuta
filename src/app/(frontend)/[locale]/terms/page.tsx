import { LegalDocumentView, legalMetadata } from '@/components/LegalDocumentView'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props) {
  return legalMetadata('terms', (await params).locale)
}

export default async function TermsPage({ params }: Props) {
  return <LegalDocumentView kind="terms" locale={(await params).locale} />
}
