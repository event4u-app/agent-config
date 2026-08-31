/**
 * Phase 6.1 — the six components, and the call-count invariance that IS the step.
 *
 * The step's verify is one sentence: *"no extra model call is issued; call count
 * is unchanged"*. So the load-bearing block here is not a numeric assertion, it is
 * the invariance block, and it is asserted MECHANICALLY on two independent
 * observables — a counting transport stub (the way `inline_findings.test.ts:48-69`
 * counts, because there too the call count was the measurement) and the real
 * `record_cli_call` counter file under a temp path. Each of those has its own
 * sabotage arm that makes it go red, because an invariance assertion over code
 * that never calls anything passes vacuously and would prove nothing.
 *
 * Every expected value is DERIVED from the fixture — from the stance lines that
 * were written, from the tier table, from the scores that carry `agree: false` —
 * never copied from what the implementation happened to emit.
 *
 * No real provider is ever reached: every member is `billable: false` /
 * `transport: 'manual'` with a scripted `ask()`, and the counter path is a temp
 * directory, so the operator's shared quota is untouched.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    CLI_CONSUMER_COUNCIL,
    CouncilResponse,
    ExternalAIClient,
    load_cli_call_counts,
    record_cli_call,
} from '../../../src/scripts/ai_council/clients.js';
import { Finding, FindingScore, aggregate_scores } from '../../../src/scripts/ai_council/consensus.js';
import {
    FINDING_MATCH_THRESHOLD,
    type DisagreementInputs,
    type MemberRound,
    computeDisagreementSignal,
} from '../../../src/scripts/ai_council/disagreement_signal.js';
import { CONFIDENCE_FACTOR, tally_stances } from '../../../src/scripts/ai_council/stance_tally.js';

// ── fixture builders ────────────────────────────────────────────────────────

const stanceLine = (opt: string, conf: string): string =>
    `Reasoning about it.\n\nSTANCE: ${opt} | CONFIDENCE: ${conf} | DEALBREAKER: no`;

const EMPTY: DisagreementInputs = { stance: null, findings: [], consensus: new Map(), memberRounds: [] };

const withInputs = (over: Partial<DisagreementInputs>): DisagreementInputs => ({ ...EMPTY, ...over });

/** Two backers on `option-a` (high, med) and one on `option-b` (low). */
const SPLIT_TALLY = tally_stances([
    { member: 'a:1', text: stanceLine('option-a', 'high') },
    { member: 'b:1', text: stanceLine('option-a', 'med') },
    { member: 'c:1', text: stanceLine('option-b', 'low') },
]);

/** Three members, three different options, all equally confident. */
const TOTAL_DISAGREEMENT_TALLY = tally_stances([
    { member: 'a:1', text: stanceLine('option-a', 'high') },
    { member: 'b:1', text: stanceLine('option-b', 'high') },
    { member: 'c:1', text: stanceLine('option-c', 'high') },
]);

/** Everyone on one option at one confidence tier. */
const UNANIMOUS_TALLY = tally_stances([
    { member: 'a:1', text: stanceLine('option-a', 'high') },
    { member: 'b:1', text: stanceLine('option-a', 'high') },
]);

const SHARED = 'the audit conflates two layers of the cache';
/**
 * Two sources, two findings each. Exactly ONE finding per side is a verbatim
 * twin of one on the other side; the other two share only the stop-word `is`,
 * whose token Jaccard is far below the match bar.
 */
const PAIRED_FINDINGS = [
    new Finding('a-shared', 'a:1', SHARED),
    new Finding('a-own', 'a:1', 'no rollback path is stated'),
    new Finding('b-shared', 'b:1', SHARED),
    new Finding('b-own', 'b:1', 'latency budget is unstated'),
];

const SCORED_FINDINGS = [
    new Finding('f1', 'a:1', 'first claim'),
    new Finding('f2', 'a:1', 'second claim'),
    new Finding('f3', 'a:1', 'third claim'),
];

/**
 * `f1` and `f2` both land on strength 0.8 (mean 8 × agree-rate 1.0) — a TIE the
 * record cannot resolve. `f3` lands on 0.4. The last row is a SELF-score by the
 * findings' own author and must be dropped by `aggregate_scores`.
 */
const SCORES = [
    new FindingScore('f1', 'b:1', 8, true, ''),
    new FindingScore('f1', 'c:1', 8, true, ''),
    new FindingScore('f2', 'b:1', 8, true, ''),
    new FindingScore('f2', 'c:1', 8, true, ''),
    new FindingScore('f3', 'b:1', 4, false, 'unconvinced'),
    new FindingScore('f3', 'c:1', 4, false, 'also unconvinced'),
    new FindingScore('f1', 'a:1', 1, false, 'self-score — must be ignored'),
];

