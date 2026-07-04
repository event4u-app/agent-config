/**
 * Tests for `condense.generate_claude_subagents` (ADR-109 — native-CC projection).
 *
 * Verifies the subagent-v1 → Claude Code `.claude/agents/` frontmatter transform:
 * model_tier→model mapping (incl. the `inherit` passthrough), tools list→comma
 * form, body preserved verbatim, and stale-file reaping. Isolated via the
 * condense test-state seam so it never touches the real tree.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as condense from '../../src/scripts/condense.js';

const _UNIT = (overrides: { name?: string; model_tier?: string; tools?: string } = {}): string => {
    const name = overrides.name ?? 'demo-agent';
    const tier = overrides.model_tier ?? 'inherit';
    const tools = overrides.tools ?? '[Read, Grep]';
    return [
        '---',
        'schema_version: subagent-v1',
        `name: ${name}`,
        'description: A demo subagent.',
        `model_tier: ${tier}`,
        `tools: ${tools}`,
        'trust:',
        '  level: core',
        '  confidence: high',
        '  human_review_required: false',
        'lifecycle: active',
        'discovery:',
        '  visible: false',
        '  requires_capability: claude_subagents',
        'source: package',
        '---',
        '',
        'You are the demo agent. Do the demo thing.',
        '',
    ].join('\n');
};

function _fm(file: string): Record<string, string> {
    const text = fs.readFileSync(file, 'utf-8');
    const block = text.slice(4, text.indexOf('\n---\n', 4));
    const out: Record<string, string> = {};
    for (const line of block.split('\n')) {
        const m = /^([a-z_]+):\s*(.*)$/.exec(line);
        if (m) out[m[1] as string] = (m[2] as string).trim();
    }
    return out;
}

describe('generate_claude_subagents', () => {
    let saved: ReturnType<typeof condense._getStateForTest>;
    let tmp: string;
    let srcDir: string;
    let agentsDir: string;

    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sabgen-'));
        srcDir = path.join(tmp, 'subagents');
        agentsDir = path.join(tmp, 'agents');
        fs.mkdirSync(srcDir, { recursive: true });
        condense.MODULE_STATE.SUBAGENTS_SOURCE = srcDir;
        condense.MODULE_STATE.CLAUDE_AGENTS_DIR = agentsDir;
    });

    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('projects a subagent to CC format with inherit passthrough', () => {
        fs.writeFileSync(path.join(srcDir, 'demo-agent.md'), _UNIT(), 'utf-8');
        expect(condense.generate_claude_subagents()).toBe(1);
        const out = path.join(agentsDir, 'demo-agent.md');
        expect(fs.existsSync(out)).toBe(true);
        const fm = _fm(out);
        expect(fm.name).toBe('demo-agent');
        expect(fm.description).toBe('A demo subagent.');
        expect(fm.tools).toBe('Read, Grep');
        expect(fm.model).toBe('inherit');
        // Governance fields must NOT leak into the CC file.
        expect(fm.schema_version).toBeUndefined();
        expect(fm.discovery).toBeUndefined();
        // Body preserved verbatim.
        expect(fs.readFileSync(out, 'utf-8')).toContain('You are the demo agent. Do the demo thing.');
    });

    it('maps model_tier high→opus, medium→sonnet, lite→haiku', () => {
        for (const [tier, model] of [['high', 'opus'], ['medium', 'sonnet'], ['lite', 'haiku']] as const) {
            fs.writeFileSync(path.join(srcDir, 'demo-agent.md'), _UNIT({ model_tier: tier }), 'utf-8');
            condense.generate_claude_subagents();
            expect(_fm(path.join(agentsDir, 'demo-agent.md')).model).toBe(model);
        }
    });

    it('reaps a stale generated agent whose source was removed', () => {
        fs.writeFileSync(path.join(srcDir, 'demo-agent.md'), _UNIT(), 'utf-8');
        condense.generate_claude_subagents();
        // Simulate a previously-generated agent with no current source.
        fs.writeFileSync(path.join(agentsDir, 'gone.md'), '---\nname: gone\n---\nold', 'utf-8');
        condense.generate_claude_subagents();
        expect(fs.existsSync(path.join(agentsDir, 'gone.md'))).toBe(false);
        expect(fs.existsSync(path.join(agentsDir, 'demo-agent.md'))).toBe(true);
    });

    it('returns 0 when the source dir is absent', () => {
        condense.MODULE_STATE.SUBAGENTS_SOURCE = path.join(tmp, 'nope');
        expect(condense.generate_claude_subagents()).toBe(0);
    });
});
