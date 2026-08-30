/**
 * The deterministic candidate proposer — fixed recipes, no model in the loop.
 *
 * `road-to-governed-harness-evolution` Phase 3, step 3.5.
 *
 * > *Ship a deterministic proposer first. Fixed recipes for known defect
 * > classes, so the loop is validated without model quality as a confound.*
 * > verify: **the same input produces byte-identical candidates across two
 * > runs.**
 *
 * The seam this plugs into already existed: `bench_ab_clone --candidate-record`
 * consumes a validated candidate record file, so a proposer's whole job is to
 * PRODUCE those files. Nothing here materialises a clone, spawns a process, or
 * calls a model.
 *
 * ## What is being claimed, and what is not
 *
 * Claimed: the mapping from an observation set to a byte string is a pure
 * function of that set plus the subject bytes it reads. Two runs over the same
 * input produce the same bytes, on any machine, in any order, at any time.
 *
 * NOT claimed: that these three recipes improve anything. Whether a candidate
 * is better than the baseline is the paired verdict's question in Phase 4, and
 * a proposer that asserted its own efficacy would be answering it in the wrong
 * place. The recipes are deliberately blunt, total, and idempotent — that is
 * what makes them a control condition rather than a competitor.
 *
 * ## The four things that would break determinism, and where each is closed
 *
 *   1. **Wall-clock.** No timestamp is written into a record, and the id is not
 *      derived from one. {@link candidateId} hashes content.
 *   2. **Filesystem iteration order.** The proposer never reads a directory.
 *      Its input is an explicit, ordered list; {@link proposeCandidates} sorts
 *      it before emitting.
 *   3. **Locale-dependent ordering.** Every sort here is a byte-wise comparison
 *      via {@link byteCompare}. `String.prototype.localeCompare` is deliberately
 *      not used — it is ICU-dependent, so two machines can disagree about the
 *      order of two ids and produce two different files.
 *   4. **Object key order.** {@link serialiseCandidateRecord} routes through
 *      `candidateRecordToJson`, which fixes key order in one place.
 *
 * A fifth would be randomness or a counter; there is neither.
 */

import { createHash } from 'node:crypto';

import {
    CANDIDATE_RECORD_VERSION,
    type CandidateRecord,
    CandidateSchemaError,
    type Mutation,
    type MutationDimension,
    assertMutationPathsOwned,
    candidateRecordToJson,
    isCandidateOwnedPath,
} from './candidate_record.js';

// --- The defect classes -----------------------------------------------------

/**
 * The three defect classes with a fixed recipe, one per mutation dimension.
 *
 * One per dimension is not a coincidence and is not a rule either: it is what
 * makes the first proposer exercise all three arms of the alphabet step 3.3
 * fixed. A fourth class would be legal as long as it lands on one of the three
 * dimensions; a class needing a fourth DIMENSION is refused upstream by
 * `parseCandidateRecord`, not here.
 */
export const DEFECT_CLASSES = [
    'over-broad-activation',
    'unrouted-obligation',
    'unbacked-enforcement-claim',
] as const;
export type DefectClass = (typeof DEFECT_CLASSES)[number];

export function isDefectClass(v: unknown): v is DefectClass {
    return typeof v === 'string' && (DEFECT_CLASSES as readonly string[]).includes(v);
}

/** The pointer a truncated artefact carries, so the mutation is not a silent deletion. */
export const BAND_POINTER =
    '<!-- candidate: leading band only; the full artefact is unchanged in the baseline clone -->';

/** The fixed honest-enforcement block the content recipe appends. */
export const HONEST_ENFORCEMENT_BLOCK =
    '## Honest enforcement\n\n' +
    'Nothing observes whether this obligation was met. It is model-carried, and\n' +
    'saying so is cheaper than a check that would have to guess.';

