/**
 * The candidate record: its arity, its mutation alphabet, and its lifecycle.
 *
 * `road-to-governed-harness-evolution` Phase 3, steps 3.2, 3.3 and 3.4.
 *
 * Three invariants live here because they are three properties of ONE record
 * and separating them would let a caller satisfy each in isolation while
 * violating the conjunction:
 *
 *   3.2 ONE PRIMARY DIMENSION PER CANDIDATE. If routing and body both change
 *       and the score moves, the credit is ambiguous and the Phase 4 metric
 *       vector cannot be read per candidate. Multi-dimension consolidation is a
 *       DISTINCT record type ({@link ConsolidationRecord}), not a candidate
 *       with a wider field.
 *
 *   3.3 THE MUTATION ALPHABET IS EXACTLY THREE — `activation`, `routing`,
 *       `content`. Precedence, composition, verification, tool strategy, budget
 *       and scope are named and unimplemented until the three carry.
 *
 *   3.4 A LIFECYCLE STATE ENUM, so `mutated` and `accepted` cannot be confused.
 *       Both parent designs made this the structural guard, one tracing the
 *       defect to a reference implementation passing `mutated` in where
 *       `accepted` was expected.
 *
 * ## E10 was a SPLIT, and this file takes the conservative side
 *
 * AI council 2026-08-30, anthropic + openai — **not convergent, 1/1**. The
 * anthropic seat argued for FOUR dimensions, adding `verification` now, on an
 * irreversibility argument: dimensions are metadata on candidate records, so
 * adding one later makes prior candidates permanently unclassifiable. The
 * openai seat argued for THREE, adding `verification` only when a demonstrable
 * need appears.
 *
 * Per this repository's escalation handling a split takes the **conservative**
 * side, so the alphabet is three — which is what step 3.3 already specified, so
 * its verify clause ("the schema rejects a mutation naming a fourth dimension")
 * stands unchanged. This is recorded as a split, not as a verdict.
 *
 * **The losing seat's concern is a design constraint this schema satisfies.**
 * Adding a dimension later must be an ADDITIVE change, never a migration that
 * orphans historical records. Two mechanisms, and both are load-bearing:
 *
 *   1. {@link CANDIDATE_RECORD_VERSION} is written into every record, so a
 *      later reader can tell which alphabet a record was authored against
 *      rather than inferring it from the values present.
 *   2. The unknown-dimension refusal lives in the VALIDATOR
 *      ({@link parseCandidateRecord}) and NOT in the reader
 *      ({@link readCandidateRecord}). A historical record naming a dimension
 *      this build does not know stays READABLE — it comes back flagged, not
 *      as a throw. Putting the refusal in the reader is what would make the
 *      record unreadable, which is exactly the irreversibility the anthropic
 *      seat named.
 *
 * Nothing here writes, spends, or fetches. Pure functions over declared state.
 */

/** Schema version stamped into every record. Bump when a field's meaning moves. */
export const CANDIDATE_RECORD_VERSION = 1;

// --- 3.3 — the mutation alphabet --------------------------------------------

/**
 * The three implemented mutation dimensions.
 *
 * The six named-and-unimplemented ones — precedence, composition, verification,
 * tool strategy, budget, scope — are deliberately absent rather than present
 * and disabled. A member that exists but is refused downstream reads as a
 * capability to a caller and as a gap to a reviewer; absence reads the same to
 * both.
 */
export const MUTATION_DIMENSIONS = ['activation', 'routing', 'content'] as const;
export type MutationDimension = (typeof MUTATION_DIMENSIONS)[number];

export function isMutationDimension(v: unknown): v is MutationDimension {
    return typeof v === 'string' && (MUTATION_DIMENSIONS as readonly string[]).includes(v);
}

// --- 3.4 — the lifecycle ----------------------------------------------------

/**
 * The candidate lifecycle, in spine order followed by the two off-spine exits.
 *
 * The ordering of the first seven is the ONLY thing that makes "a transition
 * skipping a stage" decidable, so it is the array's contract and not an
 * incidental listing order.
 */
