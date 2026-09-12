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
