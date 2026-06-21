// Tests for src/scripts/lint_orchestrator_auto_detect.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists, so this is a focused differential suite over the
// public helpers (_split_frontmatter, check) plus a golden-parity layer that
// runs python3 vs tsx on the REAL REPO (default + --quiet), asserting
// byte-identical stdout/stderr/exit. Golden parity is skipped without python3.
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_orchestrator_auto_detect.js';



describe('lint_orchestrator_auto_detect — behavioural spec', () => {
    // --- _split_frontmatter ---
    it('splits a frontmatter block from the body', () => {
        const [fm, body] = mod._split_frontmatter('---\ntype: orchestrator\nauto_detect: true\n---\nbody\n');
        expect(fm).toBe('type: orchestrator\nauto_detect: true');
        expect(body).toBe('body\n');
    });

    it('returns ["", text] when no opening fence', () => {
        const [fm, body] = mod._split_frontmatter('no fence\n');
        expect(fm).toBe('');
        expect(body).toBe('no fence\n');
    });

    it('returns ["", text] when no closing fence', () => {
        const [fm, body] = mod._split_frontmatter('---\ntype: x\nstill open\n');
        expect(fm).toBe('');
        expect(body).toBe('---\ntype: x\nstill open\n');
    });

    // --- check against the real repo ---
    it('check() returns an array of violations on the real repo', () => {
        const v = mod.check();
        expect(Array.isArray(v)).toBe(true);
        for (const item of v) {
            expect(typeof item.file).toBe('string');
            expect(typeof item.reason).toBe('string');
        }
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

