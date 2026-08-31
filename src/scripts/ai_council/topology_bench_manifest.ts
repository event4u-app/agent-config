/**
 * Council-topology benchmark — the frozen call manifest and its expander.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` Phase 2. Carrier
 * contract: `internal/bench/council-topology/README.md`.
 *
 * ── Why this module exists ──────────────────────────────────────────────────
 * The AI council of 2026-08-31 answered Q2 as **(iii): Phase 2 is not
 * executable as written** — not because the design is wrong, but because the
 * roadmap defines experimental DIMENSIONS and never the PROVIDER-CALL GRAPH.
 * Both seats converged on the same diagnosis: an experimental cell is not a
 * provider call. Host-solo may spend nothing; a full debate is multi-call;
 * ablation outputs may or may not be reusable; retries add calls; and the
 * ceiling is `50 calls per provider per UTC day`, never a fungible pool of 100.
 * Neither `1,200 cells` nor `120 observations` is a call total.
 *
 * This module is the missing artefact. It is a pure expander: a frozen arm
 * spec in, a fully enumerated cell list plus a per-provider day partition out.
 * It makes **zero** provider calls and imports no transport.
 *
 * ── What this module is NOT ─────────────────────────────────────────────────
 * It is not the runner. Both council seats said explicitly: do not greenlight
 * the runner yet. Nothing here executes an arm, and the completion status of
 * every cell it emits is `pending`, which is deliberately NOT a member of the
 * complete set.
 *
 * ── The completion invariant, encoded rather than asserted ──────────────────
 * "Not run" is not a null. A null is what a measurement returns. That
 * distinction is the whole reason Phase 2 cannot be closed by declaring the
 * unexecuted arms empty, so it is enforced at the type layer
 * (`PendingIsNotComplete`) and at module load (`auditCompletionStatuses`),
 * following the two-layer, sabotage-proven pattern step 7.1 established for the
 * topology vocabulary in `topology_vocabulary.ts:119-175`.
 *
 * ── Where the call counts come from ─────────────────────────────────────────
 * Every pass below is one `consult()` per participating member, which is one
 * provider call per member:
 *
 *   - generation           `orchestrator.ts:394`   `consult(members, ...)`
 *   - peer critique        `orchestrator.ts:1553`  `consult([reviewer], ...)`
 *   - findings extraction  `consensus_round.ts:107`
 *   - bounded re-ask       `consensus_round.ts:141` — at most ONE per member
 *                          per extraction pass; this is the retry reserve
 *   - consensus scoring    `consensus_round.ts:191`
 *   - prose synthesis      chairman only; the templated default path spends
 *                          nothing (`prompts.ts:512-518`), so the synthesis
 *                          STAGE is only observable with the prose path on
 *
 * Multi-round debate multiplies the generation pass by `rounds`
 * (`orchestrator.ts:160-161`, `:246`: "across every billable member × rounds").
 *
 * The per-provider daily ceiling is `DEFAULT_CLI_CALLS_PER_DAY = 50`
 * (`cli_call_budget.ts:60`), applied per provider, never aggregated.
 */

/** Per-provider daily call ceiling. Mirrors `cli_call_budget.ts:60`. */
export const CALLS_PER_PROVIDER_PER_UTC_DAY = 50;

/** The two providers the shipped council configuration seats. */
export const BENCH_PROVIDERS = ['anthropic', 'openai'] as const;
export type BenchProvider = (typeof BENCH_PROVIDERS)[number];

/** Calls booked against each provider. */
export type ProviderCalls = Readonly<Record<BenchProvider, number>>;

/**
 * Eligibility label, fixed by the resolved `blocker: maintainer-blind-ratings`
 * (option (b) — scope to gradeable-only slices, publish the rubric arms as
 * deferred). The three labels are NEVER pooled: that pooling is precisely what
 * the blocker's resolution forbids.
 */
export const FAMILY_LABELS = [
    'gradeable-confirmatory',
    'human-rubric-deferred',
    'model-graded-exploratory',
] as const;
export type FamilyLabel = (typeof FAMILY_LABELS)[number];

/** Completion status of one cell. */
export const CELL_STATUSES = [
    'pending',
    'success',
    'declared_gap',
    'observed_null',
    'not_eligible',
] as const;
export type CellStatus = (typeof CELL_STATUSES)[number];

