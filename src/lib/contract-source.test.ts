// 계약서 템플릿 본문(scripts/seed-contracts.ts) ↔ 고객 전달 원문(docs/contracts/ko/*.txt) 대조.
//
// scripts/seed-contracts.ts 는 모듈 최상단에서 `await main()`을 실행해 실제 DB(payload)에
// 접속한다 — import 하면 테스트가 DB 부작용을 그대로 겪는다(연결 실패/행 등). 그래서 body
// 상수를 import 하지 않고, 파일을 텍스트로 읽어 `const CONTRACT_N_KO = \`...\`` 템플릿
// 리터럴을 정규식으로 뽑는다. 본문에는 백틱이나 `${'${'}...}` 보간이 없어(직접 확인함)
// 정규식 파싱으로도 값이 깨지지 않는다.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

function extractSeedBody(category: number): string {
  const source = readFileSync(join(REPO_ROOT, 'scripts/seed-contracts.ts'), 'utf8')
  const re = new RegExp(`const CONTRACT_${category}_KO = \`([\\s\\S]*?)\`\\n`)
  const m = re.exec(source)
  if (!m) throw new Error(`scripts/seed-contracts.ts 에서 CONTRACT_${category}_KO 를 찾지 못했다`)
  return m[1]!
}

// 2번 원문 파일 맨 끝 한 줄은 계약서 본문이 아니라 결제 화면 버튼 문구가 그대로 섞여
// 들어간 것이다. 계약서 본문에는 넣지 않으므로 대조 대상에서 이 한 줄만 제외한다(다른
// 줄은 건드리지 않는다).
const CATEGORY_2_BUTTON_LABEL_LINE = '[ 계약내용에 동의하고 결제하기 ]'

function readOriginal(category: number): string {
  // 일부 원문 파일은 UTF-8 BOM(U+FEFF)으로 시작한다 — 저장 시 에디터가 붙인 인코딩
  // 표식일 뿐 계약 내용이 아니므로 벗겨내고 비교한다.
  let text = readFileSync(join(REPO_ROOT, `docs/contracts/ko/${category}.txt`), 'utf8').replace(/^﻿/, '')
  if (category === 2) {
    text = text.replace(new RegExp(`\\n${CATEGORY_2_BUTTON_LABEL_LINE.replace(/[[\]]/g, '\\$&')}$`), '')
  }
  return text
}

// ── 정규화 규칙 ──
//
// | 코드 쪽                                                  | 원문 쪽                          |
// |-----------------------------------------------------------|-----------------------------------|
// | {{companyCeo}} / {{companyAddress}} / {{companyEmail}}    | 원문에 박힌 고정값(대표자명·주소·이메일) — 빈칸으로 지워서 비교 |
// | {{buyerName}} {{buyerRepresentative}} {{buyerPhone}}      | 원문의 빈칸(공백/줄끝)             |
// | {{buyerEmail}} {{signature}} {{contractDate}}              | 원문의 빈칸(공백·전각공백·"년 월 일" 패턴) |
//
// 비교 대상에서 위 placeholder 들은 실제로 어떤 값이 들어가든 상관없는 "빈칸"이므로, 코드
// 쪽은 {{...}}를 지우고 원문 쪽은 그 자리에 해당하는 고정값/빈칸을 지워서 둘 다 "라벨 : "
// 골격만 남긴 뒤 비교한다 — 값 자체가 아니라 골격(라벨·구두점·정적 문장)이 같은지 본다.
// 이렇게 하면 실제 값을 하드코딩하지 않고도(값이 훗날 바뀌어도 안 깨지게) 정적 텍스트가
// 어긋나면 반드시 실패한다.
const COMPANY_CEO = '황지원'
const COMPANY_ADDRESS = '서울시 동대문구 답십리동'
const COMPANY_EMAIL = 'gggwon123@gmail.com'

const ERASED_PLACEHOLDERS = [
  'companyCeo',
  'companyAddress',
  'companyEmail',
  'buyerName',
  'buyerRepresentative',
  'buyerPhone',
  'buyerEmail',
  'signature',
  'contractDate',
] as const

function eraseCodePlaceholders(text: string): string {
  let out = text
  for (const key of ERASED_PLACEHOLDERS) out = out.split(`{{${key}}}`).join('')
  return out
}

