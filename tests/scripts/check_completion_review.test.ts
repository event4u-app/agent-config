// Tests for src/scripts/check_completion_review.ts — the deterministic Gate-R2
// validator (docs/contracts/plan-review-gates.md §2 + §6).
//
// Every scenario builds a throwaway `git init` repo under mkdtemp — no real
// repo file is ever touched. The gate is driven in-process via runInProc
// (`main` takes --repo / --artifact-dir, so no cwd change is needed) with
// `--format json` so each fixture can assert on its specific violation kind.
//
// Committed-artifact fixtures follow the real §2.5 workflow AND commit the
// finalized artifact — which is the point of the review-SCOPE binding: the
// scope excludes `agents/evidence/reviews`, so committing the findings file
// (which §2.5 requires and CI can only see committed) cannot invalidate the
// review it records. A head-sha binding made that unsatisfiable; there is no
// "working-tree update on top" escape here.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runInProc } from '../_lib/run_in_process.js';
import {
    extractFixRef,
    isCodePath,
    isOwnArtifactSlug,
    main,
    parseArtifact,
    parseHonestNull,
    parseMarkerLine,
    parseSkipDeclaration,
    validateFindingRows,
    type Violation,
} from '../../src/scripts/check_completion_review.js';
import { computeReviewScope, deriveManifest } from '../../src/scripts/dispatch_r2_reviewer.js';

const ART = 'agents/evidence/reviews/feat.findings.md';

function hasGit(): boolean {
    return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
}

function git(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    }
    return r.stdout;
}

function write(dir: string, rel: string, body: string): void {
    const fp = path.join(dir, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, body, 'utf-8');
}

function commitAll(dir: string, msg: string): string {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', msg);
    return headSha(dir);
}

function headSha(dir: string): string {
    return git(dir, 'rev-parse', 'HEAD').trim();
}

/** The review-scope hash the gate will derive — computed via the shared helper. */
function scopeHash(dir: string, base = 'main'): string {
    return computeReviewScope((a) => git(dir, ...a), base).hash;
}

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

/** Throwaway repo: one base commit on `main`, then checked out to `feat`. */
function makeRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccr-'));
    tmpDirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'gate@test.local');
    git(dir, 'config', 'user.name', 'gate');
    git(dir, 'config', 'commit.gpgsign', 'false');
    write(dir, 'README.md', '# base\n');
    commitAll(dir, 'base');
    git(dir, 'checkout', '-qb', 'feat');
    return dir;
}

/**
 * The ADR-051 failure shape: the reviews root IS tracked in the base ref, but
 * a later rename left the gate pointing at a path that no longer resolves.
 */
function movedRootRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccr-moved-'));
    tmpDirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'gate@test.local');
    git(dir, 'config', 'user.name', 'gate');
    git(dir, 'config', 'commit.gpgsign', 'false');
    write(dir, 'README.md', '# base\n');
    write(dir, ART, 'placeholder\n');
    commitAll(dir, 'base with a tracked reviews root');
    git(dir, 'checkout', '-qb', 'feat');
    git(dir, 'mv', 'agents/evidence/reviews', 'agents/evidence/renamed-reviews');
    write(dir, 'src/feature.ts', 'export const y = 2;\n');
    commitAll(dir, 'rename the reviews root and change code');
    return dir;
}

const SCOPE_A = 'a'.repeat(64);

const marker = (scope: string, headish = '0'.repeat(40)): string =>
    `<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: ${scope} | diff: ${headish} | reviewer: fresh-subagent-r2 -->`;

/** A §5 manifest bound to `scope` — required on every review-bearing artifact. */
const manifestFor = (scope: string): string =>
    deriveManifest({
        diffSha: '0'.repeat(40),
        scopeHash: scope,
        roadmap: 'none',
        roadmapHash: 'none',
        acHash: 'none',
        dispatched: '2026-08-04T09:30:00Z',
    });

const TABLE_HEAD = [
    '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
    '|---|----------|-----------|---------|--------|------------|',
];

function findingsArtifact(scope: string, rows: readonly string[]): string {
    return ['# Findings: feat', marker(scope), '', manifestFor(scope), '', ...TABLE_HEAD, ...rows, ''].join('\n');
}

function honestNullArtifact(scope: string): string {
    return [
        '# Findings: feat',
        marker(scope),
        '',
        manifestFor(scope),
        '',
        `**Honest-null:** 0 findings, scope ${scope}, reviewed 2026-08-04`,
        '',
    ].join('\n');
}

