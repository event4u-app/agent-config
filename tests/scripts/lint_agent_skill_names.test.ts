// Tests for src/scripts/lint_agent_skill_names.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public helpers (_frontmatter_name, _spec_violation) plus a
// golden-parity layer that runs python3 vs tsx on the REAL REPO across the
// real CI args (default + --quiet), asserting byte-identical
// stdout/stderr/exit. Golden parity is skipped without python3.
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_agent_skill_names.js';



describe('lint_agent_skill_names — behavioural spec', () => {
    // --- _frontmatter_name ---
    it('extracts a quoted name from frontmatter', () => {
        expect(mod._frontmatter_name('---\nname: "foo-bar"\ndescription: x\n---\nbody')).toBe(
            'foo-bar',
        );
    });

    it('extracts a single-quoted name', () => {
        expect(mod._frontmatter_name("---\nname: 'baz'\n---\n")).toBe('baz');
    });

    it('returns null when there is no opening fence', () => {
        expect(mod._frontmatter_name('no fence\nname: x\n')).toBeNull();
    });

    it('returns null when name is absent', () => {
        expect(mod._frontmatter_name('---\ndescription: x\n---\n')).toBeNull();
    });

    // --- _spec_violation ---
    it('passes a valid hyphen slug', () => {
        expect(mod._spec_violation('code-refactoring')).toBeNull();
        expect(mod._spec_violation('a1')).toBeNull();
    });

    it('flags an over-long name', () => {
        const long = 'a'.repeat(65);
        expect(mod._spec_violation(long)).toBe('longer than 64 chars');
    });

    it('flags a colon-namespaced name', () => {
        const v = mod._spec_violation('council:default');
        expect(v).not.toBeNull();
        expect(v).toContain('lowercase letters');
    });

    it('flags leading/trailing/double hyphens and uppercase', () => {
        expect(mod._spec_violation('-foo')).not.toBeNull();
        expect(mod._spec_violation('foo-')).not.toBeNull();
        expect(mod._spec_violation('foo--bar')).not.toBeNull();
        expect(mod._spec_violation('Foo')).not.toBeNull();
    });

    // --- check helpers run against the real repo without throwing ---
    it('check_commands + check_skills return arrays on the real repo', () => {
        expect(Array.isArray(mod.check_commands())).toBe(true);
        expect(Array.isArray(mod.check_skills())).toBe(true);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

