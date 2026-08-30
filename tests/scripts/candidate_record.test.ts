// Tests for src/scripts/_lib/candidate_record.ts — road-to-governed-harness-evolution
// Phase 3 steps 3.2 (one primary dimension), 3.3 (three-member mutation
// alphabet) and 3.4 (lifecycle states).
//
// Every guard is tested in BOTH polarities. A guard never seen red has unknown
// sensitivity, and a schema whose accepting path was never exercised is a
// schema that might reject everything — which passes the negative tests and
// none of the work.

import { describe, expect, it } from 'vitest';

import {
    ACCEPTED_STATE,
    CANDIDATE_OWNED_PATHS,
    CANDIDATE_RECORD_VERSION,
    CandidateSchemaError,
    LIFECYCLE_SPINE,
    LIFECYCLE_STATES,
    LifecycleTransitionError,
    MUTATION_DIMENSIONS,
    PathOwnershipError,
    assertMutationPathsOwned,
    assertTransition,
    isAccepted,
    isCandidateOwnedPath,
    parseCandidateRecord,
    parseConsolidationRecord,
    readCandidateRecord,
} from '../../src/scripts/_lib/candidate_record.js';

/** A minimal valid candidate — the accepting baseline every negative mutates. */
function validCandidate(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        kind: 'candidate',
        version: CANDIDATE_RECORD_VERSION,
        id: 'c1',
        dimension: 'routing',
        lifecycle: 'proposed',
        mutations: [],
        ...over,
    };
}

function validConsolidation(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        kind: 'consolidation',
        version: CANDIDATE_RECORD_VERSION,
        id: 'k1',
        dimensions: ['routing', 'content'],
        lifecycle: 'proposed',
        sourceCandidates: ['c1', 'c2'],
        ...over,
    };
}

// --- 3.3 — the mutation alphabet is exactly three ---------------------------

describe('3.3 — mutation alphabet', () => {
    it('POSITIVE: the alphabet is exactly activation, routing, content', () => {
        expect([...MUTATION_DIMENSIONS]).toEqual(['activation', 'routing', 'content']);
    });

    it('POSITIVE: each of the three is accepted', () => {
        for (const d of MUTATION_DIMENSIONS) {
            const rec = parseCandidateRecord(validCandidate({ dimension: d }));
            expect(rec.dimension).toBe(d);
        }
    });

    it('NEGATIVE: a fourth dimension is rejected', () => {
        // `verification` is the specific fourth dimension the anthropic seat
        // argued for in the E10 split. The conservative side won, so it must
        // be refused — and that refusal is what makes the split a decision
        // rather than a preference.
        expect(() => parseCandidateRecord(validCandidate({ dimension: 'verification' }))).toThrow(
            CandidateSchemaError,
        );
        for (const fourth of ['precedence', 'composition', 'tool-strategy', 'budget', 'scope', '']) {
            expect(() => parseCandidateRecord(validCandidate({ dimension: fourth }))).toThrow(
                CandidateSchemaError,
            );
        }
    });

    it('NEGATIVE: a non-string dimension is rejected', () => {
        expect(() => parseCandidateRecord(validCandidate({ dimension: 3 }))).toThrow(CandidateSchemaError);
        expect(() => parseCandidateRecord(validCandidate({ dimension: null }))).toThrow(CandidateSchemaError);
    });
});

// --- 3.2 — one primary dimension per candidate ------------------------------

