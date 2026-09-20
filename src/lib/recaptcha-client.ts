'use client'

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ''
const SCRIPT_ID = 'recaptcha-v3'

type Grecaptcha = {
  ready: (cb: () => void) => void
  execute: (siteKey: string, opts: { action: string }) => Promise<string>
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha
  }
}

let loader: Promise<Grecaptcha | null> | null = null

/** 스크립트는 한 번만 넣는다. 이미 있으면 그 약속을 그대로 돌려준다 */
function loadScript(): Promise<Grecaptcha | null> {
  if (loader) return loader
  loader = new Promise((resolve) => {
    if (window.grecaptcha) return resolve(window.grecaptcha)
    const el = document.getElementById(SCRIPT_ID) ?? document.createElement('script')
    el.id = SCRIPT_ID
    ;(el as HTMLScriptElement).src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`
    ;(el as HTMLScriptElement).async = true
    el.addEventListener('load', () => resolve(window.grecaptcha ?? null))
    el.addEventListener('error', () => resolve(null))
    if (!el.isConnected) document.head.appendChild(el)
  })
  return loader
}

/** 폼이 열릴 때 미리 스크립트를 받아 둔다 — 보내기 누른 뒤에 기다리지 않게 */
export function preloadRecaptcha(): void {
  if (SITE_KEY) void loadScript()
}

/**
 * 화면 동작 이름(action)으로 토큰을 만든다. 키가 없거나 스크립트가 실패하면 빈 문자열을 준다 —
 * 서버가 키 없는 환경에서는 통과시키므로 폼이 막히지 않는다.
 */
export async function recaptchaToken(action: string): Promise<string> {
  if (!SITE_KEY) return ''
  const grecaptcha = await loadScript()
  if (!grecaptcha) return ''
  try {
    await new Promise<void>((resolve) => grecaptcha.ready(resolve))
    return await grecaptcha.execute(SITE_KEY, { action })
  } catch {
    return ''
  }
}
