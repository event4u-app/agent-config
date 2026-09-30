import fs from "node:fs";

/**
 * concern_timings — the per-concern latency sink the bench reads.
 *
 * Step 3.2 of `road-to-a-kernel-that-guards-its-plumbing`. The dispatcher has
 * always timed each concern — `_run_concern` returns a duration and the
 * feedback record carries it — but nothing could READ that distribution: the
 * feedback dir keeps one file per concern and every dispatch OVERWRITES it, so
 * the only survivor is the last run. A p95 needs every sample, and the bench
 * harness that produces the samples runs with `AGENT_CONFIG_REPLAY=1`, where
 * the feedback write returns before writing anything at all.
 *
 * So this sink is separate from the feedback dir on purpose, and deliberately
 * not derived from it:
 *
 * - it APPENDS, so N runs leave N samples rather than one;
 * - it is written in replay mode, because the measurement harness is the
 *   caller that needs it;
 * - it is off unless the variable is set, so the cost on a real dispatch is
 *   one `process.env` lookup.
 *
 * It carries a concern name, an integer, an event and a platform. There is no
 * field that can hold a payload, a path or a prompt — the same shape-level
 * privacy floor `payload_stubs` keeps one row up.
 *
 * It lives in its own file rather than inside `dispatch_hook.ts` because that
 * file sits against the 1,500-line source budget, and `check_source_size_budget`
 * refused the inline version.
 */

/** Environment variable naming the JSONL sink. Registered in the kill-switch table. */
export const TIMINGS_SINK_ENV = "AGENT_CONFIG_HOOK_TIMINGS";

/**
 * One measurement.
 *
 * MICROseconds, not milliseconds. The dispatcher's `duration_ms` is floored,
 * and since the in-process fast path landed every registry concern finishes in
 * well under a millisecond — so the floored field reads exactly `0` for all of
 * them. That was invisible while nothing consumed the number and stops being
 * invisible the moment a p95 is reported and a timeout derived from it.
 */
export interface ConcernTimingSample {
  concern: string;
  duration_us: number;
}

/**
 * Append one JSONL row per concern, when the sink is armed.
 *
 * Never throws and never blocks the dispatch: a measurement sink that can fail
 * a hook would be a new way for the plumbing to refuse, which is the opposite
 * of what this roadmap is for.
 */
export function writeConcernTimings(
  event: string,
  platform: string,
  samples: readonly ConcernTimingSample[],
  sinkPath: string | undefined = process.env[TIMINGS_SINK_ENV],
): void {
  if (!sinkPath) {
    return;
  }
  try {
    const lines: string[] = [];
    for (const sample of samples) {
      // A concern the dispatcher never timed is OMITTED rather than recorded
      // as 0. A zero here would read as "instantaneous" and would be
      // indistinguishable from a real sub-millisecond run — the exact
      // substitution the report's `not_measured` requirement forbids one layer
      // up, reintroduced at the source instead of at the report.
      if (!Number.isFinite(sample.duration_us)) {
        continue;
      }
      lines.push(
        JSON.stringify({
          concern: sample.concern,
          // Rounded HERE rather than at the call site: the caller holds a
          // float millisecond reading and the sink is the one place that has
          // to decide the recorded unit.
          duration_us: Math.round(sample.duration_us),
          event,
          platform,
        }),
      );
    }
    if (lines.length > 0) {
      fs.appendFileSync(sinkPath, lines.join("\n") + "\n", "utf-8");
    }
  } catch {
    // Non-fatal by construction — see the header.
  }
}
