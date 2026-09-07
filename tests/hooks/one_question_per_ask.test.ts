// The `one-question-per-ask` PreToolUse guard (road-to-asked-not-parked 5.1).
//
// This drives the concern's own entry-point module, not a detector library
// beside it — the distinction `pre_tool_use_guard_coverage.test.ts` records as
// the difference between a tested detector and a tested guard. The decision
// path that runs in a session is envelope → extract → verdict → exit code, and
// all four links are exercised here.
//
// A guard never seen refuse has unknown sensitivity, so the deny cases come
// first and the allow cases are asserted individually rather than as one
// negative sweep.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    extractAskCall,
    main,
    selfTest,
    verdict,
} from '../../src/scripts/hooks/one_question_per_ask_hook.js';
import {
    clearHookStdinOverride,
    setHookStdinOverride,
} from '../../src/scripts/hooks/hook_stdin.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function run(envelope: unknown): number {
    setHookStdinOverride(JSON.stringify(envelope));
    try {
        return main([]);
    } finally {
        clearHookStdinOverride();
    }
}

describe('one-question-per-ask — the deny path', () => {
    it('blocks a two-question structured-ask call', () => {
        expect(
            run({ tool_name: 'AskUserQuestion', tool_input: { questions: [{}, {}] } }),
        ).toBe(1);
    });

    it('blocks through a nested payload envelope too', () => {
        expect(
            run({
                payload: { tool_name: 'AskUserQuestion', tool_input: { questions: [{}, {}, {}] } },
            }),
        ).toBe(1);
    });

    it('names the count in the reason, so the caller can split the ask', () => {
        const v = verdict({ tool: 'AskUserQuestion', questions: 3 });
        expect(v.block).toBe(true);
        expect(v.reason).toContain('3 questions');
    });

    it('denies rather than truncating — the reason says so', () => {
        // The failure a truncation would cause is invisible: the dropped
        // questions were the decisions the user was owed.
        expect(verdict({ tool: 'AskUserQuestion', questions: 2 }).reason).toContain(
            'denied rather than truncated',
        );
    });
});

describe('one-question-per-ask — the allow path', () => {
    it('passes a one-question call', () => {
        expect(run({ tool_name: 'AskUserQuestion', tool_input: { questions: [{}] } })).toBe(0);
    });

    it('passes a single-question field', () => {
        expect(
            run({ tool_name: 'ask_user_question', tool_input: { question: 'which one?' } }),
        ).toBe(0);
    });

    it('never sees an ordinary tool', () => {
        expect(run({ tool_name: 'Bash', tool_input: { command: 'ls' } })).toBe(0);
        expect(run({ tool_name: 'Write', tool_input: { questions: [{}, {}] } })).toBe(0);
    });

    it('allows an unrecognised payload shape instead of wedging the session', () => {
        expect(run({ tool_name: 'AskUserQuestion', tool_input: { opaque: true } })).toBe(0);
    });

    it('allows empty and malformed stdin', () => {
        setHookStdinOverride('');
        expect(main([])).toBe(0);
        setHookStdinOverride('{not json');
        expect(main([])).toBe(0);
        clearHookStdinOverride();
    });

    it('extracts nothing from an envelope with no tool', () => {
        expect(extractAskCall({})).toEqual({ tool: '', questions: -1 });
    });
});

describe('one-question-per-ask — its own fixtures pass', () => {
    it('--self-test is green', () => {
        expect(selfTest()).toBe(0);
    });
});

describe('one-question-per-ask — manifest wiring', () => {
    const manifest = fs.readFileSync(
        path.join(REPO_ROOT, 'src/scripts/hook_manifest.yaml'),
        'utf8',
    );

    it('is bound on claude`s pre_tool_use list', () => {
        const claude = /\n {2}claude:\n([\s\S]*?)\n {2}[a-z]/.exec(manifest);
        expect(claude).not.toBeNull();
        const pre = /pre_tool_use:\s*\[([^\]]*)\]/.exec(claude?.[1] ?? '');
        expect(pre?.[1]).toContain('one-question-per-ask');
    });

    it('declares a tools: filter — it never sees a call it does not target', () => {
        const block = /\n {2}one-question-per-ask:\n([\s\S]*?)\n {2}[a-z#]/.exec(manifest);
        expect(block?.[1]).toContain('tools:');
        expect(block?.[1]).toContain('AskUserQuestion');
    });

    it('is fail_closed: false — it allows what it cannot parse', () => {
        const block = /\n {2}one-question-per-ask:\n([\s\S]*?)\n {2}[a-z#]/.exec(manifest);
        expect(block?.[1]).toContain('fail_closed: false');
    });
});
