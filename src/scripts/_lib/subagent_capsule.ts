/**
 * Worker-generation CHECKPOINT capsule (road-to-worker-generation-recycling, Phase 0).
 *
 * Pure, no-I/O. The structured state a worker emits BELOW its stop-loss
 * watermark so a successor generation can continue the SAME task from the
 * capsule alone — never from the transcript, never from an orchestrator-written
 * re-brief. Today a worker that reaches `max_tokens_per_worker` is killed
 * (`worker_budget.ts`) and its partial result returns as a `BLOCKED` envelope;
 * there is no handoff. This is the handoff shape.
 *
 * TRANSCRIPT-EXCLUSION BY CONSTRUCTION: every field is a ref token, a single
 * short line, or a count — there is NO field capable of holding a transcript,
 * a file body, or prose at length, and the per-array caps mean a capsule cannot
 * become one by accumulation either. This is not stylistic. A capsule that
 * could smuggle raw context would make the successor's brief unmeasurable,
 * which is the whole question the roadmap's claim asks. Do not add a free-form
 * field. (Same principle as `orchestration_record.ts` for telemetry and
 * `domain-safety-pii` § Surface 2 for logs.)
 *
 * Contract: `src/agent-src/contexts/execution/subagent-response-contract.md`
 * Wire format: `src/skills/subagent-orchestration/schemas/subagent-status.json`
 */

/**
 * Epistemic vocabulary for `assumptions[].epistemic_state` — pinned ONCE, here,
 * to the three Evidence-Report buckets already in use for docs and discovery
 * (`evidence-discipline.md` § Evidence Report). A capsule that graded its
 * assumptions on a private scale would fork the vocabulary the rest of the
 * suite reasons in, so it does not get one.
 *
 * - `verified` — confirmed against a real source during THIS worker generation.
 * - `assumed`  — taken as a premise, not confirmed; explicitly a hypothesis.
 * - `gap`      — known missing evidence the task needs.
 */
export const EPISTEMIC_STATES = ['verified', 'assumed', 'gap'] as const;
export type EpistemicState = (typeof EPISTEMIC_STATES)[number];

const EPISTEMIC: ReadonlySet<string> = new Set<string>(EPISTEMIC_STATES);

/** Max chars for a ref token (`file:line`, id, path). Mirrors the spawn contract. */
export const MAX_REF_CHARS = 200;
/** Max chars for one capsule sentence. A paragraph does not fit; that is the point. */
export const MAX_LINE_CHARS = 240;
/** Max entries per capsule array. A transcript cannot be reached by accumulation. */
export const MAX_ENTRIES = 40;

/** One stated premise the successor generation inherits instead of re-deriving. */
export interface CapsuleAssumption {
    /** The premise, one line. */
    statement: string;
    /** What it rests on — a ref token (`file:line`, id, path, command). */
    basis: string;
    /** How well it is established. See {@link EPISTEMIC_STATES}. */
    epistemic_state: EpistemicState;
}

/**
 * The capsule a worker emits at its watermark. Rides as the body of a
 * `CHECKPOINT` envelope (`subagent-status.json`).
 */
export interface WorkerCapsule {
    /** One- or two-sentence outcome so far. */
    summary: string;
    /** Generation index in the chain; the first dispatch is 1. */
    generation: number;
    /** What is finished — ref tokens, never bodies. */
    done: string[];
    /** What is left, one short line each. */
    remaining: string[];
    /** Choices already made that the successor must not silently re-open. */
    decisions: string[];
    /** Known risks still open. */
    open_risks: string[];
    /** Files this generation touched — paths / `file:line`, never diffs. */
    touched_files: string[];
    /**
     * Stated premises. Unstated assumptions are the first thing compression
     * drops, which makes them the most likely mechanism behind a degraded
     * capsule — the field gives the successor a target list instead of
     * implicit premises.
     */
    assumptions: CapsuleAssumption[];
}

/**
 * Capsule schema version (road-to-token-economy-recycling Phase 2.1).
 * Versioning is INTRODUCED here — the Phase-0 worker capsule shipped
 * unversioned and stays valid without a version field (implicit v1, wire
 * shape unchanged, `subagent-status.json` untouched). Version 2 adds the
 * explicit `capsule_version` + `variant` discriminator that the
 * main-session recycle envelope requires. Policy: additive only — a new
 * version may add fields or variants, never repurpose or remove one; both
 * variants validate through THIS module (one schema file, one validator
 * family — roadmap 5.6's anti-fork rule).
 */
export const CAPSULE_SCHEMA_VERSION = 2;

/** The two CHECKPOINT variants sharing this schema. */
export const CAPSULE_VARIANTS = ['worker', 'main_session'] as const;
export type CapsuleVariant = (typeof CAPSULE_VARIANTS)[number];

/** A single-line token no longer than `max` chars. Rejects any body-shaped value. */
function isShortLine(value: unknown, max: number): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= max && !value.includes('\n');
}

