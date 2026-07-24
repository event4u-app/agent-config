/**
 * Witness: `reach:doctor` mutates nothing (road-to-internet-reach Phase 2,
 * step 7).
 *
 * "Read-only" is the load-bearing claim of the whole reach layer — the command
 * exists to tell an operator what to install, never to install it. A comment
 * asserting that is worth nothing, so this test measures it: the worktree is
 * snapshotted before and after REAL runs of the command, and any mutation
 * fails the test.
 *
 * Three independent instruments, because each has a blind spot the others
 * cover:
 *
 *   1. `git status --porcelain --ignored` — catches content changes to tracked
 *      files and the creation of any untracked file, INCLUDING a gitignored
 *      one. `--ignored` is load-bearing: without it, a write into any
 *      gitignored path (a stray log, a cache dir, `.agent-settings.yml`) was
 *      invisible to this instrument, and instrument 3 only covers
 *      `agents/runtime/`.
 *   2. `git ls-files` + per-file (size, mtime, mode) — catches an in-place
 *      rewrite that restores identical bytes (invisible to instrument 1, since
 *      git compares content) and any chmod.
 *   3. A recursive (path, size, mtime) walk of `agents/runtime/` — the
 *      gitignored state tree, kept as its own instrument because it also
 *      detects same-byte rewrites there, which instrument 1 cannot.
 *
 * EXACT SCOPE OF THE CLAIM — deliberately stated, because an assertion that
 * over-reaches is worse than a narrow one. What is measured:
 *
 *   - every tracked path (content, size, mtime, mode);
 *   - every untracked path, gitignored or not, whose PARENT directory is not
 *     itself wholly ignored;
 *   - every path under `agents/runtime/`, including same-byte rewrites.
 *
 * What is NOT measured, and therefore not claimed: a write inside a wholly
 * ignored directory other than `agents/runtime/` (git collapses such a
 * directory to a single `!!` entry and reports nothing about its contents — no
 * `--ignored` mode changes that), any write OUTSIDE the worktree (`$HOME`,
 * `/tmp`, `/usr/local`), and vitest's own transient
 * `vitest.config.ts.timestamp-*.mjs` at the repo root (see `HARNESS_NOISE_RE`,
 * whose narrowness is itself asserted below). Those rest on different evidence: the command opens no
 * file for writing at all, install prescriptions are echoed strings that are
 * never executed, and the schema gate keeps `probe_args` flag-shaped so a probe
 * cannot be handed an output path — see `tests/scripts/reach_doctor.test.ts`.
 *
 * Nothing here is mocked: the command runs as a child process through the same
 * `tsx` the dispatcher uses, against the shipped registry, in the repo root.
 * `--deep` is deliberately NOT exercised — it is the one mode that touches the
 * network, and a test suite must never fire it.
 *
 * The test writes no file inside the repo: snapshots are held in memory, and
 * the `--registry` fixture (the one write-capable input the command accepts)
 * lives in `os.tmpdir()`.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DOCTOR = path.join(REPO, 'src', 'scripts', 'reach_doctor.ts');
const TSX_CLI = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const RUNTIME_DIR = path.join(REPO, 'agents', 'runtime');

function git(args: string[]): string {
    const run = spawnSync('git', args, { cwd: REPO, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    if (run.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${run.stderr}`);
    }
    return run.stdout;
}

/**
 * Instrument 1 — tracked-content + untracked-creation snapshot, gitignored
 * paths included. `--ignored` widens it from "no visible change" to "no change
 * anywhere in the worktree", which is what the read-only claim needs.
 */
function porcelain(): string {
    return git(['status', '--porcelain', '--ignored']);
}

/** Instrument 2 — (path, size, mtime) over every tracked file. */
function trackedStats(): Map<string, string> {
    const stats = new Map<string, string>();
    for (const rel of git(['ls-files', '-z']).split('\0')) {
        if (rel === '') continue;
        try {
            const stat = fs.statSync(path.join(REPO, rel));
            stats.set(rel, `${stat.size}:${stat.mtimeMs}:${stat.mode}`);
        } catch {
            // A tracked-but-absent path is itself a stable fact; record it as
            // such so its (re)appearance would show up as a difference.
            stats.set(rel, 'absent');
        }
    }
    return stats;
}

