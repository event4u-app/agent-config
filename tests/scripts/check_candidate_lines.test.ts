// Tests for src/scripts/check_candidate_lines.ts — Phase 2 of
// road-to-candidate-moves-floor.
//
// Each describe block below discharges one roadmap step's `verify:` line, and
// the block names it. Weighted at the REJECTING cases: a checker that accepts
// is easy to write and worthless. The two silence cases matter just as much —
// a floor that fires on every rename is the interview this roadmap's risk 3
// exists to prevent.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { checkReport, parseLine, REPO_ROOT } from '../../src/scripts/check_candidate_lines.js';

function runCli(stdin: string): { code: number; stdout: string; stderr: string } {
    try {
        const stdout = execFileSync('./scripts-run', ['src/scripts/check_candidate_lines', '--stdin'], {
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

const codes = (text: string): string[] => checkReport(text).findings.map((f) => f.code);

// A well-formed line: K0 first, two axes that do not overlap, a choice, an
// observation.
const GOOD =
    'Candidates: K0 keep the inline branch · A extract a Notifier service [ownership boundary] · ' +
    'B pass a callback [call-site coupling] → A; three callers already build the payload, so the boundary exists.';

describe('2.3 — the line is owed by decision class, not by file count', () => {
    it('owed class: a new ownership boundary with no line is a finding', () => {
        expect(codes('Extracted a Notifier service out of the controller.')).toContain('missing-candidates');
    });

    it('owed class: a contract change with no line is a finding', () => {
        expect(codes('Changed the response payload schema to carry a tenant id.')).toContain('missing-candidates');
    });

    it('not-owed class stays SILENT: a pure rename', () => {
        // A rename touches four files and offers no architectural choice. A
        // floor that fires here is the interview, not the floor.
        const v = checkReport('Renamed the variable `n` to `slotCount` across the module.');
        expect(v.owed).toBe(false);
        expect(v.findings).toEqual([]);
    });

    it('not-owed class stays SILENT: a generated-code refresh', () => {
        const v = checkReport('Re-ran the generator and regenerated the projection trees.');
        expect(v.owed).toBe(false);
        expect(v.findings).toEqual([]);
    });

    it('an exemption never overrules a positive owed match', () => {
        // A rename that ALSO changes a contract is a contract change. The
        // asymmetry is the safe direction and is deliberate.
        const v = checkReport('Renamed the method and changed its signature to take a tenant id.');
        expect(v.owed).toBe(true);
        expect(v.findings.map((f) => f.code)).toContain('missing-candidates');
    });

    it('accepts an owed report once a well-formed line is present', () => {
        expect(checkReport(`Extracted a Notifier service.\n\n${GOOD}\n`).findings).toEqual([]);
    });
});

describe('2.5 — an axis, not a count', () => {
    it('three candidates sharing an axis are reported as one material candidate', () => {
        const line =
            'Candidates: K0 keep it inline · A move the helper to `utils` [where the helper lives] · ' +
            'B move the helper to `lib` [where the helper lives] → A; utils is already imported.';
        const v = checkReport(`Introduced an abstraction over the two paths.\n\n${line}\n`);
        expect(v.findings.map((f) => f.code)).toContain('shared-axis');
        expect(v.findings.find((f) => f.code === 'shared-axis')?.message).toMatch(/ONE material candidate/);
    });

    it('a non-K0 candidate carrying no axis at all is a finding', () => {
        const line = 'Candidates: K0 keep it · A extract a service → A; it reads better.';
        expect(codes(`Extracted a service.\n\n${line}\n`)).toContain('missing-axis');
    });

    it('distinct axes pass', () => {
        expect(checkReport(`Extracted a service.\n\n${GOOD}\n`).findings).toEqual([]);
    });
});

describe('2.6 — do not generate a second form where there is only one', () => {
    it('a genuinely forced form produces a one-candidate line and is NOT a violation', () => {
        const line =
            'Candidates: K0 register in `register()` [forced: the base class fixes the extension point] ' +
            '→ K0; no other location is admissible.';
        const v = checkReport(`Introduced an abstraction for the hook.\n\n${line}\n`);
        expect(v.findings).toEqual([]);
    });

    it('a bare single candidate with no constraint IS a violation', () => {
        // Otherwise "I only thought of one" and "exactly one is admissible"
        // are the same line, and the obligation to check evaporates.
        const line = 'Candidates: K0 keep the current shape → K0; seems fine.';
        expect(codes(`Extracted a service.\n\n${line}\n`)).toContain('single-candidate-unforced');
    });
});

describe('2.1 — K0 is drawable, not an unchosen first row', () => {
    it('a report whose correct answer is "leave it" draws K0 and passes', () => {
        const line =
            'Candidates: K0 keep the existing retry loop · A introduce a backoff strategy object ' +
            '[failure semantics] → K0; the loop already caps at three attempts and no caller asks for more.';
        const v = checkReport(`Introduced an abstraction candidate for the retry path.\n\n${line}\n`);
        expect(v.findings).toEqual([]);
        expect(v.lines[0]?.chosen).toBe('K0');
    });

    it('a missing K0 is a finding — the set must not assume an edit is correct', () => {
        const line = 'Candidates: A extract a service [ownership boundary] · B inline it [call-site coupling] → A; fewer imports.';
        expect(codes(`Extracted a service.\n\n${line}\n`)).toContain('missing-k0');
    });

    it('K0 present but not first is a finding', () => {
        const line = 'Candidates: A extract a service [ownership boundary] · K0 keep it → A; fewer imports.';
        expect(codes(`Extracted a service.\n\n${line}\n`)).toContain('k0-not-first');
    });
});

describe('the decision half — a choice with an observation', () => {
    it('no choice is a finding', () => {
        const line = 'Candidates: K0 keep it · A extract a service [ownership boundary]';
        expect(codes(`Extracted a service.\n\n${line}\n`)).toContain('candidates-no-decision');
    });

    it('a choice with no deciding observation is a finding', () => {
        const line = 'Candidates: K0 keep it · A extract a service [ownership boundary] → A';
        expect(codes(`Extracted a service.\n\n${line}\n`)).toContain('missing-observation');
    });

    it('a choice naming a candidate that was never listed is a finding', () => {
        const line = 'Candidates: K0 keep it · A extract a service [ownership boundary] → C; it seemed best.';
        expect(codes(`Extracted a service.\n\n${line}\n`)).toContain('unknown-choice');
    });
});

describe('fence stripping — the contract illustration is not an emission', () => {
    it('a fenced example does not satisfy an owed report', () => {
        const fenced = `Extracted a Notifier service.\n\n~~~text\n${GOOD}\n~~~\n`;
        expect(codes(fenced)).toContain('missing-candidates');
    });
});

describe('parseLine — the grammar', () => {
    it('separates id, description, axis, choice and observation', () => {
        const l = parseLine(
            'K0 keep it · A extract a service [ownership boundary] → A; three callers already build the payload.',
        );
        expect(l.candidates.map((c) => c.id)).toEqual(['K0', 'A']);
        expect(l.candidates[1]?.axis).toBe('ownership boundary');
        expect(l.chosen).toBe('A');
        expect(l.observation).toBe('three callers already build the payload.');
    });

    it('reads a forced-form bracket as a constraint, not an axis', () => {
        const l = parseLine('K0 keep it [forced: the base class fixes the extension point] → K0; nothing else is admissible.');
        expect(l.candidates[0]?.forced).toBe('the base class fixes the extension point');
        expect(l.candidates[0]?.axis).toBeNull();
    });
});

describe('CLI', () => {
    it('exits 2 on findings and 0 on a clean owed report', () => {
        expect(runCli('Extracted a Notifier service.\n').code).toBe(2);
        expect(runCli(`Extracted a Notifier service.\n\n${GOOD}\n`).code).toBe(0);
    });

    it('reports a not-owed report distinctly from a pass', () => {
        const r = runCli('Renamed the variable `n` to `slotCount`.\n');
        expect(r.code).toBe(0);
        expect(r.stdout).toMatch(/no owed decision class detected/);
    });

    it('refuses an empty report rather than reading it as compliance', () => {
        expect(runCli('\n').code).toBe(1);
    });
});
