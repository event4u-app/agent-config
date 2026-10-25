// Fixtures G1–G14 for src/scripts/_lib/invocation_plan.ts — the same ids the
// context `src/agent-src/contexts/execution/invocation-plan.md` tabulates.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    InvocationPlanError,
    deliveryOnFailure,
    linearize,
    replan,
    type EffectRef,
    type InvocationInput,
    type InvocationPlan,
    type StageInput,
} from '../../src/scripts/_lib/invocation_plan.js';

const B = 'branch:feat/x';

const on = (object: string, ...effects: EffectRef['effect'][]): EffectRef[] => effects.map((effect) => ({ effect, object }));

const inbox = (extra: Partial<StageInput> = {}): StageInput => ({
    id: 'inbox',
    kind: 'author',
    effects: on(B, 'local-write', 'commit', 'push', 'pr-open', 'ci-settle'),
    ...extra,
});
const processFull = (): StageInput => ({
    id: 'process-full',
    kind: 'implement',
    dependsOn: ['inbox'],
    effects: on(B, 'local-write', 'commit', 'push', 'pr-update', 'ci-settle'),
});

/** Every (effect, object) the plan executes, in order, across all steps. */
function executed(plan: InvocationPlan): string[] {
    return plan.order.flatMap((s) => s.effects.map((e) => `${s.id}:${e.effect}`));
}
const count = (plan: InvocationPlan, effect: string): number =>
    plan.order.flatMap((s) => s.effects).filter((e) => e.effect === effect).length;
const ids = (plan: InvocationPlan): string[] => plan.order.map((s) => s.id);
const stated = (input: InvocationInput): string[] => input.stages.map((s) => s.id);

