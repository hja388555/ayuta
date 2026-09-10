// PWA·파비콘 아이콘 세트를 로고 원본에서 만든다(큐 Q29). `node scripts/generate-icons.mjs`
//
// 원본: reference/logo/ayuta-logo-2026.png — 파란 타원 위 흰 "아유타", 투명 배경.
// 정사각형 아이콘은 로고와 같은 파란색으로 채운 뒤 로고의 흰 글자만 가운데 얹는다 —
// "파란 정사각형 위 흰 글자". 파란색은 로고에서 직접 뽑는다 —
// 값을 따로 적어 두면 로고를 바꿨을 때 두 색이 갈라진다.
//
// maskable(안드로이드 적응형 아이콘)은 가운데 지름 80% 원만 보장되므로 로고를 더 작게 넣는다.
// 결과물은 저장소에 커밋한다(빌드 때마다 만들지 않는다 — 로고가 바뀔 때만 다시 돌린다).
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'reference/logo/ayuta-logo-2026.png')

async function brandColor() {
  // 타원 안쪽이면서 글자가 없는 곳(위쪽 가운데)에서 색을 뽑는다
  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true })
  const x = Math.round(info.width / 2)
  const y = Math.round(info.height * 0.12)
  const i = (y * info.width + x) * info.channels
  return { r: data[i], g: data[i + 1], b: data[i + 2] }
}

// 로고에서 흰 글자만 떼어 낸다. 타원을 그대로 얹으면 가장자리 안티앨리어싱이 옅은 테두리로 남는다.
// 밝기(흰 정도)를 알파로 삼은 흰색 이미지 — 파란 타원·투명 배경은 모두 알파 0 쪽으로 간다
async function lettering(width) {
  const { data, info } = await sharp(SRC).resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let p = 0; p < info.width * info.height; p++) {
    const i = p * 4
    const min = Math.min(data[i], data[i + 1], data[i + 2])
    // 파란색은 R 이 0 근처, 흰색은 255 — R·G·B 최솟값이 곧 흰 정도
    const white = Math.max(0, Math.min(255, Math.round(((min - 120) / (255 - 120)) * 255)))
    out[i] = out[i + 1] = out[i + 2] = 255
    out[i + 3] = Math.round((white * data[i + 3]) / 255)
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
}

async function icon(size, logoRatio, out, background) {
  const logo = await lettering(Math.round(size * logoRatio))
  await mkdir(path.dirname(out), { recursive: true })
  await sharp({ create: { width: size, height: size, channels: 4, background: { ...background, alpha: 1 } } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out)
  console.log('wrote', path.relative(root, out))
}

const color = await brandColor()
const hex = '#' + [color.r, color.g, color.b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
console.log('brand color', hex)

// 일반 아이콘: 로고를 크게(글자가 잘 보이게)
await icon(192, 0.92, path.join(root, 'public/icons/icon-192.png'), color)
await icon(512, 0.92, path.join(root, 'public/icons/icon-512.png'), color)
// maskable: 안전 영역(지름 80%) 안에 글자가 들어가게 로고 폭 70%
await icon(512, 0.7, path.join(root, 'public/icons/icon-maskable-512.png'), color)
// iOS 홈 화면(apple-touch-icon)과 브라우저 탭 파비콘 — Next 가 app/ 의 파일을 자동으로 연결한다
await icon(180, 0.92, path.join(root, 'src/app/apple-icon.png'), color)
await icon(48, 0.95, path.join(root, 'src/app/icon.png'), color)