const SCORED = aggregate_scores(SCORED_FINDINGS, SCORES);

const ROUNDS: MemberRound[] = [
    // Verbatim repeat → Jaccard 1.0.
    { member: 'a:1', prior: 'alpha beta gamma', current: 'alpha beta gamma' },
    // Disjoint token sets → Jaccard 0.0.
    { member: 'b:1', prior: 'alpha beta gamma', current: 'delta epsilon zeta' },
];

/** Narrowing helper — an unavailable component has no `value` to read. */
function value(c: { available: boolean } & Record<string, unknown>): number {
    expect(c.available, `component was unavailable: ${JSON.stringify(c)}`).toBe(true);
    return c['value'] as number;
}

// ── the six components ──────────────────────────────────────────────────────

describe('stance divergence — spread among BACKED options only', () => {
    it('is derived from the tier weights of the stance lines that were written', () => {
        const a = CONFIDENCE_FACTOR.high + CONFIDENCE_FACTOR.med; // option-a's two backers
        const b = CONFIDENCE_FACTOR.low; // option-b's one backer
        const c = computeDisagreementSignal(withInputs({ stance: SPLIT_TALLY })).stanceDivergence;
        expect(value(c)).toBeCloseTo(1 - a / (a + b), 12);
        expect(c.available && c.basis, 'basis is the backer count').toBe(3);
    });

    it('total disagreement: three options, one backer each', () => {
        // Every option holds 1/3 of the backed weight, so the leader holds 1/3.
        const c = computeDisagreementSignal(withInputs({ stance: TOTAL_DISAGREEMENT_TALLY })).stanceDivergence;
        expect(value(c)).toBeCloseTo(1 - 1 / 3, 12);
    });

    it('identical answers: one option carries all the weight', () => {
        expect(value(computeDisagreementSignal(withInputs({ stance: UNANIMOUS_TALLY })).stanceDivergence)).toBe(0);
    });

    it('a single member is a real measurement, and its basis says so', () => {
        const one = tally_stances([{ member: 'a:1', text: stanceLine('option-a', 'high') }]);
        const c = computeDisagreementSignal(withInputs({ stance: one })).stanceDivergence;
        expect(value(c)).toBe(0);
        expect(c.available && c.basis).toBe(1);
    });

    it('abstention is not divergence — it is excluded from the denominator', () => {
        // The tally counts an abstainer in `w_total` (the refusal-preservation
        // invariant). Dividing by `w_total` would report divergence on a council
        // that did not disagree, so this pins the denominator choice.
        const t = tally_stances([
            { member: 'a:1', text: stanceLine('option-a', 'high') },
            { member: 'b:1', text: stanceLine('option-a', 'high') },
            { member: 'c:1', text: stanceLine('abstain', 'high') },
        ]);
        expect(t.w_total, 'the abstainer does count toward the quorum').toBe(3);
        expect(value(computeDisagreementSignal(withInputs({ stance: t })).stanceDivergence)).toBe(0);
    });

    it('tallying off, and a tally nobody backed, are DIFFERENT gaps', () => {
        expect(computeDisagreementSignal(EMPTY).stanceDivergence).toEqual({
            available: false,
            reason: 'no-stance-tally',
        });
        const allAbstain = tally_stances([
            { member: 'a:1', text: stanceLine('abstain', 'high') },
            { member: 'b:1', text: stanceLine('abstain', 'high') },
        ]);
        expect(computeDisagreementSignal(withInputs({ stance: allAbstain })).stanceDivergence).toEqual({
            available: false,
            reason: 'no-parsed-stances',
        });
    });
});

describe('confidence spread — normalised range of the declared tiers', () => {
    it('high..low spans the whole table, so the normalised range is 1', () => {
        const c = computeDisagreementSignal(withInputs({ stance: SPLIT_TALLY })).confidenceSpread;
        const span = CONFIDENCE_FACTOR.high - CONFIDENCE_FACTOR.low;
        expect(value(c)).toBeCloseTo((CONFIDENCE_FACTOR.high - CONFIDENCE_FACTOR.low) / span, 12);
        expect(c.available && c.basis).toBe(3);
    });

    it('is independent of divergence: total disagreement at one tier has zero spread', () => {
        const s = computeDisagreementSignal(withInputs({ stance: TOTAL_DISAGREEMENT_TALLY }));
        expect(value(s.stanceDivergence)).toBeGreaterThan(0);
        expect(value(s.confidenceSpread)).toBe(0);
    });

    it('one observation is not a spread — it is a gap', () => {
        const one = tally_stances([{ member: 'a:1', text: stanceLine('option-a', 'high') }]);
        expect(computeDisagreementSignal(withInputs({ stance: one })).confidenceSpread).toEqual({
            available: false,
            reason: 'too-few-confidence-observations',
        });
    });
});

