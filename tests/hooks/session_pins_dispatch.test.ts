// Session pins through the real dispatcher (`dispatch_hook.ts`), not the
// concern in isolation: every concern the manifest binds on these claude events
// runs beside `language-mirror`, and the dispatcher's own emission shaping
// (`shapeEmissions`, the per-turn budget) decides what reaches the host line.
// The council asked for this in rounds 4, 8 and 10 of the ratification.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { boundaryPath, restorePath } from '../../src/scripts/_lib/session_pins.js';
import { turnSpendPath } from '../../src/scripts/hooks/injection_budget.js';

let project: string;

beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'pins-dispatch-'));
    spawnSync('git', ['init', '-q'], { cwd: project });
});

afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true });
});

/** One host event through the dispatcher; the host-facing context line it printed. */
function dispatch(event: string, nativeEvent: string, payload: Record<string, unknown>): string {
    const tsx = path.resolve('node_modules/.bin/tsx');
    const r = spawnSync(
        tsx,
        [
            path.resolve('src/scripts/hooks/dispatch_hook.ts'),
            '--platform',
            'claude',
            '--event',
            event,
            '--native-event',
            nativeEvent,
            '--project-dir',
            project,
        ],
        {
            input: JSON.stringify({ session_id: 'dispatch-s', hook_event_name: nativeEvent, cwd: project, ...payload }),
            env: { ...process.env, CLAUDE_PROJECT_DIR: project, AGENT_CONFIG_REPLAY: '', LANG: 'C' },
            encoding: 'utf8',
            timeout: 60_000,
        },
    );
    // A crashed or timed-out dispatcher must fail the test, not satisfy a negative assertion.
    expect(r.error).toBeUndefined();
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);
    // The whole output is the contract: at most one host line, so no earlier
    // emission can escape a negative assertion on the last one.
    const lines = (r.stdout ?? '').trim().split('\n').filter((l) => l !== '');
    expect(lines.length).toBeLessThanOrEqual(1);
    const line = lines[0] ?? '';
    if (line === '') return '';
    const parsed = JSON.parse(line) as { hookSpecificOutput?: { additionalContext?: string } };
    return parsed.hookSpecificOutput?.additionalContext ?? '';
}

describe('session pins through the dispatcher', () => {
    it('capture, compaction, tool-call restore and one restatement reach the host line, in that order', () => {
        const pins = Array.from({ length: 12 }, (_, i) => `pin: ${`rule ${i} `.padEnd(300, 'x')}`).join('\n');
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: pins })).toContain('Session pins: 12/12 held.');

        expect(dispatch('pre_compact', 'PreCompact', { trigger: 'auto' })).not.toContain('<session-pins>');

        const restore = dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} });
        expect(restore).toContain('<session-pins>');
        expect(restore).toContain(`- ${'rule 11 '.padEnd(300, 'x')}`);

        const restated = dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' });
        expect(restated).toContain('Restated after the last compaction');

        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).not.toContain('<session-pins>');
    }, 240_000);

    it('prompt before tool call: the prompt carries the pins and the tool restore does not repeat them', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).toContain('- never push to main');
        expect(dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} })).not.toContain(
            '<session-pins>',
        );
    }, 240_000);

    it('failure injection: a tool restore dropped by the real per-turn budget is restated by the next prompt', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        // The turn has already spent the ceiling: the dispatcher's own counter, read before shaping.
        const ceiling = (JSON.parse(fs.readFileSync('src/config/hook-token-budget.json', 'utf8')) as {
            per_turn_aggregate_bytes: { ceiling_bytes: number };
        }).per_turn_aggregate_bytes.ceiling_bytes;
        const spend = turnSpendPath(project, 'dispatch-s');
        fs.mkdirSync(path.dirname(spend), { recursive: true });
        fs.writeFileSync(spend, JSON.stringify({ session: 'dispatch-s', bytes: ceiling }));
        const dropped = dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} });
        expect(dropped).not.toContain('<session-pins>');
        const restated = dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' });
        expect(restated).toContain('Restated after the last compaction');
        expect(restated).toContain('- never push to main');
    }, 240_000);

    it('failure injection: an unreadable boundary still restores through the tool call', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        const b = boundaryPath(project, 'dispatch-s');
        fs.rmSync(b);
        fs.mkdirSync(b);
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).not.toContain('<session-pins>');
        expect(dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} })).toContain(
            '- never push to main',
        );
    }, 240_000);

    it('failure injection: a held restore-record lock still delivers, saying so', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        const companion = `${restorePath(project, 'dispatch-s')}.lock.held`;
        fs.mkdirSync(path.dirname(companion), { recursive: true });
        fs.writeFileSync(companion, '');
        const line = dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} });
        fs.rmSync(companion, { force: true });
        expect(line).toContain('- never push to main');
        expect(line).toContain('could not be recorded');
    }, 240_000);

    it('failure injection: a prompt-first restore is not dropped even when the previous turn spent the whole ceiling', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        const ceiling = (JSON.parse(fs.readFileSync('src/config/hook-token-budget.json', 'utf8')) as {
            per_turn_aggregate_bytes: { ceiling_bytes: number };
        }).per_turn_aggregate_bytes.ceiling_bytes;
        const spend = turnSpendPath(project, 'dispatch-s');
        fs.mkdirSync(path.dirname(spend), { recursive: true });
        fs.writeFileSync(spend, JSON.stringify({ session: 'dispatch-s', bytes: ceiling }));
        // A prompt starts a new turn, so the dispatcher resets the counter before shaping.
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).toContain('- never push to main');
    }, 240_000);

    it('the post_tool_use exception, executable: the heaviest admissible restore through the dispatcher fits the language-mirror row, once', () => {
        const row = (JSON.parse(fs.readFileSync('src/config/hook-token-budget.json', 'utf8')) as {
            per_concern_caps_bytes: Record<string, number>;
        }).per_concern_caps_bytes['language-mirror'] as number;
        // Quote-heavy pins reach the escaped-byte cap; a system-locale language pin is the longest.
        // Twelve distinct pins, one letter plus 170 quotes each, two of them with 171:
        // exactly the 4,096 escaped-byte cap — the heaviest set capture admits.
        const texts = Array.from({ length: 12 }, (_, i) => `${'abcdefghijkl'[i]}${'"'.repeat(i < 2 ? 171 : 170)}`);
        expect(texts.reduce((n, t) => n + Buffer.byteLength(JSON.stringify(t)) - 2, 0)).toBe(4_096);
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: texts.map((t) => `pin: ${t}`).join('\n') })).toContain(
            'Session pins: 12/12 held.',
        );
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        const line = dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} });
        expect(line).toContain('<session-pins>');
        for (const t of texts) expect(line).toContain(`- ${t}`);
        expect(Buffer.byteLength(JSON.stringify({ additional_context: line }))).toBeLessThanOrEqual(row);
        expect(dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} })).not.toContain(
            '<session-pins>',
        );
    }, 240_000);
});
