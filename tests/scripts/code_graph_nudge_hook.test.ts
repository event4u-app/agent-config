/**
 * PreToolUse code-graph nudge hook (ADR-124 Phase 4) — unit tests over the
 * exported pure surface (enabled / classifyTool / nudgeReason). The warn/latch
 * flow is covered structurally: enabled-gate, tool eligibility, and the three
 * source-state branches (present / stale-vs-fresh via detect / absent).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { classifyTool, enabled, nudgeReason } from '../../src/scripts/hooks/code_graph_nudge_hook.js';

function tmpRoot(settings: string | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-nudge-'));
    if (settings !== null) fs.writeFileSync(path.join(dir, '.agent-settings.yml'), settings);
    return dir;
}

const MINIMAL_GRAPH = JSON.stringify({
    schema_version: 1,
    source_checksum: 'x',
    languages: ['php'],
    grammar_abi: 14,
    edge_confidence_counts: { EXTRACTED: 1, INFERRED: 0, AMBIGUOUS: 0 },
    nodes: [{ id: 'a.php', label: 'a.php', kind: 'file', source_file: 'a.php', source_location: [] }],
    edges: [],
});

function writeNativeCache(root: string): void {
    const p = path.join(root, 'agents', 'runtime', 'state', 'code-graph-v1.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, MINIMAL_GRAPH);
}

describe('enabled — settings gate', () => {
    it('true only when hooks.code_graph.enabled: true', () => {
        expect(enabled(tmpRoot('hooks:\n  code_graph:\n    enabled: true\n'))).toBe(true);
        expect(enabled(tmpRoot('hooks:\n  code_graph:\n    enabled: false\n'))).toBe(false);
        expect(enabled(tmpRoot('hooks:\n  rtk_wrap:\n    enabled: true\n'))).toBe(false); // sibling, not us
        expect(enabled(tmpRoot(null))).toBe(false); // no settings file
    });
});

describe('classifyTool — eligibility', () => {
    it('flags Grep/Glob as search and Read-of-code as code-read; ignores others', () => {
        expect(classifyTool({ payload: { tool_name: 'Grep' } }).isSearch).toBe(true);
        expect(classifyTool({ payload: { tool_name: 'Glob' } }).isSearch).toBe(true);
        expect(classifyTool({ payload: { tool_name: 'Read', tool_input: { file_path: 'src/x.php' } } }).isCodeRead).toBe(true);
        const md = classifyTool({ payload: { tool_name: 'Read', tool_input: { file_path: 'README.md' } } });
        expect(md.isSearch || md.isCodeRead).toBe(false);
        const bash = classifyTool({ payload: { tool_name: 'Bash', tool_input: { command: 'ls' } } });
        expect(bash.isSearch || bash.isCodeRead).toBe(false);
    });
});

describe('nudgeReason — source-state branches', () => {
    it('present (fresh, non-git tmp) → query-first line naming the registered form', () => {
        const root = tmpRoot(null);
        writeNativeCache(root);
        const r = nudgeReason(root);
        expect(r).toMatch(/agent-config code-graph query/);
        expect(r.length).toBeLessThan(240); // ≤~40 tokens
    });
    it('absent → refresh-offer line naming the registered form', () => {
        const r = nudgeReason(tmpRoot(null));
        expect(r).toMatch(/No code-graph found/);
        expect(r).toMatch(/agent-config code-graph refresh/);
    });
});
