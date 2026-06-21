// Golden-parity + unit tests for the py2ts work_engine.hooks `runner` twin
// (ADR-094). Exercises the three-tier error contract:
//   HookError  → swallowed (warned), dispatch continues, emit returns null.
//   HookHalt   → returned immediately, remaining callbacks skipped.
//   other Err  → propagates unchanged.
//
// The runner emits its non-fatal warning via `warnings.warn` (Python) /
// `process.stderr` (TS). That surface format is interpreter-internal and not
// portable, so the parity layer asserts the *behavioural* contract (swallow +
// continue + return value) and that *a* warning was emitted — it does not
// byte-compare the warning text. Documented divergence per ADR-094 §6.
import { describe, expect, it } from 'vitest';

import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookError, HookHalt } from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';
import { HookRunner } from '../../../src/agent-src/templates/scripts/work_engine/hooks/runner.js';
import { hasPython3, runPyHooks } from './_hooks_pyloader.js';

const describePy = hasPython3() ? describe : describe.skip;

function quietRunner(registry: HookRegistry): { runner: HookRunner; warnings: string[] } {
    const warnings: string[] = [];
    class QuietRunner extends HookRunner {
        protected override warn(message: string): void {
            warnings.push(message);
        }
    }
    return { runner: new QuietRunner(registry), warnings };
}

describe('work_engine.hooks.runner — TS unit checks', () => {
    it('no callbacks → emit returns null (fast path)', () => {
        const { runner } = quietRunner(new HookRegistry());
        expect(runner.emit(HookEvent.AFTER_STEP, new HookContext())).toBeNull();
    });

    it('all callbacks succeed → returns null, all fire', () => {
        const reg = new HookRegistry();
        const seen: number[] = [];
        reg.register(HookEvent.AFTER_STEP, () => seen.push(1));
        reg.register(HookEvent.AFTER_STEP, () => seen.push(2));
        const { runner } = quietRunner(reg);
        expect(runner.emit(HookEvent.AFTER_STEP, new HookContext())).toBeNull();
        expect(seen).toEqual([1, 2]);
    });

    it('HookError is swallowed + warned; dispatch continues', () => {
        const reg = new HookRegistry();
        const seen: number[] = [];
        reg.register(HookEvent.AFTER_STEP, () => {
            throw new HookError('boom');
        });
        reg.register(HookEvent.AFTER_STEP, () => seen.push(2));
        const { runner, warnings } = quietRunner(reg);
        expect(runner.emit(HookEvent.AFTER_STEP, new HookContext())).toBeNull();
        expect(seen).toEqual([2]); // continued past the failing callback
        expect(warnings).toEqual(['hook after_step raised HookError: boom']);
    });

    it('HookHalt is returned; remaining callbacks skipped', () => {
        const reg = new HookRegistry();
        const seen: number[] = [];
        const halt = new HookHalt('foreign', ['1) a']);
        reg.register(HookEvent.ON_HALT, () => {
            throw halt;
        });
        reg.register(HookEvent.ON_HALT, () => seen.push(2));
        const { runner } = quietRunner(reg);
        const ret = runner.emit(HookEvent.ON_HALT, new HookContext());
        expect(ret).toBe(halt);
        expect(ret?.reason).toBe('foreign');
        expect(ret?.surface).toEqual(['1) a']);
        expect(seen).toEqual([]); // skipped
    });

    it('non-signal error propagates unchanged', () => {
        const reg = new HookRegistry();
        reg.register(HookEvent.AFTER_STEP, () => {
            throw new TypeError('bug');
        });
        const { runner } = quietRunner(reg);
        expect(() => runner.emit(HookEvent.AFTER_STEP, new HookContext())).toThrow(TypeError);
    });

    it('registry getter exposes the underlying registry for late registration', () => {
        const reg = new HookRegistry();
        const runner = new HookRunner(reg);
        expect(runner.registry).toBe(reg);
        const seen: number[] = [];
        runner.registry.register(HookEvent.BEFORE_STEP, () => seen.push(1));
        runner.emit(HookEvent.BEFORE_STEP, new HookContext());
        expect(seen).toEqual([1]);
    });

    it('default constructor builds its own empty registry', () => {
        const runner = new HookRunner();
        expect(runner.emit(HookEvent.AFTER_STEP, new HookContext())).toBeNull();
    });

    it('default warn emits the message line to stderr (write seam)', () => {
        // Drive the real `warn` seam through a HookRunner whose stderr write is
        // redirected to a collector, proving the default path emits the exact
        // message line `hook <event> raised HookError: <msg>\n`.
        const reg = new HookRegistry();
        reg.register(HookEvent.AFTER_STEP, () => {
            throw new HookError('xyz');
        });
        const collected: string[] = [];
        const orig = process.stderr.write.bind(process.stderr);
        (process.stderr as unknown as { write: (s: string) => boolean }).write = (s: string) => {
            collected.push(s);
            return true;
        };
        try {
            new HookRunner(reg).emit(HookEvent.AFTER_STEP, new HookContext());
        } finally {
            (process.stderr as unknown as { write: typeof orig }).write = orig;
        }
        expect(collected).toContain('hook after_step raised HookError: xyz\n');
    });
});