/**
 * The ONLY statuses that let an eligible cell count towards Phase-2 completion.
 *
 * `pending` is absent by construction. An unexecuted arm is not a null and
 * cannot be represented as one — see `PendingIsNotComplete` below.
 */
export const PHASE2_COMPLETE_STATUSES = ['success', 'declared_gap', 'observed_null'] as const;
export type CompleteStatus = (typeof PHASE2_COMPLETE_STATUSES)[number];

/** Type-layer half of the completion invariant: `pending` is not completable. */
type Assert<T extends true> = T;
type PendingIsNotComplete = Assert<'pending' extends CompleteStatus ? false : true>;
type NotEligibleIsNotComplete = Assert<'not_eligible' extends CompleteStatus ? false : true>;
export type _CompletionInvariants = [PendingIsNotComplete, NotEligibleIsNotComplete];

/** One pre-registered benchmark family. */
export interface BenchFamily {
    readonly id: string;
    /** The family as roadmap step 2.1 names it, verbatim. */
    readonly roadmapPhrase: string;
    readonly label: FamilyLabel;
    /** The pre-registered success criterion. Committed before any arm runs. */
    readonly criterion: string;
}

/**
 * All twelve families of step 2.1, in the order the roadmap lists them. The
 * step enumerates exactly twelve, so none of these is derived — every
 * `roadmapPhrase` is a quotation.
 */
export const BENCH_FAMILIES = [
    {
        id: 'architecture-trade-offs',
        roadmapPhrase: 'architecture trade-offs',
        label: 'model-graded-exploratory',
        criterion:
            'A named trade-off axis, both sides costed, and a disposition. Graded by rubric against a fixed key; no deterministic oracle exists, so the arm is exploratory and never pooled with a confirmatory result.',
    },
    {
        id: 'roadmap-critique',
        roadmapPhrase: 'roadmap critique',
        label: 'model-graded-exploratory',
        criterion:
            'Seeded defects in a synthetic roadmap (a missing verify line, an unfalsifiable criterion, a step that closes nothing) are named. Recall against the seeded set is countable; severity ranking is rubric-judged, hence exploratory.',
    },
    {
        id: 'adr-reopening',
        roadmapPhrase: 'ADR reopening',
        label: 'model-graded-exploratory',
        criterion:
            'The record is opened before it is cited, the mechanism-match question is answered, and the routing verdict (council vs owner-reserved) is stated. Graded against a fixed key per item.',
    },
    {
        id: 'requirements-completeness',
        roadmapPhrase: 'requirements completeness',
        label: 'model-graded-exploratory',
        criterion:
            'Seeded omissions in a synthetic requirement set are recovered. Recall against the seeded set is countable; the false-addition rate is rubric-judged, hence exploratory.',
    },
    {
        id: 'code-review-seeded-defects',
        roadmapPhrase: 'code review with seeded defects',
        label: 'gradeable-confirmatory',
        criterion:
            'Each item carries n seeded defects at known file:line. Primary metric is recall over the seeded set; secondary is the false-positive count against a frozen key. Deterministic — string match on the seeded identifier.',
    },
    {
        id: 'security-review-seeded-findings',
        roadmapPhrase: 'security review with seeded true/false findings',
        label: 'gradeable-confirmatory',
        criterion:
            'Each item carries both true and decoy findings at known locations. Primary metric is the true-positive rate paired with the decoy-acceptance rate; a run that finds everything by accusing everything scores zero. Deterministic against a frozen key.',
    },
    {
        id: 'debugging-executable-oracle',
        roadmapPhrase: 'debugging with an executable oracle',
        label: 'gradeable-confirmatory',
        criterion:
            'A failing test is supplied with the defect. The arm passes iff the proposed patch turns the test green and breaks no other test in the fixture. The oracle is the test runner, not a judge.',
    },
    {
        id: 'incident-diagnosis',
        roadmapPhrase: 'incident diagnosis',
        label: 'model-graded-exploratory',
        criterion:
            'From a synthetic log-and-timeline bundle with one planted root cause, the arm names that cause and the first diagnostic step. Cause identity is checkable against the key; the diagnostic step is rubric-judged, hence exploratory.',
    },
    {
        id: 'probe-resolvable-factual-controls',
        roadmapPhrase: 'probe-resolvable factual controls',
        label: 'gradeable-confirmatory',
        criterion:
            'Questions a single cheap probe answers exactly. The control succeeds when the answer matches the probe output. Its PURPOSE is to detect topologies that spend a debate on a lookup — a correct answer at high cost is a finding, not a pass.',
    },
    {
        id: 'direct-generation-controls',
        roadmapPhrase: 'direct-generation controls where debate is expected to hurt',
        label: 'gradeable-confirmatory',
        criterion:
            'Tasks with one correct short answer where deliberation is predicted to degrade it. Pre-registered DIRECTIONAL prediction: the debate arm scores at or below the single-model arm. A debate arm that wins here falsifies the prediction and is published as such.',
    },
    {
        id: 'adversarial-misconception',
        roadmapPhrase: 'adversarial misconception cases',
        label: 'gradeable-confirmatory',
        criterion:
            'Items whose plausible answer is wrong and whose correct answer is documented. Primary metric is the rate at which the arm resists the misconception; majority corruption is measured on the same items.',
    },
    {
        id: 'ambiguous-product-decisions-human-rubric',
        roadmapPhrase: 'ambiguous product decisions with a human rubric',
        label: 'human-rubric-deferred',
        criterion:
            'DEFERRED — no human raters are available. Per the resolved `blocker: maintainer-blind-ratings` option (b), this family is pre-registered in full and published as deferred; it runs no arm and spends no call in Phase 2. A model-graded substitute is NOT run in its place: the blocker forbids using one as a stand-in for blind human judgment.',
    },
] as const satisfies readonly BenchFamily[];