const skipLine = (reason: string, scope: string): string =>
    `**Skipped:** no code surface for this completion — ${reason}, scope ${scope}, declared 2026-08-04\n`;

interface GateResult {
    status: number;
    stdout: string;
    stderr: string;
    violations: Violation[];
    kinds: string[];
}

function runGate(dir: string, extra: string[] = []): GateResult {
    const res = runInProc(main, ['--repo', dir, '--base', 'main', '--format', 'json', ...extra]);
    let violations: Violation[] = [];
    const nl = res.stdout.indexOf('\n');
    const rest = nl >= 0 ? res.stdout.slice(nl + 1).trim() : '';
    if (rest.startsWith('[')) {
        violations = JSON.parse(rest) as Violation[];
    }
    return { status: res.status, stdout: res.stdout, stderr: res.stderr, violations, kinds: violations.map((v) => v.kind) };
}

// ---------------------------------------------------------------------------
// Pass fixtures
// ---------------------------------------------------------------------------

describe.runIf(hasGit())('check_completion_review — pass states', () => {
    it('passes with the finalized artifact COMMITTED (the head-sha binding could not)', () => {
        const dir = makeRepo();
        // §2.5 order: artifact committed FIRST, fix commit after.
        write(dir, ART, findingsArtifact(SCOPE_A, ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        commitAll(dir, 'add findings artifact');
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix the bug');
        // Finalize AND COMMIT: HEAD now moves past every sha the reviewer could
        // have recorded, and the gate must still pass.
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            findingsArtifact(scope, [
                `| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`,
                '| 2 | medium | src/fix.ts:2 | risky pattern | accepted-risk | perf acceptable, accepted by maintainer |',
                '| 3 | low | src/fix.ts:3 | nit | deferred | roadmap: agents/roadmaps/followup.md |',
            ]),
        );
        const finalSha = commitAll(dir, 'finalize findings artifact');
        expect(finalSha).not.toBe(fixSha);

        const res = runGate(dir);
        expect(res.stderr).toBe('');
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
        expect(res.stdout).toMatch(/^scanned: 2\n/);
    });

    it('scope survives a further commit that only touches the reviews directory', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(dir, ART, honestNullArtifact(scope));
        commitAll(dir, 'add review');
        // A second edit to the artifact (e.g. a typo fix) must not re-open the gate.
        write(dir, ART, honestNullArtifact(scope) + '\n<!-- touched -->\n');
        commitAll(dir, 'touch review');
        expect(scopeHash(dir)).toBe(scope);
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    it('passes on a merge-commit checkout (the pull_request CI shape)', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(dir, ART, honestNullArtifact(scope));
        commitAll(dir, 'add review');
        const featScope = scopeHash(dir);

        // CI checks out a synthetic merge commit, never the branch head.
        git(dir, 'checkout', '-q', 'main');
        git(dir, 'checkout', '-qb', 'ci-merge-feat');
        git(dir, 'merge', '-q', '--no-ff', '-m', 'Merge feat', 'feat');
        expect(headSha(dir)).not.toBe(git(dir, 'rev-parse', 'feat').trim());

        expect(scopeHash(dir)).toBe(featScope);
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    it('passes on an honest-null artifact for the current scope', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, honestNullArtifact(scopeHash(dir)));
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    it('passes on a valid skip declaration for a docs-only diff', () => {
        const dir = makeRepo();
        write(dir, 'docs/notes.md', '# notes\n');
        commitAll(dir, 'docs only');
        write(dir, ART, skipLine('docs-only change', scopeHash(dir)));
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    it('passes with a note when there are no reviewable changes vs base', () => {
        const dir = makeRepo(); // feat == main tip, empty scope
        const res = runInProc(main, ['--repo', dir, '--base', 'main']);
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('nothing to review');
    });
});

// ---------------------------------------------------------------------------
// Violation fixtures — each asserts its specific kind
// ---------------------------------------------------------------------------

describe.runIf(hasGit())('check_completion_review — violations', () => {
    it('missing-artifact: code diff with no artifact and no skip', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const res = runGate(dir);
        expect(res.kinds).toEqual(['missing-artifact']);
        expect(res.status).toBe(1);
    });

    it('stale-review: artifact exists only for an older scope, mismatch reported', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(SCOPE_A, ['| 1 | low | src/feature.ts:1 | nit | accepted-risk | fine, accepted |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['stale-review']);
        expect(res.violations[0]?.detail).toContain(SCOPE_A);
        expect(res.violations[0]?.detail).toContain(scopeHash(dir));
        expect(res.status).toBe(1);
    });

    it('stale-review: a scope-none skip does NOT satisfy a non-empty scope', () => {
        const dir = makeRepo();
        write(dir, 'docs/notes.md', '# notes\n');
        commitAll(dir, 'docs only');
        // The forever-valid leftover: `scope none` used to satisfy every later diff.
        write(dir, ART, skipLine('plan-only session', 'none'));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['stale-review']);
        expect(res.violations[0]?.detail).toContain('none');
        expect(res.status).toBe(1);
    });

    it('missing-manifest: a review-bearing artifact without the §5 manifest blocks', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            ['# Findings: feat', marker(scope), '', ...TABLE_HEAD, '| 1 | low | src/feature.ts:1 | nit | accepted-risk | fine |', ''].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['missing-manifest']);
        expect(res.status).toBe(1);
    });

    it('bad-value: a skip line may not hide a findings table (contradictory artifact)', () => {
        const dir = makeRepo();
        write(dir, 'docs/notes.md', '# notes\n');
        commitAll(dir, 'docs only');
        const scope = scopeHash(dir);
        write(
            dir,
            ART,
            findingsArtifact(scope, ['| 1 | high | src/x.ts:1 | bug | open | |']) + skipLine('docs only', scope),
        );
        const res = runGate(dir);
        // The contradiction is reported AND the hidden open row still blocks.
        expect(res.kinds).toContain('bad-value');
        expect(res.kinds).toContain('open-finding');
        expect(res.status).toBe(1);
    });

    it('dead-scan-scope: a MOVED artefact root blocks (exit 1), never warn-and-allow', () => {
        const dir = movedRootRepo();
        const res = runGate(dir);
        expect(res.kinds).toEqual(['dead-scan-scope']);
        expect(res.status).toBe(1);
        expect(res.stdout).toMatch(/^scanned: 0\n/);
        expect(res.violations[0]?.detail).toContain('agents/evidence/reviews');
    });

    it('an absent-but-never-tracked artefact root is NOT a dead scope — it reports missing-artifact', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        const res = runGate(dir, ['--artifact-dir', 'agents/evidence/no-corpus-yet']);
        expect(res.kinds).toEqual(['missing-artifact']);
        expect(res.status).toBe(1);
    });

    it('a foreign malformed artifact does not poison an otherwise clean PR', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, honestNullArtifact(scopeHash(dir)));
        // Leftover from an unrelated branch, malformed on purpose.
        write(
            dir,
            'agents/evidence/reviews/legacy-unrelated-work.findings.md',
            ['# Findings: legacy', '<!-- completion-review: v0 | broken -->', '**Honest-null:** nope', ''].join('\n'),
        );
        const res = runGate(dir);
        expect(res.violations).toEqual([]);
        expect(res.status).toBe(0);
    });

    it('open-finding: any open row blocks', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(scopeHash(dir), ['| 1 | high | src/feature.ts:1 | bug | open | |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['open-finding']);
        expect(res.status).toBe(1);
    });

    it('deferred-without-ref: deferred needs a ticket/issue/roadmap ref', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(scopeHash(dir), ['| 1 | medium | src/feature.ts:1 | gap | deferred | |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['deferred-without-ref']);
        expect(res.status).toBe(1);
    });

    it('accepted-risk-without-reason: accepted-risk needs a reason', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(scopeHash(dir), ['| 1 | low | src/feature.ts:1 | nit | accepted-risk | |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['accepted-risk-without-reason']);
        expect(res.status).toBe(1);
    });

    it('severity-order: rows must be sorted critical > high > medium > low', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(
            dir,
            ART,
            findingsArtifact(scopeHash(dir), [
                '| 1 | low | src/feature.ts:1 | nit | accepted-risk | fine, accepted |',
                '| 2 | critical | src/feature.ts:2 | injection | accepted-risk | mitigated upstream, accepted |',
            ]),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['severity-order']);
        expect(res.status).toBe(1);
    });

    it('bad-value: unknown severity and unknown status', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(scopeHash(dir), ['| 1 | gigantic | src/feature.ts:1 | bug | wip | some note |']));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['bad-value', 'bad-value']);
        expect(res.status).toBe(1);
    });

    it('skip-on-code-diff: a skip declaration is rejected when the diff touches code', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, skipLine('plan-only session', scopeHash(dir)));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['skip-on-code-diff']);
        expect(res.status).toBe(1);
    });

    it('skip-on-code-diff: fires for a consumer-stack language too (.rb)', () => {
        const dir = makeRepo();
        write(dir, 'app/models/user.rb', "class User\nend\n");
        commitAll(dir, 'ruby model');
        write(dir, ART, skipLine('no code surface, honestly', scopeHash(dir)));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['skip-on-code-diff']);
        expect(res.violations[0]?.detail).toContain('app/models/user.rb');
        expect(res.status).toBe(1);
    });

    it('fix-before-artifact: fix commit predates the artifact-add commit', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix landed FIRST');
        write(dir, ART, findingsArtifact(SCOPE_A, ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        commitAll(dir, 'artifact added AFTER the fix');
        write(dir, ART, findingsArtifact(scopeHash(dir), [`| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`]));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['fix-before-artifact']);
        expect(res.status).toBe(1);
    });

    it('fix-before-artifact: backdating via a later amend does not move the first-add commit', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix landed FIRST');
        write(dir, ART, findingsArtifact(SCOPE_A, ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        commitAll(dir, 'artifact added AFTER the fix');
        write(dir, ART, findingsArtifact('b'.repeat(64), ['| 1 | high | src/fix.ts:1 | bug | open | |']));
        commitAll(dir, 'artifact rewritten later (backdating attempt)');
        write(dir, ART, findingsArtifact(scopeHash(dir), [`| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`]));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['fix-before-artifact']);
        expect(res.status).toBe(1);
    });

    it('artifact-not-committed: uncommitted artifact with fixed rows referencing commits', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        const fixSha = commitAll(dir, 'fix');
        write(dir, ART, findingsArtifact(scopeHash(dir), [`| 1 | high | src/fix.ts:1 | bug | fixed | ${fixSha} |`]));
        const res = runGate(dir);
        expect(res.kinds).toEqual(['artifact-not-committed']);
        expect(res.status).toBe(1);
    });

    it('unresolvable-fix-ref: fixed ref that does not resolve, and fixed with no ref at all', () => {
        const dir = makeRepo();
        write(dir, 'src/fix.ts', 'export const x = 1;\n');
        commitAll(dir, 'fix');
        write(
            dir,
            ART,
            findingsArtifact(scopeHash(dir), [
                '| 1 | high | src/fix.ts:1 | bug | fixed | abcdef1234567 |',
                '| 2 | low | src/fix.ts:2 | nit | fixed | see PR thread |',
            ]),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['unresolvable-fix-ref', 'unresolvable-fix-ref']);
        expect(res.status).toBe(1);
    });

    it('bad-marker: malformed header marker (own artifact)', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        const head = commitAll(dir, 'feature');
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                `<!-- completion-review: v2 | reviewed: 2026-08-04 | diff: ${head} -->`,
                '',
                ...TABLE_HEAD,
                '| 1 | low | src/feature.ts:1 | nit | accepted-risk | fine, accepted |',
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['bad-marker']);
        expect(res.status).toBe(1);
    });

    it('bad-marker: a v1 marker without the scope field is malformed', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        const head = commitAll(dir, 'feature');
        write(
            dir,
            ART,
            [
                '# Findings: feat',
                `<!-- completion-review: v1 | reviewed: 2026-08-04 | diff: ${head} | reviewer: r2 -->`,
                '',
                ...TABLE_HEAD,
                '| 1 | low | src/feature.ts:1 | nit | accepted-risk | fine, accepted |',
                '',
            ].join('\n'),
        );
        const res = runGate(dir);
        expect(res.kinds).toEqual(['bad-marker']);
        expect(res.status).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Advisory mode + internal-error path
// ---------------------------------------------------------------------------

describe.runIf(hasGit())('check_completion_review — advisory + exit-2', () => {
    it('--advisory reports each violation as a warning and always exits 0', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        // json: kinds still reported, exit forced to 0
        const json = runGate(dir, ['--advisory']);
        expect(json.kinds).toEqual(['missing-artifact']);
        expect(json.status).toBe(0);
        // text: violations carry the advisory prefix
        const text = runInProc(main, ['--repo', dir, '--base', 'main', '--advisory']);
        expect(text.status).toBe(0);
        expect(text.stdout).toContain('(advisory)');
        expect(text.stdout).toContain('missing-artifact');
    });

    it('--advisory turns an open-finding block into exit 0 too', () => {
        const dir = makeRepo();
        write(dir, 'src/feature.ts', 'export const y = 2;\n');
        commitAll(dir, 'feature');
        write(dir, ART, findingsArtifact(scopeHash(dir), ['| 1 | high | src/feature.ts:1 | bug | open | |']));
        const res = runGate(dir, ['--advisory']);
        expect(res.kinds).toEqual(['open-finding']);
        expect(res.status).toBe(0);
    });

    it('--advisory downgrades a dead scan scope like any other policy violation', () => {
        const res = runGate(movedRootRepo(), ['--advisory']);
        expect(res.kinds).toEqual(['dead-scan-scope']);
        expect(res.status).toBe(0);
    });

    it('missing base ref → internal error, exit 2', () => {
        const dir = makeRepo();
        const res = runInProc(main, ['--repo', dir, '--base', 'origin/main']);
        expect(res.status).toBe(2);
        expect(res.stderr).toContain('Internal error');
        expect(res.stderr).toContain('origin/main');
    });
});

