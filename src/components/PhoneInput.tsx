'use client'

import { useTranslations } from 'next-intl'
import { normalizePhone, phoneErrorCountry, PHONE_COUNTRIES, PHONE_MAX, tidyPhoneInput, type PhoneCountry } from '../lib/phone'
import s from './PhoneInput.module.css'

const DIAL: Record<PhoneCountry, string> = { KR: '+82', JP: '+81' }

type Props = {
  id: string
  country: PhoneCountry
  value: string
  onChange: (next: { country: PhoneCountry; value: string }) => void
  onBlur?: () => void
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
  required?: boolean
}

/**
 * 연락처 입력(Figma v2 상태 모음 — 한국 +82 ▾ | 번호). 나라는 기본 select 로 고른다.
 * 칸을 벗어나면 올바른 번호를 국내 표기로 정리하고, +81·+82 를 적었으면 나라도 맞춘다.
 */
export function PhoneInput({ id, country, value, onChange, onBlur, invalid, describedBy, disabled, required }: Props) {
  const t = useTranslations('phone')
  return (
    <div className={s.wrap} data-invalid={invalid ? 'true' : undefined} data-disabled={disabled ? 'true' : undefined}>
      <span className={s.country}>
        <select
          className={s.select}
          aria-label={t('countryLabel')}
          value={country}
          disabled={disabled}
          onChange={(e) => onChange({ country: e.target.value as PhoneCountry, value })}
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {t(c)} {DIAL[c]}
            </option>
          ))}
        </select>
        <span aria-hidden className={s.name}>
          {t(country)}
        </span>
        <span aria-hidden>{DIAL[country]}</span>
        <span aria-hidden className={s.chevron} />
      </span>
      <span aria-hidden className={s.divider} />
      <input
        id={id}
        className={s.input}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={PHONE_MAX}
        placeholder={t(country === 'JP' ? 'placeholderJP' : 'placeholderKR')}
        value={value}
        disabled={disabled}
        required={required}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange({ country, value: e.target.value })}
        onBlur={() => {
          const tidy = tidyPhoneInput(value, country)
          if (tidy && (tidy.value !== value || tidy.country !== country)) onChange(tidy)
          onBlur?.()
        }}
      />
    </div>
  )
}

/** 나라별 형식 오류 문구. 입력에 국가번호가 있으면 그 나라 기준 */
export function usePhoneErrorText(): (value: string, country: PhoneCountry) => string {
  const t = useTranslations('phone')
  return (value, country) => t(phoneErrorCountry(value, country) === 'JP' ? 'errJP' : 'errKR')
}

/** 보낼 값 — 올바르면 E.164, 아니면 적은 그대로(서버가 다시 거절한다) */
export const phoneForSubmit = (value: string, country: PhoneCountry): string => normalizePhone(value, country) ?? value.trim()
