// The acceptance test for blocker `guard-call-site-integration` on
// road-to-governed-harness-evolution — the one that unblocks steps 0.4 and 0.5.
//
// Its `Resolved when`, verbatim:
//
//     an end-to-end test drives the real runner and observes a non-zero process
//     exit on (a) a holdout value reaching proposer context and (b) a plan
//     configured past the pre-registered ceiling, both before any external
//     call — and the two steps are re-closed citing it.
//
// Everything about this file is shaped by the council SPLIT the blocker
// records. The (b) seat held that a unit test invoking the guard and observing
// the throw is a run of it; the (d) seat held that it does not prove an
// executable runner routes through the guard or converts that throw into a
// non-zero PROCESS exit. The conservative side was taken, so this file is
// written for the (d) seat: **nothing here calls a guard directly.** Every
// assertion spawns the real CLI through `./scripts-run` and reads
// `spawnSync().status`. `tests/scripts/harness_evolution_guards.test.ts`
// already covers the guards' behaviour and is not duplicated.
//
// "Before any external call" is PROVEN, not asserted, and by an observable
// stronger than "no directory appeared": each abort case is fed input that
// would fail LOUDLY and DIFFERENTLY at the next stage — a record that is not
// valid JSON, a subject file that does not exist — so a guard running one step
// too late produces a distinguishable exit and a distinguishable message. See
// the two `ordering` cases.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { CLONES, REPO_ROOT, TSX_BIN } from './_bench_ab.js';
import {
    BudgetConfigError,
    EXIT_GUARD_ABORT,
    OBSERVATION_FIELD_VISIBILITY,
    loadRunBudget,
    parseObservationDocument,
} from '../../src/scripts/evolution_lab.js';

const LAB_TS = join(REPO_ROOT, 'src', 'scripts', 'evolution_lab.ts');

const scratch = mkdtempSync(join(tmpdir(), 'ac-guardcall-'));
afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
});

interface Ran {
    status: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
}

/** The REAL runner, through the real dispatcher. Never an in-process call. */
function lab(args: readonly string[], timeout = 180_000): Ran {
    const res = spawnSync(TSX_BIN, [LAB_TS, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout,
    });
    return {
        status: res.status,
        signal: res.signal,
        stdout: res.stdout ?? '',
        stderr: res.stderr ?? '',
    };
}

function writeJson(name: string, body: unknown): string {
    const p = join(scratch, name);
    writeFileSync(p, `${JSON.stringify(body, null, 2)}\n`, 'utf-8');
    return p;
}

/** N valid candidate records in a fresh directory. */
function recordDir(name: string, n: number): string {
    const dir = join(scratch, name);
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < n; i += 1) {
        const body = {
            kind: 'candidate',
            version: 1,
            id: `${name}-${String(i)}`,
            dimension: 'content',
            lifecycle: 'proposed',
            mutations: [{ path: `.claude/rules/${name}-${String(i)}.md`, content: `# ${name}\n` }],
        };
        writeFileSync(join(dir, `r${String(i)}.json`), `${JSON.stringify(body, null, 2)}\n`, 'utf-8');
    }
    return dir;
}

/**
 * Clone directories THIS run would have created, if it got that far.
 *
 * Scoped to the run's own id prefix rather than to `candidate-` in general:
 * vitest runs files in parallel and `evolution_lab.test.ts` materialises its
 * own candidates under the same tree, so an absolute "the clones dir is empty"
 * assertion measures the other file's timing. This measures the property that
 * is actually claimed — the aborted run left nothing behind.
 */
function clonesFrom(name: string): string[] {
    try {
        return readdirSync(CLONES).filter((n) => n.startsWith(`candidate-${name}-`));
    } catch {
        return [];
    }
}

// --- (a) a holdout value reaching proposer context --------------------------

