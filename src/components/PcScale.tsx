'use client'

import { useEffect } from 'react'

// 768~1439px 폭에서는 PC(1440) 화면을 그대로 비율대로 줄인다 — 글자와 칸이 함께 줄어든다(2026-09-15 사용자 결정).
// 767px 이하는 모바일 화면, 1440px 이상은 원래 크기.
// 첫 화면부터 적용되도록 인라인 스크립트로 먼저 실행하고, 고객 화면 레이아웃을 벗어나면(관리자 화면 이동 등) 되돌린다.
const SCRIPT = `(function(){var d=document.documentElement;var w=window.innerWidth;d.style.zoom=w>=768&&w<1440?String(w/1440):'';})();`

function applyZoom() {
  const w = window.innerWidth
  document.documentElement.style.zoom = w >= 768 && w < 1440 ? String(w / 1440) : ''
}

export function PcScale() {
  useEffect(() => {
    applyZoom()
    window.addEventListener('resize', applyZoom)
    return () => {
      window.removeEventListener('resize', applyZoom)
      document.documentElement.style.zoom = ''
    }
  }, [])
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
}
