// Tests for src/scripts/hooks/replay_hook.ts (py2ts Phase 6 — hooks core).
//
// 1:1 port of tests/hooks/test_replay_subcommand.py against the TS replay
// driver (no-state-mutation per event + per platform, --json summary shape,
// bare-event-name resolution, invalid-payload exit 2, --dry-run plan) plus a
// golden-parity layer: python3 replay_hook.py vs tsx replay_hook.ts must
// agree on exit code + the --json summary (each spawns its own-language
// dispatcher, which runs the same concern .py scripts). Parity skipped
// without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_REPLAY = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'replay_hook.ts');
const PY_REPLAY = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'replay_hook.py');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'hooks');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const EVENTS = [
    'session_start',
    'session_end',
    'user_prompt_submit',
    'pre_tool_use',
    'post_tool_use',
    'stop',
    'pre_compact',
    'agent_error',
];
const PLATFORMS = ['augment', 'claude', 'cursor', 'cline', 'windsurf', 'gemini', 'copilot'];

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-hook-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function runTsReplay(
    workspace: string,
    platform: string,
    event: string,
    extra: string[] = [],
): { stdout: string; stderr: string; status: number } {
    fs.mkdirSync(workspace, { recursive: true });
    const cmd = [
        TS_REPLAY,
        '--platform',
        platform,
        '--event',
        event,
        '--payload',
        path.join(FIXTURE_DIR, `${event}.json`),
        '--manifest',
        MANIFEST,
        ...extra,
    ];
    const r = spawnSync(TSX_BIN, cmd, { cwd: workspace, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? 0 };
}

function snapshotState(workspace: string): Set<string> {
    const agents = path.join(workspace, 'agents');
    if (!fs.existsSync(agents)) return new Set();
    const out = new Set<string>();
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else out.add(path.relative(workspace, full));
        }
    };
    walk(agents);
    return out;
}

describe('replay_hook — no state mutation (augment, every event)', () => {
    for (const event of EVENTS) {
        it(`event=${event} creates zero files`, () => {
            const before = snapshotState(tmp);
            const r = runTsReplay(tmp, 'augment', event);
            const after = snapshotState(tmp);
            expect(r.status, `rc for ${event}\n${r.stderr}`).toBe(0);
            const newFiles = [...after].filter((f) => !before.has(f));
            expect(newFiles, `mutated state for ${event}`).toEqual([]);
        });
    }
});

describe('replay_hook — no state mutation (every platform, post_tool_use)', () => {
    for (const platform of PLATFORMS) {
        it(`platform=${platform} creates zero files`, () => {
            const before = snapshotState(tmp);
            const r = runTsReplay(tmp, platform, 'post_tool_use');
            const after = snapshotState(tmp);
            expect(r.status, `rc for ${platform}\n${r.stderr}`).toBe(0);
            const newFiles = [...after].filter((f) => !before.has(f));
            expect(newFiles, `mutated state for ${platform}`).toEqual([]);
        });
    }
});

describe('replay_hook — summary + resolution', () => {
    it('sets replay flag and emits --json summary', () => {
        const r = runTsReplay(tmp, 'augment', 'post_tool_use', ['--json']);
        expect(r.status).toBe(0);
        const summary = JSON.parse(r.stdout);
        expect(summary['replay_mode']).toBe(true);
        expect(summary['platform']).toBe('augment');
        expect(summary['event']).toBe('post_tool_use');
        expect(summary['session_id']).toBe('fixture-post-tool-001');
    });

    it('resolves a bare event name', () => {
        const cmd = [
            TS_REPLAY,
            '--platform',
            'augment',
            '--event',
            'post_tool_use',
            '--payload',
            'post_tool_use',
            '--manifest',
            MANIFEST,
            '--json',
        ];
        const r = spawnSync(TSX_BIN, cmd, { cwd: tmp, encoding: 'utf8' });
        expect(r.status, r.stderr).toBe(0);
        const summary = JSON.parse(r.stdout);
        expect(String(summary['payload']).endsWith('post_tool_use.json')).toBe(true);
    });

    it('rejects an invalid payload path with exit 2', () => {
        const cmd = [
            TS_REPLAY,
            '--platform',
            'augment',
            '--event',
            'post_tool_use',
            '--payload',
            'nonexistent_event_xyz',
            '--manifest',
            MANIFEST,
        ];
        const r = spawnSync(TSX_BIN, cmd, { cwd: tmp, encoding: 'utf8' });
        expect(r.status).toBe(2);
        expect(r.stderr.toLowerCase()).toContain('not found');
    });

    it('--dry-run lists concerns without mutating state', () => {
        const r = runTsReplay(tmp, 'augment', 'post_tool_use', ['--dry-run']);
        expect(r.status).toBe(0);
        const plan = JSON.parse(r.stdout);
        expect(plan['platform']).toBe('augment');
        expect(plan['event']).toBe('post_tool_use');
        expect(Array.isArray(plan['concerns'])).toBe(true);
        expect([...snapshotState(tmp)]).toEqual([]);
    });
});

const py3 = hasPython3();

describe.skipIf(!py3)('replay_hook — golden parity (python3 vs tsx)', () => {
    function runPy(workspace: string, platform: string, event: string, extra: string[]): {
        stdout: string;
        stderr: string;
        status: number;
    } {
        fs.mkdirSync(workspace, { recursive: true });
        const cmd = [
            PY_REPLAY,
            '--platform',
            platform,
            '--event',
            event,
            '--payload',
            path.join(FIXTURE_DIR, `${event}.json`),
            '--manifest',
            MANIFEST,
            ...extra,
        ];
        const r = spawnSync('python3', cmd, { cwd: workspace, encoding: 'utf8' });
        return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? 0 };
    }

    it('--json summary matches (exit + summary fields)', () => {
        const event = 'post_tool_use';
        const py = runPy(path.join(tmp, 'py'), 'augment', event, ['--json']);
        const ts = runTsReplay(path.join(tmp, 'ts'), 'augment', event, ['--json']);
        expect(ts.status).toBe(py.status);
        const pySum = JSON.parse(py.stdout);
        const tsSum = JSON.parse(ts.stdout);
        // payload is a repo-relative path string in both; identical.
        expect(tsSum).toEqual(pySum);
    });

    it('invalid payload path: stderr + exit identical', () => {
        const cmdArgs = (script: string) => [
            script,
            '--platform',
            'augment',
            '--event',
            'post_tool_use',
            '--payload',
            'nonexistent_event_xyz',
            '--manifest',
            MANIFEST,
        ];
        const py = spawnSync('python3', cmdArgs(PY_REPLAY), { cwd: tmp, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, cmdArgs(TS_REPLAY), { cwd: tmp, encoding: 'utf8' });
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('non-json mode trailing replay line matches', () => {
        const py = runPy(path.join(tmp, 'py2'), 'augment', 'post_tool_use', []);
        const ts = runTsReplay(path.join(tmp, 'ts2'), 'augment', 'post_tool_use', []);
        expect(ts.status).toBe(py.status);
        // The final "replay_hook: ... rc=N (AGENT_CONFIG_REPLAY=1, no writes)" line.
        const lastLine = (s: string) => s.trimEnd().split('\n').pop() ?? '';
        expect(lastLine(ts.stderr)).toBe(lastLine(py.stderr));
    });
});
