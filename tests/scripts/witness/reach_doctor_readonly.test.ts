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
 *      one, as long as its parent directory is not itself wholly ignored.
 *      `--ignored` is load-bearing: without it, a write into any gitignored
 *      path (a stray log, a cache dir, `.agent-settings.yml`) would be
 *      invisible to this instrument.
 *   2. `git ls-files` + per-file (size, mtime, mode) — catches an in-place
 *      rewrite that restores identical bytes (invisible to instrument 1, since
 *      git compares content) and any chmod.
 *   3. A STRUCTURAL scan of the reach scripts' TypeScript ASTs (instruments
 *      1–2 observe one machine on one day; this one observes the program). It
 *      parses each source with the TypeScript compiler API and reports a write
 *      primitive only when the name appears in CALLEE position of a real call
 *      expression — `fs.writeFileSync(…)`, `writeFileSync(…)`,
 *      `fs.promises.writeFile(…)`, `createWriteStream(…)`, `openSync(p, 'w')`.
 *      It is a parse, NOT a text search: a commented-out `writeFileSync(…)` and
 *      the string literal `'writeFileSync'` cannot match, because the AST has no
 *      comment node and no string-literal node in callee position. That property
 *      is asserted directly below on in-memory fixtures, so the instrument's own
 *      claim is measured rather than asserted.
 *
 *      What the AST scan CANNOT see, stated plainly: a write reached through a
 *      dynamically-built callee (`fs[verb](…)` where `verb` is computed,
 *      `eval`, a function received as a parameter), a write performed by a
 *      spawned child process or a `require`d/imported third-party module, and a
 *      write through a non-`fs` API (a native addon, an `fd` handed out
 *      elsewhere). None of that is in its reach — the run-window instruments
 *      (1–2) are what cover it, by watching the filesystem itself while the
 *      real command executes. The two halves are complementary on purpose:
 *      the parse generalises beyond this machine, the snapshots see through
 *      indirection.
 *
 * WHAT WAS REMOVED, AND WHY — this witness used to carry a fourth instrument: a
 * recursive (path, size, mtime, mode) walk of `agents/runtime/`, diffed around
 * the real runs. It is gone, deliberately. `agents/runtime/` is SHARED MUTABLE
 * STATE: under `task test-ts` several hundred test files execute in parallel in
 * this same worktree and write into that tree while this test is measuring. The
 * instrument therefore failed reproducibly on files this command cannot reach —
 * first `runtime: mutated: council/events.log` (the council event log, written by
 * `tests/scripts/council_cli.test.ts`), and then, once that path had been scoped
 * out with a regex, `runtime: mutated: mcp-telemetry/calls.jsonl` (written by an
 * MCP test). The second failure is the verdict on the first fix: each scope-out
 * is one more allowlist entry, which this repo's own `autonomous-execution` rule
 * names as an antipattern — when the list has to grow, the tool shape is wrong,
 * not the list. Watching shared mutable state from a witness measures the SUITE,
 * not the command under test.
 *
 * THE COST, not hidden: removing it NARROWS what this witness measures. Writes
 * under `agents/runtime/` — including same-byte rewrites and bare mtime touches,
 * which no other instrument here can see inside a wholly ignored directory — are
 * no longer observed at all. Nothing replaces that coverage one-for-one. What
 * carries the load instead:
 *
 *   - instrument 3, the AST scan — the command contains no filesystem write
 *     primitive at all, so it cannot write to a path this test no longer
 *     watches; a future edit that adds one breaks that assertion loudly;
 *   - the runs' working directory — every invocation below runs with `cwd` set
 *     to the repo root and never chdirs, so a relative-path write lands inside
 *     the watched worktree and instruments 1–2 catch it;
 *   - the reach surface's own files are TRACKED — `src/config/reach-channels.yml`
 *     and every script in `REACH_SOURCES` appear in `git ls-files`, so the most
 *     plausible real regression, writing `last_verified` back into its own
 *     registry, is still compared by instrument 1 (content) AND instrument 2
 *     (size, mtime, mode), the latter even for a byte-identical rewrite.
 *
 * EXACT SCOPE OF THE CLAIM — deliberately stated, because an assertion that
 * over-reaches is worse than a narrow one. What is measured:
 *
 *   - every tracked path (content, size, mtime, mode), including same-byte
 *     rewrites;
 *   - every untracked path, gitignored or not, whose PARENT directory is not
 *     itself wholly ignored.
 *
 * What is NOT measured, and therefore not claimed:
 *
 *   - `agents/runtime/` is NO LONGER WATCHED. This is a deliberate narrowing of
 *     the claim, not an oversight: the tree is shared mutable state and a
 *     witness cannot attribute a change there to the command (see above).
 *   - a write inside any other wholly ignored directory (git collapses such a
 *     directory to a single `!!` entry and reports nothing about its contents —
 *     no `--ignored` mode changes that);
 *   - any write OUTSIDE the worktree (`$HOME`, `/tmp`, `/usr/local`);
 *   - vitest's own transient `vitest.config.ts.timestamp-*.mjs` at the repo root
 *     (see `HARNESS_NOISE_RE`, whose narrowness is itself asserted below).
 *
 * Those rest on different evidence: the command opens no file for writing at all,
 * install prescriptions are echoed strings that are never executed, and the
 * schema gate keeps `probe_args` flag-shaped so a probe cannot be handed an
 * output path — see `tests/scripts/reach_doctor.test.ts`.
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

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DOCTOR = path.join(REPO, 'src', 'scripts', 'reach_doctor.ts');
const TSX_CLI = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');

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
type Snapshot = { porcelain: string; tracked: Map<string, string> };