export const LIFECYCLE_SPINE = [
    'proposed',
    'diagnostic-evaluated',
    'selection-evaluated',
    'promotion-eligible',
    'sealed-evaluated',
    'promotion-proposed',
    'promoted',
] as const;

export const LIFECYCLE_STATES = [...LIFECYCLE_SPINE, 'rejected', 'retired'] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export function isLifecycleState(v: unknown): v is LifecycleState {
    return typeof v === 'string' && (LIFECYCLE_STATES as readonly string[]).includes(v);
}

/**
 * The ONE state that means a candidate was accepted.
 *
 * Exported as a named constant rather than compared inline so that a grep for
 * the acceptance decision finds one site. Step 3.4's exit criterion is that no
 * code path reads a candidate as accepted from the mere fact that it exists;
 * one accessor is what makes that auditable.
 */
export const ACCEPTED_STATE: LifecycleState = 'promoted';

/**
 * Is this candidate accepted?
 *
 * Existence is not acceptance and neither is any evaluated state:
 * `sealed-evaluated` means it was measured, `promotion-eligible` means it may
 * be proposed, `promotion-proposed` means a human has been asked. Only
 * {@link ACCEPTED_STATE} answers yes.
 */
export function isAccepted(record: { readonly lifecycle: LifecycleState }): boolean {
    return record.lifecycle === ACCEPTED_STATE;
}

export class LifecycleTransitionError extends Error {
    readonly from: LifecycleState;
    readonly to: LifecycleState;
    constructor(from: LifecycleState, to: LifecycleState, why: string) {
        super(`lifecycle transition '${from}' -> '${to}' refused: ${why}`);
        this.name = 'LifecycleTransitionError';
        this.from = from;
        this.to = to;
    }
}

/**
 * A named human who approved a promotion. There is no anonymous form.
 *
 * See {@link assertTransition} for why this type exists at all — it is the
 * mechanical half of Phase 0's carried non-promotion condition.
 */
export interface HumanApproval {
    /** A person, not a process. Empty or whitespace-only is refused. */
    readonly approver: string;
    /** ISO-8601 date the approval was given. */
    readonly approvedAt: string;
}

function spineIndex(s: LifecycleState): number {
    return (LIFECYCLE_SPINE as readonly string[]).indexOf(s);
}

/**
 * Refuse any transition that is not exactly one legal step.
 *
 * The legal moves, and nothing else:
 *
 *   - one step FORWARD along the spine — `proposed → diagnostic-evaluated`,
 *     and so on. A jump of two or more is refused, which is step 3.4's
 *     "a state transition skipping a stage is refused" verbatim.
 *   - any non-terminal state → `rejected`. A candidate can die at any stage,
 *     and forcing it down the spine first would manufacture evaluated states
 *     for candidates that were never evaluated.
 *   - `promoted` → `retired`, and only from there. RETIRE is a first-class
 *     anti-sprawl operation (E6, 2/2 convergent on the 7-op set) and it acts
 *     on something that was promoted; retiring a candidate that never landed
 *     is a rejection wearing the wrong name.
 *
 * Backwards moves are refused. Self-transitions are refused — a no-op that
 * type-checks is how a stalled pipeline looks like a progressing one.
 *
 * ## The promotion gate — Phase 0's carried condition, discharged here
 *
 * Phase 0 carried a council condition UNMET (AI council 2026-08-29, anthropic +
 * openai, 2/2): the non-promotion property of Phases 1–6 must be MECHANICALLY
 * ENFORCED, not merely stated. It was carried unmet honestly, because nothing
 * in the tree promoted anything and a gate over a population of zero exits
 * green while looking like enforcement. The roadmap named where the population
 * stops being empty: *"the 3.4 lifecycle enum's `promoted` transition and the
 * 3.6 verb set are where the population stops being empty, so the check lands
 * there"*.
 *
 * This is that check for the transition half: **`→ promoted` requires a named
 * human approver.** No default, no service account, no `approver: 'ci'` — a
 * blank or whitespace-only name is refused, so the cheapest way to satisfy the
 * gate is to actually name someone.
 *
 * The verb half (3.6) is out of this change's scope and is NOT claimed
 * discharged. What holds now is narrower and worth stating exactly: no code
 * path can move a candidate into `promoted` without a name, on any surface that
 * calls this function.
 *
 * @throws {LifecycleTransitionError} on any refused move.
 */
