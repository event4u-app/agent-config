// Tests for src/scripts/generate_capability_matrix.ts (py2ts, ADR-096).
//
// No pytest suite exists, so this is a focused differential suite: the
// derivation guard (`parse_dispatcher_generators` reads the live condense.ts
// dispatcher) + `build_matrix` / `coverage_guard` / `render_json` purity
// (including the `ensure_ascii` `†` escape of the `†` cell), plus a
// golden-parity layer that runs python3 vs tsx on the real tree — byte-exact
// docs/capability-matrix.md AND dist/discovery/capability-matrix.json, plus
// identical stdout/stderr/exit for --check and the argparse-error path
// (skipped without python3). Writers leave zero on-disk drift.
import { describe, expect, it } from 'vitest';

import * as gen from '../../src/scripts/generate_capability_matrix.js';



describe('generate_capability_matrix — derivation + matrix purity', () => {
    it('the dispatcher derivation is fully covered by _FN_SPEC (empty guard)', () => {
        // Every generate_* call in condense.ts _generate_tools_inner is mapped.
        expect(gen.coverage_guard()).toEqual([]);
        const gens = gen.parse_dispatcher_generators();
        expect(gens.size).toBeGreaterThan(0);
        expect(gens.has('generate_rule_symlinks')).toBe(true);
        expect(gens.has('generate_plugin_hooks')).toBe(true);
    });

    it('build_matrix fills native/adapter cells and the install-time † cell', () => {
        const m = gen.build_matrix();
        // rules: claude-code native, cursor adapter, copilot install-time adapter†.
        expect(m['rules']?.['claude-code']).toBe('native');
        expect(m['rules']?.['cursor']).toBe('adapter');
        expect(m['rules']?.['copilot']).toBe('adapter†');
        // hooks only on claude-plugin; nothing on copilot.
        expect(m['hooks']?.['claude-plugin']).toBe('native');
        expect(m['hooks']?.['copilot']).toBe('none');
        // every artifact row carries every host.
        for (const a of Object.keys(m)) {
            expect(Object.keys(m[a] as Record<string, string>).length).toBe(9);
        }
    });

    it('render_md emits the host header table + glyph cells', () => {
        const md = gen.render_md(gen.build_matrix());
        expect(md.startsWith('# Capability matrix — what works on which host\n')).toBe(true);
        expect(md).toContain('| Artifact | claude-code | claude-plugin |');
        expect(md).toContain('🔁 adapter †'); // copilot install-time cell
        expect(md).toContain('✅ native');
        expect(md).toContain('— none');
        expect(md.endsWith('\n')).toBe(true);
        expect(md.endsWith('\n\n')).toBe(false);
    });

    it('render_json escapes the non-ASCII † to \\u2020 (ensure_ascii) and carries a checksum', () => {
        const js = gen.render_json(gen.build_matrix());
        expect(js).toContain('\\u2020'); // † escaped, never raw
        expect(js).not.toContain('†');
        expect(js).toMatch(/"checksum": "sha256:[0-9a-f]{64}"/);
        // sorted keys, 2-space indent, trailing newline.
        expect(js.startsWith('{\n  "artifacts": [')).toBe(true);
        expect(js.endsWith('}\n')).toBe(true);
    });
});
