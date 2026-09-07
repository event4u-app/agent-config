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
    // EMPTY, and that is the assertion. `rules_applied` was the single row here
    // until 2026-09-07: both shipped producers wrote the literal
    // `['delegation-policy']` on every line. They now call `appliedIds` below,
    // which carries what the caller observed and writes `[]` when the caller
    // observed nothing — an honest absence, and the same answer
    // `activation_receipt_producer.ts` has always given.
    //
    // Removing the row IS the claim that the field is now observed, so the row
    // and the experience card that recorded the constancy
    // (`agents/knowledge/experience-rules-applied-is-a-producer-constant.md`)
    // were retired in the SAME change. Leaving the card standing after its
    // falsifier fired would make the tree assert something false about itself,
    // which is the failure the card exists to prevent.
    //
    // WHAT THIS DOES NOT CLAIM: the historical stream. Audit lines are
    // append-only, so every line written before the cutover still carries the
    // constant, and mining the real stream will keep surfacing it until new
    // lines accumulate. The falsifier's second half — "the mined pattern's
    // count falls below the audit line count" — is demonstrated over a fixture
    // stream built through the changed producers
    // (`tests/scripts/rules_applied_is_observed.test.ts`), which is the only
    // stream where it CAN be demonstrated on the day the change lands.
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

/**
 * Normalise an applied-id array for the `rules_applied` field: drop blanks,
 * de-duplicate, bound to <= 32 (the contract's own limit).
 *
 * Lives HERE, in the module that recorded the constancy, because both shipped
 * producers now call it and the one property that must not drift between them
 * is exactly this field's derivation. A caller that offers nothing gets `[]` —
 * an honest absence — never a fabricated id.
 */
export const MAX_APPLIED_IDS = 32;

export function appliedIds(values: readonly string[] | null | undefined): string[] {
    const out: string[] = [];
    for (const raw of values ?? []) {
        const v = String(raw).trim();
        if (v === '' || out.includes(v)) continue;
        out.push(v);
        if (out.length >= MAX_APPLIED_IDS) break;
    }
    return out;
}
