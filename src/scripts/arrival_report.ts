#!/usr/bin/env tsx
/**
 * Print the arrival record of each session the `InstructionsLoaded` observer
 * saw, newest first: host version, launch, status, and which user-layer rules
 * loaded at session start and after compaction.
 *
 * REPORT-ONLY. It never fails on a number — exit 0 whenever it could read, 2 on
 * usage — and is not named `check_*`, because it is an instrument, not a gate.
 */
import * as path from 'node:path';
import process from 'node:process';

import { buildArrivalRecord, readObserverLines, validateArrivalRecord, type ArrivalRecord } from './_lib/arrival_record.js';
import { event4u_root } from './_lib/user_global_paths.js';

interface Args {
    readonly file: string;
    readonly json: boolean;
    readonly limit: number;
}

export function parseArgs(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): Args | null {
    let file = path.join(event4u_root(env), 'runtime', 'arrivals.jsonl');
    let json = false;
    let limit = 10;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--json') json = true;
        else if (a === '--file' && argv[i + 1] !== undefined) file = argv[++i] as string;
        else if (a === '--limit' && /^\d+$/.test(argv[i + 1] ?? '')) limit = Number(argv[++i]);
        else return null;
    }
    return { file, json, limit };
}

/** One record per session, newest session first. */
export function recordsIn(file: string, limit: number): ArrivalRecord[] {
    const lines = readObserverLines(file);
    const lastTs = new Map<string, string>();
    for (const l of lines) {
        if (l.session !== null && (lastTs.get(l.session) ?? '') <= l.ts) lastTs.set(l.session, l.ts);
    }
    return [...lastTs.entries()]
        .sort((a, b) => (a[1] < b[1] ? 1 : -1))
        .slice(0, limit)
        .map(([session]) => buildArrivalRecord(lines, session));
}

export function renderRecord(r: ArrivalRecord): string[] {
    const rules = (reason: string) =>
        r.files.filter((f) => f.kind === 'rule' && f.scope === 'user' && f.reason === reason).length;
    return [
        `session ${r.session} · host version ${r.host_version ?? 'unknown'} · launch ${r.launch ?? 'unknown'}`,
        `  status: ${r.status}${r.unknown_reason ? ` (${r.unknown_reason})` : ''} · dispatcher reached: ${String(r.dispatcher_reached)}`,
        `  user-layer rules loaded at start: ${String(rules('session_start'))} · after compaction: ${String(rules('compact'))}`,
        `  lines: ${String(r.counts.loaded)} loaded, ${String(r.counts.unknown)} unknown, ${String(r.counts.duplicates)} duplicate`,
    ];
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parseArgs(argv);
    if (args === null) {
        process.stderr.write('usage: arrival_report [--file <arrivals.jsonl>] [--limit <n>] [--json]\n');
        return 2;
    }
    const records = recordsIn(args.file, args.limit);
    for (const r of records) {
        const errs = validateArrivalRecord(r);
        if (errs.length > 0) process.stderr.write(`arrival_report: ${r.session}: ${errs.join('; ')}\n`);
    }
    if (args.json) process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
    else if (records.length === 0) process.stdout.write(`no arrival record in ${args.file} — the observer has not seen a session\n`);
    else process.stdout.write(`${records.flatMap(renderRecord).join('\n')}\n`);
    process.stdout.write(`scanned: ${String(records.length)}\n`);
    return 0;
}

const _entry = process.argv[1];
if (_entry !== undefined && path.resolve(_entry) === path.resolve(new URL(import.meta.url).pathname)) {
    process.exit(main());
}
