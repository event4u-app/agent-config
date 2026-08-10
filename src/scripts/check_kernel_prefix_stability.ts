#!/usr/bin/env tsx
/**
 * Kernel-prefix byte-stability guard (token-saving Phase 5 — cache-aware ordering).
 *
 * The kernel rules are the always-loaded floor: their condensed bodies sit at
 * the front of the context on EVERY request, so they are the KV-cache prefix.
 * A byte change there (edited body, added/removed kernel rule, reordering)
 * invalidates the cached prefix for every consumer on every request — a 10×
 * cost event (Manus: cached reads bill at ~0.1× vs 1× fresh). This guard makes
 * that change IMPOSSIBLE to land silently.
 *
 * Mechanism (mirrors the condensation-hash gate, not a release-version gate):
 * a committed snapshot `internal/bench/reports/kernel-prefix.json` records the
 * ordered kernel ids + a sha256 of their concatenated dist bodies. CI fails if
 * the live prefix drifts from the snapshot. To land a deliberate kernel change,
 * the author re-anchors with `--update-baseline` IN THE SAME PR — so the
 * cache-invalidating change is explicit in the diff and reviewed (and subject to
 * the kernel-rule-edits slow-rollout). Determinism of the ORDER is already
 * enforced upstream by `compile_router --check`.
 *
 * NOTE on the roadmap's "byte-identical to the previous *release* unless a
 * version bump": that release-version form would block normal in-development
 * kernel edits (the version bumps at release, not per kernel-edit PR). The
 * drift-snapshot form above delivers the same invariant — cache-prefix changes
 * are deliberate, explicit, reviewed — without coupling to the release cadence.
 *
 * CLI:
 *   ./scripts-run src/scripts/check_kernel_prefix_stability            # gate
 *   ./scripts-run src/scripts/check_kernel_prefix_stability --json
 *   ./scripts-run src/scripts/check_kernel_prefix_stability --update-baseline
 *
 * Exit codes: 0 stable · 1 file error · 2 drift (kernel prefix changed).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

// ledger-exempt: single folded-hash comparison — the ordered kernel bodies become ONE sha256 via compute_prefix, byte-compared against the single committed snapshot, so the gate has exactly one aggregate drift verdict and no per-rule outcome exists to record; a changed byte in any body is indistinguishable from a reorder by construction, which IS the invariant. The kernel-count scope floor is already asserted by assertScanned over dist/router.json.
const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const ROUTER = path.join(REPO_ROOT, 'dist/router.json');
const RULES_DIR = path.join(REPO_ROOT, 'dist/agent-src/rules');
const SNAPSHOT = path.join(REPO_ROOT, 'internal/bench/reports/kernel-prefix.json');

type Json = Record<string, unknown>;

export interface KernelPrefix {
  kernel_ids: string[];
  sha256: string;
}

/** Kernel ids in router order (compile_router already sorts them deterministically). */
export function kernel_ids(router: Json): string[] {
  const k = router['kernel'];
  if (!Array.isArray(k)) return [];
  return k.map((e) => (typeof e === 'string' ? e : String((e as Json)?.id ?? ''))).filter(Boolean);
}

/**
 * Compute the prefix snapshot: the ordered kernel ids + a sha256 over each
 * kernel body framed with its id (so a reorder OR a body edit both change it).
 */
export function compute_prefix(ids: string[], readBody: (id: string) => string): KernelPrefix {
  const h = crypto.createHash('sha256');
  for (const id of ids) {
    h.update(`\0${id}\0`); // id frame — reordering changes the digest
    h.update(readBody(id));
  }
  return { kernel_ids: ids, sha256: h.digest('hex') };
}

export type Verdict = 'stable' | 'drift' | 'warmup';

export function evaluate(current: KernelPrefix, baseline: KernelPrefix | null): Verdict {
  if (baseline === null) return 'warmup';
  if (
    current.sha256 === baseline.sha256 &&
    current.kernel_ids.length === baseline.kernel_ids.length &&
    current.kernel_ids.every((id, i) => id === baseline.kernel_ids[i])
  ) {
    return 'stable';
  }
  return 'drift';
}

