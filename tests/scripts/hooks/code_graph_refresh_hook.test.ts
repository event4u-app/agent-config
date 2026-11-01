import { execFileSync, type spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AUTO_REFRESH_REL, LOCK_REL, NATIVE_CACHE_REL as CACHE_REL } from '../../../src/scripts/code_graph/graph_home.js';
import { readRefreshRecords } from '../../../src/scripts/code_graph/refresh_lock.js';
import {
    REFRESH_ARGS,
    refreshFor,
    repoRoot,
    claimPath,
    resolveCli,
    slotOf,
    THROTTLE_MS,
} from '../../../src/scripts/hooks/code_graph_refresh_hook.js';

/**
 * A directory holding only `git`: the tests narrow PATH, the concern needs git to
 * check tracking, and the real git directory may also hold an installed agent-config.
 */
const GIT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-refresh-git-'));
fs.symlinkSync(execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf-8' }).trim(), path.join(GIT_DIR, 'git'));

let root: string;
let outside: string;
let savedPath: string | undefined;
let calls: { cmd: string; args: readonly string[]; opts: Record<string, unknown> }[];

/** Records the spawn instead of starting a process. */
const fakeSpawn = ((cmd: string, args: readonly string[], opts: Record<string, unknown>) => {
    calls.push({ cmd, args, opts });
    const child = new EventEmitter() as EventEmitter & { unref: () => void };
    child.unref = () => {};
    return child;
}) as unknown as typeof spawn;

/** A CLI inside an installed-package layout; `capable` adds the file the single-flight refresh ships. */
function writeCli(dir: string, capable = true, version = '99.0.0'): string {
    const pkg = path.join(path.dirname(dir), 'pkg');
    fs.mkdirSync(path.join(pkg, 'dist', 'cli'), { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version }));
    if (capable) {
        fs.mkdirSync(path.join(pkg, 'src', 'scripts', 'code_graph'), { recursive: true });
        fs.writeFileSync(path.join(pkg, 'src', 'scripts', 'code_graph', 'refresh_lock.ts'), '');
    }
    const real = path.join(pkg, 'dist', 'cli', 'agent-config.js');
    fs.writeFileSync(real, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    fs.mkdirSync(dir, { recursive: true });
    const cli = path.join(dir, 'agent-config');
    fs.symlinkSync(real, cli);
    return cli;
}

/** Creates a claim file, as another dispatch would. */
const plant = (f: string): void => {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, '', { flag: 'wx' });
};

const git = (...a: string[]): void => {
    execFileSync('git', ['-C', root, ...a], { stdio: 'ignore' });
};

/** An opted-in project with a locally built (untracked) cache and a trusted CLI on PATH. */
function optedIn(): string {
    fs.writeFileSync(path.join(root, CACHE_REL), '{}');
    fs.writeFileSync(path.join(root, AUTO_REFRESH_REL), '{}');
    const cli = writeCli(path.join(outside, 'bin'));
    process.env['PATH'] = [path.join(outside, 'bin'), GIT_DIR].join(path.delimiter);
    return cli;
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-refresh-hook-')));
    outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-refresh-path-')));
    git('init', '-q');
    fs.writeFileSync(path.join(root, '.gitignore'), '/agents/runtime/\n/agents/map/.build/\n');
    fs.mkdirSync(path.join(root, 'agents', 'map', '.build'), { recursive: true });
    calls = [];
    savedPath = process.env['PATH'];
    delete process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'];
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
    process.env['PATH'] = savedPath;
    delete process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'];
});

describe('which CLI may run, and what is recorded (PR #2604 review)', () => {
    it('refuses a global CLI too old for the single-flight refresh, and records why', () => {
        fs.writeFileSync(path.join(root, CACHE_REL), '{}');
        fs.writeFileSync(path.join(root, AUTO_REFRESH_REL), '{}');
        writeCli(path.join(outside, 'bin'), false, '17.0.0');
        process.env['PATH'] = [path.join(outside, 'bin'), GIT_DIR].join(path.delimiter);
        expect(refreshFor(root, fakeSpawn)).toBe('cli-too-old');
        expect(calls).toEqual([]);
        const last = readRefreshRecords(root);
        expect(last['session-start']?.outcome).toBe('cli-too-old');
        expect(last['session-start']?.detail).toMatch(/agent-config$/);
    });

    it('records a spawn with the CLI and version it started', () => {
        optedIn();
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        expect(readRefreshRecords(root)['session-start']?.detail).toMatch(/agent-config$/);
    });

    it('records no-cli instead of failing silently', () => {
        fs.writeFileSync(path.join(root, CACHE_REL), '{}');
        fs.writeFileSync(path.join(root, AUTO_REFRESH_REL), '{}');
        process.env['PATH'] = GIT_DIR;
        expect(refreshFor(root, fakeSpawn)).toBe('no-cli');
        expect(readRefreshRecords(root)['session-start']?.outcome).toBe('no-cli');
    });
});

