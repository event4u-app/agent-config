/**
 * Cost-of-parity metrics (road-to-a-baseline-that-has-to-catch-up step 4.3).
 *
 * Two directions over one vocabulary. `aggregateParityArm` folds the parity
 * loop's per-run records (one JSONL line per run from the artifact sweep) into
 * a bundle's `parity.arms.<arm>` row; `parityMetricRows` and `renderParity`
 * turn a bundle back into the table a page shows. `summarizeSweep` is the
 * cheap read a release step needs: per task, the parity rows and a paired
 * verdict over first-shot bar reach.
 *
 * Verdict words come from `paired_verdict.ts` only, plus `INDETERMINATE` for
 * "nothing was measured" — which is never a kind of pass.
 *
 * Censored runs are counted and shown, never imputed: "prompts to parity" is a
 * median over the runs that reached the bar, and "share not reached by K" is
 * censored over k. "Total tokens to target" sums every run that either reached
 * the bar or ran to the cap, because a censored run's tokens are part of what
 * the arm spent trying.
 */
import { decidePairedVerdict, type PairedVerdictKind } from './paired_verdict.js';
import type { ParityArm, ShowcaseSummary } from './showcase_bundle.js';

/** The parity loop's per-run record, as the sweep writes it (plus its seed). */
export interface ParityRunLine {
    task: string;
    arm: string;
    ladder: string;
    parity_bar: number;
    cap_k: number;
    outcome: 'reached' | 'censored' | 'indeterminate' | 'errored';
    prompts_to_parity: number | null;
    first_shot_score: number | null;
    tokens_total: number | null;
    turns_total: number | null;
    usd_total?: number | null;
    seed?: number;
}

export type ShowcaseVerdict = PairedVerdictKind | 'INDETERMINATE';

const lowerMedian = (values: Array<number | null | undefined>): number | null => {
    const xs = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
    return xs.length === 0 ? null : (xs[Math.floor((xs.length - 1) / 2)] as number);
};

const sumOrNull = (values: Array<number | null | undefined>): number | null =>
    values.length === 0 || values.some((v) => typeof v !== 'number') ? null : (values as number[]).reduce((a, b) => a + b, 0);

/** Fold one arm's parity runs into a bundle row. */
export function aggregateParityArm(runs: readonly ParityRunLine[]): ParityArm {
    const reached = runs.filter((r) => r.outcome === 'reached');
    const toTarget = runs.filter((r) => r.outcome === 'reached' || r.outcome === 'censored');
    return {
        reached: reached.length,
        censored: runs.filter((r) => r.outcome === 'censored').length,
        prompts: lowerMedian(reached.map((r) => r.prompts_to_parity)),
        turns: lowerMedian(reached.map((r) => r.turns_total)),
        tokens: lowerMedian(reached.map((r) => r.tokens_total)),
        usd_to_parity: lowerMedian(reached.map((r) => r.usd_total ?? null)),
        tokens_to_target_total: sumOrNull(toTarget.map((r) => r.tokens_total)),
    };
}

export interface ParityMetricRow {
    arm: string;
    label: string;
    reached: number;
    censored: number;
    /** censored / k, the share of runs that did not reach the bar within the cap. */
    share_not_reached: number;
    prompts: number | null;
    turns: number | null;
    tokens: number | null;
    usd: number | null;
    tokens_to_target_total: number | null;
}

export function parityMetricRows(s: ShowcaseSummary): ParityMetricRow[] {
    const rows: ParityMetricRow[] = [];
    for (const arm of s.arms) {
        const p = s.parity.arms[arm.id];
        if (p === undefined) continue;
        rows.push({
            arm: arm.id,
            label: arm.label,
            reached: p.reached,
            censored: p.censored,
            share_not_reached: s.k > 0 ? p.censored / s.k : 0,
            prompts: p.prompts,
            turns: p.turns,
            tokens: p.tokens,
            usd: p.usd_to_parity,
            tokens_to_target_total: p.tokens_to_target_total,
        });
    }
    return rows;
}