/**
 * One fixed recipe: a defect class, the dimension it mutates, and a TOTAL,
 * IDEMPOTENT rewrite of the subject's bytes.
 *
 * Total: defined for every string, including the empty one. A recipe that can
 * fail on some input makes the proposer's output depend on which subjects
 * happen to be well-formed, which is a second determinism hazard wearing the
 * costume of a validation error.
 *
 * Idempotent: `rewrite(rewrite(x)) === rewrite(x)`. Pinned by a test rather
 * than by a comment, because it is the property that lets the same observation
 * be re-proposed after a partial run without producing a different id.
 */
export interface Recipe {
    readonly defectClass: DefectClass;
    readonly dimension: MutationDimension;
    /** Why this class is a defect, in one line, for the `explain` verb. */
    readonly summary: string;
    /** Does this class require an explicit route target on the observation? */
    readonly needsRouteTo: boolean;
    readonly rewrite: (body: string, routeTo: string) => string;
}

/**
 * Keep the leading band, drop the rest.
 *
 * The band is everything before the first `## ` heading — this tree's own
 * "rich artifacts lead with a non-negotiable band" shape. An artefact with no
 * `## ` heading is already all band, so it comes back unchanged apart from the
 * pointer.
 *
 * This is an ACTIVATION mutation and not a content one: it changes how much of
 * the artefact is delivered per session, not what the delivered part says. The
 * two are easy to confuse, which is exactly why step 3.2 refuses a candidate
 * that does both.
 */
export function keepLeadingBand(body: string): string {
    if (body.includes(BAND_POINTER)) {
        return body;
    }
    const lines = body.split('\n');
    let cut = lines.length;
    for (let i = 0; i < lines.length; i += 1) {
        if ((lines[i] as string).startsWith('## ')) {
            cut = i;
            break;
        }
    }
    const band = lines.slice(0, cut).join('\n').replace(/\s+$/, '');
    return `${band}\n\n${BAND_POINTER}\n`;
}

/**
 * Append a route pointer naming where the obligation is discharged.
 *
 * The target comes from the observation, never from the subject's name. A
 * proposer that guessed the route target from a filename would be inventing a
 * claim about the tree, and an invented route reads exactly like a verified one
 * once it is in the file.
 */
export function appendRoutePointer(body: string, routeTo: string): string {
    const line = `- Routed to \`${routeTo}\` — the obligation above is discharged there.`;
    if (body.includes(line)) {
        return body;
    }
    return `${body.replace(/\s+$/, '')}\n\n## See also\n\n${line}\n`;
}

/** Append the fixed honest-enforcement block, once. */
export function appendHonestEnforcement(body: string): string {
    if (body.includes(HONEST_ENFORCEMENT_BLOCK)) {
        return body;
    }
    return `${body.replace(/\s+$/, '')}\n\n${HONEST_ENFORCEMENT_BLOCK}\n`;
}

export const RECIPES: Readonly<Record<DefectClass, Recipe>> = {
    'over-broad-activation': {
        defectClass: 'over-broad-activation',
        dimension: 'activation',
        summary:
            'the whole artefact is delivered every session when only its leading band is load-bearing',
        needsRouteTo: false,
        rewrite: (body) => keepLeadingBand(body),
    },
    'unrouted-obligation': {
        defectClass: 'unrouted-obligation',
        dimension: 'routing',
        summary: 'the artefact states an obligation and names no artefact that discharges it',
        needsRouteTo: true,
        rewrite: (body, routeTo) => appendRoutePointer(body, routeTo),
    },
    'unbacked-enforcement-claim': {
        defectClass: 'unbacked-enforcement-claim',
        dimension: 'content',
        summary: 'the artefact reads as enforced while nothing can observe a violation',
        needsRouteTo: false,
        rewrite: (body) => appendHonestEnforcement(body),
    },
};

// --- Observations -----------------------------------------------------------