// ---------------------------------------------------------------------------
// Pure-function unit tests
// ---------------------------------------------------------------------------

describe('isCodePath — §2.4 classification', () => {
    it('classifies the documented edge cases', () => {
        expect(isCodePath('agents/evidence/x.md')).toBe(false);
        expect(isCodePath('src/scripts/foo.ts')).toBe(true);
        expect(isCodePath('foo.sh')).toBe(true);
        expect(isCodePath('config.yml')).toBe(false);
    });

    it('agents/** never counts as code, even for code extensions', () => {
        expect(isCodePath('agents/evidence/reviews/tool.ts')).toBe(false);
        expect(isCodePath('agents/roadmaps/plan.md')).toBe(false);
    });

    it('src/scripts/** always counts as code; other prose does not', () => {
        expect(isCodePath('src/scripts/README.md')).toBe(true);
        expect(isCodePath('docs/readme.md')).toBe(false);
        expect(isCodePath('lib/util.py')).toBe(true);
        expect(isCodePath('composer.json')).toBe(false);
        expect(isCodePath('Makefile')).toBe(false);
    });

    it('covers the consumer stacks the suite installs into', () => {
        for (const p of [
            'app/models/user.rb',
            'src/main/java/App.java',
            'app/Main.kt',
            'build.gradle.kts',
            'Sources/App.swift',
            'src/core.c',
            'include/core.h',
            'src/core.cc',
            'src/core.cpp',
            'include/core.hpp',
            'Api/Controller.cs',
            'src/Main.scala',
            'components/Widget.vue',
            'components/Widget.svelte',
            'db/migrate/001.sql',
            'resources/views/home.blade.php',
        ]) {
            expect(isCodePath(p), `${p} must classify as code`).toBe(true);
        }
    });
});