function snapshot(): Snapshot {
    return { porcelain: porcelain(), tracked: trackedStats() };
}

/**
 * Reach scripts — scanned for write primitives, which is the load-bearing
 * evidence now that the shared-state instrument is removed (see header).
 */
const REACH_SOURCES = [
    'src/scripts/reach_doctor.ts',
    'src/scripts/check_reach_channels.ts',
    'src/scripts/check_reach_staleness.ts',
    'src/scripts/validate_reach_prescriptions.ts',
    'src/scripts/_lib/tool_probe.ts',
];

/**
 * Filesystem write primitives, keyed by the name that would appear in CALLEE
 * position. Both the sync forms and the promise forms (`fs/promises`,
 * `fs.promises`) are listed, because `fsp.writeFile(…)` is exactly as much of a
 * write as `fs.writeFileSync(…)`.
 *
 * Deliberately ABSENT: bare `write` and bare `open`. Those names are shared with
 * non-filesystem APIs that are legitimate here (`process.stdout.write`, a
 * stream's `write`), and a scan that flagged them would report noise instead of
 * evidence. `writeSync` and the mode-gated `openSync` below are the fs-specific
 * spellings, and they are covered.
 */
const WRITE_PRIMITIVES = new Set([
    'writeFileSync',
    'writeFile',
    'appendFileSync',
    'appendFile',
    'mkdirSync',
    'mkdir',
    'mkdtempSync',
    'mkdtemp',
    'rmSync',
    'rm',
    'rmdirSync',
    'rmdir',
    'unlinkSync',
    'unlink',
    'renameSync',
    'rename',
    'copyFileSync',
    'copyFile',
    'chmodSync',
    'chmod',
    'chownSync',
    'chown',
    'utimesSync',
    'utimes',
    'truncateSync',
    'truncate',
    'createWriteStream',
    'writeSync',
]);

/**
 * `openSync` / `open` are writes only in a write mode — `openSync(p, 'r')` is a
 * read. The flags argument decides.
 */
const MODE_GATED_PRIMITIVES = new Set(['openSync', 'open']);

/** A write-capable `fs` open flag contains `w`, `a`, or `+` (`r+` writes). */
const WRITE_FLAG_RE = /[wa+]/;

/**
 * The callee's name, or `undefined` when it is not statically a name.
 *
 * Only these three node shapes can yield a name, and none of them can be a
 * comment or a string literal — that is precisely why this scan cannot be
 * tripped by prose:
 *
 *   - `writeFileSync(…)`            → Identifier
 *   - `fs.promises.writeFile(…)`    → PropertyAccessExpression, tail name
 *   - `fs['writeFileSync'](…)`      → ElementAccessExpression with a literal
 *                                     index (statically knowable, so honoured)
 *
 * A computed callee (`fs[verb](…)`) yields `undefined` — see the header for why
 * that is left to the sandboxed-run instruments.
 */
function calleeName(expression: ts.Expression): string | undefined {
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    if (ts.isElementAccessExpression(expression)) {
        const index = expression.argumentExpression;
        if (ts.isStringLiteralLike(index)) return index.text;
    }
    return undefined;
}

function isWriteModeOpen(call: ts.CallExpression): boolean {
    const flags = call.arguments[1];
    // `openSync(path)` defaults to 'r' — a read.
    if (flags === undefined) return false;
    // A literal flag is decidable; anything computed cannot be PROVEN read-only,
    // so it is reported. The scan fails loud, never silent.
    if (ts.isStringLiteralLike(flags)) return WRITE_FLAG_RE.test(flags.text);
    return true;
}

/**
 * Parse `source` and return every write primitive that appears as a real call,
 * as `<primitive>@L<line>`. Text occurrences in comments, string literals,
 * type positions, or as a plain identifier reference (e.g. an import name that
 * is never called) do not appear here — only call expressions do.
 */
