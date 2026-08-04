// Regression contract for the hook-environment defect.
//
// Git hooks export GIT_DIR, children inherit it, and an inherited GIT_DIR
// OVERRIDES repository discovery — so a gate that passes `cwd` still resolved
// against the hook's repo. In a linked worktree that returned empty `git log`
// output, which Gate R1's grandfather clause read as "no pre-activation
// baseline" and reported as missing_register on every grandfathered roadmap:
// the pre-push layer fired spuriously while CI (no GIT_DIR) stayed green.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { GIT_DISCOVERY_VARS, gitEnv } from '../../src/scripts/_lib/git_env.js';

const tmpDirs: string[] = [];
afterAll(() => {
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

describe('gitEnv', () => {
    it('strips every discovery-overriding variable', () => {
        const base: NodeJS.ProcessEnv = { PATH: '/usr/bin', HOME: '/home/x' };
        for (const key of GIT_DISCOVERY_VARS) base[key] = `/some/${key}`;
        const env = gitEnv(base);
        for (const key of GIT_DISCOVERY_VARS) {
            expect(env[key], `${key} must not survive`).toBeUndefined();
        }
    });

    it('preserves unrelated variables', () => {
        const env = gitEnv({ PATH: '/usr/bin', HOME: '/home/x', GIT_DIR: '/nope' });
        expect(env['PATH']).toBe('/usr/bin');
        expect(env['HOME']).toBe('/home/x');
    });

    it('names GIT_DIR and GIT_WORK_TREE — the two a hook actually exports', () => {
        expect(GIT_DISCOVERY_VARS).toContain('GIT_DIR');
        expect(GIT_DISCOVERY_VARS).toContain('GIT_WORK_TREE');
    });

    it('makes cwd decide: a foreign GIT_DIR no longer hijacks git log', () => {
        // Two independent repos. `other` is the stand-in for the hook's repo.
        const mk = (label: string): string => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), `git-env-${label}-`));
            tmpDirs.push(dir);
            const g = (...a: string[]): void => {
                execFileSync('git', a, { cwd: dir, stdio: 'ignore', env: gitEnv() });
            };
            g('init', '-q', '-b', 'main');
            g('config', 'user.email', 'e@test.local');
            g('config', 'user.name', 'e');
            g('config', 'commit.gpgsign', 'false');
            fs.writeFileSync(path.join(dir, `${label}.txt`), 'x\n', 'utf-8');
            g('add', '-A');
            g('commit', '-qm', `${label} commit`);
            return dir;
        };
        const target = mk('target');
        const other = mk('other');

        const log = (env: NodeJS.ProcessEnv): string =>
            execFileSync('git', ['log', '--format=%s', '--', 'target.txt'], {
                cwd: target,
                encoding: 'utf8',
                env,
            }).trim();

        // Sanitized: cwd decides, the file's history is found.
        expect(log(gitEnv({ ...process.env, GIT_DIR: path.join(other, '.git') }))).toBe('target commit');

        // Unsanitized: the inherited GIT_DIR wins and the history vanishes —
        // silently, as empty output rather than an error. This is the shape that
        // made the gate report missing_register.
        const hijacked = execFileSync('git', ['log', '--format=%s', '--', 'target.txt'], {
            cwd: target,
            encoding: 'utf8',
            env: { ...process.env, GIT_DIR: path.join(other, '.git') },
        }).trim();
        expect(hijacked).toBe('');
    });
});
