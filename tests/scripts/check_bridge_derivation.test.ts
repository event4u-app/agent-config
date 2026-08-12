/**
 * Must-fail / must-pass fixtures for `check_bridge_derivation`
 * (road-to-ecosystem-harvest-skill-quality-gates Phase 4, Source AA).
 *
 * Seeded drift — a bridge file edited after generation, a symlink escaping
 * the derivation sources, a broken symlink — must turn the check red; an
 * untouched derived tree must stay green.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    BRIDGE_ROOTS,
    diff_snapshots,
    partition_roots,
    snapshot_tree,
    validate_symlinks,
} from '../../src/scripts/check_bridge_derivation.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bridgederiv-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('snapshot_tree + diff_snapshots', () => {
    it('must-pass: an unchanged tree is a fixpoint (empty diff)', () => {
        const root = path.join(tmp, 'bridge');
        fs.mkdirSync(root, { recursive: true });
        fs.writeFileSync(path.join(root, 'a.md'), 'derived content\n');
        const a = snapshot_tree(root);
        const b = snapshot_tree(root);
        expect(diff_snapshots(a, b)).toEqual([]);
    });

    it('must-fail: a hand-edited bridge file shows as non-derived drift', () => {
        const root = path.join(tmp, 'bridge');
        fs.mkdirSync(root, { recursive: true });
        const f = path.join(root, 'a.md');
        fs.writeFileSync(f, 'derived content\n');
        const before = snapshot_tree(root);
        fs.writeFileSync(f, 'hand-edited content\n'); // seeded drift
        const errors = diff_snapshots(before, snapshot_tree(root));
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain('does not derive from src/');
    });

    it('must-fail: a stale extra file and a missing file both surface', () => {
        const root = path.join(tmp, 'bridge');
        fs.mkdirSync(root, { recursive: true });
        fs.writeFileSync(path.join(root, 'stale.md'), 'x\n');
        const before = snapshot_tree(root);
        fs.rmSync(path.join(root, 'stale.md'));
        fs.writeFileSync(path.join(root, 'fresh.md'), 'y\n');
        const errors = diff_snapshots(before, snapshot_tree(root));
        expect(errors.some((e) => e.includes('stale.md'))).toBe(true);
        expect(errors.some((e) => e.includes('fresh.md'))).toBe(true);
    });

    it('tracks symlink retargeting as drift', () => {
        const root = path.join(tmp, 'bridge');
        fs.mkdirSync(root, { recursive: true });
        const link = path.join(root, 'l.md');
        fs.symlinkSync('../dist/agent-src/rules/a.md', link);
        const before = snapshot_tree(root);
        fs.unlinkSync(link);
        fs.symlinkSync('../dist/agent-src/rules/b.md', link);
        expect(diff_snapshots(before, snapshot_tree(root)).length).toBe(1);
    });
});

describe('validate_symlinks', () => {
    function repoWith(linkTarget: string): { repo: string; root: string } {
        const repo = path.join(tmp, 'repo');
        fs.mkdirSync(path.join(repo, 'dist', 'agent-src', 'rules'), { recursive: true });
        fs.writeFileSync(path.join(repo, 'dist', 'agent-src', 'rules', 'a.md'), 'rule\n');
        const root = path.join(repo, '.claude', 'rules');
        fs.mkdirSync(root, { recursive: true });
        fs.symlinkSync(linkTarget, path.join(root, 'a.md'));
        return { repo, root };
    }

    it('must-pass: a symlink into dist/agent-src derives by construction', () => {
        const { repo, root } = repoWith('../../dist/agent-src/rules/a.md');
        expect(validate_symlinks(root, repo)).toEqual([]);
    });

    it('must-fail: a broken symlink is flagged', () => {
        const { repo, root } = repoWith('../../dist/agent-src/rules/missing.md');
        const errors = validate_symlinks(root, repo);
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain('broken symlink');
    });

    it('must-fail: a symlink escaping the repository is flagged', () => {
        const outside = path.join(tmp, 'outside.md');
        fs.writeFileSync(outside, 'outside\n');
        const { repo, root } = repoWith(outside);
        const errors = validate_symlinks(root, repo);
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain('escapes the repository');
    });

    it('must-fail: an in-repo symlink outside the derivation sources is flagged', () => {
        const { repo, root } = repoWith('../../README.md');
        fs.writeFileSync(path.join(repo, 'README.md'), 'readme\n');
        const errors = validate_symlinks(root, repo);
        expect(errors.length).toBe(1);
        expect(errors[0]).toContain('outside the derivation sources');
    });

    it('keeps its teeth on an active root: a broken symlink is still flagged', () => {
        // The scoping below must narrow WHICH roots are audited, never how
        // hard. `.claude/rules` is audited whenever claude-code is active, and
        // the seeded break has to survive that path.
        const { repo, root } = repoWith('../../dist/agent-src/rules/missing.md');
        expect(partition_roots(['.claude/rules'], new Set(['claude-code'])).audited).toEqual([
            '.claude/rules',
        ]);
        expect(validate_symlinks(root, repo)[0]).toContain('broken symlink');
    });
});

describe('partition_roots', () => {
    it('null (no tools file / malformed) audits every root', () => {
        const { audited, skipped } = partition_roots(BRIDGE_ROOTS, null);
        expect(audited).toEqual([...BRIDGE_ROOTS]);
        expect(skipped).toEqual([]);
    });

    it('all eight tools active audits every root — the CI configuration', () => {
        const all = new Set([
            'claude-code',
            'claude-desktop',
            'augment',
            'copilot',
            'cursor',
            'windsurf',
            'cline',
            'gemini',
        ]);
        expect(partition_roots(BRIDGE_ROOTS, all).skipped).toEqual([]);
    });

    it('a deactivated tool drops exactly its own roots', () => {
        // `tools: []` — the masked local configuration that broke the 9.36.0
        // release push: `.claude/skills/` had not been regenerated since the
        // rename that orphaned its symlinks, and no regeneration path existed.
        const { audited, skipped } = partition_roots(BRIDGE_ROOTS, new Set());
        expect(skipped).toContain('.claude/skills');
        expect(skipped).toContain('.claude/rules');
        expect(skipped).toContain('.clinerules');
        expect(skipped).toContain('GEMINI.md');
        expect(audited).not.toContain('.claude/skills');
    });

    it('deactivating one tool leaves the others audited', () => {
        const { audited, skipped } = partition_roots(
            ['.claude/skills', '.cursor/rules', '.clinerules'],
            new Set(['cursor', 'cline']),
        );
        expect(skipped).toEqual(['.claude/skills']);
        expect(audited).toEqual(['.cursor/rules', '.clinerules']);
    });

    it('.augment stays audited under every tool selection', () => {
        // `project_to_augment()` carries no tool gate, so `.augment` is
        // regenerated on every run. Mapping it to a tool id would silence the
        // audit on a maintained tree — a strict weakening, and the reason
        // absent-from-the-map means unconditional rather than skippable.
        expect(BRIDGE_ROOTS).toContain('.augment');
        for (const active of [new Set<string>(), new Set(['cursor']), new Set(['augment'])]) {
            expect(partition_roots(BRIDGE_ROOTS, active).audited).toContain('.augment');
        }
    });

    it('never audits a root it also skips, for any selection', () => {
        for (const active of [
            new Set<string>(),
            new Set(['claude-code']),
            new Set(['windsurf', 'gemini']),
        ]) {
            const { audited, skipped } = partition_roots(BRIDGE_ROOTS, active);
            expect(audited.length + skipped.length).toBe(BRIDGE_ROOTS.length);
            expect(audited.filter((r) => skipped.includes(r))).toEqual([]);
        }
    });
});