/** Declared arity, so an append or a deletion reds the typecheck. */
export const BENCH_FAMILY_ARITY = 12;
type FamilyArityHolds = Assert<typeof BENCH_FAMILIES.length extends 12 ? true : false>;
export type _FamilyArity = [FamilyArityHolds];

/** Who participates in one pass. */
export type PassParticipants = 'all-members' | 'chairman' | 'anthropic-only' | 'openai-only';

/** One pass in an arm's call graph. */
export interface BenchPass {
    readonly kind:
        | 'generation'
        | 'peer-critique'
        | 'findings-extraction'
        | 'consensus-scoring'
        | 'prose-synthesis';
    readonly participants: PassParticipants;
    /** Repetitions of this pass. Generation repeats once per debate round. */
    readonly repeat: number;
    /**
     * True where the pass carries the ONE bounded re-ask of
     * `consensus_round.ts:141`. This is the entire retry reserve — no other
     * pass retries, and the re-ask is bounded at one, never a loop.
     */
    readonly retryEligible: boolean;
}

/** One frozen experimental arm. */
export interface BenchArm {
    readonly id: string;
    readonly group: 'baseline' | 'ablation' | 'axis' | 'rounds';
    /** Step 2.2 baseline name, or `null` where the arm is not a baseline. */
    readonly baseline: string | null;
    /** Step 2.4 ablation stage, or `null`. */
    readonly stage: string | null;
    /** A `CouncilTopology` name, `host-solo` where no external topology runs. */
    readonly topology: string;
    readonly modelSet: string;
    readonly rounds: number;
    readonly passes: readonly BenchPass[];
    /**
     * Arm whose result this arm REUSES rather than re-running, or `null`.
     * Reuse is only ever explicit: an arm with `reuseOf` set books zero calls
     * and must be scheduled into the same UTC-day batch as its source, so the
     * shared observation cannot acquire a day-as-confounder.
     */
    readonly reuseOf: string | null;
    /** Why this arm exists, in the roadmap's own terms. */
    readonly rationale: string;
}

const ALL_MEMBERS_GENERATION = (repeat: number): BenchPass => ({
    kind: 'generation',
    participants: 'all-members',
    repeat,
    retryEligible: false,
});
const PEER: BenchPass = {
    kind: 'peer-critique',
    participants: 'all-members',
    repeat: 1,
    retryEligible: false,
};
const EXTRACTION: BenchPass = {
    kind: 'findings-extraction',
    participants: 'all-members',
    repeat: 1,
    retryEligible: true,
};
const SCORING: BenchPass = {
    kind: 'consensus-scoring',
    participants: 'all-members',
    repeat: 1,
    retryEligible: false,
};
const SYNTHESIS: BenchPass = {
    kind: 'prose-synthesis',
    participants: 'chairman',
    repeat: 1,
    retryEligible: false,
};

