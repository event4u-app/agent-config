// Intent tests for the py2ts work_engine.hooks `runner` twin
// (ADR-094). Exercises the three-tier error contract:
//   HookError  → swallowed (warned), dispatch continues, emit returns null.
//   HookHalt   → returned immediately, remaining callbacks skipped.
//   other Err  → propagates unchanged.
//
// Was a python3-vs-tsx parity rig; the `.py` original is gone, so this asserts
// the tsx runner's own contract directly. The runner emits its non-fatal
// warning via `process.stderr` (TS); that surface is asserted via the `warn`
// seam + a stderr collector below. (The former parity block only re-checked
// the swallow/continue/return behaviour the unit checks already cover.)
import { describe, expect, it } from 'vitest';

import { HookContext } from '../../../src/agent-src/templates/scripts/work_engine/hooks/context.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/events.js';
import { HookError, HookHalt } from '../../../src/agent-src/templates/scripts/work_engine/hooks/exceptions.js';
import { HookRegistry } from '../../../src/agent-src/templates/scripts/work_engine/hooks/registry.js';
import { HookRunner } from '../../../src/agent-src/templates/scripts/work_engine/hooks/runner.js';

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
