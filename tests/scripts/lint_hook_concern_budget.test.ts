// Tests for src/scripts/lint_hook_concern_budget.ts (py2ts Phase 4 / Wave 4b).
//
// No tests/test_lint_hook_concern_budget.py exists. This is a focused
// differential suite over the exported `_read_settings_block` minimal-YAML
// walk + the default constants, plus a golden-parity layer running python3 vs
// tsx on the REAL REPO (the linter's real CI invocation), skipped without
// python3.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as hcb from '../../src/scripts/lint_hook_concern_budget.js';



describe('lint_hook_concern_budget — defaults', () => {
    it('mirrors the Python default constants', () => {
        expect(hcb.DEFAULT_MAX_PER_EVENT).toBe(8);
        expect(hcb.DEFAULT_TIER1).toEqual([]);
        expect(hcb.DEFAULT_HARD_FAIL).toBe(false);
    });
});

describe('lint_hook_concern_budget._read_settings_block', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hcb-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(body: string): string {
        const p = path.join(tmp, 'settings.yml');
        fs.writeFileSync(p, body);
        return p;
    }

    it('returns {} for a missing file', () => {
        expect(hcb._read_settings_block(path.join(tmp, 'nope.yml'))).toEqual({});
    });
    it('returns {} when there is no hooks block', () => {
        expect(hcb._read_settings_block(write('other:\n  x: 1\n'))).toEqual({});
    });
    it('reads max_per_event + hard_fail', () => {
        const p = write('hooks:\n  concern_budget:\n    max_per_event: 5\n    hard_fail: true\n');
        expect(hcb._read_settings_block(p)).toEqual({ max_per_event: 5, hard_fail: true });
    });
    it('reads an empty tier1_concerns list', () => {
        const p = write('hooks:\n  concern_budget:\n    tier1_concerns: []\n');
        expect(hcb._read_settings_block(p)).toEqual({ tier1_concerns: [] });
    });
    it('reads a block tier1_concerns list', () => {
        const p = write(
            'hooks:\n  concern_budget:\n    tier1_concerns:\n      - alpha\n      - beta\n',
        );
        expect(hcb._read_settings_block(p)).toEqual({ tier1_concerns: ['alpha', 'beta'] });
    });
    it('stops the hooks block at the next top-level key', () => {
        const p = write(
            'hooks:\n  concern_budget:\n    max_per_event: 3\nother:\n  concern_budget:\n    max_per_event: 99\n',
        );
        expect(hcb._read_settings_block(p)).toEqual({ max_per_event: 3 });
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