/**
 * Model sets for the step-2.5 axis. Both seat exactly one member per provider,
 * so `all-members` is one anthropic call plus one openai call in either set.
 * `MS1` is the configured default pair; `MS2` is the cheaper pinned pair of the
 * SAME two providers, so the axis varies model quality without varying the
 * provider mix — which is the confound step 2.5 exists to separate out.
 */
export const MODEL_SETS = ['MS1-default', 'MS2-cheap'] as const;

/** The chairman provider for the synthesis pass. Pinned so it cannot drift. */
export const SYNTHESIS_CHAIRMAN: BenchProvider = 'anthropic';

/**
 * Every arm, frozen.
 *
 * ── The overlap question, answered explicitly ───────────────────────────────
 * The council required a statement of whether the five baselines, five
 * ablations, two axes and round arms overlap, with no implicit reuse. They
 * overlap in exactly TWO places and nowhere else:
 *
 *   - `axis-ms1-dual` is the same configuration as `baseline-default-council`
 *     and reuses it.
 *   - `rounds-1` is the same configuration as `baseline-default-council` and
 *     reuses it.
 *
 * Everything else re-runs. In particular the ablation ladder does NOT borrow
 * `baseline-default-council`'s generation output for its `generation-only`
 * rung, even though the two look interchangeable: an attribution claim needs
 * all five rungs produced under identical conditions, and a rung borrowed from
 * a baseline executed on a different UTC day would carry day-as-confounder
 * into the one arm whose entire purpose is attribution.
 */
