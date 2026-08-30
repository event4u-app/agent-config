/**
 * Tests for neighbourhood-scoped regression selection
 * (`src/scripts/_lib/regression_neighbourhood.ts`,
 * road-to-governed-harness-evolution step 4.6).
 *
 * The verify clause is *"a candidate touching one surface runs the regressions
 * its neighbourhood names, and a fixture proves a neighbour regression is
 * caught"*, and the second half is the one that can be faked by asserting the
 * selection and stopping there. So the fixture goes one step further: it feeds
 * the FULL registry's outcomes to `catchReport`, where a regression the
 * selection did not reach lands in `missed` instead of `caught`. Narrowing the
 * neighbourhood therefore turns the assertion red rather than making it vacuous
 * — which is what a sensitivity probe needs in order to mean anything.
 *
 * K9 (the killed curriculum generator) is pinned by object identity, not by id:
 * an id assertion would also pass for a synthesized spec carrying a copied id.
 */
import { describe, expect, it } from 'vitest';

import type { Graph } from '../../src/scripts/discovery_graph.js';
import {
    DEFAULT_NEIGHBOURHOOD_DEPTH,
    catchReport,
    neighbourhood,
    selectRegressions,
    selectionVerdict,
    type RegressionSpec,
} from '../../src/scripts/_lib/regression_neighbourhood.js';

/**
 * A relation graph in the shape `discovery_graph` extracts:
 * a rule routes to a skill, the skill routes to a guideline, and both artefacts
 * belong to a pack. The candidate will touch the RULE only.
 */
const RULE = 'src/rules/example-rule.md';
const SKILL = 'src/skills/example-skill/SKILL.md';
const GUIDE = 'docs/guidelines/example-guideline.md';
const OTHER = 'src/skills/unrelated-skill/SKILL.md';

function graph(): Graph {
    return {
        schema_version: 2,
        source_checksum: 'fixture',
        nodes: [RULE, SKILL, GUIDE, OTHER, 'pack:meta'],
        edges: [
            { from: RULE, to: SKILL, rel: 'routes_to', confidence: 'EXTRACTED' },
            { from: SKILL, to: GUIDE, rel: 'routes_to', confidence: 'EXTRACTED' },
            { from: SKILL, to: 'pack:meta', rel: 'member_of', confidence: 'INFERRED' },
            { from: OTHER, to: 'pack:meta', rel: 'member_of', confidence: 'INFERRED' },
        ],
        stats: { routes_to: 2, member_of_pack: 2 },
    };
}

/** The EXISTING regressions. Nothing under test constructs one of these. */
const REG_DIRECT: RegressionSpec = { id: 'reg-direct', guards: [RULE] };
const REG_NEIGHBOUR: RegressionSpec = { id: 'reg-neighbour', guards: [SKILL] };
const REG_FAR: RegressionSpec = { id: 'reg-far', guards: [GUIDE] };
const REG_UNRELATED: RegressionSpec = { id: 'reg-unrelated', guards: [OTHER] };
const REGISTRY: readonly RegressionSpec[] = [REG_DIRECT, REG_NEIGHBOUR, REG_FAR, REG_UNRELATED];

const CANDIDATE = { id: 'cand-1', touches: [RULE] };

describe('4.6 — the neighbourhood is the relation graph, not the diff', () => {
    it('a candidate touching one surface reaches its routed-to neighbour', () => {
        const hood = neighbourhood(graph(), CANDIDATE);
        const byNode = new Map(hood.map((n) => [n.node, n]));

        expect(byNode.get(RULE)).toMatchObject({ reason: 'touched', depth: 0 });
        expect(byNode.get(SKILL)).toMatchObject({ reason: 'neighbour', depth: 1, via: 'routes_to' });
        expect(byNode.get(GUIDE)).toMatchObject({ reason: 'neighbour', depth: 2 });
        // The unrelated skill shares a pack, but `affected` walks OUT-edges only,
        // so a container is a sink and does not bridge back to its other members.
        expect(byNode.has(OTHER)).toBe(false);
    });

    it('marks the container nodes the graph invents as synthetic', () => {
        const hood = neighbourhood(graph(), CANDIDATE);
        const pack = hood.find((n) => n.node === 'pack:meta');
        expect(pack?.synthetic).toBe(true);
        expect(hood.filter((n) => n.node.startsWith('src/')).every((n) => !n.synthetic)).toBe(true);
    });

    it('is deterministic — two runs produce identical reports', () => {
        expect(JSON.stringify(selectRegressions(graph(), CANDIDATE, REGISTRY))).toBe(
            JSON.stringify(selectRegressions(graph(), CANDIDATE, REGISTRY)),
        );
    });

    it('walks the stated default depth', () => {
        expect(DEFAULT_NEIGHBOURHOOD_DEPTH).toBe(2);
    });
});

