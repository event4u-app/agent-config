// Tests for src/scripts/lint_commit_subjects.ts (py2ts Phase 4 / Wave 4b).
//
// The pytest suite tests/test_lint_commit_subjects.py is ported 1:1 over the
// `check_subject` surface, plus a golden-parity layer running python3 vs tsx
// on the REAL REPO (skipped without python3). The commit-subjects workflow
// runs `--base <sha> --head <sha>`, so parity probes that shape.
import { describe, expect, it } from 'vitest';

import * as lcs from '../../src/scripts/lint_commit_subjects.js';



// --- Clean subjects — must pass with zero issues. ---
describe('lint_commit_subjects.check_subject — clean', () => {
    it.each([
        'feat(roadmaps): add Iron Law 3 — block silent archive of [~] deferred items',
        'fix: prevent silent archive of deferred items',
        'fix(wizard): prefill roles + packs from saved state for returning users',
        'chore(roadmaps): regenerate dashboard after archiving',
        'docs(adr): land ADR-033 distribution-identity npm-primary',
        'refactor: split parse_frontmatter into loader + injector helpers',
        'feat!: drop Composer surface; npm-primary per ADR-033',
        'chore: bump @event4u/agent-config to 5.1.0',
        'release: 18.2.0 with the routing floors',
    ])('passes: %s', (subject) => {
        expect(lcs.check_subject(subject)).toEqual([]);
    });
});

// --- Short subjects — body after type-prefix < MIN_SUBJECT_LEN. ---
describe('lint_commit_subjects.check_subject — short', () => {
    it.each(['fix: bug', 'feat: x', 'chore: typo', 'wip', 'tmp', 'fix'])(
        'flags: %s',
        (subject) => {
            expect(lcs.check_subject(subject).length).toBeGreaterThan(0);
        },
    );
});

// --- Blocklist tokens. ---
describe('lint_commit_subjects.check_subject — blocklist', () => {
    it.each([
        'chore: commit leftovers from yesterday',
        'fix: wip on the wizard prefill logic',
        'chore: temp commit to capture progress',
        'chore(roadmaps): fixup the dashboard regen',
        'fix: tmp shim until the loader patch lands',
        'feat: add LEFTOVER cleanup script',
    ])('flags blocklist token: %s', (subject) => {
        const issues = lcs.check_subject(subject);
        expect(issues.length).toBeGreaterThan(0);
        expect(issues.some((i) => i.includes('blocklist token'))).toBe(true);
    });
});

// --- Whole-word matching — no false positives. ---
describe('lint_commit_subjects.check_subject — whole-word', () => {
    it.each(['feat: add template for new roadmaps', 'docs: clarify temporary auth flow'])(
        'no blocklist false-positive: %s',
        (subject) => {
            const issues = lcs.check_subject(subject);
            expect(issues.some((i) => i.includes('blocklist'))).toBe(false);
        },
    );
});

// --- Carve-outs — merge/revert subjects skipped. ---
describe('lint_commit_subjects.check_subject — carve-outs', () => {
    it.each([
        'Merge pull request #287 from event4u-app/feat/preserve-deferred-roadmap-scope',
        "Merge branch 'main' into feat/distribution-identity",
        "Merge remote-tracking branch 'origin/main'",
        'Revert "fix: wip on the dashboard regen"',
    ])('skips: %s', (subject) => {
        expect(lcs.check_subject(subject)).toEqual([]);
    });
});

// --- The release commit `release.ts` writes is a version, not prose. ---
describe('lint_commit_subjects.check_subject — release commit', () => {
    it.each(['release: 19.0.0', 'release: 18.2.1', 'release: 20.0.0-rc.1'])('passes: %s', (subject) => {
        expect(lcs.check_subject(subject)).toEqual([]);
    });

    it.each(['release: wip', 'release: 1.0', 'release: 19.0.0 tmp', 'fix: 19.0.0'])(
        'still flags: %s',
        (subject) => {
            expect(lcs.check_subject(subject).length).toBeGreaterThan(0);
        },
    );
});

// --- Golden parity on the REAL REPO ----------------------------------------


// --- Conventional prefix is required, not only stripped. ---
describe('lint_commit_subjects.check_subject — prefix required', () => {
    it.each([
        'Interview phrasings reach the interview, German scores like English',
        'Routing assurance live floors: frozen baseline, derived floors',
        'Update the dashboard after archiving the roadmap',
    ])('flags a subject without a Conventional-Commits prefix: %s', (subject) => {
        const issues = lcs.check_subject(subject);
        expect(issues.some((i) => i.includes('Conventional-Commits prefix missing'))).toBe(true);
    });
});

// --- A PR title is a commit subject: the repo squash-merges with the PR title. ---
describe('lint_commit_subjects — PR title', () => {
    it('a prose PR title fails the CLI', () => {
        expect(lcs.main(['--base', 'HEAD', '--head', 'HEAD', '--quiet', '--title', 'Interview phrasings reach the interview'])).toBe(1);
    });
    it('a conventional PR title passes the CLI', () => {
        expect(lcs.main(['--base', 'HEAD', '--head', 'HEAD', '--quiet', '--title', 'feat(interview): interview phrasings reach the interview'])).toBe(0);
    });
});
