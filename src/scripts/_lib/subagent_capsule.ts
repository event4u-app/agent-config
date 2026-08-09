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
