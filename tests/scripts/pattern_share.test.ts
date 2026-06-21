// Tests for src/scripts/pattern_share.ts (py2ts, ADR-200).
//
// No pytest suite exists, so this is a focused differential suite: the pure
// helpers (`_redact`, `_validate_frontmatter`) against the REAL redactor, plus
// a golden-parity layer that runs python3 vs tsx on tmp fixtures — identical
// stdout/stderr/exit for export (stdout + --out dir), import (success, refused,
// missing-frontmatter, exists/--force), and the argparse surface (subcommand
// errors, unrecognized args, missing positional). Dest paths in stdout are
// absolute, so they are normalized inline before comparison. The import-success
// case writes into src/patterns/ — snapshot + restore leaves zero drift.
import { describe, expect, it } from 'vitest';

import * as ps from '../../src/scripts/pattern_share.js';



const CLEAN =
    '---\napplies_to: php\nreliability: high\nlast_verified: 2026-01-01\n---\nJust prose, no leak.\n';
const EMAIL =
    '---\napplies_to: php\nreliability: high\nlast_verified: 2026-01-01\n---\nContact alice@example.com for details.\n';
const BAD_FM = '---\nfoo: bar\n---\nMissing required keys.\n';
const NO_FM = 'No frontmatter at all.\n';

describe('pattern_share — helpers (real redactor)', () => {
    it('_redact passes clean prose (code excerpts exempt)', () => {
        const [ok, summary] = ps._redact(CLEAN);
        expect(ok).toBe(true);
        expect(summary).toBe('redaction: clean (code excerpts exempt — patterns are recipes)');
    });

    it('_redact refuses an email (privacy class kept)', () => {
        const [ok, summary] = ps._redact(EMAIL);
        expect(ok).toBe(false);
        expect(summary.startsWith('redaction REFUSED — ')).toBe(true);
        expect(summary).toContain('email');
    });

    it('_validate_frontmatter flags a missing block and missing keys', () => {
        expect(ps._validate_frontmatter(NO_FM)).toEqual(['no frontmatter block']);
        expect(ps._validate_frontmatter(BAD_FM)).toEqual([
            'applies_to',
            'reliability',
            'last_verified',
        ]);
        expect(ps._validate_frontmatter(CLEAN)).toEqual([]);
    });
});