export function assertTransition(
    from: LifecycleState,
    to: LifecycleState,
    approval?: HumanApproval,
): void {
    if (from === to) {
        throw new LifecycleTransitionError(from, to, 'a self-transition records no progress');
    }
    if (from === 'rejected' || from === 'retired') {
        throw new LifecycleTransitionError(from, to, `'${from}' is terminal`);
    }
    if (to === 'rejected') {
        return;
    }
    if (to === 'retired') {
        if (from !== 'promoted') {
            throw new LifecycleTransitionError(
                from,
                to,
                "only a promoted candidate can be retired; a candidate that never landed is 'rejected'",
            );
        }
        return;
    }
    const fromIdx = spineIndex(from);
    const toIdx = spineIndex(to);
    if (fromIdx < 0 || toIdx < 0) {
        throw new LifecycleTransitionError(from, to, 'not a spine state');
    }
    if (toIdx < fromIdx) {
        throw new LifecycleTransitionError(from, to, 'the lifecycle does not run backwards');
    }
    if (toIdx - fromIdx > 1) {
        const skipped = LIFECYCLE_SPINE.slice(fromIdx + 1, toIdx).join(', ');
        throw new LifecycleTransitionError(from, to, `it skips ${skipped}`);
    }
    if (to === 'promoted') {
        assertHumanApproval(approval);
    }
}

function assertHumanApproval(approval: HumanApproval | undefined): void {
    if (approval === undefined || approval.approver.trim() === '') {
        throw new LifecycleTransitionError(
            'promotion-proposed',
            'promoted',
            'promotion into canonical agent-config requires a NAMED human approver. ' +
                'This is the mechanical half of the non-promotion property the ' +
                'merge-authority council required (2026-08-29, anthropic + openai, 2/2); ' +
                'an unnamed or blank approver is refused rather than defaulted.',
        );
    }
}

// --- Path ownership ---------------------------------------------------------

/**
 * The only paths a candidate mutation may write.
 *
 * Declared here rather than imported from `bench_ab_clone` so this module stays
 * usable without the bench, and pinned equal to that script's `WITH_SURFACES`
 * and to `bench_ab_integrity`'s `ALLOWED_DELTA_PATHS` by a parity test. Three
 * copies of a list is a drift hazard; a test that fails when they diverge is
 * the cheapest form of one source of truth available without a refactor that
 * would touch the byte-exact CLI contract of both scripts.
 */
export const CANDIDATE_OWNED_PATHS: readonly string[] = ['.claude', '.augment', 'AGENTS.md', 'CLAUDE.md'];

/**
 * May a candidate mutation write this repo-relative path?
 *
 * Refuses absolute paths, empty paths, and any traversal segment — `..`
 * anywhere in the path is refused BEFORE the head component is inspected,
 * because `.claude/../src/x.ts` has an owned head and an unowned target.
 */
export function isCandidateOwnedPath(rel: string): boolean {
    if (rel === '' || rel.startsWith('/') || /^[A-Za-z]:[\\/]/.test(rel)) {
        return false;
    }
    const parts = rel.split(/[\\/]/).filter((p) => p !== '' && p !== '.');
    if (parts.length === 0 || parts.includes('..')) {
        return false;
    }
    const head = parts[0] as string;
    if (parts.length === 1) {
        return CANDIDATE_OWNED_PATHS.includes(head);
    }
    // A nested path is owned only when its head is an owned DIRECTORY. `AGENTS.md`
    // is a file, so `AGENTS.md/x` is not ownership, it is nonsense.
    return head === '.claude' || head === '.augment';
}

