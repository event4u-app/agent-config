/**
 * council_settings_block — the `CouncilConfig` → settings-dict projection.
 *
 * A pure mapping with no I/O and one responsibility, relocated out of
 * `council_cli.ts` UNCHANGED. That file sits ~2,600 lines over the source
 * ceiling, and this repository answers growth with extraction rather than a
 * raised baseline (`gate-violation-baselines.json`
 * § check_source_size_budget: "extract, then measure").
 *
 * Nothing is redesigned, renamed or re-ordered: the body below is the one that
 * lived in `council_cli.ts`, so a reviewer diffs a MOVE rather than a rewrite,
 * and the existing describe block over it keeps passing untouched.
 *
 * ## The defect this projection has shipped three times
 *
 * `load_settings` does not hand `build_members` the config FILE — it hands it
 * this block. So a key the loader validates and this projection drops is
 * enforced at load and invisible at runtime. That has now happened to
 * `quorum`, to `quorum_min_present`, and to `fallback.api_on_quota` in turn;
 * each carries its own comment below. A new key belongs in BOTH places or in
 * neither.
 */

import type { CouncilConfig } from '../ai_council/config.js';
import { _mapToObject } from './map_to_object.js';

type Dict = Record<string, unknown>;

export function synthesizeAiCouncilBlock(cfg: CouncilConfig): Dict {
    const members: Dict = {};
    for (const [name, m] of cfg.members) {
        const entry: Dict = { enabled: m.enabled, model: m.model };
        if (m.api_key_ref !== null) {
            entry['api_key_ref'] = m.api_key_ref;
        }
        if (m.mode !== null) {
            entry['mode'] = m.mode;
        }
        if (m.binary !== null) {
            entry['binary'] = m.binary;
        }
        if (m.model_ladder && m.model_ladder.length > 0) {
            entry['model_ladder'] = [...m.model_ladder];
        }
        // road-to-cache-economy Phase 4: forward only an explicit override —
        // the '5m' default needs no key, keeping the synthesized block
        // byte-identical to pre-Phase-4 output when nobody opted in.
        if (m.prompt_cache_ttl !== '5m') {
            entry['prompt_cache_ttl'] = m.prompt_cache_ttl;
        }
        members[name] = entry;
    }
    const advisors: Dict = {};
    for (const [name, a] of cfg.advisors) {
        const entry: Dict = {
            enabled: a.enabled,
            member: a.member,
            persona: a.persona,
        };
        if (a.model !== null) {
            entry['model'] = a.model;
        }
        advisors[name] = entry;
    }
    const lensCostDisclosure: Dict = {};
    for (const [lens, cd] of cfg.lens_overrides.cost_disclosure) {
        lensCostDisclosure[lens] = {
            mode: cd.mode,
            threshold_usd: cd.threshold_usd,
            show_per_member: cd.show_per_member,
        };
    }
    const lensModelDowngrade: Dict = {};
    for (const [lens, md] of cfg.lens_overrides.model_downgrade) {
        lensModelDowngrade[lens] = { enabled: md.enabled, auto_apply: md.auto_apply };
    }
    return {
        enabled: cfg.enabled,
        mode: cfg.defaults.mode,
        min_rounds: cfg.defaults.min_rounds,
        deep_min_rounds: cfg.defaults.deep_min_rounds,
        max_output_tokens: cfg.defaults.max_output_tokens,
        session_retention_days: cfg.defaults.session_retention_days,
        debate_max_rounds: cfg.defaults.debate_max_rounds,
        cost_budget: {
            max_input_tokens: cfg.cost_budget.max_input_tokens,
            max_output_tokens: cfg.cost_budget.max_output_tokens,
            max_calls: cfg.cost_budget.max_calls,
            max_total_usd: cfg.cost_budget.max_total_usd,
            daily_limit_usd: cfg.cost_budget.daily_limit_usd,
        },
        consensus_scoring: {
            enabled: cfg.consensus_scoring.enabled,
            strong_threshold: cfg.consensus_scoring.strong_threshold,
            minority_threshold: cfg.consensus_scoring.minority_threshold,
            lenses: [...cfg.consensus_scoring.lenses],
            // Phase 1B. Omitting it here is not a missing default — it is the key
            // becoming UNREADABLE: `_inline_findings_active` reads this projected
            // dict, not the typed config, so an absent key resolves to `false` and
            // the feature is silently off no matter what the YAML says. A live
            // analysis run on 2026-08-30 is what found it, after the tests passed.
            inline_findings: cfg.consensus_scoring.inline_findings,
        },
        cli_call_budget: {
            max_calls_per_day: _mapToObject(cfg.cli_call_budget.max_calls_per_day),
            warn_at: cfg.cli_call_budget.warn_at,
        },
        // Phase 3.3 (road-to-always-on-orchestration): was validated by
        // `_build_config`/`_build_quorum` but never forwarded into the
        // synthesized block, so `build_members` always saw `undefined` and
        // silently fell back to `'majority'` regardless of the user's
        // configured `quorum: <k>`. Additive key — callers that never read
        // it observe no change.
        quorum: cfg.quorum,
        // Forwarded for the same reason `quorum` above had to be: a key that
        // `_build_config` validates and this block drops is a key the loader
        // enforces and the runtime never sees. That defect shipped once here
        // already; repeating it for the shadow floor would silently pin every
        // `floor_would_hold` to the default no matter what the operator set.
        quorum_min_present: cfg.quorum_min_present,
        // Third instance of the same defect the two comments above describe,
        // and the most expensive of the three: `build_members` reads
        // `ai_council.fallback.api_on_quota` off THIS block, so before the key
        // was forwarded no config file could turn quota fall-through on. The
        // documentation, the contract section and the tests all described a
        // switch that production could not flip.
        fallback: { api_on_quota: cfg.fallback.api_on_quota },
        necessity_classifier: {
            enabled: cfg.necessity_classifier.enabled,
            mode: cfg.necessity_classifier.mode,
            user_explicit_mode: cfg.necessity_classifier.user_explicit_mode,
        },
        model_downgrade: {
            enabled: cfg.model_downgrade.enabled,
            auto_apply: cfg.model_downgrade.auto_apply,
        },
        debate: {
            max_cost_usd: cfg.debate.max_cost_usd,
            cost_disclosure: {
                mode: cfg.debate.cost_disclosure.mode,
                threshold_usd: cfg.debate.cost_disclosure.threshold_usd,
                show_per_member: cfg.debate.cost_disclosure.show_per_member,
            },
        },
        lens_overrides: {
            necessity_classifier_mode: _mapToObject(
                cfg.lens_overrides.necessity_classifier_mode,
            ),
            necessity_classifier_user_explicit_mode: _mapToObject(
                cfg.lens_overrides.necessity_classifier_user_explicit_mode,
            ),
            model_downgrade: lensModelDowngrade,
            cost_disclosure: lensCostDisclosure,
        },
        members,
        advisors,
    };
}
