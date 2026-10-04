/**
 * What a concern's DECLARED SEVERITY means when the concern produced no verdict.
 *
 * Extracted from `dispatch_hook.ts` on 2026-10-03, and not for tidiness.
 * `check_source_size_budget` measured that file at exactly 1,500 lines on
 * `main` — sitting precisely on the cap — and step 3.3's additions put it 203
 * lines over. The ratchet turns one way, and the doctrine every entry in
 * `gate-violation-baselines.json` records is that a MOVE gives the budget back
 * where raising the baseline spends it. The same move
 * `_lib/concern_sla_window.ts` made out of `bench_hook_latency.ts`.
 *
 * It is also the better boundary on its own terms. Everything here answers one
 * question — what a concern's declaration permits and requires when the
 * concern itself said nothing — and none of it is about RUNNING a concern,
 * which is what the dispatcher does. `stdin_failure_policy.ts` is its sibling:
 * the same question for a payload the dispatcher could not read.
 *
 * The dispatcher re-exports every symbol here, so callers and tests that
 * imported them from `dispatch_hook.js` are unaffected.
 */
import { EXIT_ALLOW, EXIT_BLOCK, EXIT_ERROR } from './exit_codes.js';

type JsonObject = Record<string, unknown>;

/**
 * P0.2 (road-to-rule-coherence) — is this concern declared advisory?
 *
 * An advisory concern MUST never produce a BLOCK verdict on any host. Four
 * PreToolUse concerns document themselves as advisory in prose
 * (`design_slop_hook`: "FLAGS, NEVER A BLOCK") while the transport happily
 * turned their WARN into a host-level deny. Prose is not enforcement: the
 * manifest now declares severity and the dispatcher enforces the ceiling.
 */
export function _is_advisory(concern: JsonObject): boolean {
  return String(concern["severity"] ?? "").trim().toLowerCase() === "advisory";
}

/**
 * Is this concern declared `severity: blocking`?
 *
 * The positive twin of `_is_advisory`, and NOT its negation. A concern whose
 * `severity` is absent, misspelt or any third value is neither — and step 3.3
 * below promotes a crash to a refusal only on an EXPLICIT `blocking`, so an
 * undeclared concern keeps the historical fail-open rather than inheriting a
 * refusal from a typo. `lint_hook_manifest` requires the key, so the middle
 * case should not exist; this reads it as the safe direction anyway, because
 * the cost of the two mistakes is not symmetric.
 */
export function _is_blocking(concern: JsonObject): boolean {
  return String(concern["severity"] ?? "").trim().toLowerCase() === "blocking";
}

/**
 * What an `rc >= 3` (crash / could-not-decide) becomes — step 3.3 of
 * `road-to-a-kernel-that-guards-its-plumbing`.
 *
 * WHAT CHANGED, AND WHAT AUTHORISES IT.
 * Until this step the resolution read the `fail_closed:` FLAG: a crash blocked
 * when the concern opted in and allowed otherwise. Three of nine
 * `severity: blocking` concerns carried the flag, so six guards declared
 * blocking in the manifest — the declaration that AUTHORISES a refusal, and the
 * one `_is_advisory` already enforces as a ceiling — and then allowed the call
 * through whenever they crashed. A guard that refuses when it works and permits
 * when it breaks is not a guard: a crash is exactly the moment the check did
 * not happen, so it is the moment the answer matters most.
 *
 * So `severity` now decides both directions. It is the ceiling (an advisory
 * concern may never block) AND the floor (a blocking concern that could not
 * decide refuses). `fail_closed:` is no longer consulted on this branch — all
 * three concerns carrying it are `severity: blocking`, so no verdict moves
 * because it stopped being read here.
 *
 * WHAT A SLOW CONCERN IS NOT, ON EITHER PATH.
 * This branch resolves a concern that produced NO VERDICT. It is not a latency
 * gate and no reading of `concern_sla_ms` reaches it. On the default in-process
 * route a kill-timeout cannot preempt synchronous code, so an overrun there is
 * a POST-HOC observation about a concern that did in fact answer — refusing it
 * afterwards would deny a call whose guard passed, buying no enforcement while
 * spending exactly the availability risk Risk 1 of the owning roadmap holds
 * down. On the spawn route the timeout stays the historical 30 s, because the
 * registered SLA measures in-process concern work and is three to fifteen times
 * smaller than interpreter startup alone; `SPAWN_TIMEOUT_MS` carries that
 * measurement and the probe that refused the substitution.
 *
 * So `sla_ms x 3` remains what the warn-only window made it: a number the bench
 * prints beside each measured p95, gating nothing. Its readings are recorded
 * with the owning plan and no count is repeated here — a review of an earlier
 * revision found two different tallies in one diff, because a number had been
 * pasted into an implementation comment while the record kept accumulating.
 * The readings validate the bound as an OBSERVATION, which is the only thing
 * this step asks of them.
 *
 * The discriminator for this branch is whether a VERDICT EXISTS. A crash and a
 * killed spawn leave none, so they fail closed. A slow success leaves one, so
 * it is honoured, however slow it was.
 *
 * THE ONE-RETRY ESCAPE, AND WHY THE STOP SLOT NEEDS IT.
 * `turn-end-gate` and `run-continuation` are `severity: blocking` on `stop`,
 * and `tests/hooks/concern_severity.test.ts` records the hazard in as many
 * words: a turn-end gate that fails closed "does not degrade, it wedges the
 * session". Neither carries `skip_on_refusal_retry`, so without this clause a
 * DETERMINISTIC crash in either would refuse every Stop, indefinitely, with no
 * escape the user can reach.
 *
 * So the promotion is spent ONCE. On the retry the host itself marks
 * (`stop_hook_active`, read by `_is_refusal_retry`) a crash falls back to
 * fail-open and the turn ends. The legitimate refusal path is untouched: a
 * concern that DECIDED to refuse returns `EXIT_BLOCK` and never reaches this
 * branch. What a broken concern loses is only the power to refuse forever on
 * the strength of being broken.
 *
 * `pre_tool_use` is untouched by the clause — `_is_refusal_retry` is false on
 * every event but `stop` — and that asymmetry is deliberate. A crashing
 * tool-call guard refuses every attempt, which is the right answer there: the
 * user can run a different command and nothing is wedged, whereas a turn that
 * cannot end leaves no move at all.
 */
