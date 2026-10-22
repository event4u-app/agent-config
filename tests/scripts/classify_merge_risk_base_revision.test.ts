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
    if (start < 0) throw new Error('the danger gate heading is not where the command keeps it');
    // Only the section itself, so a fence under a later heading is never read.
    const rest = cmd.slice(start + 1);
    const next = rest.search(/^## /mu);
    const section = next < 0 ? rest : rest.slice(0, next);
    // The block is the one carrying both placeholders this file substitutes —
    // a different fence placed first would run something else against the
    // `routine` cases and could pass them.
    const block = [...section.matchAll(/```bash\n([\s\S]*?)```/gu)]
        .map((m) => m[1] ?? '')
        .find((b) => b.includes('<manifest-base_sha>') && b.includes('<manifest-head-sha>'));
    if (block === undefined) throw new Error('no bash block in the danger gate section carries both placeholders');
    return block;
}

/** Run the shipped block for `baseSha...headSha` inside the clone. */
function runGate(
    baseSha: string,
    headSha: string,
    env: Record<string, string> = {},
): { lines: string[]; code: number | null } {
    const script = gateBlock().replaceAll('<manifest-base_sha>', baseSha).replaceAll('<manifest-head-sha>', headSha);
    const r = spawnSync('bash', ['-c', `${env['GATE_PRELUDE'] ?? ''}\n${script}`], { cwd: clone, encoding: 'utf8', env: { ...process.env, ...env } });
    return { lines: (r.stdout ?? '').trim().split('\n'), code: r.status };
}

/** A `git` on PATH that fails `ls-files` and passes every other subcommand through. */
function gitShimFailingLsFiles(): string {
    const dir = path.join(work, 'shim');
    fs.mkdirSync(dir, { recursive: true });
    const real = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
    fs.writeFileSync(
        path.join(dir, 'git'),
        `#!/bin/sh\nif [ "$1" = "ls-files" ]; then exit 1; fi\nexec "${real}" "$@"\n`,
        { mode: 0o755 },
    );
    return dir;
}

