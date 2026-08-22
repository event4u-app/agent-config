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
            'tests/fixtures/**',
            // Provenance golden corpus: deliberately-crafted algorithm samples
            // at three transformation depths, not project source. Linting them
            // would enforce house style on inputs whose whole purpose is to
            // vary in shape (road-to-provenance-and-license-governance S0.1).
            'internal/bench/provenance/samples/**',
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
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/consistent-type-imports': 'error',
            // 'error', not 'warn', since 2026-08-22 (road-to-ci-supply-chain-integrity
            // 2.2). The count was 0 across 1,177 files and `lint:ts` now carries
            // --max-warnings 0, so at this instant 'warn' and 'error' are
            // behaviourally identical — which is exactly why the promotion is free
            // and why it is worth making: it removes the tier that would start
            // growing unobserved the moment --max-warnings is ever dropped from the
            // npm script. A warn tier with no cap is a counter nobody reads.
            '@typescript-eslint/no-explicit-any': 'error',
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
        // ADR-095 workspace-boundary contract, import-edge layer. A workspace
        // module may not import an owner-module of a domain the workspace does
        // NOT own: skill design, profile/pack semantics, video-provider logic,
        // MCP-registry policy, router/projection policy, persona design.
        //
        // Previously enforced by `src/scripts/lint_workspace_boundary.ts` over
        // `src/cli/python/workspace_*.py`. ADR-200 migrated that corpus to
        // `.ts`, so the bespoke gate scanned 0 files and exited 0 for ~7 weeks
        // while the contract stayed `stable`. AI council 2026-08-05 rejected
        // repointing it: its Python `ast`-shaped import scanner extracts garbage
        // from TS (measured: `'*'`, `"{ fileURLToPath"`), so a glob swap would
        // have satisfied the scan-scope assertion while enforcing nothing — and
        // rewriting the scanner is a new analyzer, not a port. ESLint already
        // lints this corpus and already carries `no-restricted-imports` for the
        // `src/shared/**` boundary above, so the edge moves to the layer built
        // for it. `regex` (ESLint ≥ 9) preserves the original segment
        // boundaries; `/` is added to the boundary class, which the bespoke
        // gate's `[._-]` omitted — measured, that omission made 7 of 10 patterns
        // miss a forbidden token at the start of a path segment.
        //
        // Allowed: Node built-ins, third-party deps, and intra-workspace
        // `./workspace_*` siblings. Escape hatch: an eslint-disable-next-line
        // carrying a reason, reviewed against docs/contracts/workspace-boundary.md.
        files: ['src/cli/python/workspace_*.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '(?:^|[._\\-/])condense(?:$|[._\\-/])',
                            message:
                                'workspace-boundary (ADR-095): skill design / condensation is not a workspace-owned domain.',
                        },
                        {
                            regex: '(?:^|[._\\-/])skill_(?:linter|management|writing)(?:$|[._\\-/])',
                            message:
                                'workspace-boundary (ADR-095): skill design is not a workspace-owned domain.',
                        },
                        {
                            regex: '(?:^|[._\\-/])(?:discovery_manifest|profiles?|packs?)(?:$|[._\\-/])',
                            message:
                                'workspace-boundary (ADR-095): profile/pack semantics is not a workspace-owned domain.',
                        },
                        {
                            regex: 'ai[_-]?video',
                            message:
                                'workspace-boundary (ADR-095): video-provider logic is not a workspace-owned domain.',
                        },
                        {
                            regex: '(?:^|[._\\-/])mcp(?:$|[._\\-/])',
                            message:
                                'workspace-boundary (ADR-095): MCP-registry policy is not a workspace-owned domain.',
                        },
                        {
                            regex: '(?:^|[._\\-/])router(?:$|[._\\-/])',
                            message:
                                'workspace-boundary (ADR-095): router / projection policy is not a workspace-owned domain.',
                        },
                        {
                            regex: 'persona',
                            message:
                                'workspace-boundary (ADR-095): persona / skill design is not a workspace-owned domain.',
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
