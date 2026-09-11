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
    stepCountryHint: string
    stepPurpose: string
    stepService: string
    stepServiceHint: string
    countryRequired: string
    countries: Record<CountryCode, string>
    purposes: Record<string, string>
    categories: Record<string, string>
  }
}

/**
 * 표지의 세 단계(나라 → 목적 → 서비스). v2 디자인(큐 Q32, Figma [v2] 205:33 / 205:49 / 205:74):
 * 번호 단계 제목, 카드형 선택지(나라 2열·목적 3열, 모바일 1열), 서비스는 번호가 붙은 한 줄 이동 행.
 * 나라는 필수·중복 가능, 목적은 선택·하나만(다시 누르면 해제) — docs/카테고리-항목구성.md 00절.
 * 서비스 행은 클릭이 곧 이동이다 — [다음] 버튼을 만들지 않는다(G1, G2-7).
 * 나라를 고르지 않은 채 누르면 이동 대신 안내만 보여준다.
 */
export function CoverSteps({ locale, categories, labels }: Props) {
  const [countries, setCountries] = useState<string[]>([])
  const [purpose, setPurpose] = useState<string | undefined>(undefined)
  const [showCountryPrompt, setShowCountryPrompt] = useState(false)

  function handleServiceClick(e: React.MouseEvent) {
    if (canProceedToService(countries)) return // 정상 흐름 — Link가 그대로 이동한다
    e.preventDefault()
    setShowCountryPrompt(true)
  }

  return (
    <div style={{ display: 'grid', gap: 56 }}>
      <section>
        <StepTitle n={1} id="cover-country" title={labels.stepCountry} hint={labels.stepCountryHint} />
        <ChoiceGrid cols={2} labelledBy="cover-country">
          {COUNTRY_CODES.map((code) => (
            <ChoiceCard
              key={code}
              type="checkbox"
              checked={countries.includes(code)}
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
        <StepTitle n={2} id="cover-purpose" title={labels.stepPurpose} />
        <ChoiceGrid cols={3} labelledBy="cover-purpose">
          {PURPOSE_CODES.map((code) => (
            <ChoiceCard
              key={code}
              type="radio"
              name="cover-purpose"
              checked={purpose === code}
              onClick={() => setPurpose(purpose === code ? undefined : code)}
            >
              {labels.purposes[code]}
            </ChoiceCard>
          ))}
        </ChoiceGrid>
      </section>

      <section>
        <StepTitle n={3} id="cover-service" title={labels.stepService} hint={labels.stepServiceHint} />

        {showCountryPrompt && (
          <p role="alert" style={{ color: 'var(--danger-600)', fontWeight: 700, margin: '0 0 12px' }}>
            {labels.countryRequired}
          </p>
        )}

        <div style={{ display: 'grid', gap: 12 }} aria-labelledby="cover-service" role="list">
          {categories.map((c, i) => (
            // 클릭이 곧 이동이다. 확인 단계·[다음] 버튼을 만들지 않는다 (G1, G2-7) —
            // 나라 미선택 시에만 handleServiceClick이 이동을 막는다
            <Link
              key={c.slug}
              role="listitem"
              className="row-link"
              href={`/${locale}/order/${c.slug}?${buildCoverQuery(countries, purpose)}`}
              onClick={handleServiceClick}
            >
              {`${i + 1}. ${labels.categories[c.slug]}`}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
