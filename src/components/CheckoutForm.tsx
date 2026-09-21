'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { PriceBook } from '@ayuta/pricing'
import type { ConsentDef } from '@/lib/checkout/consents'
import { fillBuyerPreview } from '../lib/checkout/contract-preview'
import { clearOrdererDraft, readOrdererDraft, writeOrdererDraft } from '../lib/checkout/orderer-draft'
import type { CheckoutLabels } from '@/lib/checkout/labels'
import { signatureMatches } from '@/lib/checkout/signature'
import { defaultPhoneCountry, initialPhoneInput, isPhoneCountry, isValidPhone, type PhoneCountry } from '../lib/phone'
import { ChoiceCard, StepTitle, TotalBar } from './ui'
import { PhoneInput, phoneForSubmit, usePhoneErrorText } from './PhoneInput'
import { AddressSearch } from './AddressSearch'
import { ContractDialog } from './ContractModal'
import { LegalConsentModal, type LegalKind } from './LegalConsentModal'
import s from './Checkout.module.css'

export type OrdererFormState = {
  name: string
  phone: string
  phoneCountry: PhoneCountry
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
  phoneCountry: 'KR',
  email: '',
  postalCode: '',
  address1: '',
  address2: '',
  businessNo: '',
  representative: '',
}

export type OrdererField = Exclude<keyof OrdererFormState, 'phoneCountry'>
export type FieldError = 'required' | 'email' | 'phone'

/** 마지막 두 어절 사이 공백을 줄바꿈 없는 공백으로 — "합니다." 같은 끝말만 다음 줄로 떨어지지 않게 한다 */
export function keepTail(text: string): string {
  const i = text.trimEnd().lastIndexOf(' ')
  return i > 0 ? `${text.slice(0, i)}\u00a0${text.slice(i + 1)}` : text
}

/** 시안(209:2)에서 * 가 붙은 칸 */
export const REQUIRED_FIELDS: readonly OrdererField[] = ['name', 'phone', 'email', 'postalCode', 'address1', 'representative']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 칸별 검증(상태 모음 A 233:142). 화면 안내용이다 — 형식의 최종 판정은 서버 Zod 가 다시 한다.
 * 빈칸이 먼저고, 채워진 칸만 형식을 본다.
 */
export function validateOrderer(orderer: OrdererFormState): Partial<Record<OrdererField, FieldError>> {
  const errors: Partial<Record<OrdererField, FieldError>> = {}
  for (const f of REQUIRED_FIELDS) if (!orderer[f].trim()) errors[f] = 'required'
  if (!errors.email && !EMAIL_RE.test(orderer.email.trim())) errors.email = 'email'
  // 고른 나라의 번호 규칙(lib/phone). 서버도 같은 규칙으로 다시 본다
  if (!errors.phone && !isValidPhone(orderer.phone, orderer.phoneCountry)) errors.phone = 'phone'
  return errors
}

/** 입력칸 처음 상태 — 회원·문의 때 저장된 연락처(E.164)를 나라와 입력칸 숫자로 풀고, 없으면 표지 국가·언어로 나라를 정한다 */
export function initialOrdererState(initial: Partial<Omit<OrdererFormState, 'phoneCountry'>> | undefined, coverCountries: readonly string[], locale: string): OrdererFormState {
  const fallback = defaultPhoneCountry({ stored: initial?.phone, coverCountries, locale })
  const phone = initialPhoneInput(initial?.phone, fallback)
  return { ...EMPTY_ORDERER, ...initial, phone: phone.value, phoneCountry: phone.country }
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
  if (!signatureReady(signature, orderer.name)) return false
  return requiredConsentsChecked(consentDefs, checked)
}

/**
 * 서명은 자동 기입하지 않는다 — 고객이 계약서 팝업에서 주문자명을 직접 타이핑해야 하고,
 * 공백·유니코드 표기를 맞춘 값이 주문자명과 같을 때만 서명으로 인정한다(signatureKey).
 */
