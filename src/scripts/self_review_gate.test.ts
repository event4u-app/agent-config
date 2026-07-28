import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    LARGE_DIFF_LINES,
    buildPlan,
    classifyBlocking,
    detectReleaseVersion,
    escalationReasons,
    gateVerdict,
    isReviewablePath,
    pickPreviousTag,
    renderReview,
    type Finding,
} from './self_review_gate.js';

const f = (severity: Finding['severity'], kind: Finding['kind']): Finding => ({
    severity,
    kind,
    title: `${severity} ${kind}`,
    detail: 'x',
});

describe('classifyBlocking', () => {
    it('blocks security + high and claim + critical', () => {
        expect(classifyBlocking(f('high', 'security'))).toBe(true);
        expect(classifyBlocking(f('critical', 'claim'))).toBe(true);
    });
    it('does not block low/medium security, or any style/correctness', () => {
        expect(classifyBlocking(f('medium', 'security'))).toBe(false);
        expect(classifyBlocking(f('low', 'claim'))).toBe(false);
        expect(classifyBlocking(f('critical', 'style'))).toBe(false);
        expect(classifyBlocking(f('high', 'correctness'))).toBe(false);
    });
});

describe('gateVerdict', () => {
    const blocking = [f('high', 'security')];
    it('advisory (default shipped mode) never blocks, even with a blocking finding', () => {
        expect(gateVerdict(blocking, { enforce: false })).toBe(0);
    });
    it('enforce blocks only on a merge-blocking finding', () => {
        expect(gateVerdict(blocking, { enforce: true })).toBe(2);
        expect(gateVerdict([f('critical', 'style')], { enforce: true })).toBe(0);
        expect(gateVerdict([], { enforce: true })).toBe(0);
    });
});

describe('isReviewablePath', () => {
    it('skips generated projections + lockfiles, keeps source', () => {
        expect(isReviewablePath('dist/agent-src/skills/x/SKILL.md')).toBe(false);
        expect(isReviewablePath('.augment/rules/x.md')).toBe(false);
        expect(isReviewablePath('.windsurfrules')).toBe(false);
        expect(isReviewablePath('package-lock.json')).toBe(false);
        expect(isReviewablePath('src/rules/x.md')).toBe(true);
        expect(isReviewablePath('src/scripts/y.ts')).toBe(true);
    });
});

describe('renderReview', () => {
    it('carries the HUMAN REVIEW REQUIRED banner + the floor-not-human-review caveat', () => {
        const out = renderReview([], false);
        expect(out).toContain('HUMAN REVIEW REQUIRED');
        expect(out).toContain('not** independent human review');
    });
    it('advisory phrasing says WOULD block, enforce phrasing says blocking', () => {
        const blocking = [f('high', 'security')];
        expect(renderReview(blocking, false)).toContain('WOULD block');
        expect(renderReview(blocking, true)).toContain('merge-blocking');
    });
    it('labels each row (Blocking)/(Advisory) so a critical-but-non-blocking row never reads as inconsistent with the count', () => {
        const findings = [f('critical', 'correctness'), f('critical', 'security')];
        const out = renderReview(findings, false);
        // critical × correctness is NOT blocking → labelled Advisory
        expect(out).toContain('| critical (Advisory) | correctness |');
        // critical × security IS blocking → labelled Blocking
        expect(out).toContain('| critical (Blocking) | security |');
        // verdict count matches the number of (Blocking) rows (exactly 1)
        expect(out).toContain('1 finding(s) WOULD block');
        expect((out.match(/\(Blocking\)/g) ?? []).length).toBe(1);
    });
});

describe('escalationReasons', () => {
    it('flags a large diff at or above the threshold', () => {
        expect(escalationReasons(['src/a.ts'], LARGE_DIFF_LINES)).toEqual([
            `large diff (${LARGE_DIFF_LINES} changed lines ≥ ${LARGE_DIFF_LINES})`,
        ]);
    });
    it('does not flag a small non-claim diff', () => {
        expect(escalationReasons(['src/a.ts'], LARGE_DIFF_LINES - 1)).toEqual([]);
    });
    it('flags a claim-ledger surface regardless of size', () => {
        expect(escalationReasons(['docs/CLAIMS.md'], 1)).toEqual([
            'claim-affecting surface touched (docs/CLAIMS.md)',
        ]);
        expect(escalationReasons(['docs/proof.md'], 1)[0]).toContain('docs/proof.md');
        expect(escalationReasons(['docs/comparison.yaml'], 1)[0]).toContain('docs/comparison.yaml');
        expect(escalationReasons(['README.md'], 1)[0]).toContain('README.md');
    });
    it('reports both reasons when a large diff also touches a claim surface', () => {
        const r = escalationReasons(['docs/CLAIMS.md', 'src/big.ts'], LARGE_DIFF_LINES + 50);
        expect(r).toHaveLength(2);
        expect(r[0]).toContain('large diff');
        expect(r[1]).toContain('claim-affecting');
    });
});

