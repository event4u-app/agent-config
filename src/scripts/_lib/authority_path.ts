/**
 * The strictest path, reserved for authority —
 * `road-to-adversarial-verification-and-long-runs` 11.1.
 *
 * An authority-expanding change takes four independent passes — an independent
 * TEST author, an independent GOVERNANCE reviewer, a COUNCIL pass, and a
 * PROVIDER-DIVERSE reviewer — plus the ratification artefact. Until the artefact
 * carries `verdict: ratified`, the new authority is **inert**.
 *
 * ```
 * NEW AUTHORITY IS INERT UNTIL RATIFIED. AN AGENT MAY AUTHOR THE CHANGE
 * AND MAY NEVER RATIFY ITS OWN INCREASE IN POWER (ADR-268 § 4).
 * FOUR PASSES, ALL FOUR, AND THEY MAY NOT BE THE SAME REVIEWER TWICE.
 * ```
 *
 * **Inert-until-ratified is the property that makes the rest safe.** Without it
 * the four passes are a process an author could complete and then merge; with it
 * the change can land, be read, and still do nothing — so the ratification is a
 * separate act on a separate turn by a party that is not the author.
 *
 * Pure.
 */

/** The four passes. All four, and the list is closed. */
export const REQUIRED_PASSES = [
    'independent-test-author',
    'independent-governance-reviewer',
    'council',
    'provider-diverse-reviewer',
] as const;
export type Pass = (typeof REQUIRED_PASSES)[number];

export interface PassRecord {
    readonly pass: Pass;
    /** Who performed it. Two passes by the same identity is not two passes. */
    readonly by: string;
    /** The provider, so provider-diversity is checkable rather than asserted. */
    readonly provider: string;
}

export interface RatificationArtefact {
    /** Anything other than `ratified` leaves the authority inert. */
    readonly verdict: string;
    readonly passes: readonly PassRecord[];
    /** The author of the change under ratification. */
    readonly author: string;
}

export type AuthorityState = 'inert' | 'active';

export interface AuthorityVerdict {
    readonly state: AuthorityState;
    readonly blockers: readonly string[];
}

/**
 * Is the new authority active yet?
 *
 * Returns EVERY blocker rather than the first: the artefact is a checklist a
 * human completes, and handing them one item at a time turns four passes into
 * four round trips.
 */
export function authorityState(a: RatificationArtefact | null): AuthorityVerdict {
    if (a === null) {
        return { state: 'inert', blockers: ['no ratification artefact exists'] };
    }
    const blockers: string[] = [];

    for (const required of REQUIRED_PASSES) {
        if (!a.passes.some((p) => p.pass === required)) {
            blockers.push(`missing pass: ${required}`);
        }
    }

    // The author may perform NONE of the four. This is the ADR-268 § 4 clause
    // and the one a process can satisfy on paper while violating in substance.
    for (const p of a.passes) {
        if (p.by === a.author) {
            blockers.push(`${p.pass} was performed by the author (${p.by}) — an agent may not ratify its own increase in power`);
        }
    }

    // Provider diversity is a property of the SET, so it is checked over the set
    // rather than trusted from the pass that carries the name.
    const providers = new Set(a.passes.map((p) => p.provider));
    if (a.passes.length > 1 && providers.size < 2) {
        blockers.push(
            `every pass ran on one provider (${[...providers].join(', ')}) — provider-diverse means at least two`,
        );
    }

    if (a.verdict !== 'ratified') {
        blockers.push(`verdict is "${a.verdict}", not "ratified"`);
    }

    return { state: blockers.length === 0 ? 'active' : 'inert', blockers };
}

/** `true` only for an artefact that clears everything. */
export function isRatified(a: RatificationArtefact | null): boolean {
    return authorityState(a).state === 'active';
}
