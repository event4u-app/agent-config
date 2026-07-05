/**
 * Tests for `condense.generate_subagent_host_contexts` (ADR-109 §4 — cross-host
 * degradation). On non-Claude-Code hosts a subagent projects to a *passive
 * reference* context file: governance metadata preserved, no faked `@`-dispatch.
 *
 * Isolated via the condense test-state seam (PROJECT_ROOT → tmp, and no
 * `agents/.agent-tools.yml` under tmp ⇒ all tools active), so it never touches
 * the real tree.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as condense from '../../src/scripts/condense.js';

const _UNIT = (name = 'demo-agent'): string =>
    [
        '---',
        'schema_version: subagent-v1',
        `name: ${name}`,
        'description: A demo subagent.',
        'model_tier: medium',
        'tools: [Read, Grep]',
        // subagent-v1 nested trust object — the real production-validator shape.
        'trust:',
        '  level: core',
        '  confidence: high',
        '  human_review_required: false',
        'lifecycle: active',
        'source: package',
        '---',
        '',
        'You are the demo agent. Identify the three most severe issues.',
        '',
    ].join('\n');

describe('generate_subagent_host_contexts', () => {
    let saved: ReturnType<typeof condense._getStateForTest>;
    let tmp: string;
    let srcDir: string;

    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sabctx-'));
        srcDir = path.join(tmp, 'subagents');
        fs.mkdirSync(srcDir, { recursive: true });
        condense.MODULE_STATE.PROJECT_ROOT = tmp; // no agents/.agent-tools.yml ⇒ all tools active
        condense.MODULE_STATE.SUBAGENTS_SOURCE = srcDir;
    });

    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('projects a passive-reference context file to cursor, windsurf and cline', () => {
        fs.writeFileSync(path.join(srcDir, 'demo-agent.md'), _UNIT(), 'utf-8');
        expect(condense.generate_subagent_host_contexts()).toBe(3);

        const cursor = path.join(tmp, '.cursor', 'subagents', 'demo-agent.md');
        const windsurf = path.join(tmp, '.windsurf', 'subagents', 'demo-agent.md');
        const cline = path.join(tmp, '.clinerules', 'demo-agent.subagent.md');
        for (const f of [cursor, windsurf, cline]) {
            expect(fs.existsSync(f)).toBe(true);
            const text = fs.readFileSync(f, 'utf-8');
            // Honest limitation, governance parity, body preserved.
            expect(text).toContain('no native subagent dispatch');
            expect(text).toContain('- trust: core'); // nested trust.level surfaced
            expect(text).toContain('- lifecycle: active');
            expect(text).toContain('- model tier: medium');
            expect(text).toContain('- tools: Read, Grep');
            expect(text).toContain('Identify the three most severe issues.');
            // No native CC model name leaks (this is not a CC agent).
            expect(text).not.toContain('model: sonnet');
        }
    });

    it('reaps a stale generated context whose source was removed', () => {
        fs.writeFileSync(path.join(srcDir, 'demo-agent.md'), _UNIT(), 'utf-8');
        condense.generate_subagent_host_contexts();
        // Simulate a previously-generated file with no current source.
        fs.writeFileSync(path.join(tmp, '.cursor', 'subagents', 'gone.md'), 'old', 'utf-8');
        fs.writeFileSync(path.join(tmp, '.clinerules', 'gone.subagent.md'), 'old', 'utf-8');
        condense.generate_subagent_host_contexts();
        expect(fs.existsSync(path.join(tmp, '.cursor', 'subagents', 'gone.md'))).toBe(false);
        expect(fs.existsSync(path.join(tmp, '.clinerules', 'gone.subagent.md'))).toBe(false);
        expect(fs.existsSync(path.join(tmp, '.cursor', 'subagents', 'demo-agent.md'))).toBe(true);
    });

    it('never reaps a symlink or an unrelated file in .clinerules', () => {
        fs.writeFileSync(path.join(srcDir, 'demo-agent.md'), _UNIT(), 'utf-8');
        fs.mkdirSync(path.join(tmp, '.clinerules'), { recursive: true });
        // A rule symlink + a plain rule .md that we do NOT own (no .subagent.md suffix).
        fs.writeFileSync(path.join(tmp, '.clinerules', 'some-rule.md'), 'rule', 'utf-8');
        fs.symlinkSync('/nonexistent', path.join(tmp, '.clinerules', 'linked.subagent.md'));
        condense.generate_subagent_host_contexts();
        expect(fs.existsSync(path.join(tmp, '.clinerules', 'some-rule.md'))).toBe(true); // not ours
        expect(fs.lstatSync(path.join(tmp, '.clinerules', 'linked.subagent.md')).isSymbolicLink()).toBe(true);
    });

    it('returns 0 when the source dir is absent', () => {
        condense.MODULE_STATE.SUBAGENTS_SOURCE = path.join(tmp, 'nope');
        expect(condense.generate_subagent_host_contexts()).toBe(0);
    });
});
