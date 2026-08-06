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

    it('rejects an authorization line that quotes nothing — including one with an apostrophe in it', () => {
        // A paraphrase is the agent restating its own conclusion, which is
        // exactly what carrying the user's own words exists to prevent. The
        // apostrophe case is the one the first version got wrong: a possessive
        // satisfied a bare quote-character class, so this exact sentence — the
        // documentation-is-not-authorization case the contract denies — passed.
        for (const line of [
            'Authorization: the user asked for a push earlier',
            "Authorization: the user's roadmap step says to push",
            'Authorization: per the plan, a push was expected',
        ]) {
            const v = checkReport(`Pushed to origin.\n\n${line}\n`);
            expect(v.findings.map((f) => f.code), line).toEqual(['authorization-quote']);
        }
    });

    it('accepts every quotation shape a real user quote arrives in', () => {
        for (const q of ['"push it"', '\u201cpush it\u201d', '\u2018push it\u2019', "'push it'"]) {
            const v = checkReport(`Pushed to origin.\n\nAuthorization: ${q} (this turn)\n`);
            expect(v.findings, q).toEqual([]);
        }
    });

    it('ignores lines inside a fenced block — a quoted example is not an emission', () => {
        // The contract's own § Brevity illustration contains well-formed lines.
        // Without fence stripping, quoting it satisfied both obligations while
        // the run had emitted neither.
        const report = [
            'Fixed the parser and pushed to origin.',
            '',
            'Here is the contract example, for reference:',
            '```',
            'Intent: a · b · c',
            'Authorization: "do it"',
            '```',
        ].join('\n');
        expect(checkReport(report).findings.map((f) => f.code).sort()).toEqual([
            'missing-authorization',
            'missing-intent',
        ]);
    });

    it('reads a soft-wrapped intent line as one line', () => {
        // The contract's canonical example wraps across two blockquote lines.
        // A one-physical-line capture read it as two slots, so the document's
        // own model-correct artifact failed its own checker.
        const wrapped =
            '> Intent: parseDate returns null on an empty string · the failing test expects\n' +
            '> a thrown RangeError · the spec says empty input is a caller error.';
        expect(checkReport(`Fixed it.\n\n${wrapped}\n`).findings).toEqual([]);
    });

    it('validates EVERY intent line, not just the first', () => {
        // Checking only the first made the verdict depend on line order.
        const good = 'Intent: a · b · c';
        const bad = 'Intent: only one slot';
        expect(checkReport(`Fixed two things.\n\n${good}\n${bad}\n`).findings).toHaveLength(1);
        expect(checkReport(`Fixed two things.\n\n${bad}\n${good}\n`).findings).toHaveLength(1);
    });

    it('does not charge an obligation to a report that DENIES the action', () => {
        // A trigger word inside "no code changed" is a report saying the
        // opposite of what the trigger detects.
        expect(checkReport('Reviewed the diff. No code changed and nothing was implemented.').owed).toEqual([]);
        // …but a denial in one sentence does not excuse a claim in the next.
        expect(checkReport('No code changed. Pushed the doc fix to origin.').owed).toContain('authorization');
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