export const BENCH_ARMS = [
    // ── Step 2.2 — the five mandatory baselines ─────────────────────────────
    {
        id: 'baseline-host-solo',
        group: 'baseline',
        baseline: 'host solo',
        stage: null,
        topology: 'host-solo',
        modelSet: 'host',
        rounds: 0,
        passes: [],
        reuseOf: null,
        rationale:
            'The zero-call floor. Its call count is 0 by construction, which is exactly why the roadmap total cannot be read off the cell count.',
    },
    {
        id: 'baseline-single-strongest',
        group: 'baseline',
        baseline: 'strongest configured single external model',
        stage: null,
        topology: 'single_external',
        modelSet: 'MS1-default',
        rounds: 1,
        passes: [{ ...ALL_MEMBERS_GENERATION(1), participants: 'anthropic-only' }],
        reuseOf: null,
        rationale:
            'Step 2.2 verify: no result may claim "council improves quality" without a strong single-model baseline in the same table.',
    },
    {
        id: 'baseline-single-cheapest',
        group: 'baseline',
        baseline: 'cheapest configured single external model',
        stage: null,
        topology: 'single_external',
        modelSet: 'MS2-cheap',
        rounds: 1,
        passes: [{ ...ALL_MEMBERS_GENERATION(1), participants: 'openai-only' }],
        reuseOf: null,
        rationale:
            'The cost floor of the external arms. Provider assignment follows the configured strongest/cheapest ranking and is pinned here so it cannot drift between batches.',
    },
    {
        id: 'baseline-default-council',
        group: 'baseline',
        baseline: 'current default council path',
        stage: null,
        topology: 'dual_independent',
        modelSet: 'MS1-default',
        rounds: 1,
        passes: [ALL_MEMBERS_GENERATION(1), EXTRACTION, SCORING],
        reuseOf: null,
        rationale: 'What the suite does today. Every improvement claim is measured against this.',
    },
    {
        id: 'baseline-full-debate',
        group: 'baseline',
        baseline: 'full debate where applicable',
        stage: null,
        topology: 'full_debate',
        modelSet: 'MS1-default',
        rounds: 2,
        passes: [ALL_MEMBERS_GENERATION(2), PEER, EXTRACTION, SCORING],
        reuseOf: null,
        rationale: 'The expensive ceiling. Its cost is the number the cheaper topologies must beat.',
    },

    // ── Step 2.4 — the five-rung ablation ladder ────────────────────────────
    {
        id: 'ablation-generation-only',
        group: 'ablation',
        baseline: null,
        stage: 'generation only',
        topology: 'dual_independent',
        modelSet: 'MS1-default',
        rounds: 1,
        passes: [ALL_MEMBERS_GENERATION(1)],
        reuseOf: null,
        rationale: 'Rung 1. Step 2.4 verify: an improvement can be attributed to a named stage.',
    },
    {
        id: 'ablation-plus-ranking',
        group: 'ablation',
        baseline: null,
        stage: '+ ranking',
        topology: 'dual_independent',
        modelSet: 'MS1-default',
        rounds: 1,
        passes: [ALL_MEMBERS_GENERATION(1), SCORING],
        reuseOf: null,
        rationale: 'Rung 2 — adds the consensus scoring pass and nothing else.',
    },
    {
        id: 'ablation-plus-peer-critique',
        group: 'ablation',
        baseline: null,
        stage: '+ peer critique',
        topology: 'peer_review',
        modelSet: 'MS1-default',
        rounds: 1,
        passes: [ALL_MEMBERS_GENERATION(1), PEER, SCORING],
        reuseOf: null,
        rationale: 'Rung 3 — adds the anonymised peer-review pass.',
    },
    {
        id: 'ablation-plus-synthesis',
        group: 'ablation',
        baseline: null,
        stage: '+ synthesis',
        topology: 'judge_synthesis',
        modelSet: 'MS1-default',
        rounds: 1,
        passes: [ALL_MEMBERS_GENERATION(1), PEER, SCORING, SYNTHESIS],
        reuseOf: null,
        rationale:
            'Rung 4. The templated synthesis path spends nothing, so the synthesis STAGE is only observable with the prose path on — which is one chairman call, and the only asymmetric pass in the ladder.',
    },
    {
        id: 'ablation-full-pipeline',
        group: 'ablation',
        baseline: null,
        stage: 'full pipeline',
        topology: 'judge_synthesis',
        modelSet: 'MS1-default',
        rounds: 1,
        passes: [ALL_MEMBERS_GENERATION(1), PEER, EXTRACTION, SCORING, SYNTHESIS],
        reuseOf: null,
        rationale: 'Rung 5 — every stage on, so rung 4 → rung 5 isolates findings extraction.',
    },

    // ── Step 2.5 — the two axes ─────────────────────────────────────────────
    {
        id: 'axis-ms1-dual',
        group: 'axis',
        baseline: null,
        stage: null,
        topology: 'dual_independent',
        modelSet: 'MS1-default',
        rounds: 1,
        passes: [ALL_MEMBERS_GENERATION(1), EXTRACTION, SCORING],
        reuseOf: 'baseline-default-council',
        rationale:
            'The shared corner of both axes. Declared reuse of the default-council baseline — identical configuration, so re-running it would buy a second sample of the same cell rather than a second cell.',
    },
    {
        id: 'axis-ms1-peer',
        group: 'axis',
        baseline: null,
        stage: null,
        topology: 'peer_review',
        modelSet: 'MS1-default',
        rounds: 1,
        passes: [ALL_MEMBERS_GENERATION(1), PEER, SCORING],
        reuseOf: null,
        rationale: 'Same model set, second topology — the topology axis.',
    },
    {
        id: 'axis-ms2-dual',
        group: 'axis',
        baseline: null,
        stage: null,
        topology: 'dual_independent',
        modelSet: 'MS2-cheap',
        rounds: 1,
        passes: [ALL_MEMBERS_GENERATION(1), EXTRACTION, SCORING],
        reuseOf: null,
        rationale: 'Same topology, second model set — the model-quality axis.',
    },
    {
        id: 'axis-ms2-peer',
        group: 'axis',
        baseline: null,
        stage: null,
        topology: 'peer_review',
        modelSet: 'MS2-cheap',
        rounds: 1,
        passes: [ALL_MEMBERS_GENERATION(1), PEER, SCORING],
        reuseOf: null,
        rationale:
            'The fourth corner. Without it the two axes cannot be separated from their interaction.',
    },

    // ── Step 2.7 — the round-count arm ──────────────────────────────────────
    {
        id: 'rounds-1',
        group: 'rounds',
        baseline: null,
        stage: null,
        topology: 'dual_independent',
        modelSet: 'MS1-default',
        rounds: 1,
        passes: [ALL_MEMBERS_GENERATION(1), EXTRACTION, SCORING],
        reuseOf: 'baseline-default-council',
        rationale:
            'The rounds=1 leg. Declared reuse of the default-council baseline — identical configuration.',
    },
    {
        id: 'rounds-2',
        group: 'rounds',
        baseline: null,
        stage: null,
        topology: 'dual_independent',
        modelSet: 'MS1-default',
        rounds: 2,
        passes: [ALL_MEMBERS_GENERATION(2), EXTRACTION, SCORING],
        reuseOf: null,
        rationale:
            'The rounds=2 leg. Grounded in arXiv 2505.19477 (round-1 debate bias amplification); step 2.7 accepts a published null as a valid outcome.',
    },
] as const satisfies readonly BenchArm[];