function checkList(
    errors: string[],
    field: string,
    value: unknown,
    max: number,
    required: boolean,
): void {
    if (value === undefined) {
        if (required) errors.push(`${field} is required`);
        return;
    }
    if (!Array.isArray(value)) {
        errors.push(`${field} must be an array`);
        return;
    }
    if (value.length > MAX_ENTRIES) {
        errors.push(`${field} carries ${value.length} entries (max ${MAX_ENTRIES}) — a capsule is a handoff, not a transcript`);
    }
    const bad = value.filter((x) => !isShortLine(x, max));
    if (bad.length > 0) {
        errors.push(
            `${field} carries ${bad.length} entr${bad.length === 1 ? 'y' : 'ies'} that are not single lines of ≤ ${max} chars (refs and short lines only, never bodies)`,
        );
    }
}

/**
 * Validate a capsule body. Returns the list of violations (empty = valid).
 *
 * The orchestrator never briefs a successor from an invalid capsule — an
 * invalid capsule falls back to today's stop-loss behaviour, loudly.
 */
export function validateCapsule(input: unknown): string[] {
    const errors: string[] = [];
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return ['not an object'];
    }
    const c = input as Record<string, unknown>;

    if (!isShortLine(c['summary'], MAX_LINE_CHARS)) {
        errors.push(`summary must be a single line of 1–${MAX_LINE_CHARS} chars`);
    }

    const generation = c['generation'];
    if (typeof generation !== 'number' || !Number.isInteger(generation) || generation < 1) {
        errors.push('generation must be an integer ≥ 1 (the first dispatch is generation 1)');
    }

    checkList(errors, 'done', c['done'], MAX_REF_CHARS, true);
    checkList(errors, 'remaining', c['remaining'], MAX_LINE_CHARS, true);
    checkList(errors, 'decisions', c['decisions'], MAX_LINE_CHARS, false);
    checkList(errors, 'open_risks', c['open_risks'], MAX_LINE_CHARS, false);
    checkList(errors, 'touched_files', c['touched_files'], MAX_REF_CHARS, false);

    const assumptions = c['assumptions'];
    if (assumptions !== undefined) {
        if (!Array.isArray(assumptions)) {
            errors.push('assumptions must be an array');
        } else {
            if (assumptions.length > MAX_ENTRIES) {
                errors.push(`assumptions carries ${assumptions.length} entries (max ${MAX_ENTRIES})`);
            }
            for (const [i, raw] of assumptions.entries()) {
                errors.push(...validateAssumption(raw, `assumptions[${i}]`));
            }
        }
    }

    return errors;
}

/**
 * The main-session recycle envelope (road-to-token-economy-recycling
 * Phase 2.1) — the `main_session` CHECKPOINT variant. Unlike the worker
 * capsule there is NO surviving orchestrator to receive it: the successor
 * session bootstraps from the envelope ALONE, so the required set is
 * stricter — the active task, its acceptance criteria, the open work, and
 * the explicit NOT-carried-forward list (what the successor must re-derive
 * from source rather than trust) are all mandatory.
 *
 * Same transcript-exclusion-by-construction as the worker capsule: every
 * field is a ref token or a single short line, validated by the SAME
 * primitives. A prose transcript summary is schema-invalid twice over —
 * any multi-line value fails `isShortLine`, and any field not listed below
 * (e.g. `transcript_summary`) fails the unknown-key sweep. The strict
 * sweep is deliberate where the worker validator stays open: the worker
 * side has `subagent-status.json` (`additionalProperties: false`) as its
 * wire gate; this variant is consumed from a FILE by
 * `handoff_context_hook`, so the module itself must be the strict gate.
 */
export interface MainSessionRecycleEnvelope {
    /** Must be {@link CAPSULE_SCHEMA_VERSION}. */
    capsule_version: number;
    variant: 'main_session';
    /** One- or two-sentence outcome so far. */
    summary: string;
    /** The active task, one line. */
    task: string;
    /** Workspace root this envelope belongs to — the consumer's identity check (Risk 4). */
    workspace: string;
    /** ISO-8601 stamp of the write — the consumer's staleness guard. */
    written_at: string;
    /** What "done" means — one short line each. Required, ≥ 1. */
    acceptance_criteria: string[];
    /** Open work, one short line each. Required (may be empty when only verification remains). */
    remaining: string[];
    /**
     * What the successor must RE-DERIVE from source instead of trusting —
     * the explicit omission list that makes envelope loss visible instead
     * of silent. Required; an empty list is a claim, not a default.
     */
    not_carried_forward: string[];
    /** Choices already made, each with its one-line rationale in the same line. */
    decisions?: string[];
    /** Binding constraints the successor must not silently re-open. */
    constraints?: string[];
    /** Open worker CHECKPOINT envelopes by path — never inlined bodies. */
    open_worker_envelopes?: string[];
    /** Artifact paths (deliverables, notes, evidence) — refs, never bodies. */
    artifact_paths?: string[];
    /** Stated premises — the shared `{statement, basis, epistemic_state}` shape. */
    assumptions?: CapsuleAssumption[];
}

