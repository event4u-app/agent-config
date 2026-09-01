/**
 * The METERED candidate proposer — the second arm, and the one that costs money.
 *
 * `road-to-governed-evidence-production` step 2.1, built under the
 * **NARROWED 2026-09-01** disposition of `blocker: metered-backend-park`: a
 * metered PROPOSER is admitted, a metered EVALUATOR stays forbidden.
 *
 * `_lib/candidate_proposer.ts` is the deterministic arm and the surface this
 * mirrors — same {@link DefectObservation} input, same {@link CandidateRecord}
 * output, same id scheme — so the two are comparable pair-wise over one input
 * rather than being two different experiments wearing one name.
 *
 * ## The role constraint, and where each half of it is enforced
 *
 * > *A metered call may generate candidate text. It may not score, rank,
 * > filter, select between, or supply any input to the verdict for the arms
 * > being compared — whatever the module is called.*
 *
 * Held by construction, not by intention. Six places:
 *
 * | Forbidden role | What makes it unavailable |
 * |---|---|
 * | supply a score | {@link GenerationResult} carries `text` and `model` and nothing else, and {@link NoDecisionField} makes adding a scoring key a BUILD ERROR |
 * | rank | no function here accepts more than one generation for one observation; there is no code path that holds two |
 * | select between candidates | exactly one record per observation, asserted at the return by {@link CandidateCountError} |
 * | filter | an observation that cannot be satisfied THROWS; it is never dropped, so the output can never be a subset |
 * | reorder | the output order is `byteCompare` over the INPUT, reusing the deterministic arm's own comparator — model output is never an ordering key |
 * | reach the verdict | this module imports no verdict module, asserted by its test |
 *
 * The retry loop is the one place a reader should look twice. It stops at the
 * FIRST output that satisfies the record contract; it never holds two valid
 * generations and never compares them. First-valid is a retry policy. Choosing
 * the better of two valid generations would be selection, and there is no code
 * path here that could express it.
 *
 * ## Who decides escalation
 *
 * The **pathology of a deterministic refusal**, never the model's opinion of its
 * own output. The first attempt runs on `reason_unknown`, whose ladder is
 * exactly `['lite']` — *"escalating on a reason nobody established is spending
 * on a guess"* (`_lib/evolution_roi.ts:117-119`). A refusal is then classified
 * into a {@link PathologyWhy} by {@link classifyRefusal}, and the walk continues
 * on THAT class's ladder from its cheapest untried rung. A class with an empty
 * ladder stops the walk.
 *
 * Every attempt is recorded and the whole list is checked by
 * `assertCheapestFirst` (`_lib/evolution_roi.ts:191`) before this module
 * returns — the production caller AC-3 asks for.
 *
 * ## No transport lives here
 *
 * The metered call arrives as an injected {@link TextGenerator} port. The
 * shipped binding is `_lib/llm_proposer_transport.ts`; this module imports it
 * nowhere, so the arm is testable with a stub and the transport is one small
 * file a reviewer can read whole.
 */

import {
    RECIPES,
    byteCompare,
    candidateId,
    type DefectObservation,
    type SubjectReader,
} from './candidate_proposer.js';
import {
    CANDIDATE_RECORD_VERSION,
    CandidateSchemaError,
    assertMutationPathsOwned,
    type CandidateRecord,
    type Mutation,
} from './candidate_record.js';
import {
    assertCheapestFirst,
    ladderFor,
    nextTier,
    type LadderAttempt,
    type ModelTier,
} from './evolution_roi.js';
import type { PathologyWhy } from './pathology_archive.js';

type Assert<T extends true> = T;

/**
 * Keys that would turn a generation into a decision.
 *
 * The same mechanism `_lib/runtime_journal.ts`'s `FREE_FORM_KEYS` uses for the
 * privacy floor, pointed at a different failure: there, a field that could hold
 * content; here, a field that could hold a judgement. A closed deny-list is
 * blunt on purpose — a guard that only rejects the keys someone thought of is a
 * guard that has to be re-argued at every edit.
 */
export const DECISION_FIELD_KEYS = [
    'score',
    'scores',
    'rank',
    'ranking',
    'rating',
    'grade',
    'confidence',
    'probability',
    'logprob',
    'logprobs',
    'best',
    'chosen',
    'selected',
    'preferred',
    'winner',
    'verdict',
    'order',
    'priority',
    'weight',
    'quality',
] as const;
export type DecisionFieldKey = (typeof DECISION_FIELD_KEYS)[number];