/** The full step-2.3 metric set. A missing column is a declared gap, never silence. */
export const BENCH_METRICS = [
    'deterministic-correctness',
    'executable-test-result',
    'rubric-quality',
    'cost',
    'latency',
    'calls',
    'tokens',
    'parse-gradeability-rate',
    'rerun-variance',
    'disagreement-entropy',
    'minority-rescue',
    'majority-corruption',
    'synthesis-delta',
    'zero-marginal-value-call-rate',
] as const;

/**
 * Items per family, and trials per item.
 *
 * Both are DECLARED here rather than derived: the roadmap fixes neither, and
 * the day count is linear in their product, so leaving them implicit is what
 * made the phase unschedulable. One item per family is the minimum at which a
 * family has an observation at all; N=2 is the roadmap's own floor.
 */
export const ITEMS_PER_FAMILY = 1;
export const TRIALS_PER_ITEM = 2;

/** One fully addressed manifest row. */
export interface ManifestCell {
    readonly cell_id: string;
    readonly family: string;
    readonly family_label: FamilyLabel;
    readonly item: string;
    readonly trial: number;
    readonly baseline: string | null;
    readonly stage: string | null;
    readonly topology: string;
    readonly model_set: string;
    readonly rounds: number;
    readonly expected_calls: ProviderCalls;
    readonly max_calls: ProviderCalls;
    readonly reuse_source: string | null;
    /**
     * The step-2.3 metric set this cell emits, by REFERENCE to `metric_set` in
     * the serialised manifest. Every eligible cell emits the full set, so
     * inlining fourteen identical strings 384 times would add a third of a
     * megabyte to a frozen artefact without adding a fact. A missing column at
     * run time is recorded as a declared gap on the RESULT, never by quietly
     * shortening this list.
     */
    readonly metrics: 'full-2.3-set';
    readonly status: CellStatus;
}

const ZERO: ProviderCalls = Object.freeze({ anthropic: 0, openai: 0 });

function addCalls(a: ProviderCalls, b: ProviderCalls): ProviderCalls {
    return { anthropic: a.anthropic + b.anthropic, openai: a.openai + b.openai };
}

/** Calls one pass books, before any retry reserve. */
function passCalls(pass: BenchPass): ProviderCalls {
    const n = pass.repeat;
    switch (pass.participants) {
        case 'all-members':
            return { anthropic: n, openai: n };
        case 'chairman':
            return SYNTHESIS_CHAIRMAN === 'anthropic'
                ? { anthropic: n, openai: 0 }
                : { anthropic: 0, openai: n };
        case 'anthropic-only':
            return { anthropic: n, openai: 0 };
        case 'openai-only':
            return { anthropic: 0, openai: n };
    }
}

/**
 * The retry reserve a pass adds: ONE re-ask per participating member, and only
 * for the findings-extraction pass. Reserved up front rather than spent
 * opportunistically — a retry that discovers the cap mid-cell has already
 * breached it.
 */
function passRetryReserve(pass: BenchPass): ProviderCalls {
    if (!pass.retryEligible) return ZERO;
    return passCalls({ ...pass, repeat: pass.repeat });
}

/** Expected and maximum provider calls for one arm. */
export function armCalls(arm: BenchArm): { expected: ProviderCalls; max: ProviderCalls } {
    if (arm.reuseOf !== null) return { expected: ZERO, max: ZERO };
    let expected = ZERO;
    let reserve = ZERO;
    for (const pass of arm.passes) {
        expected = addCalls(expected, passCalls(pass));
        reserve = addCalls(reserve, passRetryReserve(pass));
    }
    return { expected, max: addCalls(expected, reserve) };
}

/**
 * Expand the frozen spec into every cell. Deterministic and order-stable:
 * family order, then item, then trial, then arm order.
 *
 * Every emitted cell is `pending` — or `not_eligible` for the deferred family,
 * which is emitted rather than dropped so its exclusion is visible in the
 * manifest instead of inferable from an absence.
 */