describe('(a) a holdout value reaching proposer context exits non-zero', () => {
    it('the real runner exits 4 and the disclosure log names the field', () => {
        const obs = writeJson('leak.json', {
            field_visibility: [{ field: 'holdoutScore', visibility_class: 'holdout' }],
            observations: [
                { defectClass: 'over-broad-activation', subject: 'AGENTS.md', holdoutScore: 0.83 },
            ],
        });
        const out = join(scratch, 'out-leak');
        const ran = lab(['propose', '--observations', obs, '--out', out]);

        expect(ran.signal).toBeNull();
        expect(ran.status, ran.stderr).toBe(EXIT_GUARD_ABORT);
        expect(ran.status).not.toBe(0);
        // 0.4's second conjunct: the disclosure log names the field.
        expect(ran.stderr).toContain('disclosure: REFUSED obs[0] field=holdoutScore class=holdout');
        expect(ran.stderr).toContain('ABORTED on evaluator trust boundary (field: holdoutScore)');
        expect(ran.stderr).toContain('The run is INVALID, not degraded');
        // Nothing external: no output directory, no record written, no stdout.
        // (`propose` never clones, so a clone probe here would be decorative —
        // the clone observable belongs to the `run` cases below.)
        expect(existsSync(out)).toBe(false);
        expect(ran.stdout).toBe('');
    });

    it('an UNDECLARED field fails closed to holdout and aborts the same way', () => {
        // The gap this call site actually closes, and it was reachable before:
        // `parseObservations` ignores unknown keys, so a sealed value riding
        // along in an unclassified field used to flow straight into proposer
        // input with nothing looking at it.
        const obs = writeJson('undeclared.json', [
            { defectClass: 'over-broad-activation', subject: 'AGENTS.md', secretTruth: 1 },
        ]);
        const out = join(scratch, 'out-undeclared');
        const ran = lab(['propose', '--observations', obs, '--out', out]);
        expect(ran.status, ran.stderr).toBe(EXIT_GUARD_ABORT);
        expect(ran.stderr).toContain('field=secretTruth class=holdout');
        expect(existsSync(out)).toBe(false);
    });

    it('ordering: the abort happens BEFORE the proposer reads the subject', () => {
        // The subject does not exist. If disclosure ran first the run aborts on
        // the holdout with exit 4; if the proposer ran first it would die
        // reading the file with exit 1 and an ENOENT-shaped message. The two
        // are distinguishable, which is what makes this an ordering proof
        // rather than a restatement of the previous case.
        const obs = writeJson('leak-order.json', {
            field_visibility: [{ field: 'sealed', visibility_class: 'holdout' }],
            observations: [
                {
                    defectClass: 'over-broad-activation',
                    subject: '.claude/rules/__does_not_exist__.md',
                    sealed: 'truth',
                },
            ],
        });
        const out = join(scratch, 'out-leak-order');
        const ran = lab(['propose', '--observations', obs, '--out', out]);
        expect(ran.status, ran.stderr).toBe(EXIT_GUARD_ABORT);
        expect(ran.stderr).toContain('field=sealed class=holdout');
        expect(ran.stderr).not.toContain('ENOENT');
        expect(existsSync(out)).toBe(false);
    });

    it('POSITIVE POLE: clean observations pass, and every released field is logged', () => {
        // Without this, every assertion above could be passing because
        // `propose` refuses everything.
        const obs = writeJson('clean.json', [
            { defectClass: 'over-broad-activation', subject: 'AGENTS.md' },
            { defectClass: 'unrouted-obligation', subject: 'CLAUDE.md', routeTo: 'skill:x' },
        ]);
        const out = join(scratch, 'out-clean');
        const ran = lab(['propose', '--observations', obs, '--out', out]);
        expect(ran.status, ran.stderr).toBe(0);
        expect(ran.stderr).toContain('disclosure: obs[0] field=defectClass class=proposer-visible');
        expect(ran.stderr).toContain('disclosure: obs[0] field=subject class=proposer-visible');
        expect(ran.stderr).toContain('disclosure: obs[1] field=routeTo class=proposer-visible');
        expect(ran.stderr).not.toContain('REFUSED');
        expect(readdirSync(out)).toHaveLength(2);
    });

    it('an evaluator-private field is DROPPED, not aborted, and is not logged as released', () => {
        // The three classes are not two. `evaluator-private` must neither reach
        // the proposer nor stop the run — and the guard logs only what it
        // RELEASED, so its absence from the log is the observable.
        const obs = writeJson('private.json', {
            field_visibility: [{ field: 'rawScore', visibility_class: 'evaluator-private' }],
            observations: [
                { defectClass: 'over-broad-activation', subject: 'AGENTS.md', rawScore: 7 },
            ],
        });
        const out = join(scratch, 'out-private');
        const ran = lab(['propose', '--observations', obs, '--out', out]);
        expect(ran.status, ran.stderr).toBe(0);
        expect(ran.stderr).not.toContain('rawScore');
        expect(readdirSync(out)).toHaveLength(1);
    });

    it('an observations file may not re-classify a declared proposer-visible field', () => {
        expect(() =>
            parseObservationDocument({
                field_visibility: [{ field: 'subject', visibility_class: 'holdout' }],
                observations: [],
            }),
        ).toThrow(/may not re-classify it/);
        // Positive pole: adding a NEW field is exactly what the mechanism is for.
        expect(
            parseObservationDocument({
                field_visibility: [{ field: 'extra', visibility_class: 'holdout' }],
                observations: [],
            }).fieldVisibility,
        ).toHaveLength(OBSERVATION_FIELD_VISIBILITY.length + 1);
    });
});

