/**
 * The closed set of task kinds a hand may be asked to do: bounded, typed,
 * tool-less work whose output is a proposal the head checks before anything
 * acts on it.
 *
 * Deliberately free of schemas and prompts so the delegation-nudge hook can
 * import it without paying for them in the hook bundle.
 */

export const HAND_KINDS = [
    'classify',
    'extract',
    'summarise-given-text',
    'draft-candidate',
    'test-candidates',
    'finding-proposal',
] as const;
export type HandKind = (typeof HAND_KINDS)[number];

/**
 * Work that stays with the paid head whatever route exists: an unpaid route may
 * propose and score, never decide (ADR-257). These are refused before any route
 * is chosen.
 */
export const HEAD_ONLY_KINDS = ['plan', 'decide', 'chair', 'final-review', 'write'] as const;
export type HeadOnlyKind = (typeof HEAD_ONLY_KINDS)[number];

const _KINDS: ReadonlySet<string> = new Set<string>(HAND_KINDS);
const _HEAD_ONLY: ReadonlySet<string> = new Set<string>(HEAD_ONLY_KINDS);

export function isHandKind(raw: unknown): raw is HandKind {
    return typeof raw === 'string' && _KINDS.has(raw);
}

export function isHeadOnlyKind(raw: unknown): raw is HeadOnlyKind {
    return typeof raw === 'string' && _HEAD_ONLY.has(raw);
}
