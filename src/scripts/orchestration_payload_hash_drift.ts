#!/usr/bin/env node
/**
 * Payload-hash × cache-hit drift report — CLI.
 *
 * `road-to-cache-economy.md` Phase 3, steps 6-7. Reads the
 * accumulated audit-log-v1 telemetry (reuses `readAuditLines` from
 * `orchestration_savings_report.ts` — the same reader, not a reimplementation)
 * and joins `orchestration.payload_hash` against `orchestration.cache_hit`
 * per {@link aggregatePayloadHashDrift}'s cohort split, so prefix-stability
 * drift becomes visible.
 *
 * REFUSAL (step 7 — report it, never act on it): `cache_hit` is a
 * provider-reported proxy for HOST-controlled cache behaviour, not a metric
 * this package causes or controls. Per ADR-118's automation threshold (§1:
 * a direct measure, a low false-positive rate, and no unique human
 * judgement required — all three, or it stays manual), a host-controlled
 * proxy fails condition 1 outright. This report NEVER wires a measure→adjust
 * step off these two fields — no default flip, no tier change, no dispatch
 * throttle. It is read-only, always.
 *
 * Zero recorded lines with BOTH fields is the CURRENT expected state — both
 * fields are lean-init extensions with no caller wiring a real value into
 * them yet (per the roadmap's own defect list). This report says so
 * explicitly rather than presenting empty input as a green result.
 *
 * Usage:
 *   ./scripts-run src/scripts/orchestration_payload_hash_drift [--dir <path>] [--format text|json]
 *
 * Default dir: agents/runtime/state/audit (the audit-log-v1 path, matching
 * `orchestration_savings_report.ts`'s default).
 */
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { aggregatePayloadHashDrift, type PayloadHashDriftReport, type PayloadHashLine } from './_lib/payload_hash_drift.js';
import { readAuditLines } from './orchestration_savings_report.js';

const DEFAULT_DIR = 'agents/runtime/state/audit';

export interface Options {
    dir: string;
    format: 'text' | 'json';
}

export function parseArgs(argv: string[]): Options {
    const opts: Options = { dir: DEFAULT_DIR, format: 'text' };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === undefined) continue;
        if (a === '--dir') opts.dir = argv[++i] ?? opts.dir;
        else if (a.startsWith('--dir=')) opts.dir = a.slice('--dir='.length);
        else if (a === '--format') opts.format = (argv[++i] as Options['format']) ?? opts.format;
        else if (a.startsWith('--format=')) opts.format = a.slice('--format='.length) as Options['format'];
    }
    if (opts.format !== 'text' && opts.format !== 'json') opts.format = 'text';
    return opts;
}

interface RawOrchestrationHashFields {
    payload_hash?: unknown;
    cache_hit?: unknown;
}
interface RawHashLine {
    input_kind?: unknown;
    orchestration?: RawOrchestrationHashFields;
}

/** Reads only the two fields this report needs, tolerant of any pre-extension line missing them. */
function toPayloadHashLine(raw: unknown): PayloadHashLine {
    const line = (raw ?? {}) as RawHashLine;
    if (line.input_kind !== 'orchestration' || !line.orchestration) {
        return { payload_hash: null, cache_hit: null };
    }
    const hash = line.orchestration.payload_hash;
    const hit = line.orchestration.cache_hit;
    return {
        payload_hash: typeof hash === 'string' && hash.length > 0 ? hash : null,
        cache_hit: typeof hit === 'boolean' ? hit : null,
    };
}

export function buildReport(dir: string): PayloadHashDriftReport {
    const rawLines: unknown[] = readAuditLines(dir);
    const lines = rawLines.map(toPayloadHashLine);
    return aggregatePayloadHashDrift(lines);
}

function pct(v: number): string {
    return `${(v * 100).toFixed(1)}%`;
}

export function renderText(r: PayloadHashDriftReport): string {
    const out: string[] = [];
    out.push('Payload-hash × cache-hit drift report');
    out.push(`  total audit-log-v1 lines seen: ${r.total_lines}`);
    out.push(`  lines carrying BOTH payload_hash and cache_hit: ${r.lines_with_data}`);
    out.push('');

    if (r.lines_with_data === 0) {
        out.push(
            'No recorded lines carry both fields yet — this is the CURRENT expected state (both are lean-init',
        );
        out.push(
            'extensions; no caller wires a real value into them today). The reader works; there is nothing to',
        );
        out.push('report on. This is NOT presented as a green pass — it is an honest empty state.');
    } else {
        out.push(
            `stable cohort (repeat occurrences of a hash — the prior write should already be cached): n=${r.stable_cohort.n} ` +
                `hit_rate=${r.stable_cohort.hit_rate !== null ? pct(r.stable_cohort.hit_rate) : 'n/a'}`,
        );
        out.push(
            `unstable cohort (hashes seen exactly once — a payload that never repeats): n=${r.unstable_cohort.n} ` +
                `hit_rate=${r.unstable_cohort.hit_rate !== null ? pct(r.unstable_cohort.hit_rate) : 'n/a'}`,
        );
        out.push(`drift_visible (stable hit_rate > unstable hit_rate): ${r.drift_visible ? 'YES' : 'no'}`);
        out.push('');
        out.push('Per-hash breakdown (most-occurrences first):');
        for (const g of r.groups) {
            out.push(`  ${g.payload_hash}: occurrences=${g.occurrences} hit_rate=${pct(g.hit_rate)}`);
        }
    }

    out.push('');
    out.push('REFUSAL (report, never act): cache_hit is a proxy for host-controlled cache behaviour, not a');
    out.push('metric this package controls. Per ADR-118 §1, a host-controlled proxy fails the direct-measure');
    out.push('condition outright — this report never wires a measure→adjust step off these two fields.');
    return out.join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const opts = parseArgs(argv);
    const report = buildReport(opts.dir);
    if (opts.format === 'json') {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
        process.stdout.write(renderText(report) + '\n');
    }
    return 0;
}

if (process.argv[1] !== undefined) {
    const invokedUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === invokedUrl) process.exit(main());
}
