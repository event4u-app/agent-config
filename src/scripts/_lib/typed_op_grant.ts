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
 * THE ASK ALSO NAMES THE VERB AND THE TURN. A CONFIRMATION THAT CANNOT SAY
 * WHICH TURN IT CAME FROM IS NOT A THIS-TURN CONFIRMATION.
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
 * **What the exactness check is, and why it is two tiers.** It used to be a
 * shape-free heuristic — eight characters, one of them not a letter — which
 * accepted `!!!!!!!!` and `all-branches` alike, so the "exact object" guarantee
 * the Hard Floor rests on was not real. It is now a universal floor that every
 * op passes through, plus a per-op shape where one is declared. The floor is
 * deliberately the weakest claim that cannot be wrong (an object with no
 * alphanumeric run names nothing); the shape is where a category is actually
 * refused. An op with NO declared shape keeps the old heuristic above the floor
 * rather than being refused by default, because a Hard-Floor ask that can never
 * be answered is worse than a loose one. The residual that leaves is real and
 * bounded: a category still grants for an op OUTSIDE the declared set, and the
 * declared set is drawn from the Hard Floor's own list of gated operations.
 *
 * Pure.
 */

/** What the council said about this op. `null` when it was not consulted. */
export type CouncilVerdict = 'in-mission' | 'out-of-mission' | 'unavailable' | null;

/** The ask, as `non-destructive-by-default` requires it: an exact object. */
export interface ExactObjectAsk {
    /** e.g. `force-push`. Blank is not a verb, and a blank verb never grants. */
    readonly op: string;
    /**
     * The object, named concretely — a branch and SHA, a recipient and subject,
     * an amount and card-last4. A CATEGORY is not an object.
     */
    readonly object: string;
    /** True once a human answered this ask. */
    readonly confirmed: boolean;
    /**
     * The turn the human answered in, compared against the caller's current
     * turn. A bare boolean cannot express the Hard Floor's THIS-TURN wording:
     * an ask persisted into a mission record and read back after a restart is
     * otherwise indistinguishable from a confirmation given a second ago. That
     * replay-across-restart case is the concrete threat, and the sibling module
     * `mission_record` is what makes it concrete.
     */
    readonly confirmed_turn: string;
}

export type GrantState = 'vetoed' | 'ask-required' | 'granted';

export interface GrantDecision {
    readonly state: GrantState;
    readonly reason: string;
}

/** Whitespace-separated parts of an object, empties dropped. */
function parts(object: string): string[] {
    return object.trim().split(/\s+/).filter((p) => p.length > 0);
}

/** A part with its surrounding punctuation removed, so `@abc123,` reads as `abc123`. */
function bare(part: string): string {
    return part.replace(/^[^0-9a-z]+/i, '').replace(/[^0-9a-z]+$/i, '');
}

/** Does this text name anything at all? The universal floor, and the weakest claim made here. */
function namesSomething(object: string): boolean {
    return /[0-9a-z]{2,}/i.test(object);
}

/** A 7-to-40 character hex run — the token that pins a push to one commit. */
function isSha(part: string): boolean {
    return /^[0-9a-f]{7,40}$/i.test(bare(part));
}

/** An address-shaped part — the token that pins a send to one recipient. */
function isRecipient(part: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(bare(part));
}

/** A money-shaped part — a decimal amount, or digits carrying a currency marker. */
function isAmount(part: string): boolean {
    return /\d[.,]\d{2}\b/.test(part) || (/\d/.test(part) && /[€$£]|\b(?:EUR|USD|GBP)\b/i.test(part));
}

/** A four-digit run — the card suffix that pins a purchase to one instrument. */
function isCardSuffix(part: string): boolean {
    return /(?:^|\D)\d{4}$/.test(bare(part)) && !isAmount(part);
}

