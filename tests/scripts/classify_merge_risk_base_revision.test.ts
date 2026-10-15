import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The downgrade attack § 9a's base-revision run exists to stop: a head that
 * rewrites the classifier, or the gated-set reader it imports, so that its own
 * copy calls the change `routine`. Run from the head the attack works; run from
 * the base with `--root` on the head it does not. Both halves are asserted —
 * the head half proves the fixture is a real attack, not a diff the head copy
 * would have flagged anyway.
 *
 * The repository is a `--shared` clone of this one, so the real classifier and
 * its real import closure judge. The base commit carries the working tree's
 * classifier, so the test exercises the code under review, not the last commit.
 */

const REPO = path.resolve(__dirname, '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
const CLASSIFIER = 'src/scripts/classify_merge_risk.ts';
const GATED_READER = 'src/scripts/check_kernel_edit_ratified.ts';
const KERNEL_RULE = 'src/rules/non-destructive-by-default.md';

let work = '';
let clone = '';
let base = '';

function git(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr ?? ''}`);
    return r.stdout.trim();
}

/** The last line the classifier prints, run from `copyRoot`, judging `clone`. */
function verdictFrom(copyRoot: string, head: string): string {
    const r = spawnSync(TSX, [path.join(copyRoot, CLASSIFIER), '--range', `${base}...${head}`, '--root', clone], {
        cwd: clone,
        encoding: 'utf8',
    });
    const lines = (r.stdout ?? '').trim().split('\n');
    return lines[lines.length - 1] ?? '';
}

/** A head commit on a fresh branch from base: `edit` rewrites one file, and a kernel rule is touched. */
function attack(branch: string, file: string, edit: (src: string) => string): string {
    git(clone, 'checkout', '-q', '-b', branch, base);
    const p = path.join(clone, file);
    const before = fs.readFileSync(p, 'utf8');
    const after = edit(before);
    if (after === before) throw new Error(`the attack on ${file} changed nothing — the anchor moved`);
    fs.writeFileSync(p, after);
    fs.appendFileSync(path.join(clone, KERNEL_RULE), '\n');
    git(clone, 'commit', '-q', '-am', branch);
    return git(clone, 'rev-parse', 'HEAD');
}

/** The danger gate's shell block, exactly as the merge command ships it. */
function gateBlock(): string {
    const cmd = fs.readFileSync(path.join(REPO, 'src/domains/git/pr/merge/command.md'), 'utf8');
    const start = cmd.indexOf('## 9a. Danger gate');
    const m = /```bash\n([\s\S]*?)```/u.exec(cmd.slice(start));
    if (start < 0 || m === null) throw new Error('the danger gate block is not where the command keeps it');
    return m[1] ?? '';
}

/** Run the shipped block for `baseSha...headSha` inside the clone. */
function runGate(baseSha: string, headSha: string): { lines: string[]; code: number | null } {
    const script = gateBlock().replaceAll('<manifest-base_sha>', baseSha).replaceAll('<manifest-head-sha>', headSha);
    const r = spawnSync('bash', ['-c', script], { cwd: clone, encoding: 'utf8' });
    return { lines: (r.stdout ?? '').trim().split('\n'), code: r.status };
}

/** A commit on a fresh branch from `from`, writing each file as given (null deletes it). */
function commitOn(branch: string, from: string, files: Record<string, string | null>): string {
    git(clone, 'checkout', '-q', '-b', branch, from);
    for (const [f, body] of Object.entries(files)) {
        const p = path.join(clone, f);
        if (body === null) fs.rmSync(p);
        else fs.writeFileSync(p, body);
    }
    git(clone, 'add', '-A', '--', ...Object.keys(files));
    git(clone, 'commit', '-q', '-m', branch);
    return git(clone, 'rev-parse', 'HEAD');
}

const worktreeCount = (): number => git(clone, 'worktree', 'list').split('\n').length;

beforeAll(() => {
    // realpath: on macOS the tmpdir is a symlink, and the classifier's main guard compares real paths.
    work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cmr-base-')));
    clone = path.join(work, 'repo');
    git(work, 'clone', '-q', '--shared', REPO, clone);
    git(clone, 'config', 'user.email', 't@example.com');
    git(clone, 'config', 'user.name', 'T');
    for (const f of [CLASSIFIER, GATED_READER, 'src/scripts/_lib/rule_consequence_class.ts']) {
        fs.copyFileSync(path.join(REPO, f), path.join(clone, f));
    }
    git(clone, 'add', '-A');
    git(clone, 'commit', '-q', '--allow-empty', '-m', 'base: the classifier under review');
    base = git(clone, 'rev-parse', 'HEAD');
    git(clone, 'worktree', 'add', '-q', '--detach', path.join(work, 'base'), base);
    // The shipped block runs the checkout's tsx; the clone borrows this repository's.
    fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(clone, 'node_modules'));
}, 60_000);

afterAll(() => {
    if (work !== '') fs.rmSync(work, { recursive: true, force: true });
});

describe('the code that classes a change is not the change’s own', () => {
    it('a head that makes the classifier answer routine is caught by the base copy', () => {
        const head = attack('downgrade-verdict', CLASSIFIER, (s) =>
            s.replace(
                'export function verdictOf(triggers: readonly Trigger[]): Verdict {',
                "export function verdictOf(triggers: readonly Trigger[]): Verdict {\n    if (triggers.length >= 0) return 'routine';",
            ),
        );
        expect(verdictFrom(clone, head)).toBe('verdict: routine');
        expect(verdictFrom(path.join(work, 'base'), head)).toMatch(/^verdict: needs-owner/u);
    }, 60_000);

    it('a head that narrows classifyPaths so the kernel rule falls out is caught by the base copy', () => {
        const head = attack('narrow-gated-set', GATED_READER, (s) =>
            s.replace(
                '): GatedPaths {\n    const derivedSet',
                '): GatedPaths {\n    if (files.length >= 0) return { kernelRules: [], governanceHooks: [], plumbing: [], self: false };\n    const derivedSet',
            ),
        );
        expect(verdictFrom(clone, head)).toBe('verdict: routine');
        expect(verdictFrom(path.join(work, 'base'), head)).toMatch(/^verdict: needs-owner/u);
    }, 60_000);
});

describe('the shipped block fails to needs-owner on every anomaly', () => {
    it('a routine head is routine, exits 0 and leaves no worktree behind', () => {
        const before = worktreeCount();
        const head = commitOn('docs-only', base, { 'docs/installation.md': 'changed\n' });
        const r = runGate(base, head);
        expect(r.lines[r.lines.length - 1]).toBe('verdict: routine');
        expect(r.code).toBe(0);
        expect(worktreeCount()).toBe(before);
    }, 60_000);

    it('the downgrade attack run through the block is needs-owner and exits non-zero', () => {
        const head = attack('downgrade-via-block', CLASSIFIER, (s) =>
            s.replace(
                'export function verdictOf(triggers: readonly Trigger[]): Verdict {',
                "export function verdictOf(triggers: readonly Trigger[]): Verdict {\n    if (triggers.length >= 0) return 'routine';",
            ),
        );
        const r = runGate(base, head);
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(/u);
        expect(r.code).not.toBe(0);
    }, 60_000);

    it('a base classifier that crashes is classifier-unusable', () => {
        const crashing = commitOn('base-crashes', base, { [CLASSIFIER]: 'process.exit(3);\n' });
        const head = commitOn('head-on-crashing', crashing, { 'docs/installation.md': 'x\n' });
        const r = runGate(crashing, head);
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable: exit 3/u);
        expect(r.code).not.toBe(0);
    }, 60_000);

    it('a base classifier that exits 0 with a malformed last line is classifier-unusable', () => {
        const lying = commitOn('base-lies', base, { [CLASSIFIER]: "console.log('verdict: routine-ish');\n" });
        const head = commitOn('head-on-lying', lying, { 'docs/installation.md': 'y\n' });
        const r = runGate(lying, head);
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable: exit 0/u);
    }, 60_000);

    it('a base without the classifier is base-unavailable, never the head copy', () => {
        const bare = commitOn('base-without-classifier', base, { [CLASSIFIER]: null });
        const head = commitOn('head-restores-classifier', bare, {
            [CLASSIFIER]: fs.readFileSync(path.join(REPO, CLASSIFIER), 'utf8'),
        });
        const r = runGate(bare, head);
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(base-unavailable/u);
        expect(r.code).not.toBe(0);
    }, 60_000);

    it('a head that changes the manifest tsx was installed from is runtime-unverified', () => {
        const pkg = fs.readFileSync(path.join(clone, 'package.json'), 'utf8');
        const head = commitOn('head-changes-package', base, { 'package.json': pkg.replace('{', '{\n  "x": 1,') });
        const r = runGate(base, head);
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(runtime-unverified/u);
        expect(r.code).not.toBe(0);
    }, 60_000);
});
