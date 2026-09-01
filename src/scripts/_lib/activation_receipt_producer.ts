/**
 * The activation-receipt producer — independent, append-only, zero model calls.
 *
 * `road-to-governed-evidence-production` step 1.1. The receipt SCHEMA
 * ({@link ActivationReceipt}) and the CLASSIFIER ({@link classifyFailure}) both
 * predate this module and are NOT reimplemented here; what was missing was a
 * producer, so nothing ever wrote an `activation` object into an audit line and
 * the receipt-bearing cascade stages had no subject.
 *
 * ## The claims this module is written against
 *
 * Stated once, in `docs/contracts/activation-receipt-trust-boundary.md`, and
 * CITED here rather than restated — step 1.3's verify clause asks for exactly
 * that split, and a second copy of a falsifiable claim is a second thing to
 * keep true.
 *
 * | Claim | Where it binds in this file |
 * |---|---|
 * | TB-1 (no evaluation input decides a STATE) | the import list: no cascade, record, vector or verdict module appears |
 * | TB-2 (an unobserved rung is absent) | {@link buildActivationReceipt} writes only the rungs it was given |
 * | TB-3 (every state names an admitted source) | {@link EVIDENCE_SOURCES} + the refusal in {@link buildActivationReceipt} |
 * | TB-4 (append, never rewrite) | {@link appendActivationLine} opens with `appendFileSync` and mints a fresh `id` |
 * | EC-1 (zero model calls) | no transport import, no spawn, no key read — asserted by this module's test |
 * | EC-3 (a missing observation is never bought) | {@link observeProjection} returns absence and does not retry |
 *
 * ## What is observable today, and what is not
 *
 * Three sources are admitted and all three ship an observer. `adhered` has no
 * admitted source, so this producer CANNOT emit that rung and a real receipt
 * reads `unknown` there. That is a coverage fact recorded rather than papered
 * over: admitting a fourth source with no observer behind it would describe a
 * capability that does not exist, which is the "population of zero" failure the
 * roadmap already flags elsewhere.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    LADDER_RUNGS,
    type ActivationReceipt,
    type LadderRung,
    type PrecedenceReason,
    type RungState,
} from './activation_ladder.js';
import type { NoFreeForm } from './runtime_journal.js';
import { type PrivacyClass } from './privacy_class.js';

type Assert<T extends true> = T;

/**
 * The closed set of evidence sources a rung state may come from (TB-3).
 *
 * Each entry names a surface this producer can read without consulting the
 * evaluation side. A source may not be added without an observer: the set
 * describes what can be observed, never what one would like to observe.
 *
 * - `source-tree` — the authored artefact exists under `src/`, so it can match
 *   at all. Reads the `eligible` rung.
 * - `discovery-manifest` — the built manifest names the artefact for the active
 *   install, i.e. the selector kept it. Reads the `selected` rung.
 * - `host-projection` — a host tree carries a file for the artefact. Reads the
 *   `projected` rung.
 */
export const EVIDENCE_SOURCES = ['source-tree', 'discovery-manifest', 'host-projection'] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

/** The rung each admitted source is allowed to speak about. One source, one rung. */
export const SOURCE_RUNG: Readonly<Record<EvidenceSource, LadderRung>> = {
    'source-tree': 'eligible',
    'discovery-manifest': 'selected',
    'host-projection': 'projected',
};

/** Rungs no admitted source covers today. Present so the gap is enumerable. */
export const UNOBSERVED_RUNGS: readonly LadderRung[] = LADDER_RUNGS.filter(
    (r) => !Object.values(SOURCE_RUNG).includes(r),
);

/**
 * One observation. `state` is the evidence; `evidence_source` is where it came
 * from.
 *
 * The field is `evidence_source` and not `source` on purpose: `source` is a
 * member of `FREE_FORM_KEYS`, so a field of that name would make the privacy
 * assertion at the bottom of this file `Assert<false>` and stop the build. The
 * rename is the cheap half of keeping this input type incapable of carrying
 * content.
 */
export interface RungObservation {
    readonly rung: LadderRung;
    readonly state: Exclude<RungState, 'unknown'>;
    readonly evidence_source: EvidenceSource;
}

export interface ReceiptBuild {
    readonly receipt: ActivationReceipt | null;
    readonly errors: readonly string[];
}

