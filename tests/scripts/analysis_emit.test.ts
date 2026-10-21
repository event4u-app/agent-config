import { describe, expect, it } from 'vitest';

import { INTAKE_LIMIT, emitRound, type Finding } from '../../src/scripts/analysis_emit.js';

const NEW_A: Finding = {
    id: 'f-scope',
    title: 'Doors print their scope',
    claim: 'No door resolves its scope before reading.',
    anchor: 'src/domains/analysis-workbench/analyze/reference/command.md:81',
    tier: 'read',
    steps: [{ text: 'Print the scope line first', verify: '`npx vitest run tests/scripts/scope_line.test.ts` -> 0' }],
};
const NEW_B: Finding = {
    id: 'f-limits',
    title: 'Every loop carries a cap',
    claim: 'Two loops run without a numeric cap.',
    anchor: 'src/domains/meta/optimize/deep/command.md:20',
    tier: 'executed',
    steps: [{ text: 'Add the caps to the limits block', verify: '`grep -c loops: src/domains/meta/optimize/deep/command.md` -> /[1-9]/' }],
    blocked_until: 'the owner names the per-round token ceiling',
};
const OWNED: Finding = {
    id: 'f-retro',
    title: 'The retro reads run records',
    claim: 'No retro unit reads an analysis run.',
    anchor: 'agents/roadmaps/road-to-a-retro-the-merge-runs.md:1',
    tier: 'read',
    steps: [{ text: 'Add the analysis-run unit', verify: '`grep -c analysis-run agents/roadmaps/road-to-a-retro-the-merge-runs.md` -> /[1-9]/' }],
    owner: 'a-retro-the-merge-runs',
};

const BASE = { roundId: 'run-20261017-ab12cd', date: '2026-10-17', slug: 'analysis-round-ab12cd', readyAtZero: 3 };

describe('emitting a round locally', () => {
    it('lands new findings as one ready roadmap with one phase each, and states its estate delta', () => {
        const r = emitRound({ ...BASE, findings: [NEW_A, NEW_B] });
        expect(r.roadmaps).toHaveLength(1);
        const rm = r.roadmaps[0];
        expect(rm?.status).toBe('ready');
        expect(rm?.body).toMatch(/^---\ncomplexity: lightweight\nstatus: ready\n/);
        expect(rm?.body).toContain('## Phase 1 — Doors print their scope');
        expect(rm?.body).toContain('## Phase 2 — Every loop carries a cap');
        expect(rm?.body).toContain('> Blocked until the owner names the per-round token ceiling.');
        expect(rm?.body).toContain('verify: `npx vitest run tests/scripts/scope_line.test.ts` -> 0');
        expect(rm?.body).toContain('`run-20261017-ab12cd`');
        expect(r.estate_delta).toBe(1);
        expect(r.status_note).toBeNull();
    });

    it('lands an owned finding as a step plus an Arrivals line on its owner, not a new roadmap', () => {
        const r = emitRound({ ...BASE, findings: [OWNED] });
        expect(r.roadmaps).toEqual([]);
        expect(r.estate_delta).toBe(0);
        expect(r.arrivals).toEqual([
            {
                slug: 'a-retro-the-merge-runs',
                finding_id: 'f-retro',
                step: expect.stringContaining('verify: `grep -c analysis-run'),
                arrivals_line: '> **Arrivals:** latest `run-20261017-ab12cd` (2026-10-17) — f-retro',
            },
        ]);
    });

    it('lands draft above the intake limit and says so in one line', () => {
        const r = emitRound({ ...BASE, readyAtZero: INTAKE_LIMIT + 1, findings: [NEW_A] });
        expect(r.roadmaps[0]?.status).toBe('draft');
        expect(r.status_note).toBe(`draft: ${INTAKE_LIMIT + 1} ready roadmaps sit at 0 ticked steps, above the intake limit of ${INTAKE_LIMIT}`);
        expect(emitRound({ ...BASE, readyAtZero: INTAKE_LIMIT, findings: [NEW_A] }).roadmaps[0]?.status).toBe('ready');
    });
});
