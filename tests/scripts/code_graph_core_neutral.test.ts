import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CATALOG } from '../../src/scripts/code_graph/providers/catalog.js';
import { PROVIDERS } from '../../src/scripts/code_graph/providers/index.js';
import {
    GUESS_RESOLVED_VIA,
    isStatedResolution,
    type ResolvedVia,
    STATED_RESOLVED_VIA,
    type UnclassifiedResolvedVia,
    type UnknownTrustWord,
} from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

const CORE_DIR = path.resolve(__dirname, '../../src/scripts/code_graph');
const TESTS_DIR = path.resolve(__dirname);

/** Every top-level module of the engine: the core. `providers/` is the only place a framework may be named. */
const coreFiles = [
    ...fs
        .readdirSync(CORE_DIR, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith('.ts'))
        .map((e) => path.join(CORE_DIR, e.name)),
    // The MCP query surface is core too: it serves every stack.
    path.resolve(__dirname, '../../src/scripts/mcp_server/graph_tools.ts'),
];

describe('the graph core names no framework (ADR-298)', () => {
    it('has core modules to check', () => {
        expect(coreFiles.map((f) => path.basename(f))).toEqual(expect.arrayContaining(['build.ts', 'passes.ts', 'map_model.ts', 'types.ts']));
    });

    for (const file of coreFiles) {
        it(`${path.basename(file)} contains no provider id and imports providers only through the registry`, () => {
            const src = fs.readFileSync(file, 'utf-8');
            for (const p of PROVIDERS) {
                expect(new RegExp(`\\b${p.id}\\b`, 'i').test(src), `${p.id} named in ${path.basename(file)}`).toBe(false);
            }
            const providerImports = [...src.matchAll(/from '\.\/providers\/([^']+)'/g)].map((m) => m[1]);
            expect(providerImports.filter((m) => m !== 'index.js')).toEqual([]);
        });
    }

    it('gives every registered provider an oracle test file', () => {
        for (const p of PROVIDERS) {
            expect(fs.existsSync(path.join(TESTS_DIR, `code_graph_provider_${p.id}.test.ts`)), p.id).toBe(true);
        }
    });

    it('gives every registered provider a catalog row with an honest status, and nothing more', () => {
        for (const p of PROVIDERS) {
            const row = CATALOG.find((r) => r.id === p.id);
            expect(row, p.id).toBeDefined();
            expect(['partial', 'verified', 'deep']).toContain(row?.status);
            expect(row?.relations.length, p.id).toBeGreaterThan(0);
        }
        for (const row of CATALOG.filter((r) => r.status !== 'planned')) {
            expect(PROVIDERS.some((p) => p.id === row.id), row.id).toBe(true);
            const fixture = row.fixture?.split(' ')[0] ?? '';
            expect(fs.existsSync(path.resolve(__dirname, '../..', fixture)), `${row.id}: ${fixture}`).toBe(true);
        }
        const ids = CATALOG.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('registers each provider id once', () => {
        const ids = PROVIDERS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('trust is an allowlist', () => {
    const minimal = (resolved_via: string): unknown => ({
        schema_version: 6,
        source_checksum: 'x',
        nodes: [{ id: 'a.ts', label: 'a.ts', kind: 'file', source_file: 'a.ts', source_location: [] }],
        edges: [{ source: 'a.ts', target: 'b.ts', relation: 'imports', confidence: 'EXTRACTED', resolved_via, provider: 'native' }],
    });

    it('classifies a value that is not a mechanism as a guess', () => {
        expect(isStatedResolution('from-a-plugin' as ResolvedVia)).toBe(false);
    });

    it('keeps the three known guesses as guesses', () => {
        for (const via of ['name-lookup', 'dynamic', 'foreign'] as const) expect(isStatedResolution(via)).toBe(false);
    });

    it('the schema gate accepts exactly the mechanisms the trust table classifies', () => {
        const allClassified: [UnclassifiedResolvedVia] extends [never] ? true : false = true;
        const noStrayWord: [UnknownTrustWord] extends [never] ? true : false = true;
        expect(allClassified && noStrayWord).toBe(true);
        for (const via of [...STATED_RESOLVED_VIA, ...GUESS_RESOLVED_VIA]) expect(validateGraph(minimal(via)).ok, via).toBe(true);
        expect(validateGraph(minimal('from-a-plugin')).ok).toBe(false);
    });
});
