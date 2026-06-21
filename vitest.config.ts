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
        // Enforce the post-migration python-free runtime so obsolete live
        // python↔tsx parity blocks self-skip (see tests/_lib/python-free-env.ts).
        setupFiles: ['./tests/_lib/python-free-env.ts'],
        testTimeout: 10_000,
        hookTimeout: 10_000,
        reporters: process.env.CI ? ['default'] : ['default'],
    },
});