describe('3.2 — one primary dimension per candidate', () => {
    it('POSITIVE: a single-dimension candidate parses', () => {
        const rec = parseCandidateRecord(validCandidate());
        expect(rec.kind).toBe('candidate');
        expect(rec.dimension).toBe('routing');
    });

    it('NEGATIVE: a candidate naming two dimensions is rejected', () => {
        const two = validCandidate();
        delete two['dimension'];
        two['dimensions'] = ['routing', 'content'];
        expect(() => parseCandidateRecord(two)).toThrow(/exactly ONE primary dimension/);
    });

    it('NEGATIVE: `dimension` as an array is rejected EVEN WITH ONE MEMBER', () => {
        // The invariant is about what the field CAN hold, not what this
        // instance happens to hold. An array field admits two tomorrow.
        expect(() => parseCandidateRecord(validCandidate({ dimension: ['routing'] }))).toThrow(
            /must be a single string, not an array/,
        );
        expect(() => parseCandidateRecord(validCandidate({ dimension: ['routing', 'content'] }))).toThrow(
            /must be a single string, not an array/,
        );
    });

    it('NEGATIVE: a `dimensions` key alongside a valid `dimension` is still rejected', () => {
        // The plural key is refused by NAME, so it cannot ride along unnoticed
        // beside a scalar that satisfies the reader.
        expect(() => parseCandidateRecord(validCandidate({ dimensions: ['content'] }))).toThrow(
            /exactly ONE primary dimension/,
        );
    });

    it('POSITIVE: a consolidation IS a distinct record type and parses on its own', () => {
        const rec = parseConsolidationRecord(validConsolidation());
        expect(rec.kind).toBe('consolidation');
        expect(rec.dimensions).toEqual(['routing', 'content']);
        expect(rec.sourceCandidates).toEqual(['c1', 'c2']);
    });

    it('NEGATIVE: the two record types do not cross-parse', () => {
        expect(() => parseCandidateRecord(validConsolidation())).toThrow(CandidateSchemaError);
        expect(() => parseConsolidationRecord(validCandidate())).toThrow(CandidateSchemaError);
    });

    it('NEGATIVE: a consolidation cannot be used to smuggle a one-dimension candidate', () => {
        expect(() =>
            parseConsolidationRecord(validConsolidation({ dimensions: ['routing'] })),
        ).toThrow(/at least two DISTINCT dimensions/);
        // Nor by repeating one dimension to reach length two.
        expect(() =>
            parseConsolidationRecord(validConsolidation({ dimensions: ['routing', 'routing'] })),
        ).toThrow(/at least two DISTINCT dimensions/);
        expect(() =>
            parseConsolidationRecord(validConsolidation({ sourceCandidates: ['c1'] })),
        ).toThrow(/at least two candidate ids/);
    });
});

// --- 3.4 — lifecycle --------------------------------------------------------

describe('3.4 — lifecycle states', () => {
    it('POSITIVE: the enum is the roadmap-specified set, spine in order', () => {
        expect([...LIFECYCLE_SPINE]).toEqual([
            'proposed',
            'diagnostic-evaluated',
            'selection-evaluated',
            'promotion-eligible',
            'sealed-evaluated',
            'promotion-proposed',
            'promoted',
        ]);
        expect([...LIFECYCLE_STATES]).toEqual([...LIFECYCLE_SPINE, 'rejected', 'retired']);
    });

    it('NEGATIVE: existence is not acceptance — no non-promoted state reads as accepted', () => {
        // Step 3.4's exit criterion: no code path reads a candidate as accepted
        // from the mere fact that it exists.
        for (const s of LIFECYCLE_STATES) {
            expect(isAccepted({ lifecycle: s })).toBe(s === ACCEPTED_STATE);
        }
        // A freshly parsed, freshly materialised candidate is NOT accepted.
        expect(isAccepted(parseCandidateRecord(validCandidate()))).toBe(false);
        // Nor is one that has been fully evaluated.
        expect(isAccepted(parseCandidateRecord(validCandidate({ lifecycle: 'sealed-evaluated' })))).toBe(
            false,
        );
        expect(
            isAccepted(parseCandidateRecord(validCandidate({ lifecycle: 'promotion-proposed' }))),
        ).toBe(false);
    });

    it('POSITIVE: only `promoted` reads as accepted', () => {
        expect(isAccepted(parseCandidateRecord(validCandidate({ lifecycle: 'promoted' })))).toBe(true);
    });

    it('NEGATIVE: an absent lifecycle is refused, never defaulted', () => {
        const noState = validCandidate();
        delete noState['lifecycle'];
        expect(() => parseCandidateRecord(noState)).toThrow(/never defaulted/);
        // And the same for the reader — a reader that invented a state would
        // reintroduce the `mutated`-read-as-`accepted` defect.
        expect(() => readCandidateRecord(noState)).toThrow(/never defaulted/);
    });

    it('NEGATIVE: an unrecognised lifecycle value is refused', () => {
        expect(() => parseCandidateRecord(validCandidate({ lifecycle: 'mutated' }))).toThrow(
            CandidateSchemaError,
        );
        expect(() => parseCandidateRecord(validCandidate({ lifecycle: 'accepted' }))).toThrow(
            CandidateSchemaError,
        );
    });
});

