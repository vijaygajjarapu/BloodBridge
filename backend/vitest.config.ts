import { defineConfig } from 'vitest/config';

/**
 * Tests run against a separate throwaway database (backend/prisma/test.db), created fresh and seeded on every run.
 * Your real local data (dev.db) is never touched. No emails or SMS are sent (NODE_ENV=test).
 */
export default defineConfig({
  test: {
    include: ['tests/eligibility.test.ts', 'tests/matching.test.ts', 'tests/communities.test.ts', 'tests/language.test.ts', 'tests/oncall.test.ts', 'tests/core.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      MSG91_AUTH_KEY: '',
      RAZORPAY_KEY_ID: '',
      RAZORPAY_KEY_SECRET: '',
    },
    globalSetup: ['tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
