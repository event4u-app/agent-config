// Gate R2 reviewer dispatcher (docs/contracts/plan-review-gates.md §5).
//
// Every case builds a throwaway git repo under mkdtemp — the dispatcher's
// `--out-dir` resolves against `--repo`, so nothing is ever written into the
// worktree. Covers: package + skeleton creation with recomputed sha256
// hashes, the exact §5 manifest block shape, refuse-overwrite without
// --force, empty-diff exit 1, --verify pass/fail (stale hash named),
// byte-identical determinism under a frozen --now, slug derivation from the
// branch name, and missing-base-ref exit 2.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import {
    deriveManifest,
    expectedHashes,
    extractAcceptanceCriteria,
    parseManifest,
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
            hashes: { diff_hash: string; roadmap_hash: string; ac_hash: string };
            files: Record<string, string | null>;
        };

        // Slug derivation from the branch name (sanitized kebab-case).
        expect(out.slug).toBe(SLUG);
        expect(out.head_sha).toBe(git(repo, 'rev-parse', 'HEAD').trim());

        // Recompute every hash independently in the test.
        const diff = git(repo, 'diff', 'main...HEAD');
        const ac = extractAcceptanceCriteria(ROADMAP);
        expect(ac).toBe(['## Acceptance Criteria', '', '- AC one', '- AC two', ''].join('\n'));
        expect(out.hashes.diff_hash).toBe(sha256(diff));
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
        const diff = git(repo, 'diff', 'main...HEAD');
        const ac = extractAcceptanceCriteria(ROADMAP);
        const body = fs.readFileSync(path.join(repo, OUT, `${SLUG}.findings.md`), 'utf-8');

        expect(body.startsWith(`# Findings: ${SLUG}\n`)).toBe(true);
        expect(body).toContain(
            `<!-- completion-review: v1 | reviewed: 2026-08-04 | diff: ${head} | reviewer: r2-fresh-subagent-${SLUG} -->`,
        );

        const expectedManifest = [
            '<!-- context-manifest: v1',
            'inputs:',
            `  diff_sha: ${head}`,
            `  diff_hash: ${sha256(diff)}`,
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
            diffHash: sha256(diff),
            roadmap: 'agents/roadmaps/road-x.md',
            roadmapHash: sha256(ROADMAP),
            acHash: sha256(ac),
            dispatched: NOW,
        })).toBe(expectedManifest);
        expect(parseManifest(body)).toEqual({
            diff_sha: head,
            diff_hash: sha256(diff),
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
    it('verifies an untouched artifact, then fails after a new commit naming the stale hashes', () => {
        const repo = initRepo();
        expect(run(dispatchArgs(repo)).status).toBe(0);
        const findings = path.join(repo, OUT, `${SLUG}.findings.md`);

        const pass = run(['--verify', findings, '--repo', repo, '--base', 'main']);
        expect(pass.status, pass.stderr).toBe(0);
        expect(pass.stdout).toContain('✅ manifest verified');

        // A push-after-review moves HEAD and the diff body → stale review.
        write(repo, 'src/foo.ts', 'export const x = 2;\n');
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'feat: bump');

        const fail = run(['--verify', findings, '--repo', repo, '--base', 'main']);
        expect(fail.status).toBe(1);
        expect(fail.stderr).toMatch(/manifest mismatch \(stale review\)/);
        expect(fail.stderr).toContain('diff_sha');
        expect(fail.stderr).toContain('diff_hash');
        expect(fail.stderr).not.toContain('roadmap_hash');
    });

    it('exits 2 when the findings file is missing or carries no manifest', () => {
        const repo = initRepo();
        const missing = run(['--verify', path.join(repo, 'nope.md'), '--repo', repo, '--base', 'main']);
        expect(missing.status).toBe(2);

        write(repo, 'no-manifest.md', '# Findings: x\nno manifest here\n');
        const unparsable = run(['--verify', path.join(repo, 'no-manifest.md'), '--repo', repo, '--base', 'main']);
        expect(unparsable.status).toBe(2);
        expect(unparsable.stderr).toMatch(/no context-manifest block/);
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

    it('expectedHashes maps null roadmap/AC to none', () => {
        const h = expectedHashes({ diffText: 'd', roadmapText: null, acText: null });
        expect(h.diff_hash).toBe(sha256('d'));
        expect(h.roadmap_hash).toBe('none');
        expect(h.ac_hash).toBe('none');
    });

    it('extractAcceptanceCriteria returns empty string when the section is absent', () => {
        expect(extractAcceptanceCriteria('# X\n\n## Phase 1\n- [ ] a\n')).toBe('');
    });
});