export class PathOwnershipError extends Error {
    readonly path: string;
    constructor(p: string) {
        super(
            `path ownership: '${p}' is outside the candidate surface ` +
                `(${CANDIDATE_OWNED_PATHS.join(', ')}). A candidate that writes a task-target ` +
                'file is not a harness variant — it is a different experiment, and the ' +
                'paired verdict would attribute its effect to the harness.',
        );
        this.name = 'PathOwnershipError';
        this.path = p;
    }
}

/** One file a candidate rewrites, and the bytes it writes. */
export interface Mutation {
    /** Repo-relative, inside {@link CANDIDATE_OWNED_PATHS}. */
    readonly path: string;
    readonly content: string;
}

/**
 * Refuse a mutation set that reaches outside the candidate surface.
 *
 * @throws {PathOwnershipError} on the first unowned path.
 */
export function assertMutationPathsOwned(mutations: readonly Mutation[]): void {
    for (const m of mutations) {
        if (!isCandidateOwnedPath(m.path)) {
            throw new PathOwnershipError(m.path);
        }
    }
}

// --- The records ------------------------------------------------------------

/**
 * A single candidate: exactly one primary dimension, one lifecycle state.
 *
 * `dimension` is a SCALAR and not an array. That is step 3.2's invariant
 * expressed in the type rather than in a validator, so the arity cannot be
 * violated by a caller that constructs the record in TypeScript and skips the
 * parser. The parser exists for the untrusted-input path (a JSON file), where
 * the type buys nothing.
 */
export interface CandidateRecord {
    readonly kind: 'candidate';
    readonly version: number;
    readonly id: string;
    readonly dimension: MutationDimension;
    readonly lifecycle: LifecycleState;
    readonly mutations: readonly Mutation[];
}

/**
 * A consolidation run: two or more dimensions, deliberately a DIFFERENT type.
 *
 * Step 3.2 requires this to be a distinct record type rather than a candidate
 * with a wider field, and the reason is not tidiness. A metric vector read per
 * candidate assumes single-dimension attribution; a multi-dimension record
 * flowing through the same reader would be read under that assumption and
 * silently mis-attributed. Two types make the mis-read a type error.
 *
 * `sourceCandidates` is required and must name at least two: a consolidation
 * with one source is that candidate, and with none it is a candidate that
 * evaded the arity rule by choosing the other type.
 */
export interface ConsolidationRecord {
    readonly kind: 'consolidation';
    readonly version: number;
    readonly id: string;
    readonly dimensions: readonly MutationDimension[];
    readonly lifecycle: LifecycleState;
    readonly sourceCandidates: readonly string[];
}

export class CandidateSchemaError extends Error {
    constructor(msg: string) {
        super(`candidate schema: ${msg}`);
        this.name = 'CandidateSchemaError';
    }
}

function asObject(input: unknown): Record<string, unknown> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        throw new CandidateSchemaError('record must be a JSON object');
    }
    return input as Record<string, unknown>;
}

function requireNonEmptyString(obj: Record<string, unknown>, key: string): string {
    const v = obj[key];
    if (typeof v !== 'string' || v.trim() === '') {
        throw new CandidateSchemaError(`'${key}' must be a non-empty string`);
    }
    return v;
}

function requireLifecycle(obj: Record<string, unknown>): LifecycleState {
    // Fail-closed and DELIBERATELY not defaulted. A record with no lifecycle is
    // refused rather than read as `proposed`, because a default is a value the
    // author did not choose, and every downstream reader would treat it as one
    // they did. Step 3.4 exists because `mutated` was once read as `accepted`.
    if (!('lifecycle' in obj)) {
        throw new CandidateSchemaError(
            "'lifecycle' is required and is never defaulted — an absent state is not 'proposed'",
        );
    }
    const v = obj['lifecycle'];
    if (!isLifecycleState(v)) {
        throw new CandidateSchemaError(
            `'lifecycle' must be one of ${LIFECYCLE_STATES.join(', ')} (got ${JSON.stringify(v)})`,
        );
    }
    return v;
}

