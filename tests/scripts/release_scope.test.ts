/**
 * Release-aware content-lint scope + the counted-probe overflow contract.
 *
 * `road-to-release-shape-honesty` Phase 1. Two defects, both of which are
 * invisible in a green CI run and therefore need a witness:
 *
 *   1. A release PR's own diff is the version bump, so a check scoped to it
 *      examines nothing and reports "0 skills checked, INCONCLUSIVE" — and
 *      merges. The scope must widen to the previous release tag.
 *   2. A counting probe whose output overflows its buffer reports zero, and
 *      zero is indistinguishable from clean. A truncated read must be an
 *      error, never a count.
 *
 * The git-touching paths are exercised against real temporary repositories
 * rather than mocks: the thing under test is what `git diff` and `git tag`
 * actually return, and a mock would happily agree with a wrong assumption.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
    detectReleaseVersion,
    pickPreviousTag,
    resolveContentLintScope,
} from '../../src/scripts/_lib/release_scope.js';
import {
    DEFAULT_PROBE_MAX_BUFFER,
    ProbeOverflowError,
    interpretProbeResult,
    probeLines,
    runCountedProbe,
} from '../../src/scripts/_lib/counted_probe.js';

const _tmpdirs: string[] = [];

afterAll(() => {
    for (const d of _tmpdirs) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* best effort */
        }
    }
});

function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd, encoding: 'utf-8' });
}

/** A repo with one tagged release, then a release-shaped commit on top. */
function repoWithRelease(opts: { bump: boolean; priorTag: string | null }): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-scope-'));
    _tmpdirs.push(root);
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'config', 'user.email', 't@example.com');
    git(root, 'config', 'user.name', 'T');

    fs.writeFileSync(path.join(root, 'package.json'), '{\n  "version": "9.11.0"\n}\n');
    fs.writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n\n## [9.11.0](x) (2026-01-01)\n');
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'a.txt'), 'one\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-qm', 'base');
    if (opts.priorTag !== null) {
        git(root, 'tag', opts.priorTag);
        // A non-semver tag that sorts ABOVE every version under -v:refname.
        // The resolver must ignore it; a naive "newest tag" would pick it.
        git(root, 'tag', 'rebase-backup-pre-squash');
    }

    // The substantive work of the release — lands BEFORE the cut, which is the
    // whole reason a PR-scoped check cannot see it.
    fs.writeFileSync(path.join(root, 'src', 'a.txt'), 'one\ntwo\n');
    git(root, 'commit', '-aqm', 'feat: the actual work');

    git(root, 'checkout', '-qb', 'release/9.12.0');
    if (opts.bump) {
        fs.writeFileSync(path.join(root, 'package.json'), '{\n  "version": "9.12.0"\n}\n');
        fs.writeFileSync(
            path.join(root, 'CHANGELOG.md'),
            '# Changelog\n\n## [9.12.0](x) (2026-02-01)\n\n## [9.11.0](x) (2026-01-01)\n',
        );
    } else {
        fs.writeFileSync(path.join(root, 'src', 'a.txt'), 'one\ntwo\nthree\n');
    }
    git(root, 'commit', '-aqm', opts.bump ? 'release: 9.12.0' : 'feat: ordinary');
    return root;
}

describe('detectReleaseVersion — a release is proved, not named', () => {
    const bump = (v: string) =>
        `+## [${v}](x) (2026-02-01)\n+  "version": "${v}"\n`;

    it('accepts a changelog heading and a package bump that agree', () => {
        expect(detectReleaseVersion(bump('9.12.0'))).toBe('9.12.0');
    });

    it('rejects a disagreement — the two halves must name one version', () => {
        expect(
            detectReleaseVersion('+## [9.12.0](x)\n+  "version": "9.11.0"\n'),
        ).toBeNull();
    });

    it('rejects either half alone', () => {
        expect(detectReleaseVersion('+## [9.12.0](x)\n')).toBeNull();
        expect(detectReleaseVersion('+  "version": "9.12.0"\n')).toBeNull();
    });

    it('ignores the `+++` file header, which is not an added line', () => {
        expect(detectReleaseVersion('+++ b/## [9.12.0](x)\n')).toBeNull();
    });
});

describe('pickPreviousTag — non-semver tags are ignored, not sorted', () => {
    it('picks the highest version strictly below the target', () => {
        expect(pickPreviousTag('9.12.0', ['9.10.0', '9.11.0', '9.12.0', '10.0.0'])).toBe('9.11.0');
    });

    it('ignores backup refs that would sort above every version', () => {
        // The live repository carries these alongside 152 semver tags, and they
        // sort FIRST under `git tag --sort=-v:refname`.
        expect(
            pickPreviousTag('9.12.0', ['rebase-backup-pre-squash', 'py2ts-pre-reword', '9.11.0']),
        ).toBe('9.11.0');
    });

    it('compares numerically, not lexically', () => {
        expect(pickPreviousTag('9.12.0', ['9.9.0', '9.2.0'])).toBe('9.9.0');
    });

    it('returns null when nothing is below the target', () => {
        expect(pickPreviousTag('1.0.0', ['1.0.0', '2.0.0'])).toBeNull();
        expect(pickPreviousTag('not-a-version', ['1.0.0'])).toBeNull();
    });
});

