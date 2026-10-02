# Completion review — the implementation behind PR #2156

A previous council round reviewed the GOVERNANCE surface of this branch (two
files: a workflow and a manifest row) and returned `confirmed-non-expanding`,
2 of 2. One seat added a merge-level `REQUEST_CHANGES` whose substance was:

> the diff asks reviewers to trust comments for the new gate's correctness;
> the highest-leverage change is to include or link the implementation,
> independent regression tests, and passing CI evidence.

That is the ask this round answers. Below is the full implementation and test
diff. Review it as code, not as governance. Find defects.

## What the change claims to do

1. `exemptionReason` in `check_estate_count.ts` now reads YAML block scalars.
   The shared `parse_frontmatter` splits on the first colon and has no block
   support, so `estate_offset_exempt: >-` with an indented body returned the
   literal string `>-`. Measured: 38 of 221 exemptions in the tree are written
   that way.
2. An ADDED exemption whose reason names none of ten measured disposition
   lemmas, or repeats another added file's reason verbatim, fails the estate
   gate. Existing files are never re-read.
3. `draft_roadmaps` is reported beside the counts and gates nothing.
4. A new gate, `check_verify_expectation_delta`, fails a `verify:` clause the
   change ADDS that names a command and carries no `-> 0` / `-> /regex/`
   expectation. Prose clauses and single-token backticked file pointers are
   carved out. The arrow grammar is imported from `_lib/verify_clause.ts`.

## Questions, in priority order

1. **Correctness of the block-scalar reader.** `blockScalar()` in
   `check_estate_count.ts`. Does it mis-read any legal YAML shape it will meet
   in this tree — a quoted value, a nested key, a comment line, a key whose
   value starts with `>` as prose, a CRLF file, a block at the end of the
   frontmatter? Does returning `''` for an empty block (rather than `null`)
   actually prevent the fallback it claims to prevent?
2. **Can the shape rule be satisfied by boilerplate?** The vocabulary is ten
   word stems matched case-insensitively anywhere in the reason. What is the
   cheapest string that passes while saying nothing, and does the in-diff
   duplicate rule catch it?
3. **`bareClausesIn()` in `check_verify_expectation_delta.ts`.** It reads `+`
   lines from a unified patch. Can a legitimate change be convicted of adding a
   clause it did not write — a rename, a file-mode change, a hunk header
   containing `verify:`, a `+++` line, a diff of a diff? Can a real bare clause
   escape it?