/** `T` when `T` carries no {@link DecisionFieldKey}, and `never` when it does. */
export type NoDecisionField<T> = Extract<keyof T, DecisionFieldKey> extends never ? T : never;

// --- the port ----------------------------------------------------------------

/** One metered request. The tier is the ladder's, never the model's choice. */
export interface GenerationRequest {
    readonly tier: ModelTier;
    readonly system: string;
    readonly prompt: string;
}

/**
 * What a metered call may return: text, and which model produced it.
 *
 * `model` is provenance and not a judgement — the protocol document needs it to
 * record what was run. Nothing in this module reads it.
 */
export interface GenerationResult {
    readonly text: string;
    readonly model: string;
}

/**
 * The metered port. One request in, one text out.
 *
 * It cannot express a batch, so it cannot express a comparison: a signature
 * taking `readonly GenerationRequest[]` and returning a sorted list would be a
 * ranking surface even if today's implementation ignored the order.
 */
export type TextGenerator = (req: GenerationRequest) => Promise<GenerationResult>;

/** A generation the record contract refused. Carries WHY, as a pathology. */
export class GenerationRefusedError extends Error {
    readonly why: PathologyWhy;
    constructor(why: PathologyWhy, message: string) {
        super(message);
        this.name = 'GenerationRefusedError';
        this.why = why;
    }
}

/** One observation produced no record and was not dropped. */
export class CandidateCountError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CandidateCountError';
    }
}

// --- prompts -----------------------------------------------------------------

/**
 * The system prompt. FROZEN — its bytes are part of the execution protocol
 * (`docs/contracts/metered-proposer-protocol.md`), so an edit here is an edit to
 * the protocol and invalidates a comparison already captured against it.
 */
export const SYSTEM_PROMPT =
    'You rewrite one Markdown artifact to remove one named defect.\n' +
    'Return ONLY the complete rewritten artifact body. No preamble, no fences,\n' +
    'no commentary, no explanation of what you changed.\n' +
    'Do not judge, score, rank, or compare anything. Produce one body.';

/** The user prompt for one observation. Pure — same inputs, same bytes. */
export function buildPrompt(obs: DefectObservation, body: string): string {
    const recipe = RECIPES[obs.defectClass];
    const route = obs.routeTo === undefined ? '' : `\nThe obligation must be routed to: ${obs.routeTo}\n`;
    return (
        `Defect class: ${obs.defectClass}\n` +
        `What that means: ${recipe.summary}\n` +
        `Artifact path: ${obs.subject}\n` +
        route +
        '\n--- BEGIN CURRENT BODY ---\n' +
        body +
        '\n--- END CURRENT BODY ---\n'
    );
}

// --- the output contract ------------------------------------------------------

/**
 * The largest generated body accepted, in bytes.
 *
 * A STATED CEILING, not a measured one, and it is a runaway guard rather than a
 * quality bar: 256 KiB is far above any artifact in the candidate surface and
 * far below a generation that has stopped producing an artifact. *Revisit-if* a
 * legitimate subject approaches it.
 */
export const MAX_BODY_BYTES = 256 * 1024;

/** The NUL code unit, built rather than typed so no source file carries one. */
const NUL = String.fromCharCode(0);

/**
 * Refuse a generation the record contract cannot accept.
 *
 * Every check here is a SHAPE check with an objective predicate, and none of
 * them compares two generations or asks whether one is good. That distinction
 * is the role constraint: `output_contract_violated` is a fact about one string,
 * `better` is a judgement about two.
 *
 * @throws {GenerationRefusedError} carrying the pathology of the refusal.
 */
export function assertGenerationAcceptable(
    obs: DefectObservation,
    before: string,
    after: string,
): void {
    if (after.trim() === '') {
        throw new GenerationRefusedError('output_contract_violated', 'the generation is empty');
    }
    const bytes = Buffer.byteLength(after, 'utf8');
    if (bytes > MAX_BODY_BYTES) {
        throw new GenerationRefusedError(
            'output_contract_violated',
            `the generation is ${String(bytes)} bytes, over the ${String(MAX_BODY_BYTES)}-byte ceiling`,
        );
    }
    if (after.includes(NUL)) {
        throw new GenerationRefusedError('output_contract_violated', 'the generation contains a NUL byte');
    }
    if (after === before) {
        throw new GenerationRefusedError(
            'output_contract_violated',
            'the generation is byte-identical to the input — a proposal that changes nothing is not a proposal',
        );
    }
    const recipe = RECIPES[obs.defectClass];
    if (recipe.needsRouteTo && obs.routeTo !== undefined && !after.includes(obs.routeTo)) {
        throw new GenerationRefusedError(
            'output_contract_violated',
            `the generation does not name the required route target '${obs.routeTo}'`,
        );
    }
}

