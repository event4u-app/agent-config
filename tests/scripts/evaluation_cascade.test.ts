/**
 * Tests for the deterministic evaluation cascade
 * (`src/scripts/_lib/evaluation_cascade.ts`, road-to-governed-harness-evolution
 * step 4.1) and for its wiring into the real runner.
 *
 * Step 4.1's verify clause is two claims — *"a candidate failing the cheapest
 * stage consumes no model call, and the stage list can produce the Phase 1
 * classification"* — so those two are the load-bearing assertions.
 *
 * The second half of this file is deliberately written the way
 * `harness_evolution_guard_call_sites.test.ts` is written, and for the same
 * reason its header gives: a unit test observing a function's return is not
 * evidence that an executable runner routes through it. AC-3 asks that a
 * candidate can be *materialised, evaluated and destroyed*, and AC-5 asks that
 * a promotion is *decided by* the paired verdict — both are claims about a
 * production path, so both are asserted by spawning the real CLI and reading
 * its process exit and stdout.
 */
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLONES, REPO_ROOT, TSX_BIN, acquireClonesLock, releaseClonesLock } from './_bench_ab.js';
import { CANDIDATE_OWNED_PATHS } from '../../src/scripts/_lib/candidate_record.js';
import {
    CASCADE_STAGES,
    CHEAPEST_STAGE,
    FAILURE_FAMILIES,
    PREFIX_ASSIGNABLE_FAMILIES,
    familyForStage,
    runCascade,
    type StageId,
} from '../../src/scripts/_lib/evaluation_cascade.js';
import type { MetricRow } from '../../src/scripts/_lib/evaluation_vector.js';

const LAB_TS = join(REPO_ROOT, 'src', 'scripts', 'evolution_lab.ts');
const scratch = mkdtempSync(join(tmpdir(), 'ac-cascade-'));

// The clones directory is SHARED across test files, and `_bench_ab.removeClones`
// wipes the whole root. Without this lock the CLI cases below are racy by
// construction: a sibling file can delete the tree mid-clone, and the run then
// fails for a reason that has nothing to do with the property under test.
// Observed twice in the full parallel suite while passing in isolation, which is
// the signature of shared state rather than of a defect in the code.
beforeAll(() => acquireClonesLock());
afterAll(() => {
    releaseClonesLock();
    rmSync(scratch, { recursive: true, force: true });
});

const BUDGET = { maxCandidates: 100, maxTrialsPerCandidate: 10, maxSpendCents: 10_000 };
const PLAN = { candidates: 1, trialsPerCandidate: 1, estimatedSpendCents: 0 };

function record(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        kind: 'candidate',
        version: 1,
        id: 'cand-ok',
        dimension: 'content',
        lifecycle: 'proposed',
        mutations: [{ path: '.claude/rules/x.md', content: '# x\n' }],
        ...over,
    };
}

/** A real `PairedVerdict`, not a string — `parseMetricVectorJson` refuses the shorthand. */
function verdict(kind: string): Record<string, unknown> {
    return {
        kind,
        discordant: 12,
        wins: 11,
        losses: 1,
        p: 0.003,
        magnitude_mean: 0.4,
        at_floor: false,
        why: `${kind} on 12 discordant trials`,
    };
}

/** A vector that passes: one paired row plus the mandatory artifact-count row. */
function passingRows(kind = 'pass'): MetricRow[] {
    return [
        { metric: 'task-success', kind: 'paired', direction: 'higher-better', verdict: verdict(kind) },
        {
            metric: 'artifact-count-delta',
            kind: 'counted',
            direction: 'lower-better',
            delta: 0,
        },
    ] as unknown as MetricRow[];
}

describe('the stage list and the Phase 1 classification', () => {
    it('every stage maps to one of Phase 1s four families and invents no fifth', () => {
        for (const stage of CASCADE_STAGES) {
            expect(FAILURE_FAMILIES).toContain(familyForStage(stage));
        }
        expect(FAILURE_FAMILIES).toHaveLength(4);
    });

    it('the prefix NEVER assigns activation or adherence — the receipt-bearing families', () => {
        // This is the whole reason 4.1 shipped as Option B. Assigning either
        // from a deterministic proxy is the evidence-manufacturing the council
        // refused, so it must be impossible rather than merely avoided.
        for (const stage of CASCADE_STAGES) {
            expect(PREFIX_ASSIGNABLE_FAMILIES).toContain(familyForStage(stage));
        }
        expect(PREFIX_ASSIGNABLE_FAMILIES).not.toContain('activation');
        expect(PREFIX_ASSIGNABLE_FAMILIES).not.toContain('adherence');
    });

    it('schema validity is the cheapest stage and runs first', () => {
        expect(CHEAPEST_STAGE).toBe('schema-validity');
        expect(CASCADE_STAGES[0]).toBe(CHEAPEST_STAGE);
    });
});

