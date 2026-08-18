import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';
import {
    MIN_TASK_TERMS,
    MIN_TOP_SCORE,
    TOP_K,
    buildRouteLine,
    knownBareForHost,
    main,
    routeDecision,
    routePointers,
} from '../../src/scripts/hooks/skill_route_hook.js';
import { OBSERVATION_LOG, readObservationLog } from '../../src/scripts/_lib/skill_catalogue.js';
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
        // R2 finding 3: an earlier version REQUIRED that set to be non-empty,
        // which made the fixture assert that the defect still exists — Phase 2
        // AC-2 of this same roadmap is "the capture records no bare entries", so
        // the sibling phase succeeding would have redded this test with nothing
        // wrong. The clean log is now a legitimate branch, and the property under
        // test in that branch is that filtering is a no-op rather than that
        // nothing was suppressed.
        const bare = knownBareForHost('.', 'claude');
        const designPrompt = 'audit this dashboard design against our design tokens and review it';
        const unfiltered = routePointers(designPrompt, SKILLS_DIR).map(([name]) => name);

        if (bare === null || bare.size === 0) {
            expect(routePointers(designPrompt, SKILLS_DIR, () => bare).map(([n]) => n)).toEqual(
                unfiltered,
            );
            return;
        }

        // The vacuity guard is the first assertion, not an afterthought — a
        // `not.toContain` over an empty result passes on a filter that broke
        // everything, so this pins that the unfiltered line DID name a
        // suppressed skill before asserting the filtered one does not. It is
        // conditional on the log carrying a bare name the ranker reaches, which
        // is a property of the data and not of the code under test.
        const wouldName = unfiltered.filter((name) => bare.has(name));
        const filtered = routePointers(designPrompt, SKILLS_DIR, () => bare).map(([n]) => n);
        for (const name of filtered) expect(bare.has(name)).toBe(false);
        if (wouldName.length === 0) return;
        expect(filtered).not.toEqual(unfiltered);
    });

    it('keeps the survivors when a suppressed skill was not the one carrying the score', () => {
        // The filter narrows the SET; it does not gate the line. Suppressing a
        // pointer that is NOT the top-1 leaves the score-carrier intact, so the
        // line still fires and simply names one skill fewer.
        //
        // R2 finding 3, second half: derive the victim instead of indexing
        // `[1]!`, which throws outright on a prompt that happens to rank one row.
        const unfiltered = routePointers(PROMPT, SKILLS_DIR);
        const victim = unfiltered.slice(1).find(([, score]) => score < unfiltered[0]![1]);
        if (victim === undefined) return; // nothing below the top-1 to drop
        const filtered = routePointers(PROMPT, SKILLS_DIR, () => new Set([victim[0]]));
        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.length).toBeLessThanOrEqual(TOP_K);
        expect(filtered.map(([name]) => name)).not.toContain(victim[0]);
        expect(filtered[0]![0]).toBe(unfiltered[0]![0]);
    });

    it('falls silent when suppression removes every pointer above the floor', () => {
        // The load-bearing consequence of applying the floor to what is
        // DELIVERABLE rather than to what was ranked: the set can empty, and the
        // suppressed count is what distinguishes that silence from an unranked
        // prompt. Promoting a sub-floor pointer to fill the gap would be the
        // "advisory worse than silence" failure this concern's header ranks first.
        //
        // R2 finding 3: this used to pin two literal live scores (47 and 23
        // against a floor of 31) and would red on any catalogue edit that
        // reshuffled them. The property is derived from the ranking instead.
        const rows = rank(PROMPT, SKILLS_DIR);
        const aboveFloor = rows.filter(([, score]) => score >= MIN_TOP_SCORE).map(([name]) => name);
        expect(aboveFloor.length).toBeGreaterThan(0);

        const decision = routeDecision(PROMPT, SKILLS_DIR, () => new Set(aboveFloor));
        expect(decision.rows).toEqual([]);
        expect(decision.suppressed).toBeGreaterThan(0);
    });

    it('counts suppression over the pointer window, not the whole ranked list', () => {
        // R2 finding 1. `rank` returns every non-zero-scoring skill — hundreds on
        // this catalogue — so a bare name deep in the tail was never pointable and
        // must not bump a numerator defined as "skills the ranker wanted to point
        // at". Suppressing the whole tail below the window must therefore count 0.
        const rows = rank(PROMPT, SKILLS_DIR);
        const tail = rows.slice(TOP_K).map(([name]) => name);
        expect(tail.length).toBeGreaterThan(0);

        const decision = routeDecision(PROMPT, SKILLS_DIR, () => new Set(tail));
        expect(decision.suppressed).toBe(0);
        expect(decision.rows.map(([n]) => n)).toEqual(
            routePointers(PROMPT, SKILLS_DIR).map(([n]) => n),
        );
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

/**
 * The production wiring, pinned — R2 finding 5.
 *
 * The filter's whole value is that it fires, and until this block existed
 * nothing exercised `main()` or an envelope at all: the host is read from
 * `env["platform"]` and matched by exact string equality against the log's own
 * `host` labels, so a wrong key, an absent field or a label-vocabulary drift all
 * collapse to `host === null` → `null` → no filtering. Every one of those is
 * indistinguishable from "no observation", which means Phase 3 could have been
 * inert in production with every other fixture in this file green.
 *
 * These tests therefore assert the envelope contract end to end rather than the
 * pure functions: the key name, the label vocabulary, and the exit code.
 */
describe('skill-route — the production envelope wiring', () => {
    const DESIGN_PROMPT = 'audit this dashboard design against our design tokens and review it';

    function runMain(envelope: Record<string, unknown>): { rc: number; out: string } {
        let out = '';
        const prevWrite = process.stdout.write.bind(process.stdout);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.stdout as any).write = (chunk: any): boolean => {
            out += String(chunk);
            return true;
        };
        setHookStdinOverride(JSON.stringify(envelope));
        try {
            return { rc: main(), out };
        } finally {
            clearHookStdinOverride();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (process.stdout as any).write = prevWrite;
        }
    }

    const base = {
        schema_version: 1,
        event: 'user_prompt_submit',
        native_event: 'UserPromptSubmit',
        session_id: 'fixture',
        workspace_root: process.cwd(),
        payload: { prompt: DESIGN_PROMPT },
    };

    it('reads the host from `platform` and suppresses against the live log', () => {
        const bare = knownBareForHost(process.cwd(), 'claude');
        if (bare === null || bare.size === 0) {
            // Phase 2 AC-2 succeeded — nothing to suppress. Assert the no-op.
            const { rc } = runMain({ ...base, platform: 'claude' });
            expect([0, 2]).toContain(rc);
            return;
        }
        const { rc, out } = runMain({ ...base, platform: 'claude' });
        // exit 2 IS the warn delivery path; `emitFor` reduces it to a real 0.
        expect(rc).toBe(2);
        const emitted = JSON.parse(out.trim()) as { reason: string; additional_context: string };
        // The KEY is what this pins: `platform`, not `host`, not `native_platform`.
        expect(emitted.reason).toMatch(/suppressed as host-bare/);
        for (const name of bare) expect(emitted.additional_context).not.toContain(`${name} (`);
    });

    it('does not filter when the envelope carries no platform', () => {
        const { rc, out } = runMain(base);
        // exit 2 IS the warn delivery path; `emitFor` reduces it to a real 0.
        expect(rc).toBe(2);
        const emitted = JSON.parse(out.trim()) as { reason: string };
        expect(emitted.reason).not.toMatch(/suppressed/);
    });

    // The label vocabulary, pinned from the log itself rather than hardcoded:
    // `claude` must be a host the log actually knows, or the exact-equality match
    // is comparing against a name nothing writes.
    it('matches the label vocabulary the log actually uses', () => {
        const records = readObservationLog(path.join(process.cwd(), OBSERVATION_LOG));
        expect(records.length).toBeGreaterThan(0);
        const hosts = new Set(records.map((r) => r.host));
        expect(hosts.has('claude')).toBe(true);
        // And a host whose only records enumerate nothing yields no filtering,
        // which is the codex case rather than a hypothetical.
        for (const host of hosts) {
            const bare = knownBareForHost(process.cwd(), host);
            if (bare === null) continue;
            expect(bare).toBeInstanceOf(Set);
        }
    });
});