describe('finding overlap — symmetric share of shared findings', () => {
    it('one twin of two per side, both directions', () => {
        const c = computeDisagreementSignal(withInputs({ findings: PAIRED_FINDINGS })).findingOverlap;
        expect(value(c)).toBeCloseTo((1 / 2 + 1 / 2) / 2, 12);
        expect(c.available && c.basis, 'one source pair').toBe(1);
    });

    it('identical finding sets overlap completely', () => {
        const c = computeDisagreementSignal(
            withInputs({
                findings: [new Finding('x', 'a:1', SHARED), new Finding('y', 'b:1', SHARED)],
            }),
        ).findingOverlap;
        expect(value(c)).toBe(1);
    });

    it('total disagreement: no finding has a twin anywhere', () => {
        const c = computeDisagreementSignal(
            withInputs({
                findings: [
                    new Finding('x', 'a:1', 'the migration is irreversible'),
                    new Finding('y', 'b:1', 'documentation lags behind'),
                ],
            }),
        ).findingOverlap;
        expect(value(c)).toBe(0);
    });

    it('zero findings, and a single source, are the same gap — no pair exists', () => {
        for (const findings of [[], [new Finding('x', 'a:1', SHARED), new Finding('y', 'a:1', 'other')]]) {
            expect(computeDisagreementSignal(withInputs({ findings })).findingOverlap).toEqual({
                available: false,
                reason: 'too-few-sourced-findings',
            });
        }
    });

    it('the match bar is the shared pre-registered one, not a local literal', () => {
        expect(FINDING_MATCH_THRESHOLD).toBe(0.8);
    });
});

describe('contradiction count — scored disagreements, self-scores excluded', () => {
    it('equals the number of `agree: false` votes cast by someone other than the author', () => {
        const expected = SCORES.filter(
            (s) => !s.agree && s.scorer !== (SCORED_FINDINGS.find((f) => f.id === s.finding_id)?.source ?? ''),
        ).length;
        expect(expected, 'the fixture carries the self-dissent that must NOT count').toBe(2);
        const c = computeDisagreementSignal(withInputs({ consensus: SCORED })).contradictionCount;
        expect(value(c)).toBe(expected);
        expect(c.available && c.basis, 'three findings were scored').toBe(3);
    });

    it('unanimous agreement scores zero contradictions — a measured zero', () => {
        const m = aggregate_scores([new Finding('f', 'a:1', 'claim')], [new FindingScore('f', 'b:1', 9, true, '')]);
        expect(value(computeDisagreementSignal(withInputs({ consensus: m })).contradictionCount)).toBe(0);
    });

    it('an UNSCORED finding is a gap, never a zero', () => {
        // `aggregate_scores` writes an entry for every finding, scored or not. A
        // caller summing the map wholesale would report a confident 0 here.
        const unscored = aggregate_scores(SCORED_FINDINGS, []);
        expect(unscored.size, 'entries exist').toBe(3);
        expect(computeDisagreementSignal(withInputs({ consensus: unscored })).contradictionCount).toEqual({
            available: false,
            reason: 'no-scored-findings',
        });
    });
});