describe('abort on the FIRST hard failure, at zero model calls', () => {
    it('a malformed record aborts at the cheapest stage having run only it', () => {
        const r = runCascade({ raw: { nonsense: true }, plan: PLAN, budget: BUDGET });
        expect(r.outcome).toBe('abort');
        if (r.outcome !== 'abort') return;
        expect(r.failed_stage).toBe('schema-validity');
        expect(r.family).toBe('content');
        expect(r.model_calls).toBe(0);
        // "Abort on the FIRST hard failure" — later stages were not attempted.
        expect(r.stages_run).toEqual(['schema-validity']);
    });

    it('an unowned mutation path aborts at stage 2, not later', () => {
        const r = runCascade({
            raw: record({ mutations: [{ path: 'src/scripts/x.ts', content: 'x' }] }),
            plan: PLAN,
            budget: BUDGET,
        });
        expect(r.outcome).toBe('abort');
        if (r.outcome !== 'abort') return;
        expect(r.failed_stage).toBe('path-ownership');
        // Attributed to stage 2 even though the throw originates inside the
        // stage-1 parse: `parseMutations` enforces ownership at
        // `candidate_record.ts:434`, and filing it under `schema-validity`
        // would give Phase 1's classification the wrong stage to read.
        expect(r.stages_run).toEqual(['schema-validity', 'path-ownership']);
    });

    it('a holdout-naming mutation aborts at stage 3 and is classified unknown, not activation', () => {
        const r = runCascade({
            raw: record({ mutations: [{ path: '.claude/rules/holdout-notes.md', content: 'x' }] }),
            plan: PLAN,
            budget: BUDGET,
        });
        expect(r.outcome).toBe('abort');
        if (r.outcome !== 'abort') return;
        expect(r.failed_stage).toBe('holdout-disclosure');
        // A holdout leak is NOT evidence that activation failed.
        expect(r.family).toBe('unknown');
    });

    it('a plan past the ceiling aborts at stage 4, before the near-duplicate screen', () => {
        const r = runCascade({
            raw: record(),
            plan: { candidates: 9999, trialsPerCandidate: 1, estimatedSpendCents: 0 },
            budget: BUDGET,
        });
        expect(r.outcome).toBe('abort');
        if (r.outcome !== 'abort') return;
        expect(r.failed_stage).toBe('budget');
        expect(r.stages_run).not.toContain('near-duplicate');
    });

    it('a run with no metric rows is INCOMPLETE — neither a pass nor an abort', () => {
        // A third outcome on purpose. Materialising without measuring has not
        // failed, so it is not an abort; and there is no verdict, so nothing
        // may read one. Collapsing it into either direction is the silent
        // outcome this state exists to prevent.
        const r = runCascade({ raw: record(), plan: PLAN, budget: BUDGET });
        expect(r.outcome).toBe('incomplete');
        if (r.outcome !== 'incomplete') return;
        expect(r.not_reached).toBe('metric-verdict');
        expect(r.stages_run).not.toContain('metric-verdict');
        expect(r.why).toContain('measured nothing');
        expect(r.model_calls).toBe(0);
    });

    it('every abort reports zero model calls, on every stage', () => {
        const seen = new Set<StageId>();
        const cases: { raw: unknown; plan: typeof PLAN }[] = [
            { raw: { nope: 1 }, plan: PLAN },
            { raw: record({ mutations: [{ path: 'src/x.ts', content: 'x' }] }), plan: PLAN },
            { raw: record({ mutations: [{ path: '.claude/holdout.md', content: 'x' }] }), plan: PLAN },
            { raw: record(), plan: { candidates: 9999, trialsPerCandidate: 1, estimatedSpendCents: 0 } },
            { raw: record(), plan: PLAN },
        ];
        for (const c of cases) {
            const r = runCascade({ raw: c.raw, plan: c.plan, budget: BUDGET });
            expect(r.model_calls).toBe(0);
            if (r.outcome === 'abort') seen.add(r.failed_stage);
        }
        // Anti-vacuity: the loop actually exercised distinct stages.
        expect(seen.size).toBeGreaterThanOrEqual(4);
    });
});

describe('the verdict stage consults the paired verdict and nothing else', () => {
    it('a complete vector reaches a promotion verdict', () => {
        const r = runCascade({ raw: record(), plan: PLAN, budget: BUDGET, rows: passingRows() });
        expect(r.outcome).toBe('pass');
        if (r.outcome !== 'pass') return;
        expect(r.stages_run).toEqual([...CASCADE_STAGES]);
        expect(r.model_calls).toBe(0);
        expect(typeof r.verdict.promote).toBe('boolean');
    });

    it('an underpowered row is refused as a pass, through the real verdict', () => {
        const r = runCascade({
            raw: record(),
            plan: PLAN,
            budget: BUDGET,
            rows: passingRows('underpowered'),
        });
        expect(r.outcome).toBe('pass');
        if (r.outcome !== 'pass') return;
        expect(r.verdict.promote).toBe(false);
    });
});

