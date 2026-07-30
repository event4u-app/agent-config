/**
 * Payload-hash × cache-hit drift aggregator (pure, no-I/O).
 *
 * `agents/roadmaps/road-to-cache-economy.md` Phase 3, step 6: the
 * `orchestration` object's `payload_hash` and `cache_hit` fields are both
 * `null`-by-default and read by nothing (per the roadmap's own defect list).
 * This module is the reader: it joins the two fields recorded on the SAME
 * audit-log-v1 line — `payload_hash` names which spawn-payload shape a
 * dispatch used, `cache_hit` is the provider-reported prompt-cache hit for
 * that dispatch — so prefix-stability drift becomes visible.
 *
 * Cohort split (the roadmap's own verify criterion — "a cohort dispatched
 * with a deliberately unstable payload shows a lower read share than a
 * stable one"):
 *
 * - STABLE cohort: every occurrence of a `payload_hash` AFTER its first —
 *   a hash that repeats means the same payload shape was dispatched again,
 *   so a cache hit on the repeat is the signal a stable prefix predicts.
 * - UNSTABLE cohort: every `payload_hash` that occurs exactly once in the
 *   window — a payload that never repeats can never show a repeat-hit, so
 *   its (necessarily first-call) `cache_hit` value is the unstable-payload
 *   baseline.
 *
 * A hash's FIRST occurrence is excluded from the stable cohort — nothing
 * exists yet for a first call to hit, so counting it would understate the
 * stable cohort's hit rate for a reason that has nothing to do with prefix
 * stability.
 *
 * Zero recorded lines is a VALID state (both fields are lean-init
 * extensions with no caller wiring a real value yet) — the aggregator
 * returns a report with empty cohorts rather than failing, and the CLI
 * wrapper states that plainly rather than presenting empty input as a green
 * result.
 */

export interface PayloadHashLine {
    payload_hash: string | null;
    cache_hit: boolean | null;
}

export interface HashGroupStat {
    payload_hash: string;
    occurrences: number;
    hit_count: number;
    hit_rate: number;
}

export interface CohortStat {
    n: number;
    hit_count: number;
    hit_rate: number | null;
}

export interface PayloadHashDriftReport {
    total_lines: number;
    /** Lines carrying both a non-null `payload_hash` and a boolean `cache_hit`. */
    lines_with_data: number;
    /** Per-hash breakdown, most-occurrences first. */
    groups: HashGroupStat[];
    stable_cohort: CohortStat;
    unstable_cohort: CohortStat;
    /** True only when BOTH cohorts have data AND the stable cohort's hit rate is strictly higher. */
    drift_visible: boolean;
}

function emptyCohort(): CohortStat {
    return { n: 0, hit_count: 0, hit_rate: null };
}

/**
 * Aggregates already-parsed audit-log-v1 orchestration lines. `lines` order
 * matters — it is read as chronological (the CLI wrapper reads
 * `agents/runtime/state/audit/*.jsonl` in filename-sorted order, matching
 * `readAuditLines`), since "first occurrence of a hash" is the only signal
 * that decides which cohort an occurrence falls into.
 */
export function aggregatePayloadHashDrift(lines: readonly PayloadHashLine[]): PayloadHashDriftReport {
    const withData = lines.filter((l) => l.payload_hash !== null && l.cache_hit !== null);

    const byHash = new Map<string, boolean[]>();
    for (const l of withData) {
        const hash = l.payload_hash as string;
        const arr = byHash.get(hash) ?? [];
        arr.push(l.cache_hit as boolean);
        byHash.set(hash, arr);
    }

    const groups: HashGroupStat[] = [];
    const stable = emptyCohort();
    const unstable = emptyCohort();

    for (const [hash, hits] of byHash) {
        const hitCount = hits.filter(Boolean).length;
        groups.push({
            payload_hash: hash,
            occurrences: hits.length,
            hit_count: hitCount,
            hit_rate: hitCount / hits.length,
        });

        if (hits.length === 1) {
            unstable.n += 1;
            if (hits[0] === true) unstable.hit_count += 1;
        } else {
            // Every occurrence AFTER the first (repeat dispatches of the same payload shape).
            const repeats = hits.slice(1);
            stable.n += repeats.length;
            stable.hit_count += repeats.filter(Boolean).length;
        }
    }

    groups.sort((a, b) => b.occurrences - a.occurrences || a.payload_hash.localeCompare(b.payload_hash));
    stable.hit_rate = stable.n > 0 ? stable.hit_count / stable.n : null;
    unstable.hit_rate = unstable.n > 0 ? unstable.hit_count / unstable.n : null;

    const driftVisible = stable.hit_rate !== null && unstable.hit_rate !== null && stable.hit_rate > unstable.hit_rate;

    return {
        total_lines: lines.length,
        lines_with_data: withData.length,
        groups,
        stable_cohort: stable,
        unstable_cohort: unstable,
        drift_visible: driftVisible,
    };
}
