
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_THRESHOLD, run, STATE_FILE } from '../../../src/scripts/minimal_safe_diff_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'minimal_safe_diff_hook.ts');
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'minimal-safe-diff-'));
    fs.mkdirSync(path.join(tmp, 'agents', 'runtime', 'state'), { recursive: true });
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function edit(
    root: string,
    filePath: string,
    opts: { platform?: string; tool?: string; event?: string } = {},
): void {
    const platform = opts.platform ?? 'augment';
    const tool = opts.tool ?? 'str-replace-editor';
    const event = opts.event ?? 'post_tool_use';
    const payload = { tool_name: tool, tool_input: { path: filePath } };
    run(envelope(platform, event, payload), { consumer_root: root });
}

describe('minimal_safe_diff — tracker behaviour', () => {
    it('default threshold when settings missing', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        const s = state(tmp);
        expect(s['threshold']).toBe(DEFAULT_THRESHOLD);
        expect(s['count']).toBe(0);
        expect(s['warning']).toBe(false);
    });

    it('files below threshold → no warning', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        for (let i = 0; i < DEFAULT_THRESHOLD; i += 1) edit(tmp, `src/f${i}.py`);
        const s = state(tmp);
        expect(s['count']).toBe(DEFAULT_THRESHOLD);
        expect(s['warning']).toBe(false);
    });

    it('files above threshold → warns', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        for (let i = 0; i < DEFAULT_THRESHOLD + 1; i += 1) edit(tmp, `src/f${i}.py`);
        const s = state(tmp);
        expect(s['count']).toBe(DEFAULT_THRESHOLD + 1);
        expect(s['warning']).toBe(true);
    });

    it('duplicate paths do not double count', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        edit(tmp, 'src/a.py');
        edit(tmp, 'src/a.py');
        edit(tmp, './src/a.py'); // normalisation strips leading ./
        expect(state(tmp)['count']).toBe(1);
    });

    it('user_prompt_submit resets turn', () => {
        run(envelope('claude', 'session_start', {}), { consumer_root: tmp });
        for (let i = 0; i < 3; i += 1) edit(tmp, `src/f${i}.py`, { platform: 'claude', tool: 'Edit' });
        expect(state(tmp)['count']).toBe(3);
        run(envelope('claude', 'user_prompt_submit', {}), { consumer_root: tmp });
        const s = state(tmp);
        expect(s['count']).toBe(0);
        expect(s['files_touched_this_turn']).toEqual([]);
        expect(s['warning']).toBe(false);
    });

    it('threshold read from settings', () => {
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            'hooks:\n  minimal_safe_diff:\n    threshold: 2\n',
        );
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        for (let i = 0; i < 3; i += 1) edit(tmp, `src/f${i}.py`);
        const s = state(tmp);
        expect(s['threshold']).toBe(2);
        expect(s['warning']).toBe(true);
    });

    it('invalid threshold falls back to default', () => {
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            'hooks:\n  minimal_safe_diff:\n    threshold: 0\n',
        );
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        expect(state(tmp)['threshold']).toBe(DEFAULT_THRESHOLD);
    });

    it('non-edit tool ignored', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        const payload = { tool_name: 'view', tool_input: { path: 'src/a.py' } };
        run(envelope('augment', 'post_tool_use', payload), { consumer_root: tmp });
        expect(state(tmp)['count']).toBe(0);
    });

    it.each([
        ['augment', 'str-replace-editor', 'post_tool_use'],
        ['augment', 'save-file', 'post_tool_use'],
        ['claude', 'Edit', 'post_tool_use'],
        ['claude', 'Write', 'post_tool_use'],
        ['claude', 'MultiEdit', 'post_tool_use'],
        ['cursor', 'edit_file', 'post_tool_use'],
        ['cline', 'edit_file', 'post_tool_use'],
        ['gemini', 'Edit', 'post_tool_use'],
    ])('edit tool detected: %s / %s', (platform, tool, event) => {
        run(envelope(platform, 'session_start', {}), { consumer_root: tmp });
        edit(tmp, 'src/f.py', { platform, tool, event });
        expect(state(tmp)['count']).toBe(1);
    });

    it('malformed stdin is silent no-op', () => {
        expect(run('not json', { consumer_root: tmp })).toBe(0);
    });

    it('session id change resets state', () => {
        run(envelope('augment', 'session_start', {}, 's1'), { consumer_root: tmp });
        edit(tmp, 'src/a.py');
        expect(state(tmp)['count']).toBe(1);
        run(envelope('augment', 'session_start', {}, 's2'), { consumer_root: tmp });
        const s = state(tmp);
        expect(s['session_id']).toBe('s2');
        expect(s['count']).toBe(0);
    });
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
    state: Record<string, unknown> | null;
}
