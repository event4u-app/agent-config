/**
 * `classifyRunWithMasking` — a recorded exit code that belongs to `tail` or
 * `echo` is a gap, not a pass (road-to-done-claims-with-read-exit-codes 1.1).
 *
 * Off the live hook path by owner decision (2026-11-21, option 2): the
 * turn-end gate still reads `classifyRun`. Wiring this in is
 * road-to-done-claims-with-read-exit-codes-live-wiring.
 */
import { describe, expect, it } from 'vitest';

import { classifyRunWithMasking, type MaskedVerdict } from '../../src/scripts/_lib/exit_masking.js';
import { classifyRun, type RunRecord } from '../../src/scripts/_lib/verification_evidence.js';

function rec(over: Partial<RunRecord> = {}): RunRecord {
    return { command: 'npx vitest run', exit_code: 0, stdout_tail: '', stderr_tail: '', ...over };
}

function reason(v: MaskedVerdict): string {
    return v.kind === 'INVALID_RUN' ? v.reason : v.kind;
}

describe('the live classifier is unchanged', () => {
    it('`classifyRun` still reads a masked 0 as a pass', () => {
        expect(classifyRun(rec({ command: 'npx tsc --noEmit | tail -5', exit_code: 0 })).kind).toBe('PASS_EVIDENCE_OK');
    });
});

