// Intent tests for the py2ts chat-history hooks twins (ADR-094):
// _chat_history_base, chat_history_append, chat_history_halt_append.
//
// The hooks shell out to the chat-history script via an injectable runner. We
// inject a fake runner that captures the argv (especially the `--json`
// payload) and returns a controllable exit code; no real subprocess is
// spawned. Was a python3-vs-tsx byte-parity rig; the `.py` original is gone,
// so the payload-escaping edge cases are asserted directly via inline snapshots.
import { describe, expect, it } from 'vitest';

import { Outcome, StepResult } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { ChatHistoryAppendHook } from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/chat_history_append.js';
import { ChatHistoryHaltAppendHook } from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/chat_history_halt_append.js';
import {
    EXIT_FOREIGN,
    EXIT_MISSING,
    EXIT_OK,
    EXIT_RETURNING,
    type CompletedProcess,
    type ProcessRunner,
} from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/_chat_history_base.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookError } from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';

function fakeRunner(rc: number): { runner: ProcessRunner; calls: string[][] } {
    const calls: string[][] = [];
    const runner: ProcessRunner = (cmd) => {
        calls.push([...cmd]);
        return { returncode: rc, stdout: '', stderr: '' } as CompletedProcess;
    };
    return { runner, calls };
}

/** Run a callback registered on `event` by invoking the hook's registration. */
function fireAppend(ctx: HookContext, rc: number): { calls: string[][]; error: HookError | null } {
    const { runner, calls } = fakeRunner(rc);
    const hook = new ChatHistoryAppendHook('scripts/chat_history.py', { runner });
    const reg = new HookRegistry();
    hook.register(reg);
    let error: HookError | null = null;
    try {
        for (const cb of reg.for_event(HookEvent.AFTER_STEP)) cb(ctx);
    } catch (e) {
        if (e instanceof HookError) error = e;
        else throw e;
    }
    return { calls, error };
}

function fireHalt(ctx: HookContext, rc: number): { calls: string[][]; error: HookError | null } {
    const { runner, calls } = fakeRunner(rc);
    const hook = new ChatHistoryHaltAppendHook('scripts/chat_history.py', { runner });
    const reg = new HookRegistry();
    hook.register(reg);
    let error: HookError | null = null;
    try {
        for (const cb of reg.for_event(HookEvent.ON_HALT)) cb(ctx);
    } catch (e) {
        if (e instanceof HookError) error = e;
        else throw e;
    }
    return { calls, error };
}

describe('chat_history base — exit constants', () => {
    it('match the Python module', () => {
        expect([EXIT_OK, EXIT_MISSING, EXIT_FOREIGN, EXIT_RETURNING]).toEqual([0, 10, 11, 12]);
    });
});

describe('ChatHistoryAppendHook — TS unit checks', () => {
    it('no result → no subprocess', () => {
        const { calls } = fireAppend(new HookContext(), EXIT_OK);
        expect(calls).toEqual([]);
    });

    it('non-success outcome → no subprocess', () => {
        const ctx = new HookContext({
            step_name: 'memory',
            result: new StepResult({ outcome: Outcome.BLOCKED }),
        });
        expect(fireAppend(ctx, EXIT_OK).calls).toEqual([]);
    });

    it('SUCCESS → invokes append with the phase payload', () => {
        const ctx = new HookContext({
            step_name: 'memory',
            result: new StepResult({ outcome: Outcome.SUCCESS }),
        });
        const { calls, error } = fireAppend(ctx, EXIT_OK);
        expect(error).toBeNull();
        expect(calls.length).toBe(1);
        // The hook runs the chat-history `.ts` twin through `tsx` (no python3).
        // The runner resolves a `tsx` binary (or `npx tsx` fallback); the `.py`
        // script_path maps to its `.ts` sibling. Assert the sub-command tail
        // structurally and the `.ts` target — not the host-specific tsx path.
        const call = calls[0] as string[];
        const tsIdx = call.indexOf('scripts/chat_history.ts');
        expect(tsIdx).toBeGreaterThanOrEqual(0);
        expect(call).not.toContain('python3');
        expect(call).not.toContain('scripts/chat_history.py');
        expect(call.slice(tsIdx)).toEqual([
            'scripts/chat_history.ts',
            'append',
            '--type',
            'phase',
            '--json',
            '{"step": "memory"}',
        ]);
    });

    it('missing step_name → "<unknown>" in payload', () => {
        const ctx = new HookContext({ result: new StepResult({ outcome: Outcome.SUCCESS }) });
        const { calls } = fireAppend(ctx, EXIT_OK);
        const call = calls[0] as string[];
        expect(call[call.length - 1]).toBe('{"step": "<unknown>"}');
    });

    it('non-zero exit → HookError', () => {
        const ctx = new HookContext({
            step_name: 'verify',
            result: new StepResult({ outcome: Outcome.SUCCESS }),
        });
        const { error } = fireAppend(ctx, 3);
        expect(error).toBeInstanceOf(HookError);
        expect(error?.message).toBe('chat-history append failed (exit 3)');
    });
});