function requireVersion(obj: Record<string, unknown>): number {
    const v = obj['version'];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
        throw new CandidateSchemaError("'version' must be a positive integer");
    }
    if (v > CANDIDATE_RECORD_VERSION) {
        throw new CandidateSchemaError(
            `record version ${String(v)} is newer than this build understands ` +
                `(${String(CANDIDATE_RECORD_VERSION)})`,
        );
    }
    return v;
}

function parseMutations(obj: Record<string, unknown>): readonly Mutation[] {
    const raw = obj['mutations'];
    if (!Array.isArray(raw)) {
        throw new CandidateSchemaError("'mutations' must be an array (use [] for none)");
    }
    const out: Mutation[] = [];
    for (const item of raw) {
        const m = asObject(item);
        const p = requireNonEmptyString(m, 'path');
        const content = m['content'];
        if (typeof content !== 'string') {
            throw new CandidateSchemaError(`mutation '${p}': 'content' must be a string`);
        }
        out.push({ path: p, content });
    }
    assertMutationPathsOwned(out);
    return out;
}

/**
 * Validate an untrusted candidate record — the REFUSING path.
 *
 * Rejects, in this order and each with its own message:
 *
 *   - `kind` that is not `'candidate'` (a consolidation record routed here);
 *   - a `dimensions` key at all — the plural is how a two-dimension candidate
 *     gets written, so it is refused by NAME rather than by counting values;
 *   - `dimension` supplied as an array, even a one-element one. An array is a
 *     field that can hold two, and step 3.2's invariant is about what the field
 *     CAN hold, not about what this instance happens to hold;
 *   - a `dimension` outside the three-member alphabet (step 3.3);
 *   - an absent or unrecognised `lifecycle` (step 3.4);
 *   - a mutation path outside the candidate surface.
 *
 * @throws {CandidateSchemaError} on the first violation.
 */
export function parseCandidateRecord(input: unknown): CandidateRecord {
    const obj = asObject(input);
    if (obj['kind'] !== 'candidate') {
        throw new CandidateSchemaError(
            `'kind' must be 'candidate' (got ${JSON.stringify(obj['kind'])}); a multi-dimension ` +
                "consolidation is the distinct 'consolidation' record type",
        );
    }
    const version = requireVersion(obj);
    const id = requireNonEmptyString(obj, 'id');
    if ('dimensions' in obj) {
        throw new CandidateSchemaError(
            "a candidate carries exactly ONE primary dimension, so it has no 'dimensions' field. " +
                "A run changing several dimensions is a 'consolidation' record, not a candidate — " +
                'if routing and content both change and the score moves, the credit is ambiguous',
        );
    }
    const dim = obj['dimension'];
    if (Array.isArray(dim)) {
        throw new CandidateSchemaError(
            "'dimension' must be a single string, not an array — a field that can hold two " +
                'dimensions violates the one-primary-dimension invariant even when it holds one',
        );
    }
    if (!isMutationDimension(dim)) {
        throw new CandidateSchemaError(
            `'dimension' must be one of ${MUTATION_DIMENSIONS.join(', ')} (got ${JSON.stringify(dim)}). ` +
                'Precedence, composition, verification, tool strategy, budget and scope are named ' +
                'and unimplemented until the three carry',
        );
    }
    const lifecycle = requireLifecycle(obj);
    const mutations = parseMutations(obj);
    return { kind: 'candidate', version, id, dimension: dim, lifecycle, mutations };
}

/**
 * Validate an untrusted consolidation record.
 *
 * Requires ≥2 DISTINCT dimensions and ≥2 source candidates. Both floors exist
 * so the second record type cannot be used as an escape hatch from the first:
 * a one-dimension "consolidation" is a candidate that chose the other type.
 *
 * @throws {CandidateSchemaError} on the first violation.
 */
