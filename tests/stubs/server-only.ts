// server-only 패키지의 vitest용 빈 스텁. 패키지는 설치하지 않는다(의존성 추가 금지) —
// vitest.config.ts의 alias가 'server-only' import를 이 파일로 돌린다.
// 실제 배포에서는 Next.js가 이 지정자를 자체적으로 해석해 클라이언트 번들에 섞이는
// 걸 빌드 타임에 막는다. vitest는 Next 번들러가 아니므로 이 경로에서는 아무 효과가
// 없지만, import 자체는 여기서 조용히 통과시켜 테스트를 깨지 않는다.
export {}