// --- the production path ----------------------------------------------------

interface Ran {
    status: number | null;
    stdout: string;
    stderr: string;
}

function lab(args: readonly string[], timeout = 180_000): Ran {
    const res = spawnSync(TSX_BIN, [LAB_TS, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout,
    });
    return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function recordFile(name: string, body: unknown): string {
    const p = join(scratch, `${name}.json`);
    writeFileSync(p, `${JSON.stringify(body, null, 2)}\n`, 'utf-8');
    return p;
}

function clonesFrom(prefix: string): string[] {
    try {
        return readdirSync(CLONES).filter((n) => n.startsWith(`candidate-${prefix}`));
    } catch {
        return [];
    }
}

describe('the real runner routes through the cascade (AC-3 and AC-5)', () => {
    it('a run EVALUATES each candidate and says so on stdout', () => {
        // AC-3's unmet verb. Before this wiring the runner cloned and returned;
        // nothing evaluated anything, and every evaluation module was
        // unreferenced outside its own tests.
        const f = recordFile('e2e-eval', record({ id: 'e2e-eval-a' }));
        const ran = lab(['run', '--record', f]);
        expect(ran.stdout, ran.stderr).toContain('evolution_lab:cascade');
        expect(ran.stdout).toContain('e2e-eval-a');
        // No metrics were supplied, so the honest outcome is an abort at the
        // verdict stage — not a silent pass.
        expect(ran.stdout).toContain('metric-verdict NOT REACHED');
        // Materialising without measuring is not a failure: the verb's
        // contract is unchanged and the run still exits 0.
        expect(ran.status).toBe(0);
    });

    it('a cascade abort at the cheapest stage is reported as costing no model call', () => {
        const f = recordFile('e2e-bad', { kind: 'candidate', version: 1, id: 'nope' });
        const ran = lab(['run', '--record', f]);
        expect(ran.status).not.toBe(0);
        expect(ran.stdout + ran.stderr).toMatch(/schema-validity|rejected/);
    });

    it('a run WITH metrics reaches the paired verdict through the real CLI', () => {
        // AC-5's unmet conjunct: `promotionVerdict` had no caller anywhere.
        const f = recordFile('e2e-pass', record({ id: 'e2e-pass-a' }));
        const m = join(scratch, 'metrics.json');
        writeFileSync(m, JSON.stringify({ candidate_id: 'e2e-pass-a', rows: passingRows() }, null, 2), 'utf-8');
        const ran = lab(['run', '--record', f, '--vector', m]);
        expect(ran.stdout, ran.stderr).toContain('verdict=');
        expect(ran.stdout).toContain('model_calls=0');
        expect(ran.status).toBe(0);
    });

    it('materialise, evaluate and destroy leaves the original tree unchanged', () => {
        // AC-3's three verbs in one run, asserted against the real repo.
        //
        // TWO SCOPING DECISIONS, both learned by getting them wrong first.
        //
        // 1. Destruction removes THIS candidate's clone directly rather than
        //    calling `clean --yes`, which removes EVERY candidate clone. The
        //    first version did call it, and in the full parallel suite it
        //    deleted the clones `bench_ab_integrity.test.ts` was mid-run
        //    against — reddening that file and this one while both passed in
        //    isolation. `harness_evolution_guard_call_sites.test.ts` already
        //    records the same hazard in its own clone probe. The `clean` verb
        //    itself is covered by `evolution_lab.test.ts`; duplicating it here
        //    bought nothing and broke a sibling.
        //
        // 2. The no-diff assertion is scoped to the paths a candidate can
        //    actually write — `CANDIDATE_OWNED_PATHS` — not to whole-repo
        //    `git status --porcelain`. A global comparison measures every
        //    other test running concurrently, which is watching shared state
        //    rather than the property AC-3 states.
        const f = recordFile('e2e-cycle', record({ id: 'e2e-cycle-a' }));
        const m = join(scratch, 'metrics2.json');
        writeFileSync(m, JSON.stringify({ candidate_id: 'e2e-cycle-a', rows: passingRows() }, null, 2), 'utf-8');

        const owned = (): string =>
            spawnSync('git', ['status', '--porcelain', '--', ...CANDIDATE_OWNED_PATHS], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            }).stdout;

        const before = owned();
        lab(['run', '--record', f, '--vector', m]);
        const mine = clonesFrom('e2e-cycle-a');
        expect(mine.length).toBeGreaterThan(0);
        // Materialised, and the original tree is untouched WHILE the clone exists.
        expect(owned()).toBe(before);

        for (const dir of mine) rmSync(join(CLONES, dir), { recursive: true, force: true });

        expect(owned()).toBe(before);
        expect(clonesFrom('e2e-cycle-a')).toEqual([]);
    });
});
