'use client'

import { useState } from 'react'
import s from './PasswordInput.module.css'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  showLabel?: string
  hideLabel?: string
}

/** 비밀번호 칸. 오른쪽 눈 버튼으로 입력한 값을 잠깐 볼 수 있다 */
export function PasswordInput({ showLabel = '비밀번호 표시', hideLabel = '비밀번호 숨기기', style, disabled, ...attrs }: Props) {
  const [shown, setShown] = useState(false)
  return (
    <span className={s.wrap}>
      <input {...attrs} type={shown ? 'text' : 'password'} disabled={disabled} style={{ paddingRight: 44, ...style }} />
      <button
        type="button"
        className={s.toggle}
        onClick={() => setShown((v) => !v)}
        disabled={disabled}
        aria-label={shown ? hideLabel : showLabel}
        aria-pressed={shown}
        // 비밀번호 칸에서 탭을 누르면 다음 칸으로 가야지 눈 버튼에 걸리지 않게 한다
        tabIndex={-1}
      >
        <EyeIcon off={shown} />
      </button>
    </span>
  )
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path d="M1.7 10S4.9 4.6 10 4.6 18.3 10 18.3 10 15.1 15.4 10 15.4 1.7 10 1.7 10Z" strokeLinejoin="round" />
      <circle cx={10} cy={10} r={2.4} />
      {off ? <path d="M3.5 3.5 16.5 16.5" strokeLinecap="round" /> : null}
    </svg>
  )
}
