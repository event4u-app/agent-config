/**
 * The producer/consumer seam — the one test that would have caught both blockers.
 *
 * WHY IT EXISTS, stated as the measurement that produced it. The record path
 * shipped green: every gate-side fixture hand-wrote `stdout_tail: ' Tests  4
 * passed (4)\n'` with real newlines and an explicit `exit_code`, and every
 * recorder-side test asserted only that the stored string CONTAINED `4 passed`.
 * Nothing fed a recorder-produced record into the classifier, and nothing used
 * a real host payload shape. An independent review measured what that hid, over
 * 1,077 object-shaped and 11 string-shaped tool results in this machine's own
 * transcripts:
 *
 *   · Claude Code's Bash result carries NO exit-code field. On success it is an
 *     object `{stdout, stderr, interrupted, isImage, noOutputExpected}`; on
 *     failure the whole response is the string `Error: Exit code 1\n<output>`.
 *     So every recorded run had `exit_code: null`, every verdict was
 *     `exit_code_unavailable`, and the gate ended every turn normally.
 *   · The recorder JSON-stringified an object response, and every parser here is
 *     line-anchored. JSON escapes a newline as two characters, so no summary
 *     could ever be parsed from the success shape.
 *
 * Both are invisible to a test that hand-writes the record. So this file writes
 * NOTHING by hand: it drives the real recorder with the two real payload shapes
 * and reads what the real classifier makes of what came out.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { run, statePathFor } from '../../src/scripts/before_complete_hook.js';
import {
    classifyRun,
    hasRedThenGreen,
    readRunEvidence,
    type TurnRunState,
} from '../../src/scripts/_lib/verification_evidence.js';
import { detectUntestedChange, detectUnverifiedEdit, type ToolCall } from '../../src/scripts/hooks/turn_end_gate_hook.js';

const SESSION = 'roundtrip-1';
let tmp = '';

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrec-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function envelope(event: string, payload: Record<string, unknown>): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event,
        native_event: event,
        session_id: SESSION,
        workspace_root: tmp,
        payload,
    });
}

/**
 * The SUCCESS shape Claude Code actually sends — an object, no exit field.
 *
 * Field set taken from the measurement above, not invented: `stdout`, `stderr`,
 * `interrupted`, `isImage`, `noOutputExpected` appeared on all 1,024 object
 * results, and no numeric exit field appeared on any of them.
 */
function hostSuccess(stdout: string, stderr = ''): Record<string, unknown> {
    return { stdout, stderr, interrupted: false, isImage: false, noOutputExpected: false };
}

/** The FAILURE shape — the whole response is one string carrying the code. */
function hostFailure(code: number, output: string): string {
    return `Error: Exit code ${String(code)}\n${output}`;
}

function bash(command: string, response: unknown): string {
    return envelope('post_tool_use', {
        tool_name: 'Bash',
        tool_input: { command },
        tool_response: response,
    });
}

function editCall(file: string): string {
    return envelope('post_tool_use', {
        tool_name: 'Edit',
        tool_input: { file_path: file },
        tool_response: hostSuccess(''),
    });
}

/** Read back exactly what a stop-slot consumer would read. */
function turnState(): TurnRunState {
    const decoded = JSON.parse(
        fs.readFileSync(path.join(tmp, statePathFor(SESSION)), 'utf8'),
    ) as Record<string, unknown>;
    return {
        runs: decoded['verification_runs'] as readonly unknown[],
        edits_this_turn: decoded['edits_this_turn'] as number,
    };
}

function startTurn(): void {
    run(envelope('user_prompt_submit', { prompt: 'los' }), { consumer_root: tmp });
}

const VITEST_GREEN = ' Test Files  1 passed (1)\n      Tests  3 passed (3)\n';
const VITEST_RED = ' Test Files  1 failed (1)\n      Tests  2 failed | 1 passed (3)\n';

