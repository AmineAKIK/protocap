import eslint from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const unusedDebtFiles = [
  'src/pages/shiftguide/LineAnalysisReportPage.tsx',
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
  // Explicit baseline for the one remaining pre-existing unused-code file.
  {
    files: unusedDebtFiles,
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