4. **The pointer carve-out.** `POINTER_RE` is
   `/^[^\s`]+\.(?:ts|tsx|js|mjs|cjs|md|json|ya?ml|html|txt|lock)(?::\d+)?$/i`.
   What runnable command does this wrongly exempt? Is there a shape in this
   tree's conventions that it wrongly refuses?
5. **The self-test and the unit tests.** Do they discriminate, or do any of them
   pass for the wrong reason? Name any case that would stay green if the
   behaviour it claims to pin were removed.
6. **Anything else** — a resource leak, an unhandled throw, a `maxBuffer`
   overrun on a large patch, an exit code that lies.

Answer with findings, each one actionable. If a claim above is not supported by
the code, say so plainly. "No findings" is an acceptable answer only if you
state what you checked and what you could not.


## The new gate, in full

```ts
#!/usr/bin/env tsx
/**
 * A `verify:` clause this change ADDS names what its command must produce.
 *
 * THE DEFECT. `verify: `cat notes.md`` is a legal, green, fully-conforming step
 * field whose oracle cannot say no: the step gets flipped on a command that was
 * never able to fail. The grammar that fixes it shipped in
 * `_lib/verify_clause.ts` — the optional `-> 0` / `-> /regex/` tail — and
 * `closure_scan` reports the unfalsifiable share as a number. Reporting is
 * where it stopped. Measured over the active estate on 2026-10-01: 173 clauses,
 * 99 naming a command, 34 naming an expectation, and all 34 authored in one
 * round. The grammar exists and nothing asks anyone to use it.
 *
 * WHY DIFF-SCOPED, AND WHY THAT IS NOT A WEAKER VERSION OF ESTATE-SCOPED.
 * Gating the estate would red 139 clauses across every roadmap active before
 * this round, on a day nobody authored any of them. A gate that arrives red on
 * most of its corpus is a backlog with an exit code, and the predictable end is
 * that it gets weakened until it finds nothing. This reads only clauses the
 * change under review ADDED or CHANGED, so the corpus is whatever the author is
 * already writing, and the old clauses stay legal exactly as prose does.
 *
 * REPLAYED BEFORE IT WAS WRITTEN, not after. Over the last thirty merges on
 * the trunk that touched a roadmap: 145 added command-bearing
 * clauses, 96 already carrying an expectation, 49 bare — and **6 of the 30
 * merges would have gone red**, 39 of the 49 sitting in a single bulk-authoring
 * round. 20% is under the one-in-four share at which this ratchet was to be
 * withdrawn as too costly. `--replay <n>` reproduces that table on demand,
 * which is the whole measurement rather than a memory of it.
 *
 * THE POINTER CARVE-OUT, and it is measured rather than assumed. 8 of those 49
 * bare clauses are not commands at all: a backticked FILE PATH or test id
 * written after the label, which the shared parser reads as a command because
 * that is what a backticked token looks like to it. Demanding `-> 0` from
 * `docs/CLAIMS.md` teaches authors to paste a meaningless arrow, which is the
 * failure this gate exists to prevent arriving through its own front door. So a
 * single whitespace-free token ending in a source or document extension, with
 * an optional `:line` suffix, is a POINTER and is not asked for an oracle.
 * Anything containing a space is a command: `cat file.md` still has to answer.
 *
 * The carve-out lives HERE and not in the parser. Widening `verify_clause.ts`
 * would change what `closure_scan` and the run-continuation hook see, and both
 * were measured on the current grammar.
 *
 * THE ARROW IS NOT RE-PARSED. {@link VERIFY_ARROW_SOURCE} is imported, never
 * copied: a second arrow regex is how a grammar and its gate drift, and a
 * drifted pair fails silently — an expectation simply stops being read and a
 * conforming clause is refused.
 *
 * CLI:
 *   ./scripts-run src/scripts/check_verify_expectation_delta
 *   ./scripts-run src/scripts/check_verify_expectation_delta --base origin/main
 *   ./scripts-run src/scripts/check_verify_expectation_delta --replay 30
 *   ./scripts-run src/scripts/check_verify_expectation_delta --self-test
 *
 * Exit codes: 0 clean · 1 a bare clause was added · 2 usage error or no base ref.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { VERIFY_ARROW_SOURCE, parseVerifyClause } from './_lib/verify_clause.js';
import { resolveBaseRef } from './_lib/ratchet_base_ref.js';
import { reportScanned, DeadScopeError } from './_lib/scan_scope.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const GATE = 'check_verify_expectation_delta';
const ROADMAPS_REL = 'agents/roadmaps';
const SCRIPT_REL = 'src/scripts/check_verify_expectation_delta.ts';

/** Declared here so a truncated case list is a visible diff, not a quiet pass. */
const SELF_TEST_MIN_CASES = 6;
const SELF_TEST_MIN_REJECT = 3;

/**
 * A backticked value that points AT something rather than running.
 *
 * One token, no whitespace, a source or document extension, optionally a
 * `:line` suffix. Measured at 8 of 49 bare clauses over thirty merges — a sixth
 * of what an uncarved gate would have fired on.
 */