// --- (b) a plan configured past the pre-registered ceiling -------------------

describe('(b) a plan past the pre-registered ceiling exits non-zero before spending', () => {
    it('run with six candidates exits 4 on the candidates dimension', () => {
        const dir = recordDir('over', 6);
        const ran = lab(['run', '--records', dir]);

        expect(ran.signal).toBeNull();
        expect(ran.status, ran.stderr).toBe(EXIT_GUARD_ABORT);
        expect(ran.status).not.toBe(0);
        expect(ran.stderr).toContain('ABORTED on the pre-registered budget (dimension: candidates)');
        expect(ran.stderr).toContain('planned candidates 6 exceeds the pre-registered ceiling 5');
        expect(ran.stderr).toContain('ABORTING BEFORE THE RUN, not truncating it');
        // Nothing external: no clone was materialised and nothing was printed.
        expect(clonesFrom('over')).toEqual([]);
        expect(ran.stdout).toBe('');
    });

    it('ordering: the abort happens BEFORE the first record is even parsed', () => {
        // One of the six records is not valid JSON. If the budget check runs
        // first the run aborts on `candidates` with exit 4; if record loading
        // ran first it would abort on the schema with exit 1 and a
        // "not valid JSON" message. Distinguishable, so this is an ordering
        // proof and not a repeat of the case above.
        const dir = recordDir('order', 5);
        writeFileSync(join(dir, 'zz-broken.json'), '{ this is not json', 'utf-8');
        const ran = lab(['run', '--records', dir]);
        expect(ran.status, ran.stderr).toBe(EXIT_GUARD_ABORT);
        expect(ran.stderr).toContain('dimension: candidates');
        expect(ran.stderr).not.toContain('not valid JSON');
    });

    it('run past the trials ceiling exits 4 on the trials dimension', () => {
        const dir = recordDir('trials', 2);
        const ran = lab(['run', '--records', dir, '--trials-per-candidate', '21']);
        expect(ran.status, ran.stderr).toBe(EXIT_GUARD_ABORT);
        expect(ran.stderr).toContain('dimension: trials');
        expect(clonesFrom('trials')).toEqual([]);
    });

    it('run past the spend ceiling exits 4 on the spend dimension', () => {
        const dir = recordDir('spend', 2);
        const ran = lab([
            'run',
            '--records',
            dir,
            '--estimated-spend-cents',
            '501',
        ]);
        expect(ran.status, ran.stderr).toBe(EXIT_GUARD_ABORT);
        expect(ran.stderr).toContain('dimension: spend');
    });

    it('propose past the candidates ceiling exits 4 and writes nothing', () => {
        // The second budget call site. Without it the ceiling is evaded by
        // proposing six and running them in two batches of three.
        const obs = writeJson(
            'six.json',
            Array.from({ length: 6 }, () => ({
                defectClass: 'over-broad-activation',
                subject: 'AGENTS.md',
            })),
        );
        const out = join(scratch, 'out-six');
        const ran = lab(['propose', '--observations', obs, '--out', out]);
        expect(ran.status, ran.stderr).toBe(EXIT_GUARD_ABORT);
        expect(ran.stderr).toContain('dimension: candidates');
        expect(existsSync(out)).toBe(false);
    });

    it('POSITIVE POLE: exactly AT every ceiling does not abort', () => {
        // 5 candidates, 20 trials, 500 cents are the registered ceilings, and a
        // ceiling is inclusive. One record path is missing, so the run dies at
        // the NEXT stage with exit 1 — which is the proof the budget let it
        // through rather than the proof of a successful clone (that one costs a
        // fixture, and `evolution_lab.test.ts` already pays for it).
        const dir = recordDir('atceiling', 4);
        const ran = lab([
            'run',
            '--record',
            join(dir, 'r0.json'),
            '--record',
            join(dir, 'r1.json'),
            '--record',
            join(dir, 'r2.json'),
            '--record',
            join(dir, 'r3.json'),
            '--record',
            join(dir, 'missing.json'),
            '--trials-per-candidate',
            '20',
            '--estimated-spend-cents',
            '500',
        ]);
        expect(ran.status, ran.stderr).toBe(1);
        expect(ran.stderr).not.toContain('ABORTED on the pre-registered budget');
        expect(ran.stderr).toContain('not readable');
    });

    it('a non-integer budget flag is a usage error, never a silent coercion', () => {
        const dir = recordDir('coerce', 1);
        // '21abc' rather than '1e9' on purpose: both are silent-coercion
        // hazards (parseInt gives 21 and 1, neither of which the operator
        // typed), and this one is over the trials ceiling — so a build that
        // coerced instead of refusing exits 4, not 0, and never reaches a
        // clone. The negative polarity of this guard therefore leaves no
        // artefact behind.
        const ran = lab(['run', '--records', dir, '--trials-per-candidate', '21abc']);
        expect(ran.status, ran.stderr).toBe(2);
        expect(ran.stderr).toContain('must be a non-negative integer');
    });
});

