/**
 * Train-versus-shifted trigger pairs, computed OFFLINE.
 *
 * An activation corpus authored in one voice measures routing against that
 * voice. A description that only fires on the phrasing its own eval file uses
 * looks perfect and generalises to nothing — the gap between a base case and a
 * deliberately shifted twin is the thing that would show it, and no field in
 * `triggers.json` could express the pair.
 *
 * `shift_of` is that field, and it is **additive**. All six readers of
 * `triggers.json` in this tree key-pick (`queries`, `should_trigger`,
 * `should_not_trigger`) and no JSON Schema governs the file — `evals.schema.json`
 * says so in its own `$comment` — so an unknown key cannot break a parse. The
 * backward-compatibility claim is therefore structural, and the test asserts it
 * rather than trusting it.
 *
 * Nothing here calls a routing harness. The gap is computed from the corpus
 * against a caller-supplied router, and `road-to-routing-assurance-live-floors`
 * stays parked (step 8.2).
 */

/** The five axes a shifted twin may vary. */
export const SHIFT_AXES = [
    /** Same request wrapped in different surrounding prose. */
    'wrapper',
    /** Same request, different tense or time reference. */
    'temporal',
    /** Same request, different wording. */
    'phrasing',
    /**
     * Same request framed as a different host would present it. From the
     * skipped parent, and one of the two a purely textual shift cannot express.
     */
    'host-framing',
    /**
     * Same request under different declared tool or context availability. The
     * second axis textual shifting cannot reach.
     */
    'context-availability',
] as const;

export type ShiftAxis = (typeof SHIFT_AXES)[number];

export function isShiftAxis(v: unknown): v is ShiftAxis {
    return typeof v === 'string' && (SHIFT_AXES as readonly string[]).includes(v);
}

/** One query as it appears in a `triggers.json`, with the optional pairing. */
export interface ShiftQuery {
    q: string;
    trigger: boolean;
    /** Present only on a shifted twin: the `q` it is a shift OF, plus the axis. */
    shift_of?: { of: string; axis: ShiftAxis };
}

export interface ShiftPair {
    base: ShiftQuery;
    shifted: ShiftQuery;
    axis: ShiftAxis;
}

/**
 * Pair every shifted twin with its base.
 *
 * A twin whose `of` names no base in the same file is REPORTED, not silently
 * dropped: a dangling pair is an authoring error, and swallowing it would make
 * the corpus quietly smaller while the gap report still looked complete.
 */
export function pairShifts(queries: readonly ShiftQuery[]): {
    pairs: ShiftPair[];
    dangling: ShiftQuery[];
} {
    const byPrompt = new Map(queries.map((q) => [q.q, q]));
    const pairs: ShiftPair[] = [];
    const dangling: ShiftQuery[] = [];

    for (const q of queries) {
        const s = q.shift_of;
        if (s === undefined) continue;
        const base = byPrompt.get(s.of);
        if (base === undefined || !isShiftAxis(s.axis)) {
            dangling.push(q);
            continue;
        }
        pairs.push({ base, shifted: q, axis: s.axis });
    }
    return { pairs, dangling };
}

export interface GapRow {
    axis: ShiftAxis;
    base: string;
    shifted: string;
    /** Did the base route as its `trigger` value expects? */
    base_ok: boolean;
    /** Did the shifted twin? */
    shifted_ok: boolean;
    /** True when the base held and the shift did not — the case worth reading. */
    degraded: boolean;
}

export interface GapReport {
    rows: GapRow[];
    pairs: number;
    /** Pairs where the base held and the shifted twin did not. */
    degradations: number;
    dangling: number;
}

/**
 * Compute the gap.
 *
 * `routes` is supplied by the caller and is a PURE PREDICATE — given a prompt,
 * did the unit load? Passing the router in rather than importing one is what
 * keeps this offline: there is no code path from here to a live harness,
 * because there is no harness reference to follow.
 */
export function gapReport(
    queries: readonly ShiftQuery[],
    routes: (prompt: string) => boolean,
): GapReport {
    const { pairs, dangling } = pairShifts(queries);
    const rows: GapRow[] = pairs.map(({ base, shifted, axis }) => {
        const base_ok = routes(base.q) === base.trigger;
        const shifted_ok = routes(shifted.q) === shifted.trigger;
        return {
            axis,
            base: base.q,
            shifted: shifted.q,
            base_ok,
            shifted_ok,
            // Only this direction is interesting. A pair where the BASE already
            // fails says nothing about generalisation -- it says the corpus row
            // is wrong or the description never worked.
            degraded: base_ok && !shifted_ok,
        };
    });
    return {
        rows,
        pairs: pairs.length,
        degradations: rows.filter((r) => r.degraded).length,
        dangling: dangling.length,
    };
}
