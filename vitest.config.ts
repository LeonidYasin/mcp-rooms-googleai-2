import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    // Test files share one SQLite file and seed it on first open, so they must
    // not run in parallel workers (SQLITE_BUSY / partial seeds otherwise).
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_PATH: './data/test-mcp-rooms.db',
      EMBEDDING_PROVIDER: 'disabled',
      GEMINI_API_KEY: '',
    },
  },
});
