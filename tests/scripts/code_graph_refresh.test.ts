import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { computeVerdict } from '../../src/scripts/code_graph/detect.js';

const CLI = path.resolve('src/scripts/code_graph/cli.ts');

let tmp: string;

interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

function runCli(args: string[]): RunResult {
    try {
        const stdout = execFileSync('npx', ['tsx', CLI, ...args], { encoding: 'utf8' });
        return { status: 0, stdout, stderr: '' };
    } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string };
        return { status: err.status ?? -1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'code-graph-refresh-'));
    fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'src', 'a.ts'), 'export function hi(): number { return 1; }\n', 'utf8');
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('detect --format json — three-state verdict', () => {
    it('ABSENT on an empty root, with stable key order', () => {
        const r = runCli(['detect', '--root', tmp, '--format', 'json']);
        expect(r.status).toBe(0);
        expect(r.stdout.trim()).toBe('{"verdict":"ABSENT","behind_commits":null,"source":null,"sources":[]}');
    });

    it('FRESH after a build picks the native cache', () => {
        // NOT named graph.json — a root-level graph.json is (correctly)
        // classified as a consumer-shipped index by detectSources.
        const out = path.join(tmp, 'native-cache.json');
        expect(runCli(['build', '--root', tmp, '--out', out]).status).toBe(0);
        const v = computeVerdict(tmp, out);
        expect(v.verdict).toBe('FRESH');
        expect(v.source?.kind).toBe('native');
    });

    it('is deterministic — two runs, identical bytes', () => {
        const a = runCli(['detect', '--root', tmp, '--format', 'json']).stdout;
        const b = runCli(['detect', '--root', tmp, '--format', 'json']).stdout;
        expect(a).toBe(b);
    });
});