describe('resolveContentLintScope — the widening, end to end on real git', () => {
    it('widens a release PR to the previous release tag', () => {
        const root = repoWithRelease({ bump: true, priorTag: '9.11.0' });
        const scope = resolveContentLintScope({ baseRef: 'main', cwd: root });
        expect(scope.isRelease).toBe(true);
        expect(scope.version).toBe('9.12.0');
        expect(scope.previousTag).toBe('9.11.0');
        expect(scope.base).toBe('9.11.0');
        expect(scope.reason).toContain('9.11.0...HEAD');
    });

    it('the widening is what makes the substantive commit visible', () => {
        // The measurement the roadmap is built on: the same repo, two scopes.
        const root = repoWithRelease({ bump: true, priorTag: '9.11.0' });
        const narrow = git(root, 'diff', '--name-only', 'main...HEAD').trim();
        const wide = git(root, 'diff', '--name-only', '9.11.0...HEAD').trim();
        expect(narrow.split('\n').filter(Boolean)).toEqual(['CHANGELOG.md', 'package.json']);
        expect(wide).toContain('src/a.txt');
    });

    it('leaves an ordinary PR on its base ref', () => {
        const root = repoWithRelease({ bump: false, priorTag: '9.11.0' });
        const scope = resolveContentLintScope({ baseRef: 'main', cwd: root });
        expect(scope.isRelease).toBe(false);
        expect(scope.base).toBe('main');
    });

    it('a branch merely NAMED release/… does not widen without a version bump', () => {
        // Branch-name inference would widen a spike branch to a whole tag span.
        const root = repoWithRelease({ bump: false, priorTag: '9.11.0' });
        expect(git(root, 'branch', '--show-current').trim()).toBe('release/9.12.0');
        expect(resolveContentLintScope({ baseRef: 'main', cwd: root }).isRelease).toBe(false);
    });

    it('an unresolvable previous tag degrades to the base ref and says so', () => {
        const root = repoWithRelease({ bump: true, priorTag: null });
        const scope = resolveContentLintScope({ baseRef: 'main', cwd: root });
        expect(scope.isRelease).toBe(true);
        expect(scope.previousTag).toBeNull();
        expect(scope.base).toBe('main');
        expect(scope.reason).toContain('no earlier semver tag');
    });

    it('an explicit override wins over detection', () => {
        const root = repoWithRelease({ bump: true, priorTag: '9.11.0' });
        const scope = resolveContentLintScope({ baseRef: 'main', cwd: root, since: 'HEAD~2' });
        expect(scope.base).toBe('HEAD~2');
        expect(scope.isRelease).toBe(false);
    });
});

describe('counted probe — a truncated read is an error, never a zero', () => {
    it('throws on ENOBUFS rather than reporting an empty listing', () => {
        expect(() =>
            interpretProbeResult(
                { error: Object.assign(new Error('spawnSync ENOBUFS'), { code: 'ENOBUFS' }), status: null, stdout: '' },
                'vitest list',
            ),
        ).toThrow(ProbeOverflowError);
    });

    it('the message says why zero was refused, not just that it failed', () => {
        try {
            interpretProbeResult(
                { error: Object.assign(new Error('x'), { code: 'ENOBUFS' }), status: null, stdout: '' },
                'vitest list',
            );
            expect.unreachable('should have thrown');
        } catch (e) {
            expect((e as Error).message).toContain('truncated');
            expect((e as Error).message).toContain('would be wrong');
        }
    });

    it('a missing binary is a reported failure, not an overflow', () => {
        // ENOENT is legitimately degradable — a dev box without npx. Only the
        // truncation case is unknowable, so only it throws.
        const r = interpretProbeResult(
            { error: Object.assign(new Error('x'), { code: 'ENOENT' }), status: null, stdout: '' },
            'npx vitest list',
        );
        expect(r.ok).toBe(false);
        expect(r.failure).toBe('ENOENT');
    });

    it('a non-zero exit is a reported failure with its status', () => {
        const r = interpretProbeResult({ status: 3, stdout: 'partial' }, 'cmd');
        expect(r.ok).toBe(false);
        expect(r.failure).toBe('exited 3');
    });

    it('probeLines yields nothing for a failed probe — a failure is not an empty list', () => {
        const failed = interpretProbeResult({ status: 1, stdout: 'a\nb\n' }, 'cmd');
        expect(probeLines(failed)).toEqual([]);
        const ok = interpretProbeResult({ status: 0, stdout: 'a\n\n  b  \n' }, 'cmd');
        expect(probeLines(ok)).toEqual(['a', 'b']);
    });

    it('really overflows against a real child, at a deliberately tiny ceiling', () => {
        expect(() =>
            runCountedProbe('node', ['-e', 'process.stdout.write("x".repeat(50000))'], {
                maxBuffer: 1024,
            }),
        ).toThrow(ProbeOverflowError);
    });

    it('the same command inside the real ceiling succeeds', () => {
        const r = runCountedProbe('node', ['-e', 'process.stdout.write("a\\nb\\n")']);
        expect(r.ok).toBe(true);
        expect(probeLines(r)).toEqual(['a', 'b']);
        expect(DEFAULT_PROBE_MAX_BUFFER).toBeGreaterThan(1024 * 1024);
    });
});
