'use client'

import { useEffect, useState } from 'react'

type Labels = { title: string; install: string; close: string; iosHint: string }
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const DISMISS_KEY = 'ayuta_install_banner_dismissed'

/**
 * 홈 화면 설치 유도 배너(큐 Q29). 모바일에서만 띄운다.
 * - 안드로이드 크롬 등: 브라우저가 주는 beforeinstallprompt 를 받아 두었다가 [설치] 로 띄운다.
 * - iOS 사파리: 그런 이벤트가 없어 "공유 → 홈 화면에 추가" 안내만 보여준다.
 * - 이미 설치해 앱으로 열었거나(standalone), 한 번 닫았으면 다시 띄우지 않는다.
 * localStorage 가 막힌 환경(사생활 보호 모드 등)에서는 조용히 매번 뜬다 — 기능이 깨지지는 않는다.
 */
export function InstallBanner({ labels }: { labels: Labels }) {
  const [deferred, setDeferred] = useState<PromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      dismissed = false
    }
    const mobile = window.matchMedia('(max-width: 768px)').matches
    if (standalone || dismissed || !mobile) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as PromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    const ua = navigator.userAgent
    const isIos = /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    if (isIos) {
      setIos(true)
      setVisible(true)
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function close() {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // 저장이 막혀도 이번 화면에서는 닫힌다
    }
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice.catch(() => null)
    setDeferred(null)
    close()
  }

  if (!visible) return null
  return (
    <div
      role="region"
      aria-label={labels.title}
      style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(var(--tabbar-offset, 0px) + 12px)', zIndex: 50, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 14 }}
    >
      <img src="/icons/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: 8 }} />
      <div style={{ flex: 1 }}>
        <strong style={{ display: 'block' }}>{labels.title}</strong>
        {ios ? <span style={{ color: 'var(--ink-500, #767B85)', fontSize: 12 }}>{labels.iosHint}</span> : null}
      </div>
      {!ios && deferred ? (
        <button type="button" onClick={install} style={{ padding: '8px 12px' }}>
          {labels.install}
        </button>
      ) : null}
      <button type="button" onClick={close} aria-label={labels.close} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>
        ×
      </button>
    </div>
  )
}