const fmt = (n: number | null): string => (n === null ? 'unknown' : String(Number.isInteger(n) ? n : Number(n.toFixed(4))));
const pct = (n: number): string => `${Number((n * 100).toFixed(1))} %`;
const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** The page's "Cost of parity" section, every metric of step 4.3. */
export function renderParity(s: ShowcaseSummary): string[] {
    const L: string[] = [];
    L.push('## Cost of parity');
    L.push('');
    L.push(
        `Each arm that missed the bar was resumed with the next step of a feedback ladder written before any run, up to ${s.parity.cap_k} prompts. ` +
            'Censored runs did not reach the bar within the cap and are not imputed. Per-run columns are medians over the runs that reached the bar; ' +
            'total tokens to target sums every run that reached the bar or ran to the cap.',
    );
    L.push('');
    L.push('| Parity bar | With-agent-config first-shot median |');
    L.push('|---|---|');
    L.push(`| ${s.parity.parity_bar} | ${fmt(s.parity.with_arm_first_shot_median)} |`);
    L.push('');
    L.push('| Arm | Reached | Censored | Not reached by K | Prompts to parity | Turns to parity | Tokens to parity | USD to parity | Total tokens to target |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const r of parityMetricRows(s)) {
        L.push(
            `| ${cell(r.label)} | ${r.reached} | ${r.censored} | ${pct(r.share_not_reached)} | ${fmt(r.prompts)} | ${fmt(r.turns)} | ` +
                `${fmt(r.tokens)} | ${fmt(r.usd)} | ${fmt(r.tokens_to_target_total)} |`,
        );
    }
    return L;
}

export interface SweepTaskSummary {
    task: string;
    arms: Record<string, ParityArm>;
    verdict: ShowcaseVerdict;
    reason: string;
}

export interface SweepSummary {
    tasks: SweepTaskSummary[];
    verdict: ShowcaseVerdict;
    reason: string;
}

/**
 * Per task: parity rows per arm, and a paired verdict of `treatment` against
 * `control` over first-shot bar reach, paired by (seed, ladder). A pair whose
 * either side has no first-shot score is dropped, never scored as a miss.
 * No runs at all → INDETERMINATE.
 */
export function summarizeSweep(lines: readonly ParityRunLine[], treatment = 'package', control = 'vanilla'): SweepSummary {
    if (lines.length === 0) return { tasks: [], verdict: 'INDETERMINATE', reason: 'no artifact runs were recorded' };
    const tasks: SweepTaskSummary[] = [];
    for (const task of [...new Set(lines.map((l) => l.task))].sort()) {
        const mine = lines.filter((l) => l.task === task);
        const arms: Record<string, ParityArm> = {};
        for (const arm of [...new Set(mine.map((l) => l.arm))].sort()) arms[arm] = aggregateParityArm(mine.filter((l) => l.arm === arm));
        const key = (l: ParityRunLine): string => `${l.seed ?? 0}/${l.ladder}`;
        const ctrl = new Map(mine.filter((l) => l.arm === control).map((l) => [key(l), l]));
        const deltas: number[] = [];
        for (const t of mine.filter((l) => l.arm === treatment)) {
            const c = ctrl.get(key(t));
            if (c === undefined || t.first_shot_score === null || c.first_shot_score === null) continue;
            deltas.push(Number(t.first_shot_score >= t.parity_bar) - Number(c.first_shot_score >= c.parity_bar));
        }
        if (deltas.length === 0) {
            tasks.push({ task, arms, verdict: 'INDETERMINATE', reason: `no scored ${treatment}/${control} pair` });
            continue;
        }
        const v = decidePairedVerdict({ deltas });
        tasks.push({ task, arms, verdict: v.kind, reason: v.reason });
    }
    const kinds = tasks.map((t) => t.verdict);
    const verdict: ShowcaseVerdict = kinds.includes('regression')
        ? 'regression'
        : kinds.every((k) => k === 'INDETERMINATE')
          ? 'INDETERMINATE'
          : kinds.every((k) => k === 'pass')
            ? 'pass'
            : kinds.includes('underpowered') || kinds.includes('INDETERMINATE')
              ? 'underpowered'
              : 'no-change';
    return { tasks, verdict, reason: `${tasks.length} task(s): ${kinds.join(', ')}` };
}

/** Parse the sweep's JSONL; a malformed line is reported, never skipped silently. */
export function parseSweepJsonl(text: string): { lines: ParityRunLine[]; problems: string[] } {
    const lines: ParityRunLine[] = [];
    const problems: string[] = [];
    text.split('\n').forEach((raw, i) => {
        if (raw.trim() === '') return;
        try {
            const o = JSON.parse(raw) as ParityRunLine;
            if (typeof o.task !== 'string' || typeof o.arm !== 'string' || typeof o.outcome !== 'string') problems.push(`line ${i + 1}: not a parity run`);
            else lines.push(o);
        } catch {
            problems.push(`line ${i + 1}: not JSON`);
        }
    });
    return { lines, problems };
}
