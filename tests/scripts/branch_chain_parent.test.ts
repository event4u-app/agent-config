import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { recordParentFromReflog, recordedParent, recordedParentSha, reparentMerged } from '../../src/scripts/_lib/branch_parents.js';
import { makeGit, ownedBy } from '../../src/scripts/_lib/branch_chain_status.js';

const REPO = path.resolve(__dirname, '../..');
let root: string;
const env = (who: string) => ({ ...process.env, GIT_AUTHOR_NAME: who, GIT_AUTHOR_EMAIL: `${who}@example.com`, GIT_COMMITTER_NAME: who, GIT_COMMITTER_EMAIL: `${who}@example.com` });
const git = (args: string[], who = 'me'): string => execFileSync('git', args, { cwd: root, encoding: 'utf-8', env: env(who) });
const commit = (file: string, who = 'me'): void => {
    fs.writeFileSync(path.join(root, file), `${file} ${Date.now()} ${Math.random()}\n`);
    git(['add', file], who);
    git(['commit', '-qm', `${who} ${file}`], who);
};

beforeAll(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-chain-')));
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 'me@example.com']);
    commit('a.txt');
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('a chain that knows its parent (7.4, H17)', () => {
    it('records the parent and its SHA from the reflog at checkout -b', () => {
        const mainSha = git(['rev-parse', 'main']).trim();
        git(['checkout', '-qb', 'p']);
        expect(recordParentFromReflog(root)).toEqual({ branch: 'p', parent: 'main', sha: mainSha });
        expect(recordedParent(root, 'p')).toBe('main');
        expect(recordedParentSha(root, 'p')).toBe(mainSha);
        commit('p.txt');
        git(['checkout', '-qb', 'c']);
        recordParentFromReflog(root);
        expect(recordedParent(root, 'c')).toBe('p');
    });

    it('never overwrites a recorded parent', () => {
        expect(recordParentFromReflog(root)).toBeNull();
    });

    it('re-parents a child whose parent was merged, offline, with a report', () => {
        git(['checkout', '-q', 'main']);
        git(['merge', '-q', '--no-ff', '-m', 'merge p', 'p']);
        expect(reparentMerged(root)).toEqual(['c: parent p is merged into main — re-parented to main']);
        expect(recordedParent(root, 'c')).toBe('main');
    });

    it('a branch with no own commit is not ours; one with a foreign author is not ours', () => {
        git(['checkout', '-qb', 'empty']);
        const g = makeGit(root);
        expect(ownedBy(g, 'empty', 'main')).toBe(false);
        git(['checkout', '-qb', 'foreign']);
        commit('f.txt', 'someone');
        expect(ownedBy(g, 'foreign', 'main')).toBe(false);
        git(['checkout', '-qb', 'mine']);
        expect(ownedBy(g, 'mine', 'foreign')).toBe(false);
        commit('m.txt');
        expect(ownedBy(g, 'mine', 'foreign')).toBe(true);
    });

    // Withdrawn from the hook on 2026-10-27: a hook-invoked script is local-only
    // for the CI/local parity gate, and the recorded decision of 2026-08-13 keeps
    // that list from growing. Recording at checkout waits for a CLI verb (7.4).
    it('the post-checkout hook does not call branch_chain', () => {
        const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-chain-hooks-'));
        const r = spawnSync('bash', [path.join(REPO, 'src/scripts/install-hooks.sh')], { cwd: REPO, encoding: 'utf-8', env: { ...process.env, AGENT_CONFIG_HOOKS_DIR: stage } });
        expect(r.status, r.stderr).toBe(0);
        expect(fs.readFileSync(path.join(stage, 'post-checkout'), 'utf-8')).not.toMatch(/branch_chain/);
        fs.rmSync(stage, { recursive: true, force: true });
    }, 60_000);
});
