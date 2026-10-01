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
