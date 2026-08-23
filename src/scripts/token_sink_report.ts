#!/usr/bin/env node
/**
 * Token-sink ranking + re-read measurement over the local transcript store.
 *
 * `road-to-role-scoped-spawn-profiles` Phase 3 Steps 1-3. Phase 3 is declared
 * independent of that roadmap's Phases 0-2 in both directions: it needs no
 * payload capture and it arms nothing.
 *
 * **The denominator is published, deliberately.** Step 2's whole content is
 * that *"a sink's share is only meaningful against the total it was measured
 * from, and the store is one machine's history — the report says so rather
 * than reading as a property of the package."* Every rendered figure is
 * therefore accompanied by the record count, the date range, and the
 * single-store caveat, and {@link Report.provenance} carries that sentence as
 * data so a JSON consumer cannot strip it by taking the numbers only.
 *
 * **Two things this report is NOT.** It is not a cost figure — the weighting
 * is the cost-SHAPED `weightedInputUnits` from `_lib/cc_transcript.ts`, not a
 * price. And the wasted-token column is a `chars / 4` proxy over duplicate
 * `tool_result` bodies (see `_lib/transcript_reads.ts`), because the
 * transcript records no per-tool-result token count; it is named
 * `wasted_tokens_proxy` everywhere so the label travels with the number.
 *
 * Class A: in-process, per-invocation, read-only, no network, no daemon, no
 * writes outside stdout.
 *
 * Usage:
 *   ./scripts-run src/scripts/token_sink_report [--format text|json]
 *     [--root <path>] [--max-age-days <n>] [--top <n>]
 */
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    DEFAULT_PROJECTS_ROOT,
    billableInputTokens,
    listTranscriptFiles,
    scanTranscripts,
    weightedInputUnits,
    type TranscriptRecord,
} from './_lib/cc_transcript.js';
import { computeRereads, type RereadResult } from './_lib/transcript_reads.js';

/**
 * One token sink: a `bucket/model` pair. The bucket half is what makes the
 * ranking answer the question the roadmap asks — `main` versus `subagent` is
 * the axis a scoping decision acts on — and the model half keeps a cheap
 * worker's traffic from being summed with an expensive orchestrator's.
 */
export interface Sink {
    sink: string;
    bucket: string;
    model: string;
    calls: number;
    billable_input: number;
    weighted_input_units: number;
    /** This sink's share of total weighted input units, 0..1. */
    weighted_share: number;
}

export function rankSinks(records: readonly TranscriptRecord[]): Sink[] {
    const acc = new Map<string, Sink>();
    for (const r of records) {
        const key = `${r.bucket}/${r.model}`;
        const row = acc.get(key) ?? {
            sink: key,
            bucket: r.bucket,
            model: r.model,
            calls: 0,
            billable_input: 0,
            weighted_input_units: 0,
            weighted_share: 0,
        };
        row.calls += 1;
        row.billable_input += billableInputTokens(r.usage);
        row.weighted_input_units += weightedInputUnits(r.usage);
        acc.set(key, row);
    }
    const rows = [...acc.values()];
    const total = rows.reduce((s, r) => s + r.weighted_input_units, 0);
    for (const r of rows) {
        r.weighted_share = total > 0 ? r.weighted_input_units / total : 0;
    }
    rows.sort((a, b) => b.weighted_input_units - a.weighted_input_units || a.sink.localeCompare(b.sink));
    return rows;
}

export interface Options {
    format: 'text' | 'json';
    root: string;
    maxAgeDays: number;
    top: number;
}

const DEFAULT_TOP = 15;

export function parseArgs(argv: string[]): Options {
    const opts: Options = {
        format: 'text',
        root: DEFAULT_PROJECTS_ROOT,
        maxAgeDays: 90,
        top: DEFAULT_TOP,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === undefined) continue;
        if (a === '--format') opts.format = (argv[++i] as Options['format']) ?? opts.format;
        else if (a.startsWith('--format=')) opts.format = a.slice('--format='.length) as Options['format'];
        else if (a === '--root') opts.root = argv[++i] ?? opts.root;
        else if (a.startsWith('--root=')) opts.root = a.slice('--root='.length);
        else if (a === '--max-age-days') opts.maxAgeDays = Number(argv[++i]) || opts.maxAgeDays;
        else if (a.startsWith('--max-age-days=')) opts.maxAgeDays = Number(a.slice('--max-age-days='.length)) || opts.maxAgeDays;
        else if (a === '--top') opts.top = Number(argv[++i]) || opts.top;
        else if (a.startsWith('--top=')) opts.top = Number(a.slice('--top='.length)) || opts.top;
    }
    if (opts.format !== 'text' && opts.format !== 'json') opts.format = 'text';
    return opts;
}

