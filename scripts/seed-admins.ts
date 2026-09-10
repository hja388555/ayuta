// 관리자 계정 시딩 스크립트. `pnpm seed:super`로 실행한다.
// role 상향은 Local API에 context: { allowRoleAssignment: true } 를 명시해야만 통과한다.
// 이 context는 HTTP 요청 바디로는 절대 설정할 수 없으므로, 여기서 쓰는 것은 안전하다.
import { getPayload } from 'payload'
import config from '../src/payload.config.js'

type SeedAccount = {
  role: 'manager' | 'super'
  emailEnv: string
  passwordEnv: string
}

const ACCOUNTS: SeedAccount[] = [
  { role: 'super', emailEnv: 'SEED_SUPER_EMAIL', passwordEnv: 'SEED_SUPER_PASSWORD' },
  { role: 'manager', emailEnv: 'SEED_MANAGER_EMAIL', passwordEnv: 'SEED_MANAGER_PASSWORD' },
]

/**
 * 이메일을 그대로 로그에 찍으면 CI 로그(공개 저장소면 누구나 볼 수 있다)에 관리자
 * 계정 주소가 남는다. 관리자 이메일은 로그인 아이디이자 잠금 해제·비밀번호 재설정의
 * 입력값이므로, 어떤 계정이 처리됐는지 확인할 수 있을 만큼만 남기고 가린다.
 */
const maskEmail = (email: string): string => {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const head = local.slice(0, 1)
  const domainTail = domain.slice(domain.lastIndexOf('.') + 1)
  return `${head}***@***.${domainTail}`
}

const main = async () => {
  const payload = await getPayload({ config })

  for (const account of ACCOUNTS) {
    const email = process.env[account.emailEnv]
    const password = process.env[account.passwordEnv]

    if (!email || !password) {
      console.error(`${account.emailEnv} / ${account.passwordEnv} 환경변수가 필요하다. 건너뛴다.`)
      continue
    }

    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs[0]) {
      await payload.update({
        collection: 'users',
        id: existing.docs[0].id,
        data: { role: account.role },
        overrideAccess: true,
        context: { allowRoleAssignment: true },
      })
      console.log(`갱신: ${maskEmail(email)} → role=${account.role}`)
      continue
    }

    await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        role: account.role,
        name: account.role === 'super' ? '최고관리자' : '중간관리자',
        phone: '000-0000-0000',
        postalCode: '00000',
        address1: '미입력',
      },
      overrideAccess: true,
      context: { allowRoleAssignment: true },
    })
    console.log(`생성: ${maskEmail(email)} → role=${account.role}`)
  }

  await payload.destroy()
}

// payload run은 import()가 끝나는 즉시 프로세스를 종료시킨다.
// top-level await로 main()이 끝날 때까지 모듈 평가 자체를 붙잡아 둔다
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
