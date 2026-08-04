// Gate R2 reviewer dispatcher (docs/contracts/plan-review-gates.md §5).
//
// Every case builds a throwaway git repo under mkdtemp — the dispatcher's
// `--out-dir` resolves against `--repo`, so nothing is ever written into the
// worktree. Covers: package + skeleton creation with recomputed sha256
// hashes, the exact §5 manifest block shape, refuse-overwrite without
// --force, empty-diff exit 1, --verify pass/fail (stale hash named),
// --verify still passing AFTER the artifact is committed (the review-scope
// binding — a head-sha binding could not), a missing manifest as a POLICY
// violation, byte-identical determinism under a frozen --now, slug derivation
// from the branch name, and missing-base-ref exit 2.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import {
    REVIEW_SCOPE_EXCLUDE,
    computeReviewScope,
    deriveManifest,
    deriveSlug,
    expectedHashes,
    extractAcceptanceCriteria,
    isEmptyScope,
    parseManifest,
    reviewScopeDiffArgs,
    sanitizeSlug,
} from '../../src/scripts/dispatch_r2_reviewer.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'dispatch_r2_reviewer.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const NOW = '2026-08-04T10:00:00Z';

const ROADMAP = [
    '# Road X',
    '',
    '## Phase 1',
    '- [ ] step',
    '',
    '## Acceptance Criteria',
    '',
    '- AC one',
    '- AC two',
    '',
    '## Notes',
    '',
    'tail',
    '',
].join('\n');

