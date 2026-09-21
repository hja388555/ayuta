type Mail = { subject: string; html: string; text: string }

const COPY = {
  ko: {
    subject: '[AYUTA] 비밀번호 재설정 안내',
    lead: '비밀번호 재설정을 요청하셨습니다. 아래 버튼을 눌러 새 비밀번호를 설정해 주세요.',
    button: '비밀번호 재설정',
    expire: '이 링크는 1시간 동안, 한 번만 사용할 수 있습니다.',
    ignore: '직접 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다. 비밀번호는 바뀌지 않습니다.',
  },
  ja: {
    subject: '[AYUTA] パスワード再設定のご案内',
    lead: 'パスワードの再設定を承りました。下のボタンから新しいパスワードを設定してください。',
    button: 'パスワードを再設定',
    expire: 'このリンクは1時間以内に1回のみ有効です。',
    ignore: 'お心当たりがない場合は、このメールを破棄してください。パスワードは変更されません。',
  },
} as const

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function resetPasswordMail(locale: 'ko' | 'ja', link: string): Mail {
  const c = COPY[locale]
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f6;font-family:sans-serif;color:#1a1a1a">
<div style="max-width:520px;margin:0 auto;padding:32px;background:#fff;border-radius:12px">
<p style="margin:0 0 8px;font-size:20px;font-weight:700">AYUTA</p>
<p style="margin:16px 0;font-size:15px;line-height:1.6">${esc(c.lead)}</p>
<p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#1a1a1a;color:#fff;text-decoration:none;font-weight:700">${esc(c.button)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.6">${esc(c.expire)}</p>
<p style="margin:0;font-size:13px;color:#666;line-height:1.6">${esc(c.ignore)}</p>
</div></body></html>`
  const text = `${c.lead}\n\n${link}\n\n${c.expire}\n${c.ignore}`
  return { subject: c.subject, html, text }
}
