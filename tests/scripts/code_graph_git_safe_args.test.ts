/**
 * The code-graph's git probes must not run exec config from the TARGET
 * checkout's own `.git/config`. `hardenedSpawnEnv()` strips env-borne config
 * only; `core.fsmonitor` set in the repository still runs on `git status` /
 * `git diff`, so every call carries `-c core.fsmonitor=false`.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { GIT_SAFE_ARGS } from '../../src/scripts/_lib/spawn_env.js';
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

    it('every execFileSync git call under code_graph/ carries GIT_SAFE_ARGS', () => {
        expect(GIT_SAFE_ARGS).toContain('core.fsmonitor=false');
        const bare: string[] = [];
        for (const f of fs.readdirSync(CODE_GRAPH)) {
            if (!f.endsWith('.ts')) continue;
            const lines = fs.readFileSync(path.join(CODE_GRAPH, f), 'utf-8').split('\n');
            lines.forEach((l, i) => {
                if (/execFileSync\(\s*['"]git['"]/.test(l) && !l.includes('...GIT_SAFE_ARGS')) bare.push(`${f}:${i + 1}`);
            });
        }
        expect(bare).toEqual([]);
    });
});