describe('rank uncertainty — the share of the ranking the record cannot resolve', () => {
    it('one tied pair out of two adjacent pairs', () => {
        // f1 and f2 both aggregate to the same strength; f3 is separated.
        expect(SCORED.get('f1')?.consensus_strength).toBe(SCORED.get('f2')?.consensus_strength);
        expect(SCORED.get('f3')?.consensus_strength).not.toBe(SCORED.get('f1')?.consensus_strength);
        const c = computeDisagreementSignal(withInputs({ consensus: SCORED })).rankUncertainty;
        expect(value(c)).toBeCloseTo(1 / 2, 12);
        expect(c.available && c.basis).toBe(3);
    });

    it('a fully separated ranking is certain', () => {
        const m = aggregate_scores(
            [new Finding('f1', 'a:1', 'one'), new Finding('f2', 'a:1', 'two')],
            [new FindingScore('f1', 'b:1', 9, true, ''), new FindingScore('f2', 'b:1', 3, true, '')],
        );
        expect(value(computeDisagreementSignal(withInputs({ consensus: m })).rankUncertainty)).toBe(0);
    });

    it('an all-tied ranking is wholly arbitrary', () => {
        const m = aggregate_scores(
            [new Finding('f1', 'a:1', 'one'), new Finding('f2', 'a:1', 'two'), new Finding('f3', 'a:1', 'three')],
            [
                new FindingScore('f1', 'b:1', 7, true, ''),
                new FindingScore('f2', 'b:1', 7, true, ''),
                new FindingScore('f3', 'b:1', 7, true, ''),
            ],
        );
        expect(value(computeDisagreementSignal(withInputs({ consensus: m })).rankUncertainty)).toBe(1);
    });

    it('one scored finding is not a ranking', () => {
        const m = aggregate_scores([new Finding('f', 'a:1', 'claim')], [new FindingScore('f', 'b:1', 9, true, '')]);
        expect(computeDisagreementSignal(withInputs({ consensus: m })).rankUncertainty).toEqual({
            available: false,
            reason: 'too-few-ranked-findings',
        });
    });
});

describe('self-similarity — each member against its own prior round', () => {
    it('a verbatim repeat and a disjoint rewrite average to the midpoint', () => {
        const c = computeDisagreementSignal(withInputs({ memberRounds: ROUNDS })).selfSimilarity;
        expect(value(c)).toBeCloseTo((1 + 0) / 2, 12);
        expect(c.available && c.basis).toBe(2);
    });

    it('round 1 has no prior round, and that is a gap rather than a 0', () => {
        const first: MemberRound[] = [{ member: 'a:1', prior: null, current: 'an opening statement' }];
        expect(computeDisagreementSignal(withInputs({ memberRounds: first })).selfSimilarity).toEqual({
            available: false,
            reason: 'no-prior-round',
        });
    });

    it('an empty text contributes nothing — two empties are not maximal repetition', () => {
        // `jaccardSimilarity('', '')` is 1.0 by definition, so an errored member
        // would otherwise enter the mean as a perfect self-repeat.
        const withEmpty: MemberRound[] = [...ROUNDS, { member: 'c:1', prior: '', current: '' }];
        const c = computeDisagreementSignal(withInputs({ memberRounds: withEmpty })).selfSimilarity;
        expect(c.available && c.basis, 'the empty member is not counted').toBe(2);
        expect(value(c)).toBeCloseTo((1 + 0) / 2, 12);
    });
});

// ── the gap contract, and the absence of a composite ────────────────────────

describe('an unavailable component carries no number at all', () => {
    it('an empty run reports six gaps and zero available components', () => {
        const s = computeDisagreementSignal(EMPTY);
        expect(s.availableCount).toBe(0);
        for (const [name, c] of Object.entries(s)) {
            if (name === 'availableCount') continue;
            expect(c, `${name} leaked a value`).not.toHaveProperty('value');
            expect(c).toHaveProperty('reason');
        }
    });

    it('a fully-populated run reports all six', () => {
        const s = computeDisagreementSignal({
            stance: SPLIT_TALLY,
            findings: PAIRED_FINDINGS,
            consensus: SCORED,
            memberRounds: ROUNDS,
        });
        expect(s.availableCount).toBe(6);
    });

    it('no composite is emitted — the six axes do not point the same way', () => {
        // `findingOverlap` and `selfSimilarity` rise with AGREEMENT; the other
        // four rise with DISAGREEMENT. A summed scalar would add opposing axes.
        const s = computeDisagreementSignal(EMPTY);
        expect(Object.keys(s).sort()).toEqual(
            [
                'availableCount',
                'confidenceSpread',
                'contradictionCount',
                'findingOverlap',
                'rankUncertainty',
                'selfSimilarity',
                'stanceDivergence',
            ].sort(),
        );
    });
});

// ── the step's verify: call count is unchanged ───────────────────────────────

/** Books a real counter entry the way a paid member does, and counts its asks. */
class Booking extends ExternalAIClient {
    calls = 0;
    constructor(
        name: string,
        model: string,
        private readonly counterPath: string,
    ) {
        super();
        this.name = name;
        this.model = model;
        this.billable = false;
        this.transport = 'manual';
    }
    override ask(_system: string, _user: string): CouncilResponse {
        this.calls += 1;
        record_cli_call(this.name, this.counterPath, CLI_CONSUMER_COUNCIL);
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text: stanceLine(`option-${this.name}`, 'high'),
            latency_ms: 1,
        });
    }
}