/** Instrument 3 — (path, size, mtime) over the gitignored runtime state tree. */
function runtimeStats(dir: string = RUNTIME_DIR, prefix = ''): Map<string, string> {
    const stats = new Map<string, string>();
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return stats;
    }
    for (const entry of entries) {
        const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            stats.set(`${rel}/`, 'dir');
            for (const [key, value] of runtimeStats(abs, rel)) stats.set(key, value);
            continue;
        }
        try {
            const stat = fs.statSync(abs);
            stats.set(rel, `${stat.size}:${stat.mtimeMs}:${stat.mode}`);
        } catch {
            stats.set(rel, 'absent');
        }
    }
    return stats;
}

function diffMaps(before: Map<string, string>, after: Map<string, string>): string[] {
    const changes: string[] = [];
    for (const [key, value] of before) {
        const now = after.get(key);
        if (now === undefined) changes.push(`disappeared: ${key}`);
        else if (now !== value) changes.push(`mutated: ${key} (${value} → ${now})`);
    }
    for (const key of after.keys()) {
        if (!before.has(key)) changes.push(`created: ${key}`);
    }
    return changes;
}

/**
 * ATTRIBUTION, not just detection.
 *
 * A repo-wide snapshot is the right instrument for "did THIS command write?" and
 * the wrong one for "did anything write?" — under `vitest run` several hundred
 * test files execute in parallel in this same worktree, and their temp fixtures,
 * build outputs and state files land inside it while this test is measuring.
 * Comparing raw snapshots therefore fails on changes this command did not make:
 * the test passed in isolation and failed in the full suite, which is a defect in
 * the instrument, not evidence about the command.
 *
 * So the comparison is made attributable. A change is charged to the command only
 * if it does NOT also appear across an identically-shaped window in which the
 * command was never invoked: `attributableChanges()` measures the real window,
 * and — only when something moved — an ambient window around a no-op child, then
 * subtracts it. Anything left is caused by the command under test.
 *
 * This keeps the strong claim (nothing anywhere in the worktree, tracked or
 * ignored) while removing the suite's own noise, and it cannot mask a real write:
 * for a doctor-caused path to be subtracted, the ambient window would have to
 * produce that very same path independently.
 */
type Snapshot = { porcelain: string; tracked: Map<string, string>; runtime: Map<string, string> };

function snapshot(): Snapshot {
    return { porcelain: porcelain(), tracked: trackedStats(), runtime: runtimeStats() };
}

/**
 * Paths under `agents/runtime/` that OTHER test files legitimately write while
 * this one measures — so a diff there says nothing about `reach:doctor`.
 *
 * This is not a convenience escape; it is a measured fact. Under the full suite
 * this witness failed **reproducibly** (2/2 runs) on exactly one entry:
 *
 *   runtime: mutated: council/events.log (7921:… → 9270:…)
 *
 * `agents/runtime/council/events.log` is the council layer's append-only event
 * log, written by `tests/scripts/council_cli.test.ts` running in parallel in this
 * same worktree. The doctor cannot reach it: it holds no write primitive at all
 * (asserted separately below), so any change there is by construction someone
 * else's. Watching a shared mutable state tree from a witness test is the defect —
 * scoping it out is the fix, and the structural assertion is what keeps the claim
 * honest without it.
 */
const FOREIGN_RUNTIME_RE = /^council\//;

/**
 * Reach scripts — scanned for write primitives, which is the load-bearing
 * evidence once the shared-state instrument is scoped down.
 */
const REACH_SOURCES = [
    'src/scripts/reach_doctor.ts',
    'src/scripts/check_reach_channels.ts',
    'src/scripts/check_reach_staleness.ts',
    'src/scripts/validate_reach_prescriptions.ts',
    'src/scripts/_lib/tool_probe.ts',
];

const WRITE_PRIMITIVES = [
    'writeFileSync',
    'appendFileSync',
    'mkdirSync',
    'mkdtempSync',
    'rmSync',
    'rmdirSync',
    'unlinkSync',
    'renameSync',
    'copyFileSync',
    'chmodSync',
    'chownSync',
    'utimesSync',
    'truncateSync',
    'createWriteStream',
    'openSync',
    'writeSync',
];

/**
 * The ONE named exception: vitest/vite writes a transient
 * `vitest.config.ts.timestamp-<n>-<hash>.mjs` into the repo root while loading
 * its own config, and deletes it milliseconds later. It appears and vanishes
 * whenever a sibling test file starts, so it lands inside this window at random
 * and the ambient window cannot reproduce it (the name is unique per write).
 *
 * Scoped as tightly as possible: the test runner's own config-timestamp file at
 * the repo root, nothing else. It is NOT a general "ignore untracked files"
 * escape — anything the doctor could plausibly write is still measured.
 */
const HARNESS_NOISE_RE = /(?:^|\/)vite(?:st)?\.config\.[cm]?[jt]s\.timestamp-\d+-[0-9a-f]+\.mjs$/;

