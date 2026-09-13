import { useEffect } from 'react'

/** 폼 주소에 현재 선택 쿼리를 붙인 값. 결제 화면으로 넘기는 쿼리와 같은 모양이다 */
export function selectionHref(pathname: string, query: string): string {
  return query ? `${pathname}?${query}` : pathname
}

/**
 * 폼에서 고른 내용을 주소창 쿼리에 옮겨 적는다(2026-09-12 QA). 새로고침·언어 전환 뒤에도
 * 페이지가 같은 쿼리로 restoreFromQuery 를 거쳐 선택을 되살린다.
 * replaceState 라 이동·스크롤·방문 기록이 생기지 않는다. 금액은 쿼리에 없다 — 서버가 다시 계산한다.
 */
export function useMirrorQuery(query: string): void {
  useEffect(() => {
    const next = selectionHref(window.location.pathname, query)
    if (next === `${window.location.pathname}${window.location.search}`) return
    // data 는 null 로 둔다 — Next 라우터 내부 상태를 넘기면 라우터가 자기 호출로 여겨 useSearchParams(헤더 언어 링크)를 갱신하지 않는다
    window.history.replaceState(null, '', next)
  }, [query])
}

type Router = { push: (href: string) => void; replace: (href: string, options?: { scroll?: boolean }) => void }

/** 라우터 항목의 되살리기 상태(__PRIVATE_NEXTJS_INTERNALS_TREE.renderedSearch)가 next 쿼리와 맞는지 */
function historyMatchesQuery(query: string): boolean {
  const state = window.history.state as { __PRIVATE_NEXTJS_INTERNALS_TREE?: { renderedSearch?: string } } | null
  const want = query ? `?${query}` : ''
  return state?.__PRIVATE_NEXTJS_INTERNALS_TREE?.renderedSearch === want
}

/**
 * 결제 화면으로 넘어가기 전에 지금 화면의 히스토리 항목을 라우터를 통해 한 번 더 확정한다.
 *
 * useMirrorQuery 는 window.history.replaceState 로 주소만 바꾼다 — 그래서 라우터가 이 항목에
 * 들고 있는 되살리기 상태(renderedSearch)는 여전히 처음 들어왔을 때 값이다. 결제 화면에서
 * 뒤로가기를 누르면 라우터는 주소가 아니라 그 되살리기 상태로 돌아가므로, 고른 내용이 사라진다.
 * router.replace 는 실제 라우터 동작이라 이 상태를 새 쿼리로 다시 써준다 — 그 반영이 끝난 뒤에만
 * 결제 화면으로 이동해야 뒤로가기가 되살아난다. (2026-09-13 QA)
 */
export function goToCheckout(router: Router, pathname: string, query: string, checkoutHref: string): void {
  router.replace(selectionHref(pathname, query), { scroll: false })
  const start = Date.now()
  const proceed = () => {
    if (historyMatchesQuery(query) || Date.now() - start > 2000) {
      router.push(checkoutHref)
      return
    }
    requestAnimationFrame(proceed)
  }
  requestAnimationFrame(proceed)
}
