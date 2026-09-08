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
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { Graph } from '../../src/scripts/discovery_graph.js';
import { buildFromRepo, isTestFile } from '../../src/scripts/code_graph/build.js';
import { loadGraph, type LoadedGraph } from '../../src/scripts/code_graph/query.js';
import {
    DEFAULT_NEIGHBOURHOOD_DEPTH,
    catchReport,
    neighbourhood,
    selectRegressions,
    selectRegressionsFromCode,
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
        expect(selectionVerdict(report)?.join(' ')).toContain('absent from the artefact relation graph');
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

// 3.4 — the same fixture, on the NATIVE code graph.
//
// `road-to-a-graph-that-is-shipped` 3.4: *"`regression_neighbourhood` reads
// this graph via `impact --diff`; the selected regressions and the producing
// edges enter the verdict record."* Its verify is *"the fixture that proves a
// neighbour regression is caught runs on the native graph"*.
//
// So this block is the artefact fixture above, re-expressed in code: a subject,
// a direct caller, a caller of the caller, and a registry whose middle entry
// guards a surface the diff never touched. Same falsifiability discipline —
// the depth-0 arm must MISS the same breakage, or the depth-2 arm proves
// nothing.

const codeDirs: string[] = [];
const codeHandles: LoadedGraph[] = [];
afterEach(() => {
    for (const h of codeHandles.splice(0)) h.close();
    for (const d of codeDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const CODE_FIXTURE: Record<string, string> = {
    'src/subject.ts': 'export function core(x: number): number {\n    return x + 1;\n}\n',
    'src/mid.ts': [
        "import { core } from './subject.js';",
        '',
        'export function mid(x: number): number {',
        '    return core(x) * 2;',
        '}',
        '',
    ].join('\n'),
    'src/edge.ts': [
        "import { mid } from './mid.js';",
        '',
        'export function edge(x: number): number {',
        '    return mid(x) - 1;',
        '}',
        '',
    ].join('\n'),
};

async function codeGraph(files: Record<string, string> = CODE_FIXTURE): Promise<LoadedGraph> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-code-'));
    codeDirs.push(dir);
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    }
    const out = path.join(dir, 'g.json');
    await buildFromRepo(dir, out);
    const g = loadGraph(out, 'fixture');
    codeHandles.push(g);
    return g;
}

const CODE_CANDIDATE = { id: 'cand-code', touches: ['src/subject.ts'] };
const CODE_REGISTRY: RegressionSpec[] = [
    { id: 'reg-direct', guards: ['src/subject.ts#core'] },
    { id: 'reg-neighbour', guards: ['src/mid.ts#mid'] },
    { id: 'reg-far', guards: ['src/edge.ts#edge'] },
    { id: 'reg-unrelated', guards: ['src/nowhere.ts#nothing'] },
];
const CODE_OUTCOMES = [
    { regression_id: 'reg-direct', passed: true },
    { regression_id: 'reg-neighbour', passed: false },
    { regression_id: 'reg-far', passed: true },
    { regression_id: 'reg-unrelated', passed: true },
];

describe('3.4 — selection over the native code graph', () => {
    it('neighbours the touched file by symbol relations and says which graph answered', async () => {
        const g = await codeGraph();
        const r = selectRegressionsFromCode(g, CODE_CANDIDATE, CODE_REGISTRY, 2, isTestFile);
        expect(r.graph).toBe('code');
        expect(r.unresolved).toEqual([]);
        expect(r.neighbourhood.filter((n) => n.reason === 'touched').map((n) => n.node).sort()).toEqual([
            'src/subject.ts',
            'src/subject.ts#core',
        ]);
        // mid is one hop, edge is two — over `calls` / `imports` edges resolved
        // by a real import specifier, never by a name guess.
        const byNode = new Map(r.neighbourhood.map((n) => [n.node, n]));
        expect(byNode.get('src/mid.ts#mid')?.depth).toBe(1);
        expect(byNode.get('src/edge.ts#edge')?.depth).toBe(2);
        expect(byNode.get('src/mid.ts#mid')?.via).toBe('calls/import-specifier');
    });

    it('the producing edges enter the verdict record', async () => {
        const g = await codeGraph();
        const r = selectRegressionsFromCode(g, CODE_CANDIDATE, CODE_REGISTRY, 2, isTestFile);
        expect(r.producing_edges.length).toBeGreaterThan(0);
        expect(r.producing_edges.some((e) => e.includes('src/mid.ts#mid --calls/import-specifier-->'))).toBe(true);
        // Sorted, so two runs over one graph produce byte-identical records.
        expect([...r.producing_edges]).toEqual([...r.producing_edges].sort());
    });

    it('THE FIXTURE: catches the neighbour breakage, and misses nothing', async () => {
        const g = await codeGraph();
        const r = selectRegressionsFromCode(g, CODE_CANDIDATE, CODE_REGISTRY, 2, isTestFile);
        const caught = catchReport(r, CODE_OUTCOMES);
        expect(caught.caught).toEqual(['reg-neighbour']);
        expect(caught.missed).toEqual([]);
    });

    it('is falsifiable — a diff-scoped selection MISSES the same breakage', async () => {
        const g = await codeGraph();
        const diffScoped = selectRegressionsFromCode(g, CODE_CANDIDATE, CODE_REGISTRY, 0, isTestFile);
        const caught = catchReport(diffScoped, CODE_OUTCOMES);
        expect(caught.caught).toEqual([]);
        expect(caught.missed).toEqual(['reg-neighbour']);
    });

    it('refuses a touched file the graph does not carry, rather than selecting nothing', async () => {
        const g = await codeGraph();
        const r = selectRegressionsFromCode(
            g,
            { id: 'cand-ghost', touches: ['src/ghost.ts'] },
            CODE_REGISTRY,
            2,
            isTestFile,
            'fresh',
        );
        expect(r.unresolved).toEqual(['src/ghost.ts']);
        expect(selectionVerdict(r)?.join(' ')).toMatch(/absent from the code graph/);
    });

    it('does NOT refuse for a touched file the graph never indexes', async () => {
        // A `.md` in the diff is not an unknown neighbourhood. Without this
        // case the selector refused unconditionally for any candidate that
        // touched a doc, a `.json` or a `.yaml` — which is most of them.
        const g = await codeGraph();
        const r = selectRegressionsFromCode(
            g,
            { id: 'cand-doc', touches: ['src/subject.ts', 'README.md'] },
            CODE_REGISTRY,
            2,
            isTestFile,
            'fresh',
        );
        expect(r.not_indexed).toEqual(['README.md']);
        expect(r.unresolved).toEqual([]);
        expect(selectionVerdict(r)).toBeNull();
    });

    it('the graph state reaches the verdict record, and an ABSENT graph refuses', async () => {
        // `graph_state` used to be hardcoded `'absent'` and then dropped, so no
        // selection could refuse on a graph that does not exist — a lookup that
        // cannot resolve and then selects nothing reports a clean sheet, which
        // is the failure this module's own docstring names.
        const g = await codeGraph();
        const fresh = selectRegressionsFromCode(g, CODE_CANDIDATE, CODE_REGISTRY, 2, isTestFile, 'fresh');
        expect(fresh.graph_state).toBe('fresh');
        expect(selectionVerdict(fresh)).toBeNull();

        const behind = selectRegressionsFromCode(g, CODE_CANDIDATE, CODE_REGISTRY, 2, isTestFile, 'behind:40');
        expect(behind.graph_state).toBe('behind:40');
        // `behind:N` still ANSWERS — K7 forbids blocking on a stale graph. It is
        // surfaced so a caller that wants to refuse can, not refused here.
        expect(selectionVerdict(behind)).toBeNull();

        const absent = selectRegressionsFromCode(g, CODE_CANDIDATE, CODE_REGISTRY, 2, isTestFile, 'absent');
        expect(selectionVerdict(absent)?.join(' ')).toMatch(/code graph is absent/);
    });

    it('the artefact path carries no graph state, and says so rather than guessing one', () => {
        const report = selectRegressions(graph(), CANDIDATE, REGISTRY);
        expect(report.graph).toBe('artefact');
        expect(report.graph_state).toBeNull();
        expect(report.not_indexed).toEqual([]);
    });

    it('a name-lookup caller does NOT select its regression, and is counted as rejected', async () => {
        // A bare PHP `helper()` with no `use` is resolved by the repo-wide
        // same-name table. It is a real caller and the graph cannot say it is
        // the right one, so selecting a regression on it would be selecting on
        // a guess. This is the discriminator between the two graphs' notions of
        // a neighbour: the artefact graph has no mechanism axis at all.
        const g = await codeGraph({
            'src/util.php': '<?php\n\nfunction helper(): int\n{\n    return 1;\n}\n',
            'src/caller.php': '<?php\n\nfunction caller(): int\n{\n    return helper();\n}\n',
        });
        const r = selectRegressionsFromCode(
            g,
            { id: 'cand-php', touches: ['src/util.php'] },
            [{ id: 'reg-php-caller', guards: ['src/caller.php#caller'] }],
            2,
        );
        expect(r.selected).toEqual([]);
        expect(r.skipped).toEqual(['reg-php-caller']);
        expect(r.rejected_via).toBe('name-lookup 1');
    });

    it('K9 holds on the code path too — every selected spec is the registry object', async () => {
        const g = await codeGraph();
        const r = selectRegressionsFromCode(g, CODE_CANDIDATE, CODE_REGISTRY, 2, isTestFile);
        expect(r.authored).toBe(0);
        for (const sel of r.selected) expect(CODE_REGISTRY.includes(sel.spec)).toBe(true);
    });
});
