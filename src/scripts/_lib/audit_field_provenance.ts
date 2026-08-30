/**
 * Which audit-log fields are OBSERVED and which are producer constants.
 *
 * This module exists because a prose sentence was wrong for months and nothing
 * could tell. `docs/contracts/audit-log-v1.md` described `rules_applied` as
 * "stable rule ids whose Iron Law fired this phase" — an observation — while
 * both shipped producers write the literal `['delegation-policy']` on every
 * line. A consumer following the contract computes a per-rule win rate of 100 %
 * for one rule and `undefined` for the other 118, and that reads as a finding.
 *
 * It was found by the loop rather than by review: mining the real audit stream
 * with `extract_audit_patterns --min-count 2` mints exactly ONE pattern,
 * `implement:success:delegation-policy`, at count 914 over 935 lines. A
 * regularity that strong in a field that varied would be remarkable; in a field
 * that does not vary it is arithmetic.
 *
 * The prose was DELETED rather than softened, and this check replaces it. A
 * sentence cannot stop a consumer from aggregating over a constant; a function
 * the consumer must call can, and it goes stale loudly instead of silently
 * because the producers are named here and a test asserts they still match.
 *
 * road-to-experience-loop-broadening step 9.3 — the removal the loop motivated.
 */

/**
 * Fields a shipped producer writes as a fixed value, with the value.
 *
 * A field listed here is NOT evidence about the run. Adding a row is how a
 * future producer records the same honesty; removing one requires that the
 * producer actually compute the field.
 */
export const PRODUCER_CONSTANT_FIELDS: ReadonlyMap<string, readonly string[]> = new Map([
    // Written identically by `orchestration_record.ts` and
    // `review_skipped_record.ts`. Neither computes it from rules that fired.
    ['rules_applied', ['delegation-policy']],
]);

/** True when a per-asset rate over this field would measure the producer. */
export function isProducerConstantField(field: string): boolean {
    return PRODUCER_CONSTANT_FIELDS.has(field);
}

/**
 * The reason, for a consumer that wants to say why it skipped a column.
 * `null` when the field is genuinely observed.
 */
export function constantFieldReason(field: string): string | null {
    const v = PRODUCER_CONSTANT_FIELDS.get(field);
    if (v === undefined) return null;
    return (
        `'${field}' is written as the fixed value [${v.map((x) => `'${x}'`).join(', ')}] by every shipped ` +
        'producer, so any rate computed over it measures the writer rather than the work.'
    );
}