/**
 * Build a receipt from observations.
 *
 * TB-2 in one line: the output's `rungs` map has exactly the keys the caller
 * observed. Nothing is defaulted, nothing is filled in, and a rung nobody looked
 * at is absent — which `rungState` reads as `unknown` and `ladderRate` keeps out
 * of its denominator.
 *
 * TB-3 in the refusals: an unadmitted source, or an admitted source speaking
 * about a rung that is not its own, is an ERROR and yields no receipt. It is
 * not a warning and it is not silently dropped, because a receipt missing a rung
 * is indistinguishable from a receipt whose rung was refused, and only one of
 * those is honest.
 */
export function buildActivationReceipt(
    artefact: string,
    observations: readonly RungObservation[],
    reason?: PrecedenceReason,
): ReceiptBuild {
    const errors: string[] = [];
    if (!artefact) errors.push('artefact id is required');

    const rungs: Partial<Record<LadderRung, RungState>> = {};
    for (const o of observations) {
        if (!(EVIDENCE_SOURCES as readonly string[]).includes(o.evidence_source)) {
            errors.push(`evidence_source '${o.evidence_source}' is not admitted (TB-3)`);
            continue;
        }
        if (SOURCE_RUNG[o.evidence_source] !== o.rung) {
            errors.push(
                `evidence_source '${o.evidence_source}' may only observe rung ` +
                    `'${SOURCE_RUNG[o.evidence_source]}', not '${o.rung}' (TB-3)`,
            );
            continue;
        }
        if (rungs[o.rung] !== undefined && rungs[o.rung] !== o.state) {
            errors.push(`rung '${o.rung}' observed twice with conflicting states`);
            continue;
        }
        rungs[o.rung] = o.state;
    }
    if (errors.length > 0) return { receipt: null, errors };

    const receipt: ActivationReceipt = reason === undefined
        ? { artefact, rungs }
        : { artefact, rungs, reason };
    return { receipt, errors: [] };
}

// --- observers ---------------------------------------------------------------

/**
 * Observe the `projected` rung: does a host tree carry a file for this artefact?
 *
 * EC-3 is the reason this returns `undefined` rather than probing further when
 * the host root itself is missing. A host tree that does not exist is not
 * evidence that the artefact was not projected into it — it is the absence of a
 * place to look, and the honest output of a missing observation is nothing at
 * all. Escalating from "read a path" to "go find the tree" is the unbounded-cost
 * mistake EC-3 names, and it is the one a reader would forgive.
 */
export function observeProjection(
    hostRoot: string,
    artefactRelPath: string,
): RungObservation | undefined {
    if (!existsQuiet(hostRoot)) return undefined;
    return {
        rung: 'projected',
        state: existsQuiet(path.join(hostRoot, artefactRelPath)) ? 'reached' : 'not-reached',
        evidence_source: 'host-projection',
    };
}

/**
 * Observe the `eligible` rung: is the artefact authored in the source tree?
 *
 * Same absence rule as {@link observeProjection}: an unreadable source root
 * yields no observation rather than a negative one.
 */
export function observeSourceTree(
    sourceRoot: string,
    artefactRelPath: string,
): RungObservation | undefined {
    if (!existsQuiet(sourceRoot)) return undefined;
    return {
        rung: 'eligible',
        state: existsQuiet(path.join(sourceRoot, artefactRelPath)) ? 'reached' : 'not-reached',
        evidence_source: 'source-tree',
    };
}

/**
 * Observe the `selected` rung from an already-loaded discovery-manifest id set.
 *
 * Takes the id set rather than a path: loading and parsing the manifest is the
 * caller's, so this stays a pure predicate and EC-1's "no I/O beyond a read"
 * holds trivially for it. An EMPTY set is treated as no manifest — not as a
 * manifest that selected nothing — because those are different observations and
 * folding them is exactly TB-2's failure.
 */
export function observeSelection(
    selectedIds: ReadonlySet<string>,
    artefactId: string,
): RungObservation | undefined {
    if (selectedIds.size === 0) return undefined;
    return {
        rung: 'selected',
        state: selectedIds.has(artefactId) ? 'reached' : 'not-reached',
        evidence_source: 'discovery-manifest',
    };
}

