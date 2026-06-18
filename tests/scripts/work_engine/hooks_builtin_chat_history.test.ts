// Golden-parity + unit tests for the py2ts chat-history hooks twins (ADR-094):
// _chat_history_base, chat_history_append, chat_history_halt_append.
//
// The hooks shell out to scripts/chat_history.py via an injectable runner. We
// inject a fake runner on both engines that captures the argv (especially the
// `--json` payload, which must be byte-identical to Python's json.dumps) and
// returns a controllable exit code. No real subprocess is spawned.
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
import { hasPython3, runPyHooks } from './_hooks_pyloader.js';

const describePy = hasPython3() ? describe : describe.skip;

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

describePy('chat-history hooks — payload parity (python3 vs TS)', () => {
    function pyAppendPayload(stepName: string | null): string {
        const stepArg = stepName === null ? 'None' : JSON.stringify(stepName);
        const r = runPyHooks(
            {
                we: ['delivery_state'],
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['_chat_history_base', 'chat_history_append'],
            },
            [
                'captured = {}',
                'def fake(cmd):',
                '    captured["cmd"] = list(cmd)',
                '    import types',
                '    return types.SimpleNamespace(returncode=0, stdout="", stderr="")',
                'hook = chat_history_append.ChatHistoryAppendHook("scripts/chat_history.py", runner=fake)',
                'Outcome = sys.modules["work_engine.delivery_state"].Outcome',
                'StepResult = sys.modules["work_engine.delivery_state"].StepResult',
                `ctx = context.HookContext(step_name=${stepArg}, result=StepResult(outcome=Outcome.SUCCESS))`,
                'hook._on_after_step(ctx)',
                'print(captured["cmd"][6])',
            ].join('\n'),
        );
        if (r.status !== 0) throw new Error(`py append failed: ${r.stderr || r.stdout}`);
        return r.stdout.replace(/\n$/, '');
    }

    function pyHaltPayload(stepName: string, questions: string[]): string {
        const r = runPyHooks(
            {
                we: ['delivery_state'],
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['_chat_history_base', 'chat_history_halt_append'],
            },
            [
                'captured = {}',
                'def fake(cmd):',
                '    captured["cmd"] = list(cmd)',
                '    import types',
                '    return types.SimpleNamespace(returncode=0, stdout="", stderr="")',
                'hook = chat_history_halt_append.ChatHistoryHaltAppendHook("scripts/chat_history.py", runner=fake)',
                'StepResult = sys.modules["work_engine.delivery_state"].StepResult',
                'Outcome = sys.modules["work_engine.delivery_state"].Outcome',
                `ctx = context.HookContext(step_name=${JSON.stringify(stepName)}, result=StepResult(outcome=Outcome.BLOCKED, questions=${JSON.stringify(questions)}))`,
                'hook._on_halt(ctx)',
                'print(captured["cmd"][6])',
            ].join('\n'),
        );
        if (r.status !== 0) throw new Error(`py halt failed: ${r.stderr || r.stdout}`);
        return r.stdout.replace(/\n$/, '');
    }

    it('append --json payload is byte-identical', () => {
        for (const step of ['memory', 'a "quoted" step', 'üñ', null] as Array<string | null>) {
            const ctx = new HookContext({
                step_name: step,
                result: new StepResult({ outcome: Outcome.SUCCESS }),
            });
            const tsPayload = fireAppend(ctx, EXIT_OK).calls[0]?.[6];
            expect(tsPayload).toBe(pyAppendPayload(step));
        }
    });

    it('halt --json payload is byte-identical', () => {
        const cases: Array<[string, string[]]> = [
            ['refine', ['1) a', '2) b']],
            ['plan', []],
            ['x', ['ünïcode 🧠', 'tab\there']],
        ];
        for (const [step, qs] of cases) {
            const ctx = new HookContext({
                step_name: step,
                result: new StepResult({ outcome: Outcome.BLOCKED, questions: qs }),
            });
            const tsPayload = fireHalt(ctx, EXIT_OK).calls[0]?.[6];
            expect(tsPayload).toBe(pyHaltPayload(step, qs));
        }
    });

    it('exit constants match Python', () => {
        const r = runPyHooks(
            {
                we: ['delivery_state'],
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['_chat_history_base'],
            },
            'print(json.dumps([_chat_history_base.EXIT_OK, _chat_history_base.EXIT_MISSING, _chat_history_base.EXIT_FOREIGN, _chat_history_base.EXIT_RETURNING]))',
        );
        expect(r.status).toBe(0);
        expect(JSON.parse(r.stdout.trim())).toEqual([EXIT_OK, EXIT_MISSING, EXIT_FOREIGN, EXIT_RETURNING]);
    });
});
