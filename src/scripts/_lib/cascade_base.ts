/**
 * The cascade base — `road-to-adversarial-verification-and-long-runs` 5.1.
 *
 * `check_branch_freshness` asks whether a branch is behind THE BASE ITS PR
 * TARGETS. That is one hop, and it is the right question for the common case
 * where the base is the trunk. On a stacked PR it is only half of it: a branch
 * targeting `feat/parent` can be perfectly current with `feat/parent` while
 * `feat/parent` itself is fifty commits behind `main`, so the branch is stale
 * against the tree it will eventually land in and every gate reports green.
 *
 * The cascade is the ordered list of refs a branch must be current with, nearest
 * first. Merging in that order is not arbitrary: taking the trunk first would
 * pull trunk commits past the parent and make the stack's own diff unreadable,
 * which is the thing a stack exists to avoid.
 *
 * **Depth is bounded and the bound is deliberate.** A cascade is a chain of
 * bases, and a chain can cycle — a branch whose PR targets a branch that targets
 * it. `MAX_HOPS` stops the walk and the result says it was truncated, because
 * a hop list silently cut short is indistinguishable from a short one.
 *
 * Pure: the caller supplies the base-of lookup, so the whole thing is testable
 * without a forge.
 */

/** How many bases a cascade may chain through before the walk stops. */
export const MAX_HOPS = 8;

export interface Cascade {
    /** Refs to merge in, nearest base first, trunk last. Never includes `branch`. */
    readonly hops: readonly string[];
    /** True when the walk stopped on a cycle rather than on the trunk. */
    readonly cycle: boolean;
    /** True when the walk stopped on {@link MAX_HOPS}. */
    readonly truncated: boolean;
}

/** `null` when the ref has no PR base — i.e. it is a trunk or is unknown. */
export type BaseOf = (ref: string) => string | null;

/**
 * Walk from `branch` to `trunk`, collecting every base on the way.
 *
 * A branch whose base IS the trunk yields one hop — identical to the single-hop
 * behaviour that existed before, which is the compatibility property that
 * matters: this widens the check, it does not change the common case.
 */
export function cascadeBase(branch: string, trunk: string, baseOf: BaseOf): Cascade {
    const hops: string[] = [];
    const seen = new Set<string>([branch]);
    let current = branch;

    for (let i = 0; i < MAX_HOPS; i += 1) {
        const base = baseOf(current);
        if (base === null || base === '') {
            // No PR base. The trunk is still owed unless we are already on it.
            if (current !== trunk && !hops.includes(trunk)) hops.push(trunk);
            return { hops, cycle: false, truncated: false };
        }
        if (seen.has(base)) {
            return { hops, cycle: true, truncated: false };
        }
        seen.add(base);
        hops.push(base);
        if (base === trunk) {
            return { hops, cycle: false, truncated: false };
        }
        current = base;
    }
    return { hops, cycle: false, truncated: true };
}

/** One ref's freshness, as the caller measured it. */
export interface HopReading {
    readonly ref: string;
    /** `true` behind · `false` current · `null` not measured. */
    readonly behind: boolean | null;
}

/**
 * Which hops still need merging, in order.
 *
 * An UNMEASURED hop is returned alongside the behind ones rather than skipped:
 * "we could not tell" and "it is current" are different states, and treating the
 * first as the second is how a single-hop check reported green on a stale stack
 * in the first place.
 */
export function hopsNeedingMerge(readings: readonly HopReading[]): HopReading[] {
    return readings.filter((r) => r.behind !== false);
}

/** True only when every hop was measured and every hop is current. */
export function cascadeCurrent(readings: readonly HopReading[]): boolean {
    return readings.length > 0 && readings.every((r) => r.behind === false);
}