const tmpDirs: string[] = [];
afterAll(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

function sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

function run(args: string[]): SpawnSyncReturns<string> {
    return spawnSync(TSX_BIN, [SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

function git(cwd: string, ...args: string[]): string {
    const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
    expect(res.status, `git ${args.join(' ')} failed: ${res.stderr}`).toBe(0);
    return res.stdout;
}

function write(dir: string, rel: string, body: string): void {
    const fp = path.join(dir, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, body, 'utf-8');
}

/** The review-scope diff body the dispatcher hands the reviewer. */
function scopeDiff(repo: string, base = 'main'): string {
    return git(repo, ...reviewScopeDiffArgs(base));
}

/** Fresh git repo: main with roadmap + a.txt, then a feature branch with one commit. */
function initRepo(opts: { branch?: boolean } = {}): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-dispatch-'));
    tmpDirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'r2@test.local');
    git(dir, 'config', 'user.name', 'r2');
    git(dir, 'config', 'commit.gpgsign', 'false');
    write(dir, 'a.txt', 'base\n');
    write(dir, 'agents/roadmaps/road-x.md', ROADMAP);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'init');
    if (opts.branch !== false) {
        git(dir, 'checkout', '-qb', 'feat/Test_Branch-1');
        write(dir, 'src/foo.ts', 'export const x = 1;\n');
        git(dir, 'add', '-A');
        git(dir, 'commit', '-qm', 'feat: foo');
    }
    return dir;
}

function dispatchArgs(repo: string, extra: string[] = []): string[] {
    return [
        '--repo', repo,
        '--base', 'main',
        '--roadmap', 'agents/roadmaps/road-x.md',
        '--now', NOW,
        ...extra,
    ];
}

const SLUG = 'feat-test-branch-1';
const OUT = path.join('agents', 'evidence', 'reviews');

describe('dispatch_r2_reviewer — package + skeleton', () => {
    it('creates the input package and skeleton with correct hashes (json shape)', () => {
        const repo = initRepo();
        const res = run(dispatchArgs(repo, ['--format', 'json']));
        expect(res.status, res.stderr).toBe(0);

        const out = JSON.parse(res.stdout) as {
            slug: string;
            head_sha: string;
            hashes: { scope_hash: string; roadmap_hash: string; ac_hash: string };
            files: Record<string, string | null>;
        };

        // Slug derivation from the branch name (sanitized kebab-case).
        expect(out.slug).toBe(SLUG);
        expect(out.head_sha).toBe(git(repo, 'rev-parse', 'HEAD').trim());

        // Recompute every hash independently in the test.
        const diff = scopeDiff(repo);
        const ac = extractAcceptanceCriteria(ROADMAP);
        expect(ac).toBe(['## Acceptance Criteria', '', '- AC one', '- AC two', ''].join('\n'));
        expect(out.hashes.scope_hash).toBe(sha256(diff));
        expect(out.hashes.roadmap_hash).toBe(sha256(ROADMAP));
        expect(out.hashes.ac_hash).toBe(sha256(ac));

        // Package files land under <repo>/<out-dir>/<slug>.review-input/.
        const inputDir = path.join(repo, OUT, `${SLUG}.review-input`);
        expect(fs.readFileSync(path.join(inputDir, 'diff.patch'), 'utf-8')).toBe(diff);
        expect(fs.readFileSync(path.join(inputDir, 'roadmap.md'), 'utf-8')).toBe(ROADMAP);
        expect(fs.readFileSync(path.join(inputDir, 'acceptance-criteria.md'), 'utf-8')).toBe(ac);
        const prompt = fs.readFileSync(path.join(inputDir, 'prompt.md'), 'utf-8');
        expect(prompt).toContain('Review only — write no code, fix nothing.');
        expect(prompt).toContain('branch-scoped `git diff`');
        expect(prompt).toContain('no reads of `agents/runtime/`');
        expect(prompt).toContain('| # | Severity | File:Line | Finding | Status | Reason/Ref |');
        expect(prompt).toContain('- src/foo.ts');
        expect(fs.existsSync(path.join(repo, OUT, `${SLUG}.findings.md`))).toBe(true);
    });

    it('writes the skeleton header marker and the exact §5 manifest block', () => {
        const repo = initRepo();
        const res = run(dispatchArgs(repo));
        expect(res.status, res.stderr).toBe(0);

        const head = git(repo, 'rev-parse', 'HEAD').trim();
        const diff = scopeDiff(repo);
        const ac = extractAcceptanceCriteria(ROADMAP);
        const body = fs.readFileSync(path.join(repo, OUT, `${SLUG}.findings.md`), 'utf-8');

        expect(body.startsWith(`# Findings: ${SLUG}\n`)).toBe(true);
        expect(body).toContain(
            `<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: ${sha256(diff)} | diff: ${head} | ` +
                `reviewer: r2-fresh-subagent-${SLUG} -->`,
        );

        const expectedManifest = [
            '<!-- context-manifest: v1',
            'inputs:',
            `  diff_sha: ${head}`,
            `  scope_hash: ${sha256(diff)}`,
            '  roadmap: agents/roadmaps/road-x.md',
            `  roadmap_hash: ${sha256(ROADMAP)}`,
            `  ac_hash: ${sha256(ac)}`,
            'excluded: [session-history, agents/runtime, implementation-context]',
            'tools: [git-diff-branch-scoped, file-read-branch-paths]',
            `dispatched: ${NOW}`,
            '-->',
        ].join('\n');
        expect(body).toContain(expectedManifest);
        expect(deriveManifest({
            diffSha: head,
            scopeHash: sha256(diff),
            roadmap: 'agents/roadmaps/road-x.md',
            roadmapHash: sha256(ROADMAP),
            acHash: sha256(ac),
            dispatched: NOW,
        })).toBe(expectedManifest);
        expect(parseManifest(body)).toEqual({
            diff_sha: head,
            scope_hash: sha256(diff),
            roadmap: 'agents/roadmaps/road-x.md',
            roadmap_hash: sha256(ROADMAP),
            ac_hash: sha256(ac),
            dispatched: NOW,
        });

        expect(body).toContain('| # | Severity | File:Line | Finding | Status | Reason/Ref |');
        expect(body).toContain(
            '<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 -->',
        );
    });

    it('refuses to overwrite an existing findings artifact without --force', () => {
        const repo = initRepo();
        expect(run(dispatchArgs(repo)).status).toBe(0);
        const second = run(dispatchArgs(repo));
        expect(second.status).toBe(1);
        expect(second.stderr).toMatch(/Refusing to overwrite/);
        const forced = run(dispatchArgs(repo, ['--force']));
        expect(forced.status, forced.stderr).toBe(0);
    });

    it('exits 1 on an empty diff (nothing to review)', () => {
        const repo = initRepo({ branch: false });
        const res = run(dispatchArgs(repo));
        expect(res.status).toBe(1);
        expect(res.stderr).toMatch(/Empty diff .* nothing to review/);
    });

    it('exits 2 on a missing base ref', () => {
        const repo = initRepo();
        const res = run(['--repo', repo, '--base', 'no-such-ref', '--now', NOW]);
        expect(res.status).toBe(2);
        expect(res.stderr).toMatch(/Internal error/);
    });

    it('--print-prompt prints the prompt and the file paths', () => {
        const repo = initRepo();
        const res = run(dispatchArgs(repo, ['--print-prompt']));
        expect(res.status, res.stderr).toBe(0);
        expect(res.stdout).toContain(`# R2 completion review — ${SLUG}`);
        expect(res.stdout).toContain(path.join(OUT, `${SLUG}.review-input`));
        expect(res.stdout).toContain(path.join(OUT, `${SLUG}.findings.md`));
    });
});

describe('dispatch_r2_reviewer — --verify', () => {
    it('verifies an untouched artifact, then fails after a new commit naming the stale hash', () => {
        const repo = initRepo();
        expect(run(dispatchArgs(repo)).status).toBe(0);
        const findings = path.join(repo, OUT, `${SLUG}.findings.md`);

        const pass = run(['--verify', findings, '--repo', repo, '--base', 'main']);
        expect(pass.status, pass.stderr).toBe(0);
        expect(pass.stdout).toContain('✅ manifest verified');

        // A push-after-review changes the reviewed content → stale review.
        write(repo, 'src/foo.ts', 'export const x = 2;\n');
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'feat: bump');

        const fail = run(['--verify', findings, '--repo', repo, '--base', 'main']);
        expect(fail.status).toBe(1);
        expect(fail.stderr).toMatch(/manifest mismatch \(stale review\)/);
        expect(fail.stderr).toContain('scope_hash');
        expect(fail.stderr).not.toContain('roadmap_hash');
    });

    it('still verifies AFTER the review artifact is committed (a head-sha binding could not)', () => {
        const repo = initRepo();
        expect(run(dispatchArgs(repo)).status).toBe(0);
        const findings = path.join(repo, OUT, `${SLUG}.findings.md`);
        const headBefore = git(repo, 'rev-parse', 'HEAD').trim();

        // §2.5 requires the artifact to be committed, and CI only ever sees
        // committed state — this commit moves HEAD past the recorded diff_sha.
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'chore: commit the R2 findings artifact');
        expect(git(repo, 'rev-parse', 'HEAD').trim()).not.toBe(headBefore);

        const after = run(['--verify', findings, '--repo', repo, '--base', 'main']);
        expect(after.status, after.stderr).toBe(0);
        expect(after.stdout).toContain('✅ manifest verified');
    });

    it('exits 1 (policy) when the artifact carries no manifest, 2 only when the file is missing', () => {
        const repo = initRepo();
        const missing = run(['--verify', path.join(repo, 'nope.md'), '--repo', repo, '--base', 'main']);
        expect(missing.status).toBe(2);

        // An artifact that exists but omits the manifest bypasses the whole
        // verification layer if it is treated as an internal error (warn-and-allow).
        write(repo, 'no-manifest.md', '# Findings: x\nno manifest here\n');
        const unparsable = run(['--verify', path.join(repo, 'no-manifest.md'), '--repo', repo, '--base', 'main']);
        expect(unparsable.status).toBe(1);
        expect(unparsable.stderr).toMatch(/Policy violation/);
        expect(unparsable.stderr).toMatch(/no context-manifest block/);
    });
});

