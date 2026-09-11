import 'server-only'
import type { Payload } from 'payload'
import { isAdminRole } from '@/lib/roles'
import { sendMail } from '@/lib/mail/send'
import { generateInviteToken, hashInviteToken, inviteExpiresAt, isWellFormedToken } from './token'

export type InviteRole = 'manager' | 'super'
export type PendingInvite = { id: number; email: string; role: InviteRole; expiresAt: string }

const ROLE_LABEL: Record<InviteRole, string> = { super: '최고관리자', manager: '중간관리자' }

type SqlPool = { query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> }
const poolOf = (payload: Payload) => (payload.db as unknown as { pool: SqlPool }).pool

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const fmtKst = (d: Date) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' }).format(d)

function inviteMail({ inviter, role, link, expiresAt }: { inviter: string; role: InviteRole; link: string; expiresAt: Date }) {
  const until = fmtKst(expiresAt)
  const text = [
    `${inviter} 님이 AYUTA 관리자(${ROLE_LABEL[role]})로 초대했습니다.`,
    '',
    '아래 링크에서 이름·연락처·비밀번호를 정하면 계정이 만들어집니다.',
    link,
    '',
    `링크는 ${until}까지 한 번만 쓸 수 있습니다.`,
    '초대받은 적이 없다면 이 메일을 무시해 주세요.',
  ].join('\n')
  const html = `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#111">
<p><strong>${escapeHtml(inviter)}</strong> 님이 AYUTA 관리자(<strong>${ROLE_LABEL[role]}</strong>)로 초대했습니다.</p>
<p>아래 버튼을 눌러 이름·연락처·비밀번호를 정하면 계정이 만들어집니다.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none">초대 수락하기</a></p>
<p style="color:#555">링크는 ${until}까지 한 번만 쓸 수 있습니다.<br>초대받은 적이 없다면 이 메일을 무시해 주세요.</p>
</div>`
  return { subject: '[AYUTA] 관리자 계정 초대', text, html }
}

/**
 * 초대를 만들고 메일을 보낸다. 같은 이메일의 쓰지 않은 이전 초대는 지운다(링크 하나만 살아 있게).
 * 이메일이 이미 관리자면 already_admin. 기존 고객 이메일이면 수락할 때 그 계정의 권한을 올린다.
 * 원본 토큰은 링크에만 담기고, 메일이 나가지 않았을 때만 호출자에게 link 로 돌아간다.
 */
export async function createInvite(
  payload: Payload,
  { email, role, inviter, site }: { email: string; role: InviteRole; inviter: { id: number; email: string }; site: string },
): Promise<{ ok: false; error: 'already_admin' | 'account_failed' } | { ok: true; sent: boolean; link?: string }> {
  const normalized = email.trim().toLowerCase()
  const { docs } = await payload.find({ collection: 'users', where: { email: { equals: normalized } }, limit: 1, depth: 0, overrideAccess: true })
  const existing = docs[0]
  if (existing?.deletedAt) return { ok: false, error: 'account_failed' }
  if (existing && isAdminRole(existing.role)) return { ok: false, error: 'already_admin' }

  await payload.delete({
    collection: 'admin-invites',
    where: { and: [{ email: { equals: normalized } }, { usedAt: { exists: false } }] },
    overrideAccess: true,
  })
  const token = generateInviteToken()
  const expiresAt = inviteExpiresAt()
  await payload.create({
    collection: 'admin-invites',
    data: { email: normalized, role, tokenHash: hashInviteToken(token), expiresAt: expiresAt.toISOString(), invitedBy: inviter.id },
    overrideAccess: true,
  })

  const link = `${site.replace(/\/+$/, '')}/ko/invite/${token}`
  const mail = await sendMail({ to: normalized, ...inviteMail({ inviter: inviter.email, role, link, expiresAt }) })
  return mail.sent ? { ok: true, sent: true } : { ok: true, sent: false, link }
}

export async function cancelInvite(payload: Payload, id: number): Promise<void> {
  await payload.delete({ collection: 'admin-invites', where: { and: [{ id: { equals: id } }, { usedAt: { exists: false } }] }, overrideAccess: true })
}

export async function listPendingInvites(payload: Payload): Promise<PendingInvite[]> {
  const { docs } = await payload.find({
    collection: 'admin-invites',
    where: { and: [{ usedAt: { exists: false } }, { expiresAt: { greater_than: new Date().toISOString() } }] },
    sort: '-createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  return docs.map((d) => ({ id: d.id, email: d.email, role: d.role, expiresAt: d.expiresAt }))
}

/** 초대 화면용 — 쓸 수 있는 초대면 이메일·권한, 아니면 null(없음·사용·만료를 구분하지 않는다) */
export async function findUsableInvite(payload: Payload, token: unknown): Promise<{ email: string; role: InviteRole } | null> {
  if (!isWellFormedToken(token)) return null
  const { rows } = await poolOf(payload).query<{ email: string; role: InviteRole }>(
    'SELECT email, role FROM admin_invites WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() LIMIT 1',
    [hashInviteToken(token)],
  )
  return rows[0] ?? null
}

/**
 * 초대를 한 번만 쓰도록 먼저 원자적으로 차지한다(UPDATE … WHERE used_at IS NULL RETURNING).
 * 동시에 두 번 눌러도 한쪽만 행을 돌려받는다. 계정 처리에 실패하면 releaseInvite 로 되돌린다.
 */
export async function claimInvite(payload: Payload, token: string): Promise<{ id: number; email: string; role: InviteRole } | null> {
  const { rows } = await poolOf(payload).query<{ id: number; email: string; role: InviteRole }>(
    `UPDATE admin_invites SET used_at = now(), updated_at = now()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING id, email, role`,
    [hashInviteToken(token)],
  )
  return rows[0] ?? null
}

export async function releaseInvite(payload: Payload, id: number): Promise<void> {
  await poolOf(payload).query('UPDATE admin_invites SET used_at = NULL, updated_at = now() WHERE id = $1', [id])
}
