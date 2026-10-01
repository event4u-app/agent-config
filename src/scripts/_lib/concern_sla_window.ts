/**
 * Per-concern SLA measurement and the warn-only window's reporting.
 *
 * Extracted from `bench_hook_latency.ts` on 2026-10-01, not for tidiness: the
 * additions that made `one-question-per-ask` measurable and gave the warn-only
 * window a reader pushed that file from 1,361 lines to 1,583, i.e. 83 lines
 * past the 1,500-line source ceiling, and `check_source_size_budget`'s ratchet
 * asked for exactly this by name. Raising the baseline was the other option
 * and is the one the ratchet exists to make visible rather than easy — a MOVE
 * gives the budget back instead of spending it, which is the doctrine every
 * entry in `gate-violation-baselines.json` records.
 *
 * It is also the better boundary on its own terms. Everything here answers one
 * question — which blocking concern is bounded, by how much, and did this run
 * cross it — and none of it is about measuring a hook SLOT, which is what the
 * bench itself does.
 *
 * NOTHING HERE GATES. The bound these functions read is not armed anywhere:
 * step 3.3 of `road-to-a-kernel-that-guards-its-plumbing` is its only consumer
 * and is blocked on the window these functions report. A measurement that can
 * red a build before its bar is validated is Risk 1 of that roadmap.
 */
import * as fs from 'node:fs';

/**
 * The subset of a per-concern row the window needs: a measurement and a bound.
 *
 * Declared here rather than imported so the dependency runs one way only —
 * `bench_hook_latency.ts` imports this module and this module imports nothing
 * back. `ConcernLatencyRow` satisfies it structurally, so the caller passes its
 * own rows unchanged and no adapter exists to drift.
 */
export interface BoundedConcern {
    readonly concern: string;
    /** p95 of the concern's own durations in microseconds, or null when untimed. */
    readonly p95_us: number | null;
    /** The registered SLA in milliseconds, or null when none is registered. */
    readonly sla_ms: number | null;
    /** The budget carried a value for this concern that is not a number. */
    readonly sla_malformed: boolean;
}

/**
 * An alternate tool shape for the synthetic payload.
 *
 * The default payload names `Read`, which is the right default for every gated
 * number: it is the common non-matching case consumers pay on every tool call.
 * But a concern filtered by the manifest's per-concern `tools:` key is SKIPPED
 * in-process on a payload naming a tool it does not claim, so it never produces
 * a sample and the per-concern report prints `not_measured` for it — correctly,
 * and uselessly for a step that needs a bound.
 *
 * `one-question-per-ask` is the live instance: `severity: blocking`, filtered to
 * `AskUserQuestion` and five aliases. It is the only blocking concern the
 * default payload cannot reach, and the owning roadmap's Phase-3 blocker names
 * the choice explicitly — "either a payload shaped to trigger it or an explicit
 * decision that an unmeasured blocking concern keeps the current 30 s timeout".
 * This is the first branch: measure it, so the decision is not forced by the
 * harness.
 *
 * Measurement-only, like `--bundle` and `--payload-bytes`. It is reachable only
 * from `concernSlaPass`, which gates nothing and writes no budget row — a probe
 * payload must never produce a gated slot number, because the slot caps were
 * derived against the `Read` shape and a different shape runs a different
 * concern chain.
 */
export interface ToolShape {
    readonly tool_name: string;
    readonly tool_input: Record<string, unknown>;
}

/**
 * The probe that reaches `one-question-per-ask`.
 *
 * ONE question, not two: a single question is the ALLOW path, and the allow
 * path is what an ordinary call costs. Two questions would measure the deny
 * path — the rarer branch, and the one that builds a message — so a bound taken
 * from it would describe the exception rather than the rule. Both run
 * `countStructuredAskQuestions`, which is the concern's actual work.
 */
export const ASK_PROBE: ToolShape = {
    tool_name: 'AskUserQuestion',
    tool_input: { questions: [{ question: 'bench probe' }] },
};

