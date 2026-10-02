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

/**
 * Set by `dispatch_hook` to its own resolved package root. Read here rather
 * than threaded through every caller — see `ruleSourceDirs`.
 */
export const PACKAGE_ROOT_ENV = 'AGENT_CONFIG_PACKAGE_ROOT';

function statKind(p: string): 'dir' | 'file' | null {
    try {
        const s = fs.statSync(p);
        return s.isDirectory() ? 'dir' : s.isFile() ? 'file' : null;
    } catch {
        return null;
    }
}

/**
 * Every tree a rule body may come from, highest precedence first.
 *
 * THE DEFECT THIS CLOSES, reproduced at `main` @ `9bc8cd4f2` and again on
 * 2026-10-01. This module resolved bodies and the router under ONE root, and
 * the carrier passed the envelope's workspace or `process.cwd()`. In this
 * checkout those are the same directory and everything works. In a consumer
 * project they are not: there is no `dist/` under the consumer's tree at all,
 * so `loadRouter` threw, the carrier caught it and returned allow, and the
 * concern delivered NOTHING while reporting no error. Every consumer runs it
 * in someone else's project, so the shipped carrier was silent for every
 * consumer and loud only for its author. `dispatch_hook.ts:722` has passed
 * `AGENT_CONFIG_PACKAGE_ROOT` to every concern since the ADR-020 global-only
 * install landed — the fix was one environment read away and nothing read it.
 *
 * THE ORDER IS THE CONTRACT:
 *
 *   1. `<root>/agents/overrides/<id>.md` — the developer's own layer.
 *      `agents_overlay.ts` already makes `overrides/` the one cascade kind
 *      that is both project- and user-global-eligible, and a consumer who has
 *      overridden a rule means it. It wins, which is what step 1.1's "with
 *      `agents/overrides/` keeping precedence" asks for.
 *   2. `<root>/dist/agent-src/rules/<id>.md` — the maintainer checkout. Kept
 *      AHEAD of the package root and not behind it, so this repository's own
 *      behaviour is byte-identical to what it was before. A change that
 *      repairs consumers by moving the maintainer tree is one nobody can
 *      review against a known-good reading.
 *   3. `<packageRoot>/dist/agent-src/rules/<id>.md` — the install. The only
 *      one of the three that exists in a foreign project.
 *
 * WHY THE ENVIRONMENT IS READ HERE rather than passed in. Nine call sites
 * across the model, the shortlist, the arm experiment and two hooks pass a
 * single `repoRoot`, and none of them has a second tree to offer. Threading a
 * resolved source object through all of them would be a wide diff whose only
 * real consumer is the carrier, and it costs runtime bytes in the composed
 * hook bundle — which every hook event on every slot loads, under a hard
 * ceiling (`src/config/hook-bundle-budget.json`). `roadmap_progress_hook`
 * already reads this same variable this same way; this follows it rather than
 * inventing a second convention. No `~` expansion: the one writer is
 * `dispatch_hook`, which sets it from a `path.resolve` result.
 */
export interface RuleSources {
    /** Body directories, highest precedence first. */
    readonly dirs: readonly string[];
    /** The `dist/router.json` to route against, or `null`. */
    readonly router: string | null;
    /**
     * One line naming why nothing resolved, or `null` when something did.
     *
     * A caller that found nothing must be able to SAY so. An empty delivery is
     * indistinguishable from "no rule matched", which is exactly the silence
     * this chain exists to end; reproducing it one layer up would be the whole
     * defect again. The three wordings are distinguishable because the
     * operator's next action differs: the variable was never set (a host or
     * wrapper problem), it points somewhere that is gone (a move after
     * install), or both resolved and the package carries no built corpus.
     */
    readonly gap: string | null;
}

/** Resolve the body dirs, the router and the gap wording in ONE filesystem pass. */
export function ruleSources(repoRoot: string): RuleSources {
    const pkgRaw = (process.env[PACKAGE_ROOT_ENV] ?? '').trim();
    const pkg = pkgRaw === '' ? null : path.resolve(pkgRaw);
    const dirs: string[] = [];
    const add = (d: string): void => {
        if (statKind(d) === 'dir' && !dirs.includes(d)) dirs.push(d);
    };
    add(path.join(repoRoot, 'agents', 'overrides'));
    add(path.join(repoRoot, 'dist', 'agent-src', 'rules'));
    if (pkg !== null) add(path.join(pkg, 'dist', 'agent-src', 'rules'));

    const local = path.join(repoRoot, 'dist', 'router.json');
    let router: string | null = statKind(local) === 'file' ? local : null;
    if (router === null && pkg !== null) {
        const shipped = path.join(pkg, 'dist', 'router.json');
        if (statKind(shipped) === 'file') router = shipped;
    }

    const why =
        router !== null && dirs.length > 0
            ? null
            : pkg === null
              ? `${PACKAGE_ROOT_ENV} unset`
              : router === null
                ? `no dist/router.json under ${repoRoot} or ${pkg}`
                : `no dist/agent-src/rules under ${repoRoot} or ${pkg}`;
    return {
        dirs,
        router,
        gap: why === null ? null : `rule-inject: no rule source resolved — ${why}`,
    };
}

export function loadRouter(repoRoot: string): Router {
    const p = ruleSources(repoRoot).router ?? path.join(repoRoot, 'dist', 'router.json');
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

/** The highest-precedence EXISTING body file for `id` across `ruleSourceDirs`, or `null`. */
export function ruleBodyPath(repoRoot: string, id: string): string | null {
    for (const dir of ruleSources(repoRoot).dirs) {
        const p = path.join(dir, `${id}.md`);
        if (statKind(p) === 'file') return p;
    }
    return null;
}

/** The projected body, or `null` when no tree in the chain carries the rule. */
export function loadRuleBody(repoRoot: string, id: string): string | null {
    const p = ruleBodyPath(repoRoot, id);
    if (p === null) return null;
    try {
        return fs.readFileSync(p, 'utf8');
    } catch {
        return null;
    }
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
    shortlist?: readonly string[] | null,
): SelectionResult {
    const bodyBytes = new Map<string, number>();
    for (const m of matches) {
        const body = loadRuleBody(repoRoot, m.id);
        bodyBytes.set(m.id, body === null ? 0 : bytesOf(body));
    }
    // STEP 6.3 — the optional lexical shortlist, as a TIE-BREAK and nothing more.
    //
    // Absent (the default), the cap order is exactly what it was: score, then
    // router order. Present, it sits BETWEEN them, never above `score` — the
    // matcher's verdict is read first and the shortlist only orders what the
    // matcher already tied. Membership is untouched in both directions: a
    // shortlisted id the matcher did not return is not in `matches` and so is
    // never consulted, and no matched id is dropped for being unshortlisted
    // (it sorts at Infinity, behind the shortlisted ones, and still competes
    // for the cap). That is `_lib/lexical_shortlist.ts`'s "never decides
    // alone" expressed at the one place the cap actually binds.
    const rank = new Map<string, number>();
    for (const [i, id] of (shortlist ?? []).entries()) {
        if (!rank.has(id)) rank.set(id, i);
    }
    const ranked = [...matches].sort(
        (a, b) =>
            b.score - a.score ||
            (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) ||
            a.order - b.order,
    );
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
