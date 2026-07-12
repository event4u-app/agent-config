// Chairman selection (road-to-opt-council-deliberation Phase 2).
//
// The council's Iron Law argues the host, having framed the artefact, cannot
// independently judge it — so synthesis by a *non-deliberating* member removes
// that bias. This module is the pure SELECTION decision (who chairs, and the
// visible verdict annotation); the billable dispatch of the chairman's synthesis
// call lives in the CLI run path, gated behind the same config.
//
// `auto` deliberately falls back to host: the engine has no cross-member tier
// source today (a `MemberConfig.tier` field would be new), and whether `auto`
// should prefer model tier or provider-family difference is the exact question
// `blocker: contested-design-council-pass` reserves for a billable /council:design
// run. Rather than pre-decide it by picking an arbitrary member, `auto` resolves
// to host with a visible annotation until that decision + a tier source land.

export interface ChairmanSelection {
    /** The chosen chairman member name, or `null` → host synthesis (today's path). */
    member: string | null;
    /** Visible annotation for the synthesis verdict — never a silent substitution. */
    annotation: string;
}

/**
 * Pure chairman selection.
 *
 * @param mode           one of `host` | `member` | `auto` (validated at config load)
 * @param member         the configured member name when `mode === 'member'`
 * @param deliberated    member names that produced a real (non-error, non-empty) response this session
 * @param enabledMembers member names enabled in config
 */
export function select_chairman(
    mode: string,
    member: string | null,
    deliberated: ReadonlySet<string>,
    enabledMembers: ReadonlySet<string>,
): ChairmanSelection {
    if (mode === 'host') {
        return { member: null, annotation: 'Chairman: host' };
    }
    if (mode === 'member') {
        if (member === null || !enabledMembers.has(member)) {
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
    // mode === 'auto' — conservative host fallback (see module header).
    return {
        member: null,
        annotation: 'Chairman: host (auto — no non-deliberating tier source; pending /council:design)',
    };
}

function _q(v: string | null): string {
    return v === null ? 'null' : `'${v}'`;
}
