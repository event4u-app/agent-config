// Intent tests for the py2ts decision_gate hook twin (ADR-094). Bridges
// scoring.decision_engine into the AFTER_STEP hook bus. The HookHalt surface
// (numbered options) and HookError reason text are asserted directly below.
// Was a python3-vs-tsx parity rig; the `.py` original is gone, so the one
// parity scenario the unit checks did not cover — the non-interactive
// `on_block=ask` ask-timeout fallback under CI — is preserved as a python-free
// assertion of the tsx halt surface.
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

    it('on_block=ask under CI → ask-timeout fallback halt (reason suffix + surface)', () => {
        // Non-interactive (CI) makes on_block=ask time out → falls back to stop,
        // producing a HookHalt whose reason carries the `:ask_timeout` suffix.
        const prevCI = process.env.CI;
        process.env.CI = '1';
        try {
            const out = fire(
                new DecisionEngineSettings({
                    require_memory_hits: true,
                    on_block: 'ask',
                    on_block_fallback: 'stop',
                }),
                refineCtx,
            );
            expect(out.halt).toBeInstanceOf(HookHalt);
            expect(out.halt?.reason).toBe('decision_gate:require_memory_hits:ask_timeout');
            expect(out.halt?.surface).toMatchInlineSnapshot(`
              [
                "Decision-engine gate fired: require_memory_hits (phase=refine) [ask_timeout]",
                "Reason: memory_hits=0 but require_memory_hits=true (need >= 1)",
                "1) Address the gate condition and resume.",
                "2) Lower the gate in \`.agent-settings.yml\` (\`decision_engine\` block) and resume.",
                "3) Abort the run.",
              ]
            `);
        } finally {
            if (prevCI === undefined) delete process.env.CI;
            else process.env.CI = prevCI;
        }
    });
});
