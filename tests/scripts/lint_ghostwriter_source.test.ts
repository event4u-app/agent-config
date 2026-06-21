// Tests for src/scripts/lint_ghostwriter_source.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Light behavioural spec over exported pure helpers
// (validate_alias, is_latin_or_allowed) plus the golden-parity layer that runs
// python3 vs tsx on the REAL REPO (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as lgs from '../../src/scripts/lint_ghostwriter_source.js';



describe('lint_ghostwriter_source — validate_alias', () => {
    it('accepts a plain Latin alias', () => {
        expect(lgs.validate_alias('Alex')).toBeNull();
    });

    it('rejects a non-string alias with the Python type name', () => {
        expect(lgs.validate_alias(42)).toBe('alias must be a string, got int');
        expect(lgs.validate_alias(true)).toBe('alias must be a string, got bool');
    });

    it('rejects an alias shorter than ALIAS_MIN_LEN', () => {
        expect(lgs.ALIAS_MIN_LEN).toBe(2);
        expect(lgs.validate_alias('x')).toBe("alias 'x' is shorter than 2 characters");
    });

    it('rejects an alias containing a non-Latin character', () => {
        const err = lgs.validate_alias('Аlex'); // Cyrillic А (homoglyph)
        expect(err).not.toBeNull();
        expect(err).toContain('non-Latin or homoglyph-prone');
    });
});

describe('lint_ghostwriter_source — is_latin_or_allowed', () => {
    it('accepts ASCII letters and digits', () => {
        expect(lgs.is_latin_or_allowed('A')).toBe(true);
        expect(lgs.is_latin_or_allowed('z')).toBe(true);
        expect(lgs.is_latin_or_allowed('7')).toBe(true);
    });
    it('rejects a Cyrillic homoglyph', () => {
        expect(lgs.is_latin_or_allowed('А')).toBe(false); // U+0410
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

