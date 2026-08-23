/**
 * Rule-injection core — THE single module both the offline model and the
 * runtime concern read.
 *
 * WHY ONE MODULE. `road-to-trigger-delivered-rule-bodies` step 0.5 states the
 * failure this prevents in as many words: *an experiment whose offline pricing
 * and runtime delivery use different matchers measures nothing*. So the price /
 * recall model (`src/scripts/model_rule_injection.ts`) and the delivery concern
 * (`src/scripts/hooks/rule_inject_hook.ts`) both import THIS file, and neither
 * re-implements selection, ordering, capping, or body loading.
 *
 * IT OWNS NO MATCHER. Trigger semantics belong to
 * [`_lib/router_match.ts`](router_match.ts), which is already the single
 * implementation for every surface that answers "which rules fire on this
 * prompt?" and is pinned by `tests/scripts/router_match_parity.test.ts`. A
 * second matcher here would be the violation that test exists to catch, so
 * `matchTierRules` is a thin, deterministic wrapper over `match_prompt` and
 * nothing more. Step 0.3's pre-registered comparison found no reason to write
 * one — see `model_rule_injection.ts`'s header for the measured verdict.
 *
 * KERNEL IS NEVER INJECTED. The nine kernel rules are in standing context by
 * definition; injecting one would be paying twice for a body that is already
 * there. `match_prompt` returns kernel ids in `activated_rules` because kernel
 * rules are always active — this module filters them out by construction rather
 * than relying on a caller to remember.
 *
 * IT IMPORTS NO TOKENIZER, AND THAT IS A HOT-PATH FACT RATHER THAN A STYLE
 * CHOICE. `_lib/token_count.ts` resolves `js-tiktoken` AT MODULE LOAD, and the
 * concern that imports this file is statically reachable from
 * `concern_registry.ts` — so importing it here made every hook dispatch on
 * every slot pay a tokenizer load for a concern that is default-OFF and emits
 * nothing. Measured on this tree: unbinding the concern moved the
 * `pre_tool_use` p95 from 202 ms to 196 ms, and the CI latency gate went red on
 * the branch that introduced it while passing on main.
 *
 * So the runtime cap is in BYTES. That is not a weaker bound — it is the same
 * bound in the unit the budget actually enforces: `hook-token-budget.json`
 * measures "bytes of concern stdout payload fields", so the cap and its
 * registered row are now the same number instead of two units that need a
 * conversion factor to compare. The offline model keeps exact-BPE tokens for
 * its price table, where the tokenizer is the point and nothing is on a hot
 * path.
 *
 * DETERMINISM IS THE CONTRACT, and the collision cases are the reason it needs
 * stating. Two triggers on the SAME rule collapse to one entry (a rule is
 * delivered once, however many of its triggers fired) while the trigger count
 * survives as `score`. Two DIFFERENT rules both firing are returned in router
 * declaration order, tier_1 before tier_2 — never in match order, which would
 * make the output depend on trigger authoring order inside a rule. Capping
 * sorts by descending score with router order as the tie-break, so the same
 * prompt against the same router always yields the same bytes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { match_prompt, type Router, type Trigger } from './router_match.js';

export type { Router, Trigger };

/** Tier a matched rule came from. Kernel is never a value here. */
export type Tier = 'tier_1' | 'tier_2';

export interface TierRuleMatch {
    id: string;
    tier: Tier;
    /** How many of this rule's triggers matched. Ties break on router order. */
    score: number;
    /** Router declaration index within its tier — the deterministic tie-break. */
    order: number;
}

/** Kinds of trigger a prompt alone can never fire. */
export const PATH_TRIGGER_KINDS = ['path_prefix', 'file_pattern'] as const;

export function loadRouter(repoRoot: string): Router {
    const p = path.join(repoRoot, 'dist', 'router.json');
    return JSON.parse(fs.readFileSync(p, 'utf8')) as Router;
}

/** Kernel rule ids, as declared by the router. */
export function kernelIds(router: Router): Set<string> {
    const k = Array.isArray(router['kernel']) ? router['kernel'] : [];
    return new Set(k.map((x) => String(x)));
}

function tierEntries(router: Router, tier: Tier): Array<{ id: string; triggers: Trigger[] }> {
    const raw = router[tier];
    if (!Array.isArray(raw)) return [];
    return (raw as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: String(r['id'] ?? ''),
        triggers: Array.isArray(r['triggers']) ? (r['triggers'] as Trigger[]) : [],
    }));
}

/** Every tier rule declared by the router, with its trigger list. */
export function allTierRules(router: Router): Array<{ id: string; tier: Tier; triggers: Trigger[] }> {
    const out: Array<{ id: string; tier: Tier; triggers: Trigger[] }> = [];
    for (const tier of ['tier_1', 'tier_2'] as Tier[]) {
        for (const e of tierEntries(router, tier)) out.push({ ...e, tier });
    }
    return out;
}

