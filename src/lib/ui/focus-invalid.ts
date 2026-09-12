/**
 * 제출 오류가 났을 때 첫 번째 잘못된 칸으로 포커스를 옮기고 화면에 보이게 스크롤한다.
 * 칸은 aria-invalid="true" 로 찾는다. 상단에 고정(sticky/fixed)된 헤더가 있으면 그 높이만큼 덜 올린다.
 */
const GAP = 16

/** 스크롤 목표 위치. 요소 윗변(뷰포트 기준) + 현재 스크롤 − 고정 헤더 − 여백, 0 미만은 0 */
export function scrollTargetTop(elementTop: number, scrollY: number, headerOffset: number, gap = GAP): number {
  return Math.max(0, Math.round(elementTop + scrollY - headerOffset - gap))
}

function stickyHeaderOffset(): number {
  const header = document.querySelector('.site-header')
  if (!header) return 0
  const pos = getComputedStyle(header).position
  return pos === 'sticky' || pos === 'fixed' ? header.getBoundingClientRect().height : 0
}

/** 상태 반영(리렌더) 뒤에 불러야 aria-invalid 가 붙어 있다 — 그래서 한 프레임 미룬다 */
export function focusFirstInvalid(root: HTMLElement | null, selector = '[aria-invalid="true"]') {
  if (typeof window === 'undefined') return
  requestAnimationFrame(() => {
    const el = root?.querySelector<HTMLElement>(selector)
    if (!el) return
    el.focus({ preventScroll: true })
    const top = scrollTargetTop(el.getBoundingClientRect().top, window.scrollY, stickyHeaderOffset())
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
  })
}