/** Every key `validateRecycleEnvelope` accepts — anything else is schema-invalid. */
const RECYCLE_ENVELOPE_KEYS: ReadonlySet<string> = new Set([
    'capsule_version',
    'variant',
    'summary',
    'task',
    'workspace',
    'written_at',
    'acceptance_criteria',
    'remaining',
    'not_carried_forward',
    'decisions',
    'constraints',
    'open_worker_envelopes',
    'artifact_paths',
    'assumptions',
]);

/**
 * Validate a main-session recycle envelope. Returns the list of violations
 * (empty = valid). The consumer never injects an invalid envelope — it is
 * consumed and discarded loudly instead (`handoff_context_hook`).
 */
export function validateRecycleEnvelope(input: unknown): string[] {
    const errors: string[] = [];
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return ['not an object'];
    }
    const e = input as Record<string, unknown>;

    for (const key of Object.keys(e)) {
        if (!RECYCLE_ENVELOPE_KEYS.has(key)) {
            errors.push(
                `unknown field "${key}" — a recycle envelope carries selection and pointers only; ` +
                    'free-form additions (prose summaries included) are schema-invalid by construction',
            );
        }
    }

    if (e['capsule_version'] !== CAPSULE_SCHEMA_VERSION) {
        errors.push(`capsule_version must be ${CAPSULE_SCHEMA_VERSION}`);
    }
    if (e['variant'] !== 'main_session') {
        errors.push("variant must be 'main_session'");
    }
    if (!isShortLine(e['summary'], MAX_LINE_CHARS)) {
        errors.push(`summary must be a single line of 1–${MAX_LINE_CHARS} chars`);
    }
    if (!isShortLine(e['task'], MAX_LINE_CHARS)) {
        errors.push(`task must be a single line of 1–${MAX_LINE_CHARS} chars`);
    }
    if (!isShortLine(e['workspace'], MAX_REF_CHARS)) {
        errors.push(`workspace must be a path ref of ≤ ${MAX_REF_CHARS} chars`);
    }
    const writtenAt = e['written_at'];
    if (typeof writtenAt !== 'string' || Number.isNaN(Date.parse(writtenAt))) {
        errors.push('written_at must be a parseable ISO-8601 timestamp');
    }

    checkList(errors, 'acceptance_criteria', e['acceptance_criteria'], MAX_LINE_CHARS, true);
    if (Array.isArray(e['acceptance_criteria']) && e['acceptance_criteria'].length === 0) {
        errors.push('acceptance_criteria must carry at least one entry — the successor cannot know "done" without it');
    }
    checkList(errors, 'remaining', e['remaining'], MAX_LINE_CHARS, true);
    checkList(errors, 'not_carried_forward', e['not_carried_forward'], MAX_LINE_CHARS, true);
    checkList(errors, 'decisions', e['decisions'], MAX_LINE_CHARS, false);
    checkList(errors, 'constraints', e['constraints'], MAX_LINE_CHARS, false);
    checkList(errors, 'open_worker_envelopes', e['open_worker_envelopes'], MAX_REF_CHARS, false);
    checkList(errors, 'artifact_paths', e['artifact_paths'], MAX_REF_CHARS, false);

    // `remaining` and `not_carried_forward` must be PRESENT (checkList already
    // enforces that) — empty arrays are legal, explicit claims.
    const assumptions = e['assumptions'];
    if (assumptions !== undefined) {
        if (!Array.isArray(assumptions)) {
            errors.push('assumptions must be an array');
        } else {
            if (assumptions.length > MAX_ENTRIES) {
                errors.push(`assumptions carries ${assumptions.length} entries (max ${MAX_ENTRIES})`);
            }
            for (const [i, raw] of assumptions.entries()) {
                errors.push(...validateAssumption(raw, `assumptions[${i}]`));
            }
        }
    }

    return errors;
}

/**
 * Validate one `{statement, basis, epistemic_state}` triple. Exported because
 * the worker RESULT envelope carries the same field (`subagent_response.ts`) —
 * one shape, one validator, so the two cannot drift.
 */
export function validateAssumption(input: unknown, label = 'assumption'): string[] {
    const errors: string[] = [];
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return [`${label} is not an object`];
    }
    const a = input as Record<string, unknown>;
    if (!isShortLine(a['statement'], MAX_LINE_CHARS)) {
        errors.push(`${label}.statement must be a single line of 1–${MAX_LINE_CHARS} chars`);
    }
    if (!isShortLine(a['basis'], MAX_REF_CHARS)) {
        errors.push(`${label}.basis must be a ref token (file:line, id, path, command) of ≤ ${MAX_REF_CHARS} chars`);
    }
    if (typeof a['epistemic_state'] !== 'string' || !EPISTEMIC.has(a['epistemic_state'])) {
        errors.push(`${label}.epistemic_state must be one of ${EPISTEMIC_STATES.join(' | ')}`);
    }
    return errors;
}
