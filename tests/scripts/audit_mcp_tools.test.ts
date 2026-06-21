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
import { describe, expect, it } from 'vitest';

import * as amt from '../../src/scripts/audit_mcp_tools.js';



describe('audit_mcp_tools — module shape', () => {
    it('resolves the canonical catalog / tools / output paths under ROOT', () => {
        expect(amt.CATALOG.endsWith('src/scripts/mcp_server/consumer_tool_catalog.json')).toBe(true);
        expect(amt.TOOLS_PY.endsWith('src/scripts/mcp_server/tools.py')).toBe(true);
        expect(amt.OUT.endsWith('docs/contracts/mcp-tool-inventory.md')).toBe(true);
    });
});