function _readJson(file: string): Json | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Json;
  } catch {
    return null;
  }
}

function _live_prefix(): KernelPrefix | null {
  const router = _readJson(ROUTER);
  if (router === null) return null;
  const ids = kernel_ids(router);
  // Scope only — the baseline and the comparison are untouched. An empty kernel
  // list used to collapse into the same `null` as an unreadable router, so a
  // router that compiled to zero kernel rules was reported as a missing file;
  // it is a dead scan scope, and a digest over no bodies is a constant that
  // would then look byte-stable forever.
  assertScanned({
    gate: 'check_kernel_prefix_stability',
    scanned: ids.length,
    units: 'kernel rule(s)',
    roots: ['dist/router.json (kernel)', 'dist/agent-src/rules'],
  });
  return compute_prefix(ids, (id) => fs.readFileSync(path.join(RULES_DIR, `${id}.md`), 'utf-8'));
}

function main(argv: string[]): number {
  const asJson = argv.includes('--json');
  const update = argv.includes('--update-baseline');
  for (const a of argv) {
    if (!['--json', '--update-baseline', '-h', '--help'].includes(a)) {
      process.stderr.write(`error: unknown argument: ${a}\n`);
      return 1;
    }
    if (a === '-h' || a === '--help') {
      process.stdout.write('usage: check_kernel_prefix_stability [--json] [--update-baseline]\n');
      return 0;
    }
  }

  let current: KernelPrefix | null;
  try {
    current = _live_prefix();
  } catch (e) {
    // 1 is the documented "file error" code — the gate could not run. 2 is
    // reserved for drift, i.e. a prefix that was read and did change.
    if (e instanceof DeadScopeError) {
      process.stderr.write(`error: ${e.message}\n`);
      return 1;
    }
    process.stderr.write(`error: cannot read kernel bodies: ${(e as Error).message}\n`);
    return 1;
  }
  if (current === null) {
    process.stderr.write(
      `error: cannot read ${path.relative(REPO_ROOT, ROUTER)} / kernel bodies — run \`task sync\` first\n`,
    );
    return 1;
  }

  if (update) {
    fs.writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2) + '\n');
    process.stdout.write(
      `✅  kernel-prefix snapshot written: ${path.relative(REPO_ROOT, SNAPSHOT)} ` +
        `(${current.kernel_ids.length} kernel rules, sha256 ${current.sha256.slice(0, 12)}…)\n`,
    );
    return 0;
  }

  const baselineRaw = _readJson(SNAPSHOT);
  const baseline = baselineRaw === null ? null : (baselineRaw as unknown as KernelPrefix);
  const verdict = evaluate(current, baseline);

  if (asJson) {
    process.stdout.write(JSON.stringify({ verdict, current, baseline }, null, 2) + '\n');
  } else if (verdict === 'warmup') {
    process.stdout.write(
      `⚠️  no kernel-prefix snapshot — run \`--update-baseline\` to anchor it.\n`,
    );
  } else if (verdict === 'stable') {
    process.stdout.write(
      `✅  kernel always-loaded prefix is byte-stable (${current.kernel_ids.length} rules, sha256 ${current.sha256.slice(0, 12)}…).\n`,
    );
  } else {
    process.stdout.write(
      `❌  kernel always-loaded prefix CHANGED — this invalidates the KV-cache for every\n` +
        `   consumer on every request. If intended (a reviewed kernel-rule edit under the\n` +
        `   kernel-rule-edits slow-rollout): re-anchor with\n` +
        `   \`./scripts-run src/scripts/check_kernel_prefix_stability --update-baseline\`\n` +
        `   and keep that snapshot change in the same PR. Otherwise revert the kernel change.\n`,
    );
  }
  return verdict === 'drift' ? 2 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const _IS_MAIN =
  _isCliEntry();
if (_IS_MAIN) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
