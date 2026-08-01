/**
 * Release-aware diff scope for content checks.
 *
 * A release PR's own diff is version, changelog, pack metadata and marketplace
 * files: the substantive work arrived in the commits *before* the cut. Any
 * check scoped to "files changed in this PR" therefore measures the release
 * wrapper, not the release. The visible consequence was a 179-commit release
 * whose skill lint reported **"0 skills checked, INCONCLUSIVE"** and merged.
 *
 * The fix is a range, not a new gate: on a release PR the content checks
 * resolve their scope to `previous_release_tag...HEAD`. Everywhere else the
 * base is unchanged.
 *
 * The three release-detection primitives below were written for
 * `self_review_gate.ts`, which already switched its own analysis range this
 * way. They live here so the second consumer reuses the precedent instead of
 * re-deriving it — two copies of "is this a release PR?" is exactly the drift
 * this package has paid for before. `self_review_gate.ts` re-exports them, so
 * its public surface is unchanged.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * A release PR is detected from its own packaging diff (baseRef...HEAD,
 * scoped to CHANGELOG.md + package.json): an added changelog heading and an
 * added package.json version bump, agreeing on the same version. Pure over
 * the patch text — no git call — so it is unit-testable with synthetic
 * patches. See docs/design/release-pr-review-mode.md.
 */
export function detectReleaseVersion(patchText: string): string | null {
    const addedLines = patchText
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

    let changelogVersion: string | null = null;
    let packageVersion: string | null = null;
    for (const line of addedLines) {
        const changelogMatch = /^##\s*\[(\d+\.\d+\.\d+)\]/.exec(line);
        if (changelogMatch) changelogVersion = changelogMatch[1] ?? null;
        const packageMatch = /^\s*"version"\s*:\s*"(\d+\.\d+\.\d+)"/.exec(line);
        if (packageMatch) packageVersion = packageMatch[1] ?? null;
    }
    if (changelogVersion && packageVersion && changelogVersion === packageVersion) {
        return changelogVersion;
    }
    return null;
}

function releaseDetectionPatch(baseRef: string, cwd: string): string {
    const r = spawnSync('git', ['diff', `${baseRef}...HEAD`, '--', 'CHANGELOG.md', 'package.json'], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
    });
    return (r.stdout ?? '').toString();
}

/** Impure wrapper: collects the packaging patch via git, then detects. */
export function detectReleaseVersionFromGit(
    baseRef: string,
    cwd: string = REPO_ROOT,
): string | null {
    return detectReleaseVersion(releaseDetectionPatch(baseRef, cwd));
}

/** `major.minor.patch`, tolerating an optional `v` prefix; null if not semver-shaped. */
function parseSemver(raw: string): [number, number, number] | null {
    const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(raw.trim());
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function semverLessThan(a: [number, number, number], b: [number, number, number]): boolean {
    const [aMajor, aMinor, aPatch] = a;
    const [bMajor, bMinor, bPatch] = b;
    if (aMajor !== bMajor) return aMajor < bMajor;
    if (aMinor !== bMinor) return aMinor < bMinor;
    return aPatch < bPatch;
}

/**
 * Highest semver-shaped tag strictly below `version`, or null if none. Pure
 * over the supplied tag list — no git call. Non-semver tags (branch-backup
 * names etc.) are ignored rather than throwing.
 *
 * The filtering is load-bearing, not defensive: this repository carries 152
 * semver tags alongside names like `rebase-backup-pre-squash`, and those sort
 * *above* every version under `git tag --sort=-v:refname`. A naive "newest
 * tag" would resolve the scope to a backup ref.
 */
export function pickPreviousTag(version: string, tags: readonly string[]): string | null {
    const target = parseSemver(version);
    if (!target) return null;
    let best: { raw: string; parsed: [number, number, number] } | null = null;
    for (const raw of tags) {
        const parsed = parseSemver(raw);
        if (!parsed) continue;
        if (!semverLessThan(parsed, target)) continue;
        if (!best || semverLessThan(best.parsed, parsed)) best = { raw, parsed };
    }
    return best ? best.raw : null;
}

/** Local semver tags, newest first is not assumed — `pickPreviousTag` orders them. */
function localTags(cwd: string): string[] {
    const r = spawnSync('git', ['tag', '--list'], { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    if ((r.status ?? 1) !== 0) return [];
    return (r.stdout ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
}

export interface ContentLintScope {
    /** The ref a diff-scoped content check should compare HEAD against. */
    readonly base: string;
    /** True when the current head is a release PR whose scope was widened. */
    readonly isRelease: boolean;
    /** The release version, when detected. */
    readonly version: string | null;
    /** The tag the scope widened to, when resolved. */
    readonly previousTag: string | null;
    /** One line naming what was resolved and why — for the check's own output. */
    readonly reason: string;
}

export interface ResolveOptions {
    /** Branch a normal PR is compared against. */
    readonly baseRef?: string;
    readonly cwd?: string;
    /**
     * Explicit override, highest precedence. Set by a caller that already
     * knows the range (a workflow input, a `--since` flag).
     */
    readonly since?: string | null | undefined;
}

/**
 * Resolve the diff base a content check should use.
 *
 * Precedence: explicit `since` → `RELEASE_LINT_BASE` env → release-PR widening
 * → the ordinary base ref. The release branch is *not* inferred from the
 * branch name alone: the packaging-diff detector is what proves a release, so
 * a branch merely named `release/...` with no version bump stays on the
 * ordinary base rather than silently widening to a whole tag span.
 *
 * Never throws. A release whose previous tag cannot be resolved (the very
 * first release, or a shallow clone with no tags) falls back to the ordinary
 * base and says so in `reason` — a check that cannot widen its scope should
 * report a small scope honestly, not crash the release.
 */
export function resolveContentLintScope(opts: ResolveOptions = {}): ContentLintScope {
    const cwd = opts.cwd ?? REPO_ROOT;
    const baseRef = opts.baseRef ?? 'origin/main';

    const explicit = opts.since ?? process.env['RELEASE_LINT_BASE'] ?? null;
    if (explicit !== null && explicit.trim() !== '') {
        const base = explicit.trim();
        return {
            base,
            isRelease: false,
            version: null,
            previousTag: null,
            reason: `scope pinned to ${base} by an explicit override`,
        };
    }

    const version = detectReleaseVersionFromGit(baseRef, cwd);
    if (version === null) {
        return {
            base: baseRef,
            isRelease: false,
            version: null,
            previousTag: null,
            reason: `ordinary PR — scope is ${baseRef}...HEAD`,
        };
    }

    const previousTag = pickPreviousTag(version, localTags(cwd));
    if (previousTag === null) {
        return {
            base: baseRef,
            isRelease: true,
            version,
            previousTag: null,
            reason:
                `release ${version} detected, but no earlier semver tag is reachable — ` +
                `scope stays ${baseRef}...HEAD and therefore sees only the release wrapper`,
        };
    }

    return {
        base: previousTag,
        isRelease: true,
        version,
        previousTag,
        reason:
            `release ${version} detected — scope widened to ${previousTag}...HEAD ` +
            `so the check sees the release, not the version bump`,
    };
}