describe('isOwnArtifactSlug — foreign artifacts cannot poison a PR', () => {
    it('matches identical and containing slugs, rejects unrelated ones', () => {
        expect(isOwnArtifactSlug('feat', 'feat')).toBe(true);
        expect(isOwnArtifactSlug('road-to-x', 'feat-road-to-x')).toBe(true);
        expect(isOwnArtifactSlug('feat-road-to-x', 'road-to-x')).toBe(true);
        expect(isOwnArtifactSlug('legacy-unrelated-work', 'feat')).toBe(false);
        expect(isOwnArtifactSlug('', 'feat')).toBe(false);
    });

    it('does not let a <4-char stub match everything by containment', () => {
        expect(isOwnArtifactSlug('ci', 'ci-merge-feat')).toBe(false);
        expect(isOwnArtifactSlug('feat', 'feature-branch')).toBe(true);
    });
});

describe('grammar line parsers', () => {
    const SCOPE = 'f'.repeat(64);
    const SHA = 'e'.repeat(40);

    it('parseMarkerLine accepts the exact §2.1 marker and rejects near-misses', () => {
        const m = parseMarkerLine(
            `<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: ${SCOPE} | diff: ${SHA} | reviewer: r2-x -->`,
        );
        expect(m).toEqual({ reviewed: '2026-08-04', scope: SCOPE, diffSha: SHA, reviewer: 'r2-x' });
        expect(
            parseMarkerLine(`<!-- completion-review: v2 | reviewed: 2026-08-04 | scope: ${SCOPE} | diff: ${SHA} | reviewer: x -->`),
        ).toBeNull();
        // scope is mandatory, and must be a full 64-hex hash
        expect(parseMarkerLine(`<!-- completion-review: v1 | reviewed: 2026-08-04 | diff: ${SHA} | reviewer: x -->`)).toBeNull();
        expect(
            parseMarkerLine(`<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: abc1234 | diff: ${SHA} | reviewer: x -->`),
        ).toBeNull();
        expect(
            parseMarkerLine(`<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: ${SCOPE} | diff: ${SHA} | reviewer:  -->`),
        ).toBeNull();
    });

    it('parseHonestNull accepts only the exact §2.3 line', () => {
        expect(parseHonestNull(`**Honest-null:** 0 findings, scope ${SCOPE}, reviewed 2026-08-04`)).toEqual({
            scope: SCOPE,
            reviewed: '2026-08-04',
        });
        expect(parseHonestNull(`**Honest-null:** 0 findings scope ${SCOPE}, reviewed 2026-08-04`)).toBeNull();
        expect(parseHonestNull(`**Honest-null:** 1 findings, scope ${SCOPE}, reviewed 2026-08-04`)).toBeNull();
        // the old sha-bound grammar is gone
        expect(parseHonestNull(`**Honest-null:** 0 findings, diff ${SHA}, reviewed 2026-08-04`)).toBeNull();
    });

    it('parseSkipDeclaration accepts a scope hash or the literal none, requires the em dash', () => {
        expect(
            parseSkipDeclaration('**Skipped:** no code surface for this completion — docs only, scope none, declared 2026-08-04'),
        ).toEqual({ reason: 'docs only', scope: 'none', declared: '2026-08-04' });
        expect(
            parseSkipDeclaration(
                `**Skipped:** no code surface for this completion — plan session, scope ${SCOPE}, declared 2026-08-04`,
            ),
        ).toEqual({ reason: 'plan session', scope: SCOPE, declared: '2026-08-04' });
        expect(
            parseSkipDeclaration('**Skipped:** no code surface for this completion - docs only, scope none, declared 2026-08-04'),
        ).toBeNull();
    });

    it('extractFixRef finds the first 7-40 char hex token, or null', () => {
        expect(extractFixRef('fixed in abc1234')).toBe('abc1234');
        expect(extractFixRef(`landed as ${SHA} on feat`)).toBe(SHA);
        expect(extractFixRef('see the PR thread')).toBeNull();
        expect(extractFixRef('')).toBeNull();
    });
});

