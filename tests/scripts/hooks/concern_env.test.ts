// concern_env — the hardened environment is built once per dispatch, and a
// variable one concern sets never reaches the next
// (road-to-a-hook-system-that-pays-for-what-it-does 2.3).
import { spawnSync } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertConcernEnvRestored, enterConcernEnv, openConcernEnvScope, reportQuietly } from '../../../src/scripts/hooks/concern_env.js';

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

        it('when the rollback fails too, the original error propagates and the rollback failure is reported', () => {
            installFailingEnv();
            const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
            try {
                writes = 0;
                failing = false;
                failAtWrite = 2;
                // Fail every write from the second on: hardening and rollback both fail.
                const orig = failAtWrite;
                failAtWrite = null;
                let n = 0;
                let armed = true;
                process.env = new Proxy({ ...(process.env as Record<string, string>) }, {
                    set: (t, k, v) => { n += 1; if (armed && n >= orig) throw new Error('injected env write failure'); return Reflect.set(t, k, String(v)); },
                    deleteProperty: (t, k) => { n += 1; if (armed && n >= orig) throw new Error('injected env write failure'); return Reflect.deleteProperty(t, k); },
                }) as NodeJS.ProcessEnv;
                expect(() => openConcernEnvScope(ROOT)).toThrow(/injected env write failure/);
                expect(spy.mock.calls.some((c) => String(c[0]).includes('environment rollback failed'))).toBe(true);
                armed = false;
                openConcernEnvScope(ROOT)(); // pay the owed restore so no later test inherits it
            } finally {
                spy.mockRestore();
            }
        });

        it('a failed closing restore makes the dispatch refuse, without masking an error already in flight', () => {
            installFailingEnv();
            const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
            try {
                // No error in flight: the close fails, and the check after the finally throws.
                const close = openConcernEnvScope(ROOT);
                failing = true;
                close();
                failing = false;
                expect(() => assertConcernEnvRestored()).toThrow(/concern environment not restored/);
                expect(() => assertConcernEnvRestored()).not.toThrow(); // the mark is cleared
                // An error in flight: it propagates unchanged, and the close's failure does not replace it.
                const dispatch = (): void => {
                    const c = openConcernEnvScope(ROOT);
                    try {
                        failing = true;
                        throw new Error('the dispatch error');
                    } finally {
                        c();
                        failing = false;
                    }
                };
                expect(() => dispatch()).toThrow(/the dispatch error/);
            } finally {
                spy.mockRestore();
                try { assertConcernEnvRestored(); } catch { /* cleared for the next test */ }
            }
        });

        it('a failed close during an error in flight is recovered by the next dispatch in the same process', () => {
            installFailingEnv();
            const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
            try {
                const before = { ...(process.env as Record<string, string>) };
                const dispatch = (fault: boolean): void => {
                    const close = openConcernEnvScope(ROOT);
                    try {
                        const leave = enterConcernEnv(ROOT);
                        process.env['LEFT_BY_FIRST'] = '1';
                        if (fault) {
                            failing = true;
                            throw new Error('the dispatch error');
                        }
                        leave();
                    } finally {
                        close();
                        failing = false;
                    }
                    assertConcernEnvRestored();
                };
                // The first dispatch dies with its own error; the assert after its finally never runs.
                expect(() => dispatch(true)).toThrow(/the dispatch error/);
                expect(process.env['LD_PRELOAD']).toBeUndefined(); // the close could not put it back
                // The second dispatch, nothing drained by hand: it recovers first, so its concerns
                // start from the real baseline, and its own verdict is not refused for the first one's fault.
                let seenByConcern: string | undefined = 'not reached';
                const close = openConcernEnvScope(ROOT);
                try {
                    const leave = enterConcernEnv(ROOT);
                    seenByConcern = process.env['LEFT_BY_FIRST'];
                    leave();
                } finally {
                    close();
                }
                expect(() => assertConcernEnvRestored()).not.toThrow();
                expect(seenByConcern).toBeUndefined();
                expect({ ...(process.env as Record<string, string>) }).toEqual(before);
            } finally {
                spy.mockRestore();
            }
        });

        it('when the owed restore still cannot be made, the next scope refuses to open', () => {
            installFailingEnv();
            const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
            try {
                const close = openConcernEnvScope(ROOT);
                failing = true;
                close();
                expect(() => openConcernEnvScope(ROOT)).toThrow(/injected env write failure/);
                expect(() => enterConcernEnv(ROOT)).toThrow(/injected env write failure/); // the fallback path too
                failing = false;
                const again = openConcernEnvScope(ROOT); // recovers now
                expect(process.env['LD_PRELOAD']).toBeUndefined();
                again();
                expect(process.env['LD_PRELOAD']).toBe('/evil.so');
                expect(() => assertConcernEnvRestored()).not.toThrow();
            } finally {
                spy.mockRestore();
            }
        });

        it('a half-applied open whose rollback fails owes the baseline: the next open refuses until it can recover it', () => {
            installFailingEnv();
            const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
            try {
                const before = { ...(process.env as Record<string, string>) };
                let armed = true;
                let landed = 0;
                process.env = new Proxy({ ...before }, {
                    set: (t, k, v) => { if (armed && landed >= 1) throw new Error('injected env write failure'); landed += 1; return Reflect.set(t, k, String(v)); },
                    deleteProperty: (t, k) => { if (armed && landed >= 1) throw new Error('injected env write failure'); landed += 1; return Reflect.deleteProperty(t, k); },
                }) as NodeJS.ProcessEnv;
                // Open: one hardening write lands, the next throws, the rollback throws too.
                expect(() => openConcernEnvScope(ROOT)).toThrow(/injected env write failure/);
                expect({ ...(process.env as Record<string, string>) }).not.toEqual(before); // left dirty
                // The next dispatch, writes still failing: it refuses instead of hardening from the dirty state.
                expect(() => openConcernEnvScope(ROOT)).toThrow(/injected env write failure/);
                // Writes work again: the next open replays the owed baseline, and its close returns to it.
                armed = false;
                const close = openConcernEnvScope(ROOT);
                expect(process.env['LD_PRELOAD']).toBeUndefined();
                close();
                expect({ ...(process.env as Record<string, string>) }).toEqual(before);
                expect(() => assertConcernEnvRestored()).not.toThrow();
            } finally {
                spy.mockRestore();
            }
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
