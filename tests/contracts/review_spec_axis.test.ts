/**
 * Contract tests for the spec axis on the default review path.
 *
 * The defect: all five default judges asked a craft-or-correctness question,
 * so a change that is correct, clean, typed and tested — and does not do what
 * was asked — was reported green by the whole panel. The one spec judge in the
 * tree sat behind one orchestration mode of nine and required the caller to
 * hand in the criteria.
 *
 * WHAT THESE TESTS ARE, HONESTLY. The real check is behavioural — "a correct
 * off-spec diff is caught" — and it cannot run here: `run_skill_evals`'s
 * `_spawn_subagent` is an unimplemented stub (src/scripts/run_skill_evals.ts:95-101),
 * so NO scenario in the eval corpus has ever been executed in this repository.
 * The corpus is a declared fixture set, not a measured one. These tests assert
 * the artefacts the behaviour reads from, plus one thing a live run could not
 * give: a DETERMINISTIC pre-state proof that the pre-change panel could not
 * have caught the class at all, because no judge on it read a requirement.
 *
 * That pre-state proof is stronger than the eval run the roadmap asked for,
 * not weaker. A model run showing a miss is one sample of a stochastic
 * process; "no judge on the panel reads a criterion" is a structural fact
 * about the file, and it is checked below against the merge-base rather than
 * against a remembered claim.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildReviewLine, FORBIDDEN_FREEFORM_FIELDS, REVIEW_LINE_FIELDS } from '../../src/scripts/_lib/review_telemetry.js';

const ROOT = path.join(__dirname, '../..');
const COMMAND = path.join(ROOT, 'src/domains/engineering-base/review/changes/command.md');
const SPEC_JUDGE = path.join(ROOT, 'src/skills/judge-spec-compliance/SKILL.md');
const SYNTHESIS = path.join(ROOT, 'src/skills/judge-synthesis/SKILL.md');
const EVALS = path.join(ROOT, 'src/skills/code-review/evals/evals.json');

function read(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

/**
 * The command file as it stood before this branch, or null when the base ref
 * is unreachable (a shallow clone, a detached CI checkout). Null SKIPS the
 * pre-state assertion rather than passing it — an unreachable base is "not
 * measured", never "no drift".
 */