function isHarnessNoise(porcelainLine: string): boolean {
    // Porcelain shape: `XY <path>` (e.g. `?? vitest.config.ts.timestamp-….mjs`).
    return HARNESS_NOISE_RE.test(porcelainLine.slice(3).trim());
}

function changesBetween(before: Snapshot, after: Snapshot): Set<string> {
    const out = new Set<string>();
    const beforeLines = new Set(before.porcelain.split('\n'));
    const afterLines = new Set(after.porcelain.split('\n'));
    for (const line of afterLines) {
        if (line !== '' && !beforeLines.has(line) && !isHarnessNoise(line)) {
            out.add(`porcelain-new: ${line}`);
        }
    }
    for (const line of beforeLines) {
        if (line !== '' && !afterLines.has(line) && !isHarnessNoise(line)) {
            out.add(`porcelain-gone: ${line}`);
        }
    }
    for (const change of diffMaps(before.tracked, after.tracked)) out.add(`tracked: ${change}`);
    for (const change of diffMaps(before.runtime, after.runtime)) {
        // `change` reads `mutated: <rel> (…)` / `created: <rel>` / `disappeared: <rel>`.
        const rel = change.replace(/^[a-z]+: /, '').replace(/ \(.*$/, '');
        if (FOREIGN_RUNTIME_RE.test(rel)) continue;
        out.add(`runtime: ${change}`);
    }
    return out;
}

/** The ambient window: the same instruments around a child that writes nothing. */
function ambientChanges(): Set<string> {
    const before = snapshot();
    const run = spawnSync(process.execPath, ['--version'], { cwd: REPO, encoding: 'utf-8' });
    expect(run.status).toBe(0);
    return changesBetween(before, snapshot());
}

/**
 * Run `body` between two snapshots and return only the changes that are NOT
 * explainable by the parallel suite. The ambient window is measured immediately
 * after the real one, so the two are as close in time as possible.
 */
function attributableChanges(body: () => void): string[] {
    const before = snapshot();
    expect(before.tracked.size).toBeGreaterThan(100); // the instrument works
    body();
    const observed = changesBetween(before, snapshot());
    if (observed.size === 0) return [];
    const ambient = ambientChanges();
    return [...observed].filter((change) => !ambient.has(change));
}

function runDoctor(args: string[]): { status: number | null; stdout: string; stderr: string } {
    const run = spawnSync(process.execPath, [TSX_CLI, DOCTOR, ...args], {
        cwd: REPO,
        encoding: 'utf-8',
        // No CI marker is injected: the point is to run the command exactly as
        // an operator does. `--deep` is never among `args`.
        env: process.env,
    });
    if (run.error !== undefined) throw run.error;
    return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

describe('witness — the instruments themselves', () => {
    it('the harness-noise exception matches ONLY vitest config-timestamp files', () => {
        expect(isHarnessNoise('?? vitest.config.ts.timestamp-1784928872469-2ee1f9d9.mjs')).toBe(
            true,
        );
        expect(isHarnessNoise('?? vite.config.mts.timestamp-1-abc.mjs')).toBe(true);
        // Anything the command could plausibly write is still measured.
        for (const line of [
            '?? agents/runtime/state/reach.json',
            '!! .agent-settings.yml',
            ' M src/config/reach-channels.yml',
            '?? reach-doctor.log',
            '?? vitest.config.ts',
            '?? tools/vitest.config.ts.timestamp.mjs',
        ]) {
            expect(isHarnessNoise(line), line).toBe(false);
        }
    });

    it('the foreign-runtime exception matches ONLY the council event tree, not reach state', () => {
        expect(FOREIGN_RUNTIME_RE.test('council/events.log')).toBe(true);
        for (const rel of [
            'state/reach.json',
            'state/context-hygiene.json',
            'tmp/reach-proto/NOTES.md',
            'reach-council/events.log',
        ]) {
            expect(FOREIGN_RUNTIME_RE.test(rel), rel).toBe(false);
        }
    });

    it('STRUCTURAL — no reach script contains a filesystem write primitive at all', () => {
        // This is what makes the narrowed path-watching above honest rather than
        // lax: a program with no write call cannot write to a path this test
        // does not watch. A future edit that adds one breaks this assertion.
        const offenders: string[] = [];
        for (const rel of REACH_SOURCES) {
            const source = fs.readFileSync(path.join(REPO, rel), 'utf-8');
            for (const primitive of WRITE_PRIMITIVES) {
                if (source.includes(primitive)) offenders.push(`${rel} → ${primitive}`);
            }
        }
        expect(offenders).toEqual([]);

        // The instrument must be able to find a needle: a script that legitimately
        // writes must trip the same scan.
        const writer = fs.readFileSync(path.join(REPO, 'src', 'scripts', 'generate_index.ts'), 'utf-8');
        expect(WRITE_PRIMITIVES.some((primitive) => writer.includes(primitive))).toBe(true);
    });
});

describe('witness — reach:doctor is read-only', () => {
    it('GIVEN the repo worktree WHEN reach:doctor runs (table, json, strict, single-channel) THEN no path inside the worktree — tracked or gitignored — is created, modified, or removed', () => {
        expect(fs.existsSync(TSX_CLI)).toBe(true);

        // `--ignored` is really in effect: at least one `!!` entry. Without this,
        // dropping the flag would silently narrow the witness back to "no VISIBLE
        // change" while the test kept passing.
        expect(porcelain()).toMatch(/^!! /m);

        const changes = attributableChanges(() => {
            // Every non-network mode, back to back — one run could be read-only
            // by accident, four covering all output paths could not.
            const table = runDoctor([]);
            const json = runDoctor(['--format', 'json']);
            const strict = runDoctor(['--strict']);
            const single = runDoctor(['--channel', 'github', '--format', 'json']);

            // The command really ran and really produced a report (a crashed
            // binary would also mutate nothing — that must not read as a pass).
            expect(table.status).toBe(0);
            expect(table.stdout).toContain('Reach channels');
            expect(json.status).toBe(0);
            expect(() => JSON.parse(json.stdout) as unknown).not.toThrow();
            // `--strict` may legitimately be 1 here (a backend can be missing on
            // this machine); 0 and 1 are both real reports, anything else is not.
            expect([0, 1]).toContain(strict.status);
            expect(single.status).toBe(0);
            expect(JSON.parse(single.stdout)).toMatchObject({ deep: false });
        });

        expect(changes).toEqual([]);
    });

    it('GIVEN a --strict run that exits non-zero THEN the failing path is still write-free', () => {
        const changes = attributableChanges(() => {
            // An unknown channel is the usage-error path (exit 2) — error
            // handling is where a stray log / state write is most likely to hide.
            const run = runDoctor(['--channel', 'no-such-channel-xyz', '--strict']);
            expect(run.status).toBe(2);
        });

        expect(changes).toEqual([]);
    });

    it('GIVEN --registry <fixture> — the one write-capable input — THEN neither the accepted nor the refused file mutates the worktree', () => {
        // `--registry` was never exercised here, yet it is the only flag that
        // feeds operator-controlled data into the probe layer. Both branches
        // run: a well-formed fixture (which really probes) and a hostile one
        // (which the schema gate refuses).
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-witness-'));
        const marker = path.join(tmp, 'poc-marker');
        const good = path.join(tmp, 'good.yml');
        const hostile = path.join(tmp, 'hostile.yml');
        fs.writeFileSync(
            good,
            [
                'schema_version: reach-channels-v1',
                '',
                'channels:',
                '  - id: rss',
                '    description: A fixture registry whose backend is really probed.',
                '    tier: zero-config',
                '    lifecycle: stable',
                '    override_key: reach.channels.rss.backend',
                '    last_verified: "2026-07-24"',
                '    backends:',
                '      - id: node',
                '        probe_cmd: node',
                '        probe_args: ["--version"]',
                '        install:',
                '          default: brew install node@22',
                '',
            ].join('\n'),
            'utf-8',
        );
        fs.writeFileSync(
            hostile,
            fs
                .readFileSync(
                    path.join(REPO, 'tests', 'fixtures', 'reach-channels', 'hostile-shell-payload.yml'),
                    'utf-8',
                )
                .replace('/tmp/agent-config-reach-poc-marker', marker),
            'utf-8',
        );

        try {
            const changes = attributableChanges(() => {
                const accepted = runDoctor(['--registry', good, '--format', 'json']);
                expect(accepted.status).toBe(0);
                expect(JSON.parse(accepted.stdout)).toMatchObject({ deep: false });

                const refused = runDoctor(['--registry', hostile]);
                expect(refused.status).toBe(2);
                expect(refused.stderr).toContain('refusing to probe it');
                // The refused file's payload would have written this — it must
                // not exist. Its target is inside `tmp`, i.e. OUTSIDE the repo,
                // so the snapshot instruments alone would not have caught it.
                expect(fs.existsSync(marker)).toBe(false);
            });

            // `attributableChanges` already covers all three instruments.
            expect(changes).toEqual([]);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
