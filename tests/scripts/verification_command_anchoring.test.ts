import { describe, expect, it } from 'vitest';

import { commandSegments, exitMasking, isVerificationCommand } from '../../src/scripts/_lib/verification_command.js';

/**
 * G1 and G2 — the two directions the tree's two classifiers disagreed in.
 *
 * Both were observed RED before the predicate was unified, which is the point:
 * a fixture never seen red has unknown sensitivity, and the audited allowlist
 * in `turn_end_verify_allowlist.test.ts` passed the whole time the defect was
 * live because not one of its seven negatives put a verify token in an
 * ARGUMENT position.
 *
 * G1 — a verify token appearing as an argument must not clear the gate.
 * Measured against the pre-fix `_VERIFY_RE` (unanchored `\b(test|…|build|ci)\b`)
 * every row below returned `true`, so `ls tests` cleared detector C. That is
 * the exact case the selector's own header said it rejects.
 *
 * G2 — three command shapes the other classifier refused and this one must
 * accept. `before_complete_hook.ts`'s `_VERIFICATION_RE` was head-anchored to a
 * fixed vendor list, so `npx vitest run`, `tsc --noEmit` and every
 * `./scripts-run src/scripts/lint_*` counted as no verification at all — the
 * false-refusal direction, which is the one that gets a gate switched off.
 */

/** G1 — the verify token is an argument, not the command. */
const G1_TOKEN_IN_ARGUMENT: readonly string[] = [
    'ls tests',
    'cat build.log',
    'git checkout main',
    'mkdir build',
    'git commit -m "fix ci"',
    'true # test',
];

/** G2 — real verification the stricter classifier refused. */
const G2_REFUSED_BY_THE_STRICT_ONE: readonly string[] = [
    'npx vitest run x',
    'tsc --noEmit',
    './scripts-run src/scripts/lint_thing',
];

/** A failure the shell discards is not a verification. */
const G1_DISCARDED_FAILURE: readonly string[] = [
    'npm test || true',
    'npm test || :',
    'npm test ; true',
];

describe('G1 — a verify token in an argument never clears the gate', () => {
    for (const command of G1_TOKEN_IN_ARGUMENT) {
        it(`does NOT recognise: ${command}`, () => {
            expect(isVerificationCommand(command)).toBe(false);
        });
    }
});

describe('G1b — a discarded failure is not a verification', () => {
    for (const command of G1_DISCARDED_FAILURE) {
        it(`does NOT recognise: ${command}`, () => {
            expect(isVerificationCommand(command)).toBe(false);
        });
    }
});

describe('G2 — the shapes the strict classifier refused are verification', () => {
    for (const command of G2_REFUSED_BY_THE_STRICT_ONE) {
        it(`recognises: ${command}`, () => {
            expect(isVerificationCommand(command)).toBe(true);
        });
    }
});

describe('the union both classifiers agreed on is preserved', () => {
    const KEEP: readonly string[] = [
        'npm test',
        'npx vitest run',
        'pytest -q',
        'go test ./...',
        'cargo check',
        'make test',
        'task ci',
        'composer test',
        'php artisan test',
        'vendor/bin/phpstan analyse',
        './scripts-run src/scripts/check_references',
        // A runner selected by a FLAG. Head-anchoring alone refused it, and
        // neither explicit list named it — the old token-anywhere regex had
        // been accepting it by accident. Pinned here because the narrowing
        // broke it once already.
        'node --test',
        'node --test-reporter=tap tests/',
    ];
    for (const command of KEEP) {
        it(`still recognises: ${command}`, () => {
            expect(isVerificationCommand(command)).toBe(true);
        });
    }
});

describe('a chained segment is classified on its own head', () => {
    it('recognises a verification in the second segment', () => {
        expect(isVerificationCommand('task sync && task ci')).toBe(true);
    });

    it('does not let a non-verifying head carry an argument token', () => {
        expect(isVerificationCommand('git add tests && git commit -m ci')).toBe(false);
    });
});

