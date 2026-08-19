/**
 * council_fallback_posture — "would this seat have an api rung to fall back
 * to?", for `council:status`.
 *
 * Lives here rather than in `council_cli.ts` because that file is 2,700 lines
 * over the source ceiling and the documented fix is extraction
 * (`gate-violation-baselines.json` § check_source_size_budget).
 *
 * The posture is derived from the SAME two facts the twin factory in
 * `build_members` uses — the provider has an api constructor, and its key
 * resolves — so the line `council:status` prints and the retry that actually
 * happens cannot disagree. It deliberately does not CONSTRUCT the client:
 * `council:status` is the one command that must stay free of side effects.
 */

export type FallbackPosture = 'api' | 'none' | 'n/a';

export interface PostureInput {
    /** Resolved transport for this member; `null` when it did not resolve. */
    readonly transport: string | null;
    /** Does the provider have an api constructor at all? */
    readonly hasApiRung: boolean;
    /** The member's own `api_key_ref`, or `null` when it sets none. */
    readonly apiKeyRef: string | null;
    /** Does that explicit ref resolve? `undefined` when there is no ref. */
    readonly refResolves: boolean | undefined;
    /**
     * The keyless loader for this provider, when one exists. Only anthropic
     * and openai have one; the strict constructors refuse without an explicit
     * ref. Probed rather than assumed — the generic loader can come up empty,
     * and reporting `'api'` on the strength of the provider name would print
     * a rung that is not there.
     */
    readonly keylessResolves: (() => boolean) | undefined;
}

/**
 * `'n/a'` for a member that is not on the cli rung: there is nothing to fall
 * back FROM, and reporting `'none'` there would read as a missing capability
 * rather than an inapplicable question.
 */
export function fallbackPostureFor(input: PostureInput): FallbackPosture {
    if (input.transport !== 'cli') return 'n/a';
    if (!input.hasApiRung) return 'none';
    if (input.apiKeyRef !== null) return input.refResolves === true ? 'api' : 'none';
    if (input.keylessResolves === undefined) return 'none';
    try {
        return input.keylessResolves() ? 'api' : 'none';
    } catch {
        return 'none';
    }
}

/**
 * The `council:status` lines for the fallback posture.
 *
 * Returns `[]` when no seat is on the cli rung: there is nothing to fall back
 * FROM, and a heading over an empty list reads as a missing capability.
 */
export function renderPostureLines(
    postures: ReadonlyArray<readonly [string, FallbackPosture]>,
    apiOnQuota: boolean,
): string[] {
    const live = postures.filter(([, p]) => p !== 'n/a');
    if (live.length === 0) return [];
    const lines = live.map(
        ([name, p]) =>
            `  fallback         ${name}: ` +
            (p === 'api'
                ? 'would fall back to api'
                : 'no api rung — a lost cli transport loses the seat'),
    );
    // Separate from the per-seat lines: not a per-seat property but the one
    // billing-class decision, governing every seat at once.
    lines.push(
        `  fallback quota   api_on_quota: ${apiOnQuota ? 'on' : 'off'}` +
            ` — an exhausted cli quota ${apiOnQuota ? 'MAY' : 'may not'}` +
            ' retry on the metered rung',
    );
    return lines;
}
