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

import type { ApiOnQuota } from '../ai_council/transport_resolver.js';

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
    apiOnQuota: ApiOnQuota,
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
    // Three postures, rendered by name rather than by truthiness. `'ask'` is
    // truthy, so an `apiOnQuota ? 'on' : 'off'` reading would print `on` for
    // it — telling the operator that quota fall-through happens silently when
    // the whole point of the value is that it does not.
    const word = apiOnQuota === 'ask' ? 'ask' : apiOnQuota ? 'on' : 'off';
    const consequence =
        apiOnQuota === 'ask'
            ? ' — an exhausted cli quota PARKS the seat and the round closes with a question,' +
              ' unless a run-scoped billing grant is already in force'
            : apiOnQuota
              ? ' — an exhausted cli quota MAY retry on the metered rung'
              : ' — an exhausted cli quota may not retry on the metered rung';
    lines.push(`  fallback quota   api_on_quota: ${word}${consequence}`);
    return lines;
}

/**
 * The Human Gate a round closes with when `api_on_quota: 'ask'` parked seats.
 *
 * A correction to this roadmap step, recorded rather than quietly absorbed:
 * the step said to render this "through the existing `renderPostureLines`
 * path". That path is `council:status`, which runs before any round and can
 * therefore never know which seats a round parked. So this is a sibling in the
 * same module rather than a branch inside that function — same place, same
 * vocabulary, different moment.
 *
 * Returns `[]` when nothing parked, so a caller may render unconditionally
 * without a heading over an empty list.
 */
export function renderBillingGateLines(
    parked: readonly string[],
    opts: { readonly runId: string; readonly estimatedUsd: number | null },
): string[] {
    if (parked.length === 0) return [];
    const seats = [...new Set(parked)].sort();
    const cost =
        opts.estimatedUsd === null
            ? 'unknown — no priced estimate for the retry'
            : `~$${opts.estimatedUsd.toFixed(2)}`;
    return [
        '',
        'HUMAN GATE — plan quota exhausted, metered spend not authorised',
        `  parked seats     ${seats.join(', ')}`,
        `  retry cost       ${cost}`,
        // The command is printed rather than described because the whole
        // mechanism fails if answering it takes a lookup: an operator who has
        // to go find the syntax is an operator who says yes tomorrow, on a run
        // that has already ended.
        `  to authorise     agent-config council:grant-billing ${opts.runId}`,
        '  to decline       do nothing — the grant is never implied by silence',
    ];
}