function eraseOriginalBlanks(text: string): string {
  let out = text
  // 회사 고정값(대표자/서명에 두 번 나온다) 지우기
  out = out.split(COMPANY_CEO).join('')
  out = out.split(COMPANY_ADDRESS).join('')
  out = out.split(COMPANY_EMAIL).join('')
  // "계약일 :        년      월      일 " 같은 날짜 빈칸 → "계약일 : "
  out = out.replace(/:[ 　]*년[ 　]*월[ 　]*일[ 　]*$/gm, ': ')
  // 라벨 뒤에 남은 공백만 있는 빈칸(고객명·연락처·서명 등) → 콜론 뒤 공백 하나로
  out = out.replace(/:[ 　]*$/gm, ': ')
  // 서명 칸이 다음 줄로 이어지며 남긴, 라벨 없이 공백(전각 포함)만 있는 줄은 그 빈칸의
  // 연장이므로 제거한다(예: 4번 원문 "고객 서명 : 　　" 다음 줄의 "　　　　　　　").
  out = out
    .split('\n')
    .filter((line) => !/^[ 　]+$/.test(line))
    .join('\n')
  return out
}

// ── 제외 구간 ──
//
// 제10조 본문이 끝나는 지점("...성립합니다.")부터, 「서비스 제공자」 블록이 시작하는 지점
// 직전까지("선택 상품 내용" 헤더 + 구분선 + 항목 줄 + 총 계약금액 줄)는 이 테스트에서
// 제외한다. 이유(1:1 대응이 아니다):
//   - 구분선(────)은 코드에만 있다. 원문에는 없다.
//   - 항목 줄 개수·라벨 정렬이 카테고리마다 다르고, 2~4번은 원문의 여러 줄(2번 4줄,
//     3번 4줄, 4번 10줄)이 코드에서 {{items}} 한 자리로 병합된다(주문마다 선택 항목
//     개수가 달라 고정 줄로 담을 수 없다 — scripts/seed-contracts.ts 상단 주석 참고).
//   - 1번은 개별 플레이스홀더({{country}} 등)를 쓰지만 원문은 라벨 뒤 공백이 없고(예:
//     "광고 국가 :") 코드는 표를 맞추려 라벨을 공백으로 패딩한다("광고 국가      :") —
//     항목 정렬용 패딩은 계약 내용이 아니라 표시 형식이라 이 테스트의 대상이 아니다.
// 이 구간 밖(제목·조문 1~10조 전체, 서비스 제공자/고객 정보/서명/계약일/체크박스 블록)은
// 글자 하나만 달라도 실패해야 한다.
const ARTICLES_END_ANCHOR = '성립합니다.'
const FOOTER_START_ANCHOR: Record<number, string> = {
  1: '서비스 제공자',
  2: '[서비스 제공자]',
  3: '[서비스 제공자]',
  4: '[서비스 제공자]',
}

function splitAroundExcludedRegion(text: string, category: number): { head: string; footer: string } {
  const endIdx = text.indexOf(ARTICLES_END_ANCHOR)
  if (endIdx < 0) throw new Error('"성립합니다." 앵커를 찾지 못했다')
  const head = text.slice(0, endIdx + ARTICLES_END_ANCHOR.length)

  const anchor = FOOTER_START_ANCHOR[category]!
  const footerIdx = text.indexOf(anchor, endIdx)
  if (footerIdx < 0) throw new Error(`"${anchor}" 앵커를 찾지 못했다`)
  const footer = text.slice(footerIdx)

  return { head, footer }
}

describe.each([1, 2, 3, 4])('카테고리 %i 계약서 본문 대조', (category) => {
  it('제목~제10조 본문은 원문과 글자 하나까지 같다', () => {
    const code = splitAroundExcludedRegion(extractSeedBody(category), category).head
    const original = splitAroundExcludedRegion(readOriginal(category), category).head
    expect(code).toBe(original)
  })

  it('서비스 제공자 블록부터 끝까지, 빈칸을 지우면 원문과 골격이 같다', () => {
    const code = eraseCodePlaceholders(splitAroundExcludedRegion(extractSeedBody(category), category).footer)
    const original = eraseOriginalBlanks(splitAroundExcludedRegion(readOriginal(category), category).footer)
    expect(code.split('\n')).toEqual(original.split('\n'))
  })
})
