// The per-spawn preamble payload ratchet (road-to-cache-economy Phase 3).
//
// A gate that cannot fail is worse than no gate — it trains the reader to skip
// the line. So these tests pin BOTH directions: within budget passes, growth
// past the headroom fails, and a budget file that cannot be parsed is a misuse
// exit rather than a silent pass.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { evaluate, main, readBudget } from '../../src/scripts/check_preamble_payload_budget.js';

const tmps: string[] = [];

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-budget-'));
    tmps.push(d);
    return d;
}

afterEach(() => {
    while (tmps.length) fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
});

/** A minimal repo shape: the three gated buckets and nothing else. */
function fakeRepo(ruleBodies: string[], skillCount = 0): string {
    const root = tmpdir();
    const rules = path.join(root, 'dist', 'agent-src', 'rules');
    fs.mkdirSync(rules, { recursive: true });
    ruleBodies.forEach((body, i) => fs.writeFileSync(path.join(rules, `r${i}.md`), body, 'utf-8'));
    const skills = path.join(root, 'dist', 'agent-src', 'skills');
    fs.mkdirSync(skills, { recursive: true });
    for (let i = 0; i < skillCount; i++) {
        const dir = path.join(skills, `s${i}`);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'SKILL.md'),
            `---\nname: s${i}\ndescription: description for skill ${i}\n---\n\nbody\n`,
            'utf-8',
        );
    }
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# project\n', 'utf-8');
    return root;
}

function budgetFile(baseline: number, headroomPct: number): string {
    const dir = tmpdir();
    const file = path.join(dir, 'budget.json');
    fs.writeFileSync(
        file,
        JSON.stringify({ baseline_tokens: baseline, headroom_pct: headroomPct, target_tokens: { median: 1, p95: 2 } }),
        'utf-8',
    );
    return file;
}

describe('preamble payload ratchet', () => {
    it('passes when the payload equals the baseline', () => {
        const repo = fakeRepo(['x'.repeat(4000)]);
        const measured = evaluate(repo, budgetFile(100000, 5)).measured;
        // Baseline derived from the fixture's own measurement, not a literal.
        const verdict = evaluate(repo, budgetFile(measured, 5));
        expect(verdict.withinBudget).toBe(true);
        expect(verdict.measured).toBe(measured);
    });

    it('passes growth that stays inside the headroom', () => {
        const repo = fakeRepo(['x'.repeat(4000)]);
        const measured = evaluate(repo, budgetFile(1, 0)).measured;
        // 10% headroom over a baseline 5% below the measurement -> still inside.
        const verdict = evaluate(repo, budgetFile(Math.round(measured * 0.95), 10));
        expect(verdict.withinBudget).toBe(true);
    });

    it('FAILS when the payload grows past the headroom', () => {
        const repo = fakeRepo(['x'.repeat(4000)]);
        const measured = evaluate(repo, budgetFile(1, 0)).measured;
        const verdict = evaluate(repo, budgetFile(Math.round(measured * 0.5), 5));
        expect(verdict.withinBudget).toBe(false);
        expect(verdict.ceiling).toBeLessThan(verdict.measured);
    });

    it('counts every gated bucket, so a skill-description flood is caught too', () => {
        const lean = evaluate(fakeRepo(['x'.repeat(400)], 1), budgetFile(1, 0)).measured;
        const heavy = evaluate(fakeRepo(['x'.repeat(400)], 40), budgetFile(1, 0)).measured;
        expect(heavy).toBeGreaterThan(lean);
    });

    it('excludes the user scope — the gate must be machine-independent', () => {
        const repo = fakeRepo(['x'.repeat(400)]);
        const a = evaluate(repo, budgetFile(1, 0)).measured;
        // A user-scope rules directory inside the fixture must not change the number.
        const userRules = path.join(repo, '.claude', 'rules');
        fs.mkdirSync(userRules, { recursive: true });
        fs.writeFileSync(path.join(userRules, 'huge.md'), 'y'.repeat(80000), 'utf-8');
        expect(evaluate(repo, budgetFile(1, 0)).measured).toBe(a);
    });

    it('rejects a budget file whose numbers are missing rather than passing silently', () => {
        const dir = tmpdir();
        const file = path.join(dir, 'bad.json');
        fs.writeFileSync(file, JSON.stringify({ headroom_pct: 5 }), 'utf-8');
        expect(() => readBudget(file)).toThrow(/baseline_tokens/u);
    });

    it('ships a real budget file that parses', () => {
        const budget = readBudget();
        expect(budget.baseline_tokens).toBeGreaterThan(0);
        expect(budget.headroom_pct).toBeGreaterThanOrEqual(0);
    });
});

