/**
 * Delivered-cost primitives (`road-to-delivered-cost-truth` Phase 1).
 *
 * Three answers a consumer of this suite cannot currently get: what does my
 * configuration cost per session, which assets produce that cost, and is any of
 * it taking effect. This module owns the first; `_lib/asset_delivery_ledger.ts`
 * owns the second.
 *
 * PAYLOAD AMPLIFICATION, NOT "NET NEGATIVE" — the naming is a council verdict,
 * not a preference. AI council 2026-08-28 (2/2 convergent) resolved the
 * `what-the-net-negative-threshold-is` blocker as option (b), a ratio against
 * the active profile's declared payload, AND both seats refused the name the
 * roadmap used: a ratio measures how much payload is delivered per unit the
 * profile declared. It cannot establish that the configuration is net-negative,
 * because it never observes what was RETURNED. A 10:1 amplification delivering
 * critical capability is not net-negative; a 1:1 delivering nothing is. So the
 * figure informs the question and is not allowed to answer it, and the field is
 * named for what it measures.
 *
 * THE DENOMINATOR IS THE INTENDED PAYLOAD, NOT THE MEASURED ONE. A first cut
 * declared the profile's payload as its own current measurement, which made the
 * ratio 1.00 by construction — a number that cannot move is not a measurement.
 * The declaration is what the profile INTENDS to deliver (its budget); the
 * numerator is what the tree actually delivers; the ratio is the gap, which is
 * the whole point.
 *
 * AND IT IS VERIFIED, NOT TRUSTED. Both council seats independently raised
 * denominator gaming: a profile self-declaring a large payload makes any
 * delivered cost look good. So a declaration above the measured tree's own total
 * is refused — a profile cannot intend to deliver more than exists — and an
 * absent, non-positive or over-ceiling declaration yields `unknown_profile`,
 * never a ratio computed from a number nobody checked.
 */

export type AmplificationVerdict = 'measured' | 'unknown_profile';

export interface ProfileDeclaration {
    profile: string;
    /**
     * INTENDED standing payload per category — the profile's budget, not its
     * current measurement. Per category so the numerator and denominator
     * measure the same things; a single total would let a rules figure be
     * compared against a rules-plus-skills delivery.
     */
    declared: { rules_tokens: number; skill_catalogue_tokens: number };
    /**
     * How far ABOVE the measured tree a declaration may sit before it is
     * refused as gamed. A profile cannot intend to deliver more than exists.
     */
    sanity_headroom: number;
}

export interface AmplificationResult {
    verdict: AmplificationVerdict;
    /** `null` whenever `verdict` is not `measured`. Never a placeholder number. */
    ratio: number | null;
    delivered_tokens: number;
    declared_tokens: number | null;
    reason: string;
}

/** A declaration is usable when it is present, positive, and not above the tree. */
export function amplification(
    deliveredTokens: number,
    measured: { rules_tokens: number; skill_catalogue_tokens: number },
    declaration: ProfileDeclaration | null,
): AmplificationResult {
    if (declaration === null) {
        return {
            verdict: 'unknown_profile',
            ratio: null,
            delivered_tokens: deliveredTokens,
            declared_tokens: null,
            reason: 'the active profile declares no intended standing payload, so there is no denominator to compare against',
        };
    }
    const declaredTotal = declaration.declared.rules_tokens + declaration.declared.skill_catalogue_tokens;
    if (!Number.isFinite(declaredTotal) || declaredTotal <= 0) {
        return {
            verdict: 'unknown_profile',
            ratio: null,
            delivered_tokens: deliveredTokens,
            declared_tokens: null,
            reason: `profile '${declaration.profile}' declares a non-positive payload (${String(declaredTotal)}), which cannot be a denominator`,
        };
    }

    // The gaming direction, and the only one that matters: a declaration ABOVE
    // what the tree can deliver drives the ratio below 1 and makes any delivery
    // look disciplined. A declaration BELOW the delivery is not gaming — it is
    // the finding, and it is exactly what this ratio exists to surface.
    const measuredTotal = measured.rules_tokens + measured.skill_catalogue_tokens;
    const ceiling = measuredTotal * (1 + declaration.sanity_headroom);
    if (declaredTotal > ceiling) {
        return {
            verdict: 'unknown_profile',
            ratio: null,
            delivered_tokens: deliveredTokens,
            declared_tokens: declaredTotal,
            reason:
                `profile '${declaration.profile}' declares ${String(declaredTotal)} tok of intended payload against a ` +
                `measured tree of ${String(measuredTotal)} tok — a profile cannot intend to deliver more than exists, ` +
                'so the declaration is refused rather than used as a denominator',
        };
    }

    return {
        verdict: 'measured',
        ratio: deliveredTokens / declaredTotal,
        delivered_tokens: deliveredTokens,
        declared_tokens: declaredTotal,
        reason:
            `${String(deliveredTokens)} tok delivered against ${String(declaredTotal)} tok intended by profile ` +
            `'${declaration.profile}'`,
    };
}

