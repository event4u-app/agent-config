/**
 * Requirement coverage as a query (road-to-a-graph-that-wins 3.4): ADR
 * `evidence.basis` refs and roadmap `traceability:` evidence refs resolve to
 * code nodes, the tests reaching them over accepted `tests` edges only, and
 * every ref that names nothing lands in `unresolved` with a reason.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type Scope, ask, fetchById } from '../../../src/scripts/code_graph/ask.js';
import { adrCoverage, coverageSources, requirementCoverage } from '../../../src/scripts/code_graph/coverage.js';
import { type LoadedGraph, loadGraph } from '../../../src/scripts/code_graph/query.js';
import type { CodeEdge, CodeGraph, CodeNode } from '../../../src/scripts/code_graph/types.js';

const n = (id: string, at: [number, number] = [1, 3]): CodeNode => {
    const file = id.split('#')[0] as string;
    const sym = id.includes('#');
    return { id, label: sym ? (id.split('#')[1] as string) : path.basename(id), kind: sym ? 'function' : 'file', source_file: file, source_location: sym ? [at[0], 1, at[1], 1] : [] } as CodeNode;
};
const t = (source: string, target: string, resolved_via: string): CodeEdge =>
    ({ source, target, relation: 'tests', confidence: 'EXTRACTED', resolved_via, provider: 'native' }) as CodeEdge;

const graph = {
    schema_version: 7,
    source_checksum: 'fixture',
    languages: ['typescript'],
    grammar_abi: 14,
    edge_confidence_counts: { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 },
    suppressed_edge_counts: { dynamic_no_candidate: 0 },
    nodes: [
        n('src/cart.ts'),
        n('src/cart.ts#sumLines', [2, 5]),
        n('src/report.ts'),
        n('src/report.ts#monthly', [1, 4]),
        n('tests/cart.test.ts'),
        n('tests/report.test.ts'),
    ],
    edges: [
        t('tests/cart.test.ts', 'src/cart.ts#sumLines', 'test-import'),
        // A guessed edge is not coverage: `monthly` must read as untested.
        t('tests/report.test.ts', 'src/report.ts#monthly', 'name-lookup'),
    ],
} as unknown as CodeGraph;

const ADR = `---
adr: 7
status: accepted
evidence:
  strength: E2
  discovery: complete
  basis:
    - src/cart.ts:3
    - src/gone.ts
    - docs/notes.md
    - https://example.com/paper
---

# ADR-007 — Carts sum their lines
`;

const ROADMAP = `# road-to-carts

traceability:
  - requirement_id: carts-sum
    acceptance_id: sum-is-tested
    evidence_refs:
      - sumLines
  - requirement_id: monthly-report
    acceptance_id: report-exists
    evidence_refs:
      - src/report.ts#monthly
      - noSuchSymbol
`;

const scope: Scope = { repoId: 'r', branch: 'main', worktree: '/w', user: 'u' };
let dir: string;
let g: LoadedGraph;
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-'));
    for (const d of ['src', 'docs/decisions', 'agents/roadmaps']) fs.mkdirSync(path.join(dir, d), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src/cart.ts'), 'export const x = 1;\nexport function sumLines() {\n    return 0;\n}\n');
    fs.writeFileSync(path.join(dir, 'src/report.ts'), 'export function monthly() {}\n');
    fs.writeFileSync(path.join(dir, 'docs/notes.md'), '# notes\n');
    fs.writeFileSync(path.join(dir, 'docs/decisions/ADR-007-carts.md'), ADR);
    fs.writeFileSync(path.join(dir, 'agents/roadmaps/road-to-carts.md'), ROADMAP);
    fs.writeFileSync(path.join(dir, 'g.json'), JSON.stringify(graph));
    g = loadGraph(path.join(dir, 'g.json'), 'fixture');
});
afterEach(() => {
    g.close();
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('requirement coverage as a query', () => {
    it('an ADR basis resolves to code nodes and their tests, and lists what names nothing', () => {
        const [adr] = adrCoverage(g, dir);
        expect(adr?.id).toBe('ADR-7');
        expect(adr?.resolved.map((r) => r.ref)).toEqual(['src/cart.ts:3']);
        // The line anchor narrows the file to the declaration spanning it.
        expect(adr?.resolved[0]?.nodes).toEqual(['src/cart.ts', 'src/cart.ts#sumLines']);
        expect(adr?.resolved[0]?.tests).toEqual(['tests/cart.test.ts']);
        expect(adr?.unresolved).toEqual([
            { ref: 'src/gone.ts', reason: 'no such file' },
            { ref: 'docs/notes.md', reason: 'file exists but is not a graph node' },
            { ref: 'https://example.com/paper', reason: 'url — not a code reference' },
        ]);
    });

    it('a requirement row naming a tested symbol is covered; an untested one is not, and a guess edge does not count', () => {
        const rows = requirementCoverage(g, dir);
        const sum = rows.find((r) => r.id === 'carts-sum');
        const monthly = rows.find((r) => r.id === 'monthly-report');
        expect(sum?.source).toBe('agents/roadmaps/road-to-carts.md');
        expect(sum?.resolved).toEqual([{ ref: 'sumLines', via: 'label', nodes: ['src/cart.ts#sumLines'], tests: ['tests/cart.test.ts'], guess_tests_withheld: 0 }]);
        expect(monthly?.resolved).toEqual([{ ref: 'src/report.ts#monthly', via: 'id', nodes: ['src/report.ts#monthly'], tests: [], guess_tests_withheld: 1 }]);
        expect(monthly?.unresolved).toEqual([{ ref: 'noSuchSymbol', reason: 'names no node in the graph' }]);
    });

    it('is reachable through ask, and a fetch shows the unresolved refs', () => {
        const sources = coverageSources(g, 'r', dir);
        const r = ask('requirement coverage for ADR-7', sources, scope);
        expect(r.intent).toBe('coverage');
        expect(r.envelope.answer.map((a) => a.id)).toEqual(['coverage:ADR-7']);
        const f = fetchById('coverage:ADR-7', sources, scope);
        expect(f.ok).toBe(true);
        expect(f.ok ? f.body : '').toContain('unresolved: src/gone.ts — no such file');
    });
});
