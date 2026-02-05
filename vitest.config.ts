import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';
import { resolve } from 'path';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: [],
      include: [
        'src/__tests__/**/*.test.ts',
        'src/parser/**/*.test.ts',
        'src/utils/**/*.test.ts',
        'src/features/**/*.test.ts',
        'tests/**/*.test.ts',
      ],
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        siyuan: resolve(__dirname, 'src/__tests__/siyuan-stub.ts'),
        // Don't stub rrule - use real library for tests
      },
    },
  })
);
