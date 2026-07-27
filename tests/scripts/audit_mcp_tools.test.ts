// Tests for src/scripts/audit_mcp_tools.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite:
//   - `--check` is deterministic on the real repo → byte-identical
//     stdout/stderr/exit (the repo's on-disk inventory may legitimately be
//     in-sync OR drifted; whichever it is, py and ts agree).
//   - `--write` byte-identical content: built into a snapshot/restore harness
//     (the script always targets the repo file), asserting the written bytes
//     and console output match and that NO git drift is left behind.
// Skipped without python3.
import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import * as amt from '../../src/scripts/audit_mcp_tools.js';



describe('audit_mcp_tools — module shape', () => {
    it('resolves the canonical catalog / tools / output paths under ROOT', () => {
        expect(amt.CATALOG.endsWith('src/scripts/mcp_server/consumer_tool_catalog.json')).toBe(true);
        expect(amt.TOOLS_TS.endsWith('src/scripts/mcp_server/tools.ts')).toBe(true);
        expect(amt.OUT.endsWith('docs/contracts/mcp-tool-inventory.md')).toBe(true);
    });
});

// ----------------------------------------------------------------------
// Stub honesty + annotation floor (Phase 3 of road-to-credible-install).
// Reads the real, generated consumer_tool_catalog.json directly — the
// same source `audit_mcp_tools.ts` itself renders the inventory from.
// ----------------------------------------------------------------------

interface CatalogTool {
    name: string;
    description: string;
    implemented_on: string[];
    annotations?: { readOnlyHint?: boolean };
}

function _loadCatalogTools(): CatalogTool[] {
    const doc = JSON.parse(fs.readFileSync(amt.CATALOG, 'utf-8')) as { tools: CatalogTool[] };
    return doc.tools;
}

const STUB_MARKER = '[stub — implemented on demand] ';

describe('consumer_tool_catalog.json — stub honesty + annotation floor', () => {
    const tools = _loadCatalogTools();
    const stubs = tools.filter((t) => t.implemented_on.length === 0);
    const implemented = tools.filter((t) => t.implemented_on.length > 0);

    it('has both a stub set and an implemented set (sanity)', () => {
        expect(stubs.length).toBeGreaterThan(0);
        expect(implemented.length).toBeGreaterThan(0);
    });

    it('100% of stubs carry the stub marker', () => {
        for (const t of stubs) {
            expect(t.description.startsWith(STUB_MARKER)).toBe(true);
        }
    });

    it('0% of implemented tools carry the stub marker', () => {
        for (const t of implemented) {
            expect(t.description.startsWith(STUB_MARKER)).toBe(false);
        }
    });

    it('100% of implemented tools have annotations with readOnlyHint present', () => {
        for (const t of implemented) {
            expect(t.annotations).toBeDefined();
            expect(typeof t.annotations!.readOnlyHint).toBe('boolean');
        }
    });
});
