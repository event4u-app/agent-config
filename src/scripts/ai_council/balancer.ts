/**
 * Provider budget balancer — v1 (council-locked design).
 *
 * Pure ranking over solo-dispatch candidates: billability-first
 * (subscription transports before per-token ones), then remaining-ratio
 * descending within each partition. Members whose declared budget is
 * exhausted are dropped from the ranking — the HARD gate stays in
 * `CliClient.ask()` (`block_quota` event + `cli_quota_exhausted`); this
 * module only orders candidates so the cheapest healthy member is tried
 * first.
 *
 * DEBATE MODE IS EXEMPT — the balancer is wired into the solo-dispatch
 * path only (`--single` / `routing.solo_member_fallback_chain`). Debate
 * members are never filtered or reordered.
 *
 * Budgets are USER-DECLARED approximations of subscription windows
 * (providers expose no remaining-quota API), so the ranking is an
 * ordering heuristic, never a spend guarantee.
 */
import {
    load_cli_call_counts,
    load_rolling_state,
    type RollingWindowState,
} from './clients.js';
import type { CouncilConfig } from './config.js';

/**
 * Point-in-time view of the persisted call ledger
 * (`~/.event4u/agent-config/cli-calls.json`): today's daily counts plus
 * the raw rolling-window records. Passed as data so the ranking stays
 * pure and unit-testable.
 */
export interface LedgerSnapshot {
    readonly daily: Record<string, number>;
    readonly rolling: Record<string, RollingWindowState>;
}

/** Load the current ledger snapshot from the counter state file. */
export function load_ledger_snapshot(p: string | null = null): LedgerSnapshot {
    return { daily: load_cli_call_counts(p), rolling: load_rolling_state(p) };
}

// Vendor-official CLIs (anthropic / openai / gemini) run under the user's
// subscription auth → billable=false. Community wrappers consume the same
// API key as `mode: api` → billable=true. Mirrors the transport classes
// in `clients.ts`.
const _COMMUNITY_CLI_PROVIDERS: ReadonlySet<string> = new Set(['xai', 'perplexity']);

/** Resolve a member's effective transport mode (member override > default). */
export function effective_member_mode(name: string, config: CouncilConfig): string {
    const member = config.members.get(name);
    if (member !== undefined && member.mode !== null) {
        return member.mode;
    }
    return config.defaults.mode;
}

/**
 * True when calls to this member spend money per token. `manual` is
 * free; `cli` is free only for the vendor-official CLIs; everything
 * else (including `api` and unknown modes) fails toward billable.
 */
export function is_billable_member(name: string, config: CouncilConfig): boolean {
    const mode = effective_member_mode(name, config);
    if (mode === 'manual') {
        return false;
    }
    if (mode === 'cli') {
        return _COMMUNITY_CLI_PROVIDERS.has(name);
    }
    return true;
}

/** One member's budget position at `now`. `kind: null` = no declared budget. */
export interface BudgetStanding {
    readonly kind: 'rolling' | 'utc-day' | null;
    readonly used: number;
    readonly limit: number | null;
    readonly remaining: number | null;
    /** remaining / limit — 1.0 when no budget is declared (unknown). */
    readonly ratio: number;
}

/**
 * Compute a member's budget standing from config + ledger.
 *
 * Precedence: `provider_budgets.<name>` (rolling) wins over
 * `cli_call_budget.max_calls_per_day.<name>` (utc-day). A rolling record
 * older than the declared window counts as expired (used = 0). The
 * daily counts in the snapshot are already UTC-day-scoped by
 * `load_cli_call_counts`.
 */
export function budget_standing(
    name: string,
    config: CouncilConfig,
    ledger: LedgerSnapshot,
    now: Date,
): BudgetStanding {
    const budget = config.provider_budgets.get(name);
    if (budget !== undefined) {
        const entry = ledger.rolling[name];
        let used = 0;
        if (entry !== undefined) {
            const start = Date.parse(entry.window_start);
            if (
                !Number.isNaN(start) &&
                now.getTime() - start < budget.window_seconds * 1000
            ) {
                used = entry.used;
            }
        }
        const remaining = budget.max_calls - used;
        return {
            kind: 'rolling',
            used,
            limit: budget.max_calls,
            remaining,
            ratio: budget.max_calls > 0 ? Math.max(remaining, 0) / budget.max_calls : 0.0,
        };
    }
    const cap = config.cli_call_budget.max_calls_per_day.get(name);
    if (cap !== undefined) {
        const used = ledger.daily[name] ?? 0;
        const remaining = cap - used;
        return {
            kind: 'utc-day',
            used,
            limit: cap,
            remaining,
            ratio: cap > 0 ? Math.max(remaining, 0) / cap : 0.0,
        };
    }
    return { kind: null, used: 0, limit: null, remaining: null, ratio: 1.0 };
}

/**
 * Rank solo-dispatch candidates — billability-first, then remaining-ratio.
 *
 * 1. Partition into non-billable (subscription transports) and billable.
 * 2. Within each partition: drop members whose declared budget is
 *    exhausted (remaining <= 0); rank the rest by remaining-ratio
 *    descending. Members with NO declared budget rank at ratio 1.0 but
 *    stable-sort AFTER members with a KNOWN ratio of 1.0; configured
 *    order is preserved among full equals (stable sort).
 * 3. Non-billable partition first, then billable.
 *
 * An empty result on a non-empty input means every candidate's declared
 * budget is exhausted — callers fall back to the existing `block_quota`
 * behaviour (the per-call gate in `CliClient.ask()`); no new event type.
 */
export function rank_members_for_solo(
    members: readonly string[],
    config: CouncilConfig,
    ledger: LedgerSnapshot,
    now: Date,
): string[] {
    // [name, ratio, unknown-budget?] — unknown sorts after a known 1.0.
    type Candidate = [string, number, boolean];
    const non_billable: Candidate[] = [];
    const billable: Candidate[] = [];
    for (const name of members) {
        const standing = budget_standing(name, config, ledger, now);
        if (standing.remaining !== null && standing.remaining <= 0) {
            continue; // declared budget exhausted → drop from the ranking.
        }
        const bucket = is_billable_member(name, config) ? billable : non_billable;
        bucket.push([name, standing.ratio, standing.kind === null]);
    }
    // Array.prototype.sort is stable (ES2019) — configured order survives
    // among equal (ratio, knownness) pairs.
    const by_ratio_desc = (arr: Candidate[]): string[] =>
        arr
            .sort((a, b) => {
                if (a[1] !== b[1]) {
                    return b[1] - a[1];
                }
                return Number(a[2]) - Number(b[2]); // known budget before unknown.
            })
            .map(([name]) => name);
    return [...by_ratio_desc(non_billable), ...by_ratio_desc(billable)];
}

/**
 * Return the fallback chain the solo dispatcher should walk.
 *
 * `routing.balance: off` → the configured order, verbatim (current
 * behaviour). `on` (the default) → the balanced ranking with exhausted
 * members dropped. An empty result on a non-empty chain means every
 * declared budget is exhausted — callers escalate; the per-call
 * `block_quota` gate in `CliClient.ask()` stays authoritative.
 */
export function balanced_fallback_chain(
    config: CouncilConfig,
    ledger: LedgerSnapshot,
    now: Date,
): readonly string[] {
    const chain = config.routing.solo_member_fallback_chain;
    if (!config.routing.balance) {
        return chain;
    }
    return rank_members_for_solo(chain, config, ledger, now);
}
