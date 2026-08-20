
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { run, statePathFor } from '../../../src/scripts/before_complete_hook.js';

/**
 * Read one SESSION's state, through the producer's own path builder.
 *
 * The default matches `envelope`'s default id below: state is per-session
 * now, so a reader that ignores the id would either read nothing or read a
 * neighbour — which is the defect the split closed.
 */
function state(root: string, session_id = 's1'): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(root, statePathFor(session_id)), 'utf8'));
}

function envelope(
    platform: string,
    event: string,
    payload: Record<string, unknown>,
    session_id = 's1',
): string {
    return JSON.stringify({
        schema_version: 1,
        platform,
        event,
        native_event: event,
        session_id,
        workspace_root: '/work',
        payload,
    });
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-before-complete-'));
    fs.mkdirSync(path.join(tmp, 'agents', 'runtime', 'state'), { recursive: true });
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('verify_before_complete — tracker behaviour', () => {
    it('session_start initialises state', () => {
        expect(run(envelope('augment', 'session_start', {}), { consumer_root: tmp })).toBe(0);
        const s = state(tmp);
        expect(s['session_id']).toBe('s1');
        expect(s['verified_this_turn']).toBe(false);
        expect(s['verifications_this_turn']).toBe(0);
        expect(s['last_verification']).toBe(null);
    });

    it('pytest command records verification', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        const payload = {
            tool_name: 'launch-process',
            tool_input: { command: '.venv/bin/python3 -m pytest tests/ -q' },
        };
        run(envelope('augment', 'post_tool_use', payload), { consumer_root: tmp });
        const s = state(tmp);
        expect(s['verified_this_turn']).toBe(true);
        expect(s['verifications_this_turn']).toBe(1);
        const lv = s['last_verification'] as Record<string, unknown>;
        expect(lv['tool']).toBe('launch-process');
        expect(String(lv['command'])).toContain('pytest');
    });

    it('non-verification command does not set flag', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        const payload = { tool_name: 'launch-process', tool_input: { command: 'ls -la' } };
        run(envelope('augment', 'post_tool_use', payload), { consumer_root: tmp });
        const s = state(tmp);
        expect(s['verified_this_turn']).toBe(false);
        expect(s['verifications_this_turn']).toBe(0);
    });

    it('user_prompt_submit resets turn counter', () => {
        run(envelope('claude', 'session_start', {}), { consumer_root: tmp });
        run(
            envelope('claude', 'post_tool_use', {
                tool_name: 'Bash',
                tool_input: { command: 'task ci' },
            }),
            { consumer_root: tmp },
        );
        expect(state(tmp)['verified_this_turn']).toBe(true);
        run(envelope('claude', 'user_prompt_submit', {}), { consumer_root: tmp });
        const s = state(tmp);
        expect(s['verified_this_turn']).toBe(false);
        expect(s['verifications_this_turn']).toBe(0);
        // session-scoped count survives the turn reset
        expect(s['verifications_this_session']).toBe(1);
    });

    it('stop event records timestamp', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        run(envelope('augment', 'stop', {}), { consumer_root: tmp });
        expect(state(tmp)['last_stop_at']).not.toBe(null);
    });

    it('session id change resets session counters', () => {
        run(
            envelope('augment', 'session_start', { tool_input: { command: 'pytest' } }, 's1'),
            { consumer_root: tmp },
        );
        run(
            envelope(
                'augment',
                'post_tool_use',
                { tool_name: 'launch-process', tool_input: { command: 'pytest -q' } },
                's1',
            ),
            { consumer_root: tmp },
        );
        expect(state(tmp)['verifications_this_session']).toBe(1);
        run(envelope('augment', 'session_start', {}, 's2'), { consumer_root: tmp });
        const s = state(tmp, 's2');
        expect(s['session_id']).toBe('s2');
        expect(s['verifications_this_session']).toBe(0);
        // And s1's own evidence SURVIVES — it is a different file now. Before
        // the split this same sequence overwrote it, which is why two
        // concurrent runs erased each other.
        expect(state(tmp, 's1')['verifications_this_session']).toBe(1);
    });

    it.each([
        ['augment', 'launch-process', 'command'],
        ['claude', 'Bash', 'command'],
        ['cursor', 'RunShellCommand', 'command'],
        ['cline', 'execute_shell', 'command'],
        ['gemini', 'shell', 'command'],
    ])('verification detected: %s / %s', (platform, tool, cmdKey) => {
        run(envelope(platform, 'session_start', {}), { consumer_root: tmp });
        const payload = { tool_name: tool, tool_input: { [cmdKey]: 'task ci' } };
        run(envelope(platform, 'post_tool_use', payload), { consumer_root: tmp });
        expect(state(tmp)['verified_this_turn']).toBe(true);
    });

    it('malformed stdin is silent no-op', () => {
        expect(run('not json', { consumer_root: tmp })).toBe(0);
        const target = path.join(tmp, statePathFor('s1'));
        if (fs.existsSync(target)) {
            JSON.parse(fs.readFileSync(target, 'utf8'));
        }
    });

    it('empty stdin is silent no-op', () => {
        expect(run('', { consumer_root: tmp })).toBe(0);
    });

    it('dispatcher envelope passes through', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        expect(state(tmp)['session_id']).toBe('s1');
    });
});

