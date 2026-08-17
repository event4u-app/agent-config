/**
 * Tier vocabulary + cool-down state.
 *
 * ARCHIVED 2026-08-16 — the budget-routing DECISION LAYER and PERMIT LIFECYCLE
 * that used to live here (`pickTier`, `acquireBudgetPermit`, `settlePermit`,
 * `tripCooldown`, and the reserve/lock machinery behind them) were removed by a
 * converged AI-council verdict (anthropic + openai, 2 of 2, 2026-08-16), which
 * reversed the v1 contract locked on 2026-08-03 and retired its pre-registered
 * AC1–AC5. `docs/contracts/budget-routing.md` is the migration record.
 *
 * The short reason: `pickTier` required a `routing_switch` input whose sole
 * source — the `subagents.budget_routing` settings key — was DELETED on purpose
 * by always-on orchestration. Wiring it therefore meant inventing a replacement
 * for a category that had been removed deliberately, not finishing an
 * integration. It had zero production callers, and with `session_tier` non-null
 * in 0 of 327 orchestration records there was no basis on which its saving could
 * ever have been measured.
 *
 * What stayed, and why: `TIER_ORDER` and `readCooldowns` have a live consumer in
 * `routing_doctor.ts`, which reports cool-down state as a diagnostic. That is
 * monitoring, not routing, and it never depended on the decision layer.
 *
 * Reversing this needs a real change of conditions, not a preference. Both
 * council members attached one: an authoritative per-request tier-selection
 * signal appearing with a named production dispatch point, plus telemetry
 * carrying BOTH the chosen and the realized tier so a saving can be computed at
 * all. Until then the git history holds the implementation.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export type BudgetTier = 'cheap' | 'medium' | 'strong';

/** Ordered cheapest-first. */
export const TIER_ORDER: readonly BudgetTier[] = ['cheap', 'medium', 'strong'];

export const COOLDOWN_FILE = 'tier-cooldowns.json';

/**
 * Read the cool-down map (missing/torn file → all tiers live).
 *
 * NOTE the asymmetry this now has, because it is load-bearing for the caller:
 * nothing in the tree WRITES this file any more — `tripCooldown` was the only
 * writer and it went with the permit lifecycle. `routing_doctor` already
 * accounts for that and reports cool-down state as *unavailable, no producer*
 * rather than reading an all-zero map as a measured "not cooling". Keep that
 * distinction if you ever add a writer back.
 */
export function readCooldowns(tracking_dir: string): Record<BudgetTier, number> {
    const empty: Record<BudgetTier, number> = { cheap: 0, medium: 0, strong: 0 };
    try {
        const raw = JSON.parse(
            fs.readFileSync(path.join(tracking_dir, COOLDOWN_FILE), 'utf-8'),
        ) as Record<string, unknown>;
        for (const t of TIER_ORDER) {
            const v = raw[t];
            if (typeof v === 'number' && Number.isFinite(v)) {
                empty[t] = v;
            }
        }
        return empty;
    } catch {
        return empty;
    }
}