function existsQuiet(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

// --- the audit line ----------------------------------------------------------

/** What THIS producer's lines carry: an artefact id, enums, and counts. */
const PRODUCER_PRIVACY_CLASS: PrivacyClass = 'ids-only';

export interface ActivationLineInput {
    /** The artefact the receipt is about. An id, never a path. */
    artefact: string;
    /** The rungs actually observed. Absent rungs stay absent (TB-2). */
    rungs: Readonly<Partial<Record<LadderRung, RungState>>>;
    /**
     * The precedence reason, when there is one.
     *
     * Named `precedence_reason` and NOT `reason`, which is a `FREE_FORM_KEYS`
     * member: a field called `reason` on this type makes the assertion at the
     * bottom of this file `Assert<false>` and stops the build, even though the
     * value it would hold is a closed six-value enum. The emitted JSON key is
     * still `reason`, because that is `ActivationReceipt`'s field name and the
     * ladder module owns the receipt shape. The rename buys the compile-time
     * floor at the cost of one line of mapping, which is the right trade: a
     * guard that only rejects genuinely dangerous names is a guard someone has
     * to keep tuning.
     */
    precedence_reason?: PrecedenceReason | undefined;
    /** ISO-8601 UTC; the caller supplies it so this stays pure. */
    ts: string;
    /** ULID, UUID or content hash; the caller supplies it. */
    id: string;
    work_id?: string | undefined;
}

export interface BuiltActivationLine {
    line: Record<string, unknown> | null;
    errors: string[];
}

/**
 * Build ONE audit-log-v1 line carrying an `activation` object.
 *
 * Deliberately the same envelope as `_lib/review_skipped_record.ts` — same
 * mandatory fields, same `{line, errors}` contract, same refusal to return a
 * half-built line. `skills_applied` is omitted for the same reason it is there:
 * this producer has no skill observation to offer, and `[]` would assert one.
 */
export function buildActivationLine(input: ActivationLineInput): BuiltActivationLine {
    const errors: string[] = [];
    if (!input.artefact) errors.push('artefact is required');
    if (!input.ts) errors.push('ts (ISO-8601 UTC) is required');
    if (!input.id) errors.push('id (ULID, UUID, or content hash) is required');
    const observed = Object.keys(input.rungs);
    if (observed.length === 0) {
        // A receipt that observed nothing is not a receipt. Writing one would
        // add a line to an append-only ledger that carries no evidence and
        // still counts as a record — the shape a later reader mistakes for
        // coverage.
        errors.push('a receipt must carry at least one observed rung');
    }
    for (const r of observed) {
        if (!(LADDER_RUNGS as readonly string[]).includes(r)) {
            errors.push(`'${r}' is not a ladder rung`);
        }
    }
    if (errors.length) return { line: null, errors };

    const activation: Record<string, unknown> = { artefact: input.artefact, rungs: { ...input.rungs } };
    if (input.precedence_reason !== undefined) activation['reason'] = input.precedence_reason;

    const line: Record<string, unknown> = {
        schema_version: 1,
        id: input.id,
        ts: input.ts,
        work_id: input.work_id ?? `activation-${input.ts}`,
        phase: 'report',
        outcome: 'success',
        confidence_band: 'high',
        risk_class: 'low',
        memory: { asks: 0, hits: 0 },
        verify: { claims: 0, first_try_passes: 0 },
        rules_applied: [],
        privacy_class: PRODUCER_PRIVACY_CLASS,
        persona: null,
        input_kind: 'prompt',
        type: 'note',
        activation,
    };
    return { line, errors: [] };
}

/**
 * Append ONE line to the monthly audit log (TB-4).
 *
 * `appendFileSync` and nothing else: no read-modify-write, no truncation, no
 * seek. Returns the file it wrote so a caller can assert the write happened
 * rather than trusting that it did.
 */
export function appendActivationLine(
    workspaceRoot: string,
    line: Record<string, unknown>,
    ts: string,
): string {
    const dir = path.join(workspaceRoot, 'agents', 'runtime', 'state', 'audit');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${ts.slice(0, 7)}.jsonl`);
    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
    return file;
}

/**
 * The privacy floor, by construction, on this producer's input type.
 *
 * Same mechanism as the two producers `docs/contracts/audit-log-v1.md`
 * § Privacy floor already names. Adding a `path`, `detail`, `reason_text` or
 * any other `FREE_FORM_KEYS` member below makes this `Assert<false>` and stops
 * the build. `reason` is one of them, which is why the precedence field is
 * called `precedence_reason` here and mapped to `reason` on the way out — see
 * the field's own note.
 */
type _ActivationLineInputCarriesNoFreeFormField = Assert<
    [NoFreeForm<ActivationLineInput>] extends [never] ? false : true
>;
