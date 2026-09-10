'use client'

import { useState } from 'react'

type Props = { orderNumber: string; copyLabel: string; copiedLabel: string }

export function CopyOrderNumber({ orderNumber, copyLabel, copiedLabel }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(orderNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드 권한이 없는 브라우저도 있다 — 실패해도 화면의 번호는 이미 보이므로
      // 손으로 옮겨 적을 수 있다. 조용히 무시한다
    }
  }

  return (
    <button type="button" onClick={copy} style={{ marginLeft: 12 }}>
      {copied ? copiedLabel : copyLabel}
    </button>
  )
}
