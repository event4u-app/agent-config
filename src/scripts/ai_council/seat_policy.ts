import {
    classifyContentClass as _classifyContentClass,
    DEFAULT_SEAT_CEILING as _DEFAULT_SEAT_CEILING,
} from './content_ceiling.js';

/**
 * Seat policy — the vocabulary for refusing a route that IS reachable.
 *
 * road-to-admissible-council-seats 2.1. `AbsentReason` was exactly four values
 * — `no_binary | no_auth | timeout | quota` — and every one of them means "the
 * route is not reachable". A route that is reachable and **must not be used**
 * had no name at all, so the resolver could not fail closed on terms, privacy,
 * unproven cost, or a served model that is not the requested one. The absence
 * of a word was the absence of the refusal: `resolveTransport`'s `api`/`cli`
 * branches return `available: true` unconditionally, so anything the four
 * reachability reasons could not express resolved OPEN.
 *
 * ## Fail closed on the unknown, which is the whole point
 *
 * `classifyPolicyExclusion` maps anything it does not recognise to
 * `policy_unknown`, and `policy_unknown` is an ABSENT reason like every other
 * member of this union. An unrecognised policy token is the case where the
 * config is trying to say something the code cannot understand; resolving it
 * to "available" would make a typo an authorisation. This is the roadmap's own
 * Risk 3 — "a new refusal vocabulary defaults open instead of closed".
 *
 * ## What this is NOT
 *
 * It is not a secrets floor. Redaction (`skills/ai-council/references/
 * cost-and-redaction.md`) still runs underneath and is not replaced. It is not
 * an authorisation either: nothing here ever makes a seat available that was
 * not already available — every value in the union only ever subtracts.
 */

/** Reachable-but-refused reasons. Every value means ABSENT. */
export const POLICY_EXCLUSIONS = [
    /** The provider's terms forbid this use of the route. */
    'policy_terms',
    /** A privacy constraint forbids sending to this route. */
    'policy_privacy',
    /** The route's cost property is asserted rather than proven. */
    'policy_unproven_cost',
    /** The route serves a model other than the one requested. */
    'policy_model_mismatch',
    /** 2.2 — the payload's content class exceeds the seat's ceiling. */
    'policy_content_ceiling',
    /** The config named an exclusion this build does not understand. */
    'policy_unknown',
] as const;

export type PolicyExclusion = (typeof POLICY_EXCLUSIONS)[number];

const _SET: ReadonlySet<string> = new Set<string>(POLICY_EXCLUSIONS);

/** True for a value this build can act on. `policy_unknown` included: it is a
 *  real, actionable verdict (refuse), not a parse failure. */
export function isPolicyExclusion(v: unknown): v is PolicyExclusion {
    return typeof v === 'string' && _SET.has(v);
}

/**
 * Any configured value → a verdict. Unrecognised input, including `null` used
 * where a string was meant, becomes `policy_unknown` — never `null`, because a
 * `null` return would put the caller back in the position of deciding what an
 * unreadable policy means, which is where the open default came from.
 *
 * `undefined` and `null` are the two ways of saying "no exclusion configured"
 * and are the ONLY inputs that return `null`. Everything else is a refusal.
 */
export function classifyPolicyExclusion(raw: unknown): PolicyExclusion | null {
    if (raw === undefined || raw === null) {
        return null;
    }
    return isPolicyExclusion(raw) ? raw : 'policy_unknown';
}

/** One-line human reason for a refusal. `council:status` prints this. */
export function policyExclusionReason(p: PolicyExclusion, provider?: string): string {
    const who = provider === undefined ? 'this seat' : provider;
    switch (p) {
        case 'policy_terms':
            return `${who} is excluded by policy: the route's terms forbid this use`;
        case 'policy_privacy':
            return `${who} is excluded by policy: a privacy constraint forbids this route`;
        case 'policy_unproven_cost':
            return `${who} is excluded by policy: the route's cost property is asserted, not proven`;
        case 'policy_model_mismatch':
            return `${who} is excluded by policy: the route serves a model other than the one requested`;
        case 'policy_content_ceiling':
            return `${who} is excluded by policy: the payload exceeds the seat's content ceiling`;
        case 'policy_unknown':
            return `${who} is excluded by policy: an exclusion this build does not understand (failing closed)`;
    }
}

// ── the three per-seat fields config.ts parses ───────────────────────────

/**
 * Parsed together because they are one question — "what may this seat do, and
 * if it may do nothing, why" — and because `config.ts` sits ~670 lines past
 * the 1,500-line source ceiling, where every line costs one excess line.
 *
 * Returns an error MESSAGE rather than throwing so `config.ts` keeps raising
 * its own `CouncilConfigError` (which its callers catch by type) without this
 * module importing it and creating a cycle back into the loader.
 */
export interface SeatFields {
    readonly disabled_reason: string | null;
    readonly policy_exclusion: PolicyExclusion | null;
    readonly content_ceiling: import('./content_ceiling.js').ContentClass;
}

export function parseSeatFields(
    name: string,
    raw: Record<string, unknown>,
): { fields: SeatFields } | { error: string } {
    const dr = raw['disabled_reason'];
    let disabled_reason: string | null = null;
    if (dr !== undefined && dr !== null) {
        if (typeof dr !== 'string' || dr.trim() === '') {
            return {
                error:
                    `members.${name}.disabled_reason must be a non-empty string when set ` +
                    `(got ${JSON.stringify(dr)}).`,
            };
        }
        disabled_reason = dr.trim();
    }
    // Both of the next two fail CLOSED on an unreadable value: an unknown
    // exclusion token becomes `policy_unknown` (which resolves ABSENT) and an
    // unknown ceiling falls back to the RESTRICTIVE one. Throwing instead would
    // be defensible, but a config typo would then take the whole council down
    // rather than the one seat it names.
    return {
        fields: {
            disabled_reason,
            policy_exclusion: classifyPolicyExclusion(raw['policy_exclusion']),
            content_ceiling: _classifyContentClass(raw['content_ceiling'], _DEFAULT_SEAT_CEILING),
        },
    };
}