describe('invocation plan fixtures', () => {
    it('G1 — the incident: inbox stops at commit, process-full delivers once (AC-1)', () => {
        const plan = linearize({ stages: [inbox(), processFull()] });
        expect(ids(plan)).toEqual(['inbox', 'process-full']);
        expect(plan.order[0]?.effects.map((e) => e.effect)).toEqual(['local-write', 'commit']);
        expect(count(plan, 'push')).toBe(1);
        expect(count(plan, 'pr-open')).toBe(1);
        expect(count(plan, 'pr-update')).toBe(0);
        expect(count(plan, 'ci-settle')).toBe(1);
        expect(executed(plan).slice(-3)).toEqual(['process-full:push', 'process-full:pr-open', 'process-full:ci-settle']);
        expect(plan.line).toMatch(/^Order: .*inbox.*after process-full — .*writes branch:feat\/x\.$/);
        expect(plan.line?.split('\n')).toHaveLength(1);
        expect(plan.coalesced.map((c) => c.effect).sort()).toEqual(['ci-settle', 'pr-open', 'push']);
    });

    const constraintCases: Array<[string, InvocationInput]> = [
        ['G2 — "in dieser Reihenfolge" keeps the literal order (C1)', { literal: true, stages: [inbox(), processFull()] }],
        ['G3 — a review fence stops after the roadmap, no reorder (C2)', { fenceAfter: 'inbox', stages: [inbox(), processFull()] }],
        ['G4 — a stated reason keeps the early PR (C3)', { stages: [inbox({ reason: 'so the reviewer can read it' }), processFull()] }],
        [
            'G9 — deploy, then migrations: irreversible stages never move (C5)',
            {
                stages: [
                    { id: 'deploy', effects: on('env:prod', 'deploy') },
                    { id: 'migrate', kind: 'implement', effects: on('db:prod', 'destructive') },
                ],
            },
        ],
        [
            'G10 — the outward mail stays first (C5)',
            {
                stages: [
                    { id: 'mail', effects: on('customer', 'outward-message') },
                    { id: 'fix', kind: 'implement', effects: on(B, 'local-write', 'commit', 'push', 'pr-open', 'ci-settle') },
                ],
            },
        ],
    ];

    it.each(constraintCases)('%s (AC-2)', (_name, input) => {
        const plan = linearize(input);
        expect(ids(plan)).toEqual(stated(input));
        expect(plan.line).toBeNull();
        expect(plan.coalesced).toEqual([]);
        for (const [i, stage] of input.stages.entries()) {
            expect(plan.order[i]?.effects.map((e) => e.effect)).toEqual(stage.effects.map((e) => e.effect));
        }
    });

    it('G3 — the fence is reported, so the run stops there', () => {
        expect(linearize({ fenceAfter: 'inbox', stages: [inbox(), processFull()] }).fence).toBe('inbox');
    });

    it('G5 — "implement, then tests" runs the tests first (R0)', () => {
        const plan = linearize({
            stages: [
                { id: 'implement', kind: 'implement', effects: on(B, 'local-write') },
                { id: 'tests', kind: 'test', effects: on(B, 'local-write') },
            ],
        });
        expect(ids(plan)).toEqual(['tests', 'implement']);
        expect(plan.line).toBe('Order: tests before implement — test-first.');
    });

    it('G6 — a check that can void the build runs first (R3)', () => {
        const plan = linearize({
            stages: [
                { id: 'build', kind: 'implement', effects: on(B, 'local-write') },
                { id: 'lib-check', kind: 'check', voids: ['build'], effects: on('lib', 'read') },
            ],
        });
        expect(ids(plan)).toEqual(['lib-check', 'build']);
        expect(plan.line).toBe('Order: lib-check before build — it can void build.');
    });

    it('G7 — "fix, push, then refactor": one push after the refactor (R1, R4)', () => {
        const plan = linearize({
            stages: [
                { id: 'fix', kind: 'implement', effects: on(B, 'local-write', 'commit') },
                { id: 'push', effects: on(B, 'push', 'ci-settle') },
                { id: 'refactor', kind: 'implement', effects: on(B, 'local-write', 'commit') },
            ],
        });
        expect(ids(plan)).toEqual(['fix', 'refactor']);
        expect(executed(plan)).toEqual(['fix:local-write', 'fix:commit', 'refactor:local-write', 'refactor:commit', 'refactor:push', 'refactor:ci-settle']);
        expect(plan.line).toMatch(/push, ci-settle of push move after refactor/);
    });

    it('G7b — a wait on another object goes after independent stages (R4)', () => {
        const plan = linearize({
            stages: [
                { id: 'ship-a', effects: on('branch:a', 'local-write', 'commit', 'push', 'ci-settle') },
                { id: 'docs-c', effects: on('branch:c', 'local-write', 'commit') },
            ],
        });
        expect(ids(plan)).toEqual(['docs-c', 'ship-a']);
        expect(plan.line).toBe('Order: ship-a after docs-c — waits last.');
    });

    it('G8 — two "update the PR" collapse into one (R2)', () => {
        const plan = linearize({
            stages: [
                { id: 'one', effects: on(B, 'local-write', 'commit', 'push', 'pr-update') },
                { id: 'two', effects: on(B, 'local-write', 'commit', 'push', 'pr-update') },
            ],
        });
        expect(count(plan, 'pr-update')).toBe(1);
        expect(count(plan, 'push')).toBe(1);
        expect(plan.coalesced.find((c) => c.effect === 'pr-update')?.from).toEqual(['one', 'two']);
    });

    it('G11 — a single sink-free stage pays nothing (AC-3)', () => {
        const plan = linearize({ stages: [{ id: 'only', effects: on(B, 'local-write') }] });
        expect(plan.fires).toBe(false);
        expect(plan.line).toBeNull();
        expect(ids(plan)).toEqual(['only']);
    });

    it('G11b — a single stage with a sink fires but states nothing', () => {
        const plan = linearize({ stages: [inbox()] });
        expect(plan.fires).toBe(true);
        expect(plan.line).toBeNull();
    });

    it('G12 — a later stage fails: the deferred delivery still lands, marked partial', () => {
        const plan = linearize({ stages: [inbox(), processFull()] });
        const out = deliveryOnFailure(plan, 'process-full');
        expect(out.partial).toBe(true);
        expect(out.effects.map((e) => e.effect)).toEqual(['push', 'pr-open', 'ci-settle']);
        expect(out.line).toMatch(/^Partial: process-full did not finish/);
    });

    it('G13 — a mid-flight "PR only at the end" re-plans the remaining stages without a stop', () => {
        const stages: StageInput[] = [
            { id: 'analyse', kind: 'analysis', effects: on(B, 'local-write') },
            { id: 'fix', kind: 'implement', effects: on(B, 'local-write', 'commit', 'push', 'pr-open', 'ci-settle') },
            { id: 'docs', effects: on(B, 'local-write', 'commit') },
        ];
        const plan = replan({ stages }, ['analyse']);
        expect(ids(plan)).toEqual(['fix', 'docs']);
        expect(executed(plan).slice(-3)).toEqual(['docs:push', 'docs:pr-open', 'docs:ci-settle']);
        expect(plan.line).not.toBeNull();
    });

    it('G14 — free text without a command: the full suite moves after the rename', () => {
        const plan = linearize({
            stages: [
                { id: 'fix', kind: 'implement', effects: on(B, 'local-write') },
                { id: 'suite', effects: on(B, 'full-suite') },
                { id: 'rename', kind: 'implement', effects: on(B, 'local-write') },
            ],
        });
        expect(ids(plan)).toEqual(['fix', 'rename']);
        expect(executed(plan)).toEqual(['fix:local-write', 'rename:local-write', 'rename:full-suite']);
        expect(plan.line).toBe('Order: full-suite of suite move after rename — rename writes branch:feat/x.');
    });
});

