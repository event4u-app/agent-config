/**
 * ESLint flat config (v9+) for the TypeScript CLI shell.
 *
 * Scope: src/**\/*.ts and tests/**\/*.ts only. Python, Bash, and .md
 * remain governed by their own linters (scripts/lint_*.py, shellcheck,
 * markdownlint).
 */
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'scripts/**',
            'dist/agent-src/**',
            '.agent-src.uncondensed/**',
            '.augment/**',
            '.claude/**',
            '.cursor/**',
            'agents/**',
        ],
    },
    {
        files: ['src/**/*.ts', 'tests/**/*.ts'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: ['./tsconfig.json', './tsconfig.ui.json', './tsconfig.test.json'],
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                global: 'readonly',
                NodeJS: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            ...tseslint.configs['recommended'].rules,
            'no-console': ['error', { allow: ['warn', 'error'] }],
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },
    {
        // The single sanctioned logger may emit to stdout via process.stdout.write.
        files: ['src/cli/log/logger.ts'],
        rules: { 'no-console': 'off' },
    },
    {
        // Council 2026-05-19 (user-md-utils-placement): `src/shared/**` is
        // consumed by both the server (`tsc` → Node) and the UI (Vite →
        // browser). Node-only built-ins would silently break the UI bundle
        // at runtime; this guard fails the build instead.
        files: ['src/shared/**/*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                'fs',
                                'fs/*',
                                'node:fs',
                                'node:fs/*',
                                'path',
                                'node:path',
                                'os',
                                'node:os',
                                'crypto',
                                'node:crypto',
                                'child_process',
                                'node:child_process',
                                'process',
                                'node:process',
                                '@cli/*',
                                '@server/*',
                            ],
                            message:
                                'src/shared/** must stay pure (no Node built-ins, no @cli/@server imports). Move Node-specific code to src/server/.',
                        },
                    ],
                },
            ],
        },
    },
    {
        // Vitest specs may use console for diagnostic output.
        files: ['tests/**/*.ts', 'src/**/*.test.ts'],
        rules: { 'no-console': 'off' },
    },
];