/**
 * One observed defect: which class, which artefact, and (for `routing`) where
 * the obligation is discharged.
 *
 * `subject` is repo-relative and must sit inside the candidate surface. That is
 * checked HERE as well as in `parseCandidateRecord` and again in
 * `apply_candidate_mutations`, because a proposer that emits an out-of-surface
 * mutation has already written a bad record to disk by the time the clone
 * refuses it, and an operator then holds a file that no verb will accept.
 */
export interface DefectObservation {
    readonly defectClass: DefectClass;
    readonly subject: string;
    readonly routeTo?: string;
}

function requireString(obj: Record<string, unknown>, key: string): string {
    const v = obj[key];
    if (typeof v !== 'string' || v.trim() === '') {
        throw new CandidateSchemaError(`observation '${key}' must be a non-empty string`);
    }
    return v;
}

/**
 * Validate an untrusted observation list — the REFUSING path.
 *
 * Refuses, each with its own message: a non-array input; a class outside
 * {@link DEFECT_CLASSES}; a subject outside the candidate surface; a missing
 * `routeTo` on a class whose recipe needs one; a `routeTo` on a class whose
 * recipe does not read it; and a duplicate `(defectClass, subject)` pair.
 *
 * The duplicate refusal is load-bearing rather than tidy: a duplicate pair
 * hashes to the same id, so it would write the same filename twice. Silently
 * de-duplicating would make the count of proposed candidates depend on the
 * input's redundancy, and refusing says so.
 *
 * @throws {CandidateSchemaError} on the first violation.
 */
export function parseObservations(input: unknown): DefectObservation[] {
    if (!Array.isArray(input)) {
        throw new CandidateSchemaError(
            'observations must be a JSON array of {defectClass, subject[, routeTo]} objects',
        );
    }
    const out: DefectObservation[] = [];
    const seen = new Set<string>();
    for (const item of input) {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
            throw new CandidateSchemaError('each observation must be a JSON object');
        }
        const obj = item as Record<string, unknown>;
        const cls = requireString(obj, 'defectClass');
        if (!isDefectClass(cls)) {
            throw new CandidateSchemaError(
                `'defectClass' must be one of ${DEFECT_CLASSES.join(', ')} (got ${JSON.stringify(cls)}). ` +
                    'A class with no fixed recipe has no deterministic proposal, and inventing one ' +
                    'is the model-quality confound this step exists to remove',
            );
        }
        const subject = requireString(obj, 'subject');
        if (!isCandidateOwnedPath(subject)) {
            throw new CandidateSchemaError(
                `observation subject '${subject}' is outside the candidate surface — a proposal ` +
                    'that rewrites a task-target file is a different experiment, not a harness variant',
            );
        }
        const key = `${cls} ${subject}`;
        if (seen.has(key)) {
            throw new CandidateSchemaError(
                `duplicate observation (${cls}, ${subject}) — it hashes to one candidate id, so the ` +
                    'second would silently overwrite the first',
            );
        }
        seen.add(key);
        const recipe = RECIPES[cls];
        if (recipe.needsRouteTo) {
            out.push({ defectClass: cls, subject, routeTo: requireString(obj, 'routeTo') });
        } else {
            if ('routeTo' in obj) {
                throw new CandidateSchemaError(
                    `observation (${cls}, ${subject}) carries 'routeTo', which only the routing ` +
                        'recipe reads. An ignored field is an instruction the operator believes was followed',
                );
            }
            out.push({ defectClass: cls, subject });
        }
    }
    return out;
}

// --- Proposing --------------------------------------------------------------

/** Reads a repo-relative subject's current bytes. Injected so tests need no tree. */
export type SubjectReader = (subject: string) => string;

