#!/usr/bin/env node
/**
 * `agent-config` — bin entry point (thin launcher).
 *
 * This file MUST NOT statically import any third-party package. The real
 * CLI lives in `./main.ts` and statically imports `commander` (+ the rest of
 * the dependency graph); if `node_modules` is missing, that import fails at
 * module-load with a raw `ERR_MODULE_NOT_FOUND` and no guidance — before any
 * of our code can run.
 *
 * So the launcher runs a dependency preflight using Node built-ins only, then
 * dynamically imports `./main.js`. A missing install surfaces as an
 * actionable "run npm ci" message instead of a stack trace.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

// `commander` is the first runtime dependency `./main.ts` imports; if it does
// not resolve, the install is incomplete (no `node_modules`, partial install,
// or a corrupted tree). Probe it cheaply before loading the real CLI.
try {
    require.resolve('commander');
} catch {
    // Entry is `<packageRoot>/dist/cli/agent-config.js` → up two dirs.
    const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    process.stderr.write(
        "❌ agent-config: runtime dependencies are not installed " +
            "(could not resolve 'commander').\n" +
            `   Fix:  ( cd "${packageRoot}" && npm ci )\n` +
            "   Then re-run your command.\n",
    );
    process.exit(1);
}

// Deps present — hand off to the real CLI. Keep this a dynamic import so the
// `commander` graph is only resolved after the preflight passes. `main.ts`
// owns its own argv parsing, exit-code handling, and error catch.
void import('./main.js').catch((err: unknown) => {
    process.stderr.write(
        `${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
});
