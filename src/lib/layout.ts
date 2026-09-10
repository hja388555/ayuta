export const CONTENT_MAX = 1440
export const MIN_SIDE = 48
export const MIN_SIDE_TABLET = 32
export const MIN_SIDE_MOBILE = 16

/** 화면 폭에 대한 좌우 여백. CSS 의 max(minSide, (100vw - 1440px)/2) 와 같은 값 */
export function sidePadding(viewport: number): number {
  const min = viewport < 768 ? MIN_SIDE_MOBILE : viewport < 1024 ? MIN_SIDE_TABLET : MIN_SIDE
  const centered = Math.round((viewport - CONTENT_MAX) / 2)
  return Math.max(min, centered, 0)
}

/** 실제로 글과 입력칸이 차지하는 폭 */
export function contentWidth(viewport: number): number {
  return Math.max(0, viewport - sidePadding(viewport) * 2)
}
