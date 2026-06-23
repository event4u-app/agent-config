/**
 * Default-flip decision gate (Phase 6).
 *
 * Pure, no-I/O. Encodes the Phase-6 falsification gate: the SHIPPED default for
 * `subagents.auto` flips toward `on` ONLY when a real benchmark shows a net
 * token-or-time win at held quality, and only on hosts with a subagent
 * primitive. Honest-null exit (no win, or quality regressed) keeps the
 * conservative default. Contract:
 * `src/agent-src/contexts/execution/orchestration-benchmark-gate.md`.
 *
 * This helper decides; it never runs the benchmark. The measurement is the
 * empirical bench:ab step, authorised + run out of band.
 */

export interface BenchmarkResult {
    /** Net token OR wall-clock win on the delegable-task subset. */
    net_win: boolean;
    /** Output quality held at or above the single-agent baseline. */
    quality_held: boolean;
}

export type GateVerdict = 'pass' | 'fail';
export type ShippedDefault = 'on' | 'ask' | 'off';

/** Gate verdict: pass requires BOTH a net win AND held quality. */
export function gateVerdict(r: BenchmarkResult): GateVerdict {
    return r.net_win && r.quality_held ? 'pass' : 'fail';
}

/**
 * Resolve the shipped default for `subagents.auto` after a benchmark.
 *
 * - Gate fail (no win or quality regressed) → keep conservative: `ask` on a
 *   subagent-capable host, `off` elsewhere (honest-null exit).
 * - Gate pass → `on` on a subagent-capable host, `off` elsewhere.
 *
 * `host_subagent_spawn` gates the result so the default is never `on`/`ask`
 * where the host cannot spawn at all.
 */
export function resolveShippedDefault(r: BenchmarkResult, host_subagent_spawn: boolean): ShippedDefault {
    if (!host_subagent_spawn) return 'off';
    return gateVerdict(r) === 'pass' ? 'on' : 'ask';
}

/**
 * Recursive-verification gate (ADR-106).
 *
 * Decides whether `verification.recursive` ships on for a (host, family) cell.
 * Pure, no-I/O — the measurement is the empirical bench:ab step. Encodes the
 * council-locked two-branch rule: capability-only is NOT the gate, because it
 * assumes (without measuring) that recursion's discipline lift is redundant
 * with the always-on rules. The `D₂ − D₁` (recursion over rules-only) baseline
 * makes redundancy a measured fact, gated behind a concrete cost ceiling and a
 * human-preference pre-test. Contract:
 * `docs/decisions/ADR-106-recursive-verification-benchmark-gate.md`.
 */
export interface RecursiveBenchmarkResult {
    /** Capability-axis lift is significant (McNemar/scorer p<0.05, effect≥0.5). */
    capability_lift_significant: boolean;
    /** Novel discipline lift `D₂ − D₁` (recursion over rules-only) exceeds ε_disc. */
    novel_discipline_lift_significant: boolean;
    /** Per-task cost is within the concrete ceiling (token-multiplier / $). */
    cost_within_ceiling: boolean;
    /** Phase 3a-pre human-preference rate (fraction preferring the recursion output). */
    human_preference_rate: number;
}

/** Human-preference floor from ADR-106: below this the discipline branch cannot pass. */
export const RECURSIVE_HUMAN_PREFERENCE_FLOOR = 0.6;

/**
 * Gate verdict for recursive verification (ADR-106 two-branch rule):
 *   pass iff  capability_lift_significant
 *             OR (novel_discipline_lift_significant AND cost_within_ceiling
 *                 AND human_preference_rate > floor)
 * The human-preference test gates the discipline branch only — a capability
 * lift passes on its own.
 */
export function recursiveGateVerdict(r: RecursiveBenchmarkResult): GateVerdict {
    if (r.capability_lift_significant) return 'pass';
    const disciplineBranch =
        r.novel_discipline_lift_significant &&
        r.cost_within_ceiling &&
        r.human_preference_rate > RECURSIVE_HUMAN_PREFERENCE_FLOOR;
    return disciplineBranch ? 'pass' : 'fail';
}

/**
 * Resolve the shipped default for `verification.recursive`.
 *
 * Default stays `off` until a cell passes (ADR-106) — an honest-null keeps it
 * `off`, never `ask`. `host_supported` gates the result so a host where
 * recursion is not viable always resolves `off`.
 */
export function resolveRecursiveDefault(r: RecursiveBenchmarkResult, host_supported: boolean): ShippedDefault {
    if (!host_supported) return 'off';
    return recursiveGateVerdict(r) === 'pass' ? 'on' : 'off';
}