export function signatureReady(typed: string, ordererName: string): boolean {
  return signatureMatches(typed, ordererName)
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
  /** 주문을 만드는 API. 카테고리 결제는 /api/checkout, 견적 결제는 /api/quote/order */
  endpoint: string
  /** 주문자·동의·서명 말고 함께 보낼 값(카테고리 선택값, 견적 토큰 등). 금액은 싣지 않는다 — 서버가 정한다 */
  requestBody: Record<string, unknown>
  amount: number
  currency: PriceBook['currency']
  /** 주문 내역 확인 카드 — 카테고리 제목·고른 채널·상품명을 서버가 순서대로 넘긴다. 견적처럼 내역을 폼 밖에서 보여주면 생략한다 */
  reviewSummary?: { title: string; lines: { text: string; strong: boolean }[] }
  /** 같은 선택값을 실은 폼 주소(선택 내용 수정하기). 고칠 수 없는 견적은 생략한다 */
  editHref?: string
  /** 주문자 입력을 sessionStorage 에 임시 저장할 구분값(카테고리 슬러그 등). 없으면 저장하지 않는다 */
  draftScope?: string
  template: Template
  initialOrderer?: Partial<Omit<OrdererFormState, 'phoneCountry'>>
  /** 표지에서 고른 광고 국가 — 하나만 골랐으면 연락처 나라의 기본값이 된다 */
  coverCountries?: readonly string[]
  labels: CheckoutLabels
  /** 서버 거부 사유(reason)별 안내. 없는 사유는 errorGeneric 을 보인다 */
  errorMessages?: Partial<Record<string, string>>
}

// 약관·개인정보는 약관 동의 모달(v2 13-A)로, 그 밖의 동의(계약 내용 등)는 계약서 미리보기 팝업으로
const PUBLIC_DOC_KEYS = new Set(['terms', 'privacy'])