describe('a green run recorded from the real success shape reads as a pass', () => {
    it('survives the round trip with a parsable summary and exit 0', () => {
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(bash('npx vitest run tests/a.test.ts', hostSuccess(VITEST_GREEN)), {
            consumer_root: tmp,
        });

        const st = turnState();
        expect(st.runs).toHaveLength(1);
        const rec = st.runs[0] as Record<string, unknown>;
        // The two properties the hand-written fixtures could not have caught.
        expect(rec['stdout_tail']).toContain('\n'); // a REAL newline, not `\\n`
        expect(rec['exit_code']).toBe(0);
        expect(rec['exit_source']).toBe('response_shape');
        expect(classifyRun(rec).kind).toBe('PASS_EVIDENCE_OK');
        expect(readRunEvidence(st).passed).toBe(true);
    });

    it('lets the gate end the turn', () => {
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(bash('npx vitest run tests/a.test.ts', hostSuccess(VITEST_GREEN)), {
            consumer_root: tmp,
        });
        expect(
            detectUnverifiedEdit([{ name: 'Edit', path: 'src/a.ts' }], turnState()),
        ).toBeNull();
    });

    it('reads a silent green — tsc prints nothing and exits 0', () => {
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(bash('npx tsc -p tsconfig.json --noEmit', hostSuccess('')), { consumer_root: tmp });
        expect(classifyRun((turnState().runs[0] as Record<string, unknown>)).kind).toBe(
            'PASS_EVIDENCE_OK',
        );
    });

    it('keeps stderr, which nothing used to write', () => {
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(bash('npx vitest run tests/a.test.ts', hostSuccess('', VITEST_GREEN)), {
            consumer_root: tmp,
        });
        const rec = turnState().runs[0] as Record<string, unknown>;
        expect(rec['stderr_tail']).toContain('3 passed');
        expect(classifyRun(rec).kind).toBe('PASS_EVIDENCE_OK');
    });
});

describe('a failing run recorded from the real failure shape refuses the turn', () => {
    it('reads the exit code out of the error prefix', () => {
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(bash('npx vitest run tests/a.test.ts', hostFailure(1, VITEST_RED)), {
            consumer_root: tmp,
        });

        const rec = turnState().runs[0] as Record<string, unknown>;
        expect(rec['exit_code']).toBe(1);
        expect(rec['exit_source']).toBe('error_prefix');
        expect(classifyRun(rec).kind).toBe('FAIL_EVIDENCE');
    });

    it('is refused at the stop, naming the failure', () => {
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(bash('npx vitest run tests/a.test.ts', hostFailure(1, VITEST_RED)), {
            consumer_root: tmp,
        });
        const f = detectUnverifiedEdit([{ name: 'Edit', path: 'src/a.ts' }], turnState());
        expect(f?.mode).toBe('record');
        expect(f?.reason).toContain('FAILED');
    });

    it('reads a failure the host reported without any exit code at all', () => {
        // The ordering fix: a run that printed its own failure count has told us
        // about the operator's work, whatever the host said about the status.
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(bash('npx vitest run tests/a.test.ts', { stdout: VITEST_RED }), {
            consumer_root: tmp,
        });
        const rec = turnState().runs[0] as Record<string, unknown>;
        expect(rec['exit_code']).toBeNull();
        expect(classifyRun(rec).kind).toBe('FAIL_EVIDENCE');
    });
});

describe('echo test, end to end', () => {
    it('is recorded, classified as no evidence, and refused', () => {
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(bash('echo test', hostSuccess('test\n')), { consumer_root: tmp });
        const f = detectUnverifiedEdit([{ name: 'Edit', path: 'src/a.ts' }], turnState());
        expect(f?.mode).toBe('record');
        expect(f?.reason).toContain('not_a_verification_command');
    });
});

