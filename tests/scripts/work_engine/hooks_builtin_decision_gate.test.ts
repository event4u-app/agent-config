// Golden-parity + unit tests for the py2ts decision_gate hook twin (ADR-094).
// Bridges scoring.decision_engine into the AFTER_STEP hook bus. The HookHalt
// surface (numbered options) and HookError reason text must be byte-identical.
import { describe, expect, it } from 'vitest';

import {
    DecisionGateHook,
    build_decision_gate_hook,
} from '../../../src/agent-src/templates/scripts/work_engine/hooks/builtin/decision_gate.js';
import { DecisionEngineSettings } from '../../../src/agent-src/templates/scripts/work_engine/scoring/decision_engine.js';
import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookError, HookHalt } from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';
import { hasPython3, runPyHooks } from './_hooks_pyloader.js';

const describePy = hasPython3() ? describe : describe.skip;

interface Fired {
    halt: HookHalt | null;
    error: HookError | null;
}

function fire(settings: DecisionEngineSettings, ctx: HookContext): Fired {
    const hook = new DecisionGateHook(settings);
    const reg = new HookRegistry();
    hook.register(reg);
    const out: Fired = { halt: null, error: null };
    try {
        for (const cb of reg.for_event(HookEvent.AFTER_STEP)) cb(ctx);
    } catch (e) {
        if (e instanceof HookHalt) out.halt = e;
        else if (e instanceof HookError) out.error = e;
        else throw e;
    }
    return out;
}

// require_memory_hits gate owns the `refine` phase; empty memory triggers it.
const refineCtx = new HookContext({ step_name: 'refine', delivery: { memory: [] } });

describe('DecisionGateHook — TS unit checks', () => {
    it('no active gate → short-circuit, nothing thrown', () => {
        const out = fire(new DecisionEngineSettings(), refineCtx);
        expect(out.halt).toBeNull();
        expect(out.error).toBeNull();
    });

    it('no step_name → no-op', () => {
        const out = fire(
            new DecisionEngineSettings({ require_memory_hits: true }),
            new HookContext({ delivery: { memory: [] } }),
        );
        expect(out.halt).toBeNull();
        expect(out.error).toBeNull();
    });

    it('on_block=stop → HookHalt with numbered-option surface', () => {
        const out = fire(
            new DecisionEngineSettings({ require_memory_hits: true, on_block: 'stop' }),
            refineCtx,
        );
        expect(out.halt).toBeInstanceOf(HookHalt);
        expect(out.halt?.reason).toBe('decision_gate:require_memory_hits');
        expect(out.halt?.surface).toEqual([
            'Decision-engine gate fired: require_memory_hits (phase=refine)',
            'Reason: memory_hits=0 but require_memory_hits=true (need >= 1)',
            '1) Address the gate condition and resume.',
            '2) Lower the gate in `.agent-settings.yml` (`decision_engine` block) and resume.',
            '3) Abort the run.',
        ]);
    });

    it('on_block=warn → HookError with the reason tag', () => {
        const out = fire(
            new DecisionEngineSettings({ require_memory_hits: true, on_block: 'warn' }),
            refineCtx,
        );
        expect(out.error).toBeInstanceOf(HookError);
        expect(out.error?.message).toBe(
            'decision_gate:require_memory_hits — memory_hits=0 but require_memory_hits=true (need >= 1)',
        );
    });

    it('gate satisfied (memory present) → no halt', () => {
        const out = fire(
            new DecisionEngineSettings({ require_memory_hits: true, on_block: 'stop' }),
            new HookContext({ step_name: 'refine', delivery: { memory: [{ id: 'r1', hit: true }] } }),
        );
        expect(out.halt).toBeNull();
        expect(out.error).toBeNull();
    });

    it('build_decision_gate_hook returns null on inactive / non-settings input', () => {
        expect(build_decision_gate_hook(null)).toBeNull();
        expect(build_decision_gate_hook(new DecisionEngineSettings())).toBeNull();
        expect(build_decision_gate_hook({} as unknown)).toBeNull();
        expect(
            build_decision_gate_hook(new DecisionEngineSettings({ require_memory_hits: true })),
        ).toBeInstanceOf(DecisionGateHook);
    });
});

