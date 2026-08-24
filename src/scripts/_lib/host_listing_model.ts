/**
 * host_listing_model — which skill DESCRIPTIONS survive the host's listing budget.
 *
 * WHY THIS EXISTS. This package projects ~290 skills and the host does not
 * deliver ~290 descriptions. Until now that was learned one bare catalogue entry
 * at a time, from a single first-party observation
 * (`agents/evidence/analysis/skill-catalogue-description-delivery.md`, 2026-08-08:
 * five of eight sampled entries arrived bare while all 414 carried a description
 * on disk). The mechanism behind it is documented upstream and was modelled
 * nowhere in this tree — `grep -rn skillListingBudgetFraction src docs agents`
 * returned zero hits before this file.
 *
 * THE MECHANISM, AS DOCUMENTED UPSTREAM (code.claude.com/docs/en/skills and
 * anthropics/claude-code#64606, both read 2026-08-22). Claude Code lists every
 * skill NAME, and keeps DESCRIPTIONS only up to a fraction of the context
 * window — 1% by default, ≈8,000 characters on a 200k window — filling by
 * invocation frequency and capping each entry at 1,536 characters. The fraction
 * is consumer-settable as `skillListingBudgetFraction`.
 *
 * WHAT THIS FILE IS AND IS NOT. It is a pure function over a catalogue and a set
 * of numbers. It is NOT a measurement of the host: every input above is upstream
 * PROSE, and three further behaviours the prose leaves open had to be chosen
 * here. Each such choice is returned in `assumptions`, by id, with the reason —
 * so a caller that reports "skill X will arrive bare" can always say which part
 * of that is documented and which part is this repo's guess. The single pinned
 * observation disagrees with the model on two of eight entries, and
 * `tests/scripts/host_listing_model.test.ts` asserts the disagreement rather
 * than tuning it away.
 *
 * Pure — no I/O, no clock, no process state.
 */

/** One catalogue entry as the host is offered it. */
export interface CatalogueEntry {
    /** Skill (or wrapped-command) name, as the host lists it. */
    name: string;
    /** Length of the `description:` frontmatter value, in characters. */
    descriptionChars: number;
}

/** A behaviour this model had to pin down that upstream states as prose. */
export interface ModelAssumption {
    id:
        | 'budget-unit-is-chars'
        | 'fill-order-is-invocation-frequency'
        | 'names-are-never-dropped'
        | 'stop-at-first-overflow'
        | 'wrapper-overhead-unmodelled';
    /** Always `upstream-prose` today. A value measured in this repo would not be an assumption. */
    provenance: 'upstream-prose';
    why: string;
}

export type FillOrder = 'usage' | 'alphabetical-fallback';

export interface HostListingModelInput {
    /** Host context window, in tokens (200_000 for the default Claude Code model). */
    contextWindowTokens: number;
    /** `skillListingBudgetFraction`. */
    fraction?: number;
    /** Per-entry description cap, in characters. */
    perEntryCapChars?: number;
    /** Characters per token used to turn the token-denominated budget into chars. */
    charsPerToken?: number;
    /** Per-entry wrapper cost (name, punctuation, newlines). Unmodelled upstream; default 0. */
    perEntryOverheadChars?: number;
    /** Names in invocation-frequency order, most-invoked first. Empty / omitted → fallback. */
    usageOrder?: readonly string[];
}

export interface HostListingModelResult {
    /** The description budget for this window, in characters. */
    budgetChars: number;
    /** Which order the fill actually used. */
    fillOrder: FillOrder;
    /** Names whose description is predicted to reach the model. */
    surviving: string[];
    /** Names predicted to arrive listed-but-bare. */
    bare: string[];
    /** Characters the surviving descriptions consume. */
    spentChars: number;
    /** Every behaviour pinned here that upstream leaves as prose. */
    assumptions: readonly ModelAssumption[];
}

