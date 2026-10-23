import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { sqlalchemyProvider } from '../../src/scripts/code_graph/providers/sqlalchemy.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/sqlalchemy');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const out = (source: string, relation: string): string[] =>
    graph.edges.filter((e) => e.source === source && e.relation === relation).map((e) => e.target).sort();

describe('sqlalchemy provider', () => {
    it('detects sqlalchemy from pyproject.toml', () => {
        expect(graph.providers).toEqual([{ id: 'sqlalchemy', roots: [''] }]);
    });

    it('detects each distribution it covers and stays inactive without one', () => {
        const probe = (manifests: Array<[string, string]>) => ({ manifests: new Map(manifests), markers: new Set<string>(), paths: [] });
        expect(sqlalchemyProvider.detect(probe([]))).toEqual([]);
        expect(sqlalchemyProvider.detect(probe([['requirements.txt', 'sqlalchemy-utils==0.41\n']]))).toEqual([]);
        expect(sqlalchemyProvider.detect(probe([['requirements.txt', 'Flask-SQLAlchemy==3.1\n']]))).toEqual(['']);
        expect(sqlalchemyProvider.detect(probe([['api/requirements.txt', 'sqlmodel\n']]))).toEqual(['api']);
    });

    it('maps a __tablename__ class to its table', () => {
        expect(out('db/models.py#User', 'persists')).toEqual(['table:users']);
        expect(out('db/models.py#Post', 'persists')).toEqual(['table:posts']);
    });

    it('gives a SQLModel table=True class its lowercased name', () => {
        expect(out('db/heroes.py#Hero', 'persists')).toEqual(['table:hero']);
    });

    it('maps no base, mixin, non-table model, unmapped class, or function-local assignment', () => {
        for (const id of ['db/models.py#Base', 'db/models.py#TimestampMixin', 'db/heroes.py#HeroBase', 'legacy/models.py#Post']) {
            expect(out(id, 'persists'), id).toEqual([]);
        }
        expect(graph.nodes.some((n) => n.id === 'table:not_a_table')).toBe(false);
        expect(graph.nodes.filter((n) => n.kind === 'table').map((n) => n.id).sort()).toEqual(['table:hero', 'table:posts', 'table:users']);
    });

    it('relates relationship("Name") and relationship(Name) to the mapped class', () => {
        expect(out('db/models.py#User', 'relates')).toEqual(['db/models.py#Post']);
        expect(out('db/models.py#Post', 'relates')).toEqual(['db/models.py#User']);
    });

    it('never relates to an unmapped same-named class, a missing class, or a lambda target', () => {
        expect(graph.edges.some((e) => e.relation === 'relates' && e.target === 'legacy/models.py#Post')).toBe(false);
        expect(graph.edges.filter((e) => e.relation === 'relates')).toHaveLength(2);
    });

    it('stamps its edges and keeps the graph valid', () => {
        const mine = graph.edges.filter((e) => e.relation === 'persists' || e.relation === 'relates');
        expect(mine.length).toBe(5);
        expect(mine.every((e) => e.provider_id === 'sqlalchemy')).toBe(true);
        expect(mine.filter((e) => e.relation === 'relates').every((e) => e.resolved_via === 'orm-relation')).toBe(true);
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});