describePy('DecisionGateHook — surface/reason parity (python3 vs TS)', () => {
    function pyFire(deKwargs: string, ctxExpr: string): { kind: string; reason: string; surface: string[] | null } {
        const r = runPyHooks(
            {
                we: ['scoring.decision_engine', 'scoring.decision_trace'],
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['decision_gate'],
            },
            [
                'de = sys.modules["work_engine.scoring.decision_engine"]',
                `settings = de.DecisionEngineSettings(${deKwargs})`,
                'hook = decision_gate.DecisionGateHook(settings)',
                `ctx = ${ctxExpr}`,
                'kind, reason, surface = "none", "", None',
                'try:',
                '    hook._evaluate(ctx)',
                'except exceptions.HookHalt as h:',
                '    kind, reason, surface = "halt", h.reason, list(h.surface)',
                'except exceptions.HookError as e:',
                '    kind, reason = "error", str(e)',
                'print(json.dumps({"kind": kind, "reason": reason, "surface": surface}))',
            ].join('\n'),
        );
        if (r.status !== 0) throw new Error(`py gate failed: ${r.stderr || r.stdout}`);
        return JSON.parse(r.stdout.trim());
    }

    const ctxExpr = "context.HookContext(step_name='refine', delivery=type('D',(),{'memory':[]})())";

    it('on_block=stop surface matches byte-for-byte', () => {
        const py = pyFire('require_memory_hits=True, on_block="stop"', ctxExpr);
        const ts = fire(
            new DecisionEngineSettings({ require_memory_hits: true, on_block: 'stop' }),
            refineCtx,
        );
        expect(py.kind).toBe('halt');
        expect(ts.halt?.reason).toBe(py.reason);
        expect(ts.halt?.surface).toEqual(py.surface);
    });

    it('on_block=warn reason matches', () => {
        const py = pyFire('require_memory_hits=True, on_block="warn"', ctxExpr);
        const ts = fire(
            new DecisionEngineSettings({ require_memory_hits: true, on_block: 'warn' }),
            refineCtx,
        );
        expect(py.kind).toBe('error');
        expect(ts.error?.message).toBe(py.reason);
    });

    it('ask_timeout (CI) → halt with [ask_timeout] suffix, surface matches', () => {
        // Force non-interactive: on_block=ask + CI env → ask_timeout; fallback
        // stop → HookHalt with the ask_timeout suffix.
        const prevCI = process.env.CI;
        process.env.CI = '1';
        try {
            const py = pyFireWithCI('require_memory_hits=True, on_block="ask", on_block_fallback="stop"', ctxExpr);
            const ts = fire(
                new DecisionEngineSettings({
                    require_memory_hits: true,
                    on_block: 'ask',
                    on_block_fallback: 'stop',
                }),
                refineCtx,
            );
            expect(py.kind).toBe('halt');
            expect(ts.halt?.reason).toBe('decision_gate:require_memory_hits:ask_timeout');
            expect(ts.halt?.reason).toBe(py.reason);
            expect(ts.halt?.surface).toEqual(py.surface);
        } finally {
            if (prevCI === undefined) delete process.env.CI;
            else process.env.CI = prevCI;
        }
    });

    function pyFireWithCI(
        deKwargs: string,
        ctxExpr2: string,
    ): { kind: string; reason: string; surface: string[] | null } {
        const r = runPyHooks(
            {
                we: ['scoring.decision_engine', 'scoring.decision_trace'],
                foundation: ['exceptions', 'context', 'events', 'registry'],
                builtin: ['decision_gate'],
            },
            [
                'os.environ["CI"] = "1"',
                'de = sys.modules["work_engine.scoring.decision_engine"]',
                `settings = de.DecisionEngineSettings(${deKwargs})`,
                'hook = decision_gate.DecisionGateHook(settings)',
                `ctx = ${ctxExpr2}`,
                'kind, reason, surface = "none", "", None',
                'try:',
                '    hook._evaluate(ctx)',
                'except exceptions.HookHalt as h:',
                '    kind, reason, surface = "halt", h.reason, list(h.surface)',
                'except exceptions.HookError as e:',
                '    kind, reason = "error", str(e)',
                'print(json.dumps({"kind": kind, "reason": reason, "surface": surface}))',
            ].join('\n'),
        );
        if (r.status !== 0) throw new Error(`py gate(CI) failed: ${r.stderr || r.stdout}`);
        return JSON.parse(r.stdout.trim());
    }
});
