// Tests for src/scripts/ai_council/qualification.ts
// (road-to-release-review-p0 Phase 3).
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_PROBE_MAX_AGE_DAYS,
    formatQualificationLine,
    isCountableForQuorum,
    QUALIFICATION_LADDER,
    qualifiedAttendance,
    qualifyMember,
    type MemberQualificationInput,
} from '../../../src/scripts/ai_council/qualification.js';
import { classifyCliFailure } from '../../../src/scripts/ai_council/transport_resolver.js';

const NOW = new Date('2026-08-17T00:00:00Z');

/** A seat with everything resolved and a fresh successful exchange. */
function healthy(over: Partial<MemberQualificationInput> = {}): MemberQualificationInput {
    return {
        name: 'anthropic',
        transport: { available: true, transport: 'cli', reason: null, absentReason: null },
        modelId: 'claude-opus-5',
        lastProbe: { at: '2026-08-16', outcome: 'ok' },
        now: NOW,
        ...over,
    };
}

describe('qualifyMember — the happy path', () => {
    it('a fully resolved, freshly probed seat is available', () => {
        const q = qualifyMember(healthy());
        expect(q.verdict).toBe('available');
        expect(q.decidedBy).toBeNull();
    });

    it('always emits the full ladder, in order', () => {
        const q = qualifyMember(healthy());
        expect(q.checks.map((c) => c.id)).toEqual([...QUALIFICATION_LADDER]);
    });

    it('every check carries a non-empty detail, including the passes', () => {
        for (const c of qualifyMember(healthy()).checks) {
            expect(c.detail.length).toBeGreaterThan(0);
        }
    });
});

describe('qualifyMember — the defect this module was built for', () => {
    // The recorded incident: a seat reported CONFIGURED, was entirely dead, and
    // the pass printed a quorum it never reached. Configuration alone must
    // never read as available.
    it('a configured, plausible, NEVER-PROBED seat is unknown — not available', () => {
        const q = qualifyMember(healthy({ lastProbe: null }));
        expect(q.verdict).toBe('unknown');
        expect(q.decidedBy).toBe('live_probe');
    });

    it('and an unknown seat is not countable toward presence', () => {
        expect(isCountableForQuorum(qualifyMember(healthy({ lastProbe: null })).verdict)).toBe(false);
    });

    it('a model id the transport rejected fails on the model rung, not silently', () => {
        const q = qualifyMember(healthy({ lastProbe: { at: '2026-08-15', outcome: 'model_unservable' } }));
        expect(q.verdict).toBe('unavailable');
        expect(q.decidedBy).toBe('model_identifier');
    });
});

describe('qualifyMember — hard failures', () => {
    it('no binary fails on the first rung', () => {
        const q = qualifyMember(
            healthy({
                transport: { available: false, transport: null, reason: 'no binary', absentReason: 'no_binary' },
            }),
        );
        expect(q.verdict).toBe('unavailable');
        expect(q.decidedBy).toBe('installed');
    });

    it('no credential fails on the auth rung', () => {
        const q = qualifyMember(
            healthy({
                transport: { available: false, transport: null, reason: 'no key', absentReason: 'no_auth' },
            }),
        );
        expect(q.verdict).toBe('unavailable');
        expect(q.decidedBy).toBe('authenticated');
    });

    it('a failure short-circuits — every later rung reports skipped, not a consequential finding', () => {
        const q = qualifyMember(
            healthy({
                transport: { available: false, transport: null, reason: 'no binary', absentReason: 'no_binary' },
            }),
        );
        const after = q.checks.slice(1);
        expect(after.every((c) => c.status === 'skipped')).toBe(true);
        // The shape is still the full ladder so a reader can see where it stopped.
        expect(q.checks).toHaveLength(QUALIFICATION_LADDER.length);
    });

    it('a declared system prompt that does not resolve fails', () => {
        const q = qualifyMember(healthy({ systemPrompt: { declared: '/nope.md', exists: false } }));
        expect(q.verdict).toBe('unavailable');
        expect(q.decidedBy).toBe('system_prompt_path');
    });

    it('an empty model identifier fails', () => {
        const q = qualifyMember(healthy({ modelId: '   ' }));
        expect(q.verdict).toBe('unavailable');
        expect(q.decidedBy).toBe('model_identifier');
    });
});