export function _resolve_execution_failure(
  concern: JsonObject,
  refusal_retry: boolean,
): number {
  if (!_is_blocking(concern)) return EXIT_ALLOW;
  if (refusal_retry) return EXIT_ALLOW;
  return EXIT_BLOCK;
}

/**
 * The spawn kill-timeout, and why `concern_sla_ms` is NOT what sets it.
 *
 * Step 3.3 of `road-to-a-kernel-that-guards-its-plumbing` reads "timeout for a
 * blocking concern becomes `sla_ms x 3`". That clause is NOT landed, and the
 * reason is a unit mismatch that is measurable rather than arguable.
 *
 * `concern_sla_ms` is derived from the per-concern `duration_ms` this file
 * reports into the timings sink, which on the in-process route brackets
 * `main_fn(argsList)` and nothing else — the concern's OWN work. The registered
 * rows are 0.564 to 1.587 ms, so `sla_ms x 3` is 1.7 to 4.8 ms.
 *
 * A `spawnSync` timeout bounds something else entirely: fork, interpreter
 * start, module graph load, and only then the same work. The bench's own
 * control row measures the interpreter term alone at p95 17 ms on the 1 vCPU
 * reference class and 26 ms on the GitHub runner — three to fifteen times the
 * whole proposed bound, before the concern has run a line.
 *
 * Wiring it was tried on this branch and probed against the real dispatcher.
 * With `AGENT_CONFIG_HOOKS_ISOLATED=1` on `claude/pre_tool_use`, all six
 * blocking concerns returned `ETIMEDOUT`, left no verdict, and — resolved by
 * `_resolve_execution_failure` — turned the dispatch into a deny: exit 2 on an
 * ordinary `Read`. That is Risk 1 of the owning roadmap ("fail-closed wedges
 * slow hosts") firing on every host rather than a slow one, reached through a
 * documented escape hatch. The two changes are individually defensible and
 * lethal together, which is exactly the shape a measured bound is supposed to
 * prevent.
 *
 * So the bound stays where the window put it: an observation
 * `src/scripts/_lib/concern_sla_window.ts` prints on every bench run, gating
 * nothing. The spawn path keeps the historical 30 s. Re-wiring it needs a
 * SPAWN-path measurement — which this tree does not have, because the sink it
 * would come from records the in-process number — and not a second reading of
 * the one registered here.
 *
 * `spawn_path_keeps_the_historical_timeout` in `dispatch_hook.test.ts` pins
 * this: it dispatches a blocking concern whose NAME carries a registered SLA
 * row down the spawn path and asserts the call is allowed. Under the bound it
 * reds.
 */
export const SPAWN_TIMEOUT_MS = 30000;

