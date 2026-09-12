import type { CollectionConfig } from 'payload'
import { activeSessions } from '../lib/login-session'
import { canManageRoles, isAdminRole, isSuperRole, ROLES } from '../lib/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // Payload 내장 시도 제한. 직접 만들지 않는다
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000, // 10분
    // 기본 2시간(초). /api/users/login·refresh·Local API 로그인(비밀번호 변경 확인)은 모두 이 길이다.
    // "로그인 상태 유지"는 POST /api/auth/login 이 로그인 직후 그 세션과 토큰만 늘린다(src/lib/login-session.ts)
    tokenExpiration: 2 * 60 * 60,
    useSessions: true,
  },
  admin: { useAsTitle: 'email' },
  access: {
    // 가입은 누구나. role은 훅에서 강제로 customer가 된다
    create: () => true,
    // 본인 문서 또는 관리자만
    read: ({ req: { user } }) => {
      if (!user) return false
      if (isAdminRole(user.role)) return true
      return { id: { equals: user.id } }
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (isSuperRole(user.role)) return true
      return { id: { equals: user.id } }
    },
    // 삭제는 아무도 못 한다. 탈퇴는 deletedAt 소프트 삭제로 처리한다
    // (deletedAt 자체는 Server Action이 overrideAccess로 쓴다. 이유는 필드 access 주석 참고)
    delete: () => false,
    // Payload는 access에 명시하지 않은 키를 defaultAccess(= 로그인한 사용자면 누구나)로
    // 채운다(collections/config/defaults.js). unlock을 비워두면 /api/users/unlock이
    // 아무 고객 계정으로나 열려서, 5회 실패로 잠긴 관리자 계정을 무한히 풀 수 있다 —
    // maxLoginAttempts가 장식이 된다. PBKDF2 25,000라운드라는 약한 해싱을 보정하는
    // 유일한 축(시도 제한)이 통째로 사라지므로 super로 좁힌다.
    unlock: ({ req: { user } }) => isSuperRole(user?.role),
    // admin은 defaultAccess가 주입되지 않는 대신, 미지정이면 canAccessAdmin이
    // "config.admin.user 컬렉션이면 통과"로 판정한다. 이 프로젝트는 users가 곧
    // admin.user이므로 미지정 상태에서 Payload 관리자 UI를 마운트하는 순간
    // 모든 고객이 들어간다. 지금은 /admin 라우트를 만들지 않았지만, 나중에
    // 마운트하는 사람이 이 사실을 모를 것이므로 미리 관리자 role로 좁혀 둔다.
    admin: ({ req }) => isAdminRole(req.user?.role),
  },
  hooks: {
    // Payload JWT 전략은 토큰 sid 의 세션이 목록에 "있는지"만 보고 expiresAt 은 보지 않는다. 인증 때 사용자를
    // findByID 로 읽으므로 여기서 만료 세션을 빼면, 세션이 끝난 토큰은 인증되지 않는다(서버 강제 만료).
    // 저장값은 건드리지 않는다 — Payload 가 다음 로그인 때 만료 세션을 지운다
    afterRead: [
      ({ doc }) => {
        if (Array.isArray(doc?.sessions)) doc.sessions = activeSessions(doc.sessions)
        return doc
      },
    ],
    // 관리자 계정 로그인 시각·IP 기록(요구사항 1-16 규칙 5). 고객 로그인은 남기지 않는다.
    // 기록 실패가 로그인을 막으면 안 되므로 예외를 삼키고 서버 로그로만 남긴다
    afterLogin: [
      async ({ req, user }) => {
        if (!isAdminRole((user as { role?: unknown }).role)) return
        const forwarded = req.headers.get('x-forwarded-for')
        const ip = (forwarded ? forwarded.split(',')[0]?.trim() : null) || req.headers.get('x-real-ip') || null
        try {
          await req.payload.create({
            collection: 'admin-login-logs',
            data: {
              user: user.id,
              email: String((user as { email?: unknown }).email ?? ''),
              at: new Date().toISOString(),
              ip,
              userAgent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
            },
            overrideAccess: true,
            req,
          })
        } catch (err) {
          req.payload.logger.error({ err, msg: '관리자 로그인 기록 실패' })
        }
      },
    ],
    beforeValidate: [
      ({ data, operation, originalDoc, req }) => {
        if (!data) return data
        // req.context는 Local API 호출 코드(예: 시딩 스크립트)만 채울 수 있고
        // HTTP 요청 바디로는 절대 설정할 수 없다. 그래서 이 탈출구를 훅에 둬도
        // 클라이언트가 role을 스스로 올리는 경로는 생기지 않는다.
        if (req.context?.allowRoleAssignment) return data
        if (operation === 'create') {
          // 클라이언트가 role을 보내와도 무시한다
          return { ...data, role: 'customer' }
        }
        // 권한 없이 role 을 바꾸려 하면 원래 값으로 되돌린다. 필드를 빼 버리면(예전 방식) role 이
        // 필수라 검증에서 터진다 — 서버가 세션 없이 부르는 Local API 업데이트(정보 수정·비밀번호
        // 변경·탈퇴)가 Payload 가 합쳐 넣은 기존 role 때문에 전부 500 이 됐다
        if (operation === 'update' && 'role' in data && data.role !== originalDoc?.role && !canManageRoles(req.user?.role)) {
          return { ...data, role: originalDoc?.role }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'customer',
      options: ROLES.map((r) => ({ label: r, value: r })),
      access: {
        // 응답에는 나가지만 클라이언트가 쓰지는 못한다
        create: () => false,
        update: ({ req: { user } }) => canManageRoles(user?.role),
      },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'phone', type: 'text', required: true },
    { name: 'postalCode', type: 'text', required: true },
    { name: 'address1', type: 'text', required: true },
    { name: 'address2', type: 'text' },
    { name: 'businessNo', type: 'text' },
    // 가입 시 필수 동의 시각. 가입 경로(POST /api/signup)가 서버 시계로 overrideAccess 로만 쓴다 —
    // 클라이언트가 보낸 시각을 받으면 동의 기록이 근거가 못 된다
    { name: 'termsAgreedAt', type: 'date', access: { create: () => false, update: () => false } },
    { name: 'privacyAgreedAt', type: 'date', access: { create: () => false, update: () => false } },
    // 만 14세 이상 확인(필수)·광고성 정보 수신 동의(선택, 동의했을 때만 시각) — 위와 같이 가입 경로가 서버 시계로만 쓴다
    { name: 'ageConfirmedAt', type: 'date', access: { create: () => false, update: () => false } },
    { name: 'marketingAgreedAt', type: 'date', access: { create: () => false, update: () => false } },
    {
      name: 'deletedAt',
      type: 'date',
      // 고객이 직접 쓰게 하면 임의의 시각을 넣을 수 있다. 탈퇴는 회원이 요청하되
      // overrideAccess를 쓰는 Server Action이 서버에서 현재 시각으로 채운다
      access: { create: () => false, update: ({ req: { user } }) => isSuperRole(user?.role) },
    },
  ],
}
