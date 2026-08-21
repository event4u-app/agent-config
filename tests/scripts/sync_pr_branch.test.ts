/**
 * Keep the branch current with its PR base before a push.
 *
 * Anchored to PR #1391: the base moved three times during one run, the push was
 * rejected twice for it, and the PR reached `CONFLICTING` before anyone noticed.
 * `check_branch_freshness` detected each one and refused — what did not exist was
 * the half that does something about it.
 *
 * The conflict SPLIT is the load-bearing unit under test. A generated conflict
 * has exactly one correct resolution (regenerate) and an authored one has none a
 * script may choose, so collapsing them into "conflicts: 2" throws away the only
 * information that tells a reader what to do next.
 */

import { describe, expect, it } from 'vitest';

import { classifyConflicts, isGenerated, main, resolveBase } from '../../src/scripts/sync_pr_branch.js';

describe('generated vs authored', () => {
    it('recognises the generated artefacts a merge routinely conflicts on', () => {
        // Every one of these actually conflicted on this branch.
        expect(isGenerated('agents/roadmaps-progress.md')).toBe(true);
        expect(isGenerated('dist/agent-src/skills/x/SKILL.md')).toBe(true);
        expect(isGenerated('.augment/rules/x.md')).toBe(true);
        expect(isGenerated('agents/index.md')).toBe(true);
    });

    it('classifies the compiled hook manifest as generated, not authored', () => {
        // Regression for road-to-session-closeout 8.5. `hook_manifest.json` is
        // compiled from `hook_manifest.yaml`; mixing hunks yields a concern
        // table matching neither branch. The YAML source stays AUTHORED — that
        // is the file a human actually edits, and the asymmetry is the point.
        expect(isGenerated('src/scripts/hook_manifest.json')).toBe(true);
        expect(isGenerated('src/scripts/hook_manifest.yaml')).toBe(false);
    });

    it('does NOT claim an authored file is generated', () => {
        // gate-coverage.yml conflicted on this branch and is hand-authored — a
        // regenerate-resolution there would have discarded the other side.
        expect(isGenerated('src/config/gate-coverage.yml')).toBe(false);
        expect(isGenerated('src/scripts/lint_evidence_artifacts.ts')).toBe(false);
        expect(isGenerated('agents/roadmaps/road-to-x.md')).toBe(false);
        // A prefix that only LOOKS like the generated root must not match.
        expect(isGenerated('dist/agent-src-notes.md')).toBe(false);
        expect(isGenerated('agents/roadmaps-progress.md.bak')).toBe(false);
    });

    it('splits a mixed conflict set and drops blank lines', () => {
        const out = classifyConflicts([
            'agents/roadmaps-progress.md',
            '',
            'src/config/gate-coverage.yml',
            '  dist/agent-src/x.md  ',
        ]);
        expect(out.generated).toEqual(['agents/roadmaps-progress.md', 'dist/agent-src/x.md']);
        expect(out.authored).toEqual(['src/config/gate-coverage.yml']);
    });

    it('an empty list is empty on both sides, not a silent pass', () => {
        expect(classifyConflicts([])).toEqual({ generated: [], authored: [] });
        expect(classifyConflicts(['', '   '])).toEqual({ generated: [], authored: [] });
    });
});

describe('base resolution', () => {
    it('an explicit --base wins over any probe', () => {
        const r = resolveBase(process.cwd(), 'origin/release/9.9.9');
        expect(r.base).toBe('origin/release/9.9.9');
        expect(r.how).toMatch(/--base/);
    });

    it('a blank --base is not an override', () => {
        // Otherwise `--base ""` would pin the base to the empty string and every
        // rev-list against it would read as "already current".
        const r = resolveBase(process.cwd(), '   ');
        expect(r.base).not.toBe('   ');
    });

    it('names HOW the base was resolved, so a wrong base is visible', () => {
        const r = resolveBase(process.cwd(), null);
        expect(r.how.length).toBeGreaterThan(0);
    });
});

describe('CLI', () => {
    it('refuses a value-taking flag with no value', () => {
        expect(main(['--repo'])).toBe(1);
        expect(main(['--base'])).toBe(1);
        expect(main(['--base', '--dry-run'])).toBe(1);
    });

    it('rejects an unknown argument', () => {
        expect(main(['--nope'])).toBe(1);
    });

    it('--help exits 0', () => {
        expect(main(['--help'])).toBe(0);
    });
});
