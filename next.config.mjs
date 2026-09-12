import { withPayload } from '@payloadcms/next/withPayload'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 관리자 화면에는 고객 개인정보가 있다. 로그아웃 뒤 뒤로가기로 캐시된 화면이 보이지 않게
  // 브라우저·중간 캐시 어디에도 남기지 않는다(bfcache 복원은 AdminShell 의 가드가 새로고침한다)
  async headers() {
    const noStore = [{ key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' }]
    return [
      { source: '/manage', headers: noStore },
      { source: '/manage/:path*', headers: noStore },
    ]
  },
}

export default withNextIntl(withPayload(nextConfig, { devBundleServerPackages: false }))
