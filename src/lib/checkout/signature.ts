/**
 * 전자서명(타이핑한 이름)과 주문자명을 견주는 열쇠.
 *
 * 글자로는 같은데 서명이 안 되던 사고가 있었다 — 한글은 조합형(NFD)과 완성형(NFC) 두 가지로
 * 저장될 수 있고, 회원가입 때 붙여 넣은 이름과 결제창에서 IME 로 친 이름이 서로 다른 형태면
 * 화면에는 똑같이 보여도 문자열 비교에서 어긋난다. 웹폼으로 흘러드는 보이지 않는 글자
 * (zero-width space·줄바꿈 없는 공백)와 이름 사이 공백도 같은 이유로 털어 낸다.
 */
export function signatureKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFC')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, '')
}

/** 타이핑한 이름이 주문자명과 같은가 — 화면과 서버가 같은 규칙을 쓴다 */
export function signatureMatches(typed: string | null | undefined, ordererName: string | null | undefined): boolean {
  const key = signatureKey(typed)
  return key !== '' && key === signatureKey(ordererName)
}
