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
import type { ApiOnQuota } from '../ai_council/transport_resolver.js';
import { parseApiOnQuota } from '../ai_council/transport_resolver.js';
import { hasBillingGrant } from './billing_grant.js';
import { CouncilConfigError } from '../ai_council/config.js';

type Dict = Record<string, unknown>;

/** Anything the twin factory needs that `council_cli.ts` owns. */
export interface FallbackWiringDeps {
    readonly apiOnQuota: ApiOnQuota;
    /** Run-scoped billing grant in force. Read only under `'ask'`. */
    readonly billingGrant?: boolean;
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
    // R2 round 6, critical finding 1 — and the docblock above already told the
    // story one name short. `KeyGateError` is what an api-twin construction
    // raises when the provider key is absent or violates the 0600 contract,
    // which is the ORDINARY shape of the very configuration this fallback
    // targets: a cli member under subscription auth, no `api_key_ref`, no
    // local key. It escaped `construct()`, escaped `consult()`, and is not in
    // `main`'s catch list — so instead of losing one seat, the whole pass died
    // with an unhandled exception. A mechanism that turns a recoverable seat
    // loss into a total loss is worse than no mechanism, which is the sentence
    // directly above this list.
    'KeyGateError',
]);

function isRefusal(exc: unknown): boolean {
    if (exc instanceof CouncilConfigError) return true;
    return exc instanceof Error && REFUSAL_NAMES.has(exc.constructor.name);
}

export function buildFallbackOptions(deps: FallbackWiringDeps): CliFallbackOptions {
    // Owned here, not passed in. `establishTwin` emits `awaiting_grant` and
    // this is the nearest thing to it that outlives one call, so a caller
    // wanting the closing question reads `options.parked` instead of
    // threading a collector through the factory.
    const parked: string[] = [];
    return {
        api_on_quota: deps.apiOnQuota,
        billing_grant: deps.billingGrant === true,
        parked,
        // The orchestrator is a pure library and holds no sink; this is it.
        // One line per establishing escalation, so attendance analysis can
        // tell a seat SAVED by the fallback from one that was natively api.
        on_event: (e: FallbackEvent): void => {
            // Wrapped, for the reason `appendQuorumEvent` states for the
            // identical call: an events-log write is best-effort telemetry, and
            // a failed one (read-only mount, full disk, a permission change on
            // agents/runtime) must not take the council pass down with it.
            //
            // R2 round 2, finding 7. Unwrapped, this throws out of `on_event`,
            // out of `establishTwin`, and out of `consult` — so a disk problem
            // during a fallback kills the whole round, and the mechanism whose
            // entire purpose is to SAVE a seat becomes the thing that loses
            // every seat. Losing the log line is the strictly smaller failure.
            if (e.outcome === 'awaiting_grant') parked.push(e.provider);
            try {
                deps.emit({
                    action: 'transport_fallback',
                    provider: e.provider,
                    failure_class: e.failure,
                    outcome: e.outcome,
                    api_on_quota: e.api_on_quota,
                });
            } catch {
                /* best-effort telemetry — never fail the pass */
            }
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

/** Everything `wireCouncilFallback` needs that `council_cli.ts` owns. */
export interface CallSiteDeps {
    readonly repoRoot: string;
    readonly isDict: (v: unknown) => v is Dict;
    readonly membersCfg: Dict;
    readonly overrides: Dict;
    readonly hasApiRung: (provider: string) => boolean;
    readonly constructApi: FallbackWiringDeps['constructApi'];
    readonly emit: (record: Dict) => unknown;
}

/**
 * Build the fallback factory from the raw `ai_council` block and hand it back
 * through the out-param `build_members` threads.
 *
 * Extracted from `council_cli.ts` when the billing-grant read joined the two
 * config reads already here: that file is ~2,500 lines over the source ceiling
 * and the documented remedy is extraction rather than a raised baseline
 * (`gate-violation-baselines.json` § check_source_size_budget). Keeping the
 * derivation next to the factory it feeds is the better shape anyway — the
 * caller had to know that an absent `fallback` block means `false` and that
 * the grant is read per-run, neither of which is the caller's business.
 */
export function wireCouncilFallback(
    out: { options: CliFallbackOptions | null } | null,
    ai: Dict,
    d: CallSiteDeps,
): void {
    // The null check lives here, not at the call site: `fallback_out` is an
    // optional out-param and "the caller passed no ref" is this function's
    // business, not a branch every caller has to remember.
    if (out === null) return;
    // Absent/malformed block means `false`, never a throw. Why quota
    // fall-through is opt-in: `FallbackPolicy.apiOnQuota`.
    const cfg = d.isDict(ai['fallback']) ? ai['fallback'] : {};
    out.options = buildFallbackOptions({
        apiOnQuota: parseApiOnQuota(cfg['api_on_quota']),
        billingGrant: hasBillingGrant(d.repoRoot),
        hasApiRung: d.hasApiRung,
        memberConfig: (p) => ((d.membersCfg[p] as Dict) || {}) as Dict,
        modelOverride: (p) => (d.overrides[p] as string | undefined) ?? null,
        constructApi: d.constructApi,
        emit: d.emit,
    });
}
