#!/usr/bin/env tsx
/**
 * Replay the four registered council attendance metrics over an events log.
 *
 * Step 3.2 of `road-to-council-evidence-integrity`. The metrics were registered
 * in `src/config/quorum-attendance-budget.json` on 2026-08-10 and nothing in the
 * tree ever computed them, so "the four registered metrics reproduce unchanged
 * across the schema bump" was a claim with no instrument. This is the instrument.
 *
 * ## The exclusion rule, which is the whole point of the schema version
 *
 * `stance_agreement` arrived at schema v5. A line written at v4 or earlier does
 * not carry the field and NO honest value can be inferred for it — a v4 pass may
 * have had a stance tally whose verdict was never recorded, or none at all, and
 * the line cannot tell you which. So the agreement rate's denominator is
 * v5-and-later lines ONLY, and this reports the excluded count next to the rate
 * rather than folding it in. Defaulting the missing field to `not_tallied` would
 * manufacture a measurement out of an absence, which is the defect class this
 * whole roadmap exists to close.
 *
 * The four pre-existing metrics are computed over their own documented
 * populations, unchanged by the bump: they read fields that exist at every
 * version they were registered against.
 *
 * ## Scope, stated rather than discovered later
 *
 * `agents/runtime/council/events.log` is gitignored and machine-local, so every
 * reading is one machine's traffic and no rate from it generalises. A rate
 * printed here describes the log it was given and nothing else.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The version at which `stance_agreement` began to be written. */
export const STANCE_AGREEMENT_SINCE = 5;

type Line = Record<string, unknown>;

export interface AttendanceMetrics {
    /** post_run, command=run lines — the population every rate below is scoped to. */
    readonly passes: number;
    /** present / total, summed over passes. `null` when there are none. */
    readonly attendance_rate: number | null;
    /** share of passes with total < configured_total. */
    readonly roster_shortfall_rate: number | null;
    /** share of passes with `solo: true`. */
    readonly solo_conclusion_rate: number | null;
    /** share of passes with `floor_would_hold: true`. */
    readonly shadow_floor_fire_rate: number | null;
    /** count per `absent[].reason`. */
    readonly absent_reason_distribution: Record<string, number>;
    /**
     * Share of AGREEMENT-ELIGIBLE passes that reached consensus. The denominator
     * is `agreement_eligible`, never `passes` — see the module header.
     */
    readonly consensus_rate: number | null;
    /** Passes at schema >= STANCE_AGREEMENT_SINCE. The agreement denominator. */
    readonly agreement_eligible: number;
    /** Passes excluded from the agreement rate because their schema predates the field. */
    readonly agreement_excluded: number;
}

export function parseLog(text: string): Line[] {
    const out: Line[] = [];
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (line === '') continue;
        try {
            const rec = JSON.parse(line) as unknown;
            if (rec !== null && typeof rec === 'object' && !Array.isArray(rec)) {
                out.push(rec as Line);
            }
        } catch {
            // A malformed line is skipped, never guessed at. It is counted
            // nowhere, which is the honest treatment: it is not a pass that
            // happened one way, it is a line nobody can read.
        }
    }
    return out;
}

export function computeMetrics(lines: readonly Line[]): AttendanceMetrics {
    // The documented population: post_run proves providers were actually
    // called; `command: run` excludes the spend-free estimate preview.
    const passes = lines.filter(
        (l) => l['action'] === 'quorum_result' && l['phase'] === 'post_run' && l['command'] === 'run',
    );
    const n = passes.length;
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const share = (pred: (l: Line) => boolean): number | null =>
        n === 0 ? null : passes.filter(pred).length / n;

    const attendance_rate =
        n === 0
            ? null
            : passes.reduce((acc, l) => {
                  const total = num(l['total']);
                  return acc + (total === 0 ? 0 : num(l['present']) / total);
              }, 0) / n;

    const absent_reason_distribution: Record<string, number> = {};
    for (const l of passes) {
        const absent = l['absent'];
        if (!Array.isArray(absent)) continue;
        for (const a of absent) {
            if (a === null || typeof a !== 'object') continue;
            const reason = String((a as Line)['reason'] ?? 'unavailable');
            absent_reason_distribution[reason] = (absent_reason_distribution[reason] ?? 0) + 1;
        }
    }

    // The exclusion, applied on the SCHEMA VERSION rather than on the presence
    // of the key. A v5 line whose field is somehow absent is a defect worth
    // seeing; keying on presence would silently reclassify it as old data.
    const eligible = passes.filter((l) => num(l['schema_version']) >= STANCE_AGREEMENT_SINCE);
    const consensus_rate =
        eligible.length === 0 ? null : eligible.filter((l) => l['stance_agreement'] === 'consensus').length / eligible.length;

    return {
        passes: n,
        attendance_rate,
        roster_shortfall_rate: share((l) => num(l['total']) < num(l['configured_total'])),
        solo_conclusion_rate: share((l) => l['solo'] === true),
        shadow_floor_fire_rate: share((l) => l['floor_would_hold'] === true),
        absent_reason_distribution,
        consensus_rate,
        agreement_eligible: eligible.length,
        agreement_excluded: n - eligible.length,
    };
}

function repoRoot(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function main(argv: string[]): number {
    const asJson = argv.includes('--json');
    const pathArg = argv.find((a) => !a.startsWith('--'));
    const logPath = pathArg ?? path.join(repoRoot(), 'agents/runtime/council/events.log');
    if (!fs.existsSync(logPath)) {
        process.stderr.write(
            `council_attendance_metrics: no log at ${logPath}\n` +
                '  This is an honest null, not a failure: the log is gitignored and\n' +
                '  machine-local, so a fresh checkout legitimately has none.\n',
        );
        return 0;
    }
    const m = computeMetrics(parseLog(fs.readFileSync(logPath, 'utf8')));
    if (asJson) {
        process.stdout.write(`${JSON.stringify(m, null, 2)}\n`);
        return 0;
    }
    const pct = (v: number | null): string => (v === null ? 'n/a (no passes)' : `${(v * 100).toFixed(1)}%`);
    process.stdout.write(`council attendance metrics · ${logPath}\n`);
    process.stdout.write(`  (machine-local log — this describes THIS log, and generalises to nothing)\n\n`);
    process.stdout.write(`  post_run/command=run passes   ${String(m.passes)}\n`);
    process.stdout.write(`  attendance_rate               ${pct(m.attendance_rate)}\n`);
    process.stdout.write(`  roster_shortfall_rate         ${pct(m.roster_shortfall_rate)}\n`);
    process.stdout.write(`  solo_conclusion_rate          ${pct(m.solo_conclusion_rate)}\n`);
    process.stdout.write(`  shadow_floor_fire_rate        ${pct(m.shadow_floor_fire_rate)}\n`);
    process.stdout.write(
        `  consensus_rate                ${pct(m.consensus_rate)}  (denominator ${String(m.agreement_eligible)} v${String(STANCE_AGREEMENT_SINCE)}+ lines; ${String(m.agreement_excluded)} older lines EXCLUDED, not defaulted)\n`,
    );
    const dist = Object.entries(m.absent_reason_distribution).sort(([a], [b]) => a.localeCompare(b));
    process.stdout.write(`  absent_reason_distribution    ${dist.length === 0 ? '(none)' : dist.map(([k, v]) => `${k}=${String(v)}`).join(' · ')}\n`);
    return 0;
}

if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exitCode = main(process.argv.slice(2));
        }
    } catch {
        const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
        if (import.meta.url === argvUrl) {
            process.exitCode = main(process.argv.slice(2));
        }
    }
}
