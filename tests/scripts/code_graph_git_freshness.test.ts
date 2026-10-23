/**
 * Code-graph freshness from git, with no daemon
 * (road-to-a-graph-that-is-shipped 1.3).
 *
 * These run the REAL rendered hooks, not a reimplementation of them: the
 * installer is rendered into a scratch directory through its documented
 * `AGENT_CONFIG_HOOKS_DIR` seam, and the resulting hooks are executed inside a
 * throwaway directory. A test that re-implemented the shell would pass while
 * the shipped hook was broken, which is the failure mode the seam exists to
 * prevent.
 *
 * Single-flight is the engine's job since the hook stopped holding its own
 * shell lock (one lock protocol, not two): it is tested where it lives, in
 * `code_graph_refresh.test.ts` and `code_graph_refresh_lock.test.ts`. Here the
 * hook is held to calling `refresh --single-flight --map` on the right events.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CACHE_REL = path.join('agents', 'runtime', 'state', 'code-graph-v1.json');
const EXPECTED = 'code-graph refresh --single-flight --map --budget-seconds 60';

let stage: string;

beforeAll(() => {
    stage = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-hooks-render-'));
    const res = spawnSync('bash', [path.join(REPO_ROOT, 'src/scripts/install-hooks.sh')], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        env: { ...process.env, AGENT_CONFIG_HOOKS_DIR: stage },
    });
    expect(res.status, `installer failed: ${res.stderr}`).toBe(0);
}, 120_000);

/**
 * A throwaway directory carrying a fake `./agent-config` that records each
 * code-graph call as one line. These hooks call `./agent-config` for more than
 * one thing — the chat-history checkpoint block runs first, unconditionally —
 * so only code-graph calls are recorded.
 */
function rig(withCache: boolean): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-rig-'));
    fs.mkdirSync(path.join(dir, 'agents', 'runtime', 'state'), { recursive: true });
    if (withCache) fs.writeFileSync(path.join(dir, CACHE_REL), '{}');
    fs.writeFileSync(
        path.join(dir, 'agent-config'),
        '#!/bin/sh\nif [ "$1" != "code-graph" ]; then exit 0; fi\necho "$*" >> "$PWD/calls.log"\n',
        { mode: 0o755 },
    );
    return dir;
}

function runHook(hook: string, cwd: string, args: string[] = []): void {
    spawnSync('bash', [path.join(stage, hook), ...args], { cwd, encoding: 'utf-8' });
}

/** The detached call is not awaited by the hook; give it a moment to land. */
function calls(dir: string): string[] {
    const log = path.join(dir, 'calls.log');
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline && !fs.existsSync(log)) spawnSync('sleep', ['0.05']);
    spawnSync('sleep', ['0.1']);
    return fs.existsSync(log) ? fs.readFileSync(log, 'utf-8').split('\n').filter(Boolean) : [];
}

describe('the refresh block', () => {
    it('post-commit asks the engine for a single-flight refresh that also redraws the map', () => {
        const dir = rig(true);
        runHook('post-commit', dir);
        expect(calls(dir)).toEqual([EXPECTED]);
    }, 30_000);

    it('never builds a graph that does not exist yet', () => {
        // Refreshing a graph the developer built is a service; building one
        // they never asked for is the pure install cost Risk 1 names.
        const dir = rig(false);
        runHook('post-commit', dir);
        expect(calls(dir)).toEqual([]);
    }, 30_000);

    it('holds no shell lock of its own — one lock protocol, the engine’s', () => {
        const body = fs.readFileSync(path.join(stage, 'post-commit'), 'utf-8');
        expect(body).not.toMatch(/code-graph-refresh\.lock/);
        expect(body).toContain(EXPECTED);
    });
});

describe('post-checkout refresh', () => {
    it('skips a file-checkout, which moves no commits', () => {
        const dir = rig(true);
        // git passes post-checkout: $1 prev, $2 new, $3 is-branch-checkout.
        runHook('post-checkout', dir, ['abc', 'def', '0']);
        expect(calls(dir)).toEqual([]);
    }, 30_000);

    it('refreshes on a branch checkout', () => {
        const dir = rig(true);
        runHook('post-checkout', dir, ['abc', 'def', '1']);
        expect(calls(dir)).toEqual([EXPECTED]);
    }, 30_000);
});

