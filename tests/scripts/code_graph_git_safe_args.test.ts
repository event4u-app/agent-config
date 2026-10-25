/**
 * The code-graph's git probes must not run the fsmonitor command or the hooks
 * the TARGET checkout's own `.git/config` names. `hardenedSpawnEnv()` strips
 * env-borne config only; `core.fsmonitor` set in the repository still runs on
 * `git status` / `git diff`, so every probe goes through `gitProbe()`, which
 * leads with `-c core.fsmonitor=false -c core.hooksPath=/dev/null`.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { GIT_SAFE_ARGS, gitProbe } from '../../src/scripts/_lib/spawn_env.js';
import { diffFiles } from '../../src/scripts/code_graph/map.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const CODE_GRAPH = path.join(REPO, 'src', 'scripts', 'code_graph');

const tmp: string[] = [];
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function hostileRepo(): { root: string; marker: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-fsmonitor-'));
    tmp.push(root);
    const marker = path.join(root, '..', `${path.basename(root)}.marker`);
    tmp.push(marker);
    const git = (...a: string[]) => execFileSync('git', ['-C', root, ...a], { stdio: 'ignore' });
    git('init', '-q');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 't');
    fs.writeFileSync(path.join(root, 'a.txt'), 'x\n');
    git('add', 'a.txt');
    git('commit', '-qm', 'init');
    const hook = path.join(root, '.git', 'fsm.sh');
    fs.writeFileSync(hook, `#!/bin/sh\ntouch '${marker}'\n`, { mode: 0o755 });
    git('config', 'core.fsmonitor', hook);
    fs.writeFileSync(path.join(root, 'a.txt'), 'y\n');
    return { root, marker };
}

describe('code-graph git probes ignore repo-local exec config', () => {
    it('the fixture is live: plain git status runs the fsmonitor hook', () => {
        const { root, marker } = hostileRepo();
        execFileSync('git', ['-C', root, 'status', '--porcelain'], { stdio: 'ignore' });
        expect(fs.existsSync(marker)).toBe(true);
    });

    it('diffFiles against a hostile checkout does not run the hook', () => {
        const { root, marker } = hostileRepo();
        expect(diffFiles(root, 'HEAD')).toEqual(['a.txt']);
        expect(fs.existsSync(marker)).toBe(false);
    });

    it('gitProbe status against a hostile checkout does not run the hook', () => {
        const { root, marker } = hostileRepo();
        expect(gitProbe(root, ['status', '--porcelain'])).toContain('a.txt');
        expect(fs.existsSync(marker)).toBe(false);
    });

    it('no file under code_graph/ spawns git except through gitProbe', () => {
        expect(GIT_SAFE_ARGS).toContain('core.fsmonitor=false');
        // Whole-file, whitespace-tolerant, every spawn primitive: a multiline
        // call or a nested directory cannot slip past a line-by-line scan.
        const direct = /\b(?:execFileSync|execFile|spawnSync|spawn|execSync|exec)\(\s*['"`]git['"`]/;
        const walk = (dir: string): string[] =>
            fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
                e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : [],
            );
        const files = walk(CODE_GRAPH);
        expect(files.length).toBeGreaterThan(10);
        const bare = files.filter((f) => direct.test(fs.readFileSync(f, 'utf-8'))).map((f) => path.relative(REPO, f));
        expect(bare).toEqual([]);
        expect(files.filter((f) => fs.readFileSync(f, 'utf-8').includes('gitProbe(')).length).toBeGreaterThanOrEqual(5);
    });
});
