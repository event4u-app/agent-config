import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import type { CodeGraph, CodeNode } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';
import { vocabularyErrors } from '../../src/scripts/code_graph/vocabulary.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/prisma');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const node = (id: string): CodeNode | undefined => graph.nodes.find((n) => n.id === id);

describe('prisma provider', () => {
    it('detects the schema under prisma/ and ignores one under tests/', () => {
        expect(graph.providers).toEqual([{ id: 'prisma', roots: [''] }]);
        expect(node('table:FixtureOnly')).toBeUndefined();
    });

    it('names tables by @@map and columns by @map', () => {
        expect(graph.nodes.filter((n) => n.kind === 'table').map((n) => n.id).sort()).toEqual(['table:authors', 'table:books']);
        expect(node('column:books.author_id')).toBeDefined();
        expect(node('column:books.authorId')).toBeUndefined();
    });

    it('turns @relation into a foreign key with its action, indexed by @@index', () => {
        const fk = graph.edges.find((e) => e.relation === 'references' && e.source === 'column:books.author_id');
        expect(fk?.target).toBe('column:authors.id');
        expect(fk?.fact?.attrs?.['on_delete']).toBe('cascade');
        expect(fk?.fact?.attrs?.['index']).toBe('declared');
        expect(node('table:books')?.fact?.attrs?.['engine']).toBe('pgsql');
    });

    it('witnesses a column at its field line', () => {
        const w = node('column:books.title')?.fact?.witness;
        expect(w?.file).toBe('prisma/schema.prisma');
        expect(w?.line).toBe(16);
    });

    it('builds a graph the schema gate and the vocabulary accept', () => {
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
        expect(vocabularyErrors(graph)).toEqual([]);
    });
});
