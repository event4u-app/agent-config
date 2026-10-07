/**
 * Runs the documented rebase sequence against real repositories.
 *
 * The blocks are read out of `references/branch-update.md` rather than copied,
 * so a test over them fails when the procedure an agent reads changes — a
 * re-typed copy would keep passing against a reference nobody follows.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REFERENCE = path.resolve(HERE, '../../src/skills/git-workflow/references/branch-update.md');

export function sequenceBlock(name: string, text = fs.readFileSync(REFERENCE, 'utf8')): string {
    for (const m of text.matchAll(/```bash\n([\s\S]*?)```/g)) {
        if (m[1].startsWith(`# rebase-sequence: ${name}\n`)) return m[1];
    }
    throw new Error(`no rebase-sequence block named ${name} in ${REFERENCE}`);
}

export interface Sandbox {
    root: string;
    env: NodeJS.ProcessEnv;
    git(cwd: string, ...args: string[]): string;
    commit(cwd: string, file: string, content: string, message: string): string;
}

export function sandbox(): Sandbox {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rebase-seq-'));
    const home = path.join(root, 'home');
    fs.mkdirSync(home);
    const env: NodeJS.ProcessEnv = {
        PATH: process.env.PATH,
        HOME: home,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: path.join(home, '.gitconfig'),
        GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com',
        GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com',
    };
    fs.writeFileSync(env.GIT_CONFIG_GLOBAL as string, '[init]\n\tdefaultBranch = main\n[advice]\n\tdetachedHead = false\n');
    const git = (cwd: string, ...args: string[]): string =>
        execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const commit = (cwd: string, file: string, content: string, message: string): string => {
        fs.writeFileSync(path.join(cwd, file), content);
        git(cwd, 'add', file);
        git(cwd, 'commit', '-q', '-m', message);
        return git(cwd, 'rev-parse', 'HEAD');
    };
    return { root, env, git, commit };
}

export interface RunResult { status: number; stdout: string; stderr: string }

export function runBlocks(sb: Sandbox, cwd: string, script: string, extraEnv: Record<string, string> = {}): RunResult {
    const r = spawnSync('bash', ['-c', script], { cwd, env: { ...sb.env, ...extraEnv }, encoding: 'utf8' });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/**
 * A `post-rewrite` hook fires after `git rebase` finishes — i.e. after the
 * published ref was pinned and checked, before the push. Pushing from a second
 * clone there is the race the lease exists for. Hooks inherit GIT_DIR, which
 * would point the collaborator's push at the wrong repository.
 */
export function collaboratorPushesDuringRebase(sb: Sandbox, me: string, collab: string, remoteUrl: string, branch: string): void {
    const hook = path.join(me, '.git', 'hooks', 'post-rewrite');
    fs.writeFileSync(hook, [
        '#!/bin/sh',
        'unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX',
        `git -C '${collab}' push -q '${remoteUrl}' 'HEAD:refs/heads/${branch}'`,
        '',
    ].join('\n'));
    fs.chmodSync(hook, 0o755);
}
