/**
 * PreToolUse code-graph CONTEXT hook (road-to-a-graph-that-is-shipped 1.2) —
 * unit tests over the exported pure surface (classifyTool / graphState /
 * contextLine) plus the envelope the dispatcher actually hands the host.
 *
 * Replaces `code_graph_nudge_hook.test.ts`. Its `enabled` block is gone with
 * the flag it tested; the two assertions that ARE new are the ones the old
 * hook could not make — that an absent graph is silent, and that the line
 * reaches a verified host as structured `additionalContext` rather than as a
 * bare exit-2 echo.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { classifyTool, contextLine, graphState } from '../../src/scripts/hooks/code_graph_context_hook.js';
import { emitFor } from '../../src/scripts/hooks/host_semantics.js';

function tmpRoot(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'cg-context-'));
}

const MINIMAL_GRAPH = JSON.stringify({
    schema_version: 2,
    source_checksum: 'x',
    languages: ['php'],
    grammar_abi: 14,
    edge_confidence_counts: { EXTRACTED: 1, INFERRED: 0, AMBIGUOUS: 0 },
    suppressed_edge_counts: { dynamic_no_candidate: 0 },
    nodes: [{ id: 'a.php', label: 'a.php', kind: 'file', source_file: 'a.php', source_location: [] }],
    edges: [],
});

function writeNativeCache(root: string): void {
    const p = path.join(root, 'agents', 'runtime', 'state', 'code-graph-v1.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, MINIMAL_GRAPH);
}

describe('classifyTool — eligibility', () => {
    it('treats Grep and Glob as searches', () => {
        expect(classifyTool({ tool_name: 'Grep' }).isSearch).toBe(true);
        expect(classifyTool({ tool_name: 'Glob' }).isSearch).toBe(true);
    });

    it('treats Read of a code file as a code read, and Read of prose as neither', () => {
        const code = classifyTool({ tool_name: 'Read', tool_input: { file_path: 'src/a.ts' } });
        expect(code.isCodeRead).toBe(true);
        const prose = classifyTool({ tool_name: 'Read', tool_input: { file_path: 'README.md' } });
        expect(prose.isCodeRead).toBe(false);
        expect(prose.isSearch).toBe(false);
    });

    it('ignores tools the manifest does not route here', () => {
        const t = classifyTool({ tool_name: 'Bash', tool_input: { command: 'ls' } });
        expect(t.isSearch).toBe(false);
        expect(t.isCodeRead).toBe(false);
    });
});

describe('graphState — the three states', () => {
    it('is absent with no graph anywhere', () => {
        expect(graphState(tmpRoot())).toBe('absent');
    });

    it('is fresh once a native cache exists outside a git repo', () => {
        // No git metadata in a tmpdir, so freshness is UNKNOWN — which reads as
        // `fresh`, mirroring computeVerdict's `picked.stale ? STALE : FRESH`.
        // Pinned because the alternative (inventing a commit count) is the
        // failure mode: `behind:0` would be a fabricated measurement.
        const root = tmpRoot();
        writeNativeCache(root);
        expect(graphState(root)).toBe('fresh');
    });
});

describe('contextLine — what the model is told', () => {
    it('names the state and the verbs on the fresh branch', () => {
        const line = contextLine('fresh');
        expect(line).toContain('code-graph: fresh');
        expect(line).toContain('code-graph query|affected');
    });

    it('carries the commit count on the stale branch, because N is the decision input', () => {
        const line = contextLine('behind:7');
        expect(line).toContain('7 commit(s) behind');
        expect(line).toContain('code-graph refresh');
    });

    it('makes no ordering claim — Kill register K5 forbids graph-first wording', () => {
        for (const state of ['fresh', 'behind:3'] as const) {
            const line = contextLine(state).toLowerCase();
            expect(line).not.toContain('graph-first');
            expect(line).not.toContain('instead of grep');
            expect(line).not.toContain('before grep');
            // The fresh branch must still name grep as a real alternative
            // rather than a fallback, so the absence above is not achieved by
            // simply deleting the comparison.
        }
        expect(contextLine('fresh')).toContain('grep is the other path');
    });

    it('stays inside the one-line budget', () => {
        for (const state of ['fresh', 'behind:12'] as const) {
            expect(contextLine(state)).not.toContain('\n');
            expect(contextLine(state).length).toBeLessThanOrEqual(260);
        }
    });
});

describe('the envelope a verified host receives', () => {
    it('is structured additionalContext at exit 0, never a plain echo at exit 2', () => {
        const line = contextLine('behind:4');
        const emission = emitFor('claude', 'pre_tool_use', 'warn', [line], 2);

        // The whole point of 1.2: advisory context must not ride an exit code
        // that a block-capable event reads as a refusal.
        expect(emission.exit).toBe(0);
        expect(emission.stderr).toBe('');

        const parsed = JSON.parse(emission.stdout) as {
            hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
        };
        expect(parsed.hookSpecificOutput?.hookEventName).toBe('PreToolUse');
        expect(parsed.hookSpecificOutput?.additionalContext).toBe(line);
    });

    it('emits nothing at all when the concern stayed silent', () => {
        const emission = emitFor('claude', 'pre_tool_use', 'allow', [], 0);
        expect(emission.exit).toBe(0);
        expect(emission.stdout).toBe('');
    });

    it('hands an unverified host its legacy exit verbatim, so nothing is echoed at it', () => {
        // `windsurf` carries no verified pre_tool_use contract. The dispatcher
        // swallows concern stdout there, which is precisely why the same line
        // is carried as a rule on instruction-file hosts instead.
        const emission = emitFor('windsurf', 'pre_tool_use', 'warn', [contextLine('fresh')], 2);
        expect(emission.stdout).toBe('');
        expect(emission.exit).toBe(2);
    });
});