/**
 * Round 7 § Phase 1.1 — `ci_last` is the session-scoped CI-settle NEGATIVE that
 * `turn-end-gate` reads to refuse a premature completion claim. The property that
 * matters is the one the turn-scoped counters deliberately do not have: it
 * survives a user prompt, because the measured failure is a completion claim in a
 * LATER turn than the poll it rests on.
 */
describe('verify_before_complete — ci_last (round 7)', () => {
    function poll(output: string, session_id = 's1'): void {
        run(
            envelope(
                'augment',
                'post_tool_use',
                {
                    tool_name: 'launch-process',
                    tool_input: { command: 'gh pr checks 1234' },
                    tool_response: output,
                },
                session_id,
            ),
            { consumer_root: tmp },
        );
    }

    it('is null before any CI poll', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        expect(state(tmp)['ci_last']).toBe(null);
    });

    it('records an in-flight poll as not settled', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        poll('build\tpending\t1m\nlint\tpass\t30s\n');
        const ci = state(tmp)['ci_last'] as Record<string, unknown>;
        expect(ci['settled']).toBe(false);
        expect(ci['pending']).toBe(1);
    });

    // This test used to assert `settled: true` here, and the assertion was the
    // defect R2 finding 3 named: a zero-pending table with no in-flight witness
    // is the stale-read case, and calling it a settle silenced the detector in
    // exactly the premature-claim case it exists for. The corrected pair lives
    // below ("NO in-flight witness" / "AFTER an in-flight observation"); this one
    // keeps only the part that was always right — the parsed count.
    it('parses a real result table with no in-flight rows as zero pending', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        poll('build\tpass\t1m\nlint\tpass\t30s\n');
        const ci = state(tmp)['ci_last'] as Record<string, unknown>;
        expect(ci['pending']).toBe(0);
    });

    it('never reads "no checks reported" as settled', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        poll('no checks reported on the abc123 branch\n');
        const ci = state(tmp)['ci_last'] as Record<string, unknown>;
        expect(ci['pending']).toBe(null);
        expect(ci['settled']).toBe(false);
    });

    it('survives a user prompt — the turn-scoped witness does not', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        poll('build\tpending\t1m\n');
        expect(state(tmp)['ci_saw_pending']).toBe(true);
        run(envelope('augment', 'user_prompt_submit', { prompt: 'fixe die ci' }), {
            consumer_root: tmp,
        });
        // The turn-scoped in-flight witness is reset by design …
        expect(state(tmp)['ci_saw_pending']).toBe(false);
        // … and the session-scoped negative is exactly what must NOT be.
        const ci = state(tmp)['ci_last'] as Record<string, unknown>;
        expect(ci['settled']).toBe(false);
    });

    // R2 finding 1 (high) — the case my own negative test could not see, because
    // it fed a synthetic `{seen:false}` and never crossed a session boundary.
    it('is CLEARED at a session boundary — a stale unsettled read must not refuse a new session', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        poll('build\tpending\t1m\n');
        expect((state(tmp)['ci_last'] as Record<string, unknown>)['settled']).toBe(false);
        // Session B never polled CI. Since the per-session split this holds by
        // CONSTRUCTION rather than by the in-file reset — B has its own file —
        // and s1's unsettled witness stays where it belongs instead of being
        // cleared out from under a live run.
        run(envelope('augment', 'session_start', {}, 's2'), { consumer_root: tmp });
        expect(state(tmp, 's2')['ci_last']).toBe(null);
        expect(state(tmp, 's2')['session_id']).toBe('s2');
        expect((state(tmp, 's1')['ci_last'] as Record<string, unknown>)['settled']).toBe(
            false,
        );
    });

    // R2 finding 3 (medium) — the sharpest one: a stale all-pass table used to
    // record `settled: true`, which silenced the detector in exactly the
    // premature-claim case it exists for.
    it('a zero-pending table with NO in-flight witness is NOT a settle', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        poll('build\tpass\t1m\nlint\tpass\t30s\n'); // first read, nothing seen pending
        const ci = state(tmp)['ci_last'] as Record<string, unknown>;
        expect(ci['pending']).toBe(0);
        expect(ci['settled']).toBe(false);
    });

    it('a zero-pending table AFTER an in-flight observation IS a settle', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        poll('build\tpending\t1m\n');
        poll('build\tpass\t1m\nlint\tpass\t30s\n');
        expect((state(tmp)['ci_last'] as Record<string, unknown>)['settled']).toBe(true);
    });

    it('a non-CI verification leaves ci_last untouched', () => {
        run(envelope('augment', 'session_start', {}), { consumer_root: tmp });
        poll('build\tpending\t1m\n');
        run(
            envelope('augment', 'post_tool_use', {
                tool_name: 'launch-process',
                tool_input: { command: 'npx vitest run tests/x.test.ts' },
                tool_response: 'Tests  3 passed (3)',
            }),
            { consumer_root: tmp },
        );
        const ci = state(tmp)['ci_last'] as Record<string, unknown>;
        expect(ci['settled']).toBe(false);
        expect(ci['command']).toContain('gh pr checks');
    });
});
