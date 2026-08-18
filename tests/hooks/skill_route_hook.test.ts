import { describe, expect, it } from 'vitest';

import {
    MIN_TASK_TERMS,
    MIN_TOP_SCORE,
    TOP_K,
    buildRouteLine,
    knownBareForHost,
    routeDecision,
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

/**
 * AC-3 of road-to-catalogue-host-fit Phase 3, in both directions.
 *
 * The defect: the ranker reads the on-disk tree, so a skill the host truncated
 * is still rankable and still pointable — and the pointer then names a skill
 * whose description the model never received. Measured, not assumed: 16 of 16
 * bare entries in the 2026-08-12 claude observation are in this ranker's
 * catalogue.
 *
 * Both directions are asserted because only one of them is the risk. Filtering
 * on a present observation is the feature; behaving IDENTICALLY on an absent one
 * is the safety property, and a suite that only tested the feature would pass on
 * a filter that silently narrows whenever the log is missing.
 */
describe('skill-route — the host-bare delivery filter', () => {
    /** A prompt that reliably clears both floors on the real catalogue. */
    const PROMPT = 'review the authorization policy and tenant scope for this endpoint';

    it('never names a skill the REAL claude observation recorded as bare', () => {
        // End-to-end against the committed log rather than a constructed set,
        // because the real data is the argument: the 2026-08-12 claude
        // observation records 16 bare entries and all 16 are in this ranker's
        // catalogue, among them `design-review` and `design-intelligence`.
        //
        // The vacuity guard is the first assertion, not an afterthought — a
        // `not.toContain` over an empty result passes on a filter that broke
        // everything, so this pins that the unfiltered line DID name a
        // suppressed skill before asserting the filtered one does not.
        const bare = knownBareForHost('.', 'claude');
        expect(bare).not.toBeNull();
        expect(bare!.size).toBeGreaterThan(0);

        const designPrompt = 'audit this dashboard design against our design tokens and review it';
        const unfiltered = routePointers(designPrompt, SKILLS_DIR).map(([name]) => name);
        expect(unfiltered.some((name) => bare!.has(name))).toBe(true);

        const filtered = routePointers(designPrompt, SKILLS_DIR, () => bare).map(([n]) => n);
        for (const name of filtered) expect(bare!.has(name)).toBe(false);
    });

    it('keeps the survivors when a suppressed skill was not the one carrying the score', () => {
        // The filter narrows the SET; it does not gate the line. Suppressing a
        // lower-ranked pointer leaves the top-1 intact, so the line still fires
        // and simply names one skill fewer.
        const unfiltered = routePointers(PROMPT, SKILLS_DIR);
        expect(unfiltered.length).toBeGreaterThan(1);
        const dropped = unfiltered[1]![0];
        const filtered = routePointers(PROMPT, SKILLS_DIR, () => new Set([dropped]));
        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.length).toBeLessThanOrEqual(TOP_K);
        expect(filtered.map(([name]) => name)).not.toContain(dropped);
        expect(filtered[0]![0]).toBe(unfiltered[0]![0]);
    });

    it('falls silent when the suppressed skill WAS the score, and says so in the count', () => {
        // Written against the real corpus rather than a constructed one, because
        // the real numbers are the argument: on this prompt the ranker returns
        // `authz-review` at 47 and the next entry at 23, and MIN_TOP_SCORE is
        // 31. So suppressing the top-1 leaves nothing that clears a floor
        // calibrated for CONFIDENCE — and naming a 23/100 pointer because the
        // 47 one is undeliverable would be the "advisory worse than silence"
        // failure this concern's header ranks as its first risk.
        //
        // This is the load-bearing consequence of applying the floor to what is
        // DELIVERABLE rather than to what was ranked, and it is pinned rather
        // than smoothed over: the suppressed count is what distinguishes this
        // silence from an unranked prompt.
        const rows = rank(PROMPT, SKILLS_DIR);
        expect(rows[0]![1]).toBeGreaterThanOrEqual(MIN_TOP_SCORE);
        expect(rows[1]![1]).toBeLessThan(MIN_TOP_SCORE);

        const decision = routeDecision(PROMPT, SKILLS_DIR, () => new Set([rows[0]![0]]));
        expect(decision.rows).toEqual([]);
        expect(decision.suppressed).toBe(1);
    });

    it('is byte-identical to today when no observation is present', () => {
        // The fail-open half. `null` is what every uncertain state resolves to:
        // no log, no record for this host, a host that enumerates nothing, a
        // malformed line, an unknown host, or a throw from the provider.
        const baseline = routePointers(PROMPT, SKILLS_DIR);
        expect(routePointers(PROMPT, SKILLS_DIR, () => null)).toEqual(baseline);
        expect(
            routePointers(PROMPT, SKILLS_DIR, () => {
                throw new Error('unreadable log');
            }),
        ).toEqual(baseline);
        // An empty set means "measured clean" rather than "never measured" —
        // a different fact, and deliberately the same behaviour.
        expect(routePointers(PROMPT, SKILLS_DIR, () => new Set())).toEqual(baseline);
    });

    it('does not read the log on a prompt below the term floor', () => {
        // The header promises a sub-floor prompt costs 0 ms because the term
        // check precedes the catalogue read. The provider is a thunk for the
        // same reason, so pin that it is never called — an eager read would
        // have quietly falsified that paragraph.
        let called = 0;
        routePointers('fix it', SKILLS_DIR, () => {
            called += 1;
            return null;
        });
        expect(called).toBe(0);
        expect(_tokenize('fix it').size).toBeLessThan(MIN_TASK_TERMS);
    });

    it('reports the suppressed count so the registered metric has a numerator', () => {
        const unfiltered = routePointers(PROMPT, SKILLS_DIR);
        const decision = routeDecision(PROMPT, SKILLS_DIR, () => new Set([unfiltered[0]![0]]));
        expect(decision.suppressed).toBe(1);
        expect(routeDecision(PROMPT, SKILLS_DIR, () => null).suppressed).toBe(0);
    });

    it('applies the score floor to the best DELIVERABLE pointer', () => {
        // Suppressing every ranked skill cannot leave a pointer standing, and
        // the count still reports what was dropped — silence with a reason
        // rather than silence that looks like an unranked prompt.
        const all = new Set(rank(PROMPT, SKILLS_DIR).map(([name]) => name));
        const decision = routeDecision(PROMPT, SKILLS_DIR, () => all);
        expect(decision.rows).toEqual([]);
        expect(decision.suppressed).toBeGreaterThan(0);
        expect(MIN_TOP_SCORE).toBeGreaterThan(0);
    });
});
