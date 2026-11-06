/**
 * Benchmark Interpretation Record for a paired ab-v2 report.
 *
 * A bad result is read as a question about the measurement before it is read as
 * a verdict on an asset. This names, per comparison, what the data itself can
 * establish — the task left no headroom, the sample cannot reach the sign-test
 * floor, the package never loaded, the priced cost is high — and lists what the
 * data cannot answer as open. It has no removal field, by construction: a
 * benchmark result alone never supports removing an asset.
 *
 *   ./scripts-run src/scripts/bench_ab_interpret <paired-report.json> [--json]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { MIN_DISCORDANT } from './_lib/paired_verdict.js';
import { analyse } from './bench_ab_v2_stats.js';

type Dict = Record<string, unknown>;

export const REMOVAL_SENTENCE = 'A benchmark result alone never supports removing an asset.';

/** Control scores at or above this leave too little room to show a lift. */
export const CEILING = 0.9;
/** Priced cost factor above this is reported as an overhead to diagnose. */
export const COST_FACTOR = 2;

export const OPEN_QUESTIONS = [
    'construct: did these tasks measure the benefit the asset is for?',
    'followed: did the agent act on the asset, not only load it?',
    'real-world use: does the asset show a benefit in real use that these tasks missed?',
] as const;

export interface Label {
    label: 'ceiling' | 'underpowered' | 'not-delivered' | 'cost-overhead';
    evidence: string;
    next: string;
}

function num(v: unknown): number {
    if (v && typeof v === 'object' && 'value' in (v as Dict)) return Number((v as Dict)['value']);
    return Number(v ?? 0);
}

function dict(v: unknown): Dict {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {};
}

function loadFailures(records: Dict[], arm: string): number {
    let n = 0;
    for (const rec of records) {
        const runs = dict(rec['arms'])[arm];
        for (const r of Array.isArray(runs) ? (runs as Dict[]) : []) {
            if (String(r['reason'] ?? '').startsWith('load_mismatch')) n += 1;
        }
    }
    return n;
}

function labelsFor(comp: Dict, records: Dict[], cost: Dict): Label[] {
    const out: Label[] = [];
    const cap = dict(comp['capability']);
    const dis = dict(comp['discipline']);
    const capBase = num(cap['rate_baseline']);
    const disBase = num(dis['mean_baseline']);
    const atCeiling = [
        ...(capBase >= CEILING ? [`capability ${capBase.toFixed(3)}`] : []),
        ...(disBase >= CEILING ? [`discipline ${disBase.toFixed(3)}`] : []),
    ];
    if (num(comp['n_pairs']) > 0 && atCeiling.length > 0) {
        out.push({
            label: 'ceiling',
            evidence: `control ${atCeiling.join(', ')} (≥ ${CEILING}); the axes named have no room to show a lift`,
            next: 'use tasks where the control fails more often on those axes',
        });
    }
    const capDisc = num(cap['discordant_b_only_treatment']) + num(cap['discordant_c_only_baseline']);
    const disDisc = num(dis['n_nonzero']);
    if (capDisc < MIN_DISCORDANT && disDisc < MIN_DISCORDANT) {
        out.push({
            label: 'underpowered',
            evidence: `discordant pairs: capability ${capDisc}, discipline ${disDisc} (sign-test floor ${MIN_DISCORDANT})`,
            next: 'size the next sweep with `task bench:ab:power`',
        });
    }
    const t = String(comp['arm_treatment']);
    const failed = loadFailures(records, t);
    if (failed > 0) {
        out.push({
            label: 'not-delivered',
            evidence: `${failed} ${t} trial(s) failed the load check`,
            next: 'fix delivery before reading any effect',
        });
    }
    const perArm = dict(cost['per_arm']);
    const tMean = dict(perArm[t])['mean_usd'];
    const bMean = dict(perArm[String(comp['arm_baseline'])])['mean_usd'];
    if (tMean != null && bMean != null && num(bMean) > 0) {
        const factor = num(tMean) / num(bMean);
        if (factor > COST_FACTOR) {
            out.push({
                label: 'cost-overhead',
                evidence: `priced cost factor ${factor.toFixed(2)}× (${String(cost['priced_by'] ?? 'unknown')} prices)`,
                next: 'break the cost down by bucket and by loaded asset before judging it',
            });
        }
    }
    return out;
}

export function interpret(payload: Dict, pricingPath?: string): Dict {
    const records = Array.isArray(payload['records']) ? (payload['records'] as Dict[]) : [];
    const analysis = pricingPath === undefined ? analyse(payload) : analyse(payload, pricingPath);
    const cost = dict(analysis['cost']);
    const comparisons = (Array.isArray(analysis['comparisons']) ? (analysis['comparisons'] as Dict[]) : []).map((c) => ({
        label: c['label'],
        arm_treatment: c['arm_treatment'],
        arm_baseline: c['arm_baseline'],
        n_pairs: num(c['n_pairs']),
        labels: labelsFor(c, records, cost),
        open_questions: [...OPEN_QUESTIONS],
    }));
    return {
        stamp: analysis['stamp'] ?? null,
        model: analysis['model'] ?? null,
        comparisons,
        removal_supported: false,
        note: REMOVAL_SENTENCE,
    };
}

export function renderRecord(rec: Dict): string {
    const lines = [`# Benchmark interpretation — ${String(rec['stamp'] ?? 'unstamped')} · ${String(rec['model'] ?? 'unknown model')}`, ''];
    for (const c of rec['comparisons'] as Dict[]) {
        lines.push(`## ${String(c['arm_treatment'])} vs ${String(c['arm_baseline'])} (n=${String(c['n_pairs'])} pairs)`, '');
        const ls = c['labels'] as Label[];
        if (ls.length === 0) lines.push('- no measurement defect detected from the data');
        for (const l of ls) lines.push(`- **${l.label}** — ${l.evidence}. Next: ${l.next}.`);
        lines.push('', 'Open:', ...(c['open_questions'] as string[]).map((q) => `- ${q}`), '');
    }
    lines.push(`> ${REMOVAL_SENTENCE}`, '');
    return lines.join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const file = argv.find((a) => !a.startsWith('--'));
    if (file === undefined) {
        process.stderr.write('usage: bench_ab_interpret <paired-report.json> [--json]\n');
        return 2;
    }
    let payload: Dict;
    try {
        payload = JSON.parse(fs.readFileSync(file, 'utf8')) as Dict;
    } catch (err) {
        process.stderr.write(`bench_ab_interpret: ${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
    const rec = interpret(payload);
    process.stdout.write(argv.includes('--json') ? `${JSON.stringify(rec, null, 2)}\n` : renderRecord(rec));
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
