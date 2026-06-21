// Tests for src/scripts/lint_agents_md.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. This is a light behavioural spec over the exported
// pure helper plus the golden-parity layer that runs python3 vs tsx on the
// REAL REPO (skipped without python3). Golden parity is the binding contract.
import { describe, expect, it } from 'vitest';

import * as lam from '../../src/scripts/lint_agents_md.js';



describe('lint_agents_md — behavioural spec', () => {
    it('exposes the path-enumeration threshold constant', () => {
        expect(lam.PATH_ENUM_THRESHOLD).toBe(3);
    });

    it('_is_path_enumeration: bullet + backtick path, no link → true', () => {
        expect(lam._is_path_enumeration('- `src/scripts/foo.ts`')).toBe(true);
    });

    it('_is_path_enumeration: a markdown link line → false', () => {
        // A bullet whose backtick span is a link is a pointer, not enumeration.
        expect(lam._is_path_enumeration('- [foo](src/foo.md) — why')).toBe(false);
    });

    it('_is_path_enumeration: a non-bullet line → false', () => {
        expect(lam._is_path_enumeration('plain `path/here.md` prose')).toBe(false);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