describe('code-graph-refresh session concern', () => {
    it('spawns one detached single-flight refresh for an opted-in project', () => {
        const cli = optedIn();
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.cmd).toBe(cli);
        expect(calls[0]?.args).toEqual([...REFRESH_ARGS, '--root', root]);
        expect(calls[0]?.opts).toMatchObject({ cwd: root, detached: true, stdio: 'ignore' });
    });

    it('resolves the repository root from a subdirectory cwd', () => {
        optedIn();
        const sub = path.join(root, 'src', 'deep');
        fs.mkdirSync(sub, { recursive: true });
        expect(repoRoot(sub)).toBe(root);
        expect(refreshFor(sub, fakeSpawn)).toBe('spawned');
        expect(calls[0]?.opts['cwd']).toBe(root);
    });

    it('does nothing without the explicit opt-in, even with a cache', () => {
        optedIn();
        fs.rmSync(path.join(root, AUTO_REFRESH_REL));
        expect(refreshFor(root, fakeSpawn)).toBe('not-opted-in');
        expect(calls).toHaveLength(0);
    });

    it('never builds a graph nobody asked for', () => {
        optedIn();
        fs.rmSync(path.join(root, CACHE_REL));
        expect(refreshFor(root, fakeSpawn)).toBe('no-cache');
        expect(calls).toHaveLength(0);
    });

    it('still serves a project whose opt-in and cache an older release left in agents/runtime/state/', () => {
        const legacy = path.join(root, 'agents', 'runtime', 'state');
        fs.mkdirSync(legacy, { recursive: true });
        fs.writeFileSync(path.join(legacy, path.basename(CACHE_REL)), '{}');
        fs.writeFileSync(path.join(legacy, path.basename(AUTO_REFRESH_REL)), '{}');
        writeCli(path.join(outside, 'bin'));
        process.env['PATH'] = [path.join(outside, 'bin'), GIT_DIR].join(path.delimiter);
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        expect(calls).toHaveLength(1);
    });

    it('refuses an opt-in and a cache the REPOSITORY committed', () => {
        optedIn();
        git('add', '-f', AUTO_REFRESH_REL, CACHE_REL);
        expect(refreshFor(root, fakeSpawn)).toBe('tracked');
        expect(calls).toHaveLength(0);
    });

    it('never executes an agent-config the repository ships', () => {
        optedIn();
        process.env['PATH'] = GIT_DIR;
        writeCli(root);
        writeCli(path.join(root, 'node_modules', '.bin'));
        expect(refreshFor(root, fakeSpawn)).toBe('no-cli');
        expect(calls).toHaveLength(0);
    });

    it('skips relative PATH entries and PATH dirs that resolve into the repository', () => {
        const repoBin = path.join(root, 'bin');
        writeCli(repoBin);
        const linkToRepoBin = path.join(outside, 'link');
        fs.symlinkSync(repoBin, linkToRepoBin);
        expect(resolveCli(root, ['bin', '.', linkToRepoBin, repoBin].join(path.delimiter))).toBeNull();
        const trusted = writeCli(path.join(outside, 'trusted'));
        expect(resolveCli(root, [repoBin, path.join(outside, 'trusted')].join(path.delimiter))).toBe(trusted);
    });

    it('refuses a PATH binary that is a symlink into the repository', () => {
        const planted = writeCli(path.join(root, 'tools'));
        const dir = path.join(outside, 'innocent');
        fs.mkdirSync(dir);
        fs.symlinkSync(planted, path.join(dir, 'agent-config'));
        expect(resolveCli(root, dir)).toBeNull();
    });

    it('never falls through an uninspectable level to an opted-in outer repository', () => {
        optedIn();
        // `inner` is a FILE, so inspecting `inner/.git` fails with ENOTDIR — an
        // error other than absence, and one that holds for root as well.
        const inner = path.join(root, 'vendor', 'inner');
        fs.mkdirSync(path.dirname(inner), { recursive: true });
        fs.writeFileSync(inner, '');
        expect(repoRoot(inner)).toBeNull();
        expect(refreshFor(inner, fakeSpawn)).toBe('not-opted-in');
        expect(calls).toHaveLength(0);
    });

    it('does not pile onto a refresh that already holds the lock', () => {
        optedIn();
        fs.mkdirSync(path.join(root, LOCK_REL));
        expect(refreshFor(root, fakeSpawn)).toBe('locked');
        expect(calls).toHaveLength(0);
    });

    it('honours the kill switch', () => {
        optedIn();
        process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] = 'off';
        expect(refreshFor(root, fakeSpawn)).toBe('disabled');
        expect(calls).toHaveLength(0);
    });
});

