// Wiring tests for provider qualification inside `build_members`
// (road-to-release-review-p0 Phase 3, steps 3 and 4).
//
// `qualification.test.ts` covers the ladder in isolation. This file covers the
// one thing the ladder cannot check about itself: that the pre-run quorum
// actually consumes it, and that it consumes it in the direction that reports
// being SHORT rather than the direction that shrinks the roster.
import { afterEach, describe, expect, it } from 'vitest';

import type { EnvironmentReport } from '../../../src/scripts/_lib/environment_detector.js';
import type { QuorumResult } from '../../../src/scripts/ai_council/quorum.js';
import type { ProbeStore } from '../../../src/scripts/ai_council/probe_store.js';
import type { MemberQualification } from '../../../src/scripts/ai_council/qualification.js';
import { build_members } from '../../../src/scripts/council_cli.js';

const KEY_VAR = 'COUNCIL_QUALIFICATION_TEST_KEY';

function emptyReport(): EnvironmentReport {
    return { hosts: [], auth: [], keys: [] };
}

/** Two enabled seats, both resolving through the api-key rung. */
function twoSeatSettings(): Record<string, unknown> {
    return {
        ai_council: {
            enabled: true,
            mode: 'auto',
            members: {
                anthropic: { enabled: true, model: 'claude-sonnet-4-5', api_key_ref: `env:${KEY_VAR}` },
                openai: { enabled: true, model: 'gpt-4o', api_key_ref: `env:${KEY_VAR}` },
            },
        },
    };
}

function storeWith(members: ProbeStore['members']): ProbeStore {
    return { schema: 1, members };
}

const FRESH = new Date().toISOString().slice(0, 10);

afterEach(() => {
    delete process.env[KEY_VAR];
});

describe('build_members — qualification is not evaluated without a store', () => {
    // The determinism guarantee `probe_store`'s docstring makes: a caller that
    // supplies nothing gets today's constructibility-only presence, so no test
    // and no consumer silently depends on gitignored runtime state.
    it('omitting probe_store leaves presence at constructibility only', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const quorum_out: { result: QuorumResult | null } = { result: null };
        build_members(twoSeatSettings(), { environment_report: emptyReport(), quorum_out });
        expect(quorum_out.result).toEqual({ status: 'concluded', threshold: 1, total: 2, present: 2 });
    });

    it('and qualification_out stays empty, which means "not evaluated" — not "all qualified"', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const qualification_out: MemberQualification[] = [];
        build_members(twoSeatSettings(), { environment_report: emptyReport(), qualification_out });
        expect(qualification_out).toEqual([]);
    });
});

describe('build_members — the pre-run over-claim this repairs', () => {
    // The recorded incident: the pre-run banner printed `2/2 present …
    // concluded` and the post-run reading was `0/2`. Both seats constructed;
    // neither had ever been observed to answer.
    it('two constructible but never-observed seats report 0/2 present, not 2/2', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const quorum_out: { result: QuorumResult | null } = { result: null };
        build_members(twoSeatSettings(), {
            environment_report: emptyReport(),
            quorum_out,
            probe_store: storeWith({}),
        });
        expect(quorum_out.result).toEqual({
            status: 'inconclusive',
            threshold: 1,
            total: 2,
            present: 0,
        });
    });

    it('one observed seat and one never-observed seat reports 1/2 — degraded, not convergence', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const quorum_out: { result: QuorumResult | null } = { result: null };
        build_members(twoSeatSettings(), {
            environment_report: emptyReport(),
            quorum_out,
            probe_store: storeWith({ anthropic: { at: FRESH, outcome: 'ok' } }),
        });
        expect(quorum_out.result).toEqual({ status: 'concluded', threshold: 1, total: 2, present: 1 });
    });

    it('both observed reports full attendance', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const quorum_out: { result: QuorumResult | null } = { result: null };
        build_members(twoSeatSettings(), {
            environment_report: emptyReport(),
            quorum_out,
            probe_store: storeWith({
                anthropic: { at: FRESH, outcome: 'ok' },
                openai: { at: FRESH, outcome: 'ok' },
            }),
        });
        expect(quorum_out.result).toEqual({ status: 'concluded', threshold: 1, total: 2, present: 2 });
    });

    // The direction check, and it is the whole point of step 4. If the
    // unqualified seat were dropped from `total` instead of from `present`,
    // this would read `{total: 1, present: 1, threshold: 1, concluded}` — a
    // full-attendance verdict on half a roster, i.e. the same over-claim
    // wearing the opposite arithmetic.
    it('an unqualified seat is withheld from present and KEPT in total', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const quorum_out: { result: QuorumResult | null } = { result: null };
        build_members(twoSeatSettings(), {
            environment_report: emptyReport(),
            quorum_out,
            probe_store: storeWith({ anthropic: { at: FRESH, outcome: 'ok' } }),
        });
        expect(quorum_out.result?.total).toBe(2);
        expect(quorum_out.result?.threshold).toBe(1);
    });
});

