import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import boundaries from 'eslint-plugin-boundaries';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['lighthouse/sign-in.cjs'],
    rules: {
      // Lighthouse CI loads the puppeteer script with require().
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'mock/**/*.test.ts'],
    ...vitest.configs.recommended,
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/consistent-test-it': ['error', { fn: 'test', withinDescribe: 'test' }],
    },
  },
  {
    files: ['e2e/**', 'playwright.config.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Playwright fixtures take a `use` callback parameter, which react-hooks mistakes for a hook call.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    files: ['src/**'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app' },
        { type: 'widgets', pattern: 'src/widgets/*' },
        { type: 'features', pattern: 'src/features/*' },
        { type: 'entities', pattern: 'src/entities/*' },
        { type: 'shared', pattern: 'src/shared' },
        { type: 'server', pattern: 'src/server/*' },
      ],
      'boundaries/files': [
        { category: 'instrumentation', pattern: 'src/instrumentation{,.test}.ts' },
        { category: 'instrumentation-client', pattern: 'src/instrumentation-client{,.test}.ts' },
        { category: 'proxy', pattern: 'src/proxy{,.test}.ts' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: ['app', 'widgets', 'features', 'entities', 'shared', 'server'],
                    },
                  },
                },
              },
            },
            {
              from: { element: { type: 'widgets' } },
              allow: {
                to: {
                  element: { types: { anyOf: ['widgets', 'features', 'entities', 'shared'] } },
                },
              },
            },
            {
              from: { element: { type: 'features' } },
              allow: {
                to: { element: { types: { anyOf: ['features', 'entities', 'shared', 'server'] } } },
              },
            },
            {
              from: { element: { type: 'entities' } },
              allow: { to: { element: { types: { anyOf: ['entities', 'shared'] } } } },
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: { element: { types: { anyOf: ['shared'] } } } },
            },
            {
              from: { element: { type: 'server' } },
              allow: { to: { element: { types: { anyOf: ['server', 'entities', 'shared'] } } } },
            },
            {
              from: { file: { categories: 'instrumentation' } },
              allow: {
                to: [{ file: { categories: 'instrumentation' } }, { element: { type: 'server' } }],
              },
            },
            {
              from: { file: { categories: 'instrumentation-client' } },
              allow: { to: { file: { categories: 'instrumentation-client' } } },
            },
            {
              from: { file: { categories: 'proxy' } },
              allow: { to: { file: { categories: 'proxy' } } },
            },
            {
              allow: { to: { module: { origin: 'external' } } },
            },
          ],
        },
      ],
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/no-unknown-files': 'error',
    },
  },
  prettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'storybook-static/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
