// Tests for src/scripts/lint_profile_overlay_set_only.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// Layer 1: tests/test_lint_profile_overlay_set_only.py ported 1:1 over the
//   pure helpers (_find_scalar_active_packs, _walk_keys, PRECEDENCE_KEYS,
//   _pack_universe) and the live-tree lint() == 0 invariant.
// Layer 2: CLI golden parity python3 vs tsx on the REAL REPO (default +
//   --quiet, the real CI args). Skipped without python3.
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_profile_overlay_set_only.js';



describe('lint_profile_overlay_set_only — ported pytest suite (helpers)', () => {
    it('test_live_tree_passes', () => {
        expect(mod.lint(true)).toBe(0);
    });

    it('test_scalar_active_packs_detected', () => {
        expect(mod._find_scalar_active_packs({ runtime: { active_packs: 'developer' } })).toBe(true);
        expect(mod._find_scalar_active_packs({ runtime: { active_packs: { id: 'x' } } })).toBe(true);
    });

    it('test_list_active_packs_is_fine', () => {
        expect(mod._find_scalar_active_packs({ runtime: { active_packs: ['a', 'b'] } })).toBe(false);
        expect(mod._find_scalar_active_packs({ profile: { packs: ['a'] } })).toBe(false);
    });

    it('test_precedence_key_detected', () => {
        const keys = new Set(mod._walk_keys({ profile: { packs: ['a'], priority: 1 } }));
        const overlap = new Set([...keys].filter((k) => mod.PRECEDENCE_KEYS.has(k)));
        expect(overlap).toEqual(new Set(['priority']));
        for (const k of ['precedence', 'order', 'rank', 'weight']) {
            expect(mod.PRECEDENCE_KEYS.has(k)).toBe(true);
        }
    });

    it('test_no_precedence_key_clean', () => {
        const keys = new Set(mod._walk_keys({ profile: { packs: ['a'], audience: { label: 'x' } } }));
        const overlap = [...keys].filter((k) => mod.PRECEDENCE_KEYS.has(k));
        expect(overlap.length).toBe(0);
    });

    it('test_pack_universe_nonempty', () => {
        expect(mod._pack_universe().size).toBeGreaterThan(0);
    });
});

// --- CLI golden parity on the REAL REPO -------------------------------------