/** Byte-wise, locale-independent string order. Never `localeCompare`. */
export function byteCompare(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

/** Short, stable per-dimension id tag, so an id says which arm it sits on. */
const DIMENSION_TAG: Readonly<Record<MutationDimension, string>> = {
    activation: 'act',
    routing: 'rou',
    content: 'con',
};

/**
 * The candidate id: a content hash, never a counter and never a clock.
 *
 * Hashed inputs are the defect class, the subject, and the exact bytes each
 * mutation writes. Two consequences worth stating because both are relied on:
 * re-proposing an unchanged observation over an unchanged tree yields the SAME
 * id (so `run --refresh` rebuilds the same clone rather than accumulating
 * near-duplicates), and a changed subject yields a DIFFERENT id (so a candidate
 * built from stale bytes cannot be mistaken for one built from current bytes).
 *
 * Twelve hex characters is 48 bits. At the roadmap's exit-criterion scale —
 * five candidates — a collision is ~5e-13 likely; the id is a directory name,
 * not a security boundary, and `bench_ab_clone` refuses a repeated id outright
 * rather than merging two candidates into one clone.
 */
export function candidateId(
    defectClass: DefectClass,
    subject: string,
    mutations: readonly Mutation[],
): string {
    const h = createHash('sha256');
    h.update(defectClass);
    h.update(' ');
    h.update(subject);
    for (const m of [...mutations].sort((x, y) => byteCompare(x.path, y.path))) {
        h.update(' ');
        h.update(m.path);
        h.update(' ');
        h.update(m.content);
    }
    return `${DIMENSION_TAG[RECIPES[defectClass].dimension]}-${h.digest('hex').slice(0, 12)}`;
}

/**
 * Turn observations into candidate records. Pure given the same reader.
 *
 * Ordering is fixed EXACTLY ONCE, here, on the input. There is deliberately no
 * second sort of the output: a run of the seen-red sweep showed that with the
 * input sorted, neutralising an output sort changed nothing observable — it was
 * a guard whose red could not be produced, which is indistinguishable from a
 * guard that does not work. One ordering site, one guard, one red.
 *
 * Two properties follow from that single sort, and they are tested separately
 * because they are different failures: the RETURNED order is independent of the
 * caller's order, and the order subjects are READ in is too (read order is
 * observable — with a throwing reader it decides whose error message surfaces).
 *
 * Every emitted record is `lifecycle: 'proposed'`, with no way to ask for
 * another state. A proposer that could emit `promotion-eligible` would be
 * grading its own output, which is the confusion step 3.4's lifecycle enum
 * exists to make impossible.
 *
 * @throws {CandidateSchemaError} if a recipe produces an out-of-surface mutation.
 */
export function proposeCandidates(
    observations: readonly DefectObservation[],
    read: SubjectReader,
): CandidateRecord[] {
    const ordered = [...observations].sort(
        (a, b) => byteCompare(a.defectClass, b.defectClass) || byteCompare(a.subject, b.subject),
    );
    const records: CandidateRecord[] = [];
    for (const obs of ordered) {
        const recipe = RECIPES[obs.defectClass];
        const before = read(obs.subject);
        const after = recipe.rewrite(before, obs.routeTo ?? '');
        const mutations: Mutation[] = [{ path: obs.subject, content: after }];
        assertMutationPathsOwned(mutations);
        records.push({
            kind: 'candidate',
            version: CANDIDATE_RECORD_VERSION,
            id: candidateId(obs.defectClass, obs.subject, mutations),
            dimension: recipe.dimension,
            lifecycle: 'proposed',
            mutations,
        });
    }
    return records;
}

/**
 * The bytes written for one record.
 *
 * Two-space indent plus one trailing newline, matching what `bench_ab_clone`
 * writes into the clone. The byte-identity acceptance test compares the output
 * of THIS function, so the serialiser is part of the determinism claim rather
 * than an incidental formatting choice at the call site.
 */
export function serialiseCandidateRecord(record: CandidateRecord): string {
    return `${JSON.stringify(candidateRecordToJson(record), null, 2)}\n`;
}

/** `<id>.json` — the filename a record is written under. */
export function candidateRecordFilename(record: CandidateRecord): string {
    return `${record.id}.json`;
}
