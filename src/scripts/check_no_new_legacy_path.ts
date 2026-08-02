#!/usr/bin/env tsx
/**
 * Regression guard: no NEW dead-root references in `src/` or `tests/`.
 *
 * Ported from the retired Python `src/scripts/check_no_new_legacy_path.py` (ADR-200,
 * Phase 4 / Wave 4c). The CLI contract is pinned — `--base`
 * / `--stdin` flags, exit codes (0 no new references, 1 a new reference,
 * 2 internal error), stdout split, byte-identical finding messages,
 * same diff parsing, same EXEMPT set, and the same faithful-twin rule.
 * Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.
 *
 * NOTE (faithful-twin rule): this guard's `.py` original is in its own
 * EXEMPT set and legitimately contains the literal `.agent-src.uncondensed`
 * as data. This `.ts` twin contains it too — and the faithful-twin rule
 * (matching the bare directory name against the same-stem `.py` sibling)
 * auto-exempts it, so the guard does not flag its own port.
 *
 * `.agent-src.uncondensed/` is the dead pre-relocation source path (the source
 * of truth moved to `src/`, ADR-051). Existing stale prose mentions in `src/`
 * are fixed opportunistically; this guard stops the debt from growing: it
 * fails when a diff ADDS a new `.agent-src.uncondensed/` line under `src/`.
 *
 * Files that legitimately contain the literal forever are exempt:
 *   - src/scripts/_lib/agent_src.py        (the LEGACY_SRC constant)
 *   - src/scripts/check_references.py       (forbidden-substring detector)
 *   - src/scripts/check_condensed_paths.py  (forbidden-substring detector)
 *   - src/scripts/check_source_pointer_freshness.ts (forbidden-substring detector)
 *
 * Faithful-twin rule (Python→TypeScript migration): a `*.ts` file is also
 * exempt when a same-stem `*.py` sibling exists AND already contains the
 * literal. A TS twin that faithfully mirrors a pre-existing legacy reference
 * (e.g. agent_src.ts, install_regenerator.ts) is not a NEW dead-path — the
 * reference already lived in the ported `.py`. This cannot mask a genuinely
 * new dead-path: a fresh one introduced only in a `.ts` has no `.py` sibling
 * already carrying it.
 *
 * Diff-based: compares added lines against a base ref (default `origin/main`).
 * On a clean checkout with no diff, it is a no-op (exit 0).
 *
 * Usage:  tsx src/scripts/check_no_new_legacy_path.ts [--base <ref>]
 * Exit:   0 = no new references, 1 = a new reference was added, 2 = internal error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkRatchet } from './_lib/gate_baseline.js';

const LEGACY = '.agent-src.uncondensed/';
const EXEMPT: ReadonlySet<string> = new Set([
    'src/scripts/_lib/agent_src.py',
    'src/scripts/check_references.py',
    'src/scripts/check_condensed_paths.py',
    'src/scripts/check_no_new_legacy_path.py', // this file documents the literal
    // The `.ts` twin needs its own entry now: the docstring above says the
    // faithful-twin rule covers it, but that rule reads a `.py` sibling from
    // disk and the py2ts final deletion removed every sibling — so since then
    // ANY edit to this guard's own message strings flags the guard. Surfaced
    // by the Phase-5 edit that added the existing-literal pass below.
    'src/scripts/check_no_new_legacy_path.ts',
    'src/scripts/check_source_pointer_freshness.ts', // forbidden-substring detector for the legacy tree
]);

type TwinCheck = (curFile: string) => boolean;

/**
 * True when `curFile` is a `*.ts` whose same-stem `*.py` sibling exists and
 * already references the legacy tree — a faithful TS port of a pre-existing
 * legacy reference, not a new dead-path. The sibling check matches the bare
 * directory name (`.agent-src.uncondensed`, no trailing slash) because the
 * `.py` may reference it as a path SEGMENT (`root / ".agent-src.uncondensed"`)
 * while the `.ts` twin / its comments use the slash form — both are the same
 * faithful reference. Reads from disk relative to cwd (CI runs the guard at
 * the repo root); injectable in tests via the `twinCheck` param of
 * `find_offenders`.
 */
function _is_faithful_twin(curFile: string): boolean {
    if (!curFile.endsWith('.ts')) {
        return false;
    }
    const sibling = curFile.slice(0, -3) + '.py';
    try {
        const content = fs.readFileSync(sibling, 'utf-8');
        return content.includes(LEGACY.replace(/\/+$/, ''));
    } catch {
        return false;
    }
}

function _base(): string {
    const argv = process.argv;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--base' && i + 1 < argv.length) {
            return argv[i + 1]!;
        }
    }
    return 'origin/main';
}

/**
 * Added (`+`) lines under a non-exempt src/ file that introduce the legacy
 * path. Pure over the diff string except for the faithful-twin sibling check
 * (`twinCheck`, injectable for unit tests).
 */
