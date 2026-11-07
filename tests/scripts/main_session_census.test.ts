/**
 * The main-session default context, measured per asset from what
 * the host recorded it delivered — instruction files, the skill catalog entry by
 * entry, and hook output — not modelled from the source tree.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { censusMainSession, newestTranscript, renderMainSession } from '../../src/scripts/_lib/main_session_census.js';

const att = (attachment: Record<string, unknown>): string => JSON.stringify({ type: 'attachment', attachment });
const LINES = [
    JSON.stringify({ type: 'user', message: { content: 'hi' } }),
    att({
        type: 'instructions',
        files: [
            { path: '/home/u/.claude/CLAUDE.md', type: 'User', content: 'x'.repeat(40) },
            { path: '/repo/.claude/rules/a.md', type: 'Project', content: 'y'.repeat(400) },
        ],
    }),
    att({ type: 'skill_listing', isInitial: true, skillCount: 3, names: ['alpha', 'beta', 'gamma'], content: '- alpha: does alpha things\n- beta\n- gamma: g\n' }),
    att({ type: 'hook_success', hookEvent: 'SessionStart', hookName: 'SessionStart:startup', content: 'z'.repeat(100) }),
    att({ type: 'hook_additional_context', hookEvent: 'UserPromptSubmit', hookName: 'UserPromptSubmit', content: ['a'.repeat(30)] }),
    att({ type: 'hook_additional_context', hookEvent: 'UserPromptSubmit', hookName: 'UserPromptSubmit', content: ['b'.repeat(50)] }),
    att({ type: 'hook_success', hookEvent: 'PreToolUse', hookName: 'PreToolUse:Bash', content: '' }),
    att({ type: 'hook_success', hookEvent: 'SessionStart', hookName: 'SessionStart:compact', content: 'c'.repeat(5000) }),
    att({ type: 'instructions', files: [{ path: '/repo/.claude/rules/later.md', type: 'Project', content: 'w'.repeat(9999) }] }),
    'not json',
];

const tmps: string[] = [];
afterEach(() => {
    for (const t of tmps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});

describe('censusMainSession', () => {
    const c = censusMainSession(LINES, { home: '/home/u', repo: '/repo' });
    it('measures each delivered instruction file from the first delivery only, paths shortened', () => {
        expect(c?.instructions).toEqual([
            { path: '~/.claude/CLAUDE.md', scope: 'User', chars: 40 },
            { path: '.claude/rules/a.md', scope: 'Project', chars: 400 },
        ]);
    });
    it('splits the catalog into described and name-only entries — listed is not loaded', () => {
        expect(c?.skills).toMatchObject({ listed: 3, described: 2, name_only: 1, chars: 42 });
        expect(c?.skills.entries.find((e) => e.name === 'beta')).toEqual({ name: 'beta', chars: 6, described: false });
    });
    it('aggregates hook output per event and hook, with a per-occurrence mean, largest total first, and ignores empty output', () => {
        expect(c?.hooks).toEqual([
            { event: 'SessionStart', hook: 'SessionStart:compact', attachment: 'hook_success', model_visible: true, occurrences: 1, total_chars: 5000, mean_chars: 5000 },
            { event: 'SessionStart', hook: 'SessionStart:startup', attachment: 'hook_success', model_visible: true, occurrences: 1, total_chars: 100, mean_chars: 100 },
            { event: 'UserPromptSubmit', hook: 'UserPromptSubmit', attachment: 'hook_additional_context', model_visible: true, occurrences: 2, total_chars: 80, mean_chars: 40 },
        ]);
    });
    it('totals the session-start load: instructions + catalog + start-up hooks (not a compaction re-delivery), plus one prompt turn', () => {
        expect(c?.totals).toEqual({ session_start_chars: 40 + 400 + 42 + 100, per_turn_chars: 40, approx_tokens: Math.round((40 + 400 + 42 + 100) / 4) });
    });
    it('a transcript without an instructions delivery is not a census', () => {
        expect(censusMainSession([LINES[0] as string], { home: '/h', repo: '/r' })).toBeNull();
    });
    it('renders every bucket, largest instruction file first', () => {
        const text = renderMainSession(c!, 'session.jsonl');
        expect(text.indexOf('.claude/rules/a.md')).toBeLessThan(text.indexOf('~/.claude/CLAUDE.md'));
        expect(text).toMatch(/skills: 3 listed, 2 with a description, 1 name only/);
    });
});

describe('hook output visibility', () => {
    // A tool hook's plain stdout reaches the transcript, not the model; only its
    // additionalContext does. SessionStart and UserPromptSubmit stdout is context.
    const lines = [
        LINES[1] as string,
        att({ type: 'hook_success', hookEvent: 'PostToolUse', hookName: 'PostToolUse:Bash', content: 's'.repeat(1000) }),
        att({ type: 'hook_success', hookEvent: 'PostToolUse', hookName: 'PostToolUse:Bash', content: 's'.repeat(1100) }),
        att({ type: 'hook_additional_context', hookEvent: 'PostToolUse', hookName: 'PostToolUse:Bash', content: ['v'.repeat(60)] }),
        att({ type: 'hook_success', hookEvent: 'UserPromptSubmit', hookName: 'UserPromptSubmit', content: 'u'.repeat(20) }),
    ];
    const c = censusMainSession(lines, { home: '/home/u', repo: '/repo' });

    it('keeps stdout and additional context of the same hook in separate buckets', () => {
        const bash = c?.hooks.filter((h) => h.hook === 'PostToolUse:Bash') ?? [];
        expect(bash).toEqual([
            { event: 'PostToolUse', hook: 'PostToolUse:Bash', attachment: 'hook_success', model_visible: false, occurrences: 2, total_chars: 2100, mean_chars: 1050 },
            { event: 'PostToolUse', hook: 'PostToolUse:Bash', attachment: 'hook_additional_context', model_visible: true, occurrences: 1, total_chars: 60, mean_chars: 60 },
        ]);
    });
    it('counts prompt-hook stdout as context in the per-turn total', () => {
        expect(c?.hooks.find((h) => h.hook === 'UserPromptSubmit')?.model_visible).toBe(true);
        expect(c?.totals.per_turn_chars).toBe(20);
    });
    it('marks transcript-only output in the rendered table', () => {
        expect(renderMainSession(c!, 's.jsonl')).toMatch(/1050 chars × {3}2 {2}PostToolUse · PostToolUse:Bash {2}\(stdout, not model-visible\)/);
    });
});

describe('newestTranscript', () => {
    it('picks the newest top-level .jsonl of the project store, never a subagent file', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msc-'));
        tmps.push(dir);
        fs.writeFileSync(path.join(dir, 'old.jsonl'), '');
        fs.writeFileSync(path.join(dir, 'new.jsonl'), '');
        fs.utimesSync(path.join(dir, 'old.jsonl'), new Date(1000), new Date(1000));
        fs.mkdirSync(path.join(dir, 'new', 'subagents'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'new', 'subagents', 'agent-x.jsonl'), '');
        expect(newestTranscript(dir)).toBe(path.join(dir, 'new.jsonl'));
        expect(newestTranscript(path.join(dir, 'missing'))).toBeNull();
    });
});
