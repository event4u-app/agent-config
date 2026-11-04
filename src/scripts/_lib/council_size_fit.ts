/**
 * council_size_fit — the size-fit model-downgrade gate, moved out of
 * `council_cli.ts` (that file is past the source ceiling; this repository
 * answers growth with extraction). Two behaviours changed in the same move: a
 * settings dict without `auto_apply` now suggests instead of applying, matching
 * the config default, and `suggest_only` lets `estimate` preview the gate.
 * `council_cli` re-exports `_size_fit_gate` so existing importers keep resolving.
 */

import type { ExternalAIClient } from '../ai_council/clients.js';
import { type SizeFitVerdict, classify_size_fit, downgrade_message } from '../ai_council/necessity.js';
import { type PriceTable, downgrade_coupling, estimate_input_tokens } from '../ai_council/pricing.js';
import { _isDict, _pyBool } from './py_truthiness.js';

type Dict = Record<string, unknown>;

function _stdout(s: string): void {
    process.stdout.write(s);
}

export function _resolve_model_downgrade(ai_cfg: Dict, lens: string): [boolean, boolean] {
    const md_block = (ai_cfg['model_downgrade'] as Dict) || {};
    let enabled = md_block['enabled'] === undefined ? true : Boolean(_pyBool(md_block['enabled']));
    // Suggest-only unless opted in — the config default since 2026-07-28; a
    // settings dict without the key must not silently apply what the config refuses to.
    let auto_apply = md_block['auto_apply'] === undefined ? false : Boolean(_pyBool(md_block['auto_apply']));
    const overrides = ((ai_cfg['lens_overrides'] as Dict) || {})['model_downgrade'] || {};
    const lens_override = _isDict(overrides) ? (overrides as Dict)[lens] : null;
    if (_isDict(lens_override)) {
        enabled = lens_override['enabled'] === undefined ? enabled : Boolean(_pyBool(lens_override['enabled']));
        auto_apply =
            lens_override['auto_apply'] === undefined ? auto_apply : Boolean(_pyBool(lens_override['auto_apply']));
    }
    return [enabled, auto_apply];
}

export function _size_fit_gate(opts: {
    prompt: string;
    lens: string;
    members: ExternalAIClient[];
    ai_cfg: Dict;
    stdout?: ((s: string) => void) | null;
    /** Planned rounds for the run; expected same-model cache reads = rounds − 1. */
    rounds?: number;
    /** Price table for the A1↔A3 cache-coupling gate; null → coupling skipped. */
    price_table?: PriceTable | null;
    /** Preview for `estimate`: report what `run` would suggest, never apply it. */
    suggest_only?: boolean;
}): Array<[string, SizeFitVerdict, boolean]> {
    const out = opts.stdout ?? _stdout;
    const [enabled, configured_auto_apply] = _resolve_model_downgrade(opts.ai_cfg, opts.lens);
    const auto_apply = configured_auto_apply && opts.suggest_only !== true;
    const decisions: Array<[string, SizeFitVerdict, boolean]> = [];
    if (!enabled) {
        return decisions;
    }
    const md_block = (opts.ai_cfg['model_downgrade'] as Dict) || {};
    const tier_override = (md_block['model_tier_override'] as Dict) || {};
    const cache_enabled = opts.ai_cfg['prompt_cache'] !== false;
    const expected_reads = Math.max(0, (opts.rounds ?? 1) - 1);
    const members_cfg = (opts.ai_cfg['members'] as Dict) || {};
    for (const member of opts.members) {
        // Per-run escape hatch: a member pinned in model_tier_override gets
        // exactly that model — classifier and coupling both skipped.
        const pinned = tier_override[member.name];
        if (typeof pinned === 'string' && pinned.length > 0) {
            if (pinned !== member.model) {
                out(
                    `council:size-fit · ${member.name} · model_tier_override ` +
                        `\`${member.model}\` → \`${pinned}\` (operator pin)\n`,
                );
                member.model = pinned;
            }
            continue;
        }
        const member_cfg = (members_cfg[member.name] as Dict) || {};
        const ladder = (member_cfg['model_ladder'] as string[]) || [];
        if (ladder.length === 0) {
            continue;
        }
        const verdict = classify_size_fit(opts.prompt, member.model, ladder, opts.lens);
        let applied = false;
        if (!verdict.fit && verdict.suggested_model) {
            // A1↔A3 coupling: a downgraded member misses the model-scoped
            // prompt cache — downgrade only when the model saving beats the
            // forfeited cache reads. No price table → conservative skip is
            // wrong for the cost goal, so coupling only gates when computable.
            if (opts.price_table) {
                const prefix_tokens = estimate_input_tokens(opts.prompt);
                const coupling = downgrade_coupling(
                    member.name,
                    member.model,
                    verdict.suggested_model,
                    prefix_tokens,
                    4096,
                    {
                        enabled: cache_enabled,
                        cacheable_prefix_tokens: prefix_tokens,
                        expected_reads,
                    },
                    opts.price_table,
                );
                if (!coupling.net_positive) {
                    out(
                        `council:size-fit · ${member.name} · downgrade skipped — ` +
                            `lost cache savings $${coupling.lost_cache_savings_usd.toFixed(4)} ` +
                            `≥ model savings $${coupling.downgrade_savings_usd.toFixed(4)}\n`,
                    );
                    decisions.push([member.name, verdict, false]);
                    continue;
                }
            }
            if (auto_apply) {
                out(
                    `council:size-fit · ${member.name} · auto-downgrade ` +
                        `\`${member.model}\` → \`${verdict.suggested_model}\` · ` +
                        `${verdict.reason}\n`,
                );
                Object.assign(member, { size_fit: { configured_model: member.model, size_fit_reason: verdict.reason } });
                member.model = verdict.suggested_model;
                applied = true;
            } else {
                out(
                    `council:size-fit · ${member.name} · ` +
                        `${downgrade_message(verdict, member.model)} ` +
                        `Apply with \`--model ${member.name}=${verdict.suggested_model}\`.\n`,
                );
            }
        }
        decisions.push([member.name, verdict, applied]);
    }
    return decisions;
}
