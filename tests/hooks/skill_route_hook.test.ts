import { describe, expect, it } from 'vitest';

import {
    MIN_TASK_TERMS,
    MIN_TOP_SCORE,
    TOP_K,
    buildRouteLine,
    routePointers,
} from '../../src/scripts/hooks/skill_route_hook.js';
import { _tokenize, rank } from '../../src/scripts/skill_tools/score_skill_relevance.js';

/**
 * The two floors exist because the R2 review of this branch found the concern
 * firing on `"fix it"` at 70/100. Both tests below are written against that
 * defect specifically — a generic "it returns rows" assertion would have passed
 * on the broken version, which is the tautology this suite is meant to avoid.
 */
const SKILLS_DIR = 'src/skills';

describe('skill-route — the short-prompt floor', () => {
    it('stays silent on a prompt too short for the ratio to mean anything', () => {
        // Regression pin: the scorer divides by |task terms|, so before
        // MIN_TASK_TERMS existed this exact prompt scored 70/100 and emitted
        // the alphabetically first three skills. Assert the CAUSE, not just the
        // silence — a future change that keeps silence for a different reason
        // should still tell us the denominator guard is what fired.
        expect(_tokenize('fix it').size).toBeLessThan(MIN_TASK_TERMS);
        expect(routePointers('fix it', SKILLS_DIR)).toEqual([]);
    });

    it.each(['weiter', 'mach das', 'was denkst du dazu'])(
        'stays silent on the conversational filler %j',
        (prompt) => {
            expect(routePointers(prompt, SKILLS_DIR)).toEqual([]);
        },
    );

    it('does not exclude any prompt the score floor was calibrated on', () => {
        // MIN_TASK_TERMS is the corpus minimum precisely so the term floor
        // costs the calibration nothing. If a future edit raises it, this fails
        // and names the trade being made.
        const corpusMin = Math.min(
            ..."Should the invoice calculation live in the controller or in a dedicated class?|Please add a payment service that handles refunds and partial captures.|Refactor the invoice exporter and remove the duplicate parsing logic."
                .split('|')
                .map((p) => _tokenize(p).size),
        );
        expect(MIN_TASK_TERMS).toBeLessThanOrEqual(corpusMin);
    });
});

describe('skill-route — the score floor', () => {
    it('sits strictly above a persona-only match', () => {
        // The scorer is `overlap * 70 + personaHit * 30`, so a skill whose
        // persona slug appears in the prompt scores exactly 30 with ZERO
        // keyword overlap. A floor of 30 with a `>=` test would admit it.
        expect(MIN_TOP_SCORE).toBeGreaterThan(30);
    });

    it('emits at most TOP_K pointers, all at or above the floor', () => {
        const prompt =
            'Please review this pull request diff for security problems in the authorization checks';
        const rows = routePointers(prompt, SKILLS_DIR);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThanOrEqual(TOP_K);
        expect(rows[0]![1]).toBeGreaterThanOrEqual(MIN_TOP_SCORE);
        // Derived from the ranker rather than hardcoded: pinning a literal
        // skill name here would break on any catalogue edit for no defect.
        expect(rows.map((r) => r[0])).toEqual(
            rank(prompt, SKILLS_DIR)
                .slice(0, TOP_K)
                .map((r) => r[0]),
        );
    });

    it('is silent when the catalogue root does not resolve', () => {
        // An unreadable catalogue must not read as "no skill fits" — the two
        // are different answers and only one of them is a ranking.
        expect(routePointers('review the authorization checks', null)).toEqual([]);
    });
});

describe('skill-route — the injected line', () => {
    it('carries names and scores, never a body or a load instruction', () => {
        const line = buildRouteLine([
            ['authz-review', 46, []],
            ['threat-modeling', 40, ['security-engineer']],
        ]);
        expect(line).toContain('authz-review (46)');
        expect(line).toContain('threat-modeling (40)');
        expect(line).toMatch(/^<skill-route>/);
        expect(line).toMatch(/<\/skill-route>$/);
        expect(line).not.toMatch(/\bload\b|\bread the\b|\bopen all\b/i);
    });

    it('stays within its registered 512-byte budget row', () => {
        // The row is the ceiling that keeps this a pointer line. Three of the
        // longest skill names in the tree is the worst realistic case.
        const worst = buildRouteLine([
            ['road-to-inbox-harvest-authoring-discipline-placeholder', 99, []],
            ['subagent-value-realization-followup-placeholder', 98, []],
            ['skill-ecosystem-executable-payloads-placeholder', 97, []],
        ]);
        expect(Buffer.byteLength(worst)).toBeLessThan(512);
    });
});
