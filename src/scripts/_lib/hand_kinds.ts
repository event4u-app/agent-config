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

/** How a route is paid for; the two unpaid classes are the hands whose every return the head must verify. */
export const ROUTE_BILLINGS = ['free-quota', 'self-hosted', 'per-token', 'subscription'] as const;
export type RouteBilling = (typeof ROUTE_BILLINGS)[number];

export function isUnpaid(billing: RouteBilling): boolean {
    return billing === 'free-quota' || billing === 'self-hosted';
}

/** The head's verdict on one hand's return; `skipped` is recorded, never silent. */
export const VERIFY_VERDICTS = ['pass', 'fail', 'skipped'] as const;
export type VerifyVerdict = (typeof VERIFY_VERDICTS)[number];

export function isHandKind(raw: unknown): raw is HandKind {
    return typeof raw === 'string' && _KINDS.has(raw);
}

/** Leading-verb shapes, most specific first: "propose tests" is not "propose findings" or "draft". */
const KIND_FROM_PROMPT: ReadonlyArray<readonly [RegExp, HandKind]> = [
    [/^\s*(?:propose|suggest|draft|write)\s+(?:unit\s+)?test(?:s|\s+cases?|\s+candidates?)?\b/i, 'test-candidates'],
    [/^\s*(?:propose|list)\s+(?:review\s+)?findings?\b/i, 'finding-proposal'],
    [/^\s*(?:classify|categori[sz]e|label)\b/i, 'classify'],
    [/^\s*extract\b/i, 'extract'],
    [/^\s*summari[sz]e\b/i, 'summarise-given-text'],
    [/^\s*draft\b/i, 'draft-candidate'],
];

/** The hand kind a slice names, or null; deterministic, so a nudge can only cite a kind it matched. */
export function handKindFromPrompt(text: string): HandKind | null {
    for (const [re, kind] of KIND_FROM_PROMPT) if (re.test(text)) return kind;
    return null;
}

export function isHeadOnlyKind(raw: unknown): raw is HeadOnlyKind {
    return typeof raw === 'string' && _HEAD_ONLY.has(raw);
}
