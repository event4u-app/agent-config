// Tests for src/scripts/prove_pack_extractable.ts (py2ts Phase 8 / Wave 8g).
//
// Ports tests/test_prove_pack_extractable.py 1:1 (laravel is extractable;
// unknown pack reports cleanly) plus a golden-parity layer comparing the
// `--json` payload from python3 vs tsx on the REAL repo. The `closure`,
// `hard_dangling`, and `advisory` arrays are compared as SORTED sets because
// the Python original iterates an unsorted glob (OS-order non-determinism),
// while the TS twin iterates the deterministic sorted agent_src view.
import { describe, expect, it } from 'vitest';

import { prove } from '../../src/scripts/prove_pack_extractable.js';


describe('prove_pack_extractable — ported pytest suite', () => {
    it('laravel is extractable', () => {
        const { extractable: ok, hard, closure } = prove('laravel');
        expect(ok).toBe(true);
        expect(hard).toEqual([]);
        for (const p of ['laravel', 'php', 'engineering-base']) {
            expect(closure.has(p)).toBe(true);
        }
    });

    it('unknown pack reports cleanly', () => {
        const { extractable: ok, hard: msgs, closure } = prove('definitely-not-a-pack');
        expect(ok).toBe(false);
        expect(closure.size).toBe(0);
        expect(msgs.length).toBeGreaterThan(0);
        expect(msgs[0]).toContain('unknown pack');
    });
});

// ---- Golden parity: python3 vs tsx --json (sorted-set compare) -------------

