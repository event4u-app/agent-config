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
    /**
     * Directories this suite had to CREATE, innermost first.
     *
     * Removing only the files left an empty retired-container directory in the
     * repo root, and that is not cosmetic: `sweep_dead_scan_roots`
     * classifies a scan root as dead BY ABSENCE, so an empty directory un-kills
     * the `check_reply_consistency.ts` dead-root finding, its
     * ledger disposition goes stale, and the gate exits 3. It read as a local
     * quirk for months because the two suites landed in different vitest
     * shards; vitest shards by file COUNT, so adding ONE unrelated test file
     * re-partitions every shard and can co-locate them — at which point the
     * false red reaches CI. A test that writes into the tracked tree owns the
     * whole artifact, directories included.
     */
    const createdDirs: string[] = [];
    function writeCmd(rel: string, body: string): void {
        const abs = path.join(REPO_ROOT, rel);
        const dir = path.dirname(abs);
        // Collected DEEPEST first, which is the order they can be removed in:
        // an outer directory is not empty until its child is gone.
        for (let d = dir; !fs.existsSync(d) && d.startsWith(REPO_ROOT) && d !== REPO_ROOT; d = path.dirname(d)) {
            createdDirs.push(d);
        }
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(abs, body, 'utf-8');
        written.push(abs);
    }
    afterEach(() => {
        for (const abs of written.splice(0)) {
            if (fs.existsSync(abs)) {
                fs.rmSync(abs, { force: true });
            }
        }
        // Innermost first, and only while still empty — never remove a
        // directory that already held something.
        for (const dir of createdDirs.splice(0)) {
            try {
                if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
                    fs.rmdirSync(dir);
                }
            } catch {
                // Best effort: a cleanup failure must not mask a real assertion.
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

    it('gates a visible command declared via `visibility` alone (no tier alias)', () => {
        const rel = '.agent-src.uncondensed/commands/_py2ts_test_vis_only.md';
        writeCmd(rel, '---\nname: zztop\nvisibility: visible\n---\n# zztop\n');
        const v = cv.check(rel, 'A', 'main', APPROVED, BANNED, GRANDFATHERED);
        expect(v).toHaveLength(1);
        expect(v[0]!.rule).toBe('approved-verb');
    });

    it('ignores an internal command declared via `visibility` alone', () => {
        const rel = '.agent-src.uncondensed/commands/_py2ts_test_vis_internal.md';
        writeCmd(rel, '---\nname: zztop\nvisibility: internal\n---\n# zztop\n');
        expect(cv.check(rel, 'A', 'main', APPROVED, BANNED, GRANDFATHERED)).toEqual([]);
    });

    it('prefers `visibility` over the deprecated `tier` alias when both are present', () => {
        const rel = '.agent-src.uncondensed/commands/_py2ts_test_vis_wins.md';
        writeCmd(rel, '---\nname: zztop\ntier: 0\nvisibility: internal\n---\n# zztop\n');
        expect(cv.check(rel, 'A', 'main', APPROVED, BANNED, GRANDFATHERED)).toEqual([]);
    });

    it('reports a command carrying NEITHER visibility nor tier instead of silently skipping it', () => {
        // Regression lock (2026-07-28 audit, road-to-tier-removal Phase 2): an
        // absent `tier` used to default to 2 and skip the file, so dropping the
        // frontmatter key would have silently un-gated every command.
        const rel = '.agent-src.uncondensed/commands/_py2ts_test_no_keys.md';
        writeCmd(rel, '---\nname: zztop\n---\n# zztop\n');
        const v = cv.check(rel, 'A', 'main', APPROVED, BANNED, GRANDFATHERED);
        expect(v).toHaveLength(1);
        expect(v[0]!.rule).toBe('visibility');
        expect(v[0]!.reason).toContain('missing `visibility`');
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