describe('post-merge and post-rewrite refresh', () => {
    it('refreshes after a merge — a fast-forward `git pull` fires post-merge and nothing else', () => {
        const dir = rig(true);
        runHook('post-merge', dir, ['0']);
        expect(calls(dir)).toEqual([EXPECTED]);
    }, 30_000);

    it('refreshes after a finished rebase', () => {
        const dir = rig(true);
        runHook('post-rewrite', dir, ['rebase']);
        expect(calls(dir)).toEqual([EXPECTED]);
    }, 30_000);

    it.each(['post-commit', 'post-checkout', 'post-merge', 'post-rewrite'])(
        '%s never holds up git: a slow, failing refresh leaves the hook exiting 0 at once',
        (hook) => {
            const dir = rig(true);
            // Only the refresh hangs; the chat-history checkpoint ahead of it is synchronous by design.
            fs.writeFileSync(
                path.join(dir, 'agent-config'),
                '#!/bin/sh\nif [ "$1" = "code-graph" ]; then sleep 5; exit 7; fi\nexit 0\n',
                { mode: 0o755 },
            );
            const args = hook === 'post-checkout' ? ['a', 'b', '1'] : hook === 'post-rewrite' ? ['rebase'] : ['0'];
            const t0 = Date.now();
            const r = spawnSync('bash', [path.join(stage, hook), ...args], { cwd: dir, encoding: 'utf-8' });
            expect(r.status).toBe(0);
            expect(Date.now() - t0).toBeLessThan(3000);
        },
        30_000,
    );

    it('skips an amend, which post-commit already covered', () => {
        const dir = rig(true);
        runHook('post-rewrite', dir, ['amend']);
        expect(calls(dir)).toEqual([]);
    }, 30_000);
});

describe('the index across a two-branch merge', () => {
    it('merges with no conflict markers, because git never tracks the index', () => {
        // 1.3 asks for a union merge driver for the index. There is nothing for
        // one to drive: `agents/runtime/` is gitignored (.gitignore:196) and
        // ADR-129 makes the cache a derived, disposable accelerator whose
        // rollback is `rm`. This test asserts the property the driver was meant
        // to deliver — a two-branch merge never conflicts on the index — and
        // records WHY it holds for free.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-merge-'));
        const git = (...args: string[]): ReturnType<typeof spawnSync> =>
            spawnSync('git', ['-C', dir, ...args], { encoding: 'utf-8' });

        git('init', '-q', '-b', 'main');
        git('config', 'user.email', 't@example.com');
        git('config', 'user.name', 't');
        fs.writeFileSync(path.join(dir, '.gitignore'), '/agents/runtime/\n');
        fs.mkdirSync(path.join(dir, 'agents', 'runtime', 'state'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'seed.txt'), 'seed\n');
        git('add', '-A');
        git('commit', '-qm', 'seed');

        // Each branch touches a tracked file AND writes a different index.
        git('checkout', '-q', '-b', 'left');
        fs.writeFileSync(path.join(dir, 'left.txt'), 'left\n');
        fs.writeFileSync(path.join(dir, CACHE_REL), '{"branch":"left"}');
        git('add', '-A');
        git('commit', '-qm', 'left');

        git('checkout', '-q', 'main');
        git('checkout', '-q', '-b', 'right');
        fs.writeFileSync(path.join(dir, 'right.txt'), 'right\n');
        fs.writeFileSync(path.join(dir, CACHE_REL), '{"branch":"right"}');
        git('add', '-A');
        git('commit', '-qm', 'right');

        const merge = git('merge', '--no-edit', 'left');
        expect(merge.status, `merge failed: ${merge.stderr}`).toBe(0);

        // The index survived as a plain working-tree file with no markers.
        const cache = fs.readFileSync(path.join(dir, CACHE_REL), 'utf-8');
        expect(cache).not.toContain('<<<<<<<');
        expect(cache).not.toContain('>>>>>>>');

        // And the reason: git never saw it.
        const tracked = String(git('ls-files', CACHE_REL).stdout ?? '').trim();
        expect(tracked).toBe('');
    }, 60_000);
});
