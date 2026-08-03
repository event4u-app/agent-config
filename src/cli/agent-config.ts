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

import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

// Hook hot path (road-to-hook-latency-repair Phase 2): `dispatch:hook` runs
// on EVERY tool call, so it must not pay the commander preflight or
// `./main.js`'s eager import graph (~370 ms of the measured ~450–500 ms
// CLI boot on a 1-vCPU container — bench_hook_latency --via-cli pins it).
// The dispatcher bundle is self-contained (no node_modules needed), so this
// runs BEFORE the dependency preflight: hooks keep working even on a broken
// install. `--config-root` is the one flag the full CLI handles before
// dispatch (exports EVENT4U_CONFIG_HOME) — hooks never pass it; when
// present, fall through to the full CLI so its semantics stay owned there.
// Bundle missing (stale dev tree) → fall through to ./main.js, whose own
// dispatch:hook route delegates to the historical bash path.
const _argv = process.argv.slice(2);
let _dispatchHotPathTaken = false;
if (_argv[0] === 'dispatch:hook' && !_argv.includes('--config-root')) {
    // realpath, not the raw URL: a symlinked bin (npm global, ./agent-config
    // shim) keeps the symlink path in import.meta.url; the bundle lives next
    // to the REAL file (same reason src/cli/paths.ts realpaths).
    let bundle: string | null = null;
    try {
        const here = realpathSync(fileURLToPath(import.meta.url));
        bundle = join(dirname(here), '..', '..', 'dist', 'hooks', 'dispatch.js');
    } catch {
        bundle = null;
    }
    if (bundle !== null && existsSync(bundle)) {
        _dispatchHotPathTaken = true;
        void import(pathToFileURL(bundle).href)
            .then((mod) => {
                const code = (mod as { main: (argv?: string[]) => number }).main(_argv.slice(1));
                // Flush queued async stdout before the hard exit (same
                // discipline as main.ts) — a piped stdout is async on macOS
                // and process.exit() truncates past the 8 KiB pipe buffer.
                process.exitCode = code;
                process.stdout.write('', () => process.exit(code));
            })
            .catch((err: unknown) => {
                process.stderr.write(
                    `${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
                );
                process.exit(1);
            });
    }
}

// `commander` is the first runtime dependency `./main.ts` imports; if it does
// not resolve, the install is incomplete (no `node_modules`, partial install,
// or a corrupted tree). Probe it cheaply before loading the real CLI.
// The `if` keeps the preflight + main import out of the dispatch hot path
// without restructuring the launcher flow.
if (!_dispatchHotPathTaken) {
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
}