// ─────────────────────────────────────────────────── the billable-input split

export interface BillableSplit {
    fresh_input_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    billable_input_tokens: number;
    /** cache_read / billable_input. `null` when nothing was billed. */
    cache_read_share: number | null;
}

export function billableSplit(fresh: number, cacheRead: number, cacheCreation: number): BillableSplit {
    const total = fresh + cacheRead + cacheCreation;
    return {
        fresh_input_tokens: fresh,
        cache_read_tokens: cacheRead,
        cache_creation_tokens: cacheCreation,
        billable_input_tokens: total,
        // A share over a zero denominator is not 0 % — it is absent, and
        // rendering 0 % would read as "the cache never helped".
        cache_read_share: total > 0 ? cacheRead / total : null,
    };
}

// ──────────────────────────────────────────────────── re-read cost (step 1.3)

export interface RereadLeg {
    /** Repo-relative path that was re-read. */
    file: string;
    /** Total reads of this file in the leg. */
    total_reads: number;
    /** Reads beyond the first. */
    duplicate_reads: number;
    /** Measured size of the file in tokens. */
    file_tokens: number;
}

export interface RereadCost {
    legs: RereadLeg[];
    /** Tokens paid for content already in context. */
    wasted_tokens: number;
    /** `null` when nothing was re-read — never a zero standing in for absence. */
    worst_file: string | null;
}

/**
 * Price the re-reads `hot_context_hook` already counts.
 *
 * The hook notices a repeated read and says so; nothing turned that into a
 * number, so a re-read was visible and unpriced. The cost is
 * `duplicate_reads x file_tokens` — a figure DERIVED from the file's measured
 * size, never a constant, because a constant would rank a re-read of a one-line
 * config beside a re-read of a 3,000-token rule.
 */
export function rereadCost(legs: readonly RereadLeg[]): RereadCost {
    const wasted = legs.reduce((n, l) => n + l.duplicate_reads * l.file_tokens, 0);
    let worst: RereadLeg | null = null;
    for (const l of legs) {
        const cost = l.duplicate_reads * l.file_tokens;
        if (cost > 0 && (worst === null || cost > worst.duplicate_reads * worst.file_tokens)) worst = l;
    }
    return { legs: [...legs], wasted_tokens: wasted, worst_file: worst === null ? null : worst.file };
}

// ────────────────────────────────────────────── the summary line (step 2.3)

/**
 * The one-line end-of-task figure. TOKENS ONLY.
 *
 * No currency, and this is a hard property rather than a style choice: the suite
 * does not know the consumer's contract — subscription, per-token, committed
 * spend, a reseller rate — so any monetary figure it printed would be
 * extrapolated from a rate it invented. A fabricated cost is worse than none,
 * because it is actionable and wrong.
 *
 * {@link CURRENCY_MARKERS} is what the test asserts against, so the ban is
 * checkable rather than merely intended.
 */
export const CURRENCY_MARKERS = ['$', '€', '£', '¥', 'USD', 'EUR', 'GBP', '/1k', 'per token', 'per-token'] as const;

export function summaryLine(deliveredTokens: number, split: BillableSplit | null): string {
    const share =
        split === null || split.cache_read_share === null
            ? 'cache-read share unavailable'
            : `cache-read share ${(split.cache_read_share * 100).toFixed(1)}%`;
    return `Delivered standing payload: ${String(deliveredTokens)} tok · ${share}`;
}

/** True when a rendered string carries no currency figure or per-token rate. */
export function isCurrencyFree(text: string): boolean {
    return !CURRENCY_MARKERS.some((m) => text.includes(m));
}
