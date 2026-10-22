import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { emitRound, type Finding } from '../../src/scripts/analysis_emit.js';
import { createRun, legalNext, transition, type ForwardState, type RunRecord } from '../../src/scripts/analysis_run.js';
import {
    VALIDATION_GATES,
    contentFailures,
    scriptGateRunner,
    validateEmitted,
    type GateRunner,
} from '../../src/scripts/analysis_validate.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-validate-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const FINDING: Finding = {
    id: 'f-scope',
    title: 'Doors print their scope',
    claim: 'No door resolves its scope before reading.',
    anchor: 'src/a.ts:1',
    tier: 'read',
    steps: [{ text: 'Print the scope line first', verify: '`npx vitest run tests/x.test.ts` -> 0' }],
};

function emitted(findings: Finding[] = [FINDING]): string {
    const body = emitRound({ roundId: 'run-1', date: '2026-10-17', slug: 'analysis-round-1', readyAtZero: 0, findings }).roadmaps[0]?.body;
    if (body === undefined) throw new Error('nothing emitted');
    const file = path.join(root, 'agents/roadmaps/road-to-analysis-round-1.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
    return file;
}

function runAt(target: ForwardState): { runDir: string; record: RunRecord } {
    let { runDir, record } = createRun(root, { runId: 'run-1', pins: { head: 'a1' }, tokenCap: 1000 });
    while (record.state !== target) record = transition(runDir, record, legalNext(record.state)[0] as ForwardState);
    return { runDir, record };
}

const passAll: GateRunner = () => ({ ok: true, detail: '' });

describe('deterministic validation before anything leaves the machine', () => {
    it('stops in emitted naming one unanchored claim and one step without verify', () => {
        const file = emitted();
        const broken = fs
            .readFileSync(file, 'utf8')
            .replace(' Evidence (read): `src/a.ts:1`.', '')
            .replace('\n      verify: `npx vitest run tests/x.test.ts` -> 0', '');
        fs.writeFileSync(file, broken);
        const { runDir, record } = runAt('emitted');
        const v = validateEmitted({ runDir, record, projectRoot: root, files: [file], councilDissent: false, runner: passAll });
        expect(v.record.state).toBe('emitted');
        expect(v.failures).toEqual([
            'road-to-analysis-round-1.md: claim of "Phase 1 — Doors print their scope" carries no anchor and tier',
            'road-to-analysis-round-1.md: step 1.1 has no verify: line',
        ]);
    });

    it('requires a Dissent section when the council recorded dissent', () => {
        const file = emitted();
        expect(contentFailures(fs.readFileSync(file, 'utf8'), 'x.md', { councilDissent: true })).toEqual([
            'x.md: the council recorded dissent and the roadmap carries no "## Dissent" section',
        ]);
    });

    it('names a fixture finding not recovered and one the run invented', () => {
        const file = emitted();
        const { runDir, record } = runAt('emitted');
        const v = validateEmitted({
            runDir,
            record,
            projectRoot: root,
            files: [file],
            councilDissent: false,
            runner: passAll,
            recovery: { expected: ['f-scope', 'f-limits'], found: ['f-scope', 'f-extra'] },
        });
        expect(v.record.state).toBe('emitted');
        expect(v.failures).toEqual(['fixture finding f-limits not recovered', 'finding f-extra is not in the fixture']);
    });

    it('stops in emitted when a gate fails, naming the gate', () => {
        const file = emitted();
        const { runDir, record } = runAt('emitted');
        const runner: GateRunner = (gate) => (gate === 'check_estate_count' ? { ok: false, detail: 'active_roadmaps +1 without a reason' } : { ok: true, detail: '' });
        const v = validateEmitted({ runDir, record, projectRoot: root, files: [file], councilDissent: false, runner });
        expect(v.record.state).toBe('emitted');
        expect(v.failures).toEqual(['gate check_estate_count failed: active_roadmaps +1 without a reason']);
    });

    it('moves a clean emission to validated and runs every gate once', () => {
        const file = emitted();
        const { runDir, record } = runAt('emitted');
        const ran: string[] = [];
        const v = validateEmitted({
            runDir,
            record,
            projectRoot: root,
            files: [file],
            councilDissent: false,
            runner: (gate) => {
                ran.push(gate);
                return { ok: true, detail: '' };
            },
        });
        expect(v.failures).toEqual([]);
        expect(v.record.state).toBe('validated');
        expect(ran).toEqual([...VALIDATION_GATES]);
    });

    it('records on the validated transition every gate that checked nothing of the project', () => {
        const file = emitted();
        const { runDir, record } = runAt('emitted');
        const v = validateEmitted({
            runDir,
            record,
            projectRoot: root,
            files: [file],
            councilDissent: false,
            runner: (gate) => (gate === 'lint_plan_risk_register' ? { ok: true, skipped: true, detail: '' } : { ok: true, detail: '' }),
        });
        expect(v.record.state).toBe('validated');
        expect(v.unchecked).toEqual([
            "lint_roadmap_blockers read this package's tree, not the project's",
            'lint_plan_risk_register skipped',
            "check_references read this package's tree, not the project's",
            "check_estate_count read this package's tree, not the project's",
        ]);
        expect(v.record.history.at(-1)?.reason).toContain('lint_plan_risk_register skipped');
    });

    it('passes the real complexity and risk-register gates on an emitted roadmap', () => {
        const file = emitted();
        for (const gate of ['lint_roadmap_complexity', 'lint_plan_risk_register'] as const) {
            const res = scriptGateRunner(gate, { projectRoot: root, files: [file] });
            expect(res, `${gate}: ${res.detail}`).toMatchObject({ ok: true });
        }
    }, 60_000);
});