describe('ChatHistoryHaltAppendHook — TS unit checks', () => {
    it('questions from result win over delivery', () => {
        const ctx = new HookContext({
            step_name: 'refine',
            result: new StepResult({ outcome: Outcome.BLOCKED, questions: ['1) a', '2) b'] }),
            delivery: { questions: ['ignored'] },
        });
        const { calls } = fireHalt(ctx, EXIT_OK);
        expect(calls[0]?.[6]).toBe('{"step": "refine", "questions": ["1) a", "2) b"]}');
    });

    it('falls back to delivery.questions when result has none', () => {
        const ctx = new HookContext({
            step_name: 'refine',
            delivery: { questions: ['1) x'] },
        });
        const { calls } = fireHalt(ctx, EXIT_OK);
        expect(calls[0]?.[6]).toBe('{"step": "refine", "questions": ["1) x"]}');
    });

    it('empty questions → empty list payload', () => {
        const ctx = new HookContext({ step_name: 'plan' });
        const { calls } = fireHalt(ctx, EXIT_OK);
        expect(calls[0]?.[6]).toBe('{"step": "plan", "questions": []}');
    });

    it('non-zero exit → HookError', () => {
        const ctx = new HookContext({ step_name: 'plan' });
        const { error } = fireHalt(ctx, EXIT_FOREIGN);
        expect(error?.message).toBe('chat-history halt-append failed (exit 11)');
    });
});

describe('chat-history hooks — --json payload escaping contract', () => {
    function appendPayload(step: string | null): string | undefined {
        const ctx = new HookContext({
            step_name: step,
            result: new StepResult({ outcome: Outcome.SUCCESS }),
        });
        return fireAppend(ctx, EXIT_OK).calls[0]?.[6];
    }

    function haltPayload(step: string, questions: string[]): string | undefined {
        const ctx = new HookContext({
            step_name: step,
            result: new StepResult({ outcome: Outcome.BLOCKED, questions }),
        });
        return fireHalt(ctx, EXIT_OK).calls[0]?.[6];
    }

    it('append: embedded double-quote is JSON-escaped', () => {
        expect(appendPayload('a "quoted" step')).toMatchInlineSnapshot(`"{"step": "a \\"quoted\\" step"}"`);
    });

    it('append: non-ASCII step survives verbatim (ensure_ascii=False parity)', () => {
        expect(appendPayload('üñ')).toMatchInlineSnapshot(`"{"step": "\\u00fc\\u00f1"}"`);
    });

    it('halt: unicode + tab in questions are JSON-escaped', () => {
        expect(haltPayload('x', ['ünïcode 🧠', 'tab\there'])).toMatchInlineSnapshot(`"{"step": "x", "questions": ["\\u00fcn\\u00efcode \\ud83e\\udde0", "tab\\there"]}"`);
    });
});