/**
 * The signal name a killed child reports, or the honest placeholder.
 *
 * A SIGNALLED child has `status === null` and `signal` set, and reaches the
 * dispatcher's spawn branch with no `proc.error` whenever the signal came from
 * outside this process — an OOM kill, a SIGTERM from a supervisor, a crash in
 * the child's own runtime. `proc.status ?? 0` read that as exit 0, i.e. ALLOW,
 * which is a fail-OPEN at the one moment the error band exists to fail closed:
 * the concern was killed, so it decided nothing. The coalescing default was
 * harmless while the band meant fail-open for six of nine blocking concerns;
 * with the severity resolution it is the difference between a guard that
 * refuses when it is killed and one that waves the call through. Found by an
 * independent review, 2026-10-03, latent since the spawn path was written.
 *
 * `null` for both fields is possible and is reported as an unknown signal
 * rather than guessed at — a refusal whose cause reads "unknown" is still
 * actionable, and one whose cause is invented is not.
 */
export function signalLabel(signal: NodeJS.Signals | null): string {
    return signal === null ? 'unknown signal' : signal;
}

/**
 * What an operator is told when a blocking concern refuses without deciding.
 *
 * Printed where the refusal is produced rather than left in a source comment.
 * Both review seats of 2026-10-03 named the same gap: on `pre_tool_use` a
 * deterministically crashing blocking concern refuses every tool call, and the
 * operator cannot discover the escape hatch from inside a wedged session.
 * `stop` is bounded by the one-retry clause and needs no such line, so the
 * caller prints this only where the denial can repeat.
 */
export function noVerdictRefusalNotice(name: string): string {
    return (
        `dispatch_hook: '${name}' is severity: blocking and produced no ` +
        `verdict, so this call is refused. If it keeps failing, ` +
        `AGENT_CONFIG_HOOKS_ISOLATED=1 runs concerns out of process and ` +
        `agents/runtime/state/dispatch-issues.jsonl names the cause.\n`
    );
}

/**
 * What a finished `spawnSync` actually said, in the vocabulary of verdicts.
 *
 * Three ways a spawned concern produces NO VERDICT, and until 2026-10-03 only
 * two of them were recognised as such:
 *
 *  - **`proc.error`** — an OSError, or the kill-timeout expiring. Always a
 *    no-verdict and always was.
 *  - **`status === null` with a signal** — the child was killed from outside
 *    this process: an OOM kill, a supervisor SIGTERM, an abort in the child's
 *    own runtime. `proc.status ?? 0` read this as exit 0, i.e. ALLOW, which is
 *    a fail-OPEN at the one moment the error band exists to fail closed. The
 *    coalescing default was harmless while the band meant fail-open for six of
 *    nine blocking concerns; with the severity resolution it is the difference
 *    between a guard that refuses when it is killed and one that waves the call
 *    through. Found by an independent review, latent since the spawn path was
 *    written.
 *  - **an exit code in the error band** — a child that simply exited 3. This
 *    logged nothing until step 3.3: `proc.error` covers the first case, the
 *    in-process route logs its own throw, and this fell between the two. That
 *    was survivable while the band meant fail-open; now it can produce a
 *    refusal, and a refusal whose cause is in no record is one nobody can act
 *    on.
 *
 * Returning a classification rather than writing the log here keeps this module
 * free of I/O — the caller owns `log_dispatch_issue` and the workspace it needs,
 * and this owns what the three cases MEAN.
 */
export interface SpawnClassification {
    /** The exit code the dispatcher should carry forward. */
    readonly rc: number;
    /** `execution_failed` detail to record, or `null` when there is nothing to record. */
    readonly issueDetail: string | null;
    /** True when the concern produced no verdict and its own stdout must be discarded. */
    readonly noVerdict: boolean;
    /** Prefix for the stderr line, or `null` to pass the child's stderr through unchanged. */
    readonly stderrNote: string | null;
}

export function classifySpawnResult(
    error: Error | undefined,
    status: number | null,
    signal: NodeJS.Signals | null,
): SpawnClassification {
    if (error !== undefined) {
        const err = error as NodeJS.ErrnoException;
        const typeName = err.code === 'ETIMEDOUT' ? 'TimeoutExpired' : err.name || 'OSError';
        return {
            rc: EXIT_ERROR,
            issueDetail: `${typeName}: ${err.message}`,
            noVerdict: true,
            stderrNote: err.message,
        };
    }
    if (status === null) {
        const sig = signalLabel(signal);
        return {
            rc: EXIT_ERROR,
            issueDetail: `concern was terminated by ${sig} without a verdict`,
            noVerdict: true,
            stderrNote: `terminated by ${sig}`,
        };
    }
    return {
        rc: status,
        issueDetail:
            status >= EXIT_ERROR ? `concern exited ${String(status)} without a verdict` : null,
        noVerdict: false,
        stderrNote: null,
    };
}
