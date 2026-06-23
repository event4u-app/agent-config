// Tests for src/scripts/context_hygiene_hook.ts (py2ts Phase 6 — hooks).
//
// 1:1 port of tests/test_context_hygiene_hook.py (per-turn tracker hook)
// plus a golden-parity layer: python3 vs tsx fed identical stdin + argv in
// isolated tmp projects, asserting identical exit + identical state JSON
// (checked_at normalised — wall-clock). Parity skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main, run, STATE_DIR, STATE_FILE } from '../../../src/scripts/context_hygiene_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'context_hygiene_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function state(root: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), 'utf8'));
}

function fire(root: string, tool: string | null): number {
    const payload = tool === null ? '' : JSON.stringify({ tool_name: tool });
    return run(payload, { consumer_root: root });
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'context-hygiene-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('context_hygiene — tracker behaviour', () => {
    it('first call initialises state', () => {
        expect(fire(tmp, 'view')).toBe(0);
        const s = state(tmp);
        expect(s['tool_calls']).toBe(1);
        expect(s['consecutive_same_tool']).toBe(1);
        expect(s['last_tool']).toBe('view');
        expect(s['tool_history']).toEqual(['view']);
        expect(s['loop_detected']).toBe(false);
        expect(s['freshness_threshold']).toBe(null);
    });

    it('three same tools in a row flags loop', () => {
        for (let i = 0; i < 3; i += 1) fire(tmp, 'view');
        const s = state(tmp);
        expect(s['consecutive_same_tool']).toBe(3);
        expect(s['loop_detected']).toBe(true);
        expect(s['tool_calls']).toBe(3);
    });

    it('different tool resets consecutive count', () => {
        for (let i = 0; i < 3; i += 1) fire(tmp, 'view');
        fire(tmp, 'edit');
        const s = state(tmp);
        expect(s['consecutive_same_tool']).toBe(1);
        expect(s['loop_detected']).toBe(false);
        expect(s['last_tool']).toBe('edit');
    });

    it('tool history is capped at 5', () => {
        for (const tool of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) fire(tmp, tool);
        expect(state(tmp)['tool_history']).toEqual(['c', 'd', 'e', 'f', 'g']);
    });

    it('freshness threshold at 20', () => {
        for (let i = 0; i < 19; i += 1) fire(tmp, `t${i}`);
        let s = state(tmp);
        expect(s['tool_calls']).toBe(19);
        expect(s['freshness_threshold']).toBe(null);

        fire(tmp, 't19');
        s = state(tmp);
        expect(s['tool_calls']).toBe(20);
        expect(s['freshness_threshold']).toBe(20);
    });

    it('freshness threshold advances to 40', () => {
        for (let i = 0; i < 40; i += 1) fire(tmp, `t${i}`);
        const s = state(tmp);
        expect(s['tool_calls']).toBe(40);
        expect(s['freshness_threshold']).toBe(40);
    });

    it('freshness threshold not overwritten between milestones', () => {
        for (let i = 0; i < 25; i += 1) fire(tmp, `t${i}`);
        expect(state(tmp)['freshness_threshold']).toBe(20);
    });

    it('corrupt state file recovers', () => {
        const stateDir = path.join(tmp, STATE_DIR);
        fs.mkdirSync(stateDir, { recursive: true });
        fs.writeFileSync(path.join(tmp, STATE_FILE), 'not-json');
        expect(fire(tmp, 'view')).toBe(0);
        const s = state(tmp);
        expect(s['tool_calls']).toBe(1);
        expect(s['last_tool']).toBe('view');
    });

    it('payload without tool_name still writes state', () => {
        expect(run('{"foo": "bar"}', { consumer_root: tmp })).toBe(0);
        const s = state(tmp);
        expect(s['tool_calls']).toBe(0);
        expect('checked_at' in s).toBe(true);
    });

    it('empty payload still writes state', () => {
        expect(run('', { consumer_root: tmp })).toBe(0);
        const s = state(tmp);
        expect(s['tool_calls']).toBe(0);
        expect(s['last_tool']).toBe(null);
    });

    it('invalid json payload does not crash', () => {
        expect(run('{not json', { consumer_root: tmp })).toBe(0);
        expect(state(tmp)['tool_calls']).toBe(0);
    });

    it('alt payload keys (toolName / tool)', () => {
        run(JSON.stringify({ toolName: 'ToolA' }), { consumer_root: tmp });
        run(JSON.stringify({ tool: 'ToolB' }), { consumer_root: tmp });
        const s = state(tmp);
        expect(s['tool_calls']).toBe(2);
        expect(s['tool_history']).toEqual(['ToolA', 'ToolB']);
    });

    it('atomic write does not leave .tmp', () => {
        fire(tmp, 'view');
        const leftovers = fs
            .readdirSync(path.join(tmp, STATE_DIR))
            .filter((n) => n.endsWith('.tmp'));
        expect(leftovers).toEqual([]);
    });

    it('main reads stdin (chdir + cwd)', () => {
        // main() reads fd 0; exercise it via a subprocess with piped stdin so
        // the file-descriptor read path is genuinely covered.
        const res = spawnSync(TSX_BIN, [TS_SCRIPT, '--platform', 'augment'], {
            input: JSON.stringify({ tool_name: 'view' }),
            encoding: 'utf8',
            cwd: tmp,
            env: { ...process.env },
        });
        expect(res.status).toBe(0);
        const s = state(tmp);
        expect(s['tool_calls']).toBe(1);
        expect(s['last_tool']).toBe('view');
        // sanity: the in-process entry point is also exported.
        expect(typeof main).toBe('function');
    });
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
    state: Record<string, unknown> | null;
}