function find_offenders(diffText: string, twinCheck: TwinCheck = _is_faithful_twin): string[] {
    let curFile: string | null = null;
    const offenders: string[] = [];
    for (const line of diffText.split('\n')) {
        if (line.startsWith('+++ b/')) {
            curFile = line.slice(6);
            continue;
        }
        if (line.startsWith('+') && !line.startsWith('+++')) {
            // Scoped to src/ + tests/: a full diff (e.g. `gh pr diff`) carries
            // every path; only added lines under those roots (minus the exempt
            // detectors and faithful TS twins) count.
            //
            // tests/ added 2026-07-29. Four separate tests were found pinning the
            // dead root — two via fixture paths, one via a `resolve_entry`
            // expectation, one asserting that a missing root exits 0 — and each
            // kept a gate's blindness green because test and implementation agreed
            // on a tree reality had abandoned. A FULL-tree lint over tests/ is the
            // wrong shape (44 files / 213 hits, most of them legitimate: the
            // legacy detectors' own tests, validator_ignore substrings, and
            // synthetic fixtures under tmpdir()). Diff-scoping is what makes this
            // tractable — existing debt stays, growth stops, no allowlist.
            if (
                curFile &&
                (curFile.startsWith('src/') || curFile.startsWith('tests/')) &&
                !EXEMPT.has(curFile) &&
                line.includes(LEGACY) &&
                !twinCheck(curFile)
            ) {
                offenders.push(`${curFile}: ${line.slice(1).trim().slice(0, 100)}`);
            }
        }
    }
    return offenders;
}

// ---------------------------------------------------------------------------
// Pass 2 — EXISTING hardcoded legacy scan roots (ratcheted).
//
// The diff pass above stops the debt from growing. It is structurally blind to
// the debt that is already there — and every one of the 14 dead gates found in
// 2026-07 was pre-existing, so a new-violations-only check could never have
// seen them (road-to-gates-that-can-fail Phase 5).
//
// WHY THIS IS NOT THE FULL-TREE LINT THAT WAS ALREADY REJECTED. The note in
// `find_offenders` records a measured rejection: a full-tree lint over `tests/`
// hits 44 files / 213 lines, most of them legitimate (the legacy detectors'
// own test data, `validator_ignore` substrings, synthetic tmpdir fixtures), so
// the signal drowns. That measurement stands and this pass does not repeat it.
// Three things make this scope different:
//
//   1. It reads EXECUTABLE code only — `src/scripts/**/*.{ts,mts,mjs}`. No
//      prose, no docs, no tests, no fixtures.
//   2. It counts only lines that CONSTRUCT A PATH — the literal must reach
//      `path.join(...)` inside a string. A detector holding the literal as
//      data to match, strip, or print is not a scan root and is not counted.
//      Measured on 2026-08-02: 236 raw mentions in src/scripts → 147 string
//      literals → 70 path-constructing lines. The narrowing is the point.
//   3. It is a RATCHET, not a hard fail. The current count is committed to
//      `src/config/gate-violation-baselines.json`; the gate goes red only when
//      the count RISES. Every Phase-1 repair lowers it, and the baseline's
//      56-day expiry (see `_lib/gate_baseline.ts`) stops a stalled number from
//      hardening into configuration.
// ---------------------------------------------------------------------------

/** Gate key in `src/config/gate-violation-baselines.json`. */
export const HARDCODED_ROOT_GATE = 'check_no_new_legacy_path:hardcoded-scan-roots';

/** The executable-code root this pass reads. */
export const HARDCODED_ROOT_SCAN_DIR = 'src/scripts';

/** Bare directory name — the form that appears inside a `path.join(...)` call. */
const LEGACY_DIRNAME = LEGACY.replace(/\/+$/, '');

/**
 * Files allowed to construct a legacy path forever.
 *
 * `_lib/agent_src.ts` is the shared resolver — owning the constant is its whole
 * job, and every gate that routes through it survived the ADR-051 move. Exempting
 * it is what makes the count mean "gates that bypassed the resolver".
 */
const HARDCODED_ROOT_EXEMPT: ReadonlySet<string> = new Set(['src/scripts/_lib/agent_src.ts']);

const _STRING_LITERAL_LEGACY = new RegExp(
    `['"\`][^'"\`]*${LEGACY_DIRNAME.replace(/\./g, '\\.')}`,
);

function _isCommentLine(trimmed: string): boolean {
    return (
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('#')
    );
}

function* _walkScripts(dir: string): Generator<string> {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            yield* _walkScripts(full);
        } else if (/\.(ts|mts|mjs)$/.test(e.name) && !/\.d\.m?ts$/.test(e.name)) {
            yield full;
        }
    }
}

/**
 * Lines under `src/scripts/` that build a filesystem path against the retired
 * tree. Returns `file:line: <source>` strings, sorted by path.
 *
 * `repoRoot` defaults to cwd (CI runs the guard at the repo root) and is
 * injectable so tests can point at a fixture tree.
 */
