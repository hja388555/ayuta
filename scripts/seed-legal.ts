// 이용약관 시드 스크립트(큐 Q25 2차). `pnpm seed:legal`로 실행한다.
// 원문 출처: 로컬 docs/법무문서-확정본.md A절(대표님 확정본) — 문구를 고치지 않고 그대로 옮긴다.
// 이미 행이 있으면 건너뛴다 — 관리자가 화면에서 고친 문구를 시드가 덮어쓰면 안 된다.
//
// 환불 및 취소 정책(ko)은 E절 원문(src/lib/legal/refund-policy.ts)을 넣는다. 일본어판은 아직 없다.
//
// 개인정보처리방침과 일본어 이용약관은 원문을 아직 받지 못했다. 시드하지 않는다 —
// 공개 화면은 "준비 중"을 보이고, 받으면 관리자 화면(/manage/legal)에서 넣는다.
import { getPayload } from 'payload'
import config from '../src/payload.config.js'
import { REFUND_KO_BODY, REFUND_KO_TITLE } from '../src/lib/legal/refund-policy.js'

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

const main = async () => {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'legal-documents',
    where: { and: [{ kind: { equals: 'terms' } }, { locale: { equals: 'ko' } }] },
    limit: 1,
    overrideAccess: true,
  })
  if (docs[0]) {
    console.log('이용약관(ko) 이미 있음 — 건너뜀')
  } else {
    await payload.create({ collection: 'legal-documents', data: { kind: 'terms', locale: 'ko', title: '이용약관', body: TERMS_KO_BODY }, overrideAccess: true })
    console.log('이용약관(ko) 생성')
  }
  const refund = await payload.find({
    collection: 'legal-documents',
    where: { and: [{ kind: { equals: 'refund' } }, { locale: { equals: 'ko' } }] },
    limit: 1,
    overrideAccess: true,
  })
  if (refund.docs[0]) {
    console.log('환불 및 취소 정책(ko) 이미 있음 — 건너뜀')
  } else {
    await payload.create({ collection: 'legal-documents', data: { kind: 'refund', locale: 'ko', title: REFUND_KO_TITLE, body: REFUND_KO_BODY }, overrideAccess: true })
    console.log('환불 및 취소 정책(ko) 생성')
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
