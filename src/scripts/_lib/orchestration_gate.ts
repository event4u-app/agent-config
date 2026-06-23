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
