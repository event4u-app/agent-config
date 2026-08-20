import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
    plugins: [preact()],
    resolve: {
        alias: {
            '@cli': new URL('./src/cli', import.meta.url).pathname,
            '@server': new URL('./src/server', import.meta.url).pathname,
            '@shared': new URL('./src/shared', import.meta.url).pathname,
            '@ui': new URL('./src/ui', import.meta.url).pathname,
            '@install': new URL('./src/install', import.meta.url).pathname,
        },
    },
    test: {
        include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
        // tests/golden/sandbox/repo/** is the golden-transcript toy-repo
        // fixture — its tests run only when the replay harness drives them in
        // a temp workspace, never in the outer suite (mirrors the retired
        // conftest `collect_ignore_glob`).
        exclude: ['node_modules/**', 'dist/**', 'dist/agent-src/**', '.agent-src.uncondensed/**', 'tests/golden/sandbox/repo/**'],
        environmentMatchGlobs: [
            ['tests/ui/**', 'happy-dom'],
            ['src/ui/**', 'happy-dom'],
        ],
        environment: 'node',
        // Runs before every test file. Strips the ambient locale variables the
        // hook layer reads through `process.env`, so a suite cannot pass on one
        // machine's `LANG` and fail on another's — the exact failure that made
        // PR #1458 red on `macos-latest, shard 2/4` while green everywhere else.
        // Rationale and the deliberate narrowness live in the file itself.
        setupFiles: ['tests/_lib/hermetic-env.ts'],
        // Runs ONCE, in the main process, before any worker spawns. Builds the
        // gitignored `dist/` artefacts the four e2e suites spawn, but only when
        // they are absent. On a fresh checkout those four files accounted for 31
        // of 32 local failures purely because `dist/*` had never been built; in
        // CI (`tests.yml` runs `npm run build` first) this is a no-op. Full
        // rationale, and why building beats skipping, in the file itself.
        globalSetup: ['tests/_lib/ensure-build-artefacts.ts'],
        // The python-free-env shim (tests/_lib/python-free-env.ts) is DISABLED:
        // the py2ts test-layer purge converted every live python↔tsx parity
        // block to tsx-only intent tests, so no test needs the python3 shadow.
        // Per the teardown council D3 protocol the file itself is deleted in a
        // follow-up PR after this disable has soaked ≥1 CI cycle on main.
        testTimeout: 10_000,
        hookTimeout: 10_000,
        reporters: process.env.CI ? ['default'] : ['default'],
    },
});