describe('3.4 — lifecycle transitions', () => {
    it('POSITIVE: every adjacent spine step is legal', () => {
        for (let i = 0; i + 1 < LIFECYCLE_SPINE.length; i += 1) {
            const from = LIFECYCLE_SPINE[i] as (typeof LIFECYCLE_SPINE)[number];
            const to = LIFECYCLE_SPINE[i + 1] as (typeof LIFECYCLE_SPINE)[number];
            const approval =
                to === 'promoted' ? { approver: 'a-real-person', approvedAt: '2026-08-30' } : undefined;
            expect(() => assertTransition(from, to, approval)).not.toThrow();
        }
    });

    it('NEGATIVE: a transition skipping a stage is refused', () => {
        // The roadmap's verify clause, exercised over EVERY skip of size ≥ 2
        // rather than one example — a guard tested on one pair has unknown
        // sensitivity to the rest.
        for (let i = 0; i < LIFECYCLE_SPINE.length; i += 1) {
            for (let j = i + 2; j < LIFECYCLE_SPINE.length; j += 1) {
                const from = LIFECYCLE_SPINE[i] as (typeof LIFECYCLE_SPINE)[number];
                const to = LIFECYCLE_SPINE[j] as (typeof LIFECYCLE_SPINE)[number];
                expect(() =>
                    assertTransition(from, to, { approver: 'a-real-person', approvedAt: '2026-08-30' }),
                ).toThrow(LifecycleTransitionError);
            }
        }
        // The canonical one, named: proposed cannot jump to promoted.
        expect(() =>
            assertTransition('proposed', 'promoted', { approver: 'x', approvedAt: '2026-08-30' }),
        ).toThrow(/skips/);
    });

    it('NEGATIVE: the lifecycle does not run backwards, and self-transitions are refused', () => {
        expect(() => assertTransition('sealed-evaluated', 'proposed')).toThrow(/does not run backwards/);
        expect(() => assertTransition('proposed', 'proposed')).toThrow(/records no progress/);
    });

    it('POSITIVE: rejection is reachable from every non-terminal state', () => {
        for (const s of LIFECYCLE_SPINE) {
            expect(() => assertTransition(s, 'rejected')).not.toThrow();
        }
    });

    it('NEGATIVE: terminal states have no outgoing transitions', () => {
        expect(() => assertTransition('rejected', 'proposed')).toThrow(/terminal/);
        expect(() => assertTransition('retired', 'promoted')).toThrow(/terminal/);
    });

    it('POSITIVE / NEGATIVE: retire acts on a promoted candidate and nothing else', () => {
        expect(() => assertTransition('promoted', 'retired')).not.toThrow();
        for (const s of LIFECYCLE_SPINE.filter((x) => x !== 'promoted')) {
            expect(() => assertTransition(s, 'retired')).toThrow(/only a promoted candidate/);
        }
    });
});

describe('3.4 — the promotion gate (Phase 0 carried non-promotion condition)', () => {
    it('NEGATIVE: `-> promoted` without an approver is refused', () => {
        expect(() => assertTransition('promotion-proposed', 'promoted')).toThrow(
            /requires a NAMED human approver/,
        );
    });

    it('NEGATIVE: a blank or whitespace-only approver does not satisfy the gate', () => {
        expect(() =>
            assertTransition('promotion-proposed', 'promoted', { approver: '', approvedAt: '2026-08-30' }),
        ).toThrow(/requires a NAMED human approver/);
        expect(() =>
            assertTransition('promotion-proposed', 'promoted', {
                approver: '   ',
                approvedAt: '2026-08-30',
            }),
        ).toThrow(/requires a NAMED human approver/);
    });

    it('POSITIVE: a named approver passes the gate', () => {
        expect(() =>
            assertTransition('promotion-proposed', 'promoted', {
                approver: 'a-real-person',
                approvedAt: '2026-08-30',
            }),
        ).not.toThrow();
    });

    it('NEGATIVE: an approver does NOT buy a stage skip', () => {
        // The two guards are independent. A human name authorises promotion; it
        // does not authorise promoting something that was never evaluated.
        expect(() =>
            assertTransition('promotion-eligible', 'promoted', {
                approver: 'a-real-person',
                approvedAt: '2026-08-30',
            }),
        ).toThrow(/skips/);
    });
});

// --- Path ownership ---------------------------------------------------------

