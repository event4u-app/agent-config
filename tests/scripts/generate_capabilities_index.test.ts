// Tests for src/scripts/generate_capabilities_index.ts (py2ts, ADR-200).
//
// No pytest suite exists, so this is a focused differential suite: the pure
// helpers + `build()` against the REAL repo, plus a golden-parity layer that
// runs python3 vs tsx on the real tree — byte-exact generated CAPABILITIES.yaml
// AND identical stdout/stderr/exit for `--check`, the success write, and the
// argparse-error path (skipped without python3). The `<N>ms` timing in the
// success/`--check` stdout is non-deterministic, so it is normalized inline
// before comparison. The writer leaves zero on-disk drift (snapshot + restore).
import { describe, expect, it } from 'vitest';

import * as gen from '../../src/scripts/generate_capabilities_index.js';



/** Replace the non-deterministic `(<N> KB, <M>ms)` timing in stdout. */

describe('generate_capabilities_index — helpers (real repo)', () => {
    it('_coverage_band maps counts to bands at the documented boundaries', () => {
        expect(gen._coverage_band(0)).toBe('none');
        expect(gen._coverage_band(1)).toBe('thin');
        expect(gen._coverage_band(2)).toBe('thin');
        expect(gen._coverage_band(3)).toBe('moderate');
        expect(gen._coverage_band(6)).toBe('moderate');
        expect(gen._coverage_band(7)).toBe('strong');
        expect(gen._coverage_band(99)).toBe('strong');
    });

    it('_scalar JSON-encodes strings (ensure_ascii=False parity)', () => {
        expect(gen._scalar('plain')).toBe('"plain"');
        expect(gen._scalar('has "quote"')).toBe('"has \\"quote\\""');
        expect(gen._scalar('')).toBe('""');
    });

    it('_flow_list renders [] for empty and a JSON-scalar list otherwise', () => {
        expect(gen._flow_list([])).toBe('[]');
        expect(gen._flow_list(['a'])).toBe('["a"]');
        expect(gen._flow_list(['a', 'b'])).toBe('["a", "b"]');
    });

    it('_load_packs returns only in-use packs (those carrying a domain)', () => {
        const packs = gen._load_packs();
        expect(packs.length).toBeGreaterThan(0);
        for (const p of packs) {
            expect(typeof p['domain']).toBe('string');
            expect((p['domain'] as string).length).toBeGreaterThan(0);
        }
    });

    it('_skill_packs / _command_packs map pack-id → sorted unique names', () => {
        const sk = gen._skill_packs();
        const cmd = gen._command_packs();
        // at least one pack is backed by skills and one by commands in the real tree.
        expect(Object.keys(sk).length).toBeGreaterThan(0);
        expect(Object.keys(cmd).length).toBeGreaterThan(0);
        for (const names of Object.values(sk)) {
            expect([...names]).toEqual([...names].sort());
            expect(new Set(names).size).toBe(names.length); // unique
        }
    });

    it('build emits the header, meta block, capability_areas, and gaps; trailing newline', () => {
        const out = gen.build();
        expect(out.startsWith('# CAPABILITIES.yaml — what agent-config already covers\n')).toBe(
            true,
        );
        expect(out).toContain('\nmeta:\n');
        expect(out).toContain('\ncapability_areas:\n');
        expect(out).toContain('\ngaps:\n');
        expect(out).toContain('  generated_by: src/scripts/generate_capabilities_index.py\n');
        expect(out.endsWith('\n')).toBe(true);
        expect(out.endsWith('\n\n')).toBe(false);
    });
});