// A findings artefact left behind by a DIFFERENT branch: valid grammar, bound
// to a scope this branch can never reproduce. Contract §2.6 makes the reviews
// directory tracked and accumulating, so this is the normal steady state.
const FOREIGN_SCOPE = 'a'.repeat(64);

function writeForeignArtifact(repo: string): string {
    const rel = path.join(OUT, 'some-other-branch.findings.md');
    write(
        repo,
        rel,
        [
            '# Findings: some-other-branch',
            `<!-- completion-review: v1 | reviewed: 2026-07-01 | scope: ${FOREIGN_SCOPE} | diff: ${'0'.repeat(40)} | reviewer: r2-fresh-subagent-other -->`,
            '',
            deriveManifest({
                diffSha: '0'.repeat(40),
                scopeHash: FOREIGN_SCOPE,
                roadmap: 'none',
                roadmapHash: 'none',
                acHash: 'none',
                dispatched: '2026-07-01T09:00:00Z',
            }),
            '',
            `**Honest-null:** 0 findings, scope ${FOREIGN_SCOPE}, reviewed 2026-07-01`,
            '',
        ].join('\n'),
    );
    return path.join(repo, rel);
}

describe('dispatch_r2_reviewer — --verify-current', () => {
    // Finding 1: a CI loop that runs `--verify` over every *.findings.md blocks
    // on exit 1, and every artefact from a previous branch records a different
    // scope_hash — so the step reds by construction on the next gated PR and can
    // only be un-stuck by editing an unrelated branch's artefact (the
    // directory-wide poisoning §2.6 forbids). Selection must live in the script.
    it('ignores a foreign artefact that a verify-everything loop would red on', () => {
        const repo = initRepo();
        const foreign = writeForeignArtifact(repo);

        // The poisoning shape, demonstrated: per-file --verify on the foreign
        // artefact fails, because its scope is not this branch's.
        const perFile = run(['--verify', foreign, '--repo', repo, '--base', 'main']);
        expect(perFile.status).toBe(1);
        expect(perFile.stderr).toMatch(/manifest mismatch \(stale review\)/);

        const res = run(['--verify-current', '--repo', repo, '--base', 'main']);
        expect(res.status, res.stderr).toBe(0);
        expect(res.stdout).toContain('nothing to re-derive');
    });

    it('verifies the relevant artefact and exits 1 when its recorded hash is tampered with', () => {
        const repo = initRepo();
        expect(run(dispatchArgs(repo)).status).toBe(0);
        writeForeignArtifact(repo); // must not influence the verdict either way

        const clean = run(['--verify-current', '--repo', repo, '--base', 'main']);
        expect(clean.status, clean.stderr).toBe(0);
        expect(clean.stdout).toContain('1 relevant artefact(s) verified');

        const findings = path.join(repo, OUT, `${SLUG}.findings.md`);
        const body = fs.readFileSync(findings, 'utf-8');
        const scope = computeReviewScope((a) => git(repo, ...a), 'main').hash;
        fs.writeFileSync(findings, body.replace(`scope_hash: ${scope}`, `scope_hash: ${'b'.repeat(64)}`), 'utf-8');

        const res = run(['--verify-current', '--repo', repo, '--base', 'main']);
        expect(res.status).toBe(1);
        expect(res.stderr).toMatch(/manifest mismatch \(stale review\)/);
        expect(res.stderr).toMatch(/1 of 1 relevant artefact\(s\) failed/);
    });

    it('exits 0 when there are no artefacts at all (coverage is the validator\'s job)', () => {
        const repo = initRepo();
        const none = run(['--verify-current', '--repo', repo, '--base', 'main']);
        expect(none.status, none.stderr).toBe(0);
        expect(none.stdout).toContain('nothing to re-derive');

        // …and an --artifact-dir that does not resolve is not this step's error
        // either: a moved root is check_completion_review's dead-scope assertion.
        const absent = run([
            '--verify-current',
            '--artifact-dir',
            'agents/evidence/no-such-root',
            '--repo',
            repo,
            '--base',
            'main',
        ]);
        expect(absent.status, absent.stderr).toBe(0);
    });

    it('does not verify a bare skip declaration (§5: it needs no manifest)', () => {
        const repo = initRepo();
        const scope = computeReviewScope((a) => git(repo, ...a), 'main').hash;
        write(
            repo,
            path.join(OUT, `${SLUG}.findings.md`),
            `**Skipped:** no code surface for this completion — plan-only session, scope ${scope}, declared 2026-08-04\n`,
        );
        const res = run(['--verify-current', '--repo', repo, '--base', 'main']);
        expect(res.status, res.stderr).toBe(0);
        expect(res.stdout).toContain('nothing to re-derive');
    });
});