export function expandManifest(): ManifestCell[] {
    const cells: ManifestCell[] = [];
    for (const family of BENCH_FAMILIES) {
        const eligible = family.label !== 'human-rubric-deferred';
        for (let i = 1; i <= ITEMS_PER_FAMILY; i++) {
            const item = `${family.id}-item-${String(i).padStart(2, '0')}`;
            for (let trial = 1; trial <= TRIALS_PER_ITEM; trial++) {
                for (const arm of BENCH_ARMS) {
                    const { expected, max } = armCalls(arm);
                    cells.push({
                        cell_id: `${item}/t${trial}/${arm.id}`,
                        family: family.id,
                        family_label: family.label,
                        item,
                        trial,
                        baseline: arm.baseline,
                        stage: arm.stage,
                        topology: arm.topology,
                        model_set: arm.modelSet,
                        rounds: arm.rounds,
                        expected_calls: eligible ? expected : ZERO,
                        max_calls: eligible ? max : ZERO,
                        reuse_source: arm.reuseOf,
                        metrics: 'full-2.3-set',
                        status: eligible ? 'pending' : 'not_eligible',
                    });
                }
            }
        }
    }
    return cells;
}

/** One immutable UTC-day batch. */
export interface DayBatch {
    readonly day: number;
    readonly cell_ids: readonly string[];
    readonly booked: ProviderCalls;
}

/**
 * Partition cells into UTC-day batches under the per-provider cap.
 *
 * Books **maximum** calls, never expected: the retry reserve has to be held
 * before a cell starts, or a re-ask discovers the ceiling by crossing it. A
 * cell is atomic — it never spans a day boundary, because a cell split across
 * days acquires day-as-confounder inside a single observation.
 *
 * Greedy and deterministic in cell order, so the same spec yields the same
 * schedule on every machine. Zero-call cells (host-solo, declared reuse, the
 * deferred family) still land in a batch, since they must be observed on the
 * same day as the arms they are compared with.
 */
export function partitionIntoDays(
    cells: readonly ManifestCell[],
    capPerProvider: number = CALLS_PER_PROVIDER_PER_UTC_DAY,
): DayBatch[] {
    const batches: { day: number; cell_ids: string[]; booked: { anthropic: number; openai: number } }[] =
        [];
    let current = { day: 1, cell_ids: [] as string[], booked: { anthropic: 0, openai: 0 } };
    for (const cell of cells) {
        const fits =
            current.booked.anthropic + cell.max_calls.anthropic <= capPerProvider &&
            current.booked.openai + cell.max_calls.openai <= capPerProvider;
        if (!fits) {
            batches.push(current);
            current = { day: batches.length + 1, cell_ids: [], booked: { anthropic: 0, openai: 0 } };
        }
        current.cell_ids.push(cell.cell_id);
        current.booked.anthropic += cell.max_calls.anthropic;
        current.booked.openai += cell.max_calls.openai;
    }
    batches.push(current);
    return batches.map((b) => ({ day: b.day, cell_ids: b.cell_ids, booked: { ...b.booked } }));
}

/** The totals the council asked for, and the reason this module exists. */
export interface ManifestTotals {
    readonly cells: number;
    readonly eligible_cells: number;
    readonly deferred_cells: number;
    readonly reuse_cells: number;
    readonly minimum_calls: ProviderCalls;
    readonly worst_case_calls: ProviderCalls;
    readonly minimum_total: number;
    readonly worst_case_total: number;
    readonly utc_days: number;
    readonly cap_per_provider_per_day: number;
}

export function summariseManifest(cells: readonly ManifestCell[]): ManifestTotals {
    let min = ZERO;
    let max = ZERO;
    let eligible = 0;
    let deferred = 0;
    let reuse = 0;
    for (const c of cells) {
        min = addCalls(min, c.expected_calls);
        max = addCalls(max, c.max_calls);
        if (c.status === 'not_eligible') deferred++;
        else eligible++;
        if (c.reuse_source !== null) reuse++;
    }
    return {
        cells: cells.length,
        eligible_cells: eligible,
        deferred_cells: deferred,
        reuse_cells: reuse,
        minimum_calls: min,
        worst_case_calls: max,
        minimum_total: min.anthropic + min.openai,
        worst_case_total: max.anthropic + max.openai,
        utc_days: partitionIntoDays(cells).length,
        cap_per_provider_per_day: CALLS_PER_PROVIDER_PER_UTC_DAY,
    };
}

