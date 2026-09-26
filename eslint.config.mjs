import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import boundaries from 'eslint-plugin-boundaries';
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
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.test.ts'],
    ...vitest.configs.recommended,
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
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

export default eslintConfig;
