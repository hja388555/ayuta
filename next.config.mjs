import { withPayload } from '@payloadcms/next/withPayload'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 관리자 화면에는 고객 개인정보가 있다. 로그아웃 뒤 뒤로가기로 캐시된 화면이 보이지 않게
  // 브라우저·중간 캐시 어디에도 남기지 않는다(bfcache 복원은 AdminShell 의 가드가 새로고침한다)
  async headers() {
    const noStore = [{ key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' }]
    // 고정 이미지는 파일 이름이 그대로라 하루만 캐시하고, 그 뒤엔 바뀌었는지 확인한다
    const assetCache = [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }]
    return [
      { source: '/brand/:path*', headers: assetCache },
      { source: '/ui/:path*', headers: assetCache },
      { source: '/icons/:path*', headers: assetCache },
      { source: '/manage', headers: noStore },
      { source: '/manage/:path*', headers: noStore },
    ]
  },
}

export default withNextIntl(withPayload(nextConfig, { devBundleServerPackages: false }))
