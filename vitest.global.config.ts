import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Repository-wide frontend coverage report.
 *
 * This report is deliberately descriptive during the transition: it includes
 * all production TypeScript/TSX under src/ except tests, test infrastructure,
 * declaration-only types and generated declarations. It has no percentage
 * threshold, so widening the denominator cannot silently weaken the stable
 * risk-targeted gate in vitest.config.ts.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage/frontend-global',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportOnFailure: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/types/**',
        'src/**/*.d.ts',
      ],
    },
  },
});