describe('4.6 — a candidate runs the regressions its neighbourhood names', () => {
    it('selects the direct and neighbour guards and skips the unrelated one', () => {
        const report = selectRegressions(graph(), CANDIDATE, REGISTRY);
        expect(report.selected.map((s) => s.spec.id)).toEqual(['reg-direct', 'reg-far', 'reg-neighbour']);
        expect(report.skipped).toEqual(['reg-unrelated']);
    });

    it('records WHY each was selected — touched surface or neighbour relation', () => {
        const report = selectRegressions(graph(), CANDIDATE, REGISTRY);
        const byId = new Map(report.selected.map((s) => [s.spec.id, s]));
        expect(byId.get('reg-direct')?.reason).toBe('touched');
        expect(byId.get('reg-neighbour')?.reason).toBe('neighbour');
        expect(byId.get('reg-neighbour')?.matched).toEqual([SKILL]);
    });
});

describe('4.6 — the fixture: a NEIGHBOUR regression is caught', () => {
    /**
     * The candidate edits the rule and breaks the skill it routes to. Only
     * `reg-neighbour` fails. It guards a surface the diff never touched, so a
     * diff-scoped selector would not run it and the breakage would go unseen.
     */
    const OUTCOMES = [
        { regression_id: 'reg-direct', passed: true },
        { regression_id: 'reg-neighbour', passed: false },
        { regression_id: 'reg-far', passed: true },
        { regression_id: 'reg-unrelated', passed: true },
    ];

    it('catches the neighbour breakage, and misses nothing', () => {
        const report = selectRegressions(graph(), CANDIDATE, REGISTRY);
        const caught = catchReport(report, OUTCOMES);
        expect(caught.caught).toEqual(['reg-neighbour']);
        expect(caught.missed).toEqual([]);
    });

    it('is falsifiable — a diff-scoped selection MISSES the same breakage', () => {
        // depth 0 is the diff-scoped selector this step exists to replace. The
        // same outcomes, the same registry, and the failure is now invisible.
        const diffScoped = selectRegressions(graph(), CANDIDATE, REGISTRY, 0);
        const caught = catchReport(diffScoped, OUTCOMES);
        expect(caught.caught).toEqual([]);
        expect(caught.missed).toEqual(['reg-neighbour']);
    });
});

describe('4.6 — an unknown neighbourhood refuses, it does not read as empty', () => {
    it('refuses a candidate touching a surface the graph does not carry', () => {
        const report = selectRegressions(graph(), { id: 'cand-2', touches: ['src/rules/ghost.md'] }, REGISTRY);
        expect(report.selected).toEqual([]);
        expect(report.unresolved).toEqual(['src/rules/ghost.md']);
        expect(selectionVerdict(report)?.join(' ')).toContain('absent from the relation graph');
    });

    it('admits a fully resolved candidate', () => {
        expect(selectionVerdict(selectRegressions(graph(), CANDIDATE, REGISTRY))).toBeNull();
    });

    it('refuses an empty neighbourhood rather than reporting a clean sheet', () => {
        const report = selectRegressions(graph(), { id: 'cand-3', touches: [] }, REGISTRY);
        expect(selectionVerdict(report)?.join(' ')).toContain('empty neighbourhood');
    });
});

describe('4.6 — selects, never authors (K9)', () => {
    it('every selected spec is the caller registry object by IDENTITY', () => {
        const report = selectRegressions(graph(), CANDIDATE, REGISTRY);
        expect(report.selected.length).toBeGreaterThan(0);
        for (const s of report.selected) {
            expect(REGISTRY.includes(s.spec)).toBe(true);
        }
    });

    it('an empty registry selects nothing — there is no path that invents one', () => {
        const report = selectRegressions(graph(), CANDIDATE, []);
        expect(report.selected).toEqual([]);
        expect(report.authored).toBe(0);
    });
});
