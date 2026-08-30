/**
 * The privacy class an audit-log-v1 line declares about ITSELF.
 *
 * `docs/contracts/audit-log-v1.md` states a privacy floor in prose and, until
 * 2026-08-30, named a test file that exists in no tree — so the floor was
 * asserted and not enforced. Two things close that gap, and they are different
 * mechanisms rather than one restated twice:
 *
 * 1. A COMPILE-TIME guard (`NoFreeForm`, applied to each producer's input type)
 *    makes a field that *could* hold a body a build error. That is what stops
 *    the leak.
 * 2. This enum makes each line SAY what it carries. That is what lets a reader
 *    decide whether a stream is safe to aggregate, export, or ship without
 *    re-deriving the answer from the producer's source.
 *
 * The first without the second leaves every consumer inferring the class; the
 * second without the first is a label with nothing behind it.
 *
 * One module rather than a literal per producer, per step 9.1's rule that an
 * enum family appearing in more than one place gets exactly one definition —
 * the duplicate-enum failure that gave this tree two outcome vocabularies.
 */

/**
 * Ordered from least to most permissive. A reader may treat a lower class as
 * satisfying any assertion made about a higher one; the reverse is never true.
 */
export const PRIVACY_CLASSES = [
    /**
     * Counts, enums, timestamps and opaque ids the package itself minted. No
     * artefact names at all. The strictest class a line can declare.
     */
    'counts-only',
    /**
     * Everything `counts-only` allows, plus STABLE ARTEFACT IDS the package
     * governs — rule ids, skill ids, task-class ids. Still no bodies, no paths,
     * no user content, and no third-party identifiers. This is what both
     * shipped producers emit, because both carry `rules_applied`.
     */
    'ids-only',
] as const;

export type PrivacyClass = (typeof PRIVACY_CLASSES)[number];

export function isPrivacyClass(v: unknown): v is PrivacyClass {
    return typeof v === 'string' && (PRIVACY_CLASSES as readonly string[]).includes(v);
}
