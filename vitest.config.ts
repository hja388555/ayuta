import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// 'server-only'는 설치돼 있지 않다(의존성 추가 금지) — Next.js가 자체적으로 해석하는
// 지정자라 빌드는 통과하지만, vitest는 Next 번들러가 아니라서 그냥 모듈 리졸브가
// 실패한다. 빈 스텁으로 alias해서 order-counter.ts / order-state.ts가 'server-only'를
// import한 채로도(= 가드가 실제로 살아 있는 채로도) 테스트가 돌게 한다.
export default defineConfig({
  resolve: {
    alias: {
      'server-only': path.resolve(dirname, 'tests/stubs/server-only.ts'),
      '@payload-config': path.resolve(dirname, 'src/payload.config.ts'),
    },
  },
})
