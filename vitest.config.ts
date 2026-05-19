import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@cli': new URL('./src/cli', import.meta.url).pathname,
            '@server': new URL('./src/server', import.meta.url).pathname,
        },
    },
    test: {
        include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
        exclude: ['node_modules/**', 'dist/**', '.agent-src/**', '.agent-src.uncompressed/**'],
        environment: 'node',
        testTimeout: 10_000,
        hookTimeout: 10_000,
        reporters: process.env.CI ? ['default'] : ['default'],
    },
});
