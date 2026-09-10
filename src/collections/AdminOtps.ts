import type { CollectionConfig } from 'payload'

/**
 * 관리자 2단계 인증 코드 저장소.
 * 외부에서 읽거나 쓸 일이 전혀 없다. REST를 통째로 막고 서버 코드에서 Local API로만 쓴다.
 *
 * ⚠ src/lib/dal.ts의 verifyAndConsumeAdminOtp가 이 컬렉션을 raw SQL로 직접 갱신한다.
 *   거기에는 테이블명 `admin_otps`와 컬럼명 `attempts` · `consumed_at`이 문자열로
 *   하드코딩돼 있다(원자적 UPDATE ... RETURNING이 필요해서 Local API를 쓰지 않는다).
 *   따라서 아래 slug나 attempts/consumedAt 필드명을 바꾸면 타입체크는 그대로 통과하고
 *   런타임에서야 깨진다 — 즉 2단계 인증이 조용히 무너진다.
 *   이름을 바꾸려면 dal.ts의 SQL 문자열을 반드시 함께 고치고 통합 테스트로 확인할 것.
 */
export const AdminOtps: CollectionConfig = {
  slug: 'admin-otps',
  access: {
    create: () => false, // 발급은 서버 코드가 overrideAccess로만 한다
    read: () => false, // 코드/해시가 외부에 노출되면 2단계 인증 자체가 무력화된다
    update: () => false, // 소비(consumedAt) · 시도 횟수 증가도 overrideAccess 서버 코드 전용
    delete: () => false, // 삭제도 외부에서 허용할 이유가 없다
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'hash', type: 'text', required: true },
    { name: 'salt', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'consumedAt', type: 'date' },
    { name: 'attempts', type: 'number', required: true, defaultValue: 0 },
  ],
}
