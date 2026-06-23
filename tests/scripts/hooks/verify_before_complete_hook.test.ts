
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { run, STATE_FILE } from '../../../src/scripts/verify_before_complete_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'verify_before_complete_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function state(root: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), 'utf8'));
}

function envelope(
    platform: string,
    event: string,
    payload: Record<string, unknown>,
    session_id = 's1',
): string {
    return JSON.stringify({
        schema_version: 1,
        platform,
        event,
        native_event: event,
        session_id,
        workspace_root: '/work',
        payload,
    });
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-before-complete-'));
    fs.mkdirSync(path.join(tmp, 'agents', 'runtime', 'state'), { recursive: true });
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('verify_before_complete — tracker behaviour', () => {
    it('session_start initialises state', () => {
        expect(run(envelope('augment', 'session_start', {}), { consumer_root: tmp })).toBe(0);
        const s = state(tmp);
        expect(s['session_id']).toBe('s1');
        expect(s['verified_this_turn']).toBe(false);
        expect(s['verifications_this_turn']).toBe(0);
        expect(s['last_verification']).toBe(null);
    });

    it('pytest command records verification', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        const payload = {
            tool_name: 'launch-process',
            tool_input: { command: '.venv/bin/python3 -m pytest tests/ -q' },
        };
        run(envelope('augment', 'post_tool_use', payload), { consumer_root: tmp });
        const s = state(tmp);
        expect(s['verified_this_turn']).toBe(true);
        expect(s['verifications_this_turn']).toBe(1);
        const lv = s['last_verification'] as Record<string, unknown>;
        expect(lv['tool']).toBe('launch-process');
        expect(String(lv['command'])).toContain('pytest');
    });

    it('non-verification command does not set flag', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        const payload = { tool_name: 'launch-process', tool_input: { command: 'ls -la' } };
        run(envelope('augment', 'post_tool_use', payload), { consumer_root: tmp });
        const s = state(tmp);
        expect(s['verified_this_turn']).toBe(false);
        expect(s['verifications_this_turn']).toBe(0);
    });

    it('user_prompt_submit resets turn counter', () => {
        run(envelope('claude', 'session_start', {}), { consumer_root: tmp });
        run(
            envelope('claude', 'post_tool_use', {
                tool_name: 'Bash',
                tool_input: { command: 'task ci' },
            }),
            { consumer_root: tmp },
        );
        expect(state(tmp)['verified_this_turn']).toBe(true);
        run(envelope('claude', 'user_prompt_submit', {}), { consumer_root: tmp });
        const s = state(tmp);
        expect(s['verified_this_turn']).toBe(false);
        expect(s['verifications_this_turn']).toBe(0);
        // session-scoped count survives the turn reset
        expect(s['verifications_this_session']).toBe(1);
    });

    it('stop event records timestamp', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        run(envelope('augment', 'stop', {}), { consumer_root: tmp });
        expect(state(tmp)['last_stop_at']).not.toBe(null);
    });

    it('session id change resets session counters', () => {
        run(
            envelope('augment', 'session_start', { tool_input: { command: 'pytest' } }, 's1'),
            { consumer_root: tmp },
        );
        run(
            envelope(
                'augment',
                'post_tool_use',
                { tool_name: 'launch-process', tool_input: { command: 'pytest -q' } },
                's1',
            ),
            { consumer_root: tmp },
        );
        expect(state(tmp)['verifications_this_session']).toBe(1);
        run(envelope('augment', 'session_start', {}, 's2'), { consumer_root: tmp });
        const s = state(tmp);
        expect(s['session_id']).toBe('s2');
        expect(s['verifications_this_session']).toBe(0);
    });

    it.each([
        ['augment', 'launch-process', 'command'],
        ['claude', 'Bash', 'command'],
        ['cursor', 'RunShellCommand', 'command'],
        ['cline', 'execute_shell', 'command'],
        ['gemini', 'shell', 'command'],
    ])('verification detected: %s / %s', (platform, tool, cmdKey) => {
        run(envelope(platform, 'session_start', {}), { consumer_root: tmp });
        const payload = { tool_name: tool, tool_input: { [cmdKey]: 'task ci' } };
        run(envelope(platform, 'post_tool_use', payload), { consumer_root: tmp });
        expect(state(tmp)['verified_this_turn']).toBe(true);
    });

    it('malformed stdin is silent no-op', () => {
        expect(run('not json', { consumer_root: tmp })).toBe(0);
        const target = path.join(tmp, STATE_FILE);
        if (fs.existsSync(target)) {
            JSON.parse(fs.readFileSync(target, 'utf8'));
        }
    });

    it('empty stdin is silent no-op', () => {
        expect(run('', { consumer_root: tmp })).toBe(0);
    });

    it('dispatcher envelope passes through', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        expect(state(tmp)['session_id']).toBe('s1');
    });
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
    state: Record<string, unknown> | null;
}

function normalize(parsed: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!parsed) return parsed;
    if ('checked_at' in parsed) parsed['checked_at'] = '<TS>';
    if (parsed['turn_started_at'] != null) parsed['turn_started_at'] = '<TS>';
    if (parsed['last_stop_at'] != null) parsed['last_stop_at'] = '<TS>';
    const lv = parsed['last_verification'];
    if (lv && typeof lv === 'object' && !Array.isArray(lv)) {
        (lv as Record<string, unknown>)['at'] = '<TS>';
    }
    return parsed;
}
