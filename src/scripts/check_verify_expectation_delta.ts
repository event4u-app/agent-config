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
 * THE ARROW IS NOT PARSED HERE AT ALL. This gate asks `parseVerifyClause`
 * whether a clause carries an expectation and never looks at the arrow itself:
 * a second arrow regex is how a grammar and its gate drift, and a drifted pair
 * fails silently — an expectation simply stops being read and a conforming
 * clause is refused. An earlier version re-exported `VERIFY_ARROW_SOURCE` so a
 * test could assert equality with the parser's copy; a reviewer pointed out
 * that comparing two equal STRINGS proves nothing about where either came
 * from, and the re-export is gone. What is asserted instead is behavioural —
 * the gate's verdict changes when the parser's grammar does, because the
 * parser is the only thing that reads it.
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

import { parseVerifyClause } from './_lib/verify_clause.js';
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
 *
 * THE INVOCATION PREFIX IS EXCLUDED, and that is a review finding rather than a
 * refinement: `./src/scripts/check.ts` ends in `.ts` and this pattern exempted
 * it, while being exactly the shape a shebang-bearing script is RUN as in this
 * tree. A path written to be executed starts with `./` or `/`; a pointer is
 * written relative and bare. That is a convention, not a proof — the honest
 * statement is that this discriminates the shapes the tree actually contains
 * and cannot infer intent in general.
 *
 * KNOWN AND NOT FIXED, because the fix is worse than the gap: `Makefile`,
 * `README` and `script.sh` are pointers this refuses, and a path containing a
 * space is a command by the rule above. Widening the extension list buys those
 * and costs the executable-script direction again. Both directions are pinned
 * by test so a later change to this pattern is deliberate.
 */