describe('candidate path ownership', () => {
    it('POSITIVE: the four surface paths are owned', () => {
        expect(isCandidateOwnedPath('AGENTS.md')).toBe(true);
        expect(isCandidateOwnedPath('CLAUDE.md')).toBe(true);
        expect(isCandidateOwnedPath('.claude/skills/x/SKILL.md')).toBe(true);
        expect(isCandidateOwnedPath('.augment/rules/foo.md')).toBe(true);
        expect([...CANDIDATE_OWNED_PATHS]).toEqual(['.claude', '.augment', 'AGENTS.md', 'CLAUDE.md']);
    });

    it('NEGATIVE: a task-target path is not owned', () => {
        expect(isCandidateOwnedPath('src/parser.ts')).toBe(false);
        expect(isCandidateOwnedPath('package.json')).toBe(false);
        expect(isCandidateOwnedPath('sub/AGENTS.md')).toBe(false);
        expect(isCandidateOwnedPath('')).toBe(false);
    });

    it('NEGATIVE: traversal out of an owned head is not owned', () => {
        // The case a head-component check alone would MISS: an owned first
        // segment whose target is elsewhere.
        expect(isCandidateOwnedPath('.claude/../src/parser.ts')).toBe(false);
        expect(isCandidateOwnedPath('.augment/rules/../../package.json')).toBe(false);
        expect(isCandidateOwnedPath('../outside.md')).toBe(false);
    });

    it('NEGATIVE: an absolute path is not owned', () => {
        expect(isCandidateOwnedPath('/etc/passwd')).toBe(false);
        expect(isCandidateOwnedPath('C:\\Windows\\x')).toBe(false);
    });

    it('NEGATIVE: an owned FILE is not an owned directory', () => {
        expect(isCandidateOwnedPath('AGENTS.md/nested')).toBe(false);
    });

    it('POSITIVE / NEGATIVE: assertMutationPathsOwned mirrors the predicate', () => {
        expect(() =>
            assertMutationPathsOwned([{ path: '.claude/rules/a.md', content: 'x' }]),
        ).not.toThrow();
        expect(() => assertMutationPathsOwned([{ path: 'src/a.ts', content: 'x' }])).toThrow(
            PathOwnershipError,
        );
        // The whole set is checked, not just the first member.
        expect(() =>
            assertMutationPathsOwned([
                { path: '.claude/rules/a.md', content: 'x' },
                { path: 'src/a.ts', content: 'x' },
            ]),
        ).toThrow(PathOwnershipError);
    });

    it('NEGATIVE: parseCandidateRecord refuses an unowned mutation path', () => {
        expect(() =>
            parseCandidateRecord(
                validCandidate({ mutations: [{ path: 'src/parser.ts', content: 'x' }] }),
            ),
        ).toThrow(PathOwnershipError);
    });

    it('POSITIVE: parseCandidateRecord accepts an owned mutation path', () => {
        const rec = parseCandidateRecord(
            validCandidate({ mutations: [{ path: '.claude/rules/a.md', content: 'x' }] }),
        );
        expect(rec.mutations).toEqual([{ path: '.claude/rules/a.md', content: 'x' }]);
    });
});

// --- Forward compatibility (the E10 split's recorded constraint) ------------

describe('forward compatibility — the losing seat`s irreversibility concern', () => {
    it('POSITIVE: every record carries a version', () => {
        expect(parseCandidateRecord(validCandidate()).version).toBe(CANDIDATE_RECORD_VERSION);
        expect(parseConsolidationRecord(validConsolidation()).version).toBe(CANDIDATE_RECORD_VERSION);
    });

    it('NEGATIVE: a record from a FUTURE schema version is refused by the validator', () => {
        expect(() =>
            parseCandidateRecord(validCandidate({ version: CANDIDATE_RECORD_VERSION + 1 })),
        ).toThrow(/newer than this build understands/);
    });

    it('POSITIVE: the READER survives an unknown dimension, flagged rather than thrown', () => {
        // This is the whole mechanism: adding a fourth dimension later must be
        // additive, so a record authored under a wider alphabet stays READABLE
        // on a narrower build. If this ever throws, historical candidates
        // become permanently unclassifiable — the exact irreversibility the
        // anthropic seat named in the E10 split.
        const future = validCandidate({ dimension: 'verification' });
        const read = readCandidateRecord(future);
        expect(read.dimension).toBe('verification');
        expect(read.unknownDimension).toBe(true);
        expect(read.lifecycle).toBe('proposed');
    });

    it('NEGATIVE: the VALIDATOR still refuses that same record', () => {
        // Readable is not runnable. An unknown dimension cannot enter a run.
        const future = validCandidate({ dimension: 'verification' });
        expect(() => parseCandidateRecord(future)).toThrow(CandidateSchemaError);
    });

    it('POSITIVE: a known dimension reads as known', () => {
        expect(readCandidateRecord(validCandidate()).unknownDimension).toBe(false);
    });

    it('NEGATIVE: the reader still enforces the structural fields', () => {
        const noId = validCandidate();
        delete noId['id'];
        expect(() => readCandidateRecord(noId)).toThrow(CandidateSchemaError);
        expect(() => readCandidateRecord(validConsolidation())).toThrow(CandidateSchemaError);
        expect(() => readCandidateRecord('not an object')).toThrow(CandidateSchemaError);
    });
});
