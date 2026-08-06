// Tests for src/scripts/lint_mandated_lines.ts — Phase 1 of
// road-to-skill-ecosystem-authoring-discipline.
//
// The acceptance criterion this suite discharges: "rejects a completion claim
// describing an outward action with no authorization line, proven by a test".
// Weighted at the rejecting cases — a checker that accepts is easy to write and
// worthless; one that rejects the right reports is the whole point.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { checkReport, REPO_ROOT } from '../../src/scripts/lint_mandated_lines.js';

function runCli(stdin: string): { code: number; stdout: string; stderr: string } {
    try {
        const stdout = execFileSync('./scripts-run', ['src/scripts/lint_mandated_lines', '--stdin'], {
            cwd: REPO_ROOT,
            input: stdin,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { code: 0, stdout, stderr: '' };
    } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string };
        return { code: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
}

const INTENT = 'Intent: returns null on empty · the test expects RangeError · the spec says caller error';
const AUTH = 'Authorization: "push it and open the PR" (this turn)';

describe('lint_mandated_lines — the two checkable obligations', () => {
    it('rejects a completion claim describing an outward action with no authorization line', () => {
        const v = checkReport('Pushed to origin and opened the PR.');
        expect(v.findings.map((f) => f.code)).toContain('missing-authorization');
    });

    it('rejects a report claiming a behaviour change with no intent line', () => {
        const v = checkReport('Fixed the date parser.');
        expect(v.findings.map((f) => f.code)).toContain('missing-intent');
    });

    it('accepts the same reports once the owed line is present', () => {
        expect(checkReport(`Pushed to origin.\n\n${AUTH}\n`).findings).toEqual([]);
        expect(checkReport(`Fixed the parser.\n\n${INTENT}\n`).findings).toEqual([]);
    });

    it('rejects an intent line with fewer than three slots', () => {
        // The three slots ARE the mechanism: when they disagree the
        // disagreement is the finding. A one-slot line is an assertion.
        const v = checkReport('Fixed the parser.\n\nIntent: made it throw instead of returning null\n');
        expect(v.findings.map((f) => f.code)).toEqual(['intent-slots']);
    });

    it('rejects an authorization line that quotes nothing', () => {
        // A paraphrase is the agent restating its own conclusion, which is
        // exactly what carrying the user's own words exists to prevent.
        const v = checkReport('Pushed to origin.\n\nAuthorization: the user asked for a push earlier\n');
        expect(v.findings.map((f) => f.code)).toEqual(['authorization-quote']);
    });

    it('owes both lines when a report does both things', () => {
        const v = checkReport('Fixed the parser, then pushed to origin.');
        expect(v.owed.sort()).toEqual(['authorization', 'intent']);
        expect(v.findings).toHaveLength(2);
    });

    it('distinguishes "no obligations detected" from a pass', () => {
        // A report that triggered nothing has not been shown to comply; it has
        // been shown to owe nothing. Collapsing the two is how a lexical gate
        // starts certifying silence.
        const v = checkReport('Read the router contract and answered a question.');
        expect(v.noObligations).toBe(true);
        expect(v.owed).toEqual([]);
        expect(v.findings).toEqual([]);
    });

    it('reads a blockquoted line, because the merged block is quoted in the contract', () => {
        expect(checkReport(`Fixed it.\n\n> ${INTENT}\n`).findings).toEqual([]);
    });

    it('reads an intent line carrying a file label', () => {
        const labelled = 'Intent (parser.ts): returns null · test expects RangeError · spec says caller error';
        expect(checkReport(`Fixed it.\n\n${labelled}\n`).findings).toEqual([]);
    });

    it('fires on past-tense claims, which is what a completion report actually uses', () => {
        for (const claim of ['Implemented the guard.', 'Refactored the loader.', 'Corrected the off-by-one.']) {
            expect(checkReport(claim).owed, claim).toContain('intent');
        }
        for (const claim of ['Deployed to production.', 'Published the release.', 'Sent the email.']) {
            expect(checkReport(claim).owed, claim).toContain('authorization');
        }
    });
});

describe('lint_mandated_lines — the CLI', () => {
    it('exits 2 on a finding and 0 on a clean report', () => {
        expect(runCli('Pushed to origin.').code).toBe(2);
        expect(runCli(`Pushed to origin.\n\n${AUTH}\n`).code).toBe(0);
    });

    it('names the offender on stderr, not stdout', () => {
        const r = runCli('Pushed to origin.');
        expect(r.stderr).toContain('missing-authorization');
        expect(r.stdout).not.toContain('missing-authorization');
    });

    it('--quiet changes the output, not the verdict', () => {
        const loud = runCli(`Fixed it.\n\n${INTENT}\n`);
        expect(loud.stdout).toContain('obligation(s) owed and present');
        // The verdict is what must not move; the chatter may.
        expect(loud.code).toBe(0);
    });

    it('exits 1 — usage, not findings — when given no input mode', () => {
        try {
            execFileSync('./scripts-run', ['src/scripts/lint_mandated_lines'], {
                cwd: REPO_ROOT,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            throw new Error('expected a non-zero exit');
        } catch (e) {
            expect((e as { status?: number }).status).toBe(1);
        }
    });
});
