/**
 * Free explain mode — step 12.2.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 12.2: *"Add
 * a free explain mode: why task-side orchestration resolved to council, which
 * topology would run, estimated spend and calls, evidence source — with no paid
 * model call to explain routing"*, verified by *"explain mode issues zero
 * provider calls"*.
 *
 * ## Free is the load-bearing word, and it is structural
 *
 * This module imports **no client, no transport and no dispatch**. It reads
 * `explainLadder` (`_lib/judgment_ladder.ts:499`, itself regex-only) and
 * `estimate_cost` (`pricing.ts:121`, arithmetic over a price table). There is
 * nothing here to make a call WITH, which is a stronger guarantee than a
 * documented promise not to — and the test asserts the import graph rather than
 * trusting this paragraph.
 *
 * ## Three of the four fields are answerable today; one is not
 *
 *   1. **why it resolved to council** — `explainLadder`'s full per-rung trail,
 *      including rungs that were evaluated-and-rejected with the detector's own
 *      reason and rungs the short-circuit never reached. Free.
 *   2. **which topology would run** — NOT ANSWERABLE. 7.2 is open, no selector
 *      exists, and naming a topology here would be a guess dressed as an
 *      explanation. Reported as {@link TOPOLOGY_UNAVAILABLE}, never omitted:
 *      a field silently missing from an explanation reads as "not applicable".
 *   3. **estimated spend and calls** — arithmetic over the configured members,
 *      the round count and the price table, with the subscription-seat
 *      distinction `pricing.ts` already draws: a non-billable seat contributes
 *      calls but **zero** dollars, and the estimate says so per member rather
 *      than folding it into a total.
 *   4. **evidence source** — which artefact, if any, licenses the routing.
 *      `none` is a legal and common value today and is rendered as such.
 *
 * Pure and offline.
 */
import { explainLadder } from '../_lib/judgment_ladder.js';
import type { LadderExplanation, LadderInputs } from '../_lib/judgment_ladder.js';
import { estimate_cost, estimate_input_tokens } from './pricing.js';
import type { PriceTable } from './pricing.js';

/** The exact string the topology field carries while no selector exists. */
export const TOPOLOGY_UNAVAILABLE = 'unavailable — no topology selector exists (step 7.2 open)';

/** One member, as the estimate needs it. */
export interface EstimateMember {
    readonly name: string;
    readonly provider: string;
    readonly model: string;
    /**
     * `false` for a vendor-official CLI seat running under the user's
     * subscription auth — it contributes CALLS but no dollars, per
     * `pricing.ts` § billable-aware aggregation.
     */
    readonly billable: boolean;
}

export interface SpendEstimate {
    readonly calls: number;
    readonly usd: number;
    readonly perMember: readonly {
        readonly name: string;
        readonly calls: number;
        readonly usd: number;
        readonly billable: boolean;
    }[];
    /** Members whose calls are real but whose spend is zero. Named, not hidden. */
    readonly nonBillableMembers: readonly string[];
}

export interface RouteExplanation {
    /** Field 1 — free, from the regex-only resolver. */
    readonly ladder: LadderExplanation;
    /** Field 2 — always {@link TOPOLOGY_UNAVAILABLE} today. Present, never omitted. */
    readonly topology: string;
    /** Field 3 — arithmetic, no call. */
    readonly spend: SpendEstimate;
    /** Field 4 — the artefact licensing the route, or `'none'`. */
    readonly evidenceSource: string;
}

/**
 * Estimate calls and spend without issuing one.
 *
 * `calls` counts every member on every round; `usd` counts only the billable
 * ones. Reporting a subscription seat's answer at API rates is the defect
 * `pricing.ts` records finding on 2026-08-27, and this keeps the two figures
 * separate rather than reproducing it.
 */
export function estimateSpend(
    members: readonly EstimateMember[],
    rounds: number,
    questionText: string,
    maxOutputTokens: number,
    table: PriceTable,
): SpendEstimate {
    const inputTokens = estimate_input_tokens(questionText);
    const perMember = members.map((m) => {
        const calls = Math.max(0, rounds);
        if (!m.billable) return { name: m.name, calls, usd: 0, billable: false };
        const c = estimate_cost(m.provider, m.model, inputTokens, maxOutputTokens, table);
        return { name: m.name, calls, usd: (c.input_usd + c.output_usd) * calls, billable: true };
    });
    return {
        calls: perMember.reduce((a, m) => a + m.calls, 0),
        usd: perMember.reduce((a, m) => a + m.usd, 0),
        perMember,
        nonBillableMembers: perMember.filter((m) => !m.billable).map((m) => m.name),
    };
}

/** Build the whole explanation. No call is issued and none can be. */
export function explainRoute(
    ladderInputs: LadderInputs,
    members: readonly EstimateMember[],
    rounds: number,
    questionText: string,
    maxOutputTokens: number,
    table: PriceTable,
    evidenceSource: string = 'none',
): RouteExplanation {
    return {
        ladder: explainLadder(ladderInputs),
        topology: TOPOLOGY_UNAVAILABLE,
        spend: estimateSpend(members, rounds, questionText, maxOutputTokens, table),
        evidenceSource,
    };
}

/** Human-readable rendering. Every one of the four fields appears, including the unavailable one. */
export function renderRouteExplanation(e: RouteExplanation): string {
    const lines = [
        'council: explain (free — no provider call was issued)',
        '',
        `  resolution   rung ${String(e.ladder.result.rung)} / ${e.ladder.result.verdict}`,
        `  because      ${e.ladder.result.reason}`,
        '  ladder trail',
    ];
    for (const r of e.ladder.trail) {
        lines.push(`    rung ${String(r.rung)} → ${r.resolves_to.padEnd(8)} ${r.status.padEnd(12)} ${r.reason}`);
    }
    if (e.ladder.no_spawn_reason !== undefined) lines.push(`  no spawn     ${e.ladder.no_spawn_reason}`);
    lines.push(
        '',
        `  topology     ${e.topology}`,
        `  estimated    ${String(e.spend.calls)} call(s), $${e.spend.usd.toFixed(4)}`,
    );
    for (const m of e.spend.perMember) {
        lines.push(
            `    ${m.name.padEnd(14)} ${String(m.calls)} call(s), $${m.usd.toFixed(4)}` +
                (m.billable ? '' : '  (subscription seat — calls are real, spend is not)'),
        );
    }
    lines.push(`  evidence     ${e.evidenceSource}`, '');
    return lines.join('\n');
}
