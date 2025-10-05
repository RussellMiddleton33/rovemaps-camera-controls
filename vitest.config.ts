import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.ts'],
    // Fix for jsdom environment pooling issues in CI
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false
      }
    }
  }
});