/** Rules whose triggers are ALL path-shaped — unreachable from a prompt alone. */
export function pathOnlyRuleIds(router: Router): Set<string> {
    const ids = new Set<string>();
    for (const r of allTierRules(router)) {
        if (r.triggers.length === 0) continue;
        const allPath = r.triggers.every((t) =>
            PATH_TRIGGER_KINDS.some((k) => k in t),
        );
        if (allPath) ids.add(r.id);
    }
    return ids;
}

/** Rules declaring at least one path-shaped trigger. */
export function pathCapableRuleIds(router: Router): Set<string> {
    const ids = new Set<string>();
    for (const r of allTierRules(router)) {
        if (r.triggers.some((t) => PATH_TRIGGER_KINDS.some((k) => k in t))) ids.add(r.id);
    }
    return ids;
}

/** Rules declaring no trigger at all — cannot be delivered, must stay eager. */
export function triggerlessRuleIds(router: Router): string[] {
    return allTierRules(router)
        .filter((r) => r.triggers.length === 0)
        .map((r) => r.id);
}

/**
 * Which tier rules fire on this prompt (+ optional open files / command).
 *
 * Kernel is excluded. Order is router declaration order, tier_1 first.
 */
export function matchTierRules(
    router: Router,
    prompt: string,
    openFiles?: Iterable<string> | null,
    command?: string | null,
): TierRuleMatch[] {
    const kernel = kernelIds(router);
    const res = match_prompt(router, prompt, 'full', openFiles, command);
    const scores = new Map<string, number>();
    for (const mt of res.matched_triggers) {
        const id = String(mt.rule ?? '');
        if (id === '' || kernel.has(id)) continue;
        scores.set(id, (scores.get(id) ?? 0) + 1);
    }
    const out: TierRuleMatch[] = [];
    let order = 0;
    for (const r of allTierRules(router)) {
        const s = scores.get(r.id);
        if (s === undefined) {
            order += 1;
            continue;
        }
        out.push({ id: r.id, tier: r.tier, score: s, order });
        order += 1;
    }
    return out;
}

/** Where the projected body of a rule lives. */
export function ruleBodyPath(repoRoot: string, id: string): string {
    return path.join(repoRoot, 'dist', 'agent-src', 'rules', `${id}.md`);
}

/** The projected body, or `null` when the rule has no projected file. */
export function loadRuleBody(repoRoot: string, id: string): string | null {
    const p = ruleBodyPath(repoRoot, id);
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf8');
}

/**
 * UTF-8 byte length — the runtime measure, dependency-free by design.
 *
 * Deliberately NOT a token count: see the header. Bytes are exact, need no
 * tokenizer, and are the unit `hook-token-budget.json` enforces.
 */
export function bytesOf(text: string): number {
    return Buffer.byteLength(text, 'utf8');
}

export interface SelectionResult {
    selected: TierRuleMatch[];
    /** Matched but dropped because the byte cap was reached. */
    dropped: TierRuleMatch[];
    /** Byte sum of the selected bodies. */
    bytes: number;
    /** Per-rule body byte counts, keyed by id, for every MATCHED rule. */
    bodyBytes: Map<string, number>;
}

/**
 * Apply the per-prompt BYTE cap.
 *
 * Highest score first, router order as tie-break; a rule whose body would push
 * the running total past `capBytes` is dropped and the walk continues, so one
 * oversized body cannot starve the rest. The returned `selected` list is
 * re-sorted back into router order — cap order is a budgeting concern, delivery
 * order is not.
 *
 * ONE selection for both callers. The offline model and the runtime concern
 * call THIS function with THE SAME cap, so the set the price table prices is
 * byte-for-byte the set the concern delivers. That is step 0.5's requirement,
 * and expressing the cap in bytes makes it hold without a token/byte
 * conversion sitting between the two arms.
 */
export function selectForInjection(
    repoRoot: string,
    matches: TierRuleMatch[],
    capBytes: number,
): SelectionResult {
    const bodyBytes = new Map<string, number>();
    for (const m of matches) {
        const body = loadRuleBody(repoRoot, m.id);
        bodyBytes.set(m.id, body === null ? 0 : bytesOf(body));
    }
    const ranked = [...matches].sort((a, b) => b.score - a.score || a.order - b.order);
    const selected: TierRuleMatch[] = [];
    const dropped: TierRuleMatch[] = [];
    let total = 0;
    for (const m of ranked) {
        const t = bodyBytes.get(m.id) ?? 0;
        if (total + t > capBytes && selected.length > 0) {
            dropped.push(m);
            continue;
        }
        selected.push(m);
        total += t;
    }
    selected.sort((a, b) => a.order - b.order);
    dropped.sort((a, b) => a.order - b.order);
    return { selected, dropped, bytes: total, bodyBytes };
}
