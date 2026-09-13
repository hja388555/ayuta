import { useEffect, useRef, useState } from 'react'
import type { useRouter } from 'next/navigation'

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

type NextHistoryState = { __NA?: boolean; __PRIVATE_NEXTJS_INTERNALS_TREE?: { renderedSearch?: string } }

/**
 * Next 16.3 이 window.history.replaceState 를 패치해 넣는 비공개 필드
 * (__NA, __PRIVATE_NEXTJS_INTERNALS_TREE.renderedSearch)에 기대는 코드다.
 * 다음 Next 업그레이드에서 이 필드 이름·모양이 바뀌면 이 파일도 같이 봐야 한다.
 *
 * useMirrorQuery 로 옮겨 적은 쿼리는 주소창에만 반영된다 — 라우터가 이 히스토리 항목에
 * 들고 있는 되살리기 상태(renderedSearch)는 처음 들어왔을 때 값 그대로다. 결제 화면에서
 * 뒤로가기를 누르면 라우터는 주소가 아니라 그 되살리기 상태로 돌아가므로, 고른 내용이
 * 사라진다(2026-09-13 QA). 결제 화면으로 넘어가기 직전에 이 항목의 renderedSearch 를
 * 지금 쿼리로 동기적으로 고쳐 쓴다 — data 에 __NA 를 실어 보내면 라우터 패치가 이 값을
 * 그대로 통과시켜 준다(app-router.js 의 replaceState 패치, __NA 있으면 원본 replaceState로
 * 바로 넘어간다). 그래서 router.replace 처럼 서버 왕복이 필요 없고, 매 결제 클릭마다
 * 지연·부분 실패 걱정도 없다.
 */
function commitHistoryForCheckout(pathname: string, query: string): void {
  const state = window.history.state as NextHistoryState | null
  const tree = state?.__PRIVATE_NEXTJS_INTERNALS_TREE
  const href = selectionHref(pathname, query)
  if (!state?.__NA || !tree) {
    // 히스토리에 라우터 상태가 아직 없는 드문 경우(하이드레이션 전 등) — 예전처럼 주소만 고친다
    window.history.replaceState(null, '', href)
    return
  }
  window.history.replaceState(
    { ...state, __PRIVATE_NEXTJS_INTERNALS_TREE: { ...tree, renderedSearch: query ? `?${query}` : '' } },
    '',
    href,
  )
}

/**
 * 결제 버튼 훅. 이동 직전에 히스토리를 동기적으로 확정하므로(위 주석) 비동기로 기다리는
 * 구간이 없다 — 그래도 버튼을 두 번 연타하면 결제 화면 히스토리 항목이 두 개 쌓여
 * 뒤로가기 한 번으로는 폼으로 못 돌아온다. pending 으로 첫 클릭 이후를 막고, 호출한
 * 폼은 이 값으로 결제 버튼을 비활성화해야 한다.
 */
export function useCheckoutGuard(): {
  pending: boolean
  goToCheckout: (router: ReturnType<typeof useRouter>, pathname: string, query: string, checkoutHref: string) => void
} {
  const firedRef = useRef(false)
  const [pending, setPending] = useState(false)
  const goToCheckout = (router: ReturnType<typeof useRouter>, pathname: string, query: string, checkoutHref: string) => {
    if (firedRef.current) return
    firedRef.current = true
    setPending(true)
    commitHistoryForCheckout(pathname, query)
    router.push(checkoutHref)
  }
  return { pending, goToCheckout }
}