describe('classifyRunWithMasking — an exit code the command line masked is not the verifier\'s', () => {
    // road-to-done-claims-with-read-exit-codes 1.1. Each masked command was
    // probed on 2026-11-21 with exit 0 and a tsc error in its output, and each
    // classified PASS_EVIDENCE_OK: the 0 came from `tail` or `echo`, not tsc.
    const TSC_ERR = "src/a.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.\n";

    it.each([
        'npx tsc --noEmit | tail -5',
        'task ci; echo "exit=$?"',
        'task ci 2>&1 | tail -20',
        'task ci || echo failed',
    ])('`%s` with exit 0 classifies exit_masked', (command) => {
        expect(classifyRunWithMasking(rec({ command, exit_code: 0, stdout_tail: TSC_ERR }))).toEqual({
            kind: 'INVALID_RUN',
            reason: 'exit_masked',
        });
    });

    it('`set -o pipefail; task ci | tail -5` keeps its exit code', () => {
        expect(
            classifyRunWithMasking(rec({ command: 'set -o pipefail; task ci | tail -5', exit_code: 0 })).kind,
        ).toBe('PASS_EVIDENCE_OK');
    });

    it('`task ci && echo ok` only echoes on success, so it masks nothing', () => {
        expect(classifyRunWithMasking(rec({ command: 'task ci && echo ok', exit_code: 0 })).kind).toBe(
            'PASS_EVIDENCE_OK',
        );
    });

    // D8: no output line is read as the verifier's status. Where the status goes
    // (redirected, skipped, reformatted) cannot be established from the command
    // text, and a masked run is an instrument gap either way.
    it.each([
        ['task ci; echo "exit=$?"', 'ok\nexit=0\n'],
        ['task ci; echo "exit=$?"', 'boom\nexit=1\n'],
        ['task ci; echo "exit=$?" >/dev/null', 'own output\nexit=1\n'],
        ['task ci | tail -5; echo "exit=${PIPESTATUS[0]}"', 'boom\nexit=2\n'],
    ])('`%s` with an exit line in the output stays exit_masked', (command, stdout_tail) => {
        expect(classifyRunWithMasking(rec({ command, exit_code: 0, stdout_tail }))).toEqual({
            kind: 'INVALID_RUN',
            reason: 'exit_masked',
        });
    });

    it('a masked run that loaded nothing keeps its load-failure verdict', () => {
        expect(
            reason(
                classifyRunWithMasking(
                    rec({ command: 'npx vitest run | tail -5', exit_code: 0, stdout_tail: 'Error: Cannot find module \'x\'\n' }),
                ),
            ),
        ).toBe('fixture_or_load_failure');
    });

    it('a masked run that discovered no tests keeps its zero-tests verdict', () => {
        expect(
            reason(
                classifyRunWithMasking(
                    rec({ command: 'npx vitest run | tail -5', exit_code: 0, stdout_tail: 'Tests  0 passed (0)\n' }),
                ),
            ),
        ).toBe('zero_tests_discovered');
    });

    it('output that merely mentions an exit code is not read when the line echoes none', () => {
        expect(
            classifyRunWithMasking(
                rec({ command: 'npx tsc --noEmit | tail -5', exit_code: 0, stdout_tail: 'src/exit.ts: exit=1 handled\n' }),
            ),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    it('`$?` after a pipe is the filter\'s code, so an echoed value is not the verifier\'s', () => {
        expect(
            classifyRunWithMasking(rec({ command: 'task ci | tail -5; echo "exit=$?"', exit_code: 0, stdout_tail: 'exit=0\n' })),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    it('a filter\'s PIPESTATUS is not read as the verifier\'s code', () => {
        expect(
            classifyRunWithMasking(rec({ command: 'task ci | tail -5; echo "exit=${PIPESTATUS[1]}"', exit_code: 0, stdout_tail: 'exit=0\n' })),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    it('a status echoed after another command is not read as the verifier\'s', () => {
        expect(
            classifyRunWithMasking(rec({ command: 'task ci; echo ready; echo "exit=$?"', exit_code: 0, stdout_tail: 'ready\nexit=0\n' })),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    it('an exit line that is not the last line of output is not read', () => {
        expect(
            classifyRunWithMasking(rec({ command: 'task ci; echo "exit=$?"', exit_code: 0, stdout_tail: 'exit=0\nmore output\n' })),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    it('a pipefail pipeline followed by an echo is masked by the echo', () => {
        expect(
            classifyRunWithMasking(rec({ command: 'set -o pipefail; task ci | tail -5; echo done', exit_code: 0, stdout_tail: 'done\n' })),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    it('a final verifier after a masked pipe keeps its own failing code', () => {
        expect(
            reason(classifyRunWithMasking(rec({ command: 'task ci | tail -5; npx tsc --noEmit', exit_code: 2, stdout_tail: '' }))),
        ).toBe('nonzero_exit_without_test_failure');
    });

    it('an exit line printed by a later command is not read as the verifier\'s', () => {
        expect(
            classifyRunWithMasking(
                rec({ command: 'npx tsc --noEmit; echo "exit=$?"; echo exit=0', exit_code: 0, stdout_tail: 'exit=2\nexit=0\n' }),
            ),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    it('`|| false` followed by an unconditional echo does not pass a failed verifier', () => {
        expect(
            classifyRunWithMasking(rec({ command: 'npx tsc --noEmit || false; echo ready', exit_code: 0, stdout_tail: 'ready\n' })),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    it('a pipefail turned off again does not cover the pipe', () => {
        expect(
            classifyRunWithMasking(
                rec({ command: 'set -o pipefail; set +o pipefail; npx tsc --noEmit | tail -5', exit_code: 0, stdout_tail: '' }),
            ),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    it('a printf whose digits are a constant is not read as the status', () => {
        expect(
            classifyRunWithMasking(
                rec({ command: "npx tsc --noEmit; printf 'exit=1%.0s\\n' \"$?\"", exit_code: 0, stdout_tail: 'exit=1\n' }),
            ),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    it('a failure that skips `&& exit 0` and reaches an echo is masked', () => {
        expect(
            classifyRunWithMasking(rec({ command: 'npx tsc --noEmit && exit 0; echo ready', exit_code: 0, stdout_tail: 'ready\n' })),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    it('a status echo the shell skips on success is not read from the verifier\'s own output', () => {
        expect(
            classifyRunWithMasking(rec({ command: 'task ci || echo "exit=$?"', exit_code: 0, stdout_tail: 'log line\nexit=1\n' })),
        ).toEqual({ kind: 'INVALID_RUN', reason: 'exit_masked' });
    });

    // D9: masking only ever replaces a recorded 0. A nonzero recorded code keeps
    // the verdict it had before this change, so no refusal is demoted.
    it.each([
        ['npx vitest run | grep foo', 1],
        ['npx tsc --noEmit && task ci | tail -5', 2],
        ['set -e; npx tsc --noEmit; echo done', 2],
    ])('`%s` with recorded exit %i keeps its refusing verdict', (command, exit_code) => {
        expect(reason(classifyRunWithMasking(rec({ command, exit_code, stdout_tail: '' })))).toBe(
            'nonzero_exit_without_test_failure',
        );
    });

    it('`|| false | cat` does not keep the failure, so a recorded 0 is masked', () => {
        expect(classifyRunWithMasking(rec({ command: 'npx tsc --noEmit || false | cat', exit_code: 0, stdout_tail: '' }))).toEqual({
            kind: 'INVALID_RUN',
            reason: 'exit_masked',
        });
    });
});
