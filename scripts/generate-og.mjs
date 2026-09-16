// 링크 미리보기(og:image) 이미지를 로고 원본에서 만든다. `node scripts/generate-og.mjs`
//
// 원본: reference/logo/ayuta-logo-2026.png — 파란 타원 위 흰 "아유타", 투명 배경.
// 1200x630 흰 바탕 가운데에 로고를 얹는다. 카카오톡·슬랙·페이스북이 쓰는 표준 비율이다.
// 결과물은 저장소에 커밋한다(빌드 때마다 만들지 않는다 — 로고가 바뀔 때만 다시 돌린다).
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'reference/logo/ayuta-logo-2026.png')
const OUT = path.join(root, 'public/og.png')

const W = 1200
const H = 630

const logo = await sharp(SRC).trim({ threshold: 10 }).resize({ width: Math.round(W * 0.5) }).png().toBuffer()
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
  .composite([{ input: logo, gravity: 'center' }])
  .png()
  .toFile(OUT)
console.log('wrote', path.relative(root, OUT))
