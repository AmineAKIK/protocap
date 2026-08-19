import eslint from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const unusedDebtFiles = [
  'src/pages/ExpiryCheckPage.tsx',
  'src/pages/shiftguide/CelinePage.tsx',
  'src/pages/shiftguide/LineAnalysisReportPage.tsx',
  'src/pages/shiftguide/ModuleView.tsx',
];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
  },
  reactHooks.configs.flat.recommended,
  {
    files: ['server/**/*.mjs', 'server.mjs', 'tests/**/*.mjs', '*.config.{js,mjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
  },
  // Explicit baseline for pre-existing debt discovered while introducing ESLint.
  // Keep this list narrow: subsequent cleanup PRs remove entries/rules as they fix them.
  {
    files: unusedDebtFiles,
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['src/pages/ExpiryCheckPage.tsx', 'src/pages/shiftguide/ShiftGuideHome.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/pages/shiftguide/CelinePage.tsx'],
    rules: {
      'react-hooks/refs': 'off',
    },
  },
  {
    files: ['src/pages/shiftguide/ModuleView.tsx', 'src/pages/shiftguide/ShiftGuideHome.tsx'],
    rules: {
      'react-hooks/static-components': 'off',
    },
  },
);
