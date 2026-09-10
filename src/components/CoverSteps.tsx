'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toggleValue } from './TierForm'
import {
  buildCoverQuery,
  canProceedToService,
  COUNTRY_CODES,
  PURPOSE_CODES,
  type CountryCode,
} from '@/lib/cover-selection'
import type { CategoryDef } from '@/lib/categories'

type Props = {
  locale: string
  categories: readonly CategoryDef[]
  labels: {
    stepCountry: string
    stepCountryHint: string
    stepPurpose: string
    stepService: string
    countryRequired: string
    countries: Record<CountryCode, string>
    purposes: Record<string, string>
    categories: Record<string, string>
  }
}

/**
 * 표지의 세 단계(나라 → 목적 → 서비스)를 담는 클라이언트 컴포넌트.
 * 나라는 필수·중복 가능, 목적은 선택이다(docs/카테고리-항목구성.md 00절).
 * 서비스 카드는 여전히 클릭이 곧 이동이다 — [다음] 버튼을 만들지 않는다(G1, G2-7).
 * 다만 나라를 고르지 않은 채 클릭하면 이동 대신 안내만 보여준다(이 태스크에서 새로 추가된 전제조건).
 */
export function CoverSteps({ locale, categories, labels }: Props) {
  const [countries, setCountries] = useState<string[]>([])
  const [purpose, setPurpose] = useState<string | undefined>(undefined)
  const [showCountryPrompt, setShowCountryPrompt] = useState(false)

  function handleServiceClick(e: React.MouseEvent, slug: string) {
    if (canProceedToService(countries)) return // 정상 흐름 — Link가 그대로 이동한다
    e.preventDefault()
    setShowCountryPrompt(true)
  }

  return (
    <div>
      <section>
        <h2 style={{ fontSize: 'var(--fs-h2)' }}>{labels.stepCountry}</h2>
        <p style={{ color: 'var(--ink-500)', fontSize: 'var(--fs-caption)' }}>{labels.stepCountryHint}</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {COUNTRY_CODES.map((code) => (
            <label key={code} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={countries.includes(code)}
                onChange={() => {
                  setCountries((prev) => toggleValue(prev, code))
                  setShowCountryPrompt(false)
                }}
              />
              {labels.countries[code]}
            </label>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)' }}>{labels.stepPurpose}</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {PURPOSE_CODES.map((code) => (
            <label key={code} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="cover-purpose"
                checked={purpose === code}
                onChange={() => setPurpose(purpose === code ? undefined : code)}
              />
              {labels.purposes[code]}
            </label>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 'var(--fs-h2)' }}>{labels.stepService}</h2>

        {showCountryPrompt && (
          <p role="alert" style={{ color: 'var(--danger, #c00)', marginBottom: 12 }}>
            {labels.countryRequired}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {categories.map((c) => (
            // 클릭이 곧 이동이다. 확인 단계·[다음] 버튼을 만들지 않는다 (G1, G2-7) —
            // 나라 미선택 시에만 handleServiceClick이 이동을 막는다
            <Link
              key={c.slug}
              href={`/${locale}/order/${c.slug}?${buildCoverQuery(countries, purpose)}`}
              onClick={(e) => handleServiceClick(e, c.slug)}
              style={{
                display: 'block',
                padding: '24px 20px',
                border: '1px solid var(--line-strong)',
                borderRadius: 8,
                textDecoration: 'none',
                color: 'var(--ink-900)',
              }}
            >
              {labels.categories[c.slug]}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
