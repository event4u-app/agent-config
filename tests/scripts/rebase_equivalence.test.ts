/**
 * The equivalence report after a rebase, read from stable patch ids.
 *
 * `git range-diff` says under OUTPUT STABILITY that its output is not meant for
 * machines; `git patch-id --stable` is stable by its own manual. So the verdict
 * comes from patch-id sets, and a conflict resolution — which changes a patch
 * id — yields "needs review", never "wrong" and never a pair guessed from a
 * subject line.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runBlocks, sandbox, sequenceBlock, type Sandbox } from '../_lib/rebase_sequence.js';

const RESOLVE_AND_REBASE = ['resolve', 'rebase'].map((b) => sequenceBlock(b)).join('\n');
const EQUIVALENCE = sequenceBlock('equivalence');

const roots: string[] = [];
afterEach(() => {
    for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

interface Repo { sb: Sandbox; me: string; seed: string }

function repo(): Repo {
    const sb = sandbox();
    roots.push(sb.root);
    const origin = path.join(sb.root, 'origin.git');
    fs.mkdirSync(origin);
    sb.git(origin, 'init', '-q', '--bare', '-b', 'main');
    const seed = path.join(sb.root, 'seed');
    sb.git(sb.root, 'clone', '-q', origin, seed);
    sb.commit(seed, 'shared.txt', 'one\n', 'base');
    sb.git(seed, 'push', '-q', 'origin', 'main');
    const me = path.join(sb.root, 'me');
    sb.git(sb.root, 'clone', '-q', origin, me);
    sb.git(me, 'switch', '-q', '-c', 'feat', 'origin/main');
    return { sb, me, seed };
}

function advanceBase(r: Repo, file: string, content: string): void {
    r.sb.commit(r.seed, file, content, `base: ${file}`);
    r.sb.git(r.seed, 'push', '-q', 'origin', 'main');
}

const savedRef = (stderr: string): string => {
    const m = stderr.match(/SAVE=(refs\/agent-config\/rewrites\/\S+\/before)/);
    if (!m) throw new Error(`no SAVE in: ${stderr}`);
    return m[1] ?? '';
};

describe('the equivalence verdict', () => {
    it('reports "mechanically equivalent" when every patch id carries over', () => {
        const r = repo();
        r.sb.commit(r.me, 'a.txt', 'a\n', 'add a');
        r.sb.commit(r.me, 'b.txt', 'b\n', 'add b');
        r.sb.git(r.me, 'push', '-q', '-u', 'origin', 'feat');
        advanceBase(r, 'elsewhere.txt', 'x\n');
        const out = runBlocks(r.sb, r.me, `${RESOLVE_AND_REBASE}\n${EQUIVALENCE}`, { BASE: 'main' });
        expect(out.stderr).not.toContain('STOP');
        expect(out.stdout).toContain('EQUIVALENCE: mechanically equivalent');
        expect(out.stdout).not.toContain('needs review');
    });

    it('reports "needs review" and names the commits when a conflict resolution changed one', () => {
        const r = repo();
        r.sb.commit(r.me, 'untouched.txt', 'u\n', 'untouched');
        r.sb.commit(r.me, 'shared.txt', 'feature\n', 'edit shared');
        r.sb.git(r.me, 'push', '-q', '-u', 'origin', 'feat');
        advanceBase(r, 'shared.txt', 'base moved\n');

        const first = runBlocks(r.sb, r.me, RESOLVE_AND_REBASE, { BASE: 'main' });
        expect(first.status).not.toBe(0);
        expect(first.stderr).toContain('stopped on a conflict');
        const save = savedRef(first.stderr);

        fs.writeFileSync(path.join(r.me, 'shared.txt'), 'base moved\nfeature\n');
        r.sb.git(r.me, 'add', 'shared.txt');
        runBlocks(r.sb, r.me, 'GIT_EDITOR=true git rebase --continue');

        const oldEdit = r.sb.git(r.me, 'rev-parse', '--short', `${save}`);
        const newEdit = r.sb.git(r.me, 'rev-parse', '--short', 'HEAD');
        const untouchedNew = r.sb.git(r.me, 'rev-parse', '--short', 'HEAD~1');

        // The documented resume: step 1 again in the same shell, then step 3 with SAVE set.
        const out = runBlocks(r.sb, r.me, `${sequenceBlock('resolve')}\n${EQUIVALENCE}`, { BASE: 'main', SAVE: save });
        expect(out.stdout).toContain('EQUIVALENCE: needs review');
        expect(out.stdout).not.toContain('mechanically equivalent');
        // The same subject on both sides is never taken as a pair: both commits are named.
        expect(out.stdout).toContain(`before: ${oldEdit} edit shared`);
        expect(out.stdout).toContain(`after:  ${newEdit} edit shared`);
        const named = out.stdout.split('\n').filter((l) => /^ {2}(before|after):/.test(l));
        expect(named).toHaveLength(2);
        expect(named.join('\n')).not.toContain(untouchedNew);
    });

    it('checks tree equality when the old head already contained the base', () => {
        const r = repo();
        r.sb.commit(r.me, 'a.txt', 'a\n', 'add a');
        r.sb.git(r.me, 'push', '-q', '-u', 'origin', 'feat');
        const out = runBlocks(r.sb, r.me, `${RESOLVE_AND_REBASE}\n${EQUIVALENCE}`, { BASE: 'main' });
        expect(out.stdout).toContain('EQUIVALENCE: mechanically equivalent');
        expect(EQUIVALENCE).toMatch(/merge-base --is-ancestor "origin\/\$BASE" "\$SAVE"/);
        expect(EQUIVALENCE).toContain('^{tree}');
    });
});

describe('range-diff is shown, never parsed', () => {
    it('reaches the human but feeds no decision', () => {
        expect(EQUIVALENCE).toContain('git range-diff');
        for (const line of EQUIVALENCE.split('\n').filter((l) => l.includes('range-diff') && !l.trimStart().startsWith('#'))) {
            expect(line).not.toMatch(/\$\(\s*git range-diff/);
            expect(line).not.toMatch(/git range-diff[^#]*\|/);
        }
        const verdictAt = EQUIVALENCE.indexOf('echo "EQUIVALENCE:');
        const rangeDiffAt = EQUIVALENCE.indexOf('git range-diff');
        expect(verdictAt).toBeGreaterThan(-1);
        expect(rangeDiffAt).toBeGreaterThan(verdictAt);
    });
});
