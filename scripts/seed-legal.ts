// 이용약관 시드 스크립트(큐 Q25 2차). `pnpm seed:legal`로 실행한다.
// 원문 출처: 로컬 docs/법무문서-확정본.md A절(대표님 확정본) — 문구를 고치지 않고 그대로 옮긴다.
// 이미 행이 있으면 건너뛴다 — 관리자가 화면에서 고친 문구를 시드가 덮어쓰면 안 된다.
//
// 환불 및 취소 정책(ko)은 E절 원문(src/lib/legal/refund-policy.ts)을 넣는다.
// 일본어 이용약관·환불 정책은 초벌 번역(src/lib/legal/ja-drafts.ts, 2026-09-11 사용자 지시) — 검수 전.
//
// 개인정보처리방침(ko)은 대표님 원문이 없어 애니원컴퍼니 초안 v0.1(src/lib/legal/privacy-draft.ts)을 넣는다
// (2026-09-11 사용자 결정 "초안 그대로 게시"). 일본어판은 같은 날 초벌 번역(PRIVACY_JA_BODY) — 검수 전.
import { getPayload } from 'payload'
import config from '../src/payload.config.js'
import { REFUND_KO_BODY, REFUND_KO_TITLE } from '../src/lib/legal/refund-policy.js'
import { PRIVACY_JA_BODY, PRIVACY_JA_TITLE, PRIVACY_KO_BODY, PRIVACY_KO_TITLE } from '../src/lib/legal/privacy-draft.js'
import { REFUND_JA_BODY, REFUND_JA_TITLE, TERMS_JA_BODY, TERMS_JA_TITLE } from '../src/lib/legal/ja-drafts.js'

const TERMS_KO_BODY = `제1조 목적
본 약관은 아유타가 운영하는 사이트 및 관련 서비스 이용에 필요한 기본사항을 정하는 것을 목적으로 합니다.

제2조 이용자 정보
이용자는 서비스 신청 시 정확한 정보를 입력해야 하며, 타인의 정보를 무단으로 사용할 수 없습니다.

제3조 사이트 이용
이용자는 사이트를 정상적인 목적으로 이용해야 하며, 불법행위, 허위정보 등록, 시스템 방해 등의 행위를
해서는 안 됩니다.

제4조 서비스 운영
시스템 점검, 장애, 통신 문제 등 불가피한 사유가 발생한 경우 사이트의 일부 기능이 일시적으로
제한될 수 있습니다.

제5조 외부 서비스
외부 사이트 또는 플랫폼과 연결되는 서비스는 해당 서비스 제공자의 운영정책이 적용될 수 있습니다.

제6조 약관 적용
본 약관은 사이트에서 제공되는 모든 상품에 공통으로 적용되며, 상품별 구체적인 서비스 내용과
계약조건은 별도의 계약서에 따릅니다.

본인은 위 이용약관을 확인하였으며 이에 동의합니다.`

type Kind = 'terms' | 'privacy' | 'refund'
const DOCS: Array<{ kind: Kind; locale: 'ko' | 'ja'; name: string; title: string; body: string }> = [
  { kind: 'terms', locale: 'ko', name: '이용약관(ko)', title: '이용약관', body: TERMS_KO_BODY },
  { kind: 'refund', locale: 'ko', name: '환불 및 취소 정책(ko)', title: REFUND_KO_TITLE, body: REFUND_KO_BODY },
  { kind: 'privacy', locale: 'ko', name: '개인정보 처리방침(ko, 초안 v0.1)', title: PRIVACY_KO_TITLE, body: PRIVACY_KO_BODY },
  { kind: 'privacy', locale: 'ja', name: '개인정보 처리방침(ja, 초벌 번역)', title: PRIVACY_JA_TITLE, body: PRIVACY_JA_BODY },
  { kind: 'terms', locale: 'ja', name: '이용약관(ja, 초벌 번역)', title: TERMS_JA_TITLE, body: TERMS_JA_BODY },
  { kind: 'refund', locale: 'ja', name: '환불 및 취소 정책(ja, 초벌 번역)', title: REFUND_JA_TITLE, body: REFUND_JA_BODY },
]

const main = async () => {
  const payload = await getPayload({ config })
  for (const d of DOCS) {
    const { docs } = await payload.find({
      collection: 'legal-documents',
      where: { and: [{ kind: { equals: d.kind } }, { locale: { equals: d.locale } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (docs[0]) {
      console.log(`${d.name} 이미 있음 — 건너뜀`)
      continue
    }
    await payload.create({ collection: 'legal-documents', data: { kind: d.kind, locale: d.locale, title: d.title, body: d.body }, overrideAccess: true })
    console.log(`${d.name} 생성`)
  }
  await payload.destroy()
}

// payload run은 import()가 끝나는 즉시 프로세스를 종료시킨다 — top-level await 로 붙잡아 둔다
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
