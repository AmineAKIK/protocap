import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Risk-targeted coverage gate.
 *
 * This denominator is intentionally stable during PR-11 so a wider global
 * report cannot hide a regression in the previously gated modules.
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
      reportsDirectory: 'coverage/frontend-targeted',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportOnFailure: true,
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
        'src/hooks/useNow.ts',
        'src/hooks/useLocalStorage.ts',
        'src/persistence/publicLocalStorage.ts',
        'src/persistence/requiredWebLock.ts',
        'src/features/logistics/logisticsPersistence.ts',
        'src/pages/shiftguide/ShiftGuideLock.tsx',
        'src/utils/expiry.ts',
        'src/features/expiry/time.ts',
        'src/features/expiry/declaration.ts',
        'src/features/expiry/persistence.ts',
        'src/features/expiry/useExpiryWorkspace.ts',
        'src/features/expiry/DeclarationForm.tsx',
        'src/pages/ExpiryCheckPage.tsx',
        'src/features/logistics/logisticsModel.ts',
        'src/features/logistics/useLogisticsWorkspace.ts',
        'src/pages/LogisticsCallPage.tsx',
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
