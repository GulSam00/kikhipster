import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 도메인 로직(순수 함수)만 단위 테스트한다. 컴포넌트·페이지는 브라우저에서 확인한다(docs/TASKS.md).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**'],
  },
});