describe('turn-end binding — spawn only after HEAD moved (2026-11-01)', () => {
    const commit = (msg: string): void => {
        fs.writeFileSync(path.join(root, `${msg}.txt`), msg);
        git('add', `${msg}.txt`);
        execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', msg], { stdio: 'ignore' });
    };

    it('skips a second call for the same HEAD, and keeps the spawn record it compared against', () => {
        optedIn();
        commit('one');
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        const first = readRefreshRecords(root)['session-start'];
        expect(first?.head).toMatch(/^[0-9a-f]{40}$/);
        expect(refreshFor(root, fakeSpawn)).toBe('fresh');
        expect(calls).toHaveLength(1);
        expect(readRefreshRecords(root)['session-start']).toEqual(first);
    });

    it('spawns again once HEAD moved', () => {
        optedIn();
        commit('one');
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        commit('two');
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        expect(calls).toHaveLength(2);
    });

    it('spawns again for the same HEAD once the throttle window passed', () => {
        optedIn();
        commit('one');
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        expect(refreshFor(root, fakeSpawn, Date.now() + THROTTLE_MS + 1000)).toBe('spawned');
        expect(calls).toHaveLength(2);
    });

    it('without a HEAD (no commit yet) the window alone throttles', () => {
        optedIn();
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        expect(refreshFor(root, fakeSpawn)).toBe('fresh');
        expect(refreshFor(root, fakeSpawn, Date.now() + THROTTLE_MS + 1000)).toBe('spawned');
        expect(calls).toHaveLength(2);
    });



    it('the opt-out wins over a marker written beside it', () => {
        optedIn();
        fs.writeFileSync(path.join(root, 'agents', 'map', '.build', 'code-graph-auto-refresh.off.json'), '{}');
        expect(refreshFor(root, fakeSpawn)).toBe('not-opted-in');
        expect(calls).toHaveLength(0);
    });

    it('a legacy-only layout with no build directory still records and throttles', () => {
        fs.rmSync(path.join(root, 'agents', 'map'), { recursive: true, force: true });
        const legacy = path.join(root, 'agents', 'runtime', 'state');
        fs.mkdirSync(legacy, { recursive: true });
        fs.writeFileSync(path.join(legacy, path.basename(CACHE_REL)), '{}');
        fs.writeFileSync(path.join(legacy, path.basename(AUTO_REFRESH_REL)), '{}');
        writeCli(path.join(outside, 'bin'));
        process.env['PATH'] = [path.join(outside, 'bin'), GIT_DIR].join(path.delimiter);
        commit('one');
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        expect(refreshFor(root, fakeSpawn)).toBe('fresh');
        expect(calls).toHaveLength(1);
    });





    it('records which slot ran it', () => {
        optedIn();
        commit('one');
        expect(refreshFor(root, fakeSpawn, Date.now(), 'stop')).toBe('spawned');
        expect(readRefreshRecords(root)['session-start']?.slot).toBe('stop');
        expect(slotOf({ event: 'stop' })).toBe('stop');
        expect(slotOf({ hook_event_name: 'SessionStart' })).toBe('session_start');
        expect(slotOf({ payload: { hook_event_name: 'Stop' } })).toBe('stop');
        expect(slotOf({})).toBeUndefined();
    });

    it('does not spawn when the claim cannot be created', () => {
        optedIn();
        commit('one');
        const build = path.join(root, 'agents', 'map', '.build');
        fs.chmodSync(build, 0o500);
        try {
            expect(refreshFor(root, fakeSpawn)).toBe('record-failed');
            expect(calls).toHaveLength(0);
        } finally {
            fs.chmodSync(build, 0o700);
        }
    });

    it('a win never deletes a claim another pair could still hold, and sweeps only day folders two days old', () => {
        optedIn();
        commit('one');
        const build = path.join(root, 'agents', 'map', '.build');
        const now = Date.now();
        const otherHeadNow = claimPath(build, 'b'.repeat(40), now);
        const otherHeadPrev = claimPath(build, 'b'.repeat(40), now - THROTTLE_MS);
        const spent = claimPath(build, 'b'.repeat(40), now - 3 * 24 * 60 * 60 * 1000);
        for (const f of [otherHeadNow, otherHeadPrev, spent]) plant(f);
        expect(refreshFor(root, fakeSpawn, now)).toBe('spawned');
        expect(fs.existsSync(otherHeadNow)).toBe(true);
        expect(fs.existsSync(otherHeadPrev)).toBe(true);
        expect(fs.existsSync(spent)).toBe(false);
    });

    it('a dispatch for another HEAD interleaved before a claim leaves both claims standing', () => {
        optedIn();
        commit('one');
        const build = path.join(root, 'agents', 'map', '.build');
        const now = Date.now();
        const elsewhere = claimPath(build, 'c'.repeat(40), now);
        // Another pair is won between this dispatch's checks and its claim.
        expect(refreshFor(root, fakeSpawn, now, 'stop', () => plant(elsewhere))).toBe('spawned');
        expect(fs.existsSync(elsewhere)).toBe(true);
        // And this pair stays claimed against a later dispatch.
        expect(refreshFor(root, fakeSpawn, now)).toBe('fresh');
        expect(calls).toHaveLength(1);
    });

    it('a later window\'s claim is not swept by an earlier-window win (clock set back)', () => {
        optedIn();
        commit('one');
        const build = path.join(root, 'agents', 'map', '.build');
        const now = Date.now();
        const future = claimPath(build, 'd'.repeat(40), now + 3 * THROTTLE_MS);
        plant(future);
        expect(refreshFor(root, fakeSpawn, now)).toBe('spawned');
        expect(fs.existsSync(future)).toBe(true);
    });

    it('a dispatch that runs between another one\'s checks and its claim wins once, the other gets fresh', () => {
        optedIn();
        commit('one');
        let inner: string | null = null;
        const outer = refreshFor(root, fakeSpawn, Date.now(), 'stop', () => {
            inner = refreshFor(root, fakeSpawn, Date.now(), 'stop');
        });
        expect([outer, inner].sort()).toEqual(['fresh', 'spawned']);
        expect(calls).toHaveLength(1);
    });

    it('a launch that errors keeps its claim; the pair retries in the next window', async () => {
        optedIn();
        commit('one');
        const errSpawn = ((cmd: string, args: readonly string[], opts: Record<string, unknown>) => {
            calls.push({ cmd, args, opts });
            const child = new EventEmitter() as EventEmitter & { unref: () => void };
            child.unref = () => {};
            queueMicrotask(() => child.emit('error', new Error('ENOENT')));
            return child;
        }) as unknown as typeof spawn;
        const now = Date.now();
        expect(refreshFor(root, errSpawn, now)).toBe('spawned');
        await new Promise((r) => setTimeout(r, 10));
        expect(refreshFor(root, fakeSpawn, now)).toBe('fresh');
        expect(refreshFor(root, fakeSpawn, now + THROTTLE_MS)).toBe('spawned');
    });

    it('a dispatch paused past the sweep horizon cannot re-create its swept claim', () => {
        optedIn();
        commit('one');
        const then = Date.now();
        // Checks ran at `then`; the claim is attempted two windows later.
        expect(refreshFor(root, fakeSpawn, then, 'stop', undefined, () => then + 2 * THROTTLE_MS)).toBe('fresh');
        expect(calls).toHaveLength(0);
        const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
        expect(fs.existsSync(claimPath(path.join(root, 'agents', 'map', '.build'), head, then))).toBe(false);
    });

    it('eight concurrent processes released at one instant spawn exactly once', async () => {
        optedIn();
        commit('one');
        const marker = path.join(outside, 'spawned');
        const at = Date.now() + 3000;
        const file = path.join(outside, 'race.mts');
        fs.writeFileSync(
            file,
            [
                `import fs from 'node:fs';`,
                `import { refreshFor } from ${JSON.stringify(path.resolve('src/scripts/hooks/code_graph_refresh_hook.ts'))};`,
                `const fake = () => { fs.appendFileSync(${JSON.stringify(marker)}, 'x'); return { on() {}, unref() {} }; };`,
                `while (Date.now() < ${at}) { /* barrier */ }`,
                `refreshFor(${JSON.stringify(root)}, fake as never);`,
            ].join('\n'),
        );
        const tsx = path.resolve('node_modules', '.bin', 'tsx');
        const env = { ...process.env, PATH: [process.env['PATH'], path.dirname(process.execPath)].join(path.delimiter) };
        const { spawn: realSpawn } = await import('node:child_process');
        const codes = await Promise.all(
            Array.from({ length: 8 }, () => new Promise<number | null>((resolve) => realSpawn(tsx, [file], { stdio: 'ignore', env }).on('exit', resolve))),
        );
        expect(codes.every((c) => c === 0)).toBe(true);
        expect(fs.readFileSync(marker, 'utf-8')).toBe('x');
    }, 60_000);

    it('a claim of yesterday survives a win today; deletion trails admission by more than a day', () => {
        optedIn();
        commit('one');
        const build = path.join(root, 'agents', 'map', '.build');
        const now = Date.now();
        const yesterday = claimPath(build, 'e'.repeat(40), now - 24 * 60 * 60 * 1000);
        plant(yesterday);
        expect(refreshFor(root, fakeSpawn, now)).toBe('spawned');
        expect(fs.existsSync(yesterday)).toBe(true);
    });

    it('never claims or sweeps through a symlinked claims folder (round 7)', () => {
        optedIn();
        commit('one');
        const victim = path.join(outside, 'victim');
        fs.mkdirSync(path.join(victim, '1'), { recursive: true });
        fs.writeFileSync(path.join(victim, '1', 'keep'), 'x');
        fs.symlinkSync(victim, path.join(root, 'agents', 'map', '.build', 'claims'));
        expect(refreshFor(root, fakeSpawn)).toBe('record-failed');
        expect(calls).toHaveLength(0);
        expect(fs.readFileSync(path.join(victim, '1', 'keep'), 'utf-8')).toBe('x');
    });

    it('a symlinked old day folder is skipped by the sweep, never followed', () => {
        optedIn();
        commit('one');
        const victim = path.join(outside, 'victim-day');
        fs.mkdirSync(victim, { recursive: true });
        fs.writeFileSync(path.join(victim, 'keep'), 'x');
        const claims = path.join(root, 'agents', 'map', '.build', 'claims');
        fs.mkdirSync(claims, { recursive: true });
        fs.symlinkSync(victim, path.join(claims, '1'));
        expect(refreshFor(root, fakeSpawn)).toBe('spawned');
        expect(fs.readFileSync(path.join(victim, 'keep'), 'utf-8')).toBe('x');
    });

    it('refuses claim storage the repository tracks', () => {
        optedIn();
        commit('one');
        const f = path.join(root, 'agents', 'map', '.build', 'claims', '1', 'x-1');
        plant(f);
        git('add', '-f', path.relative(root, f));
        expect(refreshFor(root, fakeSpawn)).toBe('tracked');
        expect(calls).toHaveLength(0);
    });

    it('never claims or sweeps through a symlinked ancestor such as agents/map (round 8)', () => {
        const outsideMap = path.join(outside, 'outside-map');
        fs.mkdirSync(path.join(outsideMap, '.build', 'claims', '1'), { recursive: true });
        fs.writeFileSync(path.join(outsideMap, '.build', 'claims', '1', 'keep'), 'x');
        fs.rmSync(path.join(root, 'agents', 'map'), { recursive: true, force: true });
        fs.symlinkSync(outsideMap, path.join(root, 'agents', 'map'));
        optedIn();
        commit('one');
        const before = fs.readdirSync(path.join(outsideMap, '.build', 'claims')).sort();
        expect(refreshFor(root, fakeSpawn)).toBe('record-failed');
        expect(calls).toHaveLength(0);
        expect(fs.readdirSync(path.join(outsideMap, '.build', 'claims')).sort()).toEqual(before);
        expect(fs.readFileSync(path.join(outsideMap, '.build', 'claims', '1', 'keep'), 'utf-8')).toBe('x');
    });

    it('never writes its outcome record through a symlinked agents/map (round 9)', () => {
        const outsideMap = path.join(outside, 'outside-map-record');
        fs.mkdirSync(path.join(outsideMap, '.build'), { recursive: true });
        fs.rmSync(path.join(root, 'agents', 'map'), { recursive: true, force: true });
        fs.symlinkSync(outsideMap, path.join(root, 'agents', 'map'));
        optedIn();
        fs.rmSync(path.join(root, CACHE_REL));
        commit('one');
        expect(refreshFor(root, fakeSpawn)).toBe('no-cache');
        expect(fs.readdirSync(path.join(outsideMap, '.build')).filter((f) => f.startsWith('code-graph-refresh.'))).toEqual([]);
    });

    it('a committed claim for a future window is refused, not read as fresh (round 10)', () => {
        optedIn();
        commit('one');
        const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
        const future = claimPath(path.join(root, 'agents', 'map', '.build'), head, Date.now());
        plant(future);
        git('add', '-f', path.relative(root, future));
        expect(refreshFor(root, fakeSpawn)).toBe('tracked');
    });
});
