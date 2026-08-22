/**
 * fallback_config — the two config surfaces the question ladder added, kept
 * out of `config.ts` because that file is 800 lines over the source ceiling
 * and the documented fix is extraction rather than a raised baseline
 * (`gate-violation-baselines.json` § check_source_size_budget).
 *
 * Behavioural contract: `docs/contracts/ai-council-config.md` — § "Mid-flight
 * fallback is failure-class-gated" for `fallback.api_on_quota`, § "Decision
 * classes" for `second_model`. The reasons a reader needs AT the code are
 * here; the rest is there rather than duplicated.
 */

import type { ApiOnQuota } from './transport_resolver.js';

/**
 * `fallback.*` — the mid-flight cli→api retry's one configurable knob.
 *
 * Modelled rather than read leniently off the raw dict for a mechanical
 * reason: `council_cli.ts::load_settings` does not hand callers the file, it
 * hands them a block SYNTHESIZED from `CouncilConfig`. A key this type does
 * not carry cannot reach `build_members`, whatever the operator wrote — the
 * same defect `quorum` and `quorum_min_present` each shipped once already.
 */
export interface FallbackConfig {
    /**
     * May an exhausted CLI quota retry on the metered api rung? Default
     * `false`. The no-double-charge classes are always eligible and never
     * consult this; `timeout` / 5xx are never eligible under any value.
     *
     * Three values, not two. `'ask'` defers the answer out of configuration
     * time and into the round that would cross the cliff: the seat is PARKED
     * unless a run-scoped billing grant says a human already agreed for this
     * run. See `transport_resolver.ts` § `ApiOnQuota` and `_lib/billing_grant`.
     */
    readonly api_on_quota: ApiOnQuota;
}

/**
 * Providers a `second_model` rung may name — a SUBSET of the five
 * `members:` accepts, and of `council_cli.ts::_CLI_PROVIDERS`.
 *
 * `xai` and `perplexity` ship COMMUNITY CLI wrappers that consume an API key
 * and set `billable = true`, so routing a resolution there would spend USD on
 * the rung whose entire purpose is not to. The discriminator is
 * `billable === false`, not "has a cli subclass" — the wider set would have
 * been the easy read and the wrong one.
 */
export const SECOND_MODEL_PROVIDERS: ReadonlySet<string> = new Set([
    'anthropic',
    'openai',
    'gemini',
]);

export interface FallbackBuilderDeps {
    readonly isDict: (v: unknown) => v is Record<string, unknown>;
    readonly isBool: (v: unknown) => v is boolean;
    readonly isStr: (v: unknown) => v is string;
    readonly repr: (v: unknown) => string;
    readonly typeName: (v: unknown) => string;
    readonly sortedListRepr: (s: ReadonlySet<string>) => string;
    readonly error: (msg: string) => Error;
}

/**
 * Validate the `fallback` block.
 *
 * Asymmetric on purpose. A malformed BLOCK is tolerated as absent — the key's
 * whole job is to WITHHOLD spend, so a garbled container degrading to "off" is
 * safe, and a config that fails to load is worse. A malformed `api_on_quota`
 * VALUE is refused: `"yes"` is an operator trying to authorise spend, and
 * silently reading that as `false` would be as wrong as reading it as `true`.
 */
export function buildFallback(raw: unknown, d: FallbackBuilderDeps): FallbackConfig {
    if (!d.isDict(raw)) return { api_on_quota: false };
    const v = raw['api_on_quota'];
    if (v === undefined) return { api_on_quota: false };
    if (d.isBool(v)) return { api_on_quota: v };
    // `'ask'` is the ONLY string this accepts, and the narrowness is the
    // point: the paragraph above refuses `"yes"` because an operator writing
    // it is trying to authorise spend, and widening to "any truthy-looking
    // string" to let `ask` through would readmit exactly that. A third named
    // value is not a lenient parse.
    if (d.isStr(v) && v === 'ask') return { api_on_quota: 'ask' };
    throw d.error(
        `\`fallback.api_on_quota\`=${d.repr(v)} must be \`false\`, \`true\` or \`'ask'\` ` +
            `(got ${d.typeName(v)}).`,
    );
}

/**
 * Validate one decision class's optional `second_model` rung.
 *
 * Absent → `null`. Present on a LOCKED class → hard error, even for an
 * explicit `null`: those classes do not have this dimension, and accepting the
 * key at any value teaches its author that they do. Present with a provider
 * outside the USD-neutral set → hard error naming the set, because the failure
 * this rung exists to prevent is a halt and silently disabling it would
 * reintroduce that halt at the moment it is needed.
 */
export function buildSecondModel(
    entry: Record<string, unknown>,
    cls: string,
    locked: ReadonlySet<string>,
    d: FallbackBuilderDeps,
): string | null {
    if (!('second_model' in entry)) return null;
    if (locked.has(cls)) {
        throw d.error(
            `decision_resolution.classes.${cls}.second_model=${d.repr(entry['second_model'])}: ` +
                `a second-model rung is not configurable for high-impact / user-required ` +
                `decisions — those classes are LOCKED to \`user\` (Iron Law) and never resolve ` +
                `on a model of any kind.`,
        );
    }
    const raw = entry['second_model'];
    if (raw === null) return null;
    if (!(d.isStr(raw) && SECOND_MODEL_PROVIDERS.has(raw))) {
        throw d.error(
            `decision_resolution.classes.${cls}.second_model=${d.repr(raw)} not in ` +
                `${d.sortedListRepr(SECOND_MODEL_PROVIDERS)} — the rung must be a provider whose ` +
                `local CLI runs under subscription auth, so a resolution can never become ` +
                `metered USD spend.`,
        );
    }
    return raw;
}