/**
 * The pathology of a thrown failure.
 *
 * Deterministic and total. A refusal carries its own class; anything else is
 * `execution_failed`, which is the honest reading of a transport or runtime
 * error and licenses the full ladder because capability plausibly helps there.
 */
export function classifyRefusal(e: unknown): PathologyWhy {
    if (e instanceof GenerationRefusedError) return e.why;
    if (e instanceof CandidateSchemaError) return 'output_contract_violated';
    return 'execution_failed';
}

// --- the ladder walk -----------------------------------------------------------

/** The class the FIRST attempt runs on, before any refusal has been observed. */
export const INITIAL_CLASS: PathologyWhy = 'reason_unknown';

export interface MeteredProposal {
    readonly records: readonly CandidateRecord[];
    /** Every attempt, in the order it was made. The audit trail for AC-3. */
    readonly attempts: readonly LadderAttempt[];
    /** Which model produced each accepted record, by candidate id. Provenance only. */
    readonly models: Readonly<Record<string, string>>;
}

/**
 * Walk the ladder for one observation until a generation is accepted.
 *
 * Throws when the ladder runs out — it never returns "no record", because a
 * silently absent record is the filtering the role constraint forbids.
 */
async function proposeOne(
    obs: DefectObservation,
    before: string,
    generate: TextGenerator,
    attempts: LadderAttempt[],
    seq: { n: number },
): Promise<{ record: CandidateRecord; model: string }> {
    let cls: PathologyWhy = INITIAL_CLASS;
    // Per OBSERVATION, deliberately. A new observation is a new proposal and
    // starts at the cheapest rung again; the guard allows that explicitly — a
    // repeat of an already-spent rung "is not an escalation"
    // (`_lib/evolution_roi.ts:203`). Sharing one map across observations would
    // exhaust the ladder on the second subject, which is what the first version
    // of this function did and what its test caught.
    const spentByClass = new Map<PathologyWhy, ModelTier[]>();
    let lastError: unknown = null;

    for (;;) {
        const spent = spentByClass.get(cls) ?? [];
        const tier = nextTier(cls, spent);
        if (tier === null) {
            // STOP. Either the ladder is empty for this class or every licensed
            // rung is spent. `null` means stop in both cases — a caller reading
            // it as "escalate" has inverted the policy.
            throw new GenerationRefusedError(
                cls,
                `no tier left for '${obs.defectClass}' on ${obs.subject}: class '${cls}' licenses ` +
                    `${ladderFor(cls).join(' < ') || 'nothing'}` +
                    (lastError === null ? '' : ` — last refusal: ${(lastError as Error).message}`),
            );
        }
        spent.push(tier);
        spentByClass.set(cls, spent);
        seq.n += 1;
        attempts.push({ defect_class: cls, tier, sequence: seq.n });

        try {
            const gen = await generate({ tier, system: SYSTEM_PROMPT, prompt: buildPrompt(obs, before) });
            assertGenerationAcceptable(obs, before, gen.text);
            const mutations: Mutation[] = [{ path: obs.subject, content: gen.text }];
            assertMutationPathsOwned(mutations);
            return {
                record: {
                    kind: 'candidate',
                    version: CANDIDATE_RECORD_VERSION,
                    // The SAME id function as the deterministic arm: a content
                    // hash over class, subject and mutation bytes. Two arms
                    // producing the same bytes therefore produce the same id,
                    // which is what makes a pair-wise comparison legible.
                    id: candidateId(obs.defectClass, obs.subject, mutations),
                    // The dimension comes from the RECIPE, never from the model.
                    // A model that could pick the dimension would be choosing
                    // which arm of the alphabet its own candidate sits on, and
                    // that is a decision.
                    dimension: RECIPES[obs.defectClass].dimension,
                    lifecycle: 'proposed',
                    mutations,
                },
                model: gen.model,
            };
        } catch (e) {
            lastError = e;
            cls = classifyRefusal(e);
        }
    }
}

/**
 * Propose one candidate per observation, using a metered generator.
 *
 * The metered twin of `proposeCandidates`. Ordering is fixed EXACTLY ONCE, on
 * the input, with the deterministic arm's own comparator — so the two arms walk
 * the same observations in the same order and a pair is a pair.
 *
 * `priorAttempts` carries what an earlier, budget-aborted run of the same corpus
 * already spent, so the ordering guard sees the whole run rather than its tail.
 * It is UNTRUSTED input and is validated against the ladder by the same
 * `assertCheapestFirst` call the fresh path uses — which is what makes that
 * guard's red producible from this function's own arguments.
 *
 * @throws {CandidateCountError} if the output would not be one record per
 * observation. It is not reachable through this function's own logic, which is
 * why it is asserted rather than trusted: the invariant is what makes "no
 * filtering" checkable by a reader who does not want to re-derive the loop.
 */
