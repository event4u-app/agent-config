/**
 * Does any of this configuration take effect here?
 * (`road-to-delivered-cost-truth` Phase 3.)
 *
 * `doctorShell` states its own scope: Node version, package-root resolution,
 * whether the Bash dispatcher exists. That is an ENVIRONMENT probe. It cannot
 * answer whether a bound hook actually fires on this host — which is the
 * question that decides whether any of the configuration this suite ships is
 * doing anything here.
 *
 * FIVE STATES, NOT FOUR. The roadmap named four binding states; both council
 * seats (2026-08-28, 2/2, resolving `how-far-the-effect-probe-may-reach` as
 * option (c)) split one of them, and the split is real:
 *
 *   effective        fired, and a deny would have been honoured
 *   bound-discarded  fired, and the host discards its output
 *   bound-not-fired  the manifest binds it, and no dispatch was observed
 *   unbound          the manifest does not bind it on this host
 *   unknown          it was not safe to probe
 *
 * `bound-not-fired` and `unknown` were one bucket in the four-state model, and
 * collapsing them hides the difference between "the host ignored it" and "we
 * declined to look".
 *
 * ELIGIBILITY IS MEASURED, NOT DECLARED. Option (c) as written restricts
 * dispatch to concerns that DECLARE themselves side-effect free, and both seats
 * then said the same thing from different directions: a self-declared property
 * nothing verifies is a weak control this repository flags as a defect
 * elsewhere, and the dispatch should be sandboxed even for declared-safe
 * concerns. Taken together that makes the declaration redundant — so this module
 * measures the property instead: run the concern against a scratch root, compare
 * the tree before and after, and treat any write as ineligible. A concern that
 * writes is reported `unknown`, which is the honest answer and never a success.
 *
 * `unknown` IS NEVER RENDERED AS `effective`. That is the one rule every seat
 * stated independently, and it is what the three coverage metrics exist to keep
 * visible: a report can be truthful about each concern and still mislead, if
 * almost nothing was actually probed.
 */

export const PROBE_STATES = ['effective', 'bound-discarded', 'bound-not-fired', 'unbound', 'unknown'] as const;
export type ProbeState = (typeof PROBE_STATES)[number];

/** The verdict a whole host gets. */
export const HOST_VERDICTS = ['effective', 'partial', 'inert', 'unknown'] as const;
export type HostVerdict = (typeof HOST_VERDICTS)[number];

export interface ConcernProbe {
    concern: string;
    slot: string;
    state: ProbeState;
    /** Always populated — for `unknown` it is the reason the probe declined. */
    reason: string;
    /** Did the sandbox observe a write? `null` when no dispatch was attempted. */
    wrote_in_sandbox: boolean | null;
}

export interface Coverage {
    /** dispatched / total — tests the control itself. */
    dispatch_rate: number;
    /** non-unknown / total — where an answer exists at all. */
    known_state_rate: number;
    /** (effective + bound-discarded) / total — actual observed confidence. */
    verified_rate: number;
}

export interface HostReport {
    host: string;
    probes: ConcernProbe[];
    coverage: Coverage;
    verdict: HostVerdict;
    /** For `partial`, the slots that are inert. Empty otherwise. */
    inert_slots: string[];
    reason: string;
}

function rate(n: number, d: number): number {
    return d === 0 ? 0 : n / d;
}

export function coverageOf(probes: readonly ConcernProbe[]): Coverage {
    const total = probes.length;
    const dispatched = probes.filter((p) => p.wrote_in_sandbox !== null).length;
    const known = probes.filter((p) => p.state !== 'unknown').length;
    const verified = probes.filter((p) => p.state === 'effective' || p.state === 'bound-discarded').length;
    return {
        dispatch_rate: rate(dispatched, total),
        known_state_rate: rate(known, total),
        verified_rate: rate(verified, total),
    };
}

/**
 * One verdict for the host.
 *
 * The ordering is the honesty: `unknown` is checked BEFORE `effective`, so a run
 * that could not establish anything can never present itself as a working
 * configuration. A single `effective` among a hundred `unknown`s is `unknown`,
 * not `partial` — because the hundred were not measured, and `partial` is a
 * claim about what IS inert rather than about what was not looked at.
 */
export function hostVerdict(probes: readonly ConcernProbe[]): { verdict: HostVerdict; inert: string[]; reason: string } {
    if (probes.length === 0) {
        return { verdict: 'unknown', inert: [], reason: 'no concern is bound on this host, so there is nothing to probe' };
    }
    const known = probes.filter((p) => p.state !== 'unknown');
    if (known.length === 0) {
        return {
            verdict: 'unknown',
            inert: [],
            reason: `none of the ${String(probes.length)} bound concern(s) could be probed safely — no state was established`,
        };
    }
    const effective = known.filter((p) => p.state === 'effective');
    const inertProbes = known.filter((p) => p.state === 'bound-discarded' || p.state === 'bound-not-fired' || p.state === 'unbound');
    const inert = [...new Set(inertProbes.map((p) => p.slot))].sort();

    if (effective.length === 0) {
        return {
            verdict: 'inert',
            inert,
            reason: `no probed concern reached the model on this host (${String(known.length)} of ${String(probes.length)} probed)`,
        };
    }
    if (inertProbes.length === 0 && known.length === probes.length) {
        return { verdict: 'effective', inert: [], reason: `every bound concern (${String(probes.length)}) took effect` };
    }
    return {
        verdict: 'partial',
        inert,
        reason:
            `${String(effective.length)} of ${String(probes.length)} bound concern(s) took effect; ` +
            `inert slot(s): ${inert.length === 0 ? 'none' : inert.join(', ')}` +
            (known.length < probes.length ? ` · ${String(probes.length - known.length)} could not be probed` : ''),
    };
}

export function buildHostReport(host: string, probes: readonly ConcernProbe[]): HostReport {
    const v = hostVerdict(probes);
    return { host, probes: [...probes], coverage: coverageOf(probes), verdict: v.verdict, inert_slots: v.inert, reason: v.reason };
}
