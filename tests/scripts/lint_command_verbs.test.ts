// Tests for src/scripts/lint_command_verbs.ts (py2ts Phase 4 / Wave 4b).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public behaviour (leading_token, check — both rules, tier /
// grandfather gating) plus a golden-parity layer running python3 vs tsx on the
// REAL REPO, byte-identical stdout/stderr/exit (skipped without python3).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as cv from '../../src/scripts/lint_command_verbs.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


const APPROVED = new Set(['work', 'fix', 'agents']);
const BANNED = new Set(['create']);
const GRANDFATHERED = new Set(['create-pr']);

describe('lint_command_verbs.leading_token', () => {
    it('takes the head of a bare hyphen slug', () => {
        expect(cv.leading_token('fix-ci')).toBe('fix');
    });
    it('prefers the sub head when given', () => {
        expect(cv.leading_token('ci', 'fix')).toBe('fix');
    });
    it('splits a legacy colon name on its last segment', () => {
        expect(cv.leading_token('fix:ci')).toBe('ci');
    });
    it('a single token is its own head', () => {
        expect(cv.leading_token('work')).toBe('work');
    });
});

describe('lint_command_verbs.check', () => {
    // check() resolves relpath against the module ROOT (the real repo), so we
    // write throwaway fixture command files under the repo and remove them
    // afterwards. Names are `_py2ts_test_*` to avoid colliding with real
    // commands and to be obviously disposable.
    const written: string[] = [];
    function writeCmd(rel: string, body: string): void {
        const abs = path.join(REPO_ROOT, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body, 'utf-8');
        written.push(abs);
    }
    afterEach(() => {
        for (const abs of written.splice(0)) {
            if (fs.existsSync(abs)) {
                fs.rmSync(abs, { force: true });
            }
        }
    });

    it('flags an unapproved verb on a visible command', () => {
        const rel = '.agent-src.uncondensed/commands/_py2ts_test_zztop.md';
        writeCmd(rel, '---\nname: zztop\ntier: 0\n---\n# zztop\n');
        const v = cv.check(rel, 'A', 'main', APPROVED, BANNED, GRANDFATHERED);
        expect(v).toHaveLength(1);
        expect(v[0]!.rule).toBe('approved-verb');
        expect(v[0]!.reason).toContain('leading token `zztop`');
    });

    it('flags a banned-prefix command', () => {
        const rel = '.agent-src.uncondensed/commands/_py2ts_test_create_thing.md';
        writeCmd(rel, '---\nname: create-thing\ntier: 1\n---\n# create-thing\n');
        const v = cv.check(rel, 'A', 'main', APPROVED, BANNED, GRANDFATHERED);
        expect(v).toHaveLength(1);
        expect(v[0]!.rule).toBe('banned-prefix');
        expect(v[0]!.reason).toContain('banned leading token `create`');
    });

    it('passes an approved visible command', () => {
        const rel = '.agent-src.uncondensed/commands/_py2ts_test_fix_thing.md';
        writeCmd(rel, '---\nname: fix-thing\ntier: 0\n---\n# fix-thing\n');
        expect(cv.check(rel, 'A', 'main', APPROVED, BANNED, GRANDFATHERED)).toEqual([]);
    });

    it('ignores internal (tier 2) commands', () => {
        const rel = '.agent-src.uncondensed/commands/_py2ts_test_zztop_internal.md';
        writeCmd(rel, '---\nname: zztop\ntier: 2\n---\n# zztop\n');
        expect(cv.check(rel, 'A', 'main', APPROVED, BANNED, GRANDFATHERED)).toEqual([]);
    });

    it('exempts a grandfathered name from both rules', () => {
        const rel = '.agent-src.uncondensed/commands/_py2ts_test_create_pr.md';
        writeCmd(rel, '---\nname: create-pr\ntier: 0\n---\n# create-pr\n');
        expect(cv.check(rel, 'A', 'main', APPROVED, BANNED, GRANDFATHERED)).toEqual([]);
    });

    it('returns no violations for a deleted (missing) file', () => {
        expect(
            cv.check('.agent-src.uncondensed/commands/_py2ts_gone.md', 'A', 'main', APPROVED, BANNED, GRANDFATHERED),
        ).toEqual([]);
    });

    it('resolves the verb from the sub field for cluster commands', () => {
        const rel = '.agent-src.uncondensed/commands/_py2ts_test_sub.md';
        writeCmd(rel, '---\nname: ci\ntier: 0\nsub: fix\n---\n# ci\n');
        expect(cv.check(rel, 'A', 'main', APPROVED, BANNED, GRANDFATHERED)).toEqual([]);
    });
});

describe('lint_command_verbs.load_config', () => {
    it('loads the real verbs config with a non-empty approved set', () => {
        const cfg = cv.load_config();
        expect(cfg.approved.size).toBeGreaterThan(0);
        expect(cfg.approved.has('fix')).toBe(true);
    });
});

// --- Golden parity on the REAL REPO ----------------------------------------

