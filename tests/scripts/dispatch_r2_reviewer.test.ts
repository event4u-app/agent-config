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
    REVIEW_SCOPE_EXCLUDES,
    REVIEW_SCOPE_GIT_CONFIG,
    artefactStaleness,
    leftoverArtefactRefusal,
    scopeExclusionViolation,
    computeReviewScope,
    deriveManifest,
    deriveSlug,
    expectedHashes,
    extractAcceptanceCriteria,
    hasAcceptanceCriteria,
    isEmptyScope,
    parseManifest,
    reviewScopeDiffArgs,
    reviewScopeNameOnlyArgs,
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

/**
 * A roadmap declaring its criteria as inline `- **AC-n:**` bullets per phase,
 * with no `## Acceptance Criteria` heading anywhere — the form 7 of the 44 active
 * roadmaps use. Continuation lines are indented two spaces, and the trailing
 * prose exists so a test can prove the collector stops rather than swallowing it.
 */
const ROADMAP_INLINE_AC = [
    '# Road Y',
    '',
    '## Phase 1',
    '- [ ] step',
    '- **AC-0:** the first criterion holds, and this line wraps',
    '  onto a continuation the collector must keep.',
    '',
    '## Phase 2',
    '- [ ] other step',
    '- **AC-1:** the second criterion holds.',
    '',
    'Trailing prose that is NOT a criterion and must not be collected.',
    '',
].join('\n');

/**
 * What `ROADMAP_INLINE_AC` must extract to, written out as a literal.
 *
 * Deliberately NOT computed by calling the extractor: an expectation derived from
 * the function under test cannot fail on an extraction defect, it only pins "the
 * dispatcher hashed whatever came back". The R2 review of the first version of
 * this fix caught exactly that in the end-to-end hash assertion below.
 */
const ROADMAP_INLINE_AC_EXPECTED = [
    '- **AC-0:** the first criterion holds, and this line wraps',
    '  onto a continuation the collector must keep.',
    '- **AC-1:** the second criterion holds.',
].join('\n');

/** A roadmap that declares no acceptance criteria in either form. */
const ROADMAP_NO_AC = ['# Road Z', '', '## Phase 1', '- [ ] step', '', '## Notes', '', 'tail', ''].join(
    '\n',
);

/** Fresh git repo: main with roadmap + a.txt, then a feature branch with one commit. */
function initRepo(opts: { branch?: boolean; roadmap?: string } = {}): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-dispatch-'));
    tmpDirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'r2@test.local');
    git(dir, 'config', 'user.name', 'r2');
    git(dir, 'config', 'commit.gpgsign', 'false');
    write(dir, 'a.txt', 'base\n');
    write(dir, 'agents/roadmaps/road-x.md', opts.roadmap ?? ROADMAP);
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
        // The snapshot is the roadmap verbatim BELOW a check-refs exemption
        // header: the copy lives under a directory check_references walks,
        // while the live roadmap layer is excluded — a roadmap legitimately
        // quoting a nonexistent path (a documented hallucinated citation)
        // must not red CI through its own snapshot. roadmap_hash stays bound
        // to the LIVE text (asserted above), never the stamped copy.
        const snapshot = fs.readFileSync(path.join(inputDir, 'roadmap.md'), 'utf-8');
        const snapshotLines = snapshot.split('\n');
        expect(snapshotLines[0]).toBe('<!-- check-refs: skip -->');
        expect(snapshot.endsWith(ROADMAP)).toBe(true);
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
        // The marker now carries `prompt_hash` — the dispatcher hashes the
        // prompt IT built, which is what makes the § 5 prompt channel
        // attributable instead of absent. Re-derived here from the file the
        // dispatcher wrote, so the assertion cannot pass by copying a constant.
        const promptText = fs.readFileSync(
            path.join(repo, OUT, `${SLUG}.review-input`, 'prompt.md'),
            'utf-8',
        );
        expect(body).toContain(
            `<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: ${sha256(diff)} | diff: ${head} | ` +
                `reviewer: r2-fresh-subagent-${SLUG} | prompt_hash: ${sha256(promptText)} -->`,
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
            '<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line ' +
                'per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` ' +
                'per docs/contracts/evidence-artifact-types.md §4 -->',
        );
        // The evidence type is stamped at CREATION, not inferred later — and the
        // placeholder above is load-bearing for it: `current-binding` on an empty
        // table is legal only while the skeleton is unfilled, so a change that
        // drops the placeholder makes every fresh skeleton fail its own gate.
        expect(body).toContain('<!-- evidence-type: v1 | type: current-binding | declared: ');
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