describe('build_members — no double subtraction', () => {
    // A seat that never constructs is already counted absent. Counting it a
    // second time because it also fails to qualify would drive `present`
    // negative-ward and understate attendance — the mirror of the defect.
    it('a seat absent at construction is not subtracted twice', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        // anthropic resolves through the key rung and is observed; openai
        // carries no key ref at all, so it never constructs and is recorded
        // absent. Its qualification is ALSO `unavailable` — the case where a
        // naive implementation subtracts it once as absent and once as
        // unqualified, reporting 0/2 for a pass with one healthy seat.
        const settings = {
            ai_council: {
                enabled: true,
                mode: 'auto',
                members: {
                    anthropic: { enabled: true, model: 'claude-sonnet-4-5', api_key_ref: `env:${KEY_VAR}` },
                    openai: { enabled: true, model: 'gpt-4o' },
                },
            },
        };
        const skipped: Record<string, unknown>[] = [];
        const quorum_out: { result: QuorumResult | null } = { result: null };
        build_members(settings, {
            environment_report: emptyReport(),
            skipped,
            quorum_out,
            probe_store: storeWith({ anthropic: { at: FRESH, outcome: 'ok' } }),
        });
        expect(skipped.map((s) => s['member'])).toEqual(['openai']);
        expect(quorum_out.result).toEqual({
            status: 'concluded',
            threshold: 1,
            total: 2,
            present: 1,
        });
    });
});

describe('build_members — qualification_out', () => {
    it('reports a verdict per enabled seat when a store is supplied', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const qualification_out: MemberQualification[] = [];
        build_members(twoSeatSettings(), {
            environment_report: emptyReport(),
            qualification_out,
            probe_store: storeWith({ anthropic: { at: FRESH, outcome: 'ok' } }),
        });
        expect(qualification_out.map((q) => [q.name, q.verdict])).toEqual([
            ['anthropic', 'available'],
            ['openai', 'unknown'],
        ]);
    });

    it('a seat whose last exchange rejected the model id reads unavailable', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const qualification_out: MemberQualification[] = [];
        build_members(twoSeatSettings(), {
            environment_report: emptyReport(),
            qualification_out,
            probe_store: storeWith({
                anthropic: { at: FRESH, outcome: 'ok' },
                openai: { at: FRESH, outcome: 'model_unservable' },
            }),
        });
        const openai = qualification_out.find((q) => q.name === 'openai');
        expect(openai?.verdict).toBe('unavailable');
        expect(openai?.decidedBy).toBe('model_identifier');
    });

    it('an exhausted quota still counts toward attendance — the seat is alive', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const quorum_out: { result: QuorumResult | null } = { result: null };
        build_members(twoSeatSettings(), {
            environment_report: emptyReport(),
            quorum_out,
            probe_store: storeWith({
                anthropic: { at: FRESH, outcome: 'ok' },
                openai: { at: FRESH, outcome: 'quota_exhausted' },
            }),
        });
        expect(quorum_out.result?.present).toBe(2);
    });
});