// --- the budget config is fail-closed ---------------------------------------

describe('the pre-registered budget is never defaulted', () => {
    it('loads the committed ceilings', () => {
        const b = loadRunBudget();
        expect(b.maxCandidates).toBe(5);
        expect(b.maxTrialsPerCandidate).toBe(20);
        expect(b.maxSpendCents).toBe(500);
    });

    it('a missing, malformed, or incomplete config THROWS rather than un-capping', () => {
        // The direction that matters: deleting the pre-registration must stop
        // the lab. A fallback budget is a ceiling nobody registered, and a run
        // under one has exactly the property 0.5 exists to prevent.
        expect(() => loadRunBudget(join(scratch, 'nope.json'))).toThrow(BudgetConfigError);
        expect(() => loadRunBudget(writeJson('bad1.json', { budget: {} }))).toThrow(
            /'budget.max_candidates' must be a non-negative integer/,
        );
        expect(() => loadRunBudget(writeJson('bad2.json', { nothing: true }))).toThrow(
            /carries no 'budget' object/,
        );
        expect(() => loadRunBudget(writeJson('bad3.json', { budget: { max_candidates: -1 } }))).toThrow(
            BudgetConfigError,
        );
        const notJson = join(scratch, 'bad4.json');
        writeFileSync(notJson, '{ nope', 'utf-8');
        expect(() => loadRunBudget(notJson)).toThrow(/not valid JSON/);
    });
});
