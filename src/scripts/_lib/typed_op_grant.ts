/**
 * Who may authorise a typed op — `road-to-adversarial-verification-and-long-runs`
 * 7.3.
 *
 * Under a mission the sequence is: a council check that the op belongs to the
 * mission → a native ask naming the exact object → execute. The council sits
 * BEFORE the ask and can only subtract.
 *
 * ```
 * THE COUNCIL MAY VETO A TYPED OP. IT MAY NEVER GRANT ONE.
 * A COUNCIL VERDICT ALONE NEVER PRODUCES THE GRANT, HOWEVER UNANIMOUS.
 * THE GRANT COMES FROM THE ASK, AND THE ASK NAMES THE EXACT OBJECT.
 * ```
 *
 * **Why the asymmetry is the whole design.** ADR-257: an unpaid route may
 * propose and score, never decide. A council that could grant would be a second
 * authorisation path around `non-destructive-by-default`'s this-turn
 * confirmation — and it would be the cheaper one, so it would become the only
 * one. Letting it VETO adds a refusal without adding an authority, which is the
 * only direction that is safe to add for free.
 *
 * **An UNAVAILABLE council does not block the op**, and that is deliberate
 * rather than lax: the council is a filter, so its absence removes a filter and
 * leaves the ask exactly where it was. Treating unavailability as a veto would
 * make an unconfigured council a silent kill switch on every typed op — the
 * same-shaped wrong guess `council-availability` exists over.
 *
 * Pure.
 */

/** What the council said about this op. `null` when it was not consulted. */
export type CouncilVerdict = 'in-mission' | 'out-of-mission' | 'unavailable' | null;

/** The ask, as `non-destructive-by-default` requires it: an exact object. */
export interface ExactObjectAsk {
    /** e.g. `force-push`. */
    readonly op: string;
    /**
     * The object, named concretely — a branch and SHA, a recipient and subject,
     * an amount and card-last4. A CATEGORY is not an object.
     */
    readonly object: string;
    /** True once a human answered this ask, this turn. */
    readonly confirmed: boolean;
}

export type GrantState = 'vetoed' | 'ask-required' | 'granted';

export interface GrantDecision {
    readonly state: GrantState;
    readonly reason: string;
}

/** A named object must be specific enough to be checkable. */
function objectIsExact(object: string): boolean {
    return object.trim().length >= 8 && /[^a-z ]/i.test(object);
}

/**
 * Decide whether a typed op may proceed.
 *
 * The order is fixed: veto first, then the ask. A confirmed ask after a veto is
 * still a veto — otherwise the veto would be advisory, and an advisory veto is
 * not one.
 */
export function grantFor(verdict: CouncilVerdict, ask: ExactObjectAsk): GrantDecision {
    if (verdict === 'out-of-mission') {
        return {
            state: 'vetoed',
            reason: `the council found ${ask.op} outside this mission; a veto is not overridden by a later confirmation`,
        };
    }
    if (!ask.confirmed) {
        return {
            state: 'ask-required',
            reason:
                verdict === 'in-mission'
                    ? `the council cleared ${ask.op}, which is not a grant — the ask still has to happen`
                    : `${ask.op} needs a this-turn confirmation naming the exact object`,
        };
    }
    if (!objectIsExact(ask.object)) {
        return {
            state: 'ask-required',
            reason: `the confirmation named "${ask.object}", which is a category rather than an object — an approval must name the exact thing`,
        };
    }
    return { state: 'granted', reason: `confirmed this turn for ${ask.op} on ${ask.object}` };
}

/**
 * Could this verdict, on its own, produce a grant?
 *
 * Exists as its own function so the Iron Law is CHECKABLE rather than merely
 * stated: it returns false for every verdict, including a unanimous one, and a
 * test asserts that over the whole domain.
 */
export function verdictAloneGrants(_verdict: CouncilVerdict): boolean {
    return false;
}
