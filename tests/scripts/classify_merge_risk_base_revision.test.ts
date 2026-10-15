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
