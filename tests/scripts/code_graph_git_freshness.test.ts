/**
 * Code-graph freshness from git, with no daemon
 * (road-to-a-graph-that-is-shipped 1.3).
 *
 * These run the REAL rendered hooks, not a reimplementation of them: the
 * installer is rendered into a scratch directory through its documented
 * `AGENT_CONFIG_HOOKS_DIR` seam, and the resulting `post-commit` /
 * `post-checkout` are executed inside a throwaway git repository. A test that
 * re-implemented the shell would pass while the shipped hook was broken, which
 * is the failure mode the seam exists to prevent.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CACHE_REL = path.join('agents', 'runtime', 'state', 'code-graph-v1.json');
const LOCK_REL = path.join('agents', 'runtime', 'state', 'code-graph-refresh.lock');

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
 * A throwaway repo carrying a fake `./agent-config` that records each refresh
 * as one line. Counting lines is how "exactly one refresh" is measured.
 */
function rig(withCache: boolean): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-rig-'));
    fs.mkdirSync(path.join(dir, 'agents', 'runtime', 'state'), { recursive: true });
    if (withCache) fs.writeFileSync(path.join(dir, CACHE_REL), '{}');
    fs.writeFileSync(
        path.join(dir, 'agent-config'),
        '#!/bin/sh\n' +
            // These hooks call `./agent-config` for more than one thing — the
            // chat-history checkpoint block runs first, unconditionally. Only
            // the refresh is under test, so only the refresh is counted; a
            // counter that logged every invocation measured the checkpoint too
            // and reported 4 where the answer was 1.
            'if [ "$1" != "code-graph" ]; then exit 0; fi\n' +
            // Hold the lock long enough that a concurrent hook must observe it.
            'sleep 0.4\n' +
            'echo refresh >> "$PWD/refreshes.log"\n',
        { mode: 0o755 },
    );
    return dir;
}

function runHook(hookPath: string, cwd: string, args: string[] = []): void {
    spawnSync('bash', [hookPath, ...args], { cwd, encoding: 'utf-8' });
}

function refreshCount(dir: string): number {
    const log = path.join(dir, 'refreshes.log');
    if (!fs.existsSync(log)) return 0;
    return fs.readFileSync(log, 'utf-8').split('\n').filter(Boolean).length;
}

/** Wait for the detached child to finish; it is deliberately not awaited by git. */
function settle(dir: string, ms = 2500): void {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
        if (!fs.existsSync(path.join(dir, LOCK_REL))) return;
        spawnSync('sleep', ['0.05']);
    }
}

describe('post-commit refresh — single-flight', () => {
    it('two concurrent commits produce exactly one refresh', () => {
        const dir = rig(true);
        const hook = path.join(stage, 'post-commit');

        // Both hooks fire before either child finishes: the first creates the
        // lock directory, the second must find it and do nothing. `mkdir` is
        // the atomicity primitive under test — a lock written with `>` would
        // let both through, and this assertion is what would catch that.
        runHook(hook, dir);
        runHook(hook, dir);
        settle(dir);

        expect(refreshCount(dir)).toBe(1);
    }, 30_000);

    it('is SENSITIVE — with the lock removed the same two calls produce two refreshes', () => {
        // A single-flight test that never sees the un-locked count proves
        // nothing: it could pass because the second call failed for an
        // unrelated reason. Neutralising the mechanism must change the answer.
        const dir = rig(true);
        const hook = path.join(stage, 'post-commit');
        const body = fs.readFileSync(hook, 'utf-8').replace(
            'if mkdir "$cg_lock" 2>/dev/null; then',
            'if true; then',
        );
        const unlocked = path.join(dir, 'post-commit-unlocked');
        fs.writeFileSync(unlocked, body, { mode: 0o755 });

        runHook(unlocked, dir);
        runHook(unlocked, dir);
        spawnSync('sleep', ['1.5']);

        expect(refreshCount(dir)).toBe(2);
    }, 30_000);

    it('never builds a graph that does not exist yet', () => {
        // Refreshing a graph the developer built is a service; building one
        // they never asked for is the pure install cost Risk 1 names.
        const dir = rig(false);
        runHook(path.join(stage, 'post-commit'), dir);
        settle(dir, 800);
        expect(refreshCount(dir)).toBe(0);
    }, 30_000);
});

describe('post-checkout refresh', () => {
    it('skips a file-checkout, which moves no commits', () => {
        const dir = rig(true);
        // git passes post-checkout: $1 prev, $2 new, $3 is-branch-checkout.
        runHook(path.join(stage, 'post-checkout'), dir, ['abc', 'def', '0']);
        settle(dir, 800);
        expect(refreshCount(dir)).toBe(0);
    }, 30_000);

    it('refreshes on a branch checkout', () => {
        const dir = rig(true);
        runHook(path.join(stage, 'post-checkout'), dir, ['abc', 'def', '1']);
        settle(dir);
        expect(refreshCount(dir)).toBe(1);
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
