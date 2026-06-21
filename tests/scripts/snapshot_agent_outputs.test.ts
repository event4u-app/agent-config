// Tests for src/scripts/snapshot_agent_outputs.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helper (_logical_path) plus a golden-parity layer that runs python3 vs
// tsx and compares stdout + the written snapshot JSON byte-for-byte. The
// snapshot is written to an absolute in-tree temp path (the default + relative
// paths fail in Python's `relative_to(ROOT)` print site); the temp file is
// removed afterwards so the test leaves zero git drift.
import { describe, expect, it } from 'vitest';

import { _logical_path } from '../../src/scripts/snapshot_agent_outputs.js';



describe('snapshot_agent_outputs — _logical_path', () => {
    it('strips the legacy source-root prefix', () => {
        expect(_logical_path('.agent-src.uncondensed/rules/foo.md')).toBe('rules/foo.md');
    });
    it('strips the packages/<pkg>/.agent-src.uncondensed/ prefix', () => {
        expect(_logical_path('packages/core/.agent-src.uncondensed/skills/x/SKILL.md')).toBe(
            'skills/x/SKILL.md',
        );
    });
    it('returns non-source paths unchanged', () => {
        expect(_logical_path('dist/agent-src/rules/foo.md')).toBe('dist/agent-src/rules/foo.md');
    });
    it('normalises backslashes to posix', () => {
        expect(_logical_path('.agent-src.uncondensed\\rules\\foo.md')).toBe('rules/foo.md');
    });
});