/** A commit on a fresh branch from `from`, writing each file as given (null deletes it). */
function commitOn(branch: string, from: string, files: Record<string, string | null>): string {
    git(clone, 'checkout', '-q', '-b', branch, from);
    for (const [f, body] of Object.entries(files)) {
        const p = path.join(clone, f);
        if (body === null) fs.rmSync(p);
        else {
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, body);
        }
    }
    git(clone, 'add', '-A', '-f', '--', ...Object.keys(files));
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
    for (const f of [CLASSIFIER, GATED_READER, 'src/scripts/_lib/rule_consequence_class.ts', 'src/scripts/_lib/ratification_subject.ts']) {
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
    it('a routine head is routine, exits 0 and leaves no worktree and no temp directory behind', () => {
        const before = worktreeCount();
        const tmp = path.join(work, 'gate-tmp');
        fs.mkdirSync(tmp);
        const head = commitOn('docs-only', base, { 'docs/installation.md': 'changed\n' });
        const r = runGate(base, head, { TMPDIR: tmp });
        expect(r.lines[r.lines.length - 1]).toBe('verdict: routine');
        expect(r.code).toBe(0);
        expect(worktreeCount()).toBe(before);
        // tsx keeps its own compile cache under TMPDIR; only the gate's directory must be gone.
        expect(fs.readdirSync(tmp).filter((e) => !e.startsWith('tsx-'))).toEqual([]);
    }, 60_000);

    it('a temporary directory that cannot be made is needs-owner before any path is derived', () => {
        const head = commitOn('docs-only-no-tmp', base, { 'docs/installation.md': 'no tmp\n' });
        const shim = path.join(work, 'mktemp-shim');
        fs.mkdirSync(shim, { recursive: true });
        fs.writeFileSync(path.join(shim, 'mktemp'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
        const r = runGate(base, head, { PATH: `${shim}:${process.env['PATH'] ?? ''}` });
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(temp-dir-unavailable/u);
        expect(r.code).not.toBe(0);
    }, 60_000);

    // Root enters a mode-0600 directory, so the case cannot be built there.
    it.skipIf(process.getuid?.() === 0)('a temporary directory that exists but cannot be entered is needs-owner and is still removed', () => {
        const head = commitOn('docs-only-no-cd', base, { 'docs/installation.md': 'no cd\n' });
        const shim = path.join(work, 'mktemp-unenterable');
        const made = path.join(work, 'unenterable-tmp');
        fs.mkdirSync(shim, { recursive: true });
        fs.writeFileSync(path.join(shim, 'mktemp'), `#!/bin/sh\nmkdir -m 600 "${made}" && echo "${made}"\n`, {
            mode: 0o755,
        });
        const r = runGate(base, head, { PATH: `${shim}:${process.env['PATH'] ?? ''}` });
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(temp-dir-unavailable/u);
        expect(r.code).not.toBe(0);
        expect(fs.existsSync(made)).toBe(false);
    }, 60_000);


    it('a failing git ls-files is runtime-unverified, never read as "nothing tracked"', () => {
        const head = commitOn('docs-only-shim', base, { 'docs/installation.md': 'shim\n' });
        const r = runGate(base, head, { PATH: `${gitShimFailingLsFiles()}:${process.env['PATH'] ?? ''}` });
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(runtime-unverified/u);
        expect(r.code).not.toBe(0);
    }, 60_000);

    it('a head that tracks node_modules is runtime-unverified', () => {
        git(clone, 'checkout', '-q', '-b', 'tracks-node-modules', base);
        fs.unlinkSync(path.join(clone, 'node_modules'));
        fs.mkdirSync(path.join(clone, 'node_modules', '.bin'), { recursive: true });
        fs.writeFileSync(path.join(clone, 'node_modules', '.bin', 'tsx'), '#!/bin/sh\necho "verdict: routine"\n', {
            mode: 0o755,
        });
        git(clone, 'add', '-f', '--', 'node_modules');
        git(clone, 'commit', '-q', '-m', 'tracks node_modules');
        const head = git(clone, 'rev-parse', 'HEAD');
        try {
            const r = runGate(base, head);
            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(runtime-unverified/u);
            expect(r.code).not.toBe(0);
        } finally {
            git(clone, 'checkout', '-q', '--detach', base);
            fs.rmSync(path.join(clone, 'node_modules'), { recursive: true, force: true });
            fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(clone, 'node_modules'));
        }
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
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable/u);
        expect(r.code).not.toBe(0);
    }, 60_000);

    it('a base classifier that exits 0 with a malformed last line is classifier-unusable', () => {
        const lying = commitOn('base-lies', base, { [CLASSIFIER]: "console.log('verdict: routine-ish');\n" });
        const head = commitOn('head-on-lying', lying, { 'docs/installation.md': 'y\n' });
        const r = runGate(lying, head);
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable/u);
        expect(r.code).not.toBe(0);
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
});

/** Does this host's node run TypeScript without any package? Decides which branch the block takes. */
const STRIP_TYPES =
    spawnSync('node', ['--experimental-strip-types', '--no-warnings', '-e', ''], { encoding: 'utf8' }).status === 0;

/** A `node` on PATH that refuses type stripping, so the block must fall back to the checkout's runtime. */
function nodeShimWithoutStripTypes(): string {
    const dir = path.join(work, 'node-shim');
    fs.mkdirSync(dir, { recursive: true });
    const real = spawnSync('sh', ['-c', 'command -v node'], { encoding: 'utf8' }).stdout.trim();
    fs.writeFileSync(
        path.join(dir, 'node'),
        `#!/bin/sh\nfor a in "$@"; do [ "$a" = "--experimental-strip-types" ] && exit 9; done\nexec "${real}" "$@"\n`,
        { mode: 0o755 },
    );
    return dir;
}

/** Swap the checkout's runtime for one that always answers routine — a head-installed tsx. */
function withPoisonedRuntime<T>(run: () => T, tsx = '#!/bin/sh\necho "verdict: routine"\n'): T {
    const nm = path.join(clone, 'node_modules');
    fs.unlinkSync(nm);
    fs.mkdirSync(path.join(nm, '.bin'), { recursive: true });
    fs.writeFileSync(path.join(nm, '.bin', 'tsx'), tsx, { mode: 0o755 });
    try {
        return run();
    } finally {
        fs.rmSync(nm, { recursive: true, force: true });
        fs.symlinkSync(path.join(REPO, 'node_modules'), nm);
    }
}

