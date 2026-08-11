/**
 * Artefact relation-graph (road-to-retrieval-substrate-hardening B4).
 */
import { describe, expect, it } from 'vitest';

import {
    GRAPH_SCHEMA_VERSION,
    affected,
    buildGraph,
    explain,
    inboundZero,
    isSyntheticNode,
} from '../../src/scripts/discovery_graph.js';

const manifest = {
    checksum: 'sha256:test',
    artefacts: [
        { path: 'src/rules/new-rule.md', category: 'rule', replaces: 'src/rules/old-rule.md', routes_to: 'src/skills/foo/SKILL.md', packs: ['eng'], workspaces: ['engineering'] },
        { path: 'src/rules/old-rule.md', category: 'rule', packs: ['eng'] },
        { path: 'src/skills/foo/SKILL.md', category: 'skill', packs: ['eng'], replaces: 'docs/decisions/ADR-042-thing.md' },
        { path: 'src/rules/unrelated.md', category: 'rule', workspaces: ['design'] },
    ],
};

describe('buildGraph — edge extraction', () => {
    const g = buildGraph(manifest);

    it('extracts supersedes + reverse superseded_by (EXTRACTED)', () => {
        expect(g.edges).toContainEqual({ from: 'src/rules/new-rule.md', to: 'src/rules/old-rule.md', rel: 'supersedes', confidence: 'EXTRACTED' });
        expect(g.edges).toContainEqual({ from: 'src/rules/old-rule.md', to: 'src/rules/new-rule.md', rel: 'superseded_by', confidence: 'EXTRACTED' });
    });

    it('extracts routes_to (EXTRACTED) and pack/workspace membership (INFERRED)', () => {
        expect(g.edges).toContainEqual({ from: 'src/rules/new-rule.md', to: 'src/skills/foo/SKILL.md', rel: 'routes_to', confidence: 'EXTRACTED' });
        expect(g.edges).toContainEqual({ from: 'src/rules/new-rule.md', to: 'pack:eng', rel: 'member_of', confidence: 'INFERRED' });
        expect(g.edges).toContainEqual({ from: 'src/rules/unrelated.md', to: 'workspace:design', rel: 'member_of', confidence: 'INFERRED' });
    });

    it('flags an ADR reference target (EXTRACTED)', () => {
        expect(g.edges.some((e) => e.rel === 'references_adr' && e.to.includes('ADR-042'))).toBe(true);
    });

    it('is byte-stable: identical manifest → identical graph', () => {
        expect(JSON.stringify(buildGraph(manifest))).toBe(JSON.stringify(buildGraph(manifest)));
    });

    it('carries the manifest checksum for content-addressed cache invalidation', () => {
        expect(g.source_checksum).toBe('sha256:test');
    });
});

describe('affected — relation BFS', () => {
    const g = buildGraph(manifest);
    it('reaches the pack co-node and the superseded rule from the new rule', () => {
        const hits = affected(g, 'src/rules/new-rule.md', 3).map((h) => h.node);
        expect(hits).toContain('pack:eng');
        expect(hits).toContain('src/rules/old-rule.md');
        expect(hits).toContain('src/skills/foo/SKILL.md');
    });
    it('respects the depth bound', () => {
        const d1 = affected(g, 'src/rules/new-rule.md', 1);
        expect(d1.every((h) => h.depth === 1)).toBe(true);
    });
});

describe('explain — seed + 2-hop + budget-cut', () => {
    const g = buildGraph(manifest);
    it('seeds on a concept substring and cuts at the budget', () => {
        const { seeds, nodes } = explain(g, 'foo', 10);
        expect(seeds).toContain('src/skills/foo/SKILL.md');
        expect(nodes.length).toBeLessThanOrEqual(10);
    });
    it('the budget hard-cuts the node set', () => {
        const { nodes } = explain(g, 'rule', 1);
        expect(nodes.length).toBe(1);
    });
});

