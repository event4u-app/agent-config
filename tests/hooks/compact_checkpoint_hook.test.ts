import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readEventTally } from '../../src/scripts/_lib/compact_checkpoint.js';
import { main } from '../../src/scripts/hooks/compact_checkpoint_hook.js';
import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';

let root: string;

function run(envelope: object): { rc: number; out: string } {
    let out = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        out += String(chunk);
        return true;
    });
    setHookStdinOverride(JSON.stringify({ schema_version: 1, platform: 'claude', ...envelope }));
    try {
        return { rc: main(), out };
    } finally {
        spy.mockRestore();
        clearHookStdinOverride();
    }
}

const payload = { session_id: 'sid-1', transcript_path: '/tmp/t/sid-1.jsonl' };

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-cp-hook-'));
    process.env['EVENT4U_CONFIG_HOME'] = root;
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    delete process.env['AGENT_CONFIG_NO_COMPACT_CHECKPOINT'];
    delete process.env['EVENT4U_CONFIG_HOME'];
});

describe('compact-checkpoint hook', () => {
    it('logs a pre_compact and a session_start(compact) and prints nothing', () => {
        const a = run({ event: 'pre_compact', workspace_root: root, payload });
        const b = run({ event: 'session_start', workspace_root: root, payload: { ...payload, source: 'compact' } });
        expect([a.rc, b.rc]).toEqual([0, 0]);
        expect(a.out + b.out).toBe('');
        expect(readEventTally({ EVENT4U_CONFIG_HOME: root })).toMatchObject({ written: 1, match: 1 });
    });

    it('does nothing in replay mode', () => {
        process.env['AGENT_CONFIG_REPLAY'] = '1';
        try {
            expect(run({ event: 'pre_compact', payload }).rc).toBe(0);
        } finally {
            delete process.env['AGENT_CONFIG_REPLAY'];
        }
        expect(fs.existsSync(path.join(root, 'state', 'compact-checkpoint'))).toBe(false);
    });

    it('ignores session_start from any other source', () => {
        run({ event: 'session_start', workspace_root: root, payload: { ...payload, source: 'startup' } });
        expect(fs.existsSync(path.join(root, 'state', 'compact-checkpoint'))).toBe(false);
    });

    it('does nothing when switched off or when the envelope is unusable', () => {
        process.env['AGENT_CONFIG_NO_COMPACT_CHECKPOINT'] = '1';
        expect(run({ event: 'pre_compact', workspace_root: root, payload }).rc).toBe(0);
        delete process.env['AGENT_CONFIG_NO_COMPACT_CHECKPOINT'];
        expect(run({ event: 'pre_compact', workspace_root: root, payload: {} }).rc).toBe(0);
        expect(fs.existsSync(path.join(root, 'state', 'compact-checkpoint'))).toBe(false);
    });
});
