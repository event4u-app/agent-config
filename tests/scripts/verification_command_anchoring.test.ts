import { describe, expect, it } from 'vitest';

import { isVerificationCommand } from '../../src/scripts/_lib/verification_command.js';

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
