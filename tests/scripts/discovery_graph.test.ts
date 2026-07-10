/**
 * Artefact relation-graph (road-to-retrieval-substrate-hardening B4).
 */
import { describe, expect, it } from 'vitest';

import { affected, buildGraph, explain } from '../../src/scripts/discovery_graph.js';

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