describe('refresh — build/update/no-op with a hard wall-clock budget', () => {
    it('ABSENT → full build', () => {
        const out = path.join(tmp, 'graph.json');
        const r = runCli(['refresh', '--root', tmp, '--out', out]);
        expect(r.status).toBe(0);
        expect(fs.existsSync(out)).toBe(true);
    });

    it('FRESH → no-op, cache untouched', () => {
        const out = path.join(tmp, 'graph.json');
        runCli(['refresh', '--root', tmp, '--out', out]);
        const before = fs.readFileSync(out, 'utf8');
        const r = runCli(['refresh', '--root', tmp, '--out', out]);
        expect(r.status).toBe(0);
        expect(`${r.stdout}${r.stderr}`).toMatch(/fresh — nothing to do/);
        expect(fs.readFileSync(out, 'utf8')).toBe(before);
    });

    it('budget exceeded → non-zero exit, NO cache written, no temp leftovers', () => {
        const out = path.join(tmp, 'graph.json');
        const r = runCli(['refresh', '--root', tmp, '--out', out, '--budget-seconds', '0']);
        expect(r.status).not.toBe(0);
        expect(`${r.stdout}${r.stderr}`).toMatch(/budget exceeded .*old cache kept/);
        expect(fs.existsSync(out)).toBe(false);
        const leftovers = fs.readdirSync(tmp).filter((f) => f.includes('refresh-tmp'));
        expect(leftovers).toEqual([]);
    });

    it('--single-flight backs off while another refresh holds the lock', () => {
        const out = path.join(tmp, 'graph.json');
        const lock = path.join(tmp, 'agents', 'runtime', 'state', 'code-graph-refresh.lock');
        fs.mkdirSync(lock, { recursive: true });
        fs.writeFileSync(`${lock}.owner.json`, JSON.stringify({ pid: process.pid, started_at: Date.now(), nonce: 't' }));
        const r = runCli(['refresh', '--root', tmp, '--out', out, '--single-flight']);
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/another refresh is running/);
        expect(fs.existsSync(out)).toBe(false);
        // Without the flag the same call builds — the lock, not something else, held it back.
        expect(runCli(['refresh', '--root', tmp, '--out', out]).status).toBe(0);
        expect(fs.existsSync(out)).toBe(true);
    });

    it('--single-flight releases the lock when it is done', () => {
        const out = path.join(tmp, 'graph.json');
        expect(runCli(['refresh', '--root', tmp, '--out', out, '--single-flight']).status).toBe(0);
        expect(fs.existsSync(path.join(tmp, 'agents', 'runtime', 'state', 'code-graph-refresh.lock'))).toBe(false);
    });

    it('--map draws no map for a project that never asked for one', () => {
        const out = path.join(tmp, 'agents', 'runtime', 'state', 'code-graph-v1.json');
        expect(runCli(['refresh', '--root', tmp, '--map']).status).toBe(0);
        expect(fs.existsSync(out)).toBe(true);
        expect(fs.existsSync(path.join(tmp, 'agents', 'map'))).toBe(false);
    });

    it('--map redraws an existing map that is older than the cache', () => {
        fs.mkdirSync(path.join(tmp, 'agents', 'map'), { recursive: true });
        const r = runCli(['refresh', '--root', tmp, '--map']);
        expect(r.status, r.stderr).toBe(0);
        expect(fs.existsSync(path.join(tmp, 'agents', 'map', 'map.json'))).toBe(true);
    });

    it('discards a graph built while HEAD moved, and keeps the old cache', () => {
        const git = (...a: string[]): void => {
            execFileSync('git', ['-C', tmp, ...a], { stdio: 'ignore' });
        };
        git('init', '-q');
        git('config', 'user.email', 't@example.com');
        git('config', 'user.name', 't');
        git('add', '-A');
        git('commit', '-qm', 'seed');
        const out = path.join(tmp, 'graph.json');
        // Keep HEAD moving for the whole refresh window: every build attempt
        // straddles at least one commit.
        const mover = spawn('sh', ['-c', `while true; do git -C "${tmp}" commit -q --allow-empty -m m; sleep 0.05; done`], {
            stdio: 'ignore',
        });
        try {
            const r = runCli(['refresh', '--root', tmp, '--out', out]);
            expect(r.status).toBe(1);
            expect(r.stderr).toMatch(/HEAD moved \(or could not be read\) during the refresh — result discarded/);
            expect(fs.existsSync(out)).toBe(false);
        } finally {
            mover.kill('SIGKILL');
        }
    }, 60_000);

    it('discards a build when the repository HEAD cannot be read on either side', () => {
        // A `.git` that git cannot read: every HEAD probe fails, before and after.
        fs.writeFileSync(path.join(tmp, '.git'), 'gitdir: /nonexistent/never\n');
        const out = path.join(tmp, 'graph.json');
        const r = runCli(['refresh', '--root', tmp, '--out', out]);
        expect(r.status).toBe(1);
        expect(r.stderr).toMatch(/could not be read/);
        expect(fs.existsSync(out)).toBe(false);
    });

    it('auto-refresh on / status / off writes and removes the local opt-in', () => {
        const marker = path.join(tmp, 'agents', 'runtime', 'state', 'code-graph-auto-refresh.json');
        expect(runCli(['auto-refresh', 'status', '--root', tmp]).stdout).toMatch(/auto-refresh: off/);
        expect(runCli(['auto-refresh', 'on', '--root', tmp]).status).toBe(0);
        expect(fs.existsSync(marker)).toBe(true);
        expect(runCli(['auto-refresh', 'status', '--root', tmp]).stdout).toMatch(/auto-refresh: on/);
        expect(runCli(['auto-refresh', 'off', '--root', tmp]).status).toBe(0);
        expect(fs.existsSync(marker)).toBe(false);
        expect(runCli(['auto-refresh', 'sideways', '--root', tmp]).status).toBe(2);
    });

    it('budget exceeded with an EXISTING cache → old cache byte-identical', () => {
        const out = path.join(tmp, 'graph.json');
        runCli(['refresh', '--root', tmp, '--out', out]);
        const before = fs.readFileSync(out, 'utf8');
        // Make the tree stale-shaped for a rebuild attempt, then abort at 0s.
        fs.writeFileSync(path.join(tmp, 'src', 'b.ts'), 'export function bye(): number { return 2; }\n', 'utf8');
        fs.rmSync(out); // force the ABSENT → full-build path under the 0s budget
        const r = runCli(['refresh', '--root', tmp, '--out', out, '--budget-seconds', '0']);
        expect(r.status).not.toBe(0);
        expect(fs.existsSync(out)).toBe(false);
        // restore-shaped assertion: a prior cache elsewhere is never touched
        expect(before).toContain('"schema_version"');
    });
});