export function CheckoutForm({ locale, endpoint, requestBody, amount, currency, reviewSummary, editHref, draftScope, template, initialOrderer, coverCountries = [], labels, errorMessages }: Props) {
  const router = useRouter()
  const phoneErrorText = usePhoneErrorText()
  const [orderer, setOrderer] = useState<OrdererFormState>(() => initialOrdererState(initialOrderer, coverCountries, locale))
  // 뒤로가기·새로고침으로 돌아왔으면 임시 저장한 주문자 입력을 되살린다(저장본 > 회원 정보).
  // 서버 렌더와 첫 화면이 달라지지 않게 마운트 뒤에 읽고, 읽기 전에는 저장하지 않는다
  const [draftLoaded, setDraftLoaded] = useState(false)
  useEffect(() => {
    if (draftScope) {
      const draft = readOrdererDraft(window.sessionStorage, draftScope)
      if (draft) {
        const { phoneCountry, ...rest } = draft
        setOrderer((prev) => ({ ...prev, ...rest, phoneCountry: isPhoneCountry(phoneCountry) ? phoneCountry : prev.phoneCountry }))
      }
    }
    setDraftLoaded(true)
  }, [draftScope])
  useEffect(() => {
    if (draftScope && draftLoaded) writeOrdererDraft(window.sessionStorage, draftScope, orderer)
  }, [draftScope, draftLoaded, orderer])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [touched, setTouched] = useState<Partial<Record<OrdererField, boolean>>>({})
  const [attempted, setAttempted] = useState(false)
  const [showContract, setShowContract] = useState<string | null>(null)
  // 서명은 자동 기입되지 않는다 — 고객이 팝업에서 직접 타이핑한 값을 그대로 갖고 있다가
  // 팝업을 닫고 다시 열어도 유지한다(값은 이 폼에, 팝업은 보여주기만 한다)
  const [signature, setSignature] = useState('')
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
  const canPay = useMemo(() => canSubmit(orderer, template.consents, checked, signature), [orderer, template.consents, checked, signature])
  // 주문 내역 확인(2)은 볼 것만 있는 단계라 주문자 정보가 끝나면 곧바로 계약서 동의(3)로 넘어간다
  const currentStep = errorCount > 0 ? 1 : !consentsDone ? 3 : 4
  const summary = labels.errSummary.replace('{count}', String(errorCount))
  // 약관·개인정보는 결제 화면에서 바로 체크하고, 계약서 항목은 계약서 팝업 안에서 체크한다
  const publicConsents = template.consents.filter((c) => PUBLIC_DOC_KEYS.has(c.key))
  const contractConsents = template.consents.filter((c) => !PUBLIC_DOC_KEYS.has(c.key))
  const contractAgreed = contractConsents.length > 0 && contractConsents.every((c) => checked[c.key] === true)

  function setField(key: OrdererField, value: string) {
    setOrderer((prev) => ({ ...prev, [key]: value }))
  }

  // 계약서에는 주문자 정보가 들어가므로, 주문자 정보가 끝나기 전에는 계약서를 열거나 동의하지 못하게 한다.
  // 막았을 때는 빠진 칸을 보여 주고 첫 칸으로 포커스를 옮긴다
  const contractLocked = errorCount > 0
  const [contractBlocked, setContractBlocked] = useState(false)
  function guardContract(): boolean {
    if (!contractLocked) return true
    setAttempted(true)
    setContractBlocked(true)
    const first = REQUIRED_FIELDS.concat(['phone', 'email']).find((f) => errors[f])
    if (first) document.getElementById(`co-${first}`)?.focus()
    return false
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
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestBody,
          locale,
          consents: checked,
          orderer: {
            name: orderer.name,
            phone: phoneForSubmit(orderer.phone, orderer.phoneCountry),
            email: orderer.email,
            postalCode: orderer.postalCode,
            address1: orderer.address1,
            address2: orderer.address2 || undefined,
            businessNo: orderer.businessNo || undefined,
            representative: orderer.representative || undefined,
          },
          signature: signature.trim(),
          idempotencyKey,
        }),
      })
      const body = (await res.json()) as { ok: boolean; orderNumber?: string; reason?: string }
      if (!res.ok || !body.ok || !body.orderNumber) {
        setError((body.reason && errorMessages?.[body.reason]) || labels.errorGeneric)
        return
      }
      if (draftScope) clearOrdererDraft(window.sessionStorage, draftScope)
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
    const message = err === 'email' ? labels.errEmail : err === 'phone' ? phoneErrorText(orderer.phone, orderer.phoneCountry) : labels.errRequired
    const markTouched = () => setTouched((prev) => ({ ...prev, [key]: true }))
    return (
      <div className={err ? `${s.field} ${s.invalid}` : s.field}>
        <label htmlFor={id} className={s.label}>
          {labels[key]}
          {opts.required ? ' *' : ''}
        </label>
        <div className={s.inline}>
          <div className={s.control}>
            {key === 'phone' ? (
              <PhoneInput
                id={id}
                country={orderer.phoneCountry}
                value={orderer.phone}
                required={opts.required}
                invalid={Boolean(err)}
                describedBy={err ? `${id}-err` : undefined}
                onChange={(next) => setOrderer((prev) => ({ ...prev, phone: next.value, phoneCountry: next.country }))}
                onBlur={markTouched}
              />
            ) : (
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
                onBlur={markTouched}
              />
            )}
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

  // 브라우저 자동 번역이 이 화면의 글자 노드를 갈아치우면 주문자명·서명 입력이 먹통이 되고
  // 계약 내용도 원문과 달라진다 — 계약서 팝업과 같은 이유로 결제 화면 전체를 번역에서 뺀다
  return (
    <div translate="no" className={`notranslate ${s.stack}`}>
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

      {/* PC 는 왼쪽 740(주문자·계약·결제수단) | 오른쪽 420 고정 패널(주문 내역·결제 버튼). 모바일은 감싸개가 display: contents 라
          order 로 기존 순서(주문자 → 주문 내역 → 계약 → 결제수단 → 버튼)를 그대로 지킨다 */}
      <div className={s.split}>
        <div className={s.splitMain}>
          <section className={s.card} aria-labelledby="co-orderer">
            <StepTitle id="co-orderer" title={labels.ordererTitle} />
            <div className={s.ordererCols}>
              <div className={s.col}>
              {field('name', { required: true, autoComplete: 'name' })}
              {field('representative', { required: true })}
              {field('phone', { required: true })}
              {field('email', { required: true, type: 'email', autoComplete: 'email' })}
              </div>
              <div className={s.col}>
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
              {field('address2', { autoComplete: 'address-line2' })}
              {field('businessNo')}
              </div>
            </div>
            <p className={s.note}>{keepTail(labels.ordererNote)}</p>
            {attempted && errorCount > 0 ? (
              <p className={s.banner} role="alert">
                <img src="/ui/alert-field.svg" alt="" width={18} height={18} />
                {summary}
              </p>
            ) : null}
          </section>

          <section className={s.card} aria-labelledby="co-contract">
            <StepTitle id="co-contract" title={labels.contractTitle} />
            {publicConsents.map((c) => (
              <div key={c.key} className={`choice ${s.consent}`}>
                <label className={s.consentLabel}>
                  <input
                    type="checkbox"
                    checked={checked[c.key] === true}
                    onChange={(e) => setChecked((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                  />
                  <span className="choice-box" aria-hidden />
                  <span>{keepTail(c.label)}</span>
                </label>
                <button type="button" className={`btn btn-secondary ${s.viewBtn}`} onClick={() => setViewDoc(c.key as LegalKind)}>
                  <img src="/ui/doc.svg" alt="" width={16} height={16} />
                  {labels.viewContent}
                </button>
              </div>
            ))}
            {/* 계약서 항목은 줄마다 세우지 않는다 — 한 줄로 묶고, 체크는 계약서 팝업 안에서 한다(2026-09-18 사용자) */}
            {contractConsents.length > 0 ? (
              <div className={`choice ${s.consent}`}>
                <label className={s.consentLabel}>
                  <input
                    type="checkbox"
                    checked={contractAgreed}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setChecked((prev) => ({ ...prev, ...Object.fromEntries(contractConsents.map((c) => [c.key, false])) }))
                        return
                      }
                      // 켤 때는 계약서를 펴서 그 안에서 항목별로 체크하게 한다
                      if (guardContract()) setShowContract(contractConsents[0]!.key)
                    }}
                  />
                  <span className="choice-box" aria-hidden />
                  <span>{keepTail(labels.contractAgreeAll)}</span>
                </label>
                <button
                  type="button"
                  className={`btn btn-secondary ${s.viewBtn}`}
                  aria-disabled={contractLocked || undefined}
                  onClick={() => {
                    if (guardContract()) setShowContract(contractConsents[0]!.key)
                  }}
                >
                  <img src="/ui/doc.svg" alt="" width={16} height={16} />
                  {labels.viewContract}
                </button>
              </div>
            ) : null}
            {contractLocked && contractBlocked ? (
              <p className={s.contractLock} role="alert">
                {labels.contractNeedsOrderer}
              </p>
            ) : null}
            {/* 서명은 계약서 팝업에서 고객이 직접 입력한 값이다 — 여기서는 그 결과만 보여준다 */}
            <div className={signatureReady(signature, orderer.name) ? `${s.sign} ${s.signOn}` : s.sign} aria-live="polite">
              <span className={s.signBox} aria-hidden />
              <span className={s.signText}>{keepTail(labels.signatureLabel)}</span>
              <span className={s.signName}>{signature.trim() || labels.signatureEmpty}</span>
            </div>
          </section>

          {/* 빈칸이 채워진 상태를 그대로 보여준다 — createOrder가 실제로 저장할 것과 같은 텍스트다.
              template.body 는 서버가 주문자 칸만 남기고 채운 미리보기이고, 주문자 칸은 입력 중인 값으로 여기서 채운다 */}
          {/* 13-B 계약서 팝업 확인 모드 — [계약 확인 완료]를 누르면 연 줄의 동의가 체크된다 */}
          <ContractDialog
            open={showContract !== null}
            onClose={() => setShowContract(null)}
            onConfirm={() => setShowContract(null)}
            consentControl={{
              keys: contractConsents.map((c) => c.key),
              checked,
              onToggle: (key, next) => setChecked((prev) => ({ ...prev, [key]: next })),
            }}
            signature={signature}
            onSignatureChange={setSignature}
            expectedName={orderer.name}
            signaturePrompt={labels.signaturePrompt}
            signatureMismatch={labels.signatureMismatch}
            title={template.title}
            closeLabel={labels.close}
            contractText={
              showContract !== null
                ? fillBuyerPreview(template.body, { ...orderer, phone: phoneForSubmit(orderer.phone, orderer.phoneCountry) }, signature)
                : ''
            }
          />
          <LegalConsentModal kind={viewDoc} locale={locale} onClose={() => setViewDoc(null)} onAgree={(k) => setChecked((prev) => ({ ...prev, [k]: true }))} />

          <section className={`${s.card} ${s.payCard}`} aria-labelledby="co-pay">
            <StepTitle id="co-pay" title={labels.payTitle} />
            {/* 결제수단은 지금 카드 하나뿐이다. 엑심베이 연동 전이라 선택값은 서버로 보내지 않는다 */}
            <div className={s.pay}>
              <ChoiceCard type="radio" name="payMethod" checked>
                <span className={s.payOption}>
                  <img src="/ui/card.svg" alt="" width={20} height={20} />
                  {labels.payCard}
                </span>
              </ChoiceCard>
            </div>
          </section>
        </div>
        <aside className={s.splitSide}>
          {reviewSummary ? (
            <section className={s.card} aria-labelledby="co-review">
              <StepTitle id="co-review" title={labels.reviewTitle} />
              <div className={s.summary}>
                <p className={s.summaryTitle}>{reviewSummary.title}</p>
                {reviewSummary.lines.map((l, i) => (
                  <p key={`${i}-${l.text}`} className={l.strong ? s.summaryStrong : s.summaryLine}>
                    {l.text}
                  </p>
                ))}
              </div>
              <TotalBar label={labels.totalLabel} amount={formatAmount(amount, currency)} />
              {editHref ? (
                <a href={editHref} className={s.editLink}>
                  <span className={`icon-mask ${s.editArrow}`} style={{ ['--icon-url' as string]: "url('/ui/chevron.svg')" }} aria-hidden /> {labels.editSelection}
                </a>
              ) : null}
            </section>
          ) : null}
          <div className={s.payAction}>
            <button
              type="button"
              className={`btn btn-primary btn-block ${s.payBtn}`}
              aria-disabled={!canPay || submitting}
              disabled={submitting}
              onClick={submit}
            >
              {submitting ? labels.submitting : labels.payButton.replace('{amount}', formatAmount(amount, currency))}
            </button>
            {error ? (
              <p className={s.serverError} role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
