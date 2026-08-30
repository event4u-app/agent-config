/**
 * `review_skipped` telemetry line builder (pure, no I/O).
 *
 * Purpose-built, MINIMAL extension of the audit-log-v1 envelope
 * (`docs/contracts/audit-log-v1.md`) for the F4-lite end-review-nudge concern
 * (road-to-orchestrator-discipline-carriers Phase 5). It reuses the same
 * envelope shape and the same file location
 * (`agents/runtime/state/audit/<YYYY-MM>.jsonl`) as
 * `_lib/orchestration_record.ts`'s `orchestration` object, but does not
 * import that module: `buildOrchestrationLine` requires `spawn_count`, which
 * has no meaning for a review-skip event, and its enum-constant tables are
 * private to that file. Adding a second additive top-level object
 * (`review_skipped`) is exactly the pattern the contract already uses for
 * `orchestration` — "Unknown trailing fields are forward-compat extensions;
 * readers MUST NOT raise on them."
 *
 * PRIVACY BY CONSTRUCTION: the `review_skipped` object carries `diff_lines`
 * (a non-negative integer count) and `mutation_measure` (a closed 2-value
 * enum — never free text). There is no field capable of holding a file
 * path, a prompt, or any free-form content — never add one (mirrors
 * `domain-safety-pii` § Surface 2 / the `artifact-engagement` event shape).
 */

/**
 * Whether `diff_lines` is an exact sum or a guaranteed-over-threshold
 * approximation (`end_review_nudge_hook.ts`'s `UNTRACKED_FILE_CAP` path —
 * past that many untracked non-doc files, the hook refuses to spawn one
 * `git diff --no-index` subprocess per file and reports a value merely
 * guaranteed to exceed the fire threshold, not an exact count). Mixing
 * exact and approximated counts in this telemetry stream, unlabeled, would
 * corrupt any future blocking-threshold calibration that reads it — hence
 * this field, rather than folding the approximation silently into
 * `diff_lines`.
 */
export type MutationMeasure = 'exact' | 'capped_approximation';

export interface ReviewSkippedInput {
    /** Non-doc tracked-file mutation size that triggered the nudge (count only). */
    diff_lines: number;
    /** Whether `diff_lines` is exact or a capped approximation — see above. */
    mutation_measure: MutationMeasure;
    /** ISO-8601 UTC timestamp; caller supplies (keeps this fn pure/deterministic). */
    ts: string;
    /** Stable id (ULID, UUID, or content hash); caller supplies. */
    id: string;
    work_id?: string | undefined;
}

export interface BuiltReviewSkippedLine {
    line: Record<string, unknown> | null;
    errors: string[];
}

function isNonNegInt(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 0;
}

/**
 * High-risk threshold for the line's own `risk_class` (audit-log-v1 field,
 * not the hook's fire threshold): a skipped review over a large diff carries
 * more residual risk than one just past the fire threshold.
 */
const HIGH_RISK_DIFF_LINES = 200;

/**
 * Build + validate ONE audit-log-v1 line carrying a `review_skipped` object.
 * Returns `{line, errors}`; when `errors` is non-empty, `line` is null and
 * the caller must NOT write.
 */
export function buildReviewSkippedLine(input: ReviewSkippedInput): BuiltReviewSkippedLine {
    const errors: string[] = [];
    if (!isNonNegInt(input.diff_lines)) {
        errors.push('diff_lines must be a non-negative integer');
    }
    if (input.mutation_measure !== 'exact' && input.mutation_measure !== 'capped_approximation') {
        errors.push('mutation_measure must be "exact" or "capped_approximation"');
    }
    if (!input.ts) errors.push('ts (ISO-8601 UTC) is required');
    if (!input.id) errors.push('id (ULID, UUID, or content hash) is required');

    if (errors.length) return { line: null, errors };

    const line: Record<string, unknown> = {
        schema_version: 1,
        id: input.id,
        ts: input.ts,
        work_id: input.work_id ?? `review-skipped-${input.ts}`,
        phase: 'report',
        outcome: 'skipped',
        confidence_band: 'medium',
        risk_class: input.diff_lines >= HIGH_RISK_DIFF_LINES ? 'high' : 'medium',
        memory: { asks: 0, hits: 0 },
        verify: { claims: 0, first_try_passes: 0 },
        rules_applied: ['delegation-policy'],
        // `skills_applied` is OMITTED here, deliberately and not by oversight.
        // audit-log-v1 distinguishes an absent key ("not recorded") from `[]`
        // ("recorded, none applied"), and this writer observes a review that
        // did not happen -- it has no skill observation to offer in either
        // direction. Emitting `[]` would assert "no skills applied" on evidence
        // this producer never gathered, which is the exact fabrication the
        // absent/empty split exists to make impossible.
        persona: null,
        input_kind: 'prompt',
        type: 'note',
        review_skipped: { diff_lines: input.diff_lines, mutation_measure: input.mutation_measure },
    };

    return { line, errors: [] };
}
