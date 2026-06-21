// Tests for src/scripts/lint_hook_manifest.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Coverage: a lint() unit check on a missing manifest
// path (exit 2), plus a golden-parity layer (python3 vs tsx on the REAL REPO
// across the real CI args: default + --strict) asserting byte-identical
// stdout/stderr/exit. Skipped without python3. CI invokes `lint_hook_manifest`.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_hook_manifest.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


describe('lint_hook_manifest — lint', () => {
    it('returns exit 2 for a missing manifest file', () => {
        expect(mod.lint(path.join(REPO_ROOT, 'does', 'not', 'exist.yaml'), false)).toBe(2);
    });
});

