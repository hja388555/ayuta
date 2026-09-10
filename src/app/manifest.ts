import type { MetadataRoute } from 'next'

/**
 * /manifest.webmanifest (큐 Q29 — 앱스토어 등록 대신 홈 화면 설치, 요구사항 446행).
 * app 루트에 둔다 — robots.ts 와 같이 라우트 그룹 안에서는 Next 가 인식하지 않는다.
 * 아이콘은 scripts/generate-icons.mjs 가 로고 원본에서 만든다. 색은 로고 파란색과 맞춘다.
 * 시작 주소는 기본 로케일 표지. 일본어 사용자는 표지의 언어 전환으로 옮긴다.
 */
export const BRAND_BLUE = '#005AFB'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AYUTA 아유타 — 한국·일본 광고 견적',
    short_name: '아유타',
    description: '한국과 일본의 광고 견적을 바로 확인하고 온라인으로 계약하세요.',
    start_url: '/ko',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: BRAND_BLUE,
    lang: 'ko',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