function tmpCounter(): string {
    return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ac-disagreement-')), 'cli-calls.json');
}

/** The already-paid phase: every member answers exactly once. */
function paidRound(counterPath: string): { members: Booking[]; inputs: DisagreementInputs } {
    const members = [new Booking('a', '1', counterPath), new Booking('b', '1', counterPath)];
    const texts = members.map((m) => ({ member: `${m.name}:${m.model}`, text: m.ask('sys', 'user') }));
    return {
        members,
        inputs: {
            stance: tally_stances(texts.map((t) => ({ member: t.member, text: t.text.text }))),
            findings: PAIRED_FINDINGS,
            consensus: SCORED,
            memberRounds: texts.map((t) => ({ member: t.member, prior: 'a prior round', current: t.text.text })),
        },
    };
}

describe("6.1 verify — computing the signal issues no call, on two observables", () => {
    it('neither the ask counter nor the real quota counter moves', () => {
        const counterPath = tmpCounter();
        const { members, inputs } = paidRound(counterPath);

        const asksAfterPaidRound = members.map((m) => m.calls);
        const countsAfterPaidRound = load_cli_call_counts(counterPath);
        expect(asksAfterPaidRound, 'the paid round happened, so the baseline is not vacuous').toEqual([1, 1]);
        expect(countsAfterPaidRound).toEqual({ a: 1, b: 1 });

        // Compute repeatedly — a per-round signal is evaluated more than once.
        for (let i = 0; i < 5; i += 1) {
            expect(computeDisagreementSignal(inputs).availableCount).toBe(6);
        }

        expect(members.map((m) => m.calls), 'an extra ask was issued').toEqual(asksAfterPaidRound);
        expect(load_cli_call_counts(counterPath), 'the quota counter moved').toEqual(countsAfterPaidRound);
    });

    it('SABOTAGE — a tie-break call moves BOTH observables, so the assertions are sensitive', () => {
        // The plausible wrong implementation: rank uncertainty is high, so ask a
        // member to break the tie. If the two assertions above could not see
        // this, they would be passing vacuously over code that never calls.
        const counterPath = tmpCounter();
        const { members, inputs } = paidRound(counterPath);
        const asksBefore = members.map((m) => m.calls);
        const countsBefore = load_cli_call_counts(counterPath);

        const withTieBreak = (x: DisagreementInputs): number => {
            const s = computeDisagreementSignal(x);
            if (s.rankUncertainty.available && s.rankUncertainty.value > 0) {
                (members[0] as Booking).ask('sys', 'break the tie');
            }
            return s.availableCount;
        };
        expect(withTieBreak(inputs)).toBe(6);

        expect(members.map((m) => m.calls)).not.toEqual(asksBefore);
        expect(load_cli_call_counts(counterPath)).not.toEqual(countsBefore);
        expect(load_cli_call_counts(counterPath)).toEqual({ a: 2, b: 1 });
    });
});

describe('the import surface is what actually guarantees zero calls', () => {
    const MODULE = path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        'src',
        'scripts',
        'ai_council',
        'disagreement_signal.ts',
    );
    /** Anything that could reach a provider, the filesystem, or a subprocess. */
    const FORBIDDEN = [
        /from\s+'[^']*\bclients(\.js)?'/,
        /from\s+'[^']*\borchestrator(\.js)?'/,
        /from\s+'node:(fs|http|https|net|child_process|os|dns)'/,
        /\bfetch\s*\(/,
        /\b(spawnSync|execSync|spawn|exec)\s*\(/,
    ];
    const violations = (file: string): string[] => {
        const src = fs.readFileSync(file, { encoding: 'utf-8' });
        return FORBIDDEN.filter((re) => re.test(src)).map((re) => re.source);
    };

    it('the module imports nothing that can issue a call or touch the disk', () => {
        expect(violations(MODULE)).toEqual([]);
    });

    it('CONTROL — the same scanner flags a module that does import one', () => {
        // Without this arm the assertion above could be passing because the
        // patterns match nothing anywhere. `recouncil_guard.ts` legitimately
        // reads the disk, so it is the honest non-vacuity control.
        const guard = path.resolve(path.dirname(MODULE), 'recouncil_guard.ts');
        expect(violations(guard).length).toBeGreaterThan(0);
    });
});