export async function proposeCandidatesWithModel(
    observations: readonly DefectObservation[],
    read: SubjectReader,
    generate: TextGenerator,
    priorAttempts: readonly LadderAttempt[] = [],
): Promise<MeteredProposal> {
    const ordered = [...observations].sort(
        (a, b) => byteCompare(a.defectClass, b.defectClass) || byteCompare(a.subject, b.subject),
    );
    const records: CandidateRecord[] = [];
    // A resumed run's history LEADS the attempt list. The budget guard ABORTS
    // rather than truncating (`_lib/harness_evolution_guards.ts:140`), so a run
    // that hits `max_spend_cents` stops mid-corpus; the resume passes the
    // observations it has left plus what the aborted run already spent, and the
    // ordering guard below then sees the whole run rather than its tail.
    //
    // It does NOT seed the per-observation ladder. Resume happens at the
    // observation level — a completed observation is simply absent from the new
    // input — and a fresh observation legitimately starts at the cheapest rung.
    const attempts: LadderAttempt[] = [...priorAttempts];
    const models: Record<string, string> = {};
    const seq = { n: attempts.reduce((m, a) => Math.max(m, a.sequence), 0) };

    for (const obs of ordered) {
        const { record, model } = await proposeOne(obs, read(obs.subject), generate, attempts, seq);
        records.push(record);
        models[record.id] = model;
    }

    if (records.length !== ordered.length) {
        throw new CandidateCountError(
            `${String(ordered.length)} observation(s) produced ${String(records.length)} record(s) — a ` +
                'proposer that returns fewer records than observations has filtered, which is an evaluator role',
        );
    }
    // AC-3's production caller, over a REAL population: the history a caller
    // supplied plus what the walk above actually did.
    //
    // Its red is producible from this function's own inputs, which is the
    // property that distinguishes a guard from a comment. Over an empty
    // `priorAttempts` it cannot fire — `nextTier` per class makes an
    // out-of-order sequence unconstructible — so on its own the walk would be
    // exactly the un-provable guard this repository has caught before
    // (`_lib/candidate_proposer.ts:343-347`, one ordering site, one guard, one
    // red). What makes it falsifiable is the resumed-run path: a caller that
    // hands back a history in which a costlier tier was spent before a cheaper
    // one for the same class is refused here, and that is a real failure of a
    // real resume rather than a hypothetical.
    assertCheapestFirst(attempts);
    return { records, attempts, models };
}

/**
 * The attempt sequence a run WOULD make if every generation were accepted first
 * try — one `lite` attempt per observation, on {@link INITIAL_CLASS}.
 *
 * The dry-run population, and it is not a fixture: it is derived from the real
 * observations by the same `nextTier` call the live walk uses, so a dry run puts
 * the guard over a real, non-empty attempt list without spending anything.
 */
export function plannedAttempts(observations: readonly DefectObservation[]): LadderAttempt[] {
    const ordered = [...observations].sort(
        (a, b) => byteCompare(a.defectClass, b.defectClass) || byteCompare(a.subject, b.subject),
    );
    const attempts: LadderAttempt[] = [];
    let n = 0;
    for (let i = 0; i < ordered.length; i += 1) {
        const tier = nextTier(INITIAL_CLASS, []);
        if (tier === null) {
            throw new GenerationRefusedError(
                INITIAL_CLASS,
                `class '${INITIAL_CLASS}' licenses no tier, so no metered attempt is planned`,
            );
        }
        n += 1;
        attempts.push({ defect_class: INITIAL_CLASS, tier, sequence: n });
    }
    assertCheapestFirst(attempts);
    return attempts;
}

/**
 * The role constraint, at compile time.
 *
 * Adding `score`, `rank`, `confidence` or any other {@link DecisionFieldKey} to
 * the metered port's result type makes this `Assert<false>` and stops the build.
 * A metered call that returns a judgement is an evaluator whatever the module is
 * named, and this is the one place that can be made unavailable rather than
 * merely discouraged.
 */
type _GenerationResultCarriesNoDecisionField = Assert<
    [NoDecisionField<GenerationResult>] extends [never] ? false : true
>;
