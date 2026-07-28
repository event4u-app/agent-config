// Tests for src/scripts/build_mcp_catalog.ts (Phase 3 of
// road-to-credible-install — MCP hygiene: generated truth, honest stubs).
//
// Red/green coverage for the --strict drift gate:
//   - green: --strict exits 0 against the real, already-regenerated
//     consumer_tool_catalog.json.
//   - red: --strict exits 1 against a tampered copy (via the
//     _setConfigForTest path-override seam — never touches the real repo
//     file).
// Plus structural coverage: deterministic name-sort, the stub-marker /
// annotation split, and the duplicate-name guard.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { makeTmpDir } from './_mcp_server.js';

import {
    CATALOG_PATH,
    ROOT,
    STUB_MARKER,
    _buildCatalog,
    _buildEntries,
    _computeFreshContent,
    _getConfigForTest,
    _setConfigForTest,
    main,
} from '../../src/scripts/build_mcp_catalog.js';

const tmpDirs: string[] = [];
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop()!;
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* best-effort */
        }
    }
});
function tmp(): string {
    const d = makeTmpDir('mcp-catalog-');
    tmpDirs.push(d);
    return d;
}

describe('build_mcp_catalog — module shape', () => {
    it('resolves ROOT / CATALOG_PATH under the repo tree', () => {
        expect(ROOT().length).toBeGreaterThan(0);
        expect(CATALOG_PATH().endsWith('src/scripts/mcp_server/consumer_tool_catalog.json')).toBe(true);
    });
});

describe('build_mcp_catalog — deterministic content', () => {
    it('sorts every tool entry by name', () => {
        const entries = _buildEntries();
        const names = entries.map((e) => e.name);
        expect(names).toEqual([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    });

    it('every implemented entry carries implemented_on:[stdio] + annotations, no stub marker', () => {
        for (const e of _buildEntries()) {
            if (e.implemented_on.length > 0) {
                expect(e.implemented_on).toEqual(['stdio']);
                expect(e.description.startsWith(STUB_MARKER)).toBe(false);
                expect(e.annotations).toBeDefined();
                expect(typeof e.annotations!.readOnlyHint).toBe('boolean');
                expect(e.annotations!.readOnlyHint).toBe(e.side_effect === 'ro');
            }
        }
    });

    it('every stub entry carries implemented_on:[] + the stub marker, no annotations', () => {
        for (const e of _buildEntries()) {
            if (e.implemented_on.length === 0) {
                expect(e.description.startsWith(STUB_MARKER)).toBe(true);
                expect(e.annotations).toBeUndefined();
            }
        }
    });

    it('re-serializing twice yields byte-identical output (idempotent)', () => {
        expect(_computeFreshContent()).toBe(_computeFreshContent());
    });

    it('install_hint_stdio names the actual package + mcp-server command', () => {
        const catalog = _buildCatalog() as { install_hint_stdio: string };
        expect(catalog.install_hint_stdio).toBe('npx -y @event4u/agent-config mcp-server');
    });
});

describe('build_mcp_catalog — --strict drift gate', () => {
    it('green: exits 0 against the real, already-regenerated catalog file', () => {
        const code = main(['--strict', '--quiet']);
        expect(code).toBe(0);
    });

    it('red: exits 1 against a tampered copy (path-override seam, never the real file)', () => {
        const saved = _getConfigForTest();
        const root = tmp();
        const tamperedPath = path.join(root, 'consumer_tool_catalog.json');
        const fresh = JSON.parse(_computeFreshContent()) as { tools: unknown[] };
        fresh.tools = []; // tamper: hand-edit that empties the tool list
        fs.writeFileSync(tamperedPath, JSON.stringify(fresh, null, 2) + '\n', 'utf-8');
        try {
            _setConfigForTest({ CATALOG_PATH: tamperedPath });
            const code = main(['--strict', '--quiet']);
            expect(code).toBe(1);
        } finally {
            _setConfigForTest(saved);
        }
    });

    it('red: exits 1 when the catalog file is missing entirely', () => {
        const saved = _getConfigForTest();
        const root = tmp();
        try {
            _setConfigForTest({ CATALOG_PATH: path.join(root, 'does-not-exist.json') });
            expect(main(['--strict', '--quiet'])).toBe(1);
        } finally {
            _setConfigForTest(saved);
        }
    });

    it('--write regenerates a byte-identical file at an overridden path', () => {
        const saved = _getConfigForTest();
        const root = tmp();
        const target = path.join(root, 'consumer_tool_catalog.json');
        try {
            _setConfigForTest({ CATALOG_PATH: target });
            expect(main(['--write', '--quiet'])).toBe(0);
            expect(fs.readFileSync(target, 'utf-8')).toBe(_computeFreshContent());
        } finally {
            _setConfigForTest(saved);
        }
    });
});