export function parseConsolidationRecord(input: unknown): ConsolidationRecord {
    const obj = asObject(input);
    if (obj['kind'] !== 'consolidation') {
        throw new CandidateSchemaError(
            `'kind' must be 'consolidation' (got ${JSON.stringify(obj['kind'])})`,
        );
    }
    const version = requireVersion(obj);
    const id = requireNonEmptyString(obj, 'id');
    const raw = obj['dimensions'];
    if (!Array.isArray(raw)) {
        throw new CandidateSchemaError("'dimensions' must be an array of at least two dimensions");
    }
    for (const d of raw) {
        if (!isMutationDimension(d)) {
            throw new CandidateSchemaError(
                `'dimensions' member ${JSON.stringify(d)} is not one of ${MUTATION_DIMENSIONS.join(', ')}`,
            );
        }
    }
    const dimensions = [...new Set(raw as MutationDimension[])];
    if (dimensions.length < 2) {
        throw new CandidateSchemaError(
            'a consolidation touches at least two DISTINCT dimensions; with one it is a candidate, ' +
                'and routing it here would evade the one-primary-dimension invariant',
        );
    }
    const sources = obj['sourceCandidates'];
    if (!Array.isArray(sources) || sources.length < 2) {
        throw new CandidateSchemaError(
            "'sourceCandidates' must name at least two candidate ids — a consolidation of one " +
                'candidate is that candidate',
        );
    }
    for (const s of sources) {
        if (typeof s !== 'string' || s.trim() === '') {
            throw new CandidateSchemaError("'sourceCandidates' members must be non-empty strings");
        }
    }
    const lifecycle = requireLifecycle(obj);
    return { kind: 'consolidation', version, id, dimensions, lifecycle, sourceCandidates: sources as string[] };
}

/** What a structural read produced, and whether this build understood it. */
export interface CandidateReadResult {
    readonly kind: 'candidate';
    readonly version: number;
    readonly id: string;
    /** The raw value, which may not be in this build's alphabet. */
    readonly dimension: string;
    readonly lifecycle: LifecycleState;
    /** `true` when `dimension` is outside {@link MUTATION_DIMENSIONS}. */
    readonly unknownDimension: boolean;
}

/**
 * Read a historical candidate record WITHOUT refusing an unknown dimension.
 *
 * This is the forward-compatibility half of the E10 split. If the alphabet ever
 * grows to four, every record authored under the three-member alphabet still
 * parses here, and every record authored under a four-member alphabet still
 * READS on a three-member build — flagged, not thrown.
 *
 * The refusal stays in {@link parseCandidateRecord}, which is what a RUN calls.
 * So an unknown dimension cannot enter a run, and cannot make an archive
 * unreadable. Those are different failures and this is where they are kept
 * apart.
 *
 * Everything else is still validated: `kind`, `version`, `id` and `lifecycle`
 * are structural, not alphabet-dependent, and a record missing one of them is
 * malformed under every alphabet. In particular an absent `lifecycle` is still
 * refused here — a reader that invented a state would reintroduce exactly the
 * `mutated`-read-as-`accepted` defect step 3.4 exists for.
 *
 * @throws {CandidateSchemaError} on a structural violation.
 */
export function readCandidateRecord(input: unknown): CandidateReadResult {
    const obj = asObject(input);
    if (obj['kind'] !== 'candidate') {
        throw new CandidateSchemaError(`'kind' must be 'candidate' (got ${JSON.stringify(obj['kind'])})`);
    }
    const version = requireVersion(obj);
    const id = requireNonEmptyString(obj, 'id');
    const dim = obj['dimension'];
    if (typeof dim !== 'string' || dim.trim() === '') {
        throw new CandidateSchemaError("'dimension' must be a non-empty string");
    }
    const lifecycle = requireLifecycle(obj);
    return { kind: 'candidate', version, id, dimension: dim, lifecycle, unknownDimension: !isMutationDimension(dim) };
}

/** Serialise a candidate record for the clone manifest. Key order is stable. */
export function candidateRecordToJson(record: CandidateRecord): Record<string, unknown> {
    return {
        kind: record.kind,
        version: record.version,
        id: record.id,
        dimension: record.dimension,
        lifecycle: record.lifecycle,
        mutations: record.mutations.map((m) => ({ path: m.path, content: m.content })),
    };
}