describe('renderReview — escalation banner', () => {
    const f = (severity: Finding['severity'], kind: Finding['kind']): Finding => ({
        severity, kind, title: 't', detail: 'd',
    });
    it('appends the escalation recommendation when reasons are present', () => {
        const out = renderReview([], false, ['large diff (500 changed lines ≥ 400)']);
        expect(out).toContain('Escalation warranted');
        expect(out).toContain('/council:pr');
        expect(out).toContain('never');
    });
    it('omits the escalation block when there are no reasons (byte-identical to no-arg)', () => {
        const findings = [f('high', 'security')];
        expect(renderReview(findings, false, [])).toBe(renderReview(findings, false));
    });
    it('recommends escalation even on a clean (no-finding) large diff', () => {
        const out = renderReview([], false, ['large diff (500 changed lines ≥ 400)']);
        expect(out).toContain('no findings');
        expect(out).toContain('Escalation warranted');
    });
});

// ── Release-PR review mode (road-to-feedback-9.2.0-followups Phase 3) ──
// See docs/design/release-pr-review-mode.md — anchored to the PR #957
// false-advisory case (release features reading as "not in the diff").

describe('detectReleaseVersion', () => {
    const changelogAdd = (v: string) =>
        `+## [${v}](https://github.com/event4u-app/agent-config/compare/9.1.0...${v}) (2026-07-14)`;
    const packageAdd = (v: string) => `+    "version": "${v}",`;

    it('detects a release PR when the changelog heading and the package.json bump agree', () => {
        const patch = [
            'diff --git a/CHANGELOG.md b/CHANGELOG.md',
            '@@ -14,6 +14,8 @@',
            ' ## [Unreleased]',
            '+',
            changelogAdd('9.2.0'),
            'diff --git a/package.json b/package.json',
            '@@ -1,6 +1,6 @@',
            '-    "version": "9.1.0",',
            packageAdd('9.2.0'),
        ].join('\n');
        expect(detectReleaseVersion(patch)).toBe('9.2.0');
    });

    it('is NOT a release PR when only the changelog heading changed (no version bump)', () => {
        expect(detectReleaseVersion(changelogAdd('9.2.0'))).toBeNull();
    });

    it('is NOT a release PR when only package.json bumped (no changelog heading)', () => {
        expect(detectReleaseVersion(packageAdd('9.2.0'))).toBeNull();
    });

    it('is NOT a release PR on a normal feature-PR patch (neither signal present)', () => {
        const patch = ['+export function foo() {}', '-export function bar() {}'].join('\n');
        expect(detectReleaseVersion(patch)).toBeNull();
    });

    it('refuses to guess when the changelog and package.json versions disagree', () => {
        const patch = [changelogAdd('9.2.0'), packageAdd('9.3.0')].join('\n');
        expect(detectReleaseVersion(patch)).toBeNull();
    });

    it('ignores removed lines (the old version) and reads only the added one', () => {
        const patch = ['-    "version": "9.1.0",', packageAdd('9.2.0'), changelogAdd('9.2.0')].join('\n');
        expect(detectReleaseVersion(patch)).toBe('9.2.0');
    });
});

describe('pickPreviousTag', () => {
    it('picks the highest tag strictly below the release version', () => {
        expect(pickPreviousTag('9.2.0', ['9.0.0', '9.1.0', '9.2.0'])).toBe('9.1.0');
    });
    it('handles a v-prefixed tag naming convention', () => {
        expect(pickPreviousTag('9.2.0', ['v9.0.0', 'v9.1.0'])).toBe('v9.1.0');
    });
    it('returns null when no tag is strictly below the version', () => {
        expect(pickPreviousTag('9.2.0', ['9.2.0', '9.3.0'])).toBeNull();
        expect(pickPreviousTag('9.2.0', [])).toBeNull();
    });
    it('ignores non-semver tags (branch-backup names etc.) instead of crashing', () => {
        expect(
            pickPreviousTag('9.2.0', [
                'backup/pre-rebase-augment-limit-fit',
                '9.1.0',
                'local-squashed-tip-2026-05-18',
            ]),
        ).toBe('9.1.0');
    });
});