describe('invocation plan guards', () => {
    it('a data dependency blocks a methodology move (C4)', () => {
        const plan = linearize({
            stages: [
                { id: 'implement', kind: 'implement', effects: on(B, 'local-write') },
                { id: 'tests', kind: 'test', dependsOn: ['implement'], effects: on(B, 'local-write') },
            ],
        });
        expect(ids(plan)).toEqual(['implement', 'tests']);
        expect(plan.line).toBeNull();
    });

    it('never defers a sink past an irreversible stage', () => {
        const plan = linearize({
            stages: [
                { id: 'ship', effects: on(B, 'local-write', 'commit', 'push') },
                { id: 'release', effects: on('registry', 'release') },
                { id: 'docs', effects: on(B, 'local-write', 'commit') },
            ],
        });
        expect(executed(plan).slice(0, 3)).toEqual(['ship:local-write', 'ship:commit', 'ship:push']);
        expect(ids(plan)).toEqual(['ship', 'release', 'docs']);
    });

    it('refuses an unknown effect, a duplicate id and a dangling reference', () => {
        expect(() => linearize({ stages: [{ id: 'a', effects: [{ effect: 'teleport' as EffectRef['effect'], object: B }] }] })).toThrow(/unknown effect/);
        expect(() => linearize({ stages: [{ id: 'a', effects: [] }, { id: 'a', effects: [] }] })).toThrow(/duplicate/);
        expect(() => linearize({ stages: [{ id: 'a', dependsOn: ['z'], effects: [] }] })).toThrow(/unknown stage/);
        expect(() => linearize({ fenceAfter: 'z', stages: [{ id: 'a', effects: [] }] })).toThrow(/unknown stage/);
    });

    it('refuses a dependency cycle as a plan error, a self-loop included', () => {
        const self = { stages: [{ id: 'a', dependsOn: ['a'], effects: [] }] };
        const pair = { stages: [{ id: 'a', dependsOn: ['b'], effects: [] }, { id: 'b', dependsOn: ['a'], effects: [] }] };
        for (const input of [self, pair]) {
            expect(() => linearize(input)).toThrow(InvocationPlanError);
            expect(() => linearize(input)).toThrow(/cycl/);
        }
    });
});

describe('the context and this file name the same fixtures', () => {
    it('tabulates G1–G14, each of which a test above runs', () => {
        const ctx = fs.readFileSync(path.resolve(__dirname, '../../src/agent-src/contexts/execution/invocation-plan.md'), 'utf8');
        const rows = [...ctx.matchAll(/^\| (G\d+) \|/gmu)].map((m) => m[1]);
        expect(rows).toEqual(Array.from({ length: 14 }, (_, i) => `G${String(i + 1)}`));
        const self = fs.readFileSync(__filename, 'utf8');
        for (const g of rows) expect(self).toMatch(new RegExp(`'${g as string}\\b`));
    });
});
