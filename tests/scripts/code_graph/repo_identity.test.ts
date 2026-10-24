import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { canonicalOrigin, machineKeyPath, repoIdentity } from '../../../src/scripts/code_graph/repo_identity.js';

let tmp: string;
let env: Record<string, string>;

function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf-8' }).trim();
}

function repo(name: string, origin?: string): string {
    const dir = path.join(tmp, name);
    fs.mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q');
    if (origin !== undefined) git(dir, 'remote', 'add', 'origin', origin);
    return dir;
}

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-repo-id-')));
    env = { EVENT4U_CONFIG_HOME: path.join(tmp, 'home') };
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('canonicalOrigin', () => {
    it('collapses https, ssh, scp and `.git` forms of one repository', () => {
        const forms = [
            'https://github.com/Acme/widget.git',
            'https://github.com/Acme/widget',
            'https://GitHub.com:443/Acme/widget/',
            'ssh://git@github.com/Acme/widget.git',
            'ssh://git@github.com:22/Acme/widget',
            'git@github.com:Acme/widget.git',
            'git+ssh://git@github.com/Acme/widget.git',
        ];
        expect(new Set(forms.map((f) => canonicalOrigin(f)))).toEqual(new Set(['github.com/Acme/widget']));
    });

    it('strips userinfo, tokens and the query string', () => {
        expect(canonicalOrigin('https://x-access-token:ghp_SECRET@github.com/Acme/widget.git?token=abc#frag')).toBe(
            'github.com/Acme/widget',
        );
        expect(canonicalOrigin('https://ghp_SECRET@github.com/Acme/widget')).toBe('github.com/Acme/widget');
    });

    it('resolves a relative remote against the repository root, not the process cwd', () => {
        const root = path.join(tmp, 'checkout');
        expect(canonicalOrigin('../upstream.git', root)).toBe(`file:${path.join(tmp, 'upstream').replace(/^\/+/, '')}`);
    });

    it('keeps a non-default port, because it names a different server', () => {
        expect(canonicalOrigin('https://git.example.com:8443/team/app.git')).toBe('git.example.com:8443/team/app');
    });
});

describe('repoIdentity', () => {
    it('is 12 hex, keyed by a machine-local key that is created once', () => {
        const a = repo('a', 'https://github.com/Acme/widget.git');
        const id = repoIdentity(a, env);
        expect(id.repoId).toMatch(/^[0-9a-f]{12}$/);
        const key = fs.readFileSync(machineKeyPath(env), 'utf-8');
        expect(repoIdentity(a, env).repoId).toBe(id.repoId);
        expect(fs.readFileSync(machineKeyPath(env), 'utf-8')).toBe(key);
        expect(machineKeyPath(env).startsWith(path.join(env.EVENT4U_CONFIG_HOME!, 'runtime', 'projects'))).toBe(true);
    });

    it('is not a plain hash of the URL, and differs between machine keys', () => {
        const a = repo('a', 'https://github.com/Acme/widget.git');
        const id = repoIdentity(a, env).repoId;
        const plain = createHash('sha256').update('github.com/Acme/widget').digest('hex');
        expect(plain.startsWith(id)).toBe(false);
        expect(repoIdentity(a, { EVENT4U_CONFIG_HOME: path.join(tmp, 'other-home') }).repoId).not.toBe(id);
    });

    it('gives the https, ssh and `.git` forms one id', () => {
        const ids = new Set(
            ['https://github.com/Acme/widget.git', 'git@github.com:Acme/widget.git', 'ssh://git@github.com/Acme/widget'].map(
                (o, i) => repoIdentity(repo(`r${i}`, o), env).repoId,
            ),
        );
        expect(ids.size).toBe(1);
    });

    it('gives a relative remote the id of the same remote spelled absolute', () => {
        const relative = repoIdentity(repo('rel', '../upstream'), env).repoId;
        const absolute = repoIdentity(repo('abs', path.join(tmp, 'upstream')), env).repoId;
        expect(relative).toBe(absolute);
    });

    it('gives a URL carrying a token the same id as without', () => {
        const plain = repoIdentity(repo('p', 'https://github.com/Acme/widget.git'), env).repoId;
        const token = repoIdentity(repo('t', 'https://x-access-token:ghp_SECRET@github.com/Acme/widget.git'), env).repoId;
        expect(token).toBe(plain);
    });

    it('keeps the id of a moved clone, and falls back to the realpath without a remote', () => {
        const a = repo('a', 'https://github.com/Acme/widget.git');
        const before = repoIdentity(a, env).repoId;
        const moved = path.join(tmp, 'elsewhere', 'widget');
        fs.mkdirSync(path.dirname(moved), { recursive: true });
        fs.renameSync(a, moved);
        expect(repoIdentity(moved, env).repoId).toBe(before);

        const local = repo('local');
        const local2 = repo('local2');
        const lid = repoIdentity(local, env);
        expect(lid.source).toBe('realpath');
        expect(repoIdentity(local2, env).repoId).not.toBe(lid.repoId);
        expect(repoIdentity(path.join(tmp, 'not-a-repo-dir'), env).source).toBe('realpath');
    });

    it('a worktree shares the repo id and differs in instance', () => {
        for (const origin of ['https://github.com/Acme/widget.git', undefined]) {
            const main = repo(origin ? 'main' : 'mainlocal', origin);
            fs.writeFileSync(path.join(main, 'f.txt'), 'x');
            git(main, 'add', 'f.txt');
            git(main, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'x');
            const wt = path.join(tmp, origin ? 'wt' : 'wtlocal');
            git(main, 'worktree', 'add', '-q', wt);
            const m = repoIdentity(main, env);
            const w = repoIdentity(wt, env);
            expect(w.repoId).toBe(m.repoId);
            expect(m.instance).toBeNull();
            expect(w.instance).toMatch(/^[0-9a-f]{8}$/);
        }
    });
});