describe('dispatch_r2_reviewer — determinism', () => {
    it('same repo state + same args (frozen --now) → byte-identical outputs', () => {
        const repo = initRepo();
        expect(run(dispatchArgs(repo, ['--out-dir', 'outA'])).status).toBe(0);
        expect(run(dispatchArgs(repo, ['--out-dir', 'outB'])).status).toBe(0);

        const names = [
            `${SLUG}.review-input/diff.patch`,
            `${SLUG}.review-input/roadmap.md`,
            `${SLUG}.review-input/acceptance-criteria.md`,
            `${SLUG}.review-input/prompt.md`,
            `${SLUG}.findings.md`,
        ];
        for (const name of names) {
            const a = fs.readFileSync(path.join(repo, 'outA', name));
            const b = fs.readFileSync(path.join(repo, 'outB', name));
            expect(a.equals(b), `${name} differs between identical runs`).toBe(true);
        }
    });
});

describe('dispatch_r2_reviewer — pure helpers', () => {
    it('sanitizeSlug kebab-cases arbitrary branch names', () => {
        expect(sanitizeSlug('feat/Test_Branch-1')).toBe('feat-test-branch-1');
        expect(sanitizeSlug('--Weird//Name--')).toBe('weird-name');
        expect(sanitizeSlug('///')).toBe('review');
    });

    // Finding 8: on a `pull_request` checkout HEAD is a detached synthetic merge
    // commit, so `rev-parse --abbrev-ref HEAD` returns `HEAD`, the slug degrades
    // to `detached-<sha>`, and `isOwnArtifactSlug` can never match — inverting
    // §2.6 on the layer the contract calls authoritative.
    it('deriveSlug resolves the branch from the CI env before a detached HEAD', () => {
        const detachedGit = (a: readonly string[]): string => (a.includes('--short') ? 'abc1234\n' : 'HEAD\n');

        // No CI env → the honest detached fallback.
        expect(deriveSlug(detachedGit, {})).toBe('detached-abc1234');
        // pull_request: GITHUB_HEAD_REF is the head branch.
        expect(deriveSlug(detachedGit, { GITHUB_HEAD_REF: 'feat/Road-To-X' })).toBe('feat-road-to-x');
        // push: GITHUB_REF_NAME carries the branch.
        expect(deriveSlug(detachedGit, { GITHUB_REF_NAME: 'feat/push-branch' })).toBe('feat-push-branch');
        // HEAD_REF wins — on pull_request GITHUB_REF_NAME is `<pr>/merge`.
        expect(deriveSlug(detachedGit, { GITHUB_HEAD_REF: 'feat/head', GITHUB_REF_NAME: '42/merge' })).toBe(
            'feat-head',
        );
        // Empty / non-branch env values carry no identity and are ignored.
        expect(deriveSlug(detachedGit, { GITHUB_HEAD_REF: '  ', GITHUB_REF_NAME: 'HEAD' })).toBe('detached-abc1234');
        // A real branch checkout still wins over nothing in the env.
        expect(deriveSlug((a) => (a.includes('--short') ? 'abc1234\n' : 'feat/local\n'), {})).toBe('feat-local');
    });

    it('expectedHashes maps null roadmap/AC to none', () => {
        const h = expectedHashes({ scopeDiffText: 'd', roadmapText: null, acText: null });
        expect(h.scope_hash).toBe(sha256('d'));
        expect(h.roadmap_hash).toBe('none');
        expect(h.ac_hash).toBe('none');
    });

    it('extractAcceptanceCriteria returns empty string when the section is absent', () => {
        expect(extractAcceptanceCriteria('# X\n\n## Phase 1\n- [ ] a\n')).toBe('');
    });

    it('reviewScopeDiffArgs excludes the review artefacts from the reviewed scope', () => {
        expect(reviewScopeDiffArgs('origin/main')).toEqual([
            'diff',
            'origin/main...HEAD',
            '--',
            ':/',
            REVIEW_SCOPE_EXCLUDE,
        ]);
        expect(REVIEW_SCOPE_EXCLUDE).toContain('agents/evidence/reviews');
    });

    it('isEmptyScope treats whitespace-only diff output as empty', () => {
        expect(isEmptyScope('')).toBe(true);
        expect(isEmptyScope('\n  \n')).toBe(true);
        expect(isEmptyScope('diff --git a/x b/x\n')).toBe(false);
    });
});

describe('dispatch_r2_reviewer — review scope', () => {
    it('a commit that only touches the reviews directory leaves the scope hash unchanged', () => {
        const repo = initRepo();
        const runGit = (a: readonly string[]): string => git(repo, ...a);
        const before = computeReviewScope(runGit, 'main');

        write(repo, path.join(OUT, 'anything.findings.md'), '# Findings\n');
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'chore: add a review artifact');

        const after = computeReviewScope(runGit, 'main');
        expect(after.hash).toBe(before.hash);
        expect(after.empty).toBe(false);
        // …while the RAW diff did change, which is exactly why it cannot bind.
        expect(sha256(git(repo, 'diff', 'main...HEAD'))).not.toBe(before.hash);
    });

    it('a reviews-only branch has an empty review scope', () => {
        const repo = initRepo({ branch: false });
        git(repo, 'checkout', '-qb', 'reviews-only');
        write(repo, path.join(OUT, 'x.findings.md'), '# Findings\n');
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'chore: review only');
        expect(computeReviewScope((a) => git(repo, ...a), 'main').empty).toBe(true);
    });
});