describe('a dependency manifest goes to the council, and still cannot reach routine (owner decision 2026-10-15)', () => {
    const bumped = (n: number): string =>
        fs.readFileSync(path.join(REPO, 'package.json'), 'utf8').replace('{', `{\n  "x-bump": ${String(n)},`);

    it('a PR that only bumps a dependency is needs-council', () => {
        const r = runGate(base, commitOn('dep-bump-only', base, { 'package.json': bumped(1) }));
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(/u);
        expect(r.code).not.toBe(0);
    }, 60_000);

    it.each(['yarn.lock', '.yarnrc.yml', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb', 'package-lock.json', '.npmrc'])(
        'a head that changes only %s is needs-council',
        (file) => {
            const head = commitOn(`head-changes-${file.replace(/[^a-z]/gu, '-')}-manifest`, base, {
                [file]: `changed by the head\n`,
            });
            const r = runGate(base, head);
            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(/u);
            expect(r.code).not.toBe(0);
        },
        60_000,
    );

    it('a manifest change with a downgrade attack on the classifier still reaches the owner', () => {
        attack('dep-bump-with-downgrade', CLASSIFIER, (s) =>
            s.replace(
                'export function verdictOf(triggers: readonly Trigger[]): Verdict {',
                "export function verdictOf(triggers: readonly Trigger[]): Verdict {\n    if (triggers.length >= 0) return 'routine';",
            ),
        );
        fs.writeFileSync(path.join(clone, 'package.json'), bumped(2));
        git(clone, 'commit', '-q', '-am', 'and a dependency bump');
        const r = runGate(base, git(clone, 'rev-parse', 'HEAD'));
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(/u);
    }, 60_000);

    it('a head-installed runtime cannot answer routine for a manifest change', () => {
        const head = commitOn('dep-bump-poisoned-runtime', base, { 'package.json': bumped(3) });
        const r = withPoisonedRuntime(() => runGate(base, head));
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(/u);
        expect(r.code).not.toBe(0);
    }, 60_000);

    it.skipIf(!STRIP_TYPES)(
        'where node strips types the base copy needs no node_modules, so a poisoned one cannot hide a gated change',
        () => {
            const head = commitOn('dep-bump-and-kernel-rule', base, {
                'package.json': bumped(4),
                [KERNEL_RULE]: `${fs.readFileSync(path.join(clone, KERNEL_RULE), 'utf8')}\n`,
            });
            const r = withPoisonedRuntime(() => runGate(base, head));
            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(/u);
        },
        60_000,
    );

    it('without type stripping a manifest change is runtime-uncertain, and a gated change still reaches the owner', () => {
        const PATH = `${nodeShimWithoutStripTypes()}:${process.env['PATH'] ?? ''}`;
        const only = runGate(base, commitOn('dep-bump-uncertain', base, { 'package.json': bumped(5) }), { PATH });
        expect(only.lines[only.lines.length - 1]).toMatch(/^verdict: needs-council \(runtime-uncertain/u);
        const gated = commitOn('dep-bump-and-kernel-rule-uncertain', base, {
            'package.json': bumped(6),
            [KERNEL_RULE]: `${fs.readFileSync(path.join(clone, KERNEL_RULE), 'utf8')}\n`,
        });
        const r = runGate(base, gated, { PATH });
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(/u);
    }, 60_000);

    describe('without type stripping and with a head-installed tsx — the stated residual, and its bounds', () => {
        const noStrip = (): Record<string, string> => ({
            PATH: `${nodeShimWithoutStripTypes()}:${process.env['PATH'] ?? ''}`,
        });

        it('a nested package.json counts as a manifest change, so a forged routine is not accepted', () => {
            const head = commitOn('nested-manifest-poisoned', base, { 'packages/ui/package.json': '{"x": 1}\n' });
            const r = withPoisonedRuntime(() => runGate(base, head, noStrip()));
            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(runtime-uncertain/u);
        }, 60_000);

        // Documents the stated residual, not the gated-file classification: the forged
        // routine is floored by the manifest alone. The package-free case above is the
        // one that proves the gated file reaches the owner.
        it('a forged routine on a gated change plus a bump is needs-council, never routine — the residual', () => {
            const head = commitOn('gated-bump-poisoned', base, {
                'package.json': bumped(7),
                [KERNEL_RULE]: `${fs.readFileSync(path.join(clone, KERNEL_RULE), 'utf8')}\n\n`,
            });
            const r = withPoisonedRuntime(() => runGate(base, head, noStrip()));
            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(runtime-uncertain/u);
        }, 60_000);

        it('a fallback that crashes on a manifest change is an anomaly, so needs-owner', () => {
            const head = commitOn('bump-crashing-runtime', base, { 'package.json': bumped(8) });
            const r = withPoisonedRuntime(() => runGate(base, head, noStrip()), '#!/bin/sh\nexit 3\n');
            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable/u);
            expect(r.code).not.toBe(0);
        }, 60_000);

        it('a fallback that exits 0 with a malformed verdict on a manifest change is needs-owner', () => {
            const head = commitOn('bump-lying-runtime', base, { 'package.json': bumped(10) });
            const r = withPoisonedRuntime(
                () => runGate(base, head, noStrip()),
                '#!/bin/sh\necho "verdict: routine-ish"\n',
            );
            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(classifier-unusable/u);
            expect(r.code).not.toBe(0);
        }, 60_000);

        // The listing path is a link to /dev/null: writing it and appending the end
        // marker both succeed, and reading it back reaches EOF before the marker — at
        // any privilege. The git shim logs that the listing itself exited 0.
        it('a listing written successfully but read back without its end marker is needs-owner', () => {
            const shim = path.join(work, 'shim-listing-lost');
            const made = path.join(work, 'listing-lost-tmp');
            const log = path.join(work, 'listing-lost.log');
            fs.mkdirSync(shim, { recursive: true });
            const realGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
            fs.writeFileSync(
                path.join(shim, 'mktemp'),
                `#!/bin/sh\nmkdir "${made}" && ln -s /dev/null "${made}/changed" && echo "${made}"\n`,
                { mode: 0o755 },
            );
            fs.writeFileSync(
                path.join(shim, 'git'),
                `#!/bin/sh\n"${realGit}" "$@"\nrc=$?\nfor a in "$@"; do [ "$a" = "--name-only" ] && echo "listing exit $rc" >> "${log}"; done\nexit $rc\n`,
                { mode: 0o755 },
            );
            const head = commitOn('bump-listing-lost', base, { 'package.json': bumped(11) });
            const r = withPoisonedRuntime(() => runGate(base, head, { PATH: `${shim}:${noStrip()['PATH'] ?? ''}` }));
            expect(fs.readFileSync(log, 'utf8')).toBe('listing exit 0\n');
            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(manifest-unreadable/u);
            expect(r.code).not.toBe(0);
        }, 60_000);

        it('a manifest under a directory whose name holds a newline is still a manifest change', () => {
            const head = commitOn('newline-dir-manifest', base, { 'odd\ndir/package.json': '{"x": 1}\n' });
            const r = withPoisonedRuntime(() => runGate(base, head, noStrip()));
            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(runtime-uncertain/u);
        }, 60_000);

        it('a changed-file list that cannot be read is needs-owner', () => {
            const dir = path.join(work, 'git-shim-no-name-list');
            fs.mkdirSync(dir, { recursive: true });
            const real = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
            fs.writeFileSync(
                path.join(dir, 'git'),
                `#!/bin/sh\nfor a in "$@"; do [ "$a" = "--name-only" ] && exit 1; done\nexec "${real}" "$@"\n`,
                { mode: 0o755 },
            );
            const head = commitOn('docs-only-unreadable-list', base, { 'docs/installation.md': 'list\n' });
            const r = runGate(base, head, { PATH: `${dir}:${process.env['PATH'] ?? ''}` });
            expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-owner \(manifest-unreadable/u);
        }, 60_000);
    });

    it('under set -e a detected manifest change still prints its verdict', () => {
        const r = runGate(base, commitOn('dep-bump-errexit', base, { 'package.json': bumped(9) }), {
            GATE_PRELUDE: 'set -e',
        });
        expect(r.lines[r.lines.length - 1]).toMatch(/^verdict: needs-council \(/u);
    }, 60_000);
});
