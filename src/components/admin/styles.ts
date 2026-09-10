import type { CSSProperties } from 'react'

/**
 * 관리자 화면 공용 인라인 스타일.
 * 관리자 전용 화면이라 기능이 우선이다 — 저장소 관례대로 인라인 스타일만 쓰고
 * UI 라이브러리를 새로 들이지 않는다. 값이 여러 화면에 흩어지지 않게 여기 모아 둔다.
 */
export const card: CSSProperties = {
  border: '1px solid #ECEEF1',
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
}

export const th: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #D6D9DE',
  background: '#F7F7F7',
  fontSize: 13,
  whiteSpace: 'nowrap',
}

export const td: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #ECEEF1',
  fontSize: 13,
  verticalAlign: 'top',
}

export const input: CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #D6D9DE',
  borderRadius: 4,
  fontSize: 13,
  fontFamily: 'inherit',
}

export const button: CSSProperties = {
  padding: '6px 14px',
  border: '1px solid #005AFA',
  background: '#005AFA',
  color: '#fff',
  borderRadius: 4,
  fontSize: 13,
  cursor: 'pointer',
}

export const errorBox: CSSProperties = {
  marginTop: 8,
  padding: '8px 10px',
  background: '#FEF3F2',
  color: '#D92D20',
  borderRadius: 4,
  fontSize: 13,
}

export const okBox: CSSProperties = {
  marginTop: 8,
  padding: '8px 10px',
  background: '#ECFDF3',
  color: '#067647',
  borderRadius: 4,
  fontSize: 13,
}

export const label: CSSProperties = { fontSize: 12, color: '#767B85', display: 'block', marginBottom: 4 }
