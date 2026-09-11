import type { S3ClientConfig } from '@aws-sdk/client-s3'

/**
 * 업로드 저장소 설정(큐 Q31 2단계). payload.config 와 파일 읽기(storage.ts)가 같이 쓴다.
 *
 * 버킷 사용은 S3_ENABLED=true 일 때만 켠다 — 키가 있다는 것만으로 켜지 않는다. 로컬 .env 에도
 * 운영 버킷 키가 들어 있어서, 키만 보고 켜면 로컬 개발·통합 테스트 파일이 운영 버킷에 쌓인다.
 * Vercel 환경변수에만 S3_ENABLED=true 를 둔다.
 */
export const S3_PREFIX = { 'inquiry-files': 'inquiry-files', 'brand-assets': 'brand-assets' } as const

export function s3Enabled(): boolean {
  return process.env.S3_ENABLED === 'true'
}

export function s3ClientConfig(): S3ClientConfig {
  return {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    // Supabase Storage 는 가상 호스트 방식(bucket.host)을 지원하지 않는다 — 경로 방식으로 붙는다
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' },
  }
}
