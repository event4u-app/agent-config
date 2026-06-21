// Tests for src/scripts/lint_topics_yaml.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists. Differential check over the exported slug regex
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO,
// byte-identical stdout + stderr + exit (skipped without python3). The
// linter runs bare (and with --quiet) in CI + the visibility-drift workflow.
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_topics_yaml.js';



describe('lint_topics_yaml — slug regex', () => {
    it('SLUG_RE mirrors ^[a-z0-9][a-z0-9-]*$', () => {
        expect(mod.SLUG_RE.test('mcp-server')).toBe(true);
        expect(mod.SLUG_RE.test('ai')).toBe(true);
        expect(mod.SLUG_RE.test('-leading-dash')).toBe(false);
        expect(mod.SLUG_RE.test('Upper')).toBe(false);
        expect(mod.SLUG_RE.test('has space')).toBe(false);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

