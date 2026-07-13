/**
 * Grader tests for the eval-schema-v2 assertion kinds
 * (ecosystem-harvest skill-quality-gates, Phase 2): `tool-choice` and
 * `trajectory_budget`, both evaluated against a recorded `tool-trace.json`.
 *
 * Deterministic, no model/API: a synthetic trace file drives the grader.
 * The must-hold contract: no trace present → pass:null (manual-pending),
 * NEVER a silent pass.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _count_meaningful_steps, _grade_assertions } from '../../src/scripts/run_skill_evals.js';

let dir: string;
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqg-eval-'));
});
afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

const writeTrace = (names: string[]) =>
    fs.writeFileSync(path.join(dir, 'tool-trace.json'), JSON.stringify(names));

describe('tool-choice assertion', () => {
    it('passes when must_use present and must_not_use absent', () => {
        writeTrace(['bash', 'git-commit', 'bash']);
        const r = _grade_assertions('', dir, [
            { kind: 'tool-choice', must_use: ['git-commit'], must_not_use: ['git-push'] },
        ])[0]!;
        expect(r.pass).toBe(true);
    });

    it('fails when a must_not_use tool was called', () => {
        writeTrace(['git-commit', 'git-push']);
        const r = _grade_assertions('', dir, [
            { kind: 'tool-choice', must_use: ['git-commit'], must_not_use: ['git-push'] },
        ])[0]!;
        expect(r.pass).toBe(false);
        expect(r.forbidden).toEqual(['git-push']);
    });

    it('fails when a must_use tool is missing', () => {
        writeTrace(['bash']);
        const r = _grade_assertions('', dir, [
            { kind: 'tool-choice', must_use: ['git-commit'], must_not_use: [] },
        ])[0]!;
        expect(r.pass).toBe(false);
        expect(r.missing).toEqual(['git-commit']);
    });

    it('reports manual-pending (pass:null) when no trace present — never a silent pass', () => {
        const r = _grade_assertions('', dir, [
            { kind: 'tool-choice', must_use: ['git-commit'], must_not_use: [] },
        ])[0]!;
        expect(r.pass).toBeNull();
        expect(String(r.note)).toContain('manual-pending');
    });
});

describe('trajectory_budget assertion', () => {
    it('counts steps net of retries and passes within budget', () => {
        writeTrace(['bash', 'bash', 'read', 'bash']); // retries collapse: bash, read, bash = 3 steps
        const r = _grade_assertions('', dir, [{ kind: 'trajectory_budget', n: 3 }])[0]!;
        expect(r.steps).toBe(3);
        expect(r.pass).toBe(true);
    });

    it('fails when meaningful steps exceed the budget', () => {
        writeTrace(['a', 'b', 'c', 'd']);
        const r = _grade_assertions('', dir, [{ kind: 'trajectory_budget', n: 3 }])[0]!;
        expect(r.pass).toBe(false);
    });

    it('manual-pending without a trace', () => {
        const r = _grade_assertions('', dir, [{ kind: 'trajectory_budget', n: 3 }])[0]!;
        expect(r.pass).toBeNull();
    });
});

describe('_count_meaningful_steps', () => {
    it('collapses consecutive retries', () => {
        expect(_count_meaningful_steps(['x', 'x', 'x'])).toBe(1);
        expect(_count_meaningful_steps(['x', 'y', 'x'])).toBe(3);
        expect(_count_meaningful_steps([])).toBe(0);
    });
});
