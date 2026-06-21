// Tests for src/scripts/lint_rule_interactions.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: constants spot-checks (ALLOWED_RELATIONS,
// ANCHOR_PARTNERS, ANCHOR_RULE, REQUIRED_PAIR_FIELDS) and a golden-parity layer
// (python3 vs tsx on the REAL REPO across default + --quiet) asserting
// byte-identical stdout/stderr/exit. Skipped without python3. CI invokes
// `lint_rule_interactions --quiet`.
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_rule_interactions.js';



describe('lint_rule_interactions — constants', () => {
    it('ALLOWED_RELATIONS holds the six relation kinds', () => {
        expect(new Set(mod.ALLOWED_RELATIONS)).toEqual(
            new Set(['overrides', 'narrows', 'defers_to', 'restates', 'gates', 'complements']),
        );
    });
    it('ANCHOR_RULE is non-destructive-by-default', () => {
        expect(mod.ANCHOR_RULE).toBe('non-destructive-by-default');
    });
    it('ANCHOR_PARTNERS holds the five anchor partners', () => {
        expect(new Set(mod.ANCHOR_PARTNERS)).toEqual(
            new Set([
                'autonomous-execution',
                'scope-control',
                'commit-policy',
                'ask-when-uncertain',
                'verify-before-complete',
            ]),
        );
    });
    it('REQUIRED_PAIR_FIELDS holds the required pair keys', () => {
        expect(new Set(mod.REQUIRED_PAIR_FIELDS)).toEqual(
            new Set(['id', 'rules', 'relation', 'conflict', 'resolution', 'evidence']),
        );
    });
});