describe('exitMasking — whose exit code does the record carry', () => {
    it.each([
        ['npx tsc --noEmit | tail -5', 'pipe'],
        ['task ci 2>&1 | tail -20', 'pipe'],
        ['task ci | tee ci.log', 'pipe'],
        ['task ci; echo "exit=$?"', 'trailing'],
        ['task ci || echo failed', 'trailing'],
        ['npx vitest run; ls', 'trailing'],
        // Printing PIPESTATUS does not carry it: the record still holds echo's code.
        ['task ci | tail -5; echo "${PIPESTATUS[0]}"', 'pipe'],
        // pipefail makes the pipeline's status the verifier's, and the echo after it replaces it.
        ['set -o pipefail; task ci | tail -5; echo done', 'trailing'],
        ['task ci && echo ok; echo done', 'trailing'],
        // `|| false` keeps the failure only until the next unconditional command.
        ['npx tsc --noEmit || false; echo ready', 'trailing'],
        // `set +o pipefail` turns it off again.
        ['set -o pipefail; set +o pipefail; npx tsc --noEmit | tail -5', 'pipe'],
        // A failure skips `&& exit 0` and reaches the echo.
        ['npx tsc --noEmit && exit 0; echo ready', 'trailing'],
        // A `set` that `&&` can skip, or that runs inside a pipeline, sets nothing for the line.
        ['false && set -o pipefail; task ci | tail -5', 'pipe'],
        ['set -o pipefail | cat; task ci | tail -5', 'pipe'],
        // An `exit` inside a pipeline ends only its subshell.
        ['task ci || exit 1 | cat', 'trailing'],
        // An `exit` of PIPESTATUS inside a pipeline, or of something merely containing it, carries nothing.
        ['task ci | tail -5; exit "${PIPESTATUS[0]}" | cat', 'pipe'],
        ['task ci | tail -5; exit "${PIPESTATUS[0]}0"', 'pipe'],
        // `exit 00` and `exit 256` both end the shell with 0.
        ['task ci || exit 00', 'trailing'],
        ['task ci || exit 256', 'trailing'],
        ['task ci || exit "$code"', 'trailing'],
        // Nothing after an unconditional exit runs, so `tsc` is not the last verifier.
        ['task ci | tail -5; exit 0; npx tsc --noEmit', 'pipe'],
        // `tail`'s 0 skips the `||` fallback, so the recorded code is the filter's.
        ['task ci | tail -5 || npx tsc --noEmit', 'pipe'],
        // D10: an `exit` of PIPESTATUS hands nothing on. The command text cannot say which
        // pipeline ran last (a skipped fallback leaves PIPESTATUS to the filter's pipeline).
        ['task ci | tail -5; exit "${PIPESTATUS[0]}"', 'pipe'],
        ['task ci | tail -5 || printf x | npx tsc --noEmit; exit "${PIPESTATUS[1]}"', 'pipe'],
        ['set -o pipefail; task ci | tail -5; exit "${PIPESTATUS[0]}"', 'trailing'],
    ])('`%s` masks via %s', (command, kind) => {
        expect(exitMasking(command)).toBe(kind);
    });

    it.each([
        'task ci',
        'set -o pipefail; task ci | tail -5',
        'set -euo pipefail; task ci | tail -5',
        'task ci && echo ok',
        'npx vitest run || exit 1',
        'npx vitest run; exit $?',
        'task sync; task ci',
        'npm test || true',
        'git log | head -5',
        'cat x | npx vitest run',
        // The record's code is the final verifier's.
        'task ci | tail -5; npx tsc --noEmit',
        // `;` makes the final `tsc` unconditional, whatever the `||` before it did.
        'task ci | tail -5 || echo fallback; npx tsc --noEmit',
    ])('`%s` masks nothing', (command) => {
        expect(exitMasking(command)).toBeNull();
    });

    it('a long mixed || / && chain is classified in linear time', () => {
        const command = `true || ${Array(20000).fill('npx tsc --noEmit').join(' && ')}`;
        const t0 = Date.now();
        exitMasking(command);
        expect(Date.now() - t0).toBeLessThan(1000);
    });

    it.each([
        ['true || npm run dev', ['true']],
        ['false && echo skipped | npm run dev', ['false']],
        ['cd app && npm run dev', ['cd app', 'npm run dev']],
    ])('commandSegments(`%s`) lists only what can run', (command, expected) => {
        expect(commandSegments(command)).toEqual(expected);
    });

    it('a pipefail set AFTER the pipe does not cover it', () => {
        expect(exitMasking('task ci | tail -5; set -o pipefail')).toBe('pipe');
    });
});

describe('rtk-wrapped verification is classified on the wrapped command', () => {
    it.each(['rtk vitest run', 'rtk proxy npx vitest run', 'rtk tsc --noEmit'])('recognises: %s', (command) => {
        expect(isVerificationCommand(command)).toBe(true);
    });

    it('does not recognise `rtk gain`', () => {
        expect(isVerificationCommand('rtk gain')).toBe(false);
    });
});
