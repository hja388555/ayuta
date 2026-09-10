# AYUTA — 광고 견적 · 주문 사이트

AYUTA 광고 서비스의 견적 계산부터 계약·결제까지를 한 흐름으로 처리하는 사이트.
한국어·일본어 두 언어를 지원한다.

---

## 빠른 시작

```bash
# Node 22 필요 (Vercel 런타임과 맞춘다)
node -v            # v22.x

pnpm install
cp .env.example .env
# .env 의 PAYLOAD_SECRET 를 채운다:  openssl rand -base64 32

pnpm db:up         # 로컬 Postgres (Docker, 포트 55432)
pnpm dev           # http://localhost:3000
```

관리자는 `/admin`. 최초 1회 계정 생성 화면이 뜬다.

```bash
pnpm test          # 견적 엔진 단위 테스트
pnpm build         # 프로덕션 빌드
pnpm typecheck
```

> `next start`(프로덕션)는 스키마를 자동으로 만들지 않는다.
> 배포 전에 `pnpm migrate` 를 반드시 돌린다. 안 하면 `relation "admins" does not exist` 로 로그인이 전부 실패한다.

---

## 구조

```
ayuta/
├─ src/
│  ├─ payload.config.ts
│  ├─ collections/            admins · customers · (이후 orders · price-entries …)
│  └─ app/
│     ├─ (frontend)/          고객 화면
│     └─ (payload)/           Payload 관리자 · REST · GraphQL
├─ packages/pricing/          견적 엔진. 순수 TS, react·next·payload import 금지
└─ reference/logo/            로고 원본
```

---

## 스택

| 영역 | 선택 | 버전 |
|---|---|---|
| 프레임워크 | Next.js (App Router) | 16.3.4 |
| CMS · 관리자 | Payload | 3.88.0 |
| DB | PostgreSQL | 16 (로컬 Docker / 운영 Supabase 서울) |
| 런타임 | Node | 22.x |
| 검증 | Zod | 3.24 |
| 테스트 | Vitest | 2.1 |

**버전을 캐럿 없이 고정한다.** Payload 3.88 의 peer 범위가 `next >=16.2.6 <17` 이고
`15.5 ~ 16.1.x` 는 지원하지 않는다. 올릴 때는 이 범위를 먼저 확인한다.

**pnpm 11 주의** — 빌드 승인 설정은 `package.json` 이 아니라 `pnpm-workspace.yaml` 의 `allowBuilds` 에 쓴다.
빠뜨리면 sharp 가 빌드되지 않아 이미지 처리 전체가 죽는다.

---

## 확정된 제품 규칙

- 광고 서비스는 **5개 중 1개만** 선택. 클릭하면 바로 해당 폼으로 이동
- 1번 등급은 **중복 선택 가능**하고 금액을 **합산**한다. 플랫폼은 금액에 영향 없음
- **비회원도 결제한다.** 로그인을 강제하지 않는다
- 결제는 전용 페이지 4단계 — 주문자 정보 → 주문 내역 → 계약서 동의 → 결제
- 전자서명은 **동의 체크 시 주문자명 자동 기입**. 사인 입력 없음
- 계약서 전문과 환불 신청 금액은 **스냅샷으로 값 복사**한다. 단가를 고쳐도 과거 주문은 변하지 않는다
- 계약기간과 **광고 진행일**은 관리자가 나중에 입력한다. 광고 진행일은 환불 공제율의 기준일
- **금액은 서버에서만 계산한다.** 클라이언트가 보낸 값을 신뢰하지 않는다

---

## 이관

완료 시 소스는 대표님 GitHub 계정으로 옮긴다.