/** Documented Claude Code defaults, read 2026-08-22. Not measured in this repo. */
export const CLAUDE_CODE_LISTING_DEFAULTS = {
    fraction: 0.01,
    perEntryCapChars: 1536,
    charsPerToken: 4,
    perEntryOverheadChars: 0,
} as const;

const ASSUMPTIONS: readonly ModelAssumption[] = [
    {
        id: 'budget-unit-is-chars',
        provenance: 'upstream-prose',
        why:
            'The docs give the budget as a fraction of the context window (tokens) and then ' +
            'illustrate it as "≈8,000 characters on 200k", which only reconciles at 4 chars ' +
            'per token. That ratio is inferred from the illustration, never stated.',
    },
    {
        id: 'fill-order-is-invocation-frequency',
        provenance: 'upstream-prose',
        why:
            'Upstream says the budget fills by invocation frequency, but does not say what ' +
            'orders entries when no invocation history exists. This model falls back to ' +
            'alphabetical, which is this repo\'s choice and not upstream behaviour.',
    },
    {
        id: 'names-are-never-dropped',
        provenance: 'upstream-prose',
        why:
            'Claude Code lists every name and budgets only descriptions. Another host ' +
            '(codex) drops whole entries instead, so this is a per-host property and is not ' +
            'transferable to a second host without its own model.',
    },
    {
        id: 'stop-at-first-overflow',
        provenance: 'upstream-prose',
        why:
            'The docs describe filling a budget, not packing one. A shorter later entry ' +
            'might in principle still fit after a longer one has overflowed; this model ' +
            'stops at the first entry that does not fit rather than skipping past it.',
    },
    {
        id: 'wrapper-overhead-unmodelled',
        provenance: 'upstream-prose',
        why:
            'Each delivered entry also costs its name, separators and newlines. Upstream ' +
            'quantifies none of that, so the default overhead here is 0 and the budget is ' +
            'therefore an upper bound on how many descriptions survive.',
    },
];

/**
 * Predict which descriptions the host delivers.
 *
 * `usageOrder` names are placed first, in the given order; everything else
 * follows alphabetically. Entries not present in the catalogue are ignored.
 */
export function modelListingBudget(
    catalogue: readonly CatalogueEntry[],
    input: HostListingModelInput,
): HostListingModelResult {
    const fraction = input.fraction ?? CLAUDE_CODE_LISTING_DEFAULTS.fraction;
    const perEntryCap = input.perEntryCapChars ?? CLAUDE_CODE_LISTING_DEFAULTS.perEntryCapChars;
    const charsPerToken = input.charsPerToken ?? CLAUDE_CODE_LISTING_DEFAULTS.charsPerToken;
    const overhead = input.perEntryOverheadChars ?? CLAUDE_CODE_LISTING_DEFAULTS.perEntryOverheadChars;
    const usageOrder = input.usageOrder ?? [];

    const budgetChars = Math.floor(input.contextWindowTokens * fraction * charsPerToken);
    const fillOrder: FillOrder = usageOrder.length > 0 ? 'usage' : 'alphabetical-fallback';

    const byName = new Map(catalogue.map((e) => [e.name, e]));
    const ordered: CatalogueEntry[] = [];
    const seen = new Set<string>();
    for (const name of usageOrder) {
        const e = byName.get(name);
        if (e && !seen.has(name)) {
            ordered.push(e);
            seen.add(name);
        }
    }
    const rest = catalogue
        .filter((e) => !seen.has(e.name))
        .slice()
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    ordered.push(...rest);

    const surviving: string[] = [];
    const bare: string[] = [];
    let spentChars = 0;
    let overflowed = false;
    for (const e of ordered) {
        if (overflowed) {
            bare.push(e.name);
            continue;
        }
        const cost = Math.min(e.descriptionChars, perEntryCap) + overhead;
        if (spentChars + cost <= budgetChars) {
            surviving.push(e.name);
            spentChars += cost;
        } else {
            overflowed = true;
            bare.push(e.name);
        }
    }

    return { budgetChars, fillOrder, surviving, bare, spentChars, assumptions: ASSUMPTIONS };
}
