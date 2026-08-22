#!/usr/bin/env tsx
/**
 * Publish `valid_envelope_rate` — three numbers, never one.
 *
 * `road-to-subagent-envelope-adoption` step 1.2: a rate with no denominator is
 * a claim, not a measurement. So every line carries the rate, the window
 * bounds, the stop count, AND the path it read — because the ledger is
 * gitignored and machine-local, so a figure with no path is not reproducible
 * even in principle.
 *
 * Named `report_` and not `check_` deliberately: this publishes a number and
 * gates nothing. `gate_population.matchesGatePattern` classifies on a
 * `lint|check|audit|skill|verify_` prefix, and a reporting script wearing a gate
 * prefix would be required to carry a coverage floor it has no business having.
 *
 * ## Rows this counts, and rows it refuses
 *
 * Only `subagent_stop` rows carrying a POST-SPLIT `envelope_parse` value. The
 * retired `absent` value collapsed `no_message` and `no_envelope` into one
 * bucket, so a rate computed across the boundary would mix two vocabularies and
 * report a number that is not about either. Rows with `absent` are excluded and
 * counted separately, so the exclusion is visible rather than silent.
 *
 * Exit 0 always: a report that fails is a gate, and this is not one.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const LEDGER_DIR = path.join(REPO_ROOT, 'agents', 'runtime', 'state', 'subagent-ledger');

export interface RateReport {
    ledger_paths: string[];
    stops: number;
    ok: number;
    rate: number;
    window_start: string | null;
    window_end: string | null;
    by_verdict: Record<string, number>;
    excluded_absent: number;
    by_agent_type: Record<string, number>;
}

export function computeRate(lines: readonly string[], paths: readonly string[]): RateReport {
    const by: Record<string, number> = {};
    const types: Record<string, number> = {};
    let stops = 0;
    let absent = 0;
    let start: string | null = null;
    let end: string | null = null;
    for (const line of lines) {
        let r: Record<string, unknown>;
        try {
            r = JSON.parse(line) as Record<string, unknown>;
        } catch {
            continue;
        }
        if (r['event'] !== 'subagent_stop') continue;
        const verdict = r['envelope_parse'];
        if (typeof verdict !== 'string') continue;
        if (verdict === 'absent') {
            absent += 1;
            continue;
        }
        stops += 1;
        by[verdict] = (by[verdict] ?? 0) + 1;
        const at = typeof r['agent_type'] === 'string' ? r['agent_type'] : '(null)';
        types[at] = (types[at] ?? 0) + 1;
        const ts = r['ts'];
        if (typeof ts === 'string') {
            if (start === null || ts < start) start = ts;
            if (end === null || ts > end) end = ts;
        }
    }
    const ok = by['ok'] ?? 0;
    return {
        ledger_paths: [...paths],
        stops,
        ok,
        // 0/0 is 0, not NaN: an empty ledger has a rate of zero valid envelopes
        // and a denominator that says so on the same line.
        rate: stops === 0 ? 0 : ok / stops,
        window_start: start,
        window_end: end,
        by_verdict: by,
        excluded_absent: absent,
        by_agent_type: types,
    };
}

function readLedger(dir: string): { lines: string[]; paths: string[] } {
    let names: string[] = [];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort();
    } catch {
        return { lines: [], paths: [] };
    }
    const lines: string[] = [];
    const paths: string[] = [];
    for (const n of names) {
        const abs = path.join(dir, n);
        paths.push(path.relative(REPO_ROOT, abs).split(path.sep).join('/'));
        lines.push(...fs.readFileSync(abs, 'utf-8').split('\n'));
    }
    return { lines, paths };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    // `--dir` so the report is reproducible against a ledger that is not this
    // checkout's. The ledger is gitignored and machine-local, so without it the
    // only readable ledger is the one beside the running copy — and a worktree
    // has none, which would make the figure unobtainable exactly where the work
    // happens.
    const i = argv.indexOf('--dir');
    const dir = i >= 0 && i + 1 < argv.length ? path.resolve(argv[i + 1] as string) : LEDGER_DIR;
    const { lines, paths } = readLedger(dir);
    const r = computeRate(lines, paths);
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        return 0;
    }
    if (r.ledger_paths.length === 0) {
        // Not a failure, and not a rate either. The ledger is gitignored, so a
        // clean clone has none — reporting 0 % there would be a number about
        // nothing.
        process.stdout.write(
            `valid_envelope_rate: NO LEDGER at ${dir} — ` +
                'the ledger is gitignored and machine-local, so this is expected in a fresh ' +
                'clone and is not a measurement of zero.\n',
        );
        return 0;
    }
    const pct = (r.rate * 100).toFixed(2);
    process.stdout.write(
        `valid_envelope_rate: ${pct}% — ${String(r.ok)} ok of ${String(r.stops)} stops, ` +
            `window ${r.window_start ?? '?'} → ${r.window_end ?? '?'}, ` +
            `read from ${r.ledger_paths.join(', ')}\n`,
    );
    const verdicts = Object.entries(r.by_verdict)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${String(v)}`)
        .join(' · ');
    process.stdout.write(`    verdicts: ${verdicts}\n`);
    process.stdout.write(
        `    excluded (retired \`absent\` vocabulary): ${String(r.excluded_absent)}\n`,
    );
    const comp = Object.entries(r.by_agent_type)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${String(v)}`)
        .join(' · ');
    process.stdout.write(`    agent-type composition: ${comp}\n`);
    process.stdout.write(
        '    CAVEAT: machine-local. This ledger is one machine\'s drain traffic, so the\n' +
            '    composition above is the shape of THIS traffic and the rate does not\n' +
            '    generalise. Published with the composition rather than alone, so the limit\n' +
            '    is readable instead of hidden.\n',
    );
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