// ---------------------------------------------------------------------------
// Round-3 finding 8 — the scope hash is the single cross-machine binding, so it
// must not move because of a developer's local diff config.
// ---------------------------------------------------------------------------

/** Local git config that changes `git diff` bytes for byte-identical content. */
const HOSTILE_DIFF_CONFIG = [
    '-c', 'diff.noprefix=true',
    '-c', 'diff.mnemonicPrefix=true',
    '-c', 'diff.algorithm=patience',
    '-c', 'diff.context=7',
    '-c', 'diff.interHunkContext=5',
    '-c', 'core.abbrev=7',
    '-c', 'core.quotePath=false',
    '-c', 'diff.relative=true',
    '-c', 'diff.renames=copies',
    '-c', 'diff.renameLimit=1',
    '-c', 'diff.indentHeuristic=false',
    '-c', 'diff.submodule=log',
    '-c', 'diff.suppressBlankEmpty=true',
];

/**
 * A branch whose diff exercises every pinned knob: two separated hunks in one
 * file (context / inter-hunk context / algorithm), a rename (rename detection),
 * and a non-ASCII pathname (`core.quotePath`).
 */
function configSensitiveRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-cfg-'));
    tmpDirs.push(dir);
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'config', 'user.email', 'r2@test.local');
    git(dir, 'config', 'user.name', 'r2');
    git(dir, 'config', 'commit.gpgsign', 'false');
    const lines = Array.from({ length: 30 }, (_, i) => `line ${String(i + 1)}`);
    write(dir, 'src/wide.ts', `${lines.join('\n')}\n`);
    write(dir, 'src/moved.ts', 'export const moved = 1;\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'init');

    git(dir, 'checkout', '-qb', 'feat/config-sensitive');
    lines[2] = 'line 3 — CHANGED';
    lines[24] = 'line 25 — CHANGED';
    write(dir, 'src/wide.ts', `${lines.join('\n')}\n`);
    git(dir, 'mv', 'src/moved.ts', 'src/renamed.ts');
    write(dir, 'src/ümläut.ts', 'export const u = 1;\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'feat: config-sensitive diff');
    return dir;
}

describe('dispatch_r2_reviewer — the scope hash is config-independent', () => {
    it('hostile local diff config produces the identical scope hash', () => {
        const repo = configSensitiveRepo();
        const pinnedDefault = git(repo, ...reviewScopeDiffArgs('main'));
        const pinnedHostile = git(repo, ...HOSTILE_DIFF_CONFIG, ...reviewScopeDiffArgs('main'));
        expect(sha256(pinnedHostile)).toBe(sha256(pinnedDefault));

        // Control — the same config DOES move an unpinned diff, so the fixture
        // really does exercise the knobs (a vacuous fixture would pass either way).
        const rawDefault = git(repo, 'diff', 'main...HEAD');
        const rawHostile = git(repo, ...HOSTILE_DIFF_CONFIG, 'diff', 'main...HEAD');
        expect(sha256(rawHostile)).not.toBe(sha256(rawDefault));
    });

    it('the changed-file list is config-independent too (it feeds the §2.4 code-path check)', () => {
        const repo = configSensitiveRepo();
        const pinnedDefault = git(repo, ...reviewScopeNameOnlyArgs('main'));
        const pinnedHostile = git(repo, ...HOSTILE_DIFF_CONFIG, ...reviewScopeNameOnlyArgs('main'));
        expect(pinnedHostile).toBe(pinnedDefault);
        // Rename detection off → both sides of the rename are listed as paths;
        // `core.quotePath=true` (git's default, pinned) octal-quotes the
        // non-ASCII path — the point is that BOTH runs agree, not which form.
        expect(pinnedDefault.split('\n').filter(Boolean).sort()).toEqual([
            '"src/\\303\\274ml\\303\\244ut.ts"',
            'src/moved.ts',
            'src/renamed.ts',
            'src/wide.ts',
        ]);
    });

    it('the pinned flag set is what computeReviewScope hashes', () => {
        const repo = configSensitiveRepo();
        const scope = computeReviewScope((a) => git(repo, ...HOSTILE_DIFF_CONFIG, ...a), 'main');
        expect(scope.hash).toBe(sha256(git(repo, ...reviewScopeDiffArgs('main'))));
        expect(scope.empty).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Round-3 finding 10 — a CRLF working-tree copy must not become a policy block.
// ---------------------------------------------------------------------------

describe('dispatch_r2_reviewer — CRLF tolerance', () => {
    const MANIFEST = deriveManifest({
        diffSha: '0'.repeat(40),
        scopeHash: 'b'.repeat(64),
        roadmap: 'agents/roadmaps/road-x.md',
        roadmapHash: 'c'.repeat(64),
        acHash: 'd'.repeat(64),
        dispatched: '2026-08-04T09:30:00Z',
    });

    it('parseManifest reads a CRLF manifest and captures no stray carriage return', () => {
        const crlf = MANIFEST.replace(/\n/g, '\r\n');
        expect(parseManifest(crlf)).toEqual(parseManifest(MANIFEST));
        const parsed = parseManifest(crlf);
        expect(parsed?.scope_hash).toBe('b'.repeat(64));
        expect(parsed?.dispatched).toBe('2026-08-04T09:30:00Z');
    });

    it('--verify passes on a CRLF findings artefact instead of blocking on missing-manifest', () => {
        const repo = initRepo();
        expect(run(dispatchArgs(repo)).status).toBe(0);
        const findings = path.join(repo, OUT, `${SLUG}.findings.md`);
        const lf = fs.readFileSync(findings, 'utf-8');
        fs.writeFileSync(findings, lf.replace(/\n/g, '\r\n'), 'utf-8');
        expect(fs.readFileSync(findings, 'utf-8')).toContain('\r\n');

        const res = run(['--verify', findings, '--repo', repo, '--base', 'main']);
        expect(res.status, res.stderr).toBe(0);
        expect(res.stdout).toContain('✅ manifest verified');
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
        // The path stays UNDER an excluded root so the two concerns stay
        // separate: "does the configured root resolve" (validator's dead-scope
        // assertion, exit 0 here) vs "may artefacts live there at all" (the
        // §2.0 exclusion guard below, exit 1).
        const absent = run([
            '--verify-current',
            '--artifact-dir',
            'agents/evidence/reviews/no-such-root',
            '--repo',
            repo,
            '--base',
            'main',
        ]);
        expect(absent.status, absent.stderr).toBe(0);

        // A root OUTSIDE the exclusions is refused: an artefact committed there
        // would change the scope hash and invalidate its own review.
        const inScope = run([
            '--verify-current',
            '--artifact-dir',
            'agents/evidence/no-such-root',
            '--repo',
            repo,
            '--base',
            'main',
        ]);
        expect(inScope.status).toBe(1);
        expect(inScope.stderr).toMatch(/not excluded from the review scope/);
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
        // Both out-dirs stay UNDER an excluded root: an artefact directory
        // inside the reviewed scope is refused outright (§2.0 guard), so the
        // two comparison runs use sibling sub-dirs of the default location.
        const outA = 'agents/evidence/reviews/runA';
        const outB = 'agents/evidence/reviews/runB';
        expect(run(dispatchArgs(repo, ['--out-dir', outA])).status).toBe(0);
        expect(run(dispatchArgs(repo, ['--out-dir', outB])).status).toBe(0);

        const names = [
            `${SLUG}.review-input/diff.patch`,
            `${SLUG}.review-input/roadmap.md`,
            `${SLUG}.review-input/acceptance-criteria.md`,
            `${SLUG}.review-input/prompt.md`,
            `${SLUG}.findings.md`,
        ];
        for (const name of names) {
            const a = fs.readFileSync(path.join(repo, outA, name));
            const b = fs.readFileSync(path.join(repo, outB, name));
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

    it('extractAcceptanceCriteria matches the heading case-insensitively', () => {
        // The tree carries both `## Acceptance Criteria` and `## Acceptance
        // criteria`; the case-sensitive version extracted an empty file for the
        // latter and stamped ac_hash with the SHA-256 of the empty string —
        // found by the zcs-close R2 review (2026-08-09), pinned here.
        const lower = '# X\n\n## Acceptance criteria\n\n- crit A\n\n## Next\n';
        expect(extractAcceptanceCriteria(lower)).toContain('- crit A');
    });

    it('extractAcceptanceCriteria collects inline AC bullets with their continuation lines', () => {
        // The second instance of the same defect class as the case-sensitivity
        // bug above: an inline-only roadmap yielded '', the reviewer got a
        // 0-byte acceptance-criteria.md, and the prompt said the criteria had
        // been extracted. Measured 2026-08-18: 7 of 44 active roadmaps are
        // inline-only, including the one the backlog named as the next pick.
        expect(extractAcceptanceCriteria(ROADMAP_INLINE_AC)).toBe(ROADMAP_INLINE_AC_EXPECTED);
    });

    it('extractAcceptanceCriteria stops at the first blank or non-indented line', () => {
        // Over-collection is the failure that would look like success: a
        // collector running to EOF would ship the whole roadmap tail as
        // "criteria" and the positive test above would still pass.
        //
        // The first two assertions are this test's OWN vacuity guard, and they
        // are not decoration — a mutation run proved the exclusions below pass
        // over an empty string, i.e. the test would have gone green against the
        // exact defect it exists to catch. Assert there is something to exclude
        // FROM before excluding anything.
        const ac = extractAcceptanceCriteria(ROADMAP_INLINE_AC);
        expect(ac).not.toBe('');
        expect(ac).toContain('- **AC-1:**');
        expect(ac).not.toContain('Trailing prose');
        expect(ac).not.toContain('## Phase 2');
        expect(ac).not.toContain('- [ ] other step');
    });

    it('extractAcceptanceCriteria prefers the heading form when a roadmap carries both', () => {
        // No roadmap in the tree carries both today (21 heading-only, 7
        // inline-only, 0 both), so this pins a precedence rule against a future
        // file rather than resolving a live ambiguity.
        const both = [ROADMAP, '- **AC-9:** an inline bullet added later.', ''].join('\n');
        const ac = extractAcceptanceCriteria(both);
        expect(ac).toContain('- AC one');
        expect(ac).not.toContain('AC-9');
    });

    it('extractAcceptanceCriteria returns empty string when neither form is present', () => {
        expect(extractAcceptanceCriteria(ROADMAP_NO_AC)).toBe('');
    });

    it('extractAcceptanceCriteria accepts a heading that carries trailing qualifier text', () => {
        // LIVE defect, not a hypothetical: the end-anchored `\s*$` rejected
        // `## Acceptance criteria (per phase, on promotion to ready)` and
        // `## Acceptance criteria (anti-dump — …)`, two real roadmaps that the
        // census behind this fix had therefore counted as declaring none. Found
        // by the R2 review of the first version.
        const qualified = [
            '# X',
            '',
            '## Acceptance criteria (per phase, on promotion to ready)',
            '',
            '- crit A',
            '',
            '## Next',
            '',
        ].join('\n');
        const ac = extractAcceptanceCriteria(qualified);
        expect(ac).toContain('- crit A');
        expect(ac).not.toContain('## Next');
    });

    it('extractAcceptanceCriteria keeps a loose-list continuation separated by a blank line', () => {
        // Markdown loose lists put a blank line between a bullet and its second
        // paragraph. Breaking on the blank truncated the criterion and produced a
        // PARTIAL extraction that hashed to a real value and read as complete —
        // the same looks-like-success shape, relocated from "empty but claimed"
        // to "half but claimed".
        const loose = [
            '## Phase 1',
            '- **AC-0:** first paragraph of the criterion.',
            '',
            '  second paragraph, still part of AC-0.',
            '',
            'Unindented prose that ends it.',
            '',
        ].join('\n');
        const ac = extractAcceptanceCriteria(loose);
        expect(ac).toContain('first paragraph');
        expect(ac).toContain('second paragraph, still part of AC-0.');
        expect(ac).not.toContain('Unindented prose');
    });

    it('extractAcceptanceCriteria emits a nested AC bullet as its own criterion', () => {
        // Indent-folding made the extraction shape — and therefore ac_hash — a
        // function of indentation depth, and the skip was permanent because the
        // outer scan resumed past the folded line.
        const nested = ['## Phase 1', '- **AC-0:** parent.', '  - **AC-1:** nested child.', ''].join(
            '\n',
        );
        const ac = extractAcceptanceCriteria(nested);
        expect(ac.split('\n')).toEqual(['- **AC-0:** parent.', '  - **AC-1:** nested child.']);
    });

    it('hasAcceptanceCriteria is the single predicate behind ac_hash and the prompt', () => {
        // The pair used to be encoded twice with two different tests, agreeing
        // only while '' stayed the sole reachable falsy value. Pinned as parity so
        // refining the predicate cannot desynchronise the manifest from the prompt.
        expect(hasAcceptanceCriteria(null)).toBe(false);
        expect(hasAcceptanceCriteria(undefined)).toBe(false);
        expect(hasAcceptanceCriteria('')).toBe(false);
        expect(hasAcceptanceCriteria('   \n\n  ')).toBe(false);
        expect(hasAcceptanceCriteria('- **AC-0:** x')).toBe(true);
        // Parity: whatever the predicate says, ac_hash agrees.
        for (const ac of [null, '', '   \n ', '- **AC-0:** x']) {
            const h = expectedHashes({ scopeDiffText: 'd', roadmapText: 'r', acText: ac }).ac_hash;
            expect(h === 'none').toBe(!hasAcceptanceCriteria(ac));
        }
    });

    it('expectedHashes maps an EMPTY extraction to none, not to the empty-string hash', () => {
        // e3b0c442…b855 is sha256(''). It was recorded whenever extraction came
        // back empty, looks like a real hash in the manifest, and re-derives
        // identically on --verify-current — so the gate confirmed a criteria set
        // that was never there. Named explicitly so a revert cannot pass.
        const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        expect(sha256('')).toBe(EMPTY_SHA);
        const h = expectedHashes({ scopeDiffText: 'd', roadmapText: 'r', acText: '' });
        expect(h.ac_hash).toBe('none');
        expect(h.ac_hash).not.toBe(EMPTY_SHA);
        // A non-empty extraction still hashes.
        expect(expectedHashes({ scopeDiffText: 'd', roadmapText: 'r', acText: 'x' }).ac_hash).toBe(
            sha256('x'),
        );
    });

    it('dispatch on an inline-AC roadmap writes real criteria and a prompt that claims extraction', () => {
        const repo = initRepo({ roadmap: ROADMAP_INLINE_AC });
        const res = run(dispatchArgs(repo, ['--format', 'json']));
        expect(res.status, res.stderr).toBe(0);
        const out = JSON.parse(res.stdout) as { hashes: { ac_hash: string } };

        const inputDir = path.join(repo, OUT, `${SLUG}.review-input`);
        const acFile = fs.readFileSync(path.join(inputDir, 'acceptance-criteria.md'), 'utf-8');
        expect(acFile).toContain('- **AC-0:**');
        expect(acFile).toContain('- **AC-1:**');
        // Literal expectation, not `sha256(extractAcceptanceCriteria(...))` —
        // see ROADMAP_INLINE_AC_EXPECTED for why that form proves nothing.
        expect(acFile).toBe(ROADMAP_INLINE_AC_EXPECTED);
        expect(out.hashes.ac_hash).toBe(sha256(ROADMAP_INLINE_AC_EXPECTED));
        expect(out.hashes.ac_hash).not.toBe('none');

        // The vacuity guard for the next test: prove the "extracted" wording is
        // what a criteria-carrying roadmap actually produces, so asserting its
        // ABSENCE below is a real assertion rather than a tautology over prose
        // that never appears.
        const prompt = fs.readFileSync(path.join(inputDir, 'prompt.md'), 'utf-8');
        expect(prompt).toContain('Acceptance Criteria extracted to `acceptance-criteria.md`');
    });

    it('dispatch on a roadmap with no criteria records none and tells the reviewer so', () => {
        const repo = initRepo({ roadmap: ROADMAP_NO_AC });
        const res = run(dispatchArgs(repo, ['--format', 'json']));
        expect(res.status, res.stderr).toBe(0);
        const out = JSON.parse(res.stdout) as { hashes: { roadmap_hash: string; ac_hash: string } };

        // A roadmap WAS supplied — so this is the third state, distinct from
        // "no roadmap", and the reviewer must be able to tell them apart.
        expect(out.hashes.roadmap_hash).toBe(sha256(ROADMAP_NO_AC));
        expect(out.hashes.ac_hash).toBe('none');

        const inputDir = path.join(repo, OUT, `${SLUG}.review-input`);
        expect(fs.readFileSync(path.join(inputDir, 'acceptance-criteria.md'), 'utf-8')).toBe('');
        const prompt = fs.readFileSync(path.join(inputDir, 'prompt.md'), 'utf-8');
        // The line reports the EXTRACTION, never the roadmap: an unrecognised
        // shape yields the identical empty result, so asserting the roadmap
        // "declares none" would be a claim the dispatcher cannot establish.
        expect(prompt).toContain('NO acceptance criteria could be EXTRACTED from it');
        expect(prompt).toContain('the extractor does not recognise');
        expect(prompt).not.toContain('Acceptance Criteria extracted to');
    });

    it('reviewScopeDiffArgs excludes every gate-owned evidence path from the reviewed scope', () => {
        const argv = reviewScopeDiffArgs('origin/main');
        // Asserted as structure, not as a frozen array: the byte-stability flag
        // set (REVIEW_SCOPE_DIFF_FLAGS / _GIT_CONFIG) grows whenever a new git
        // output knob has to be pinned, and that must not red this test.
        expect(argv).toContain('diff');
        expect(argv).toContain('origin/main...HEAD');
        // Pathspecs come last, after the `--` separator, in declaration order.
        expect(argv.slice(argv.indexOf('--'))).toEqual(['--', ':/', ...REVIEW_SCOPE_EXCLUDES]);
        // The revision range precedes the separator; the flags precede the range.
        expect(argv.indexOf('origin/main...HEAD')).toBeLessThan(argv.indexOf('--'));
        expect(argv.indexOf('diff')).toBeLessThan(argv.indexOf('origin/main...HEAD'));
        expect(REVIEW_SCOPE_EXCLUDES.some((s) => s.includes('agents/evidence/reviews'))).toBe(true);
        // R2 round-3 finding 1: §7 MANDATES appending the outcome event to the
        // tracked metrics JSONL, so leaving it in scope let the commit that
        // records a review invalidate that same review.
        expect(REVIEW_SCOPE_EXCLUDES.some((s) => s.includes('agents/evidence/metrics'))).toBe(true);
    });

    // Round-6 finding 5: `REVIEW_SCOPE_EXCLUDE` (singular) was a dead export
    // justified as "back-compat" in a module this branch introduces — nothing
    // could depend on it yet, and its only reference in the tree was the test
    // asserting on it. A dead export with an invented reason for existing is
    // worse than none, so its absence is pinned.
    it('exports no dead single-pathspec alias beside the pathspec list', async () => {
        const mod = await import('../../src/scripts/dispatch_r2_reviewer.js');
        const exported = Object.keys(mod);
        // The plural list is the real API — asserted so this test cannot pass
        // by the module simply failing to expose anything.
        expect(exported).toContain('REVIEW_SCOPE_EXCLUDES');
        expect(exported).not.toContain('REVIEW_SCOPE_EXCLUDE');
    });

    it('scopeExclusionViolation refuses an artefact dir that is inside the reviewed scope', () => {
        // Default and nested-under-default are safe.
        expect(scopeExclusionViolation('agents/evidence/reviews')).toBeNull();
        expect(scopeExclusionViolation('./agents/evidence/reviews/')).toBeNull();
        expect(scopeExclusionViolation('agents/evidence/metrics')).toBeNull();
        // Anything else would be committed INSIDE the scope it records.
        expect(scopeExclusionViolation('agents/reviews')).toContain('not excluded');
        expect(scopeExclusionViolation('docs/reviews')).toContain('not excluded');
        expect(scopeExclusionViolation('/tmp/reviews')).toContain('repo-relative');
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

/** `git` on `repo` with extra environment — used to install a hostile user config. */
function gitWithEnv(cwd: string, args: readonly string[], env: Record<string, string>): string {
    const res = spawnSync('git', [...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
    expect(res.status, `git ${args.join(' ')} failed: ${res.stderr}`).toBe(0);
    return res.stdout;
}

describe('dispatch_r2_reviewer — cross-machine byte stability', () => {
    // Round-6 finding 2: `--no-textconv` neutralises a textconv FILTER only. A
    // `-diff` attribute is a different layer — it replaces the whole patch body
    // with `Binary files a/x and b/x differ` — so a single developer carrying a
    // user-global `*.ts -diff` entry recorded a different scope hash for
    // identical content, surfacing as a `manifest mismatch (stale review)` no
    // content change explains. The user layer is pinned with
    // `-c core.attributesFile=/dev/null`.
    it('a user-global `-diff` attribute cannot change the scope hash', () => {
        const repo = initRepo();
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-attrs-'));
        tmpDirs.push(home);
        const attrs = path.join(home, 'attributes');
        fs.writeFileSync(attrs, '*.ts -diff\n', 'utf-8');
        const gitconfig = path.join(home, 'gitconfig');
        fs.writeFileSync(gitconfig, `[core]\n\tattributesFile = ${attrs}\n`, 'utf-8');
        const hostile = { GIT_CONFIG_GLOBAL: gitconfig };

        // Control — the failure demonstrated, not merely asserted: without the
        // pin the branch's own `src/foo.ts` diffs as binary.
        const unpinned = gitWithEnv(
            repo,
            ['diff', '--no-ext-diff', '--no-textconv', '--no-color', 'main...HEAD', '--', ':/'],
            hostile,
        );
        expect(unpinned).toContain('Binary files');

        // The pinned scope argv is immune to that same user config.
        const clean = computeReviewScope((a) => git(repo, ...a), 'main');
        const underHostileConfig = computeReviewScope((a) => gitWithEnv(repo, a, hostile), 'main');
        expect(underHostileConfig.diffText).not.toContain('Binary files');
        expect(underHostileConfig.hash).toBe(clean.hash);
        expect(REVIEW_SCOPE_GIT_CONFIG).toContain('core.attributesFile=/dev/null');
    });
});

/**
 * A `git` shim on PATH that tallies PATCH-diff invocations (one byte each).
 *
 * `--full-index` is the discriminator: it is in the patch flag set and absent
 * from the `--name-only` one, so `rev-parse` and file-list calls are not counted.
 */
function makeGitCounter(): { dir: string; counter: string } {
    const realGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
    expect(realGit, 'no git on PATH').not.toBe('');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-gitshim-'));
    tmpDirs.push(dir);
    const counter = path.join(dir, 'calls');
    fs.writeFileSync(counter, '', 'utf-8');
    fs.writeFileSync(
        path.join(dir, 'git'),
        [
            '#!/bin/sh',
            'seen_diff=0; seen_full=0',
            'for a in "$@"; do',
            '  [ "$a" = "diff" ] && seen_diff=1',
            '  [ "$a" = "--full-index" ] && seen_full=1',
            'done',
            'if [ "$seen_diff" = 1 ] && [ "$seen_full" = 1 ]; then printf x >> "$R2_GIT_COUNTER"; fi',
            `exec ${realGit} "$@"`,
            '',
        ].join('\n'),
        { mode: 0o755 },
    );
    return { dir, counter };
}

describe('dispatch_r2_reviewer — --verify-current scope reuse', () => {
    // Round-6 finding 4: the review scope is ONE whole-branch `git diff`
    // (~0.5 MB on a branch this size) and is identical for every artefact in a
    // pass, but runVerify re-derived it per artefact. Counting the patch-diff
    // invocations is the only observable proof that it is computed once.
    it.skipIf(process.platform === 'win32')('computes the review-scope diff once, not once per artefact', () => {
        const repo = initRepo();
        expect(run(dispatchArgs(repo)).status).toBe(0);

        const { dir: shimDir, counter } = makeGitCounter();
        // Dispatch above ran in its own process; only the verify run is counted.
        fs.writeFileSync(counter, '', 'utf-8');
        const res = spawnSync(TSX_BIN, [SCRIPT, '--verify-current', '--repo', repo, '--base', 'main'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${shimDir}${path.delimiter}${process.env.PATH ?? ''}`,
                R2_GIT_COUNTER: counter,
            },
        });
        expect(res.status, res.stderr).toBe(0);
        expect(res.stdout).toContain('1 relevant artefact(s) verified');
        // 1 = the single selection-time computation. 2 means runVerify re-derived
        // the diff it had already been handed.
        expect(fs.readFileSync(counter, 'utf-8').length).toBe(1);
    });
});

// CI regression: the branch env vars are a DETACHED-HEAD fallback, never an
// override. Env-first returned the workflow's branch for an explicitly passed
// foreign --repo, so the dispatcher wrote one slug while every later lookup
// asked for another — green locally (no such env), red on every CI shard.
describe('dispatch_r2_reviewer — slug source precedence', () => {
    const gitOn = (branch: string): ((a: readonly string[]) => string) =>
        (a) => (a.includes('--short') ? 'abc1234\n' : `${branch}\n`);

    it('git wins over a CI env var naming a different branch', () => {
        expect(
            deriveSlug(gitOn('feat/Test_Branch-1'), {
                GITHUB_HEAD_REF: 'feat/road-to-something-else',
                GITHUB_REF_NAME: 'feat/road-to-something-else',
            }),
        ).toBe('feat-test-branch-1');
    });

    it('the CI env still resolves a detached HEAD', () => {
        const detached = (a: readonly string[]): string => (a.includes('--short') ? 'abc1234\n' : 'HEAD\n');
        expect(deriveSlug(detached, { GITHUB_HEAD_REF: 'feat/Road-To-X' })).toBe('feat-road-to-x');
        expect(deriveSlug(detached, {})).toBe('detached-abc1234');
    });
});

describe('dispatch_r2_reviewer — a leftover artefact is classified, never silently replaced', () => {
    const manifestFor = (scopeHash: string): string =>
        deriveManifest({
            diffSha: 'deadbeef',
            scopeHash,
            roadmap: 'none',
            roadmapHash: 'none',
            acHash: 'none',
            dispatched: NOW,
        });

    it('classifies by the scope hash the review binds to', () => {
        const manifest = manifestFor('a'.repeat(64));
        expect(artefactStaleness(manifest, 'a'.repeat(64))).toBe('current');
        expect(artefactStaleness(manifest, 'b'.repeat(64))).toBe('stale');
        expect(artefactStaleness('no manifest here', 'a'.repeat(64))).toBe('unreadable');
    });

    // The refusal must route to contract §2.7, whose two paths are re-bind in
    // place and archive-once-terminal. It must NOT invent a third one: an
    // auto-rename would leave the shipping content with no review (the §2.7
    // `missing-artifact` case) and would also miss `check_review_dispositions`,
    // which recognises an archived record by `-review.md`.
    it('a stale artefact routes to the two contract paths, not to a fresh skeleton', () => {
        const text = leftoverArtefactRefusal(
            'agents/evidence/reviews/x.findings.md',
            'stale',
            'a'.repeat(64),
            'b'.repeat(64),
        );
        expect(text).toContain('RE-BIND IN PLACE');
        expect(text).toContain('round<N>-review.md');
        expect(text).toContain('check_review_dispositions');
        expect(text).toContain('destroys the record');
    });

    it('names the live-review case differently from the stale one', () => {
        const current = leftoverArtefactRefusal('x.findings.md', 'current', '', 'b'.repeat(64));
        expect(current).toContain('LIVE review');
        expect(current).not.toContain('RE-BIND IN PLACE');
    });

    it('refuses an unidentifiable artefact without claiming it is superseded', () => {
        const text = leftoverArtefactRefusal('x.findings.md', 'unreadable', '', 'b'.repeat(64));
        expect(text).toContain('cannot be identified as superseded');
        expect(text).not.toContain('RE-BIND IN PLACE');
    });

    it('re-dispatch after the scope moved refuses and names the re-bind path', () => {
        const repo = initRepo();
        expect(run(dispatchArgs(repo)).status).toBe(0);
        const findings = path.join(repo, OUT, `${SLUG}.findings.md`);
        const firstScope = parseManifest(fs.readFileSync(findings, 'utf-8'))!.scope_hash;

        // A revision moves the review scope — the normal §2.7 re-bind case.
        write(repo, 'src/foo.ts', 'export const x = 2;\n');
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'fix: revise foo');

        const second = run(dispatchArgs(repo));
        expect(second.status).toBe(1);
        expect(second.stderr).toContain('RE-BIND IN PLACE');

        // The artefact is untouched — no rename, no overwrite.
        expect(parseManifest(fs.readFileSync(findings, 'utf-8'))!.scope_hash).toBe(firstScope);
        expect(fs.readdirSync(path.join(repo, OUT)).filter((n) => n.includes('superseded'))).toEqual(
            [],
        );
    });

    it('re-dispatch on an UNCHANGED scope says the artefact is the live review', () => {
        const repo = initRepo();
        expect(run(dispatchArgs(repo)).status).toBe(0);
        const again = run(dispatchArgs(repo));
        expect(again.status).toBe(1);
        expect(again.stderr).toContain('LIVE review');
    });

    it('an unreadable artefact is refused rather than replaced on a guess', () => {
        const repo = initRepo();
        expect(run(dispatchArgs(repo)).status).toBe(0);
        write(repo, path.join(OUT, `${SLUG}.findings.md`), 'no manifest at all\n');
        const again = run(dispatchArgs(repo));
        expect(again.status).toBe(1);
        expect(again.stderr).toContain('cannot be identified as superseded');
    });
});

describe('extractAcceptanceCriteria — over the REAL active tree, not a fixture', () => {
    it('leaves no active roadmap that declares criteria with an empty extraction', () => {
        // The regression net this function has needed three times now: case
        // sensitivity (2026-08-09), the inline form, and a heading carrying a
        // trailing qualifier — each found only after an artefact had already
        // shipped claiming an extraction it did not have. Every fixture in this
        // file tests a shape someone thought of; this one tests the shapes
        // actually in the tree, so the NEXT unrecognised form fails here instead
        // of silently blinding a reviewer.
        //
        // Deliberately not a count: a count would need updating on every roadmap
        // added, and would then be edited rather than read. The invariant is
        // "declares ⇒ extracts", which holds at any population size.
        const dir = path.join(REPO_ROOT, 'agents', 'roadmaps');
        const blind: string[] = [];
        let declaring = 0;
        let scanned = 0;
        for (const name of fs.readdirSync(dir)) {
            if (!name.endsWith('.md')) continue;
            scanned += 1;
            const text = fs.readFileSync(path.join(dir, name), 'utf-8');
            // Detected independently of the extractor, so this cannot pass by the
            // extractor and the detector sharing a blind spot — the failure mode
            // the trailing-qualifier heading demonstrated, where the census that
            // motivated the fix had counted the misses as "declares none".
            const declares = /^##\s+acceptance criteria\b/im.test(text) || /^\s*[-*]\s+\*\*AC-/m.test(text);
            if (!declares) continue;
            declaring += 1;
            if (!hasAcceptanceCriteria(extractAcceptanceCriteria(text))) blind.push(name);
        }
        // Vacuity guard: a moved roadmaps root would make the loop assert nothing.
        // Tied to the corpus rather than a pinned count. The floor used to be
        // `declaring > 10`, chosen when the active estate was large; archival
        // shrinks that estate (26 -> 14 active over the 2026-08-21 PR drain) and
        // the constant reached exactly 10, failing for a reason unrelated to a
        // moved root. `scanned` proves the root is real; `declaring` proves the
        // loop had something to assert over.
        expect(scanned).toBeGreaterThan(5);
        expect(declaring).toBeGreaterThan(0);
        expect(blind).toEqual([]);
    });
});
