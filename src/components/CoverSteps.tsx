'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toggleValue } from './TierForm'
import { ChoiceCard, ChoiceGrid, StepTitle } from './ui'
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
    stepPurpose: string
    stepService: string
    countryRequired: string
    countries: Record<CountryCode, string>
    countryNotes: Partial<Record<CountryCode, string>>
    purposes: Record<string, string>
    services: Record<string, string>
  }
}

/**
 * 표지의 세 단계(나라 → 목적 → 서비스). v3 손스케치 배치(Figma 301:112 모바일 / 301:22 PC):
 * 번호 없는 단계 제목, 카드형 선택지(나라·목적 모두 2열·모두 중복 선택), 서비스는 번호가 붙은 한 줄 이동 행.
 * 나라·목적 모두 필수 아님·중복 가능 — 나라가 비어 있을 때만 서비스 이동을 막는다.
 * 서비스 행은 클릭이 곧 이동이다 — [다음] 버튼을 만들지 않는다(G1, G2-7).
 */
export function CoverSteps({ locale, categories, labels }: Props) {
  const [countries, setCountries] = useState<string[]>([])
  const [purposes, setPurposes] = useState<string[]>([])
  const [showCountryPrompt, setShowCountryPrompt] = useState(false)

  function handleServiceClick(e: React.MouseEvent) {
    if (canProceedToService(countries)) return // 정상 흐름 — Link가 그대로 이동한다
    e.preventDefault()
    setShowCountryPrompt(true)
  }

  return (
    <div className="cover-steps">
      <section>
        <StepTitle id="cover-country" title={labels.stepCountry} />
        <ChoiceGrid cols={2} labelledBy="cover-country" className="country-grid">
          {COUNTRY_CODES.map((code) => (
            <ChoiceCard
              key={code}
              type="checkbox"
              checked={countries.includes(code)}
              sub={labels.countryNotes[code]}
              onChange={() => {
                setCountries((prev) => toggleValue(prev, code))
                setShowCountryPrompt(false)
              }}
            >
              {labels.countries[code]}
            </ChoiceCard>
          ))}
        </ChoiceGrid>
      </section>

      <section>
        <StepTitle id="cover-purpose" title={labels.stepPurpose} />
        <ChoiceGrid cols={2} labelledBy="cover-purpose">
          {PURPOSE_CODES.map((code) => (
            <ChoiceCard
              key={code}
              type="checkbox"
              checked={purposes.includes(code)}
              onChange={() => setPurposes((prev) => toggleValue(prev, code))}
            >
              {labels.purposes[code]}
            </ChoiceCard>
          ))}
        </ChoiceGrid>
      </section>

      <section>
        <StepTitle id="cover-service" title={labels.stepService} />

        {showCountryPrompt && (
          <p role="alert" style={{ color: 'var(--danger-600)', fontWeight: 700, margin: '0 0 12px' }}>
            {labels.countryRequired}
          </p>
        )}

        <div style={{ display: 'grid', gap: 12 }} aria-labelledby="cover-service" role="list">
          {categories.map((c) => (
            // 클릭이 곧 이동이다. 확인 단계·[다음] 버튼을 만들지 않는다 (G1, G2-7) —
            // 나라 미선택 시에만 handleServiceClick이 이동을 막는다
            <Link
              key={c.slug}
              role="listitem"
              className="row-link"
              href={`/${locale}/order/${c.slug}?${buildCoverQuery(countries, purposes)}`}
              onClick={handleServiceClick}
            >
              {labels.services[c.slug]}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
