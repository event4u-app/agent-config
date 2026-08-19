/**
 * council_fallback_wiring — the api-twin factory and the event sink that
 * `build_members` hands to the orchestrator.
 *
 * Lives here rather than in `council_cli.ts` because that file is 2,700 lines
 * over the source ceiling and the documented fix is extraction
 * (`gate-violation-baselines.json` § check_source_size_budget).
 *
 * Deps are injected rather than imported: `council_cli.ts` owns the provider
 * table, the api constructor and the error classes, and importing them back
 * here would make this module a second place that decides which providers
 * exist. It decides nothing — it wires.
 */

import type { CliFallbackOptions, FallbackEvent } from '../ai_council/mid_flight_fallback.js';
import { CouncilConfigError } from '../ai_council/config.js';

type Dict = Record<string, unknown>;

/** Anything the twin factory needs that `council_cli.ts` owns. */
export interface FallbackWiringDeps {
    readonly apiOnQuota: boolean;
    /** Does this provider have an api constructor at all? */
    readonly hasApiRung: (provider: string) => boolean;
    /** This provider's `members.<name>` block, or `{}`. */
    readonly memberConfig: (provider: string) => Dict;
    /** A `--model` override for this provider, or `null`. */
    readonly modelOverride: (provider: string) => string | null;
    /** The strict api constructor. Throws to refuse; see the catch below. */
    readonly constructApi: (
        name: string,
        model: string | null,
        opts: {
            api_key_ref?: string | null;
            enable_prompt_cache?: boolean;
            prompt_cache_ttl?: '5m' | '1h' | undefined;
        },
    ) => unknown;
    /** The events-log appender. */
    readonly emit: (record: Dict) => unknown;
}

/**
 * Errors that mean "no api rung for this provider" rather than "something
 * broke".
 *
 * `CouncilConfigError` is in this set because it is what key resolution throws
 * on a rotated or removed key — the ORDINARY case. It was missing once, and
 * the escalation escaped the factory, left `consult`, and took down the pass
 * the fallback exists to rescue. A mechanism that turns a recoverable seat
 * loss into a total loss is worse than no mechanism.
 *
 * The other two are matched by NAME rather than by identity: importing
 * `CouncilDisabledError` and `CliClientError` back from `council_cli.ts` would
 * be a cycle, and this module deliberately owns no provider knowledge.
 */
const REFUSAL_NAMES: ReadonlySet<string> = new Set([
    'CouncilDisabledError',
    'CliClientError',
    'CouncilConfigError',
]);

function isRefusal(exc: unknown): boolean {
    if (exc instanceof CouncilConfigError) return true;
    return exc instanceof Error && REFUSAL_NAMES.has(exc.constructor.name);
}

export function buildFallbackOptions(deps: FallbackWiringDeps): CliFallbackOptions {
    return {
        api_on_quota: deps.apiOnQuota,
        // The orchestrator is a pure library and holds no sink; this is it.
        // One line per establishing escalation, so attendance analysis can
        // tell a seat SAVED by the fallback from one that was natively api.
        on_event: (e: FallbackEvent): void => {
            deps.emit({
                action: 'transport_fallback',
                provider: e.provider,
                failure_class: e.failure,
                outcome: e.outcome,
                api_on_quota: e.api_on_quota,
            });
        },
        construct: (provider: string) => {
            if (!deps.hasApiRung(provider)) return null;
            const cfg = deps.memberConfig(provider);
            // Same model resolution the cli member got: override, then
            // config, then the api constructor's own default.
            const model = deps.modelOverride(provider) ?? (cfg['model'] as string | undefined) ?? null;
            try {
                return deps.constructApi(provider, model, {
                    api_key_ref: (cfg['api_key_ref'] as string | null) ?? null,
                    enable_prompt_cache: cfg['prompt_cache'] !== false,
                    prompt_cache_ttl: cfg['prompt_cache_ttl'] as '5m' | '1h' | undefined,
                }) as ReturnType<CliFallbackOptions['construct']>;
            } catch (exc) {
                if (isRefusal(exc)) return null;
                throw exc;
            }
        },
    };
}
