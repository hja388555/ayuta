'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { PriceBook } from '@ayuta/pricing'
import type { ConsentDef } from '@/lib/checkout/consents'
import type { CheckoutLabels } from '@/lib/checkout/labels'
import { ChoiceCard, StepTitle, TotalBar } from './ui'
import { AddressSearch } from './AddressSearch'
import { ContractDialog } from './ContractModal'
import { LegalConsentModal, type LegalKind } from './LegalConsentModal'
import s from './Checkout.module.css'

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

export type OrdererField = keyof OrdererFormState
export type FieldError = 'required' | 'email' | 'phone'

/** 시안(209:2)에서 * 가 붙은 칸 */
export const REQUIRED_FIELDS: readonly OrdererField[] = ['name', 'phone', 'email', 'postalCode', 'address1', 'representative']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 하이픈·공백은 허용하고 떼어 본다. 일본 번호(+81)도 받도록 앞 + 한 개와 9~15자리를 허용한다
const PHONE_RE = /^\+?\d{9,15}$/

/**
 * 칸별 검증(상태 모음 A 233:142). 화면 안내용이다 — 형식의 최종 판정은 서버 Zod 가 다시 한다.
 * 빈칸이 먼저고, 채워진 칸만 형식을 본다.
 */
export function validateOrderer(orderer: OrdererFormState): Partial<Record<OrdererField, FieldError>> {
  const errors: Partial<Record<OrdererField, FieldError>> = {}
  for (const f of REQUIRED_FIELDS) if (!orderer[f].trim()) errors[f] = 'required'
  if (!errors.email && !EMAIL_RE.test(orderer.email.trim())) errors.email = 'email'
  if (!errors.phone && !PHONE_RE.test(orderer.phone.replace(/[\s-]/g, ''))) errors.phone = 'phone'
  return errors
}

function requiredConsentsChecked(consentDefs: readonly ConsentDef[], checked: Readonly<Record<string, boolean>>): boolean {
  return consentDefs.filter((d) => d.required).every((d) => checked[d.key] === true)
}

/**
 * 결제 버튼을 누를 수 있는 상태인지 — 주문자 칸 검증을 통과하고, 필수 동의가 전부 체크됐고,
 * 서명이 채워졌을 때만이다. 화면은 안내일 뿐, 최종 판정은 항상 서버가 한다.
 */
export function canSubmit(
  orderer: OrdererFormState,
  consentDefs: readonly ConsentDef[],
  checked: Readonly<Record<string, boolean>>,
  signature: string,
): boolean {
  if (Object.keys(validateOrderer(orderer)).length > 0) return false
  if (!signature.trim()) return false
  return requiredConsentsChecked(consentDefs, checked)
}

/**
 * 전자서명은 손으로 그리는 게 아니라 동의 체크 시 주문자 이름이 자동 기입된다.
 * 모든 필수 동의가 체크된 순간에만 서명이 채워지고, 하나라도 풀리면 다시 비운다 —
 * 부분적으로 동의한 상태에서 서명만 남는 걸 막는다.
 */
export function autoSignature(orderer: OrdererFormState, consentDefs: readonly ConsentDef[], checked: Readonly<Record<string, boolean>>): string {
  return requiredConsentsChecked(consentDefs, checked) ? orderer.name : ''
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
  /** 주문 내역 표 — 서버가 금액까지 서식을 맞춰 넘긴다 */
  reviewRows: { label: string; value: string }[]
  /** 같은 선택값을 실은 폼 주소(선택 내용 수정하기) */
  editHref: string
  template: Template
  initialOrderer?: Partial<OrdererFormState>
  labels: CheckoutLabels
}

// 약관·개인정보는 약관 동의 모달(v2 13-A)로, 그 밖의 동의(계약 내용 등)는 계약서 미리보기 팝업으로
const PUBLIC_DOC_KEYS = new Set(['terms', 'privacy'])