/**
 * road-to-standing-payload-truth 1.1 — the gate is armed in CI behind a grace
 * ceiling, and these are the two properties that arming rests on.
 */
describe('the measurement is a deterministic census, not a sample', () => {
    it('two runs on the same checkout return identical totals', () => {
        // The invariant the council required before a single CI run may fail a
        // build: "per-spawn" describes where the cost is PAID, not sampling.
        // Variation here would be a checker defect, never budget noise — so this
        // test is what makes the single-sample objection answerable rather than
        // merely denied.
        const a = evaluate();
        const b = evaluate();
        expect(b.measured).toBe(a.measured);
        expect(b.buckets.map((x) => [x.name, x.tokens, x.files])).toEqual(
            a.buckets.map((x) => [x.name, x.tokens, x.files]),
        );
    });

    it('every bucket is sourced from the checkout, so nothing machine-local leaks in', () => {
        // A bucket reading a user-local path would make the census non-reproducible
        // across machines while staying stable on one — the failure a same-process
        // repeat cannot see.
        for (const b of evaluate().buckets) {
            expect(b.files, `${b.name} must read at least one file`).toBeGreaterThan(0);
        }
    });
});

/** `ci_delivery` straight off disk — the same read the CI step performs. */
function rawCiDelivery(): { grace_ceiling: number; grace_end_date: string; posture: string } {
    const raw = JSON.parse(
        fs.readFileSync(path.join('src', 'config', 'preamble-payload-budget.json'), 'utf-8'),
    ) as { ci_delivery: { grace_ceiling: number; grace_end_date: string; posture: string } };
    return raw.ci_delivery;
}

describe('the --ceiling override may only ever be LOOSER', () => {
    const design = (): number => {
        const b = readBudget();
        return Math.round(b.baseline_tokens * (1 + b.headroom_pct / 100));
    };

    it('no override keeps the design ceiling', () => {
        expect(evaluate().ceiling).toBe(design());
    });

    it('a LOOSER override is honoured — the grace ceiling', () => {
        const loose = design() + 30_000;
        expect(evaluate(undefined, undefined, loose).ceiling).toBe(loose);
    });

    it('a TIGHTER override is IGNORED, not honoured', () => {
        // Backwards-looking for one line and deliberate: honouring a tighter value
        // would let a caller silently lower the bar this budget file owns. The
        // design ceiling stays the authority; the override is a dated concession.
        expect(evaluate(undefined, undefined, 1).ceiling).toBe(design());
        expect(evaluate(undefined, undefined, design() - 1).ceiling).toBe(design());
    });

    it('a non-numeric override is ignored rather than coerced to 0', () => {
        expect(evaluate(undefined, undefined, Number.NaN).ceiling).toBe(design());
    });

    it('the CI grace ceiling in the budget file is looser than the design ceiling', () => {
        // If a future edit tightened grace_ceiling below the design number, the
        // override would silently stop applying and the CI step would go red for a
        // reason nobody wrote down. Pin the relationship, not the value.
        //
        // Read from the raw JSON, not `readBudget()`: that reader returns only the
        // three fields the ratchet needs, so `ci_delivery` is not on its type — a
        // deliberate narrowness, and the CI step reads the raw file for the same
        // reason.
        const grace = rawCiDelivery().grace_ceiling;
        expect(typeof grace, 'ci_delivery.grace_ceiling must exist').toBe('number');
        expect(grace).toBeGreaterThan(design());
    });
});

describe('the gate reds on growth past whichever ceiling applies', () => {
    it('exits non-zero at the design ceiling on the current tree', () => {
        // Sensitivity, stated as the honest fact it is: HEAD is over the design
        // ceiling today, so this asserts the gate is RED right now. When a
        // reduction lands this flips and the assertion must be inverted with the
        // measurement recorded — it is not a permanent expectation.
        expect(main([])).not.toBe(0);
    });

    it('exits 0 under the grace ceiling the CI step passes', () => {
        expect(main(['--ceiling', String(rawCiDelivery().grace_ceiling)])).toBe(0);
    });
});
