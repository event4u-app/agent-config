/**
 * One binary content ceiling per seat — road-to-admissible-council-seats 2.2.
 *
 * Redaction today is a SECRETS floor and says so
 * (`src/skills/ai-council/references/cost-and-redaction.md`). Nothing above it
 * could express "this project's diff may not go to that seat", which is a
 * different question with a different answer: a diff carrying no secret at all
 * is still the consumer's private source.
 *
 * Deliberately BINARY. A graded scale invites a middle value nobody can define
 * and every caller reads differently; two values force the decision at
 * authoring time, where it belongs.
 *
 *   public-artifact  — repo-owned artefacts: skill descriptions, the trigger
 *                      corpus, rule text, bench fixtures. Already public.
 *   project-content  — everything a consumer supplies. The DEFAULT, so an
 *                      unclassified payload is treated as private rather than
 *                      as publishable.
 *
 * A seat's ceiling is the most sensitive class it may receive. `public-artifact`
 * is therefore the NARROWER seat: it admits public artefacts only.
 */

export const CONTENT_CLASSES = ['public-artifact', 'project-content'] as const;
export type ContentClass = (typeof CONTENT_CLASSES)[number];

/** The default for anything not explicitly classified: private, not public. */
export const DEFAULT_CONTENT_CLASS: ContentClass = 'project-content';

/** The default seat ceiling: unchanged behaviour for every existing seat. */
export const DEFAULT_SEAT_CEILING: ContentClass = 'project-content';

const _SET: ReadonlySet<string> = new Set<string>(CONTENT_CLASSES);

/**
 * Any configured value → a content class. Unrecognised input becomes
 * `project-content`, the RESTRICTIVE value: a typo must narrow what a seat may
 * receive, never widen it.
 */
export function classifyContentClass(raw: unknown, fallback: ContentClass = DEFAULT_CONTENT_CLASS): ContentClass {
    if (typeof raw === 'string' && _SET.has(raw)) {
        return raw as ContentClass;
    }
    return fallback;
}

export interface CeilingVerdict {
    readonly admitted: boolean;
    /** Non-null exactly when `admitted` is false. */
    readonly reason: string | null;
}

/**
 * Does a seat whose ceiling is `seatCeiling` admit a payload of `contentClass`?
 *
 * The one refusal is `project-content` into a `public-artifact` seat. Every
 * other pairing is admitted, including public artefacts into a
 * `project-content` seat — a seat cleared for private content is trivially
 * cleared for public content, and refusing that would be a nonsense that
 * disables the default seat for its own repo's fixtures.
 *
 * Refusal is a GREEN path (this roadmap's 2.2 verify): the caller drops the
 * seat and the run continues. It is not an error, because a policy working as
 * designed is not a failure.
 */
export function admitsContent(
    seatCeiling: ContentClass,
    contentClass: ContentClass,
): CeilingVerdict {
    if (seatCeiling === 'public-artifact' && contentClass === 'project-content') {
        return {
            admitted: false,
            reason:
                "seat ceiling is 'public-artifact'; the payload is classified " +
                "'project-content' (consumer-supplied)",
        };
    }
    return { admitted: true, reason: null };
}
