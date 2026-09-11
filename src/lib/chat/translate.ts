import type { DeeplLang } from './rules'

/**
 * DeepL 번역(큐 Q37). 채팅 메시지 저장 전에 한 번 부른다.
 * - 키가 없으면 네트워크를 타지 않고 'skipped' (로컬·CI)
 * - 원문이 이미 목표 언어면 'skipped'
 * - 실패·시간 초과(8초)는 'failed' — 원문은 호출자가 그대로 저장한다
 * 메시지 본문과 키는 절대 로그에 남기지 않는다.
 */

export const TIMEOUT_MS = 8000

export type TranslationResult = {
  status: 'ok' | 'failed' | 'skipped'
  text: string | null
  sourceLang: string | null
  targetLang: DeeplLang
}

/** 무료 키(:fx)는 api-free, 유료 키는 api */
export const deeplEndpoint = (key: string) =>
  key.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate'

export async function translate(
  text: string,
  target: DeeplLang,
  opts: { apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<TranslationResult> {
  const apiKey = opts.apiKey ?? process.env.DEEPL_API_KEY ?? ''
  const base = { targetLang: target }
  if (!apiKey) return { ...base, status: 'skipped', text: null, sourceLang: null }

  const doFetch = opts.fetchImpl ?? fetch
  try {
    const res = await doFetch(deeplEndpoint(apiKey), {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [text], target_lang: target }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`[chat] DeepL 응답 ${res.status}`)
      return { ...base, status: 'failed', text: null, sourceLang: null }
    }
    const data = (await res.json()) as { translations?: Array<{ text?: unknown; detected_source_language?: unknown }> }
    const first = data.translations?.[0]
    const source = typeof first?.detected_source_language === 'string' ? first.detected_source_language.toUpperCase() : null
    if (typeof first?.text !== 'string') return { ...base, status: 'failed', text: null, sourceLang: source }
    if (source === target) return { ...base, status: 'skipped', text: null, sourceLang: source }
    return { ...base, status: 'ok', text: first.text, sourceLang: source }
  } catch (err) {
    console.warn(`[chat] DeepL 호출 실패: ${err instanceof Error ? err.name : 'unknown'}`)
    return { ...base, status: 'failed', text: null, sourceLang: null }
  }
}