const POINTER_RE = /^(?!\.{0,2}\/)[^\s`]+\.(?:ts|tsx|js|mjs|cjs|md|json|ya?ml|html|txt|lock)(?::\d+)?$/i;

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

/** A git invocation that FAILED. Never collapsed into an empty-but-plausible read. */
export class GitReadError extends Error {
    constructor(args: readonly string[], stderr: string) {
        super(`git ${args.join(' ')} failed: ${stderr.trim().split('\n')[0] ?? '(no stderr)'}`);
        this.name = 'GitReadError';
    }
}

/**
 * Run git, or throw.
 *
 * `{ ok: false, stdout: '' }` was the inherited shape and it is the wrong one
 * HERE, because both readers below treat stdout as their whole corpus: a failed
 * spawn, a missing ref or a `maxBuffer` overrun would have become "no merges"
 * and "no clauses", and the replay would then print an authoritative-looking
 * table of zeroes that the gate's own header cites as its evidence. A
 * measurement that can silently measure nothing cannot justify the thing it
 * measures. Throwing makes the failure reach an exit code.
 */
function git(args: readonly string[], cwd: string): string {
    const res = spawnSync('git', [...args], { cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    if (res.error !== undefined || res.status !== 0) {
        throw new GitReadError(args, res.stderr ?? res.error?.message ?? '');
    }
    return res.stdout ?? '';
}

/** One added clause, parsed once. The gate and its report read the same list. */
export interface AddedClause {
    readonly file: string;
    readonly command: string;
    /** The clause states an oracle — `-> 0` or `-> /regex/`. */
    readonly hasExpectation: boolean;
    /** The clause points at a file rather than naming something to run. */
    readonly pointer: boolean;
    /** States an oracle, or is exempt from stating one. The gate's predicate. */
    readonly satisfied: boolean;
}

/**
 * A unified-diff line that OPENS a file section — `+++ b/<path>`.
 *
 * Matched as the whole header rather than by a `+++` prefix, because an added
 * CONTENT line whose own text begins with `++` is rendered `+++…` and a prefix
 * test discards it as metadata. Narrow in practice and wrong in principle: this
 * reader claimed to parse a unified diff and was reading its first character.
 * `/dev/null` is the delete side and names no file.
 */
const FILE_HEADER_RE = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/;

/**
 * Every `verify:` clause a unified patch ADDS, each with its verdict.
 *
 * ONE parsed pass, deliberately. The count the gate reports and the set it
 * convicts on used to be derived separately — a line filter for the first, a
 * parse for the second — so a patch with ten `verify:` lines of which three
 * were prose reported "scanned 10" while enforcing over 7. A scan count that
 * does not describe the enforced set is the false-denominator shape this
 * repository's gate-coverage manifest exists to prevent.
 *
 * Reads `+` lines only. A context line carrying a bare clause is a clause this
 * change did not write, and convicting on it would make flipping a checkbox two
 * lines above an unrelated verify line fail the author's change — the exact
 * collateral that turns a diff-scoped gate back into an estate-scoped one.
 */
export function addedClausesIn(patch: string): AddedClause[] {
    const out: AddedClause[] = [];
    let file = '';
    for (const raw of patch.split('\n')) {
        const fm = FILE_HEADER_RE.exec(raw);
        if (fm !== null) {
            file = fm[1] ?? '';
            continue;
        }
        if (!raw.startsWith('+')) continue;
        const body = raw.slice(1);
        if (!body.includes('verify:')) continue;
        const clause = parseVerifyClause(body);
        // No clause, or the prose (MANUAL) form — prose stays legal by design,
        // and an unparseable line is not a clause this gate may convict on.
        if (clause === null || clause.command === null) continue;
        const hasExpectation = clause.expect !== null;
        const pointer = isPointer(clause.command);
        out.push({ file, command: clause.command, hasExpectation, pointer, satisfied: hasExpectation || pointer });
    }
    return out;
}

/** The subset that fails: a command, no expectation, not a pointer. */
export function bareClausesIn(patch: string): BareClause[] {
    return addedClausesIn(patch)
        .filter((c) => !c.satisfied)
        .map((c) => ({ file: c.file, command: c.command }));
}

export interface ReplayRow {
    readonly merge: string;
    readonly bare: number;
}

export interface Replay {
    readonly merges: number;
    readonly added: number;
    readonly withExpectation: number;
    /** Exempted as pointers — reported separately, never folded into the above. */
    readonly pointers: number;
    readonly bare: readonly BareClause[];
    readonly redMerges: readonly ReplayRow[];
}

/**
 * Replay the proposed rule over the last `n` merges that touched the roadmaps.
 *
 * @throws {GitReadError} when any git read fails. Deliberate: this function's
 * output is cited as the evidence for shipping the gate, and an evidence
 * producer that returns zeroes when it could not read anything is worse than
 * one that does not run.
 */
export function replay(repoRoot: string, n: number, ref = 'origin/main'): Replay {
    const list = git(
        ['log', '--merges', '--first-parent', ref, `--max-count=${String(n)}`, '--format=%h', '--', `${ROADMAPS_REL}/*.md`],
        repoRoot,
    );
    const merges = list.split('\n').filter((s) => s.trim() !== '');
    const bare: BareClause[] = [];
    const redMerges: ReplayRow[] = [];
    let added = 0;
    let withExpectation = 0;
    let pointers = 0;
    for (const m of merges) {
        const patch = git(['diff', '--unified=0', `${m}^1`, m, '--', ROADMAPS_REL], repoRoot);
        // One parsed pass feeds both halves, so the denominator describes the
        // same set the verdict is drawn from.
        const clauses = addedClausesIn(patch);
        added += clauses.length;
        withExpectation += clauses.filter((c) => c.hasExpectation).length;
        pointers += clauses.filter((c) => c.pointer).length;
        const hits = clauses.filter((c) => !c.satisfied).map((c) => ({ file: c.file, command: c.command }));
        bare.push(...hits);
        if (hits.length > 0) redMerges.push({ merge: m, bare: hits.length });
    }
    return { merges: merges.length, added, withExpectation, pointers, bare, redMerges };
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
    out.push(`    exempt as a file pointer     ${String(rep.pointers)}`);
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
            //
            // WHAT IT DOES NOT COVER, corrected on a review finding that the
            // earlier wording here overstated: under `--unified=0` the unchanged
            // `verify:` line does not appear in the patch at all, so this case
            // does not exercise context-line handling and would stay green if
            // that handling broke. The unit test `reads ADDED lines only` is
            // what pins it. This case pins the weaker, still real property —
            // that a change adding no clause is not convicted of the base's.
            name: 'a bare clause ALREADY at base, nothing added → accept',
            expect: 'accept',
            run: () => fixture({ base: '`cat notes.md`', added: [] }),
        },
        {
            // An executable script is run, not opened, however it is spelled.
            name: 'an added `./path/script.ts` → reject (an invocation is not a pointer)',
            expect: 'reject',
            run: () => fixture({ base: '`true` -> 0', added: ['`./src/scripts/check_claims.ts`'] }),
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
        try {
            process.stdout.write(renderReplay(replay(repoRoot, n)));
        } catch (err) {
            if (err instanceof GitReadError) {
                process.stderr.write(
                    `❌  ${GATE} --replay: ${err.message}\n` +
                        '    No table is printed. A replay that could not read its own history would\n' +
                        '    otherwise print zeroes, and those zeroes are cited as this gate\'s evidence.\n',
                );
                return 2;
            }
            throw err;
        }
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

    let clauses: AddedClause[];
    try {
        clauses = addedClausesIn(git(['diff', '--unified=0', '--find-renames', `${ref}...HEAD`, '--', ROADMAPS_REL], repoRoot));
    } catch (err) {
        if (err instanceof GitReadError) {
            process.stderr.write(`❌  ${GATE}: ${err.message}\n    The change could not be read, so nothing was checked.\n`);
            return 2;
        }
        throw err;
    }

    const bare = clauses.filter((c) => !c.satisfied);
    // The unit is the added CLAUSE, not the file: a change adding ten clauses to
    // one roadmap scanned ten things, and reporting "1 file" would understate
    // what was read. It is the SAME list the verdict is drawn from, which it was
    // not in the first version — a line filter counted prose and malformed lines
    // the parser then dropped, so the gate reported scanning more than it judged.
    // An empty diff is a real answer here (nothing was added), never a dead
    // scope, so the count is allowed to be zero.
    try {
        reportScanned({
            gate: GATE,
            scanned: clauses.length,
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

function isCliEntry(): boolean {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    return pathToFileURL(path.resolve(entry)).href === pathToFileURL(fileURLToPath(import.meta.url)).href;
}

if (isCliEntry()) {
    process.exit(main());
}
