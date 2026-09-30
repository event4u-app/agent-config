#!/usr/bin/env node
/**
 * prepack-check.mjs — guard the published artifact.
 *
 * Runs during `npm pack` / `npm publish` AND as a dry-run on every PR
 * (Static Checks workflow). Four gates:
 *
 *   1. Compiled-bin shape — the TS CLI binary exists, is executable, and
 *      carries the Node shebang before the tarball is built. Otherwise a
 *      silently-broken `dist/` ships and every `npx @event4u/agent-config`
 *      greets the consumer with a cryptic `Cannot find module` panic.
 *   2. Shipped-import completeness — every relative import reachable from
 *      the shipped `src/` trees resolves to a file the `files` whitelist
 *      actually ships (the 8.3.0 ERR_MODULE_NOT_FOUND class).
 *   3. Lifecycle-target shape — every consumer-side lifecycle script points
 *      at a target that exists and ships (the 9.8.0 dead-postinstall class).
 *   4. Router-target shipping — every `routes_to` target in dist/router.json
 *      resolves inside the shipped `files[]` set, so a `files[]` narrowing
 *      cannot ship a dead router pointer.
 *
 * Folded from external council pass 2026-05-18 (Phase 1.3 acceptance).
 *
 * Skip with PREPACK_SKIP_BUILD_CHECK=1 only for local `npm pack` dry-runs
 * that intentionally test the failure mode.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, env, exit } from 'node:process';

const BIN = resolve('dist/cli/agent-config.js');
const SHEBANG = '#!/usr/bin/env node';

function die(msg) {
    process.stderr.write(`prepack-check: ${msg}\n`);
    exit(1);
}

if (env.PREPACK_SKIP_BUILD_CHECK === '1') {
    process.stderr.write('prepack-check: skipped (PREPACK_SKIP_BUILD_CHECK=1)\n');
    exit(0);
}

let st;
try {
    st = statSync(BIN);
} catch {
    die(`compiled CLI binary missing at ${BIN}. Run \`npm run build\` before \`npm pack\`.`);
}

if (!st.isFile()) {
    die(`${BIN} is not a regular file.`);
}

// Executable bit check (skip on Windows where mode bits are unreliable).
if (process.platform !== 'win32') {
    // 0o111 = any executable bit set
    if ((st.mode & 0o111) === 0) {
        die(`${BIN} is not executable. Build step must chmod +x the bin entry.`);
    }
}

const head = readFileSync(BIN, 'utf8').slice(0, SHEBANG.length);
if (head !== SHEBANG) {
    die(`${BIN} missing Node shebang. Expected "${SHEBANG}" as first line.`);
}

process.stderr.write(`prepack-check: ${BIN} OK\n`);

// ---------------------------------------------------------------------------
// Bundle-digest sidecar: `dist/hooks/dispatch.js` must ship with the
// `dist/hooks/dispatch.sha256` its build wrote, and the digest must still
// describe the bundle beside it.
//
// Risk 3 of road-to-a-kernel-that-guards-its-plumbing: the runtime integrity
// check treats a MISSING sidecar as `unverifiable` and allows, deliberately,
// so that a consumer install predating the sidecar is not wedged. That safety
// property has a cost — a bundle shipped without its sidecar silently disables
// the check for every consumer who installs it, and nothing at runtime can
// tell that apart from the legitimate old-package case. The place to catch it
// is here, in the one step that knows a bundle is being packaged NOW and
// therefore had no excuse for the sidecar's absence.
//
// A stale digest is treated exactly like a missing one: both mean the two
// files were not produced by the same `npm run build:hooks`.
const HOOK_BUNDLE = resolve('dist/hooks/dispatch.js');
const HOOK_SIDECAR = resolve('dist/hooks/dispatch.sha256');
let hookBundleBytes = null;
try {
    hookBundleBytes = readFileSync(HOOK_BUNDLE);
} catch {
    // No hook bundle in this tree at all — `npm run build` builds it, and gate
    // 1 above has already failed if the build did not run. Nothing to check.
}
if (hookBundleBytes !== null) {
    let sidecarText;
    try {
        sidecarText = readFileSync(HOOK_SIDECAR, 'utf8');
    } catch {
        die(
            `dist/hooks/dispatch.js ships without dist/hooks/dispatch.sha256. The runtime ` +
                `integrity check reads a missing sidecar as "unverifiable" and ALLOWS, so ` +
                `publishing this tarball would silently disable it for every consumer. Run ` +
                `\`npm run build:hooks\`, which writes both.`,
        );
    }
    const claimed = /^([0-9a-f]{64})\s/u.exec(sidecarText.trim())?.[1] ?? null;
    if (claimed === null) {
        die(`dist/hooks/dispatch.sha256 is malformed — expected "<64 hex>  dispatch.js".`);
    }
    const actual = createHash('sha256').update(hookBundleBytes).digest('hex');
    if (actual !== claimed) {
        die(
            `dist/hooks/dispatch.sha256 does not describe dist/hooks/dispatch.js ` +
                `(sidecar ${claimed.slice(0, 12)}…, bundle ${actual.slice(0, 12)}…). The two were ` +
                `not produced by the same build. Run \`npm run build:hooks\`.`,
        );
    }
    process.stderr.write(`prepack-check: dist/hooks/dispatch.sha256 OK (${actual.slice(0, 12)}…)\n`);
}

// ---------------------------------------------------------------------------
// Import-completeness guard: every relative import reachable from the
// SHIPPED src/ trees must itself resolve to a shipped file. Catches the
// 8.3.0 class of bug where src/scripts/_lib/claude_settings_hooks.ts
// imported src/install/atomic.js while the `files` whitelist did not ship
// src/install/ — the global install then crashed doctor/conformance with
// ERR_MODULE_NOT_FOUND. Deterministic, no network, no npm pack invocation:
// the shipped set is derived from the package.json `files` whitelist.
// ---------------------------------------------------------------------------
import { readdirSync } from 'node:fs';

import { stripCommentsMjs } from './_lib/strip_comments.mjs';
import { dirname, join, relative, sep } from 'node:path';

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const shippedPrefixes = (pkg.files ?? [])
    .filter((f) => f.endsWith('/'))
    .map((f) => f.replace(/\/+$/, '') + '/');
const shippedFiles = new Set((pkg.files ?? []).filter((f) => !f.endsWith('/')));

function isShipped(relPath) {
    const posix = relPath.split(sep).join('/');
    if (shippedFiles.has(posix)) return true;
    return shippedPrefixes.some((p) => posix.startsWith(p));
}

function* walk(dir) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) {
            yield* walk(full);
        } else if (/\.(ts|mts|mjs|js)$/.test(e.name) && !e.name.endsWith('.d.ts')) {
            yield full;
        }
    }
}

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.\.?\/[^'"]+)['"]/g;


function resolveCandidates(fromDir, spec) {
    const base = join(fromDir, spec);
    return [
        base,
        base.replace(/\.js$/, '.ts'),
        base.replace(/\.mjs$/, '.mts'),
        `${base}.ts`,
        `${base}.js`,
        join(base, 'index.ts'),
        join(base, 'index.js'),
    ];
}

const importErrors = [];
const scanRoots = shippedPrefixes.filter((p) => p.startsWith('src/'));
for (const root of scanRoots) {
    for (const file of walk(resolve(root))) {
        const text = stripCommentsMjs(readFileSync(file, 'utf8'));
        for (const m of text.matchAll(IMPORT_RE)) {
            const spec = m[1];
            const candidates = resolveCandidates(dirname(file), spec);
            const hit = candidates.find((c) => {
                try {
                    return statSync(c).isFile();
                } catch {
                    return false;
                }
            });
            const fileRel = relative(resolve('.'), file);
            if (hit === undefined) {
                importErrors.push(`${fileRel}: unresolvable relative import '${spec}'`);
                continue;
            }
            const hitRel = relative(resolve('.'), hit);
            if (!isShipped(hitRel)) {
                importErrors.push(
                    `${fileRel}: imports '${spec}' → ${hitRel}, which is NOT in the ` +
                        'package.json `files` whitelist (would crash the global install ' +
                        'with ERR_MODULE_NOT_FOUND)',
                );
            }
        }
    }
}

if (importErrors.length > 0) {
    for (const e of importErrors) {
        process.stderr.write(`prepack-check: ${e}\n`);
    }
    die(`${importErrors.length} shipped import(s) escape the files whitelist.`);
}
process.stderr.write(
    `prepack-check: import-completeness OK (${scanRoots.length} shipped src tree(s) scanned)\n`,
);

// ---------------------------------------------------------------------------
// Lifecycle-target guard (gate 3): every consumer-side lifecycle script
// (preinstall/install/postinstall/prepare) must reference only targets that
// exist and ship. Structural fix for the 9.8.0 dead-postinstall class.
// ---------------------------------------------------------------------------
import { existsSync } from 'node:fs';
import { checkLifecycleTargets } from './prepack_lifecycle_check.mjs';

const lifecycleErrors = checkLifecycleTargets(pkg, (p) => existsSync(resolve(p)));
if (lifecycleErrors.length > 0) {
    for (const e of lifecycleErrors) {
        process.stderr.write(`prepack-check: ${e}\n`);
    }
    die(`${lifecycleErrors.length} lifecycle script target(s) missing or unshipped.`);
}
process.stderr.write('prepack-check: lifecycle script targets OK\n');

// ---------------------------------------------------------------------------
// Router-pointer shipping guard (gate 4): every `routes_to` target in
// dist/router.json must resolve to a file that exists AND is inside the
// shipped `files[]` set. A `files[]` narrowing that drops a routed target was
// caught once by a working gate; this makes that catch structural rather than
// incidental, and moves it to pack time on the causing PR
// (road-to-gates-that-can-fail Phase 4). The kind→path table is single-sourced
// from ./router_target_paths.mjs, shared with
// cmd_conformance.ts::routeTargetPaths — two copies could disagree about where
// a pointer lives, which is the packaging↔runtime gap this closes.
//
// PREPACK_ROUTER_JSON points the gate at a different index (repo-relative or
// absolute) — used by tests/scripts/prepack_router_targets.test.ts and by the
// planted-target proof, so dist/router.json itself is never mutated.
// ---------------------------------------------------------------------------
import { checkRouterTargetsShipped } from './prepack_router_targets.mjs';

const routerRel = env.PREPACK_ROUTER_JSON ?? 'dist/router.json';
const routerResult = checkRouterTargetsShipped({
    routerPath: resolve(routerRel),
    isShipped,
    exists: (relPath) => existsSync(resolve(relPath)),
    readFile: (p) => readFileSync(p, 'utf8'),
});
if (routerResult.errors.length > 0) {
    for (const e of routerResult.errors) {
        process.stderr.write(`prepack-check: ${e}\n`);
    }
    die(`${routerResult.errors.length} router target(s) do not resolve inside the shipped set.`);
}
process.stderr.write(
    `prepack-check: router targets OK (${routerResult.scanned} routes_to target(s) in ${routerRel})\n`,
);

// Optional: invoked with --verbose dumps the size for tarball-budget bookkeeping.
if (argv.includes('--verbose')) {
    process.stderr.write(`prepack-check: size=${st.size} bytes\n`);
}