describe('stats — per-pass counts and error containment', () => {
    it('carries a count for every extraction pass and stamps the payload version', () => {
        const g = buildGraph(manifest);
        expect(g.schema_version).toBe(GRAPH_SCHEMA_VERSION);
        expect(Object.keys(g.stats).sort()).toEqual([
            'dangling_targets',
            'member_of_pack',
            'member_of_workspace',
            'references_adr',
            'routes_to',
            'supersedes',
        ]);
        // Derived from the fixture, not hardcoded to an observed run: every
        // pass's count is the number of edges that pass is responsible for.
        const perPass = (rel: string): number => manifest.artefacts.filter((a) => rel in a).length;
        expect(g.stats['supersedes']).toBe(perPass('replaces') * 2);
        expect(g.stats['routes_to']).toBe(perPass('routes_to'));
        expect(g.stats['member_of_pack']).toBe(perPass('packs'));
        expect(g.stats['member_of_workspace']).toBe(perPass('workspaces'));
    });

    it('a pass that throws is recorded as "error" and costs only itself', () => {
        const hostile = {
            checksum: 'sha256:hostile',
            artefacts: [
                {
                    path: 'src/rules/hostile.md',
                    get replaces(): string {
                        throw new Error('malformed field');
                    },
                    routes_to: 'src/skills/foo/SKILL.md',
                    packs: ['eng'],
                },
            ],
        };
        const g = buildGraph(hostile);
        expect(g.stats['supersedes']).toBe('error');
        // The other passes are unaffected — the whole point of the containment.
        expect(g.stats['routes_to']).toBe(1);
        expect(g.stats['member_of_pack']).toBe(1);
        expect(g.edges.some((e) => e.rel === 'routes_to')).toBe(true);
        expect(g.edges.some((e) => e.rel === 'supersedes')).toBe(false);
    });

    it('stays byte-stable with stats present', () => {
        expect(JSON.stringify(buildGraph(manifest))).toBe(JSON.stringify(buildGraph(manifest)));
    });

    it('counts distinct EXTRACTED targets that name no artefact path', () => {
        const g = buildGraph(manifest);
        // Derived from the fixture: the ADR target is the only EXTRACTED target
        // that is not itself an artefact entry.
        const paths = new Set(manifest.artefacts.map((a) => a.path));
        const expected = new Set(
            g.edges.filter((e) => e.confidence === 'EXTRACTED' && !paths.has(e.to)).map((e) => e.to),
        );
        expect(g.stats['dangling_targets']).toBe(expected.size);
        expect(expected).toContain('docs/decisions/ADR-042-thing.md');
    });

    it('reports zero dangling targets when every target resolves', () => {
        const resolved = {
            checksum: 'sha256:resolved',
            artefacts: [
                { path: 'a.md', routes_to: 'b.md' },
                { path: 'b.md' },
            ],
        };
        expect(buildGraph(resolved).stats['dangling_targets']).toBe(0);
    });
});

describe('isSyntheticNode — the id-space discriminator', () => {
    it('separates pack/workspace containers from artefact paths', () => {
        expect(isSyntheticNode('pack:eng')).toBe(true);
        expect(isSyntheticNode('workspace:design')).toBe(true);
        expect(isSyntheticNode('src/rules/unrelated.md')).toBe(false);
        expect(isSyntheticNode('docs/decisions/ADR-042-thing.md')).toBe(false);
    });
});

describe('inboundZero — the zero-inbound review list', () => {
    const g = buildGraph(manifest);
    const hits = inboundZero(g);

    it('lists exactly the artefacts no EXTRACTED edge points at', () => {
        // Derived: an artefact is a hit iff it is the `to` of no EXTRACTED edge.
        const pointedAt = new Set(g.edges.filter((e) => e.confidence === 'EXTRACTED').map((e) => e.to));
        const expected = g.nodes.filter((n) => !isSyntheticNode(n) && !pointedAt.has(n));
        expect(hits).toEqual(expected);
        // And concretely, on this fixture, that is the one unreferenced rule.
        expect(hits).toEqual(['src/rules/unrelated.md']);
    });

    it('never reports a pack or workspace container', () => {
        expect(hits.some(isSyntheticNode)).toBe(false);
    });

    it('does not let INFERRED member_of edges mask an unreferenced artefact', () => {
        // `src/rules/unrelated.md` HAS an outgoing member_of edge and is still a
        // hit — counting INFERRED edges would empty the report of everything packed.
        expect(g.edges.some((e) => e.from === 'src/rules/unrelated.md' && e.rel === 'member_of')).toBe(true);
        expect(hits).toContain('src/rules/unrelated.md');
    });
});