/**
 * The single-store caveat, carried as DATA rather than as rendering. A JSON
 * consumer that keeps `sinks` and drops the prose still keeps this field.
 */
export const PROVENANCE =
    'Local-store-derived: computed from one machine\'s ~/.claude/projects transcripts. ' +
    'Every share below is a fact about this store, not a property of the package.';

export interface Report {
    schema: 'token-sink-report/v1';
    root: string;
    window_days: number;
    provenance: string;
    total_seen: number;
    deduped_count: number;
    dedup_ratio: number;
    legs_scanned: number;
    date_range: { first: string | null; last: string | null };
    sinks: Sink[];
    rereads: RereadResult;
    wasted_tokens_proxy_note: string;
}

const PROXY_NOTE =
    'wasted_tokens_proxy is a chars / 4 estimate over duplicate tool_result bodies. ' +
    'The transcript records no per-tool-result token count, so this is a proxy, never a measurement.';

export function buildReport(opts: Options): Report {
    const scan = scanTranscripts({ root: opts.root, maxAgeDays: opts.maxAgeDays });
    const files = listTranscriptFiles({ root: opts.root, maxAgeDays: opts.maxAgeDays });
    const rereads = computeRereads(files);

    const stamps = scan.records
        .map((r) => r.timestamp)
        .filter((t): t is string => typeof t === 'string' && t.length > 0)
        .sort();

    return {
        schema: 'token-sink-report/v1',
        root: opts.root,
        window_days: opts.maxAgeDays,
        provenance: PROVENANCE,
        total_seen: scan.totalSeen,
        deduped_count: scan.dedupedCount,
        dedup_ratio: scan.dedup_ratio,
        legs_scanned: rereads.legs_scanned,
        date_range: { first: stamps[0] ?? null, last: stamps[stamps.length - 1] ?? null },
        sinks: rankSinks(scan.records),
        rereads,
        wasted_tokens_proxy_note: PROXY_NOTE,
    };
}

function pct(v: number): string {
    return `${(v * 100).toFixed(1)}%`;
}

export function renderText(r: Report, top: number = DEFAULT_TOP): string {
    const out: string[] = [];
    out.push('token-sink report · schema token-sink-report/v1');
    out.push('');
    out.push('Denominator (read this before any share below):');
    out.push(`  records (deduped) : ${r.deduped_count} of ${r.total_seen} seen (dedup ${pct(r.dedup_ratio)})`);
    out.push(`  transcript legs   : ${r.legs_scanned}`);
    out.push(`  date range        : ${r.date_range.first ?? 'n/a'} .. ${r.date_range.last ?? 'n/a'}`);
    out.push(`  window            : ${r.window_days} days · root ${r.root}`);
    out.push(`  provenance        : ${r.provenance}`);
    out.push('');

    if (r.deduped_count === 0) {
        out.push('No records in this store for the given window — nothing to rank.');
        out.push('');
    } else {
        out.push(`Token sinks, ranked by weighted input units (top ${top}):`);
        for (const s of r.sinks.slice(0, top)) {
            out.push(
                `  ${s.sink.padEnd(38)} calls=${String(s.calls).padStart(6)} ` +
                    `weighted=${s.weighted_input_units.toFixed(0).padStart(12)} share=${pct(s.weighted_share)}`,
            );
        }
        out.push('');
    }

    out.push('Re-reads within a single transcript leg:');
    out.push(`  reads observed    : ${r.rereads.total_reads}`);
    out.push(`  duplicate reads   : ${r.rereads.duplicate_reads}`);
    out.push(`  wasted (proxy)    : ${r.rereads.wasted_tokens_proxy} tokens`);
    out.push(`  note              : ${r.wasted_tokens_proxy_note}`);
    if (r.rereads.files.length === 0) {
        out.push('  no file was read twice inside one leg in this window.');
    } else {
        out.push(`  top ${top} by wasted (proxy):`);
        for (const f of r.rereads.files.slice(0, top)) {
            out.push(
                `    ${f.file_path}\n      reads=${f.total_reads} dup=${f.duplicate_reads} ` +
                    `legs_with_reread=${f.legs_with_reread} wasted_proxy=${f.wasted_tokens_proxy}`,
            );
        }
    }
    return out.join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const opts = parseArgs(argv);
    const report = buildReport(opts);
    if (opts.format === 'json') {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
        process.stdout.write(renderText(report, opts.top) + '\n');
    }
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && process.argv[1] !== undefined) {
    const invokedUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (pathToFileURL(_HERE).href === invokedUrl) process.exit(main());
}
