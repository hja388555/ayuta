import { describe, expect, it } from 'vitest'
import { blocksToText, headingsOf, parseLegal } from './parse'
import { REFUND_KO_BODY } from './refund-policy'

const TERMS = `제1조 목적
본 약관은 아유타가 운영하는 사이트 및 관련 서비스 이용에 필요한 기본사항을 정하는 것을 목적으로 합니다.

제3조 사이트 이용
이용자는 사이트를 정상적인 목적으로 이용해야 하며, 불법행위, 허위정보 등록, 시스템 방해 등의 행위를
해서는 안 됩니다.

본인은 위 이용약관을 확인하였으며 이에 동의합니다.`

describe('parseLegal', () => {
  it('"제N조"와 "N." 줄을 번호 제목으로 나눈다', () => {
    const hs = headingsOf(parseLegal(`${TERMS}\n\n1. 개인정보의 처리 목적\n회사는…`))
    expect(hs.map((h) => [h.num, h.text, h.id])).toEqual([
      ['1', '제1조 목적', 'sec-1'],
      ['3', '제3조 사이트 이용', 'sec-3'],
      ['1', '1. 개인정보의 처리 목적', 'sec-1-2'],
    ])
  })

  it('문단 안의 줄바꿈을 그대로 둔다', () => {
    const p = parseLegal(TERMS).find((b) => b.type === 'paragraph' && b.text.includes('행위를'))
    expect(p && 'text' in p ? p.text : '').toBe('이용자는 사이트를 정상적인 목적으로 이용해야 하며, 불법행위, 허위정보 등록, 시스템 방해 등의 행위를\n해서는 안 됩니다.')
  })

  it('파이프 표를 행·칸으로 읽고 구분줄은 표 모양으로만 쓴다', () => {
    const t = parseLegal('| 경과일 | 공제율 |\n|---|---|\n| 0 (당일) | 10% |').find((b) => b.type === 'table')
    expect(t && t.type === 'table' ? t.rows : []).toEqual([
      ['경과일', '공제율'],
      ['0 (당일)', '10%'],
    ])
  })

  it('환불 정책의 [제목] 줄은 안내 상자, ※ 문단은 주의 문단이 된다', () => {
    const bs = parseLegal(REFUND_KO_BODY)
    expect(bs[0]).toMatchObject({ type: 'callout', title: '환불 안내' })
    expect(bs.some((b) => b.type === 'note' && b.text.startsWith('※ 이미 실제 광고비가'))).toBe(true)
    expect(headingsOf(bs)).toHaveLength(0)
  })

  it('한 글자도 잃지 않는다', () => {
    for (const body of [TERMS, REFUND_KO_BODY, '\n\n| a | b |\n|--|--|\n\n끝\n', '제1조\r\n본문']) {
      expect(blocksToText(parseLegal(body))).toBe(body.replace(/\r\n?/g, '\n'))
    }
  })
})