export function find_hardcoded_scan_roots(
    repoRoot: string = process.cwd(),
    twinCheck: TwinCheck = _is_faithful_twin,
): string[] {
    const root = path.join(repoRoot, HARDCODED_ROOT_SCAN_DIR);
    const findings: string[] = [];
    for (const abs of _walkScripts(root)) {
        const rel = path.relative(repoRoot, abs).split(path.sep).join('/');
        if (EXEMPT.has(rel) || HARDCODED_ROOT_EXEMPT.has(rel) || twinCheck(rel)) {
            continue;
        }
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf-8');
        } catch {
            continue;
        }
        if (!text.includes(LEGACY_DIRNAME)) {
            continue;
        }
        text.split('\n').forEach((line, i) => {
            if (!line.includes(LEGACY_DIRNAME)) return;
            const trimmed = line.trim();
            if (_isCommentLine(trimmed)) return;
            if (!/path\.join\s*\(/.test(line)) return;
            if (!_STRING_LITERAL_LEGACY.test(line)) return;
            findings.push(`${rel}:${i + 1}: ${trimmed.slice(0, 100)}`);
        });
    }
    findings.sort();
    return findings;
}

/**
 * Run the existing-literal pass and judge it against the committed baseline.
 * Returns 0 when the count is at or below the baseline (and the baseline is
 * fresh), 1 otherwise. Prints either way — a passing ratchet still reports the
 * live number, which is the whole point of committing it.
 */
export function checkHardcodedScanRoots(repoRoot: string = process.cwd()): number {
    const findings = find_hardcoded_scan_roots(repoRoot);
    const verdict = checkRatchet({
        gate: HARDCODED_ROOT_GATE,
        actual: findings.length,
        repoRoot,
    });
    if (verdict.ok) {
        process.stdout.write(`✅  ${verdict.message}\n`);
        return 0;
    }
    process.stdout.write(
        `❌  Hardcoded \`${LEGACY}\` scan root(s) under ${HARDCODED_ROOT_SCAN_DIR}/ ` +
            'above the recorded baseline:\n',
    );
    for (const f of findings.slice(0, 20)) {
        process.stdout.write(`  🔴 ${f}\n`);
    }
    if (findings.length > 20) {
        process.stdout.write(`  … and ${findings.length - 20} more\n`);
    }
    process.stdout.write(`\n${verdict.message}\n`);
    return 1;
}

function main(): number {
    // --stdin: read a unified diff from stdin (CI pipes `gh pr diff` — auth-safe,
    // no `git fetch <base>` extraheader race on shallow PR-merge checkouts, the
    // documented failure the kernel-bundle step sidesteps the same way).
    let offenders: string[];
    if (process.argv.includes('--stdin')) {
        const stdin = fs.readFileSync(0, 'utf-8') as string;
        offenders = find_offenders(stdin);
    } else {
        const base = _base();
        // Two-dot diff: working tree vs base — catches committed + uncommitted
        // additions (robust locally and where the working tree is the branch tip).
        let proc: ReturnType<typeof spawnSync>;
        try {
            proc = spawnSync('git', ['diff', base, '--', 'src/', 'tests/'], {
                encoding: 'utf-8',
            });
        } catch (exc) {
            const msg = exc instanceof Error ? exc.message : String(exc);
            process.stdout.write(`❌  check_no_new_legacy_path: git diff failed: ${msg}\n`);
            return 2;
        }
        if (proc.error) {
            process.stdout.write(
                `❌  check_no_new_legacy_path: git diff failed: ${proc.error.message}\n`,
            );
            return 2;
        }
        const code = proc.status;
        if (code !== 0 && code !== 1) {
            // base ref missing (shallow clone / detached) — degrade to no-op.
            process.stdout.write(
                `⚠️  check_no_new_legacy_path: base '${base}' unavailable; skipping (no-op).\n`,
            );
            return 0;
        }
        offenders = find_offenders((proc.stdout as string | null) ?? '');
    }

    let rc = 0;
    if (offenders.length) {
        process.stdout.write(
            '❌  New `.agent-src.uncondensed/` reference(s) added under src/ ' +
                '(the source of truth is `src/` — ADR-051):\n',
        );
        for (const o of offenders) {
            process.stdout.write(`  🔴 ${o}\n`);
        }
        process.stdout.write(
            '\nFix: reference the real `src/` target. Existing stale prose is ' +
                'migrated opportunistically; do not ADD new dead-path references.\n',
        );
        rc = 1;
    } else {
        process.stdout.write('✅  No new `.agent-src.uncondensed/` references added under src/.\n');
    }

    // Pass 2 — the pre-existing hardcoded scan roots the diff pass cannot see.
    // Skippable for the golden-parity harness, which compares this guard's
    // diff behaviour against a pinned reference implementation.
    if (!process.argv.includes('--no-existing')) {
        rc = Math.max(rc, checkHardcodedScanRoots());
    }
    return rc;
}

const _HERE = fileURLToPath(import.meta.url);
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

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { LEGACY, EXEMPT, _is_faithful_twin, find_offenders, main };
