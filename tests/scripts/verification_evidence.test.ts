/**
 * The record classifier.
 *
 * Two properties carry the weight. A command that cannot verify anything is
 * never evidence however it exited — `echo test` is the case the regex path
 * admits and this is where it is refused. And a missing exit code is the HOST's
 * gap, not the turn's: it classifies distinctly so the consumer can decline to
 * refuse on it, which is the mitigation the parent roadmap's first-ranked risk
 * names.
 *
 * Every parser gets a fixture per verdict because a parser that only ever sees
 * its passing shape is a parser whose failing shape has never been read.
 */
import { describe, expect, it } from 'vitest';

import {
    INSTRUMENT_GAP_REASONS,
    classifyRun,
    isInstrumentGap,
    parseSummary,
    runnerOf,
    type RunRecord,
    type VerificationVerdict,
} from '../../src/scripts/_lib/verification_evidence.js';

function rec(over: Partial<RunRecord> = {}): RunRecord {
    return { command: 'npx vitest run', exit_code: 0, stdout_tail: '', stderr_tail: '', ...over };
}

function reason(v: VerificationVerdict): string {
    return v.kind === 'INVALID_RUN' ? v.reason : v.kind;
}

describe('classifyRun — the command must be able to verify something', () => {
    it('refuses `echo test` as evidence although the selector matches its text', () => {
        // The selector DOES match: the word `test` is in the pattern, which is
        // the whole defect the record path exists to close. The classifier is
        // the layer that says the command cannot verify anything.
        expect(reason(classifyRun(rec({ command: 'echo test', exit_code: 0 })))).toBe(
            'not_a_verification_command',
        );
    });

    it('refuses `ls build` for the same reason', () => {
        expect(reason(classifyRun(rec({ command: 'ls build', exit_code: 0 })))).toBe(
            'not_a_verification_command',
        );
    });

    it('reads a malformed record as unreadable, never as a pass', () => {
        expect(reason(classifyRun(null))).toBe('unreadable_record');
        expect(reason(classifyRun('npx vitest run'))).toBe('unreadable_record');
        expect(reason(classifyRun([]))).toBe('unreadable_record');
        expect(reason(classifyRun({ exit_code: 0 }))).toBe('unreadable_record');
        expect(reason(classifyRun({ command: '   ', exit_code: 0 }))).toBe('unreadable_record');
        expect(reason(classifyRun({ command: 'npx vitest run', exit_code: Number.NaN }))).toBe(
            'unreadable_record',
        );
    });
});

describe('classifyRun — a missing exit code is the host gap, never a pass', () => {
    it('classifies `exit_code: null` as exit_code_unavailable', () => {
        expect(
            reason(classifyRun(rec({ exit_code: null, stdout_tail: 'Tests  4 passed (4)' }))),
        ).toBe('exit_code_unavailable');
    });

    it('classifies an absent exit_code field the same way', () => {
        expect(reason(classifyRun({ command: 'npx vitest run' }))).toBe('exit_code_unavailable');
    });

    it('marks exactly the two instrument-gap reasons as never-refusable', () => {
        expect([...INSTRUMENT_GAP_REASONS].sort()).toEqual([
            'exit_code_unavailable',
            'unreadable_record',
        ]);
        expect(isInstrumentGap(classifyRun(rec({ exit_code: null })))).toBe(true);
        expect(isInstrumentGap(classifyRun(rec({ command: 'echo test' })))).toBe(false);
        expect(isInstrumentGap(classifyRun(rec()))).toBe(false);
    });
});

describe('classifyRun — a killed run is never a pass', () => {
    it.each([137, 143])('classifies exit %i with no summary as timeout_or_killed', (code) => {
        expect(reason(classifyRun(rec({ exit_code: code, stdout_tail: ' RUN  v3.0.0\n' })))).toBe(
            'timeout_or_killed',
        );
    });

    it('does not let a partial passing summary rescue a killed run', () => {
        expect(
            reason(classifyRun(rec({ exit_code: 137, stdout_tail: 'Tests  12 passed (12)' }))),
        ).toBe('timeout_or_killed');
    });

    it('still reports FAIL_EVIDENCE when the killed run had already failed tests', () => {
        expect(
            classifyRun(rec({ exit_code: 143, stdout_tail: 'Tests  2 failed | 3 passed (5)' })).kind,
        ).toBe('FAIL_EVIDENCE');
    });
});