const POINTER_RE = /^[^\s`]+\.(?:ts|tsx|js|mjs|cjs|md|json|ya?ml|html|txt|lock)(?::\d+)?$/i;

/** Does this clause body name something to RUN, as opposed to something to open? */
export function isPointer(command: string): boolean {
    return POINTER_RE.test(command.trim());
}

export interface BareClause {
    /** Repo-relative path of the roadmap the clause was added to. */
    readonly file: string;
    /** The command half, as written. */
    readonly command: string;
}

function git(args: readonly string[], cwd: string): { ok: boolean; stdout: string } {
    const res = spawnSync('git', [...args], { cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    return { ok: res.status === 0, stdout: res.stdout ?? '' };
}

/**
 * The bare clauses a unified patch ADDS.
 *
 * Reads `+` lines only. A context line carrying a bare clause is a clause this
 * change did not write, and convicting on it would make flipping a checkbox two
 * lines above an unrelated verify line fail the author's change — the exact
 * collateral that turns a diff-scoped gate back into an estate-scoped one.
 */
export function bareClausesIn(patch: string): BareClause[] {
    const out: BareClause[] = [];
    let file = '';
    for (const raw of patch.split('\n')) {
        const fm = /^\+\+\+ b\/(.+)$/.exec(raw);
        if (fm !== null) {
            file = fm[1] as string;
            continue;
        }
        if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
        const body = raw.slice(1);
        if (!body.includes('verify:')) continue;
        const clause = parseVerifyClause(body);
        // No clause, or the prose (MANUAL) form — prose stays legal by design.
        if (clause === null || clause.command === null) continue;
        if (clause.expect !== null) continue;
        if (isPointer(clause.command)) continue;
        out.push({ file, command: clause.command });
    }
    return out;
}

export interface ReplayRow {
    readonly merge: string;
    readonly bare: number;
}

export interface Replay {
    readonly merges: number;
    readonly added: number;
    readonly withExpectation: number;
    readonly bare: readonly BareClause[];
    readonly redMerges: readonly ReplayRow[];
}

/** Replay the proposed rule over the last `n` merges that touched the roadmaps. */
export function replay(repoRoot: string, n: number, ref = 'origin/main'): Replay {
    const list = git(
        ['log', '--merges', '--first-parent', ref, `--max-count=${String(n)}`, '--format=%h', '--', `${ROADMAPS_REL}/*.md`],
        repoRoot,
    );
    const merges = list.stdout.split('\n').filter((s) => s.trim() !== '');
    const bare: BareClause[] = [];
    const redMerges: ReplayRow[] = [];
    let added = 0;
    let withExpectation = 0;
    for (const m of merges) {
        const patch = git(['diff', '--unified=0', `${m}^1`, m, '--', ROADMAPS_REL], repoRoot);
        // Counted separately from `bareClausesIn` so the denominator is the real
        // one: a report of "6 merges red" with no total is a number nobody can
        // place.
        for (const raw of patch.stdout.split('\n')) {
            if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
            const clause = parseVerifyClause(raw.slice(1));
            if (clause === null || clause.command === null) continue;
            added += 1;
            if (clause.expect !== null) withExpectation += 1;
        }
        const hits = bareClausesIn(patch.stdout);
        bare.push(...hits);
        if (hits.length > 0) redMerges.push({ merge: m, bare: hits.length });
    }
    return { merges: merges.length, added, withExpectation, bare, redMerges };
}

function repoRootFrom(start: string): string {
    let dir = path.resolve(start);
    for (;;) {
        if (fs.existsSync(path.join(dir, ROADMAPS_REL))) return dir;
        const up = path.dirname(dir);
        if (up === dir) return path.resolve(start);
        dir = up;
    }
}

function renderReplay(rep: Replay): string {
    const out: string[] = [];
    out.push(`${GATE} --replay: ${String(rep.merges)} merge(s) replayed`);
    out.push(`  added command-bearing clauses  ${String(rep.added)}`);
    out.push(`    with an expectation          ${String(rep.withExpectation)}`);
    out.push(`    bare (this gate would fire)  ${String(rep.bare.length)}`);
    const share = rep.merges === 0 ? 0 : Math.round((rep.redMerges.length / rep.merges) * 100);
    out.push(`  merges that would go RED       ${String(rep.redMerges.length)} of ${String(rep.merges)} (${String(share)}%)`);
    for (const r of [...rep.redMerges].sort((a, b) => b.bare - a.bare)) {
        out.push(`    ${r.merge} ${String(r.bare).padStart(3)} bare clause(s)`);
    }
    return out.join('\n') + '\n';
}

/** Fixtures for `--self-test`: a throwaway repo with a base commit and a change. */
function fixture(opts: { base: string; added: readonly string[] }): number {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-delta-'));
    try {
        const run = (...args: string[]): void => {
            const r = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
            if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
        };
        const write = (rel: string, body: string): void => {
            const abs = path.join(dir, rel);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, body, 'utf-8');
        };
        run('init', '-q', '-b', 'main');
        run('config', 'user.email', 'verify@test.local');
        run('config', 'user.name', 'verify');
        run('config', 'commit.gpgsign', 'false');
        write(`${ROADMAPS_REL}/road-to-base.md`, `# Roadmap: base\n\n## Phase 1\n\n- [ ] **1.1** s\n      verify: ${opts.base}\n`);
        run('add', '-A');
        run('commit', '-qm', 'base');
        run('checkout', '-qb', 'feat/change');
        opts.added.forEach((line, i) => {
            write(
                `${ROADMAPS_REL}/road-to-new-${String(i)}.md`,
                `# Roadmap: new ${String(i)}\n\n## Phase 1\n\n- [ ] **1.1** s\n      verify: ${line}\n`,
            );
        });
        // An edit that touches a roadmap and adds no clause. Without it the
        // "nothing added" case has nothing to commit and dies in git rather than
        // in the gate — and that case is the one proving the base clause is not
        // re-read, so it has to reach the gate to mean anything.
        write(`${ROADMAPS_REL}/road-to-base.md`, `# Roadmap: base\n\n## Phase 1\n\n- [x] **1.1** s\n      verify: ${opts.base}\n`);
        run('add', '-A');
        run('commit', '-qm', 'change');
        return runGateCli(REPO_ROOT, SCRIPT_REL, ['--base', 'main'], dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function selfTest(): number {
    const cases: SelfTestCase[] = [
        {
            name: 'added clause naming a command and no expectation → reject',
            expect: 'reject',
            run: () => fixture({ base: '`true` -> 0', added: ['`./scripts-run src/scripts/check_claims`'] }),
        },
        {
            name: 'added clause naming a command AND an exit expectation → accept',
            expect: 'accept',
            run: () => fixture({ base: '`true` -> 0', added: ['`./scripts-run src/scripts/check_claims` -> 0'] }),
        },
        {
            name: 'added clause naming a command AND a regex expectation → accept',
            expect: 'accept',
            run: () => fixture({ base: '`true` -> 0', added: ['`grep -c x f.md` -> /^[1-9]/'] }),
        },
        {
            // Prose stays legal. Forbidding it would invalidate the large
            // majority of clauses in the tree, which is the decision
            // `verify_clause.ts` records and this gate does not reopen.
            name: 'added PROSE clause → accept (the MANUAL form is legal by design)',
            expect: 'accept',
            run: () => fixture({ base: '`true` -> 0', added: ['a human reads the rendered page and confirms it'] }),
        },
        {
            // The measured carve-out: 8 of 49 bare clauses over thirty merges.
            name: 'added clause naming a FILE PATH → accept (a pointer is not a command)',
            expect: 'accept',
            run: () => fixture({ base: '`true` -> 0', added: ['`tests/scripts/dispatch_integrity.test.ts`'] }),
        },
        {
            name: 'a pointer with a :line suffix → accept',
            expect: 'accept',
            run: () => fixture({ base: '`true` -> 0', added: ['`turn_end_gate_hook.test.ts:1427`'] }),
        },
        {
            // `cat file.md` is a command whose exit decides nothing — and it is
            // still asked for an oracle, because the carve-out is about SHAPE,
            // not about whether the author chose a weak command.
            name: 'a command that merely cats a file → reject (the carve-out is one token only)',
            expect: 'reject',
            run: () => fixture({ base: '`true` -> 0', added: ['`cat docs/CLAIMS.md`'] }),
        },
        {
            name: 'two added clauses, one bare → reject',
            expect: 'reject',
            run: () =>
                fixture({ base: '`true` -> 0', added: ['`./scripts-run src/scripts/check_claims` -> 0', '`npx vitest run x`'] }),
        },
        {
            // The grandfathering half: an untouched bare clause at base must not
            // convict a change that added nothing.
            name: 'a bare clause ALREADY at base, nothing added → accept',
            expect: 'accept',
            run: () => fixture({ base: '`cat notes.md`', added: [] }),
        },
    ];
    return runSelfTest({ gate: GATE, cases, minCases: SELF_TEST_MIN_CASES, minRejectCases: SELF_TEST_MIN_REJECT });
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    const repoRoot = repoRootFrom(process.cwd());

    const replayIdx = argv.indexOf('--replay');
    if (replayIdx !== -1) {
        const raw = argv[replayIdx + 1];
        const n = raw === undefined ? NaN : Number(raw);
        if (!Number.isInteger(n) || n <= 0) {
            process.stderr.write(`usage: ${GATE} [--base <ref>] [--replay <n>] [--self-test]\n`);
            return 2;
        }
        process.stdout.write(renderReplay(replay(repoRoot, n)));
        return 0;
    }

    const baseIdx = argv.indexOf('--base');
    let baseRef: string | undefined;
    if (baseIdx !== -1) {
        const next = argv[baseIdx + 1];
        if (next === undefined || next.startsWith('-')) {
            process.stderr.write(`usage: ${GATE} [--base <ref>] [--replay <n>] [--self-test]\n`);
            return 2;
        }
        baseRef = next;
    }
    const ref = baseRef ?? resolveBaseRef(repoRoot);
    if (ref === null) {
        process.stderr.write(
            `❌  ${GATE}: no base ref resolved (no origin/main, no merge-commit parent).\n` +
                '    This gate reads the clauses a CHANGE adds, so with no base there is no change\n' +
                '    to read — and a diff-scoped gate with no diff passes every possible tree.\n' +
                '    Fetch the base (`git fetch origin main`) or name it: --base origin/main\n',
        );
        return 2;
    }

    const patch = git(['diff', '--unified=0', '--find-renames', `${ref}...HEAD`, '--', ROADMAPS_REL], repoRoot);
    if (!patch.ok) {
        process.stderr.write(`❌  ${GATE}: git diff against ${ref} failed — the change could not be read.\n`);
        return 2;
    }

    const bare = bareClausesIn(patch.stdout);
    // The unit is the added CLAUSE, not the file: a change adding ten clauses to
    // one roadmap scanned ten things, and reporting "1 file" would understate
    // what was read. An empty diff is a real answer here (nothing was added),
    // never a dead scope, so the count is allowed to be zero.
    const added = patch.stdout
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++') && l.includes('verify:')).length;
    try {
        reportScanned({
            gate: GATE,
            scanned: added,
            units: 'added verify clause(s)',
            roots: [ROADMAPS_REL],
            allowEmpty: 'a change that adds no verify clause has nothing to check',
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${GATE}: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    if (bare.length === 0) {
        process.stdout.write(`✅  ${GATE}: every added verify clause states what its command must produce.\n`);
        return 0;
    }

    for (const b of bare) {
        process.stderr.write(`❌  ${b.file}: verify clause names a command and no expectation.\n    ${b.command.slice(0, 160)}\n`);
    }
    process.stderr.write(
        `\n    ${String(bare.length)} added verify clause(s) cannot fail. A clause that names a command and\n` +
            '    no expectation is an oracle that cannot say no: the step gets flipped on a\n' +
            '    command that was never able to fail. State what the command must produce:\n' +
            '\n' +
            '        verify: `<cmd>` -> 0          the command must exit 0\n' +
            '        verify: `<cmd>` -> /regex/    its output must match\n' +
            '\n' +
            '    Pick the regex form when the exit status decides nothing — `grep -c`, `wc`,\n' +
            '    `head` and `cat` all exit 0 on content nobody looked at, so `-> 0` there is an\n' +
            '    expectation that still cannot fail. Prose clauses stay legal and are not read\n' +
            '    here; so is a backticked file path, which points rather than runs. This gate\n' +
            '    reads only the clauses THIS change adds — nothing already in the tree.\n',
    );
    return 1;
}

/** Keep the arrow grammar single-sourced; a copy here would drift silently. */
export { VERIFY_ARROW_SOURCE };

function isCliEntry(): boolean {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    return pathToFileURL(path.resolve(entry)).href === pathToFileURL(fileURLToPath(import.meta.url)).href;
}

if (isCliEntry()) {
    process.exit(main());
}

```

## Its tests, in full

```ts
/**
 * `check_verify_expectation_delta` — the added-clause ratchet, both directions.
 *
 * The gate's own `--self-test` already drives its CLI against throwaway
 * repositories, and these cases do not duplicate it. What they add is the two
 * things a self-test cannot show a reviewer:
 *
 * 1. the UNIT behaviour of `bareClausesIn` over a hand-written patch, so a
 *    change to the `+`-line reading is a visible test diff rather than a shift
 *    in six end-to-end exit codes;
 * 2. that the arrow grammar is single-sourced — this gate must not carry its
 *    own copy of the expectation regex, which is the drift the parser module's
 *    "WHY ONE PARSER" note exists to prevent and which nothing else here pins.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { bareClausesIn, isPointer, VERIFY_ARROW_SOURCE } from '../../src/scripts/check_verify_expectation_delta.js';
import { VERIFY_ARROW_SOURCE as GRAMMAR_SOURCE } from '../../src/scripts/_lib/verify_clause.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

/** A unified patch adding one `verify:` line to one roadmap. */
function patch(file: string, ...lines: readonly string[]): string {
    return [
        `diff --git a/${file} b/${file}`,
        `--- a/${file}`,
        `+++ b/${file}`,
        '@@ -4,0 +5 @@',
        ...lines.map((l) => `+${l}`),
    ].join('\n');
}

describe('check_verify_expectation_delta — which added clauses fire', () => {
    it('fires on an added clause naming a command and no expectation', () => {
        const out = bareClausesIn(patch('agents/roadmaps/road-to-x.md', '      verify: `npx vitest run tests/x.test.ts`'));
        expect(out).toEqual([{ file: 'agents/roadmaps/road-to-x.md', command: 'npx vitest run tests/x.test.ts' }]);
    });

    it('is silent on an added clause carrying either expectation form', () => {
        expect(bareClausesIn(patch('agents/roadmaps/r.md', '      verify: `npx vitest run x` -> 0'))).toEqual([]);
        expect(bareClausesIn(patch('agents/roadmaps/r.md', '      verify: `grep -c x f.md` -> /^[1-9]/'))).toEqual([]);
    });

    it('is silent on the prose MANUAL form — prose stays legal by design', () => {
        // Forbidding prose would invalidate the large majority of clauses in the
        // tree at once, which is the decision `verify_clause.ts` records. This
        // gate does not reopen it, and a regression that started reading prose
        // as a command would red every roadmap in the next bulk round.
        expect(bareClausesIn(patch('agents/roadmaps/r.md', '      verify: a human opens the page and confirms the banner'))).toEqual(
            [],
        );
    });

    it('reads ADDED lines only — a context line is a clause this change did not write', () => {
        const withContext = [
            'diff --git a/agents/roadmaps/r.md b/agents/roadmaps/r.md',
            '--- a/agents/roadmaps/r.md',
            '+++ b/agents/roadmaps/r.md',
            '@@ -4,2 +4,2 @@',
            '-- [ ] **1.1** a step',
            '+- [x] **1.1** a step',
            '       verify: `cat notes.md`',
        ].join('\n');
        // The canonical shape: flipping a checkbox two lines above an untouched
        // bare clause must not convict the author of writing it. Without this,
        // the gate is estate-scoped in everything but name.
        expect(bareClausesIn(withContext)).toEqual([]);
    });

    it('attributes each hit to its own file across a multi-file patch', () => {
        const two = [
            patch('agents/roadmaps/road-to-a.md', '      verify: `npx vitest run a`'),
            patch('agents/roadmaps/road-to-b.md', '      verify: `npx vitest run b` -> 0'),
            patch('agents/roadmaps/road-to-c.md', '      verify: `npx vitest run c`'),
        ].join('\n');
        expect(bareClausesIn(two).map((h) => h.file)).toEqual(['agents/roadmaps/road-to-a.md', 'agents/roadmaps/road-to-c.md']);
    });
});

describe('check_verify_expectation_delta — the pointer carve-out', () => {
    it('treats a single-token file path as a pointer, not a command', () => {
        // Measured: 8 of the 49 bare clauses over thirty merges are these. The
        // eight literal values are kept so a narrowing of the extension list is
        // a failing test rather than a silent re-widening of the gate.
        for (const p of [
            'tests/scripts/block_plumbing_writes.test.ts',
            'tests/scripts/dispatch_integrity.test.ts',
            'tests/scripts/hooks/dispatch_hook.test.ts',
            'tests/eval/routing-matrix/README.md',
            'tests/scripts/verification_evidence.test.ts',
            'turn_end_gate_hook.test.ts:1427',
            'docs/CLAIMS.md',
            'ONBOARDING.md',
        ]) {
            expect(isPointer(p), p).toBe(true);
        }
    });

    it('treats anything with a space as a command, however weak its exit status', () => {
        // The carve-out is about SHAPE, not about whether the author picked a
        // command that can fail. `cat docs/CLAIMS.md` is asked for an oracle
        // precisely because `-> 0` on it would be the vacuous expectation the
        // refusal message warns about — the author has to choose a regex.
        expect(isPointer('cat docs/CLAIMS.md')).toBe(false);
        expect(isPointer('npx vitest run tests/scripts/dispatch_integrity.test.ts')).toBe(false);
        expect(isPointer('./scripts-run src/scripts/check_claims')).toBe(false);
        // A bare script name with no extension is not a pointer either: it runs.
        expect(isPointer('check_claims')).toBe(false);
    });
});

describe('check_verify_expectation_delta — the grammar is single-sourced', () => {
    it('re-exports the parser module constant rather than carrying a copy', () => {
        expect(VERIFY_ARROW_SOURCE).toBe(GRAMMAR_SOURCE);
    });

    it('contains no second arrow regex in its own source', () => {
        // The drift this pins: a gate that re-derived `->` would keep passing
        // its own tests while silently disagreeing with the parser about what an
        // expectation is, so a conforming clause would be refused and nobody
        // would learn why. Same guard the parser module asks for by name.
        const src = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/check_verify_expectation_delta.ts'), 'utf-8');
        const body = src.replace(/^[\s\S]*?\n \*\/\n/, '');
        expect(body).not.toMatch(/\(\?:->\|→\)/);
    });
});

```

## The block-scalar reader and the shape vocabulary

```ts
export function exemptionReason(text: string): string | null {
    const block = blockScalar(text, 'estate_offset_exempt');
    if (block !== null) return block === '' ? null : block;
    const fm = parseFrontmatter(text);
    const raw = (fm as Record<string, unknown>)['estate_offset_exempt'];
    if (typeof raw !== 'string') {
        return null;
    }
    const reason = raw.trim().replace(/^["']|["']$/g, '').trim();
    return reason === '' ? null : reason;
}

/**
 * The folded body of `<key>: >-` / `<key>: |`, or `null` when not that form.
 *
 * Returns `''` — not `null` — for a block header with no body, so the caller can
 * tell "declared and empty" from "not a block scalar". An empty block is the
 * blank-reason case the key already refuses, and collapsing it into `null` here
 * would send it back to the flat parser, which would hand back `>-` and accept it.
 */
function blockScalar(text: string, key: string): string | null {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (m === null) return null;
    const lines = (m[1] as string).split(/\r?\n/);
    const head = new RegExp(`^${key}:[ \\t]*(.*)$`);
    for (let i = 0; i < lines.length; i += 1) {
        const hm = head.exec(lines[i] as string);
        if (hm === null) continue;
        // Only the block indicators. A quoted or bare value is the flat form and
        // stays with the flat parser, which already handles it.
        if (!/^[>|][-+]?\d*$/.test((hm[1] as string).trim())) return null;
        const body: string[] = [];
        for (let j = i + 1; j < lines.length; j += 1) {
            const line = lines[j] as string;
            if (line.trim() === '') continue;
            // The first unindented line ends the block — the next key.
            if (!/^[ \t]/.test(line)) break;
            body.push(line.trim());
        }
        return body.join(' ').replace(/\s+/g, ' ').trim();
    }
    return null;
}


/**
 * What an `estate_offset_exempt` reason has to SAY — one vocabulary, two readers.
 *
 * THE DEFECT THIS EXISTS TO NAME. The one-in-one-out rule charges every added
 * active roadmap against a disposed one, and `estate_offset_exempt: <reason>`
 * is the escape hatch that costs "one reviewable line instead of a silent
 * exception". `exemptionReason` accepted any non-empty string, so the line was
 * reviewable in the sense that it existed. Measured 2026-10-01 over the active,
 * `later/` and `archive/` trees: 221 files carry the key, and 43 of them name
 * no alternative disposition at all under the three-lemma set the roadmap named
 * from memory, and 6 under the measured one below — including three that say only
 * `lane N of <parent>`. The escape hatch was free.
 *
 * WHAT A SHAPED REASON SAYS. It names at least one disposition the author
 * considered instead of adding a file: archiving something, parking it in
 * `later/`, merging into an existing roadmap, or any of the words this tree
 * actually uses for those three. The requirement is deliberately NOT "explain
 * yourself well" — that is unjudgeable — but "name what you rejected", which is
 * a word that is either present or absent.
 *
 * WHY THE VOCABULARY IS MEASURED AND NOT CHOSEN. The commissioning roadmap
 * named three lemmas, archive / park / merge, from memory. Over the real
 * population those three cover 178 of 221; the measured ten below cover 215.
 * The 37-file gap is not boilerplate — "Offsetting it individually is not
 * possible without splitting the set" and "no completed roadmap to retire
 * against this addition" both name a rejected alternative in words the
 * three-lemma set does not carry. A refusal vocabulary that reds one added
 * roadmap in five on the house style gets weakened until it finds nothing, so
 * the set here is the one the tree writes. Every number above carries its
 * producing command: `./scripts-run src/scripts/estate_exemption_shape`.
 *
 * `close` is excluded on purpose, and it is the most common verb in these
 * reasons: it almost always refers to closing WORK, not to disposing of a file,
 * so accepting it would make the check pass on a sentence that named nothing.
 *
 * WHY ONE MODULE. Two readers consume this — the estate gate, which refuses,
 * and the measurement script, which reports. A second copy of the lemma list is
 * how a gate and its own evidence drift apart, and a drifted vocabulary fails
 * silently: the report says the tree conforms while the gate refuses it.
 */

/**
 * The dispositions a reason may name, as source strings.
 *
 * Exported individually rather than as one baked regex so the measurement
 * script can report per-lemma counts against the same list the gate refuses on.
 */
export const DISPOSITION_LEMMAS: readonly { readonly name: string; readonly source: string }[] = [
    { name: 'archive', source: String.raw`archiv\w*` },
    { name: 'park', source: String.raw`unpark\w*|park\w*` },
    { name: 'merge', source: String.raw`merg\w*` },
    { name: 'later', source: String.raw`later\/` },
    { name: 'offset', source: String.raw`offset\w*` },
    { name: 'defer', source: String.raw`defer\w*` },
    { name: 'fold', source: String.raw`fold\w*` },
    { name: 'consolidate', source: String.raw`consolidat\w*` },
    { name: 'absorb', source: String.raw`absorb\w*` },
    { name: 'retire', source: String.raw`retir\w*` },
];

/** The whole vocabulary as one alternation — the gate's own test. */
export const DISPOSITION_SOURCE = `\\b(?:${DISPOSITION_LEMMAS.map((l) => l.source).join('|')})`;

const DISPOSITION_RE = new RegExp(DISPOSITION_SOURCE, 'i');

/** Does this reason name at least one rejected alternative? */
export function namesDisposition(reason: string): boolean {
    return DISPOSITION_RE.test(reason);
}

/** Which lemmas a reason names, for the reader's per-file column. */
export function lemmasNamed(reason: string): string[] {
    return DISPOSITION_LEMMAS.filter((l) => new RegExp(`\\b(?:${l.source})`, 'i').test(reason)).map((l) => l.name);
}

/**
 * The comparison key for "two added files say the same thing".
 *
 * Case and whitespace are folded because a reason pasted into a second file and
 * re-wrapped by an editor is the same reason. Nothing else is folded: a reason
 * that differs by one clause is a different reason, and a normaliser clever
 * enough to call those equal would start refusing reasons that genuinely differ.
 */
export function reasonKey(reason: string): string {
    return reason.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** One added file whose exemption reason does not hold up. */
export interface ExemptionFinding {
    readonly file: string;
    readonly kind: 'shapeless' | 'duplicate';
    /** For `duplicate`, the other added file carrying the same reason. */
    readonly twin: string | null;
    readonly reason: string;
}

/**
 * Judge the exemptions a single change ADDS — never the ones already in the tree.
 *
 * Grandfathering is load-bearing rather than polite. 43 of the 221 existing
 * reasons name no disposition; re-reading them would land this check red on a
 * fifth of the corpus, which is a backlog wearing a control's clothes. The
 * input is `classifyDiff`'s exempt ledger, which by construction lists only the
 * files this change added.
 */
export function exemptionFindings(
    exempt: readonly { readonly file: string; readonly reason: string }[],
): ExemptionFinding[] {
    const out: ExemptionFinding[] = [];
    const seen = new Map<string, string>();
    for (const e of exempt) {
        if (!namesDisposition(e.reason)) {
            out.push({ file: e.file, kind: 'shapeless', twin: null, reason: e.reason });
            continue;
        }
        const key = reasonKey(e.reason);
        const twin = seen.get(key);
        if (twin === undefined) {
            seen.set(key, e.file);
            continue;
        }
        out.push({ file: e.file, kind: 'duplicate', twin, reason: e.reason });
    }
    return out;
}

```