export function CheckoutForm({ locale, categorySlug, selection, amount, currency, reviewRows, editHref, template, initialOrderer, labels }: Props) {
  const router = useRouter()
  const [orderer, setOrderer] = useState<OrdererFormState>({ ...EMPTY_ORDERER, ...initialOrderer })
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [touched, setTouched] = useState<Partial<Record<OrdererField, boolean>>>({})
  const [attempted, setAttempted] = useState(false)
  const [showContract, setShowContract] = useState<string | null>(null)
  const [viewDoc, setViewDoc] = useState<LegalKind | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 결제 버튼 더블클릭·네트워크 재시도로 같은 주문이 두 번 만들어지지 않게, 폼이 마운트될
  // 때 한 번만 키를 만들어 재시도에도 같은 값을 쓴다(Ruling 15) — 매 제출마다 새로 만들면
  // 재시도가 그냥 새 주문이 돼 버려서 멱등키의 의미가 없어진다
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const errors = useMemo(() => validateOrderer(orderer), [orderer])
  const errorCount = Object.keys(errors).length
  const consentsDone = requiredConsentsChecked(template.consents, checked)
  const signature = useMemo(() => autoSignature(orderer, template.consents, checked), [orderer, template.consents, checked])
  const canPay = useMemo(() => canSubmit(orderer, template.consents, checked, signature), [orderer, template.consents, checked, signature])
  // 주문 내역 확인(2)은 볼 것만 있는 단계라 주문자 정보가 끝나면 곧바로 계약서 동의(3)로 넘어간다
  const currentStep = errorCount > 0 ? 1 : !consentsDone ? 3 : 4
  const summary = labels.errSummary.replace('{count}', String(errorCount))

  function setField(key: OrdererField, value: string) {
    setOrderer((prev) => ({ ...prev, [key]: value }))
  }

  async function submit() {
    if (submitting) return
    if (!canPay) {
      // 버튼은 aria-disabled 로만 막아 두고, 누르면 무엇이 빠졌는지 보여준다
      setAttempted(true)
      const first = REQUIRED_FIELDS.concat(['phone', 'email']).find((f) => errors[f])
      if (first) document.getElementById(`co-${first}`)?.focus()
      return
    }
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
          idempotencyKey,
        }),
      })
      const body = (await res.json()) as { ok: boolean; orderNumber?: string }
      if (!res.ok || !body.ok || !body.orderNumber) {
        setError(labels.errorGeneric)
        return
      }
      // 이메일·연락처는 URL에 싣지 않는다(I6) — /api/checkout이 응답에 실어 준 서명된
      // 쿠키로 완료 화면이 본인 확인을 한다. 주문번호는 URL에 남아도 된다(추측만으로는
      // 남의 주문을 못 연다)
      router.push(`/${locale}/order/complete?order=${encodeURIComponent(body.orderNumber)}`)
    } catch {
      setError(labels.errorGeneric)
    } finally {
      setSubmitting(false)
    }
  }

  function field(key: OrdererField, opts: { required?: boolean; type?: string; autoComplete?: string; addon?: ReactNode } = {}) {
    const id = `co-${key}`
    const err = touched[key] || attempted ? errors[key] : undefined
    const message = err === 'email' ? labels.errEmail : err === 'phone' ? labels.errPhone : labels.errRequired
    return (
      <div className={err ? `${s.field} ${s.invalid}` : s.field}>
        <label htmlFor={id} className={s.label}>
          {labels[key]}
          {opts.required ? ' *' : ''}
        </label>
        <div className={s.inline}>
          <div className={s.control}>
            <input
              id={id}
              className={s.input}
              type={opts.type ?? 'text'}
              autoComplete={opts.autoComplete}
              placeholder={labels[`${key}Ph`]}
              value={orderer[key]}
              required={opts.required}
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? `${id}-err` : undefined}
              onChange={(e) => setField(key, e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, [key]: true }))}
            />
            {err ? <img src="/ui/alert-field.svg" alt="" width={18} height={18} className={s.fieldIcon} /> : null}
          </div>
          {opts.addon}
        </div>
        {err ? (
          <p id={`${id}-err`} className={s.fieldError}>
            <img src="/ui/alert-sm.svg" alt="" width={14} height={14} />
            {message}
          </p>
        ) : null}
      </div>
    )
  }

  const steps = [labels.stepOrderer, labels.stepReview, labels.stepContract, labels.stepPay]

  return (
    <div className={s.stack}>
      <ol className={s.stepper}>
        {steps.map((label, i) => {
          const n = i + 1
          const cls = n === currentStep ? `${s.step} ${s.stepActive}` : n < currentStep ? `${s.step} ${s.stepDone}` : s.step
          return (
            <li key={label} className={cls} aria-current={n === currentStep ? 'step' : undefined}>
              <span className={s.stepNum}>{n}</span>
              <span className={s.stepLabel}>{label}</span>
            </li>
          )
        })}
      </ol>

      <section className={s.card} aria-labelledby="co-orderer">
        <StepTitle n={1} id="co-orderer" title={labels.ordererTitle} hint={labels.ordererHint} />
        <div className={s.row} style={{ ['--cols' as string]: 3 }}>
          {field('name', { required: true, autoComplete: 'name' })}
          {field('phone', { required: true, type: 'tel', autoComplete: 'tel' })}
          {field('email', { required: true, type: 'email', autoComplete: 'email' })}
        </div>
        <div className={s.row} style={{ ['--cols' as string]: 2 }}>
          {field('postalCode', {
            required: true,
            autoComplete: 'postal-code',
            addon: (
              <AddressSearch
                locale={locale}
                className={`btn btn-secondary ${s.searchBtn}`}
                labels={{ button: labels.addressSearch, close: labels.close }}
                focusId="co-address2"
                onSelect={(p) => setOrderer((prev) => ({ ...prev, ...p }))}
              />
            ),
          })}
          {field('address1', { required: true, autoComplete: 'address-line1' })}
        </div>
        {field('address2', { autoComplete: 'address-line2' })}
        <div className={s.row} style={{ ['--cols' as string]: 2 }}>
          {field('representative', { required: true })}
          {field('businessNo')}
        </div>
        <p className={s.note}>{labels.ordererNote}</p>
        {attempted && errorCount > 0 ? (
          <p className={s.banner} role="alert">
            <img src="/ui/alert-field.svg" alt="" width={18} height={18} />
            {summary}
          </p>
        ) : null}
      </section>

      <section className={s.card} aria-labelledby="co-review">
        <StepTitle n={2} id="co-review" title={labels.reviewTitle} hint={labels.reviewHint} />
        <dl className={s.table}>
          {reviewRows.map((row) => (
            <div key={row.label} className={s.tableRow}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <a href={editHref} className={`btn btn-outline btn-block ${s.editLink}`}>
          {labels.editSelection}
        </a>
        <TotalBar label={labels.totalLabel} amount={formatAmount(amount, currency)} />
      </section>

      <section className={s.card} aria-labelledby="co-contract">
        <StepTitle n={3} id="co-contract" title={labels.contractTitle} hint={labels.contractHint} />
        {template.consents.map((c) => (
          <div key={c.key} className={`choice ${s.consent}`}>
            <label className={s.consentLabel}>
              <input
                type="checkbox"
                checked={checked[c.key] === true}
                onChange={(e) => setChecked((prev) => ({ ...prev, [c.key]: e.target.checked }))}
              />
              <span className="choice-box" aria-hidden />
              <span>{c.label}</span>
            </label>
            {PUBLIC_DOC_KEYS.has(c.key) ? (
              <button type="button" className={`btn btn-secondary ${s.viewBtn}`} onClick={() => setViewDoc(c.key as LegalKind)}>
                <img src="/ui/doc.svg" alt="" width={16} height={16} />
                {labels.viewContent}
              </button>
            ) : (
              <button type="button" className={`btn btn-secondary ${s.viewBtn}`} onClick={() => setShowContract(c.key)}>
                <img src="/ui/doc.svg" alt="" width={16} height={16} />
                {labels.viewContract}
              </button>
            )}
          </div>
        ))}
        {/* 입력칸을 직접 고치게 하지 않는다 — 필수 동의가 끝나면 주문자명이 자동 기입된다 */}
        <div className={signature ? `${s.sign} ${s.signOn}` : s.sign} aria-live="polite">
          <span className={s.signBox} aria-hidden />
          <span className={s.signText}>{labels.signatureLabel}</span>
          <span className={s.signName}>{signature || '—'}</span>
        </div>
        <p className={s.caption}>{labels.signatureNote}</p>
      </section>

      {/* 빈칸이 채워진 상태를 그대로 보여준다 — createOrder가 실제로 저장할 것과 같은 텍스트를
          서버가 미리 렌더해 넘긴다(template.body는 이미 fillContract를 거친 미리보기다) */}
      {/* 13-B 계약서 팝업 확인 모드 — [계약 확인 완료]를 누르면 연 줄의 동의가 체크된다 */}
      <ContractDialog
        open={showContract !== null}
        onClose={() => setShowContract(null)}
        onConfirm={() => {
          if (showContract) setChecked((prev) => ({ ...prev, [showContract]: true }))
          setShowContract(null)
        }}
        title={template.title}
        closeLabel={labels.close}
        contractText={template.body}
      />
      <LegalConsentModal kind={viewDoc} locale={locale} onClose={() => setViewDoc(null)} onAgree={(k) => setChecked((prev) => ({ ...prev, [k]: true }))} />

      <section className={s.card} aria-labelledby="co-pay">
        <StepTitle n={4} id="co-pay" title={labels.payTitle} />
        {/* 결제수단은 지금 카드 하나뿐이다. PortOne 연동 전이라 선택값은 서버로 보내지 않는다 */}
        <div className={s.pay}>
          <ChoiceCard type="radio" name="payMethod" checked>
            <span className={s.payOption}>
              <img src="/ui/card.svg" alt="" width={20} height={20} />
              {labels.payCard}
            </span>
          </ChoiceCard>
        </div>
      </section>

      <div>
        <button
          type="button"
          className={`btn btn-primary btn-block ${s.payBtn}`}
          aria-disabled={!canPay || submitting}
          disabled={submitting}
          onClick={submit}
        >
          {submitting ? labels.submitting : labels.payButton.replace('{amount}', formatAmount(amount, currency))}
        </button>
        {!canPay ? <p className={s.reason}>{errorCount > 0 ? summary : labels.errConsents}</p> : null}
        {error ? (
          <p className={s.serverError} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