describePy('work_engine.hooks.runner — behavioural parity (python3 vs TS)', () => {
    it('HookError swallowed → continue + return None + warn emitted', () => {
        const r = runPyHooks(
            { foundation: ['exceptions', 'context', 'events', 'registry', 'runner'] },
            [
                'import warnings',
                'reg = registry.HookRegistry()',
                'seen = []',
                'def bad(c): raise exceptions.HookError("boom")',
                'reg.register(events.HookEvent.AFTER_STEP, bad)',
                'reg.register(events.HookEvent.AFTER_STEP, lambda c: seen.append(2))',
                'run = runner.HookRunner(reg)',
                'with warnings.catch_warnings(record=True) as w:',
                '    warnings.simplefilter("always")',
                '    ret = run.emit(events.HookEvent.AFTER_STEP, context.HookContext())',
                'print(json.dumps({"ret_is_none": ret is None, "seen": seen, "nwarn": len(w), "msg": str(w[0].message) if w else None}))',
            ].join('\n'),
        );
        expect(r.status).toBe(0);
        const py = JSON.parse(r.stdout.trim()) as Record<string, unknown>;
        expect(py['ret_is_none']).toBe(true);
        expect(py['seen']).toEqual([2]);
        expect(py['nwarn']).toBe(1);
        expect(py['msg']).toBe('hook after_step raised HookError: boom');

        // TS analog (same observable behaviour + same warning message text).
        const reg = new HookRegistry();
        const seen: number[] = [];
        reg.register(HookEvent.AFTER_STEP, () => {
            throw new HookError('boom');
        });
        reg.register(HookEvent.AFTER_STEP, () => seen.push(2));
        const { runner, warnings } = quietRunner(reg);
        const ret = runner.emit(HookEvent.AFTER_STEP, new HookContext());
        expect(ret).toBeNull();
        expect(seen).toEqual([2]);
        expect(warnings).toEqual(['hook after_step raised HookError: boom']);
    });

    it('HookHalt returned + skips rest; non-signal error propagates', () => {
        const r = runPyHooks(
            { foundation: ['exceptions', 'context', 'events', 'registry', 'runner'] },
            [
                'reg = registry.HookRegistry()',
                'seen = []',
                'def halt(c): raise exceptions.HookHalt("foreign", ["1) a"])',
                'reg.register(events.HookEvent.ON_HALT, halt)',
                'reg.register(events.HookEvent.ON_HALT, lambda c: seen.append(2))',
                'run = runner.HookRunner(reg)',
                'ret = run.emit(events.HookEvent.ON_HALT, context.HookContext())',
                'reg2 = registry.HookRegistry()',
                'def bug(c): raise TypeError("bug")',
                'reg2.register(events.HookEvent.AFTER_STEP, bug)',
                'run2 = runner.HookRunner(reg2)',
                'propagated = False',
                'try:',
                '    run2.emit(events.HookEvent.AFTER_STEP, context.HookContext())',
                'except TypeError:',
                '    propagated = True',
                'print(json.dumps({"reason": ret.reason, "surface": ret.surface, "seen": seen, "propagated": propagated}))',
            ].join('\n'),
        );
        expect(r.status).toBe(0);
        const py = JSON.parse(r.stdout.trim()) as Record<string, unknown>;
        expect(py['reason']).toBe('foreign');
        expect(py['surface']).toEqual(['1) a']);
        expect(py['seen']).toEqual([]);
        expect(py['propagated']).toBe(true);
    });
});