/** Is there a part that carries a name, other than the one already accounted for? */
function hasQualifier(ps: string[], accountedFor: (p: string) => boolean): boolean {
    return ps.some((p) => !accountedFor(p) && /[0-9a-z]{2,}/i.test(bare(p)));
}

/**
 * The declared per-op object shapes.
 *
 * Keyed by the typed-op vocabulary, looked up case-insensitively on a trimmed
 * op. Only the ops whose exact object this repository has actually seen or that
 * the roadmap specifies are declared — inventing a shape for an op with no
 * example risks refusing the first real one, which is the Risk-1 direction.
 *
 * `tag-or-release` is deliberately absent: a release object may legitimately be
 * a bare version, so a SHA requirement would refuse a real one.
 */
const OBJECT_SHAPES: ReadonlyMap<string, (object: string) => boolean> = new Map([
    // A push names WHERE and WHICH COMMIT. The remote is optional — the shipped
    // object in the unit fixture names a ref and a SHA and no remote, so
    // requiring one would refuse an object this repository already ships.
    ...(['push', 'force-push', 'merge-to-trunk', 'history-rewrite'] as const).map(
        (op) =>
            [
                op,
                (object: string): boolean => {
                    const ps = parts(object);
                    return ps.some(isSha) && hasQualifier(ps, isSha);
                },
            ] as const,
    ),
    [
        'send',
        (object: string): boolean => {
            const ps = parts(object);
            return ps.some(isRecipient) && hasQualifier(ps, isRecipient);
        },
    ] as const,
    [
        'purchase',
        (object: string): boolean => {
            const ps = parts(object);
            return ps.some(isAmount) && ps.some(isCardSuffix);
        },
    ] as const,
]);

/**
 * A named object must be specific enough to be checkable.
 *
 * Exported so the two tiers are testable separately: a caller can ask whether an
 * object would survive the floor without also asking which op it belongs to.
 */
export function objectIsExact(op: string, object: string): boolean {
    if (!namesSomething(object)) return false;
    const shape = OBJECT_SHAPES.get(op.trim().toLowerCase());
    if (shape !== undefined) return shape(object);
    // No declared shape: the pre-existing heuristic, above the floor.
    return object.trim().length >= 8 && /[^a-z ]/i.test(object);
}

/** An op names what is about to happen. Blank names nothing. */
function opIsNamed(op: string): boolean {
    return op.trim().length > 0;
}

/**
 * Decide whether a typed op may proceed.
 *
 * The order is fixed: veto first, then the verb, then the confirmation, then
 * the turn, then the object. A confirmed ask after a veto is still a veto —
 * otherwise the veto would be advisory, and an advisory veto is not one. The
 * verb is read before the object because it decides which object shape applies.
 *
 * `currentTurn` is REQUIRED rather than optional. An optional turn would make
 * the this-turn check something a caller opts into, and a security check that
 * is off by default is not one.
 */
export function grantFor(
    verdict: CouncilVerdict,
    ask: ExactObjectAsk,
    currentTurn: string,
): GrantDecision {
    if (verdict === 'out-of-mission') {
        return {
            state: 'vetoed',
            reason: `the council found ${ask.op} outside this mission; a veto is not overridden by a later confirmation`,
        };
    }
    if (!opIsNamed(ask.op)) {
        return {
            state: 'ask-required',
            reason: 'the ask names no operation — the verb that says what is about to happen is blank',
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
    if (currentTurn.trim().length === 0 || ask.confirmed_turn.trim().length === 0) {
        return {
            state: 'ask-required',
            reason: `the confirmation for ${ask.op} carries no turn, so it cannot be shown to be this turn`,
        };
    }
    if (ask.confirmed_turn !== currentTurn) {
        return {
            state: 'ask-required',
            reason: `the confirmation for ${ask.op} was given in turn ${ask.confirmed_turn}, not this turn (${currentTurn})`,
        };
    }
    if (!objectIsExact(ask.op, ask.object)) {
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
