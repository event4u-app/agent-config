/**
 * One synthesis-strategy interface behind the five candidates — step 5.1.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 5.1: *"One
 * synthesis-strategy interface behind the candidates (host convener, dedicated
 * external judge, strongest configured model, top-ranked member, dual synthesis
 * + adjudication) — no user-facing mode proliferation"*, verified by *"the
 * user-facing surface gains no new mode names"*.
 *
 * ## The whole point is that this is INTERNAL
 *
 * Five candidates, one interface, and **zero** new flags, choices or synthesis
 * mode names. Every strategy resolves from configuration the engine already
 * reads — `ai_council.chairman.mode` (`host` | `member` | `auto`), the
 * configured member name, and the optional `members.<name>.tier` — so a
 * consumer's surface is byte-identical before and after this module. That is
 * 12.4's rule ("consumer surfaces request capabilities, never topology names")
 * applied to synthesis, and the test file asserts it against the CLI's own
 * option tables rather than trusting this paragraph.
 *
 * ## Selection is NOT reimplemented
 *
 * Every strategy delegates to `select_chairman` (`chairman.ts:42`). A second
 * selection path would be two answers to "who chairs", and the second is the one
 * nobody updates — the same defect 1A.1 forbids for the question hash. What this
 * module adds is a NAME for what the existing selection is doing in each
 * configuration, so Phase 5's showdown has something to compare.
 *
 * ## One candidate is deliberately unreachable, and saying so is the honest part
 *
 * `dual_adjudicated` (dual synthesis plus adjudication) cannot be selected from
 * today's configuration: nothing in `ai_council.chairman` expresses "run two
 * synthesisers and adjudicate". Reaching it needs a new input — which is exactly
 * what 5.1's verify clause forbids adding to the user surface. It is therefore
 * declared in the vocabulary, reported as `reachable: false`, and left
 * unselectable rather than smuggled in behind a flag.
 *
 * Pure: resolution and description only. The billable dispatch stays in
 * `council_cli.ts` `_maybe_run_chairman`, exactly where it already lives.
 */
import { select_chairman } from './chairman.js';
import type { ChairmanCandidate, ChairmanSelection } from './chairman.js';

/** The five candidates 5.1 enumerates, in the order it enumerates them. */
export const SYNTHESIS_STRATEGIES = Object.freeze([
    'host_convener',
    'external_judge',
    'strongest_model',
    'top_ranked_member',
    'dual_adjudicated',
] as const);

export type SynthesisStrategyId = (typeof SYNTHESIS_STRATEGIES)[number];

/** Declared arity, so an append reds the closure assertion in the test. */
export const SYNTHESIS_STRATEGY_ARITY = 5;

/** Exactly the configuration the engine ALREADY reads. No new key appears here. */
export interface SynthesisContext {
    /** `ai_council.chairman.mode` — `host` | `member` | `auto`. */
    readonly chairmanMode: string;
    /** `ai_council.chairman.member` when the mode is `member`. */
    readonly configuredMember: string | null;
    /** Member names that produced a real response this session. */
    readonly deliberated: ReadonlySet<string>;
    /** Enabled members in config order, with their optional `tier`. */
    readonly candidates: readonly ChairmanCandidate[];
}

/** The ONE interface all five candidates sit behind. */
export interface SynthesisStrategy {
    readonly id: SynthesisStrategyId;
    /** Internal description. Never rendered on a user-facing surface. */
    readonly describe: string;
    /** Can today's configuration reach it at all? */
    readonly reachable: boolean;
    /** Extra billable calls beyond the deliberation, at this strategy. */
    readonly extraCalls: number;
    /** Delegates to `select_chairman` — never a second selection path. */
    readonly resolve: (ctx: SynthesisContext) => ChairmanSelection;
}

const _viaChairman = (ctx: SynthesisContext): ChairmanSelection =>
    select_chairman(ctx.chairmanMode, ctx.configuredMember, ctx.deliberated, ctx.candidates);

export const STRATEGIES: Readonly<Record<SynthesisStrategyId, SynthesisStrategy>> = Object.freeze({
    host_convener: {
        id: 'host_convener',
        describe: 'the host that framed the artefact writes the synthesis — today default, zero extra calls',
        reachable: true,
        extraCalls: 0,
        resolve: _viaChairman,
    },
    external_judge: {
        id: 'external_judge',
        describe: 'a named non-deliberating member synthesises — chairman.mode=member',
        reachable: true,
        extraCalls: 1,
        resolve: _viaChairman,
    },
    strongest_model: {
        id: 'strongest_model',
        describe: 'the highest-tier non-deliberating member synthesises — chairman.mode=auto with tiers configured',
        reachable: true,
        extraCalls: 1,
        resolve: _viaChairman,
    },
    top_ranked_member: {
        id: 'top_ranked_member',
        describe:
            'the first non-deliberating member in config order synthesises — chairman.mode=auto with no tiers, ' +
            'where config order is the only ranking the engine trusts',
        reachable: true,
        extraCalls: 1,
        resolve: _viaChairman,
    },
    dual_adjudicated: {
        id: 'dual_adjudicated',
        describe:
            'two synthesisers plus an adjudication pass — NOT reachable from today’s configuration; ' +
            'reaching it needs a new input, which 5.1’s verify clause forbids adding to the user surface',
        reachable: false,
        extraCalls: 3,
        resolve: _viaChairman,
    },
});

/**
 * Which strategy today's configuration IS, named.
 *
 * Reads only `chairmanMode` and whether any candidate carries a tier — both
 * already-read inputs. Returns `null` for a mode the config loader would have
 * rejected, rather than guessing a strategy for an unknown value.
 */
export function resolveSynthesisStrategy(ctx: SynthesisContext): SynthesisStrategy | null {
    if (ctx.chairmanMode === 'host') return STRATEGIES.host_convener;
    if (ctx.chairmanMode === 'member') return STRATEGIES.external_judge;
    if (ctx.chairmanMode === 'auto') {
        const tiered = ctx.candidates.some((c) => c.tier !== null && c.tier !== undefined);
        return tiered ? STRATEGIES.strongest_model : STRATEGIES.top_ranked_member;
    }
    return null;
}

/** Strategies a consumer can actually land on today. `dual_adjudicated` is excluded. */
export function reachableStrategies(): SynthesisStrategyId[] {
    return SYNTHESIS_STRATEGIES.filter((id) => STRATEGIES[id].reachable);
}

/**
 * The config keys this module reads — asserted by the test to contain no key
 * the engine did not already read, so "no new user-facing input" is checkable
 * rather than promised.
 */
export const CONFIG_KEYS_READ: readonly string[] = Object.freeze([
    'ai_council.chairman.mode',
    'ai_council.chairman.member',
    'ai_council.members.<name>.tier',
]);
