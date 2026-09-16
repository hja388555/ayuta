import { describe, expect, it } from 'vitest'
import { consentSnapshot } from './consent-snapshot'

describe('동의 스냅샷', () => {
  it('화면에 보여준 문구 그대로, 체크 결과와 함께 남긴다', () => {
    const defs = [
      { key: 'terms', label: '서비스 이용 약관에 동의합니다.', required: true },
      { key: 'agree', label: '위 계약 내용을 모두 확인하였으며 이에 동의합니다.', required: true },
    ]
    expect(consentSnapshot(defs, { terms: true, agree: true })).toEqual([
      { key: 'terms', label: '서비스 이용 약관에 동의합니다.', required: true, agreed: true },
      { key: 'agree', label: '위 계약 내용을 모두 확인하였으며 이에 동의합니다.', required: true, agreed: true },
    ])
  })

  it('정의에 없는 키는 버린다', () => {
    // 클라이언트가 보낸 맵은 임의의 키를 담을 수 있다
    expect(consentSnapshot([{ key: 'terms', label: 'a', required: true }], { terms: true, hack: true })).toHaveLength(1)
  })

  it('체크하지 않은 선택 항목도 남긴다 — 무엇을 안 골랐는지가 근거다', () => {
    const defs = [{ key: 'marketing', label: '마케팅 수신에 동의합니다.', required: false }]
    expect(consentSnapshot(defs, {})).toEqual([
      { key: 'marketing', label: '마케팅 수신에 동의합니다.', required: false, agreed: false },
    ])
  })

  it('정의 순서를 그대로 지킨다 — 화면에 보인 차례가 곧 근거다', () => {
    const defs = [
      { key: 'terms', label: '약관', required: true },
      { key: 'privacy', label: '개인정보', required: true },
      { key: 'agree', label: '계약', required: true },
    ]
    expect(consentSnapshot(defs, { agree: true }).map((r) => r.key)).toEqual(['terms', 'privacy', 'agree'])
  })
})