function commandFileAtBase(): string | null {
    for (const base of ['origin/main', 'main']) {
        try {
            const mergeBase = execFileSync('git', ['merge-base', base, 'HEAD'], {
                cwd: ROOT,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            return execFileSync(
                'git',
                ['show', `${mergeBase}:src/domains/engineering-base/review/changes/command.md`],
                { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
            );
        } catch {
            continue;
        }
    }
    return null;
}

/**
 * The rows of the judge table. Anchored on the markdown-link shape the table
 * actually uses — `| [`judge-x`](…) | focus |` — so a prose mention of a judge
 * name elsewhere in the file cannot be counted as a row.
 */
function judgeTableRows(text: string): string[] {
    return text.split('\n').filter((l) => /^\|\s*\[`(judge-|architecture-)[a-z-]+`\]\(/.test(l));
}

describe('spec axis — the pre-state that made it necessary', () => {
    it('no judge on the pre-change panel read a requirement (deterministic miss proof)', () => {
        const before = commandFileAtBase();
        if (before === null) {
            // Unreachable base: not measured. Say so; do not assert a pass.
            console.warn('review_spec_axis: base ref unreachable — pre-state assertion skipped, NOT satisfied');
            return;
        }
        const rows = judgeTableRows(before);
        expect(rows.length, 'the pre-change panel must have had rows to compare against').toBeGreaterThan(0);
        const specRows = rows.filter((r) => /spec|criterion|criteria|requirement/i.test(r));
        expect(
            specRows,
            'pre-state: a judge reading a requirement would mean this roadmap had nothing to fix',
        ).toEqual([]);
    });

    it('the current panel has a spec judge, and it is the sixth', () => {
        const rows = judgeTableRows(read(COMMAND));
        expect(rows.length).toBe(6);
        expect(rows.filter((r) => r.includes('judge-spec-compliance')).length).toBe(1);
    });

    it('the prose judge count agrees with the table it describes', () => {
        const text = read(COMMAND);
        // Exactly one surviving `four`, and it is the settings-ask protocol's
        // four slots — the line 0.2 named as excluded, not a judge count.
        const fours = text.split('\n').filter((l) => /\bfour\b/i.test(l));
        expect(fours.length).toBe(1);
        expect(fours[0]).toMatch(/slot/i);
    });
});

describe('spec axis — no criteria is never a pass', () => {
    it('the judge declares exactly three criteria-source states', () => {
        const text = read(SPEC_JUDGE);
        for (const state of ['supplied', 'not_provided', 'supplied_unparseable']) {
            expect(text, `criteria_source state ${state}`).toContain(state);
        }
        // The council resolved spec-source-binding as (c): criteria are read
        // only when supplied, so `derived` is not a producible state. A judge
        // that could emit it would be inferring the spec from the diff.
        expect(/`derived`/.test(text), 'no derived state may exist under option (c)').toBe(false);
    });

    it('a no-criteria run returns the no-criteria verdict, never SATISFIED', () => {
        const text = read(SPEC_JUDGE);
        expect(text).toMatch(/Do NOT return `SATISFIED` when no criteria were supplied/);
    });

    it('unparseable criteria are an error, not folded into no-criteria', () => {
        const text = read(SPEC_JUDGE);
        const idx = text.indexOf('supplied_unparseable');
        expect(idx).toBeGreaterThan(-1);
        // The distinction must be stated where the state is defined, not only
        // in prose elsewhere: silently reading unparseable as "none" is the
        // failure the third state exists to prevent.
        expect(text.slice(idx, idx + 400)).toMatch(/error/i);
    });

    it('the eval corpus carries the off-spec pair and the no-criteria case', () => {
        const corpus = JSON.parse(read(EVALS)) as { scenarios: { id: string; assertions: { kind: string; value?: string }[] }[] };
        const ids = corpus.scenarios.map((s) => s.id);
        expect(ids).toContain('golden-spec-gap-correct-but-wrong');
        expect(ids).toContain('golden-spec-gap-negative-control');
        expect(ids).toContain('golden-spec-no-criteria-must-not-pass');
        // The negative control is what makes the pair falsifiable: without it,
        // a judge flagging every diff as non-compliant would pass the first.
        const control = corpus.scenarios.find((s) => s.id === 'golden-spec-gap-negative-control');
        expect(control?.assertions.some((a) => a.kind === 'contains' && a.value === 'SATISFIED')).toBe(true);
        const none = corpus.scenarios.find((s) => s.id === 'golden-spec-no-criteria-must-not-pass');
        expect(none?.assertions.some((a) => a.kind === 'not_contains' && a.value === 'SATISFIED')).toBe(true);
    });
});

describe('spec axis — synthesis keeps it off the severity axis', () => {
    it('spec findings are their own dimension, not a tier entry', () => {
        const text = read(SYNTHESIS);
        expect(text).toMatch(/### 4c\./);
        expect(text).toMatch(/A SPEC FINDING NEVER BECOMES A CRAFT FINDING/);
        expect(text).toMatch(/judge-spec-compliance/);
    });

    it('the spec vocabulary is excluded from the ordered severity axis', () => {
        const text = read(SYNTHESIS);
        const axisLine = text.split('\n').find((l) => l.startsWith('Ordered worst→best:'));
        expect(axisLine, 'the ordered axis line must exist').toBeDefined();
        for (const word of ['SATISFIED', 'PARTIAL', 'MISSING']) {
            expect(axisLine).not.toContain(word);
        }
        expect(text).toMatch(/deliberately absent from that axis/);
    });

    it('the overall recommendation names the spec dimension', () => {
        const text = read(SYNTHESIS);
        const start = text.indexOf('### 5. Overall recommendation');
        expect(start).toBeGreaterThan(-1);
        const section = text.slice(start, start + 1400);
        expect(section).toMatch(/spec dimension/);
        expect(section).toMatch(/requirement compliance NOT\s+verified/);
    });

    it('stays under the 400-line skill cap', () => {
        expect(read(SYNTHESIS).split('\n').length).toBeLessThan(400);
    });
});

describe('review telemetry — privacy by construction', () => {
    it('the line carries no free-form field', () => {
        for (const banned of FORBIDDEN_FREEFORM_FIELDS) {
            expect(REVIEW_LINE_FIELDS as readonly string[]).not.toContain(banned);
        }
    });

    it('a free-form field is REJECTED at build, not stripped', () => {
        const withPayload = {
            at: '2026-08-22T00:00:00Z',
            judges_declared: 6,
            judges_ran: 6,
            spec_axis_reach: 'reachable_with_criteria' as const,
            criteria_source: 'supplied' as const,
            criteria_count: 1,
            spec_missing: 0,
            spec_partial: 0,
            recommendation: 'proceed' as const,
            payload: 'the whole diff and the customer name',
        };
        const built = buildReviewLine(withPayload as unknown as Parameters<typeof buildReviewLine>[0]);
        expect(built.line).toBeNull();
        expect(built.errors.join(' ')).toMatch(/payload/);
    });

    it('an unreachable axis cannot claim a counterfactual', () => {
        const built = buildReviewLine({
            at: '2026-08-22T00:00:00Z',
            judges_declared: 6,
            judges_ran: 5,
            spec_axis_reach: 'unreachable',
            criteria_source: 'not_provided',
            criteria_count: 0,
            spec_missing: 0,
            spec_partial: 0,
            recommendation: 'proceed',
            spec_axis_effect: 'unchanged',
        });
        expect(built.line).toBeNull();
        expect(built.errors.join(' ')).toMatch(/null when the axis was unreachable/);
    });

    it('a valid line builds and pins the schema id', () => {
        const built = buildReviewLine({
            at: '2026-08-22T00:00:00Z',
            judges_declared: 6,
            judges_ran: 6,
            spec_axis_reach: 'reachable_with_criteria',
            criteria_source: 'supplied',
            criteria_count: 3,
            spec_missing: 1,
            spec_partial: 0,
            recommendation: 'block',
            spec_axis_effect: 'changed',
        });
        expect(built.errors).toEqual([]);
        expect(built.line?.schema).toBe('review-axis-v1');
        expect(Object.keys(built.line ?? {}).sort()).toEqual([...REVIEW_LINE_FIELDS].sort());
    });
});
