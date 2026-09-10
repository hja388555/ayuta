'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PriceBook } from '@ayuta/pricing'
import type { ConsentDef } from '@/lib/checkout/consents'

export type OrdererFormState = {
  name: string
  phone: string
  email: string
  postalCode: string
  address1: string
  address2: string
  businessNo: string
  representative: string
}

export const EMPTY_ORDERER: OrdererFormState = {
  name: '',
  phone: '',
  email: '',
  postalCode: '',
  address1: '',
  address2: '',
  businessNo: '',
  representative: '',
}

/**
 * 결제 버튼을 누를 수 있는 상태인지 — 필수 동의가 전부 체크됐고 서명이 채워졌을 때만이다.
 * orderer 필드 자체의 형식 검증(이메일 형식 등)은 Zod가 서버에서 다시 하므로 여기서는
 * "빈칸이 없는가" 정도만 본다 — 화면은 안내일 뿐, 최종 판정은 항상 서버가 한다.
 */
export function canSubmit(
  orderer: OrdererFormState,
  consentDefs: readonly ConsentDef[],
  checked: Readonly<Record<string, boolean>>,
  signature: string,
): boolean {
  if (!orderer.name.trim() || !orderer.phone.trim() || !orderer.email.trim()) return false
  if (!orderer.postalCode.trim() || !orderer.address1.trim()) return false
  if (!signature.trim()) return false
  return consentDefs.filter((d) => d.required).every((d) => checked[d.key] === true)
}

/**
 * 전자서명은 손으로 그리는 게 아니라 동의 체크 시 주문자 이름이 자동 기입된다.
 * 모든 필수 동의가 체크된 순간에만 서명이 채워지고, 하나라도 풀리면 다시 비운다 —
 * 부분적으로 동의한 상태에서 서명만 남는 걸 막는다.
 */
export function autoSignature(orderer: OrdererFormState, consentDefs: readonly ConsentDef[], checked: Readonly<Record<string, boolean>>): string {
  const allChecked = consentDefs.filter((d) => d.required).every((d) => checked[d.key] === true)
  return allChecked ? orderer.name : ''
}

function formatAmount(amount: number, currency: PriceBook['currency']): string {
  return new Intl.NumberFormat(currency === 'KRW' ? 'ko-KR' : 'ja-JP', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

type Template = { title: string; body: string; consents: ConsentDef[] }

type Props = {
  locale: string
  categorySlug: string
  selection: unknown
  amount: number
  currency: PriceBook['currency']
  lines: { label: string; amount: number }[]
  template: Template
  initialOrderer?: Partial<OrdererFormState>
  labels: {
    title: string
    summaryTitle: string
    totalLabel: string
    ordererTitle: string
    name: string
    phone: string
    email: string
    postalCode: string
    address1: string
    address2: string
    businessNo: string
    representative: string
    contractTitle: string
    viewContract: string
    signatureLabel: string
    signatureNote: string
    payButton: string
    submitting: string
    errorGeneric: string
  }
}

export function CheckoutForm({ locale, categorySlug, selection, amount, currency, lines, template, initialOrderer, labels }: Props) {
  const router = useRouter()
  const [orderer, setOrderer] = useState<OrdererFormState>({ ...EMPTY_ORDERER, ...initialOrderer })
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [showContract, setShowContract] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signature = useMemo(() => autoSignature(orderer, template.consents, checked), [orderer, template.consents, checked])
  const canPay = useMemo(() => canSubmit(orderer, template.consents, checked, signature), [orderer, template.consents, checked, signature])

  function setField<K extends keyof OrdererFormState>(key: K, value: string) {
    setOrderer((prev) => ({ ...prev, [key]: value }))
  }

  async function submit() {
    if (!canPay || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categorySlug,
          locale,
          selection,
          consents: checked,
          orderer: {
            name: orderer.name,
            phone: orderer.phone,
            email: orderer.email,
            postalCode: orderer.postalCode,
            address1: orderer.address1,
            address2: orderer.address2 || undefined,
            businessNo: orderer.businessNo || undefined,
            representative: orderer.representative || undefined,
          },
          signature,
        }),
      })
      const body = (await res.json()) as { ok: boolean; orderNumber?: string }
      if (!res.ok || !body.ok || !body.orderNumber) {
        setError(labels.errorGeneric)
        return
      }
      router.push(`/${locale}/order/complete?order=${encodeURIComponent(body.orderNumber)}&email=${encodeURIComponent(orderer.email)}&phone=${encodeURIComponent(orderer.phone)}`)
    } catch {
      setError(labels.errorGeneric)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <section>
        <h2 style={{ fontSize: 'var(--fs-h2)' }}>{labels.summaryTitle}</h2>
        <ul>
          {lines.map((line) => (
            <li key={line.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{line.label}</span>
              <span>{formatAmount(line.amount, currency)}</span>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 12 }}>
          <span>{labels.totalLabel}</span>
          <strong style={{ fontSize: 'var(--fs-h1)' }}>{formatAmount(amount, currency)}</strong>
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)' }}>{labels.ordererTitle}</h2>
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <input placeholder={labels.name} value={orderer.name} onChange={(e) => setField('name', e.target.value)} />
          <input placeholder={labels.phone} value={orderer.phone} onChange={(e) => setField('phone', e.target.value)} />
          <input placeholder={labels.email} value={orderer.email} onChange={(e) => setField('email', e.target.value)} />
          <input placeholder={labels.postalCode} value={orderer.postalCode} onChange={(e) => setField('postalCode', e.target.value)} />
          <input placeholder={labels.address1} value={orderer.address1} onChange={(e) => setField('address1', e.target.value)} />
          <input placeholder={labels.address2} value={orderer.address2} onChange={(e) => setField('address2', e.target.value)} />
          <input placeholder={labels.businessNo} value={orderer.businessNo} onChange={(e) => setField('businessNo', e.target.value)} />
          <input placeholder={labels.representative} value={orderer.representative} onChange={(e) => setField('representative', e.target.value)} />
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)' }}>{labels.contractTitle}</h2>
        <button type="button" onClick={() => setShowContract(true)}>
          {labels.viewContract}
        </button>

        {showContract && (
          <div role="dialog" style={{ border: '1px solid var(--line-strong)', padding: 16, marginTop: 12, maxHeight: 400, overflow: 'auto' }}>
            <h3>{template.title}</h3>
            {/* 빈칸이 채워진 상태를 그대로 보여준다 — createOrder가 실제로 저장할 것과 같은 텍스트를
                서버가 미리 렌더해 넘긴다(template.body는 이미 fillContract를 거친 미리보기다) */}
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{template.body}</pre>
            <button type="button" onClick={() => setShowContract(false)}>
              닫기
            </button>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
          {template.consents.map((c) => (
            <label key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={checked[c.key] === true}
                onChange={(e) => setChecked((prev) => ({ ...prev, [c.key]: e.target.checked }))}
              />
              {c.label}
            </label>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <span>{labels.signatureLabel}: </span>
          {/* 입력칸을 직접 고치게 하지 않는다 — 동의 체크 시 자동 기입되는 값만 보여준다 */}
          <strong>{signature || '—'}</strong>
          <p style={{ color: 'var(--ink-500)', fontSize: 'var(--fs-caption)' }}>{labels.signatureNote}</p>
        </div>
      </section>

      {error && <p style={{ color: 'crimson', marginTop: 16 }}>{error}</p>}

      <button type="button" disabled={!canPay || submitting} onClick={submit} style={{ marginTop: 24, width: '100%', padding: '14px 0' }}>
        {submitting ? labels.submitting : labels.payButton}
      </button>
    </div>
  )
}