function findWriteCalls(source: string, fileName = 'scan.ts'): string[] {
    const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const hits: string[] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const name = calleeName(node.expression);
            if (name !== undefined) {
                const gated = MODE_GATED_PRIMITIVES.has(name);
                if ((gated && isWriteModeOpen(node)) || (!gated && WRITE_PRIMITIVES.has(name))) {
                    const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
                    hits.push(`${name}@L${line}`);
                }
            }
        }
        ts.forEachChild(node, visit);
    };

    visit(tree);
    return hits;
}

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

    it('the AST scan reports a CALL, never a comment or a string literal', () => {
        // These four fixtures are the instrument's own proof. If the scan ever
        // regresses to a text search (`source.includes(primitive)`), the first two
        // flip to detected and this test fails — which is the point: the honesty
        // of the structural claim below rests on it being a parse.

        // 1. Commented-out write — no comment node sits in callee position.
        expect(findWriteCalls("// writeFileSync('x','y')\nconst a = 1;\n")).toEqual([]);
        expect(
            findWriteCalls('/* fs.writeFileSync("x","y"); fs.mkdirSync("d"); */\nexport const b = 2;\n'),
        ).toEqual([]);

        // 2. String literal naming the primitive — data, not a call.
        expect(findWriteCalls("const msg = 'writeFileSync';\n")).toEqual([]);
        expect(
            findWriteCalls(
                "const banned = ['writeFileSync', 'mkdirSync'];\nconsole.log('never call createWriteStream');\n",
            ),
        ).toEqual([]);
        // Not-called references (an import name, a type position) are not calls.
        expect(findWriteCalls("import { writeFileSync } from 'node:fs';\nexport const c = 3;\n")).toEqual(
            [],
        );

        // 3. A real call — detected, with its line.
        expect(findWriteCalls('const x = 1;\nfs.writeFileSync("a", "b");\n')).toEqual([
            'writeFileSync@L2',
        ]);
        expect(findWriteCalls('writeFileSync("a", "b");\n')).toEqual(['writeFileSync@L1']);

        // 4. Promise form and stream form — detected.
        expect(findWriteCalls('await fs.promises.writeFile("a", "b");\n')).toEqual(['writeFile@L1']);
        expect(findWriteCalls('await fsp.writeFile("a", "b");\n')).toEqual(['writeFile@L1']);
        expect(findWriteCalls('const s = createWriteStream("a");\n')).toEqual([
            'createWriteStream@L1',
        ]);
        expect(findWriteCalls('fs["writeFileSync"]("a", "b");\n')).toEqual(['writeFileSync@L1']);

        // `openSync` is mode-gated: a read flag is not a write, a write flag is.
        expect(findWriteCalls('const fd = fs.openSync("a", "r");\n')).toEqual([]);
        expect(findWriteCalls('const fd = fs.openSync("a");\n')).toEqual([]);
        expect(findWriteCalls('const fd = fs.openSync("a", "w");\n')).toEqual(['openSync@L1']);
        expect(findWriteCalls('const fd = fs.openSync("a", "r+");\n')).toEqual(['openSync@L1']);
        // A computed flag cannot be proven read-only, so it is reported.
        expect(findWriteCalls('const fd = fs.openSync("a", mode);\n')).toEqual(['openSync@L1']);

        // Non-fs `write` spellings stay out of the report (they are not fs writes).
        expect(findWriteCalls('process.stdout.write("hello");\n')).toEqual([]);
    });

    it('STRUCTURAL — no reach script contains a filesystem write primitive at all', () => {
        // This is what makes the narrowed path-watching above honest rather than
        // lax: a program with no write call cannot write to a path this test
        // does not watch. A future edit that adds one breaks this assertion.
        //
        // The scan is an AST parse (see `findWriteCalls`), so this is a claim
        // about the program's call graph, not about its bytes.
        const offenders: string[] = [];
        for (const rel of REACH_SOURCES) {
            const source = fs.readFileSync(path.join(REPO, rel), 'utf-8');
            for (const hit of findWriteCalls(source, rel)) offenders.push(`${rel} → ${hit}`);
        }
        expect(offenders).toEqual([]);

        // The instrument must be able to find a needle: a script that legitimately
        // writes must trip the same AST scan (not merely contain the word).
        const writerRel = path.join('src', 'scripts', 'generate_index.ts');
        const writer = fs.readFileSync(path.join(REPO, writerRel), 'utf-8');
        const needle = findWriteCalls(writer, writerRel);
        expect(needle.length).toBeGreaterThan(0);
        expect(needle.some((hit) => hit.startsWith('writeFileSync@'))).toBe(true);
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

            // `attributableChanges` already covers both snapshot instruments.
            expect(changes).toEqual([]);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
