#!/usr/bin/env node
/**
 * Report the spec axis's measured effect on the review surface.
 *
 * The question this answers, and the only one: over the observation window,
 * how often did the spec axis change the recommendation the craft judges would
 * have produced alone? The honest answers include **zero**, and **"nothing was
 * recorded"** — which is a third answer, not a variant of zero. A report that
 * printed `0 changed` over an empty ledger would read as evidence the axis is
 * useless, when it is evidence that nothing has been observed yet; those two
 * states are separated everywhere below.
 *
 * Three populations, never collapsed (the same model `check_pack_size` and
 * `check_requirements_trace` use):
 *   observed   — lines in the window
 *   comparable — lines where the axis ran, so a counterfactual exists
 *   changed    — comparable lines where it flipped the recommendation
 *
 * `comparable` is the denominator, never `observed`: a run where the axis was
 * unreachable carries `spec_axis_effect: null` and contributes to neither
 * numerator nor denominator. Dividing by `observed` would report a low rate for
 * an axis that was never given the chance to act, which is the mis-attribution
 * this split exists to prevent.
 *
 * Exit code is 0 on every outcome including the empty one. This is a REPORT,
 * not a gate — there is no threshold it could honestly enforce with the window
 * this repo has, and a gate over an unmeasured surface fails for the wrong
 * reason. `--self-test` exercises the pure summariser and exits non-zero on a
 * mismatch.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { ReviewLine } from './_lib/review_telemetry.js';

export interface ReviewAxisSummary {
    observed: number;
    /** Lines where the axis ran, i.e. a counterfactual exists. */
    comparable: number;
    changed: number;
    unchanged: number;
    /** Lines where the axis could not run at all. */
    unreachable: number;
    /** Reviews that ran with no criteria supplied — the axis reached, nothing to measure against. */
    no_criteria: number;
    /** Criteria handed over and unreadable — an error state, never folded into no_criteria. */
    unparseable: number;
    /** Earliest / latest `at` seen, or null over an empty window. */
    window_start: string | null;
    window_end: string | null;
}

/** Pure summariser — the unit under `--self-test`. */
export function summarise(lines: readonly ReviewLine[]): ReviewAxisSummary {
    const s: ReviewAxisSummary = {
        observed: 0,
        comparable: 0,
        changed: 0,
        unchanged: 0,
        unreachable: 0,
        no_criteria: 0,
        unparseable: 0,
        window_start: null,
        window_end: null,
    };
    for (const l of lines) {
        s.observed += 1;
        if (s.window_start === null || l.at < s.window_start) s.window_start = l.at;
        if (s.window_end === null || l.at > s.window_end) s.window_end = l.at;
        if (l.spec_axis_reach === 'unreachable') s.unreachable += 1;
        if (l.criteria_source === 'not_provided') s.no_criteria += 1;
        if (l.criteria_source === 'supplied_unparseable') s.unparseable += 1;
        if (l.spec_axis_effect === 'changed') {
            s.comparable += 1;
            s.changed += 1;
        } else if (l.spec_axis_effect === 'unchanged') {
            s.comparable += 1;
            s.unchanged += 1;
        }
    }
    return s;
}

/** Render the summary as the prose a human reads. Empty window says so in words. */
export function render(s: ReviewAxisSummary): string {
    const out: string[] = [];
    if (s.observed === 0) {
        out.push('NO WINDOW — 0 reviews recorded, so the spec axis has no measured effect in either direction.');
        out.push('This is not "the axis changed nothing": nothing has been observed yet. Rerun once reviews have run.');
        return out.join('\n');
    }
    out.push(`window: ${String(s.window_start)} … ${String(s.window_end)}`);
    out.push(`observed: ${s.observed} review(s)`);
    if (s.comparable === 0) {
        out.push(
            'comparable: 0 — the axis ran in none of them, so it changed nothing BY CONSTRUCTION, ' +
                'which is not evidence about the axis.',
        );
    } else {
        const pct = ((s.changed / s.comparable) * 100).toFixed(1);
        out.push(`comparable: ${s.comparable} (the axis ran; a counterfactual exists)`);
        out.push(`changed the recommendation: ${s.changed} of ${s.comparable} (${pct}%)`);
        if (s.changed === 0) {
            out.push('The honest reading of 0: the axis ran and never flipped a verdict over this window.');
        }
    }
    out.push(
        `not comparable: ${s.unreachable} unreachable · ${s.no_criteria} ran with no criteria · ` +
            `${s.unparseable} with unreadable criteria (an error state, counted apart)`,
    );
    return out.join('\n');
}

