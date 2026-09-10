// Task 2의 role 상승 방어(beforeValidate 훅 + access rule)가 실제 실행 중인
// 서버·DB 앞에서 동작하는지 확인한다. 단위 테스트로는 Payload 훅이 검증되지 않는다.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, login } from './helpers/server.js'
import { localPayload } from './helpers/localApi.js'

// 재실행 시 이메일 충돌로 실패하지 않도록 매 실행마다 고유한 이메일을 쓴다
const RUN = Date.now()
const CUST = { email: `cust+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026' }
const LOCAL_SUPER = { email: `localsuper+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026' }
// /manage 경계 전용 계정들. 위 CUST는 마지막 테스트에서 잠기므로 재사용할 수 없다
const MANAGE_CUST = { email: `mgcust+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026' }
const MANAGE_ADMIN = { email: `mgadmin+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026' }
const MANAGER = { email: `mgr+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026' }

const base = { name: '홍길동', phone: '010-0000-0000', postalCode: '00000', address1: '서울시' }

// 이번 실행에서 만든 행의 id를 모아뒀다가 afterAll에서 Local API로 지운다.
// docker exec 같은 외부 프로세스에 의존하지 않으므로 컨테이너 이름이 달라지거나
// docker가 없는 환경(CI 등)에서도 그대로 동작한다.
const createdIds: number[] = []
const trackId = (id: number) => {
  createdIds.push(id)
  return id
}

beforeAll(async () => {
  // super 로그인이 필요한 테스트(9번)를 위한 계정. Local API로 직접 만들되
  // context.allowRoleAssignment를 명시해야만 role이 super로 저장된다 — 이 부분
  // 자체가 이미 line 39의 존재를 전제로 한 픽스처 준비이고, line 39 자체를
  // pin하는 assert는 별도 테스트(2번)에서 한다.
  const payload = await localPayload()
  const created = await payload.create({
    collection: 'users',
    data: { ...LOCAL_SUPER, ...base, role: 'super' },
    overrideAccess: true,
    context: { allowRoleAssignment: true },
  })
  trackId(created.id as number)
})

afterAll(async () => {
  const payload = await localPayload()
  const errors: string[] = []
  for (const id of createdIds) {
    try {
      await payload.delete({ collection: 'users', id, overrideAccess: true })
    } catch (err) {
      errors.push(`id=${id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  // 정리 실패를 조용히 삼키면 "두 번 연속 실행해도 통과한다"는 성질이
  // 아무 경고 없이 깨진다. 실패가 있으면 반드시 테스트 실행 자체를 실패시킨다.
  if (errors.length > 0) {
    throw new Error(`테스트 데이터 정리 실패:\n${errors.join('\n')}`)
  }
})

describe('권한 상승 차단', () => {
  it('가입 시 role을 super로 보내도 customer가 된다', async () => {
    // pin: src/collections/Users.ts field `role`의 create access(() => false) +
    // beforeValidate 훅의 `if (operation === 'create') return { ...data, role: 'customer' }`.
    // 둘 중 하나만 지워도 이 assert는 깨진다.
    const res = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ ...CUST, ...base, role: 'super' }),
    })
    expect([200, 201]).toContain(res.status)
    const created = await res.json()
    expect(created.doc.role).toBe('customer')
    trackId(created.doc.id)
  })

  it('Local API로 context.allowRoleAssignment를 주면 role이 실제로 super가 된다', async () => {
    // pin: src/collections/Users.ts:39 `if (req.context?.allowRoleAssignment) return data`
    // 이 줄을 지우면 beforeValidate가 무조건 operation === 'create' 분기로 떨어져
    // role이 customer로 강제되므로, 아래 assert가 실패로 뒤집힌다.
    const payload = await localPayload()
    const created = await payload.create({
      collection: 'users',
      data: { email: `localpin-yes+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026', ...base, role: 'super' },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    expect(created.role).toBe('super')
    trackId(created.id as number)
  })

  it('Local API라도 context 없이 만들면 role은 customer로 강제된다', async () => {
    // pin: beforeValidate 훅의 `if (operation === 'create') return { ...data, role: 'customer' }`.
    // overrideAccess: true로 field-level access(create: () => false)를 우회했는데도
    // role이 customer라면, 이 강제는 access rule이 아니라 훅 자체가 하고 있다는 뜻이다.
    // 이 분기를 지우면 role이 super로 그대로 저장되어 assert가 깨진다.
    const payload = await localPayload()
    const created = await payload.create({
      collection: 'users',
      data: { email: `localpin-no+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026', ...base, role: 'super' },
      overrideAccess: true,
    })
    expect(created.role).toBe('customer')
    trackId(created.id as number)
  })

  it('가입 요청 바디에 context/req 키를 흉내내도 role은 customer로 강제된다 (회귀 방지용)', async () => {
    // 이 테스트는 line 39를 직접 pin하지 않는다. HTTP 바디의 context/req 키는애초에
    // req.context에 닿지 않으므로(Payload가 req.context를 서버에서 항상 {}로
    // 초기화하고, HTTP 파서가 바디의 이 키들을 req.context에 매핑하지 않는다) line 39를
    // 지워도 이 테스트는 계속 통과한다. 대신 role의 field-level create access
    // (() => false)를 pin한다 — 그것도 지우면 role이 super로 새어나가 실패한다.
    // "미래에 누군가 context를 클라이언트에서 접근 가능하게 바꾸면 걸린다"는
    // 회귀 방지 목적으로만 남겨둔다.
    const res = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        email: `escape+${RUN}@ayuta.test`,
        password: 'Ayuta!Test-2026',
        ...base,
        role: 'super',
        context: { allowRoleAssignment: true },
        req: { context: { allowRoleAssignment: true } },
      }),
    })
    expect([200, 201]).toContain(res.status)
    const created = await res.json()
    expect(created.doc.role).toBe('customer')
    trackId(created.doc.id)
  })

  it('본인이 자기 role을 올릴 수 없다', async () => {
    // pin: role 필드의 update access(super만 허용) + 훅의
    // `if (operation === 'update' && 'role' in data && !canManageRoles(...))` 분기.
    const { token } = await login(CUST.email, CUST.password)
    expect(token).toBeTruthy()
    const me = await (await api('/api/users/me', { headers: { Authorization: `JWT ${token}` } })).json()

    await api(`/api/users/${me.user.id}`, {
      method: 'PATCH',
      headers: { Authorization: `JWT ${token}` },
      body: JSON.stringify({ role: 'super' }),
    })

    const after = await (await api('/api/users/me', { headers: { Authorization: `JWT ${token}` } })).json()
    expect(after.user.role).toBe('customer')
  })

  it('다른 사용자 문서를 조회할 수 없다', async () => {
    // pin: access.read의 own-document-only 필터. 목록 조회뿐 아니라
    // id를 직접 아는 상태에서의 단건 조회도 막혀야 한다.
    const otherRes = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: `other+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026', ...base }),
    })
    const other = await otherRes.json()
    trackId(other.doc.id)

    const { token } = await login(CUST.email, CUST.password)

    const list = await (await api('/api/users', { headers: { Authorization: `JWT ${token}` } })).json()
    expect(list.totalDocs).toBe(1)

    const directRes = await api(`/api/users/${other.doc.id}`, {
      headers: { Authorization: `JWT ${token}` },
    })
    expect([403, 404]).toContain(directRes.status)
    const directBody = await directRes.json()
    expect(directBody.email).not.toBe(`other+${RUN}@ayuta.test`)
  })

  it('삭제는 누구도 할 수 없다', async () => {
    // pin: access.delete(() => false)
    const { token } = await login(CUST.email, CUST.password)
    const me = await (await api('/api/users/me', { headers: { Authorization: `JWT ${token}` } })).json()
    const res = await api(`/api/users/${me.user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `JWT ${token}` },
    })
    expect(res.status).toBe(403)
  })

  it('로그인 5회 실패 후 잠긴다', async () => {
    // pin: Users.ts auth.maxLoginAttempts(5) / auth.lockTime — CUST는 이 테스트 이후
    // 잠긴 상태로 남으므로 이 파일에서 마지막에 CUST를 쓰는 테스트여야 한다.
    for (let i = 0; i < 5; i++) await login(CUST.email, 'wrong-password')
    const locked = await login(CUST.email, CUST.password)
    expect(locked.status).toBe(401)
  })

  it('super는 다른 사용자의 role을 실제로 바꿀 수 있고, 바뀐 값이 재조회에서도 유지된다', async () => {
    // pin: role 필드의 update access `({ req: { user } }) => canManageRoles(user?.role)`가
    // super에게는 true를 반환하는 분기, 그리고 훅의 update 분기에서
    // `canManageRoles(req.user?.role)`가 true면 data를 그대로 통과시키는 부분.
    // access를 super까지 막아버리거나 훅이 무조건 role을 지워버리면 이 assert가 깨진다.
    const targetRes = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: `target+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026', ...base }),
    })
    const target = await targetRes.json()
    trackId(target.doc.id)

    const { token } = await login(LOCAL_SUPER.email, LOCAL_SUPER.password)
    expect(token).toBeTruthy()

    const patchRes = await api(`/api/users/${target.doc.id}`, {
      method: 'PATCH',
      headers: { Authorization: `JWT ${token}` },
      body: JSON.stringify({ role: 'manager' }),
    })
    expect(patchRes.status).toBe(200)

    const reread = await (
      await api(`/api/users/${target.doc.id}`, { headers: { Authorization: `JWT ${token}` } })
    ).json()
    expect(reread.role).toBe('manager')
  })
})


// /manage는 고객↔관리자 경계 그 자체다. 이 경계는 Payload access rule이 아니라
// dal.ts의 게이트 + 레이아웃이 지키므로, users REST 테스트로는 전혀 pin되지 않는다.
// (이 describe가 없으면 manage/(gated)/layout.tsx를 통째로 지워도 전 테스트가 통과한다)
describe('/manage 관리자 경계', () => {
  // redirect: 'manual' — 게이트가 redirect 로 바뀌어도 200/404 와 섞이지 않게 fetch 가
  // 리다이렉트를 따라가지 않게 한다
  const getManage = (token?: string) =>
    api('/manage', {
      redirect: 'manual',
      headers: token ? { Authorization: `JWT ${token}` } : {},
    })

  let adminId: number

  beforeAll(async () => {
    const payload = await localPayload()

    const admin = await payload.create({
      collection: 'users',
      data: { ...MANAGE_ADMIN, ...base, role: 'super' },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    adminId = admin.id as number
    trackId(adminId)

    const manager = await payload.create({
      collection: 'users',
      data: { ...MANAGER, ...base, role: 'manager' },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    trackId(manager.id as number)

    const cust = await payload.create({
      collection: 'users',
      // role은 필수 필드라 타입상 명시해야 한다. 훅이 어차피 customer로 강제한다
      data: { ...MANAGE_CUST, ...base, role: 'customer' },
      overrideAccess: true,
    })
    trackId(cust.id as number)

  })

  it('비로그인은 /manage에서 404를 받는다 (존재 자체를 감춘다)', async () => {
    // pin: manage/(gated)/layout.tsx의 `if (err instanceof AuthError) notFound()`
    const res = await getManage()
    expect(res.status).toBe(404)
  })

  it('로그인한 고객은 /manage에서 404를 받는다', async () => {
    // pin: requireAdmin()의 isAdminRole 검사 + 레이아웃의 notFound().
    // 게이트를 지우면 200이 돌아와 이 assert가 깨진다 — 즉 고객이 관리자 화면을 본다.
    const { token } = await login(MANAGE_CUST.email, MANAGE_CUST.password)
    expect(token).toBeTruthy()
    const res = await getManage(token)
    expect(res.status).toBe(404)
  })

  it('관리자는 /manage에서 200을 받는다', async () => {
    // pin: requireAdmin()이 관리자 role 을 실제로 통과시키는 경로.
    // 이 케이스가 없으면 "게이트가 아무도 통과시키지 않는" 상태를 눈치채지 못한다.
    const { token } = await login(MANAGE_ADMIN.email, MANAGE_ADMIN.password)
    expect(token).toBeTruthy()
    const res = await getManage(token)
    expect(res.status).toBe(200)
  })

  it('deletedAt이 찍힌 관리자는 세션이 살아 있어도 /manage에 못 들어간다', async () => {
    // pin: dal.ts getSessionUser()의 `if (user.deletedAt) return null`.
    // 이 줄을 지우면 위 테스트와 같은 토큰으로 200이 돌아와 assert가 깨진다.
    // Payload의 로그인 경로는 deletedAt을 모르므로 강제는 오직 여기서만 일어난다.
    const { token } = await login(MANAGE_ADMIN.email, MANAGE_ADMIN.password)
    expect(token).toBeTruthy()

    const payload = await localPayload()
    await payload.update({
      collection: 'users',
      id: adminId,
      data: { deletedAt: new Date().toISOString() },
      overrideAccess: true,
      // beforeValidate 훅이 update에서 role 키를 통째로 떨궈 required 검증이 깨진다
      // (Local API 호출에는 req.user가 없어 canManageRoles가 false다).
      // 이 픽스처는 deletedAt만 바꾸려는 것이므로 훅의 탈출구를 명시해 통과시킨다.
      context: { allowRoleAssignment: true },
    })

    const res = await getManage(token)
    expect(res.status).toBe(404)
  })

  it('manager는 다른 사용자의 role을 바꾸지 못한다', async () => {
    // super-성공 경로만 있고 manager-실패 경로가 없으면 canManageRoles가
    // isAdminRole로 바뀌어도(= manager에게 role 변경 권한이 새어도) 아무도 모른다.
    // pin: roles.ts canManageRoles = isSuperRole + Users.ts update access의 super 한정.
    const targetRes = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: `mgrtarget+${RUN}@ayuta.test`, password: 'Ayuta!Test-2026', ...base }),
    })
    const target = await targetRes.json()
    trackId(target.doc.id)

    const { token } = await login(MANAGER.email, MANAGER.password)
    expect(token).toBeTruthy()

    await api(`/api/users/${target.doc.id}`, {
      method: 'PATCH',
      headers: { Authorization: `JWT ${token}` },
      body: JSON.stringify({ role: 'super' }),
    })

    // manager도 read access는 있으므로 본인 토큰으로 재조회해 값이 그대로인지 본다
    const reread = await (
      await api(`/api/users/${target.doc.id}`, { headers: { Authorization: `JWT ${token}` } })
    ).json()
    expect(reread.role).toBe('customer')
  })
})
