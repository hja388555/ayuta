import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** 배경을 화면 끝까지 칠한다. 내부 내용은 그대로 1440 중앙에 정렬된다 */
  bleed?: boolean
  background?: string
  as?: 'div' | 'header' | 'footer' | 'section'
}

export function Shell({ children, bleed = false, background, as = 'div' }: Props) {
  const Tag = as
  return (
    <Tag style={bleed && background ? { background } : undefined}>
      <div style={{ paddingLeft: 'var(--side)', paddingRight: 'var(--side)' }}>{children}</div>
    </Tag>
  )
}
