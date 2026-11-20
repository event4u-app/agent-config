// concern_env — the hardened environment is built once per dispatch, and a
// variable one concern sets never reaches the next
// (road-to-a-hook-system-that-pays-for-what-it-does 2.3).
import { spawnSync } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enterConcernEnv, openConcernEnvScope, reportQuietly } from '../../../src/scripts/hooks/concern_env.js';

const ROOT = '/pkg-root';
let saved: NodeJS.ProcessEnv;

beforeEach(() => {
    saved = { ...process.env };
    process.env['LD_PRELOAD'] = '/evil.so';
    process.env['CONCERN_ENV_KEEP'] = 'kept';
});

afterEach(() => {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
});

describe('concern_env — one scope per dispatch', () => {
    it('hardens once: injection vectors are gone inside the scope and back after it', () => {
        const close = openConcernEnvScope(ROOT);
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        expect(process.env['AGENT_CONFIG_PACKAGE_ROOT']).toBe(ROOT);
        expect(process.env['CONCERN_ENV_KEEP']).toBe('kept');
        close();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
        expect(process.env['AGENT_CONFIG_PACKAGE_ROOT']).toBe(saved['AGENT_CONFIG_PACKAGE_ROOT']);
    });

    it('a variable one concern sets, changes or deletes does not reach the next concern', () => {
        const close = openConcernEnvScope(ROOT);
        const leaveA = enterConcernEnv(ROOT);
        process.env['LEAKED_BY_A'] = '1';
        process.env['CONCERN_ENV_KEEP'] = 'changed';
        delete process.env['AGENT_CONFIG_PACKAGE_ROOT'];
        leaveA();
        const leaveB = enterConcernEnv(ROOT);
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
        expect(process.env['CONCERN_ENV_KEEP']).toBe('kept');
        expect(process.env['AGENT_CONFIG_PACKAGE_ROOT']).toBe(ROOT);
        leaveB();
        close();
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
    });

    it('outside a scope, a concern still runs hardened and restores what it found', () => {
        const leave = enterConcernEnv(ROOT);
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        process.env['LEAKED_BY_A'] = '1';
        leave();
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });

    it('a dispatch that throws inside the scope still restores, and the next dispatch opens a real scope', () => {
        const dispatch = (fail: boolean): void => {
            const close = openConcernEnvScope(ROOT);
            try {
                const leave = enterConcernEnv(ROOT);
                process.env['LEAKED_BY_A'] = '1';
                if (fail) throw new Error('concern loop blew up');
                leave();
            } finally {
                close();
            }
        };
        expect(() => dispatch(true)).toThrow(/blew up/);
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
        expect(process.env['LEAKED_BY_A']).toBeUndefined();
        const close = openConcernEnvScope(ROOT);
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        close();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });

    it('an inherited name on the hardened copy does not keep a variable alive', () => {
        const close = openConcernEnvScope(ROOT);
        const leave = enterConcernEnv(ROOT);
        process.env['toString'] = 'set-by-concern';
        leave();
        expect(Object.hasOwn(process.env, 'toString')).toBe(false);
        close();
    });

    it('a re-entrant dispatch is a scope of its own: inner concerns and their children never see the outer concern\'s changes', () => {
        const childSees = (name: string): string =>
            spawnSync(process.execPath, ['-e', `process.stdout.write(process.env[${JSON.stringify(name)}] ?? 'unset')`], { encoding: 'utf-8' }).stdout;
        const closeOuter = openConcernEnvScope(ROOT);
        const leaveOuter = enterConcernEnv(ROOT);
        process.env['OUTER_CONCERN_SET'] = 'outer';
        // The outer concern re-enters dispatch synchronously.
        const closeInner = openConcernEnvScope(ROOT);
        expect(process.env['OUTER_CONCERN_SET']).toBeUndefined();
        expect(childSees('OUTER_CONCERN_SET')).toBe('unset');
        expect(childSees('LD_PRELOAD')).toBe('unset');
        const leaveInnerA = enterConcernEnv(ROOT);
        process.env['INNER_A_SET'] = 'a';
        leaveInnerA();
        const leaveInnerB = enterConcernEnv(ROOT);
        expect(process.env['INNER_A_SET']).toBeUndefined();
        expect(process.env['OUTER_CONCERN_SET']).toBeUndefined();
        leaveInnerB();
        closeInner();
        expect(process.env['OUTER_CONCERN_SET']).toBe('outer'); // the outer concern gets its own env back
        leaveOuter();
        expect(process.env['OUTER_CONCERN_SET']).toBeUndefined(); // and is reset on leaving, as any concern
        closeOuter();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });

    it('a concern never starts on a drifted environment: entry repairs what a failed or skipped reset left', () => {
        const close = openConcernEnvScope(ROOT);
        const leaveA = enterConcernEnv(ROOT);
        leaveA();
        // Whatever left this behind — a reset that threw, dispatcher code between concerns — the next entry clears it.
        process.env['LEFT_BEHIND'] = '1';
        process.env['LD_PRELOAD'] = '/evil.so';
        const leaveB = enterConcernEnv(ROOT);
        expect(process.env['LEFT_BEHIND']).toBeUndefined();
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        leaveB();
        close();
    });

    describe('injected failures', () => {
        const realEnv = process.env;
        let failing = false;
        let writes = 0;
        let failAtWrite: number | null = null;
        /** process.env replaced by a copy whose writes throw while `failing` is on, or at write number `failAtWrite`. */
        const installFailingEnv = (): void => {
            const target: Record<string, string> = { ...(process.env as Record<string, string>) };
            const guard = (): boolean => {
                writes += 1;
                if (failing || writes === failAtWrite) throw new Error('injected env write failure');
                return true;
            };
            process.env = new Proxy(target, {
                set: (t, k, v) => guard() && Reflect.set(t, k, String(v)),
                deleteProperty: (t, k) => guard() && Reflect.deleteProperty(t, k),
            }) as NodeJS.ProcessEnv;
        };
        afterEach(() => {
            failing = false;
            failAtWrite = null;
            process.env = realEnv;
        });

        it('a failed reset marks the scope, and the next entry refuses to start a concern it cannot repair', () => {
            installFailingEnv();
            const close = openConcernEnvScope(ROOT);
            const leaveA = enterConcernEnv(ROOT);
            process.env['LEFT_BY_A'] = '1';
            failing = true;
            expect(() => leaveA()).not.toThrow(); // the reset fails, quietly
            expect(() => enterConcernEnv(ROOT)).toThrow(/injected env write failure/); // the repair fails: no concern starts
            failing = false;
            const leaveB = enterConcernEnv(ROOT); // repair succeeds now
            expect(process.env['LEFT_BY_A']).toBeUndefined();
            leaveB();
            close();
        });

        it('a scope whose hardening fails half-way rolls back what it applied and throws', () => {
            installFailingEnv();
            const before = { ...(process.env as Record<string, string>) };
            writes = 0;
            failAtWrite = 2; // the first write of the hardening lands, the second throws
            expect(() => openConcernEnvScope(ROOT)).toThrow(/injected env write failure/);
            expect(writes).toBeGreaterThan(2); // the rollback ran
            expect({ ...(process.env as Record<string, string>) }).toEqual(before);
            const leave = enterConcernEnv(ROOT); // no scope was left on the stack: the per-concern fallback runs
            expect(process.env['LD_PRELOAD']).toBeUndefined();
            leave();
            expect(process.env['LD_PRELOAD']).toBe('/evil.so');
        });
    });

    it('a release that outlives its scope does nothing', () => {
        const closeOuter = openConcernEnvScope(ROOT);
        const closeInner = openConcernEnvScope(ROOT);
        const staleRelease = enterConcernEnv(ROOT); // bound to the inner scope
        closeInner();
        process.env['OUTER_LEVEL_STATE'] = 'kept';
        staleRelease();
        expect(process.env['OUTER_LEVEL_STATE']).toBe('kept');
        closeOuter();
    });

    it('reporting a cleanup failure never throws, even when stderr does', () => {
        const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => {
            throw new Error('stderr closed');
        });
        try {
            expect(() => reportQuietly('environment restore failed', new Error('x'))).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('closing twice, or out of order, never leaves a scope behind', () => {
        const closeOuter = openConcernEnvScope(ROOT);
        const closeInner = openConcernEnvScope(ROOT);
        closeOuter();
        closeInner();
        closeOuter();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
        const leave = enterConcernEnv(ROOT); // no scope open: the per-concern fallback
        expect(process.env['LD_PRELOAD']).toBeUndefined();
        leave();
        expect(process.env['LD_PRELOAD']).toBe('/evil.so');
    });
});
