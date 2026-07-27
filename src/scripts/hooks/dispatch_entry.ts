/**
 * dispatch_entry — bundle entry point for the precompiled hook dispatcher.
 *
 * road-to-credible-install Phase 1: `npm run build:hooks` bundles this file
 * (dispatcher + concern registry + every concern module) into
 * `dist/hooks/dispatch.js` so a hook event costs ONE node start — no tsx,
 * no per-concern re-spawn. Invoked either
 *   - directly: `node dist/hooks/dispatch.js --platform … --event …`, or
 *   - in-process from the CLI's native `dispatch:hook` route (dynamic
 *     import; the CLI process itself then runs the whole dispatch).
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { main } from './dispatch_hook.js';

/**
 * Direct-invocation detection. Under the esbuild bundle, EVERY inlined
 * module's `import.meta.url` is the bundle file — so a plain
 * argv[1]-vs-self comparison would make the CLI-entry guards of ALL
 * inlined modules (lint scripts, sidecars, …) false-fire at import time
 * and hijack the dispatch argv. The build banner therefore detects
 * `node dist/hooks/dispatch.js` BEFORE any module code runs, sets the
 * global marker, and rewrites argv[1] to a sentinel so no inlined guard
 * can match. Only this entry consults the marker. The plain comparison
 * below covers the unbundled path (`tsx src/scripts/hooks/dispatch_entry.ts`).
 */
const _selfPath = fileURLToPath(import.meta.url);
const _invokedDirectly =
    (globalThis as { __AC_HOOKS_BUNDLE_DIRECT?: boolean }).__AC_HOOKS_BUNDLE_DIRECT === true ||
    (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath));

if (_invokedDirectly) {
    process.exitCode = main(process.argv.slice(2));
}

export { main };