describe('classifyRun — vitest', () => {
    it('passes a clean summary at exit 0', () => {
        expect(
            classifyRun(rec({ exit_code: 0, stdout_tail: ' Tests  812 passed (812)\n' })).kind,
        ).toBe('PASS_EVIDENCE_OK');
    });

    it('fails a summary naming failures', () => {
        expect(
            classifyRun(rec({ exit_code: 1, stdout_tail: ' Tests  3 failed | 809 passed (812)\n' }))
                .kind,
        ).toBe('FAIL_EVIDENCE');
    });

    it('reports zero_tests_discovered on an empty run', () => {
        expect(reason(classifyRun(rec({ exit_code: 0, stdout_tail: ' Tests  0 passed (0)\n' })))).toBe(
            'zero_tests_discovered',
        );
    });

    it('reports fixture_or_load_failure when the suite never loaded', () => {
        expect(
            reason(
                classifyRun(
                    rec({
                        exit_code: 1,
                        stderr_tail: 'Error: Transform failed with 1 error:\nfoo.ts:8:13',
                    }),
                ),
            ),
        ).toBe('fixture_or_load_failure');
    });
});

describe('classifyRun — jest', () => {
    it('passes `Tests: 3 passed, 3 total`', () => {
        expect(
            classifyRun(rec({ command: 'npx jest', stdout_tail: 'Tests:       3 passed, 3 total' }))
                .kind,
        ).toBe('PASS_EVIDENCE_OK');
    });

    it('fails `Tests: 1 failed, 2 passed, 3 total`', () => {
        expect(
            classifyRun(
                rec({
                    command: 'npx jest',
                    exit_code: 1,
                    stdout_tail: 'Tests:       1 failed, 2 passed, 3 total',
                }),
            ).kind,
        ).toBe('FAIL_EVIDENCE');
    });

    it('reports zero_tests_discovered on `0 total`', () => {
        expect(
            reason(
                classifyRun(rec({ command: 'npx jest', stdout_tail: 'Tests:       0 total' })),
            ),
        ).toBe('zero_tests_discovered');
    });
});

describe('classifyRun — pytest -q', () => {
    it('passes `5 passed in 1.20s`', () => {
        expect(
            classifyRun(rec({ command: 'pytest -q', stdout_tail: '5 passed in 1.20s' })).kind,
        ).toBe('PASS_EVIDENCE_OK');
    });

    it('fails `1 failed, 4 passed in 1.20s`', () => {
        expect(
            classifyRun(
                rec({ command: 'pytest -q', exit_code: 1, stdout_tail: '1 failed, 4 passed in 1.20s' }),
            ).kind,
        ).toBe('FAIL_EVIDENCE');
    });

    it('counts a collection error as a failure, not as a pass', () => {
        expect(
            classifyRun(
                rec({ command: 'pytest -q', exit_code: 2, stdout_tail: '2 errors in 0.30s' }),
            ).kind,
        ).toBe('FAIL_EVIDENCE');
    });

    it('reports zero_tests_discovered on `no tests ran`', () => {
        expect(
            reason(
                classifyRun(rec({ command: 'pytest -q', exit_code: 5, stdout_tail: 'no tests ran in 0.01s' })),
            ),
        ).toBe('zero_tests_discovered');
    });
});