describe('buildPlan — release-PR shape (PR #957 reproduction)', () => {
    function git(root: string, ...args: string[]) {
        return spawnSync('git', args, {
            cwd: root,
            encoding: 'utf8',
            env: {
                ...process.env,
                GIT_AUTHOR_NAME: 'T',
                GIT_AUTHOR_EMAIL: 't@e.test',
                GIT_COMMITTER_NAME: 'T',
                GIT_COMMITTER_EMAIL: 't@e.test',
            },
        });
    }
    function write(root: string, rel: string, content: string): void {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, 'utf-8');
    }
    function mkTmp(): string {
        return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'srg-')));
    }

    let root: string | undefined;
    afterEach(() => {
        if (root) fs.rmSync(root, { recursive: true, force: true });
        root = undefined;
    });

    it('release mode sees the pre-cut feature file; the packaging diff alone does not (PR #957 shape)', () => {
        root = mkTmp();
        git(root, 'init', '-q', '-b', 'main');
        write(root, 'package.json', '{\n  "name": "x",\n  "version": "9.0.0"\n}\n');
        write(root, 'CHANGELOG.md', '# Changelog\n\n## [Unreleased]\n');
        git(root, 'add', '-A');
        git(root, 'commit', '-q', '-m', 'baseline');
        git(root, 'tag', '9.1.0'); // the previous release tag

        // The feature merges into main BEFORE the release cut — the PR #957 shape.
        write(root, 'feature.txt', 'new cross-source-consistency rule content\n');
        git(root, 'add', '-A');
        git(root, 'commit', '-q', '-m', 'feat: cross-source-consistency');

        // Release branch cut from main's current tip — no divergence yet, so
        // main...release-branch only shows the release-cut commit below.
        git(root, 'checkout', '-q', '-b', 'release-branch');
        write(
            root,
            'CHANGELOG.md',
            '# Changelog\n\n## [Unreleased]\n\n' +
                '## [9.2.0](https://github.com/event4u-app/agent-config/compare/9.1.0...9.2.0) (2026-07-14)\n',
        );
        write(root, 'package.json', '{\n  "name": "x",\n  "version": "9.2.0"\n}\n');
        git(root, 'add', '-A');
        git(root, 'commit', '-q', '-m', 'chore(release): 9.2.0');

        const plan = buildPlan('main', root);

        expect(plan.release?.version).toBe('9.2.0');
        expect(plan.release?.previousTag).toBe('9.1.0');
        // The packaging diff (main...HEAD) alone does NOT show the pre-cut
        // feature — the exact false-advisory shape PR #957 hit.
        expect(plan.release?.packagingFiles).not.toContain('feature.txt');
        expect(plan.release?.packagingFiles).toEqual(
            expect.arrayContaining(['CHANGELOG.md', 'package.json']),
        );
        // Release mode's actual analysis range (previousTag...HEAD) DOES
        // include it — this is what stops "feature not in diff" recurring.
        expect(plan.files).toContain('feature.txt');
        expect(plan.analysisBase).toBe('9.1.0');
    });

    it('a normal feature PR (no changelog/version bump) uses the unchanged base', () => {
        root = mkTmp();
        git(root, 'init', '-q', '-b', 'main');
        write(root, 'package.json', '{\n  "name": "x",\n  "version": "9.1.0"\n}\n');
        write(root, 'CHANGELOG.md', '# Changelog\n\n## [Unreleased]\n');
        git(root, 'add', '-A');
        git(root, 'commit', '-q', '-m', 'baseline');
        git(root, 'tag', '9.1.0');

        git(root, 'checkout', '-q', '-b', 'feature-branch');
        write(root, 'feature.txt', 'some feature\n');
        git(root, 'add', '-A');
        git(root, 'commit', '-q', '-m', 'feat: add feature');

        const plan = buildPlan('main', root);

        expect(plan.release).toBeUndefined();
        expect(plan.analysisBase).toBe('main');
        expect(plan.files).toContain('feature.txt');
    });
});