describe('qualifyMember — impaired but alive', () => {
    it('an exhausted quota is degraded, never unavailable — the cap is one the operator set', () => {
        const q = qualifyMember(healthy({ lastProbe: { at: '2026-08-16', outcome: 'quota_exhausted' } }));
        expect(q.verdict).toBe('degraded');
        expect(isCountableForQuorum(q.verdict)).toBe(true);
    });

    it('a transient timeout is degraded', () => {
        expect(qualifyMember(healthy({ lastProbe: { at: '2026-08-16', outcome: 'timeout' } })).verdict).toBe(
            'degraded',
        );
    });

    // R2 finding 1 (high), and the reason it was high: `other` is
    // `classifyCliFailure`'s catch-all, and `_postRunQuorum` routes a member
    // that produced NOTHING through it — `'empty response body'` and
    // `'no response'` both classify as `other`. While `other` sat in
    // IMPAIRED_FAILURES, a dispatched seat that returned silence recorded as
    // `degraded`, stayed countable, and was counted present on the next pass:
    // the over-claim this whole module exists to remove, one layer down.
    //
    // Re-adding `'other'` to IMPAIRED_FAILURES fails this test and the
    // countability assertion below, and nothing else — verified by putting it
    // back and re-running.
    it('an UNCLASSIFIABLE failure is unavailable, never degraded', () => {
        const q = qualifyMember(healthy({ lastProbe: { at: '2026-08-16', outcome: 'other' } }));
        expect(q.verdict).toBe('unavailable');
        expect(q.decidedBy).toBe('live_probe');
    });

    it('and a seat that returned silence therefore cannot be counted present', () => {
        // The exact string `_postRunQuorum` classifies for an empty answer.
        expect(classifyCliFailure('empty response body')).toBe('other');
        expect(classifyCliFailure('no response')).toBe('other');
        const q = qualifyMember(healthy({ lastProbe: { at: '2026-08-16', outcome: 'other' } }));
        expect(isCountableForQuorum(q.verdict)).toBe(false);
    });

    // R2 finding 13: `cli_unsupported` is what `classifyCliFailure` returns
    // for `parse_failed` — a response the CLI could not parse, which says
    // nothing about the model identifier. It must still reach `unavailable`,
    // but through the probe rung, so the REASON is not a fabricated claim that
    // the transport rejected the id.
    it('an unparseable CLI response fails on the probe rung, not on the model rung', () => {
        const q = qualifyMember(healthy({ lastProbe: { at: '2026-08-16', outcome: 'cli_unsupported' } }));
        expect(q.verdict).toBe('unavailable');
        expect(q.decidedBy).toBe('live_probe');
        expect(q.checks.find((c) => c.id === 'model_identifier')?.status).toBe('pass');
    });

    it('a manual transport is degraded — it performs no provider call', () => {
        const q = qualifyMember(
            healthy({ transport: { available: true, transport: 'manual', reason: null, absentReason: null } }),
        );
        expect(q.verdict).toBe('degraded');
        expect(q.decidedBy).toBe('transport_semantics');
    });

    it('a seat running with host tools available is degraded, not failed', () => {
        const q = qualifyMember(healthy({ toolsIsolated: false }));
        expect(q.verdict).toBe('degraded');
        expect(q.decidedBy).toBe('tool_isolation');
    });

    it('no tool-isolation claim is skipped, and skipped never moves the verdict', () => {
        const q = qualifyMember(healthy({ toolsIsolated: null }));
        expect(q.checks.find((c) => c.id === 'tool_isolation')?.status).toBe('skipped');
        expect(q.verdict).toBe('available');
    });
});

describe('qualifyMember — probe freshness', () => {
    it(`a successful exchange older than ${String(DEFAULT_PROBE_MAX_AGE_DAYS)} days decays to unknown`, () => {
        const q = qualifyMember(healthy({ lastProbe: { at: '2026-06-01', outcome: 'ok' } }));
        expect(q.verdict).toBe('unknown');
        expect(q.decidedBy).toBe('live_probe');
    });

    it('the window is configurable, and a shorter one bites', () => {
        const q = qualifyMember(healthy({ lastProbe: { at: '2026-08-10', outcome: 'ok' }, probeMaxAgeDays: 3 }));
        expect(q.verdict).toBe('unknown');
    });

    it('an unparseable probe date is unknown, never treated as fresh', () => {
        const q = qualifyMember(healthy({ lastProbe: { at: 'letzte Woche', outcome: 'ok' } }));
        expect(q.verdict).toBe('unknown');
    });
});

describe('verdict precedence — the anti-over-claim property', () => {
    // This is the ordering rule the module header calls load-bearing: the
    // verdict is the WEAKEST claim the evidence supports. `degraded` asserts
    // reachability; an unevaluated check means reachability was never
    // established, so `unknown` must win over `degraded`.
    //
    // Mutating VERDICT_SEVERITY to rank degraded above unknown makes exactly
    // this assertion fail and nothing else — verified by reverting it.
    it('unknown outranks degraded when both are present', () => {
        const q = qualifyMember(
            healthy({
                // degraded on the transport rung …
                transport: { available: true, transport: 'manual', reason: null, absentReason: null },
                // … and unknown on the probe rung.
                lastProbe: null,
            }),
        );
        expect(q.verdict).toBe('unknown');
    });

    it('unavailable outranks everything', () => {
        const q = qualifyMember(
            healthy({
                toolsIsolated: false,
                lastProbe: null,
                systemPrompt: { declared: '/nope.md', exists: false },
            }),
        );
        expect(q.verdict).toBe('unavailable');
    });
});

describe('qualifiedAttendance', () => {
    it('gates attendance without shrinking the roster', () => {
        const quals = [
            qualifyMember(healthy({ name: 'anthropic' })),
            qualifyMember(healthy({ name: 'openai', lastProbe: null })),
        ];
        const a = qualifiedAttendance(quals);
        // n stays 2. Shrinking it would LOWER ceil(n/2) and make a short pass
        // easier to conclude — the opposite of the intent.
        expect(a.total).toBe(2);
        expect(a.countable).toBe(1);
        expect(a.blocked.map((b) => b.name)).toEqual(['openai']);
    });

    it('an all-unknown roster reports zero countable rather than full attendance', () => {
        const quals = [
            qualifyMember(healthy({ name: 'anthropic', lastProbe: null })),
            qualifyMember(healthy({ name: 'openai', lastProbe: null })),
        ];
        expect(qualifiedAttendance(quals).countable).toBe(0);
    });

    it('an empty roster is not an error', () => {
        expect(qualifiedAttendance([])).toEqual({ total: 0, countable: 0, blocked: [] });
    });
});

describe('formatQualificationLine', () => {
    it('names the deciding check so a reader does not have to guess', () => {
        const line = formatQualificationLine(qualifyMember(healthy({ lastProbe: null })));
        expect(line).toContain('unknown');
        expect(line).toContain('live_probe');
    });

    it('an available seat needs no because-clause', () => {
        expect(formatQualificationLine(qualifyMember(healthy()))).toBe('anthropic: available');
    });
});