describe('parseArtifact + validateFindingRows', () => {
    const SCOPE = 'e'.repeat(64);

    it('parses marker, table rows, and the §5 context manifest', () => {
        const text = [
            '# Findings: feat',
            marker(SCOPE),
            manifestFor(SCOPE),
            '',
            ...TABLE_HEAD,
            '| 1 | critical | src/a.ts:1 | injection | open | |',
            '| 2 | low | src/b.ts:9 | nit | deferred | ISSUE-42 |',
            '',
        ].join('\n');
        const art = parseArtifact(text);
        expect(art.marker?.scope).toBe(SCOPE);
        expect(art.markerMalformed).toBe(false);
        expect(art.manifest?.scope_hash).toBe(SCOPE);
        expect(art.rows).toHaveLength(2);
        expect(art.rows[0]?.severity).toBe('critical');
        expect(art.rows[1]?.status).toBe('deferred');
        expect(art.honestNull).toBeNull();
        expect(art.skip).toBeNull();
    });

    it('reports an absent manifest as null rather than tolerating it silently', () => {
        const art = parseArtifact(['# Findings: feat', marker(SCOPE), '', ...TABLE_HEAD, ''].join('\n'));
        expect(art.manifest).toBeNull();
    });

    it('flags near-miss honest-null / skip lines as malformed instead of accepting them', () => {
        const art = parseArtifact(
            [marker(SCOPE), '**Honest-null:** zero findings', '**Skipped:** because reasons', ''].join('\n'),
        );
        expect(art.honestNull).toBeNull();
        expect(art.skip).toBeNull();
        expect(art.malformedLines).toHaveLength(2);
    });

    it('validateFindingRows keeps descending ties legal and reports ascents once', () => {
        const rows = parseArtifact(
            [
                ...TABLE_HEAD,
                '| 1 | high | a:1 | x | accepted-risk | fine, accepted |',
                '| 2 | high | a:2 | y | accepted-risk | fine, accepted |',
                '| 3 | medium | a:3 | z | accepted-risk | fine, accepted |',
            ].join('\n'),
        ).rows;
        expect(validateFindingRows(rows)).toEqual([]);
    });
});
