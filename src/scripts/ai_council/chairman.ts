// Chairman selection (road-to-opt-council-deliberation Phase 2).
//
// The council's Iron Law argues the host, having framed the artefact, cannot
// independently judge it — so synthesis by a *non-deliberating* member removes
// that bias. This module is the pure SELECTION decision (who chairs, and the
// visible verdict annotation); the billable dispatch of the chairman's synthesis
// call lives in the CLI run path, gated behind the same config.
//
// `auto` policy — decided by the contested-design council pass (anthropic/
// claude-sonnet-4-5 + openai/gpt-4o, 2-round debate, 2026-07-12):
// **provider-family difference is primary** — independence from the
// deliberators' priors is the binding constraint for a judge, and provider
// diversity is the one structural guarantee available without an LLM call.
// The **tie-break is the capability signal**: an explicit optional
// `members.<name>.tier` when present (higher = stronger), else deterministic
// config order. In this engine each member IS one provider (the
// one-advisor-per-provider invariant), so every enabled member that did not
// deliberate is provider-different from every deliberator by construction.

export interface ChairmanCandidate {
    /** Member name (== provider key in this engine). */
    name: string;
    /** Optional capability rank from `members.<name>.tier`; higher = stronger. */
    tier: number | null;
}

export interface ChairmanSelection {
    /** The chosen chairman member name, or `null` → host synthesis (today's path). */
    member: string | null;
    /** Visible annotation for the synthesis verdict — never a silent substitution. */
    annotation: string;
}

/**
 * Pure chairman selection.
 *
 * @param mode        one of `host` | `member` | `auto` (validated at config load)
 * @param member      the configured member name when `mode === 'member'`
 * @param deliberated member names that produced a real (non-error, non-empty) response this session
 * @param candidates  enabled members in **config order** (the engine's only trusted ordering)
 */
export function select_chairman(
    mode: string,
    member: string | null,
    deliberated: ReadonlySet<string>,
    candidates: readonly ChairmanCandidate[],
): ChairmanSelection {
    if (mode === 'host') {
        return { member: null, annotation: 'Chairman: host' };
    }
    const enabledNames = new Set(candidates.map((c) => c.name));
    if (mode === 'member') {
        if (member === null || !enabledNames.has(member)) {
            return {
                member: null,
                annotation: `Chairman: host (member ${_q(member)} unavailable — host fallback)`,
            };
        }
        if (deliberated.has(member)) {
            // A member that argued in the debate cannot independently judge it.
            return {
                member: null,
                annotation: `Chairman: host (member ${_q(member)} deliberated — cannot self-judge, host fallback)`,
            };
        }
        return { member, annotation: `Chairman: ${member}` };
    }
    // mode === 'auto' — provider-family difference primary (non-deliberating ⇒
    // provider-different by construction here); tier tie-break; config-order final.
    const pool = candidates.filter((c) => !deliberated.has(c.name));
    if (pool.length === 0) {
        return {
            member: null,
            annotation: 'Chairman: host (no non-panel member available)',
        };
    }
    let best = pool[0] as ChairmanCandidate;
    for (const c of pool.slice(1)) {
        const bestTier = best.tier ?? Number.NEGATIVE_INFINITY;
        const cTier = c.tier ?? Number.NEGATIVE_INFINITY;
        if (cTier > bestTier) {
            best = c; // strictly higher tier wins; equal/lower keeps config order
        }
    }
    return { member: best.name, annotation: `Chairman: ${best.name} (auto)` };
}

function _q(v: string | null): string {
    return v === null ? 'null' : `'${v}'`;
}