/**
 * Is Phase 2 complete? Only when every ELIGIBLE cell carries an observed
 * outcome. `pending` is never an outcome, which is the encoded form of "not
 * run is not a null".
 */
export function phase2Complete(cells: readonly ManifestCell[]): boolean {
    return cells
        .filter((c) => c.status !== 'not_eligible')
        .every((c) => (PHASE2_COMPLETE_STATUSES as readonly string[]).includes(c.status));
}

/** Runtime twin of the type-layer completion invariant. Types erase; this does not. */
export function auditCompletionStatuses(): void {
    const complete = PHASE2_COMPLETE_STATUSES as readonly string[];
    for (const forbidden of ['pending', 'not_eligible']) {
        if (complete.includes(forbidden)) {
            throw new Error(
                `council-topology manifest: \`${forbidden}\` must never count as a completed cell — ` +
                    'an unexecuted arm is not a null.',
            );
        }
    }
    if (BENCH_FAMILIES.length !== BENCH_FAMILY_ARITY) {
        throw new Error(
            `council-topology manifest: expected exactly ${BENCH_FAMILY_ARITY} pre-registered ` +
                `families, found ${BENCH_FAMILIES.length}. Changing the family set weakens step 2.1 ` +
                'and is owner-reserved.',
        );
    }
}

auditCompletionStatuses();

/** The committed manifest artefact, relative to the repo root. */
export const MANIFEST_PATH = 'internal/bench/council-topology/call-manifest.json';

/** The whole frozen manifest, as it is serialised. */
export function renderManifest(): string {
    const cells = expandManifest();
    return `${JSON.stringify(
        {
            schema_version: 1,
            generated_by: 'src/scripts/ai_council/topology_bench_manifest.ts',
            frozen: true,
            note:
                'Generated. Never hand-edit — regenerate from the frozen arm spec. ' +
                'Editing a call count here without editing the spec would let the ' +
                'schedule drift from the mechanics it claims to model.',
            cap_per_provider_per_utc_day: CALLS_PER_PROVIDER_PER_UTC_DAY,
            items_per_family: ITEMS_PER_FAMILY,
            trials_per_item: TRIALS_PER_ITEM,
            complete_statuses: PHASE2_COMPLETE_STATUSES,
            metric_set: BENCH_METRICS,
            families: BENCH_FAMILIES,
            arms: BENCH_ARMS,
            totals: summariseManifest(cells),
            day_batches: partitionIntoDays(cells),
            cells,
        },
        null,
        2,
    )}\n`;
}

/** `./scripts-run src/scripts/ai_council/topology_bench_manifest --emit` */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const cells = expandManifest();
    const totals = summariseManifest(cells);
    if (argv.includes('--emit')) {
        const fs = await import('node:fs');
        fs.writeFileSync(MANIFEST_PATH, renderManifest(), 'utf8');
        process.stdout.write(`wrote ${MANIFEST_PATH}\n`);
    }
    process.stdout.write(
        `cells ${totals.cells} (eligible ${totals.eligible_cells}, deferred ${totals.deferred_cells}, reuse ${totals.reuse_cells})\n` +
            `minimum   ${totals.minimum_total} calls — anthropic ${totals.minimum_calls.anthropic}, openai ${totals.minimum_calls.openai}\n` +
            `worst case ${totals.worst_case_total} calls — anthropic ${totals.worst_case_calls.anthropic}, openai ${totals.worst_case_calls.openai}\n` +
            `UTC days  ${totals.utc_days} at ${totals.cap_per_provider_per_day} calls/provider/day\n`,
    );
    return 0;
}

// Self-execution guard.
// `run.ts` spawns the file directly, so the module runs its own entry point.
// realpath on both sides because argv[1] keeps the symlinked path while
// import.meta.url is already resolved -- the same comparison
// `check_council_references.ts:356-360` makes for the same reason.
{
    const nodeFs = await import('node:fs');
    const nodeUrl = await import('node:url');
    const invoked = process.argv[1];
    if (invoked !== undefined && invoked !== '') {
        let here = '';
        let there = ' ';
        try {
            here = nodeFs.realpathSync(nodeUrl.fileURLToPath(import.meta.url));
            there = nodeFs.realpathSync(invoked);
        } catch {
            here = '';
            there = ' ';
        }
        if (here === there) process.exit(await main());
    }
}
