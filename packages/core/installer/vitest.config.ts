/**
 * Vitest stub config — see `tsconfig.json` for the retirement note.
 * The single test under `tests/stub.test.ts` keeps the legacy
 * `Vitest (packages/core/installer/tests/**\/*.ts)` workflow step from
 * exiting non-zero on the no-tests-found path.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
    },
});