/**
 * The one concern the ask probe exists to measure.
 *
 * Named rather than inferred from the `tools:` filter: a future concern added
 * with an overlapping filter would be measured under a payload chosen for THIS
 * one, and silently adopting it is the contamination above wearing a different
 * shape.
 */
export const PROBE_TARGET = 'one-question-per-ask';

/**
 * Append only `target`'s samples from the probe sink onto the main sink.
 *
 * The probe sink is read and then left in place; it is a temp-dir file the
 * caller owns. A read failure is not fatal — the probe is an observation, and
 * a bench that dies because one auxiliary sink was unreadable converts a
 * measurement into an outage, which is the posture `readConcernTimings`
 * already takes one level down.
 */
export function mergeProbeSamples(probeSink: string, sinkPath: string, target: string): void {
    let text: string;
    try {
        text = fs.readFileSync(probeSink, 'utf-8');
    } catch {
        return;
    }
    const keep: string[] = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '') continue;
        let row: { concern?: unknown };
        try {
            row = JSON.parse(trimmed) as typeof row;
        } catch {
            continue;
        }
        if (row.concern === target) keep.push(trimmed);
    }
    if (keep.length === 0) return;
    try {
        fs.appendFileSync(sinkPath, `${keep.join('\n')}\n`, 'utf-8');
    } catch {
        /* the sink is an observation aid; losing it must not fail the bench */
    }
}

/**
 * The warn-only window, made legible — observe-only, gating nothing.
 *
 * Step 3.3 derives a per-concern timeout of `sla_ms x 3` and its own text says
 * "warn-only for the first measured window, then deny". A window nothing
 * observes is not a window: with `sla_ms` registered and no reader, the flip
 * would be taken on the absence of a complaint rather than on a reading.
 *
 * So this is the instrument. Every bench run — local or CI, gated or not —
 * prints each blocking concern's measured p95 beside its registered bound and
 * names any concern that crossed it. The window is then a span of runs a human
 * can read, and the flip has an evidence base that exists before it is taken.
 *
 * It lives in the measurement harness and NOT in the dispatcher deliberately.
 * A runtime warn would be a dispatcher change shipped as part of a step that is
 * blocked on the very readings it would produce, and Risk 1 of the owning
 * roadmap is precisely about acting on a bound before it is validated.
 *
 * A concern with no registered SLA, or no measurement, is NOT an overrun — it
 * is an unknown, and the two must not collapse. Returning it as "fine" would
 * let an unregistered concern read as a clean window.
 */
export interface SlaOverrun {
    concern: string;
    p95_us: number;
    /** `sla_ms x 3`, in microseconds — the bound step 3.3 would apply. */
    bound_us: number;
}

/**
 * What a run can actually say about the window — three counts, never one.
 *
 * `registered` is how many concerns carry a bound. `usable` is how many of
 * those this run could compare against it. The gap is what an earlier version
 * of the summary line silently dropped: it printed "none over" off `registered`,
 * so a run that measured none of its bounded concerns read exactly like a run
 * that measured all of them and found nothing. That is the same
 * unknown-collapsed-into-fine failure `slaOverruns` refuses per row, one level
 * up at the summary.
 */
export interface WindowState {
    registered: number;
    usable: number;
    /** Registered but not comparable this run — unmeasured or malformed. */
    unusable: number;
}

export function windowState(rows: readonly BoundedConcern[]): WindowState {
    let registered = 0;
    let usable = 0;
    for (const row of rows) {
        if (row.sla_ms === null && !row.sla_malformed) continue;
        registered += 1;
        if (!row.sla_malformed && row.sla_ms !== null && row.p95_us !== null) usable += 1;
    }
    return { registered, usable, unusable: registered - usable };
}

export function slaOverruns(rows: readonly BoundedConcern[]): SlaOverrun[] {
    const out: SlaOverrun[] = [];
    for (const row of rows) {
        if (row.sla_ms === null || row.sla_malformed || row.p95_us === null) continue;
        const bound_us = row.sla_ms * 3 * 1000;
        if (row.p95_us > bound_us) {
            out.push({ concern: row.concern, p95_us: row.p95_us, bound_us });
        }
    }
    return out;
}