describe('a real red-then-green turn is allowed', () => {
    const DONE = 'Fertig. Die Liste rendert jetzt.';
    const CALLS: ToolCall[] = [
        { name: 'Edit', path: 'src/feature.ts' },
        { name: 'Write', path: 'tests/feature.test.ts' },
    ];

    it('pairs the red with the green across the real payload shapes', () => {
        startTurn();
        run(editCall('src/feature.ts'), { consumer_root: tmp });
        run(envelope('post_tool_use', {
            tool_name: 'Write',
            tool_input: { file_path: 'tests/feature.test.ts' },
            tool_response: hostSuccess(''),
        }), { consumer_root: tmp });
        run(bash('npx vitest run tests/feature.test.ts', hostFailure(1, VITEST_RED)), {
            consumer_root: tmp,
        });
        run(bash('npx vitest run tests/feature.test.ts', hostSuccess(VITEST_GREEN)), {
            consumer_root: tmp,
        });

        expect(hasRedThenGreen(turnState())).toBe(true);
        expect(detectUntestedChange(DONE, CALLS, turnState())).toBeNull();
    });

    it('accepts the canonical first red — a module that does not exist yet', () => {
        // `Cannot find module` classifies `fixture_or_load_failure`, which is a
        // red: the target did not pass. Requiring a parsed failure COUNT here
        // would refuse the exact discipline the detector exists to encourage.
        startTurn();
        run(editCall('src/feature.ts'), { consumer_root: tmp });
        run(envelope('post_tool_use', {
            tool_name: 'Write',
            tool_input: { file_path: 'tests/feature.test.ts' },
            tool_response: hostSuccess(''),
        }), { consumer_root: tmp });
        run(
            bash(
                'npx vitest run tests/feature.test.ts',
                hostFailure(1, "Error: Cannot find module '../src/feature.js'\n"),
            ),
            { consumer_root: tmp },
        );
        run(bash('npx vitest run tests/feature.test.ts', hostSuccess(VITEST_GREEN)), {
            consumer_root: tmp,
        });

        expect(hasRedThenGreen(turnState())).toBe(true);
        expect(detectUntestedChange(DONE, CALLS, turnState())).toBeNull();
    });

    it('pairs a single-file red with a WHOLE-SUITE green', () => {
        startTurn();
        run(editCall('src/feature.ts'), { consumer_root: tmp });
        run(envelope('post_tool_use', {
            tool_name: 'Write',
            tool_input: { file_path: 'tests/feature.test.ts' },
            tool_response: hostSuccess(''),
        }), { consumer_root: tmp });
        run(bash('npx vitest run tests/feature.test.ts', hostFailure(1, VITEST_RED)), {
            consumer_root: tmp,
        });
        run(bash('task test', hostSuccess(' Tests  812 passed (812)\n')), { consumer_root: tmp });
        expect(hasRedThenGreen(turnState())).toBe(true);
    });

    it('still refuses a green-only turn that wrote a new test file', () => {
        startTurn();
        run(editCall('src/feature.ts'), { consumer_root: tmp });
        run(envelope('post_tool_use', {
            tool_name: 'Write',
            tool_input: { file_path: 'tests/feature.test.ts' },
            tool_response: hostSuccess(''),
        }), { consumer_root: tmp });
        run(bash('npx vitest run tests/feature.test.ts', hostSuccess(VITEST_GREEN)), {
            consumer_root: tmp,
        });
        const f = detectUntestedChange(DONE, CALLS, turnState());
        expect(f?.reason).toContain('no_red_evidence');
    });
});

describe('a passing run that merely PRINTS a load-failure phrase is still a pass', () => {
    it('does not refuse a green suite that exercised an error path', () => {
        // vitest echoes a `stderr |` block verbatim, so any test covering an
        // error path can carry the words `fatal error`. Reading that above the
        // summary refused honest work.
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(
            bash(
                'npx vitest run tests/a.test.ts',
                hostSuccess(
                    'stderr | a > handles fatal error paths\nFatal error: simulated\n\n' + VITEST_GREEN,
                ),
            ),
            { consumer_root: tmp },
        );
        expect(classifyRun(turnState().runs[0]).kind).toBe('PASS_EVIDENCE_OK');
        expect(
            detectUnverifiedEdit([{ name: 'Edit', path: 'src/a.ts' }], turnState()),
        ).toBeNull();
    });

    it('still reports a genuine load failure, where nothing passed', () => {
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(
            bash(
                'npx vitest run tests/a.test.ts',
                hostFailure(1, "Error: Cannot find module './missing.js'\n"),
            ),
            { consumer_root: tmp },
        );
        const v = classifyRun(turnState().runs[0]);
        expect(v.kind === 'INVALID_RUN' ? v.reason : v.kind).toBe('fixture_or_load_failure');
    });
});

describe('an interrupted run is never a pass', () => {
    it('classifies timeout_or_killed from the host flag', () => {
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(
            bash('npx vitest run', {
                stdout: ' RUN  v3.0.0\n',
                stderr: '',
                interrupted: true,
                isImage: false,
            }),
            { consumer_root: tmp },
        );
        const rec = turnState().runs[0] as Record<string, unknown>;
        expect(rec['interrupted']).toBe(true);
        const v = classifyRun(rec);
        expect(v.kind === 'INVALID_RUN' ? v.reason : v.kind).toBe('timeout_or_killed');
    });
});

describe('a shape this recorder has never met stays an instrument gap', () => {
    it('reports exit_code null and never refuses on it', () => {
        startTurn();
        run(editCall('src/a.ts'), { consumer_root: tmp });
        run(bash('npx vitest run', { some_future_field: true }), { consumer_root: tmp });
        const rec = turnState().runs[0] as Record<string, unknown>;
        expect(rec['exit_code']).toBeNull();
        expect(rec['exit_source']).toBeNull();
        expect(readRunEvidence(turnState()).instrumentGap).toBe(true);
        // The transcript answers instead — allowed, because a real verification
        // command follows the edit there.
        expect(
            detectUnverifiedEdit(
                [
                    { name: 'Edit', path: 'src/a.ts' },
                    { name: 'Bash', command: 'npx vitest run' },
                ],
                turnState(),
            ),
        ).toBeNull();
    });
});
