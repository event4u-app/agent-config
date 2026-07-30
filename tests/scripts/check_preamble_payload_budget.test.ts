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

import { evaluate, readBudget } from '../../src/scripts/check_preamble_payload_budget.js';

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