function readLedger(dir: string): ReviewLine[] {
    if (!fs.existsSync(dir)) return [];
    const lines: ReviewLine[] = [];
    for (const f of fs.readdirSync(dir).sort()) {
        if (!f.endsWith('.jsonl')) continue;
        for (const raw of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
            const t = raw.trim();
            if (!t) continue;
            try {
                const o = JSON.parse(t) as ReviewLine;
                if (o && o.schema === 'review-axis-v1') lines.push(o);
            } catch {
                // A malformed line is skipped, never guessed at.
            }
        }
    }
    return lines;
}

function selfTest(): number {
    const at = '2026-08-22T00:00:00Z';
    const base = {
        schema: 'review-axis-v1' as const,
        at,
        judges_declared: 6,
        judges_ran: 6,
        criteria_count: 2,
        spec_missing: 0,
        spec_partial: 0,
        recommendation: 'proceed' as const,
    };
    const cases: { name: string; lines: ReviewLine[]; want: Partial<ReviewAxisSummary>; wantText?: string }[] = [
        { name: 'empty window is not zero-effect', lines: [], want: { observed: 0, comparable: 0 }, wantText: 'NO WINDOW' },
        {
            name: 'unreachable contributes to neither population',
            lines: [
                {
                    ...base,
                    spec_axis_reach: 'unreachable',
                    criteria_source: 'not_provided',
                    criteria_count: 0,
                    spec_axis_effect: null,
                },
            ],
            want: { observed: 1, comparable: 0, changed: 0, unreachable: 1 },
            wantText: 'BY CONSTRUCTION',
        },
        {
            name: 'changed and unchanged both land in comparable',
            lines: [
                { ...base, spec_axis_reach: 'reachable_with_criteria', criteria_source: 'supplied', spec_axis_effect: 'changed' },
                { ...base, spec_axis_reach: 'reachable_with_criteria', criteria_source: 'supplied', spec_axis_effect: 'unchanged' },
            ],
            want: { observed: 2, comparable: 2, changed: 1, unchanged: 1 },
        },
        {
            name: 'unparseable is counted apart from no_criteria',
            lines: [
                {
                    ...base,
                    spec_axis_reach: 'reachable_no_criteria',
                    criteria_source: 'supplied_unparseable',
                    criteria_count: 0,
                    spec_axis_effect: 'unchanged',
                },
            ],
            want: { observed: 1, no_criteria: 0, unparseable: 1, comparable: 1 },
        },
    ];
    let pass = 0;
    let fail = 0;
    for (const c of cases) {
        const got = summarise(c.lines);
        const bad = Object.entries(c.want).filter(([k, v]) => got[k as keyof ReviewAxisSummary] !== v);
        const text = render(got);
        const textBad = c.wantText !== undefined && !text.includes(c.wantText);
        if (bad.length === 0 && !textBad) {
            pass += 1;
        } else {
            fail += 1;
            console.error(`❌ ${c.name}`);
            for (const [k, v] of bad) console.error(`   ${k}: want ${String(v)}, got ${String(got[k as keyof ReviewAxisSummary])}`);
            if (textBad) console.error(`   prose missing: ${String(c.wantText)}`);
        }
    }
    console.log(`review_axis_report --self-test: ${pass} pass, ${fail} fail`);
    return fail === 0 ? 0 : 1;
}

function main(argv: string[]): number {
    if (argv.includes('--self-test')) return selfTest();
    const dirIdx = argv.indexOf('--dir');
    const dir =
        dirIdx >= 0 && argv[dirIdx + 1] !== undefined
            ? String(argv[dirIdx + 1])
            : path.join(process.cwd(), 'agents', 'runtime', 'state', 'review-axis');
    const lines = readLedger(dir);
    console.log(render(summarise(lines)));
    console.log(`scanned: ${lines.length}`);
    return 0;
}

if (process.argv[1] !== undefined && process.argv[1].includes('review_axis_report')) {
    process.exit(main(process.argv.slice(2)));
}
