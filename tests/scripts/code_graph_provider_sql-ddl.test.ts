import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { isSqlSchemaPath } from '../../src/scripts/code_graph/providers/sql_ddl.js';
import type { CodeGraph, CodeNode } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';
import { vocabularyErrors } from '../../src/scripts/code_graph/vocabulary.js';

const FIXTURE = path.resolve(__dirname, '../fixtures/code-graph/sql-ddl');
let graph: CodeGraph;

beforeAll(async () => {
    ({ graph } = await buildFromRepo(FIXTURE, null));
});

const node = (id: string): CodeNode | undefined => graph.nodes.find((n) => n.id === id);
const ids = (kind: string): string[] => graph.nodes.filter((n) => n.kind === kind).map((n) => n.id).sort();

describe('sql-ddl provider', () => {
    it('detects schema files under a migrations directory', () => {
        expect(graph.providers?.map((p) => p.id)).toEqual(['sql-ddl']);
        expect(isSqlSchemaPath('db/migrations/001_init.sql')).toBe(true);
        expect(isSqlSchemaPath('structure.sql')).toBe(true);
        expect(isSqlSchemaPath('tests/data/seed.sql')).toBe(false);
        expect(isSqlSchemaPath('src/queries/report.sql')).toBe(false);
    });

    it('replays the statements: a dropped table is gone, an added column is there', () => {
        expect(ids('table')).toEqual(['table:authors', 'table:books']);
        expect(node('column:books.isbn')).toBeDefined();
        expect(node('table:legacy_notes')).toBeUndefined();
        expect(node('table:fixture_only')).toBeUndefined();
    });

    it('drops an index a later statement drops, and keeps the unique one', () => {
        const attrs = node('table:books')?.fact?.attrs;
        expect(attrs?.['indexes']).toEqual(['books_isbn_unique(isbn) unique']);
        expect(node('column:books.title')?.fact?.attrs?.['index']).toBe('missing');
        expect(node('column:books.isbn')?.fact?.attrs?.['index']).toBe('declared');
    });

    it('draws the foreign key with its action, and names the engine for the FK index', () => {
        const fk = graph.edges.find((e) => e.relation === 'references' && e.source === 'column:books.author_id');
        expect(fk?.target).toBe('column:authors.id');
        expect(fk?.fact?.attrs?.['on_delete']).toBe('cascade');
        // PostgreSQL syntax (BIGSERIAL), so the constraint brings no index.
        expect(fk?.fact?.attrs?.['index']).toBe('missing');
        expect(node('table:books')?.fact?.attrs?.['engine']).toBe('pgsql');
    });

    it('says a view it does not model makes the schema partial', () => {
        expect(node('table:books')?.fact?.attrs?.['completeness']).toBe('partial');
    });

    it('witnesses each column at its own line', () => {
        const col = node('column:books.author_id');
        expect(col?.fact?.witness.file).toBe('db/migrations/001_init.sql');
        expect(col?.fact?.witness.line).toBe(9);
        expect(col?.fact?.witness.hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('builds a graph the schema gate and the vocabulary accept', () => {
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
        expect(vocabularyErrors(graph)).toEqual([]);
    });
});
