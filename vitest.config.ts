import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

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
      reporter: ['text', 'json-summary'],
      include: [
        'src/components/AccessibleDialog.tsx',
        'src/components/Button.tsx',
        'src/context/ShiftGuideAuthContext.tsx',
        'src/features/shiftguide/celineClient.ts',
        'src/features/shiftguide/shiftGuideConcurrency.ts',
        'src/features/shiftguide/shiftGuideStorage.ts',
        'src/features/shiftguide/useShiftGuideProgressOverview.ts',
        'src/hooks/useModuleProgress.ts',
        'src/hooks/useShiftGuideAuth.ts',
        'src/hooks/useShiftGuideShell.ts',
        'src/pages/shiftguide/ShiftGuideLock.tsx',
        'src/utils/expiry.ts',
        'src/utils/packing.ts',
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 50,
        lines: 60,
      },
    },
  },
});