describe('classifyRun — phpunit and pest', () => {
    it('passes phpunit `OK (15 tests, 30 assertions)`', () => {
        expect(
            classifyRun(rec({ command: 'vendor/bin/phpunit', stdout_tail: 'OK (15 tests, 30 assertions)' }))
                .kind,
        ).toBe('PASS_EVIDENCE_OK');
    });

    it('fails phpunit `Tests: 15, Assertions: 30, Failures: 1.`', () => {
        expect(
            classifyRun(
                rec({
                    command: 'vendor/bin/phpunit',
                    exit_code: 1,
                    stdout_tail: 'FAILURES!\nTests: 15, Assertions: 30, Failures: 1.',
                }),
            ).kind,
        ).toBe('FAIL_EVIDENCE');
    });

    it('reports zero_tests_discovered on phpunit `No tests executed!`', () => {
        expect(
            reason(
                classifyRun(rec({ command: 'vendor/bin/phpunit', stdout_tail: 'No tests executed!' })),
            ),
        ).toBe('zero_tests_discovered');
    });

    it('passes pest `Tests:    10 passed (24 assertions)`', () => {
        expect(
            classifyRun(
                rec({ command: 'vendor/bin/pest', stdout_tail: '  Tests:    10 passed (24 assertions)' }),
            ).kind,
        ).toBe('PASS_EVIDENCE_OK');
    });

    it('fails pest `Tests:    2 failed, 10 passed`', () => {
        expect(
            classifyRun(
                rec({
                    command: 'vendor/bin/pest',
                    exit_code: 1,
                    stdout_tail: '  Tests:    2 failed, 10 passed (24 assertions)',
                }),
            ).kind,
        ).toBe('FAIL_EVIDENCE');
    });
});

describe('classifyRun — TAP', () => {
    it('passes a complete plan of ok lines', () => {
        expect(
            classifyRun(
                rec({ command: 'node --test', stdout_tail: 'TAP version 13\n1..2\nok 1 - a\nok 2 - b\n' }),
            ).kind,
        ).toBe('PASS_EVIDENCE_OK');
    });

    it('fails a plan carrying a not-ok line', () => {
        expect(
            classifyRun(
                rec({
                    command: 'node --test',
                    exit_code: 1,
                    stdout_tail: 'TAP version 13\n1..2\nok 1 - a\nnot ok 2 - b\n',
                }),
            ).kind,
        ).toBe('FAIL_EVIDENCE');
    });

    it('reports zero_tests_discovered on an empty plan', () => {
        expect(
            reason(classifyRun(rec({ command: 'node --test', stdout_tail: 'TAP version 13\n1..0\n' }))),
        ).toBe('zero_tests_discovered');
    });
});

describe('classifyRun — runners with no summary the parsers recognise', () => {
    it('reads exit 0 from a silent verification command as a pass', () => {
        // `tsc --noEmit`, `eslint` and `phpstan` print nothing on success.
        // Demanding a test summary would reclassify the most common green
        // signal in this repository as invalid.
        expect(classifyRun(rec({ command: 'npx tsc --noEmit', stdout_tail: '' })).kind).toBe(
            'PASS_EVIDENCE_OK',
        );
    });

    it('reads a nonzero exit with no parsed failure as nonzero_exit_without_test_failure', () => {
        expect(
            reason(
                classifyRun(
                    rec({
                        command: 'npx tsc --noEmit',
                        exit_code: 2,
                        stdout_tail: "src/a.ts(3,1): error TS2554: Expected 1 arguments.",
                    }),
                ),
            ),
        ).toBe('nonzero_exit_without_test_failure');
    });

    it('classifies `npm test && exit 1` as FAIL_EVIDENCE when the suite reported failures', () => {
        expect(
            classifyRun(
                rec({
                    command: 'npm test && exit 1',
                    exit_code: 1,
                    stdout_tail: ' Tests  1 failed | 4 passed (5)\n',
                }),
            ).kind,
        ).toBe('FAIL_EVIDENCE');
    });
});

describe('parseSummary and runnerOf', () => {
    it('declines text carrying no summary at all', () => {
        expect(parseSummary('hello world')).toBeNull();
    });

    it('names the runner a command uses, and `other` when it knows none', () => {
        expect(runnerOf('npx vitest run tests/x.test.ts')).toBe('vitest');
        expect(runnerOf('pytest -q')).toBe('pytest');
        expect(runnerOf('vendor/bin/phpunit')).toBe('phpunit');
        expect(runnerOf('npx tsc --noEmit')).toBe('other');
    });
});

describe('the classifier is pure', () => {
    it('returns the same verdict for the same record twice', () => {
        const r = rec({ exit_code: 0, stdout_tail: ' Tests  4 passed (4)\n' });
        expect(classifyRun(r)).toEqual(classifyRun(r));
    });

    it('does not mutate the record it was given', () => {
        const r = rec({ exit_code: 1, stdout_tail: ' Tests  1 failed | 1 passed (2)\n' });
        const before = JSON.stringify(r);
        classifyRun(r);
        expect(JSON.stringify(r)).toBe(before);
    });
});
