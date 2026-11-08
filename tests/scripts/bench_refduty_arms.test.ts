/**
 * The reference-duty arms: what each installs into a clone, and what the act
 * hook does at a bound `git commit` — deliver a pointer, or block once until
 * the reference is read.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { ACT_HOOK_SCRIPT, install_act_hook, refs_injection_text } from '../../internal/bench/core/_lib/bench_refduty_arms.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
const made: string[] = [];
afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function clone(): string {
    const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'refduty-arm-'));
    made.push(d);
    return d;
}
function hook(dir: string, mode: string, payload: object): { status: number | null; stdout: string; stderr: string } {
    const r = spawnSync(TSX, [ACT_HOOK_SCRIPT, mode, dir], { encoding: 'utf8', input: JSON.stringify(payload) });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
const commit = (transcript: string) => ({ tool_name: 'Bash', tool_input: { command: 'git add -A && git commit -m x' }, transcript_path: transcript, session_id: 's' });

describe('install_act_hook', () => {
    it('copies the bound references into .claude/references and registers a project PreToolUse hook', () => {
        const d = clone();
        install_act_hook(d, 'gate');
        const settings = JSON.parse(fs.readFileSync(path.join(d, '.claude', 'settings.json'), 'utf8')) as { hooks: { PreToolUse: Array<{ matcher: string; hooks: Array<{ command: string }> }> } };
        expect(settings.hooks.PreToolUse[0]?.matcher).toBe('Bash');
        expect(settings.hooks.PreToolUse[0]?.hooks[0]?.command).toContain(' gate ');
        expect(fs.existsSync(path.join(d, '.claude', 'references', 'commit-mechanics.md'))).toBe(true);
    });
});

describe('the act hook', () => {
    it('deliver: names the reference at a bound commit, once per reference, and never blocks', () => {
        const d = clone();
        install_act_hook(d, 'deliver');
        const t = path.join(d, 't.jsonl');
        fs.writeFileSync(t, '');
        const first = hook(d, 'deliver', commit(t));
        expect(first.status).toBe(0);
        expect(first.stdout).toContain('.claude/references/commit-mechanics.md');
        expect(hook(d, 'deliver', commit(t)).stdout).toBe('');
    });
    it('gate: blocks once while the reference is unread, then lets the commit through', () => {
        const d = clone();
        install_act_hook(d, 'gate');
        const t = path.join(d, 't.jsonl');
        fs.writeFileSync(t, '');
        const first = hook(d, 'gate', commit(t));
        expect(first.status).toBe(2);
        expect(first.stderr).toContain('.claude/references/commit-mechanics.md');
        expect(hook(d, 'gate', commit(t)).status).toBe(0);
    });
    it('gate: lets the commit through at once when the transcript shows the reference read', () => {
        const d = clone();
        install_act_hook(d, 'gate');
        const t = path.join(d, 't.jsonl');
        fs.writeFileSync(t, JSON.stringify({ message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: path.join(d, '.claude', 'references', 'commit-mechanics.md') } }] } }) + '\n');
        expect(hook(d, 'gate', commit(t)).status).toBe(0);
    });
    it('ignores a command that runs no bound act', () => {
        const d = clone();
        install_act_hook(d, 'gate');
        expect(hook(d, 'gate', { tool_name: 'Bash', tool_input: { command: 'git status' }, transcript_path: '', session_id: 's' }).status).toBe(0);
    });
});

describe('refs_injection_text', () => {
    it('carries every bound rule reference body', () => {
        const text = refs_injection_text();
        expect(text).toContain('Commit Mechanics');
        expect(text.length).toBeGreaterThan(5000);
    });
});
