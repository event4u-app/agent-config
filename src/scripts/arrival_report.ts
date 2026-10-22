#!/usr/bin/env tsx
/**
 * Print the arrival record of each session the `InstructionsLoaded` observer
 * saw, newest first: host version, launch, status, and which user-layer rules
 * loaded at session start and after compaction.
 *
 * REPORT-ONLY. It never fails on a number — exit 0 whenever it could read, 2 on
 * usage — and is not named `check_*`, because it is an instrument, not a gate.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    arrivalsDirUnder,
    buildArrivalRecord,
    readObserverLines,
    validateArrivalRecord,
    type ArrivalRecord,
} from './_lib/arrival_record.js';
import { event4u_root } from './_lib/user_global_paths.js';

interface Args {
    readonly dir: string;
    readonly json: boolean;
    readonly limit: number;
}

export function parseArgs(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): Args | null {
    let dir = arrivalsDirUnder(path.join(event4u_root(env), 'runtime'));
    let json = false;
    let limit = 10;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--json') json = true;
        else if (a === '--dir' && argv[i + 1] !== undefined) dir = argv[++i] as string;
        else if (a === '--limit' && /^\d+$/.test(argv[i + 1] ?? '')) limit = Number(argv[++i]);
        else return null;
    }
    return { dir, json, limit };
}

/** The observer's last recorded write failure (`<date> <error code>`), or `null`. */
export function lastObserverError(dir: string): string | null {
    try {
        const text = fs.readFileSync(`${dir}.last-error`, 'utf8').trim();
        return /^[0-9T:.Z-]+ [A-Za-z0-9_]{1,32}$/.test(text) ? text : null;
    } catch {
        return null;
    }
}

/** One record per session, newest session first. */
export function recordsIn(dir: string, limit: number): ArrivalRecord[] {
    const lines = readObserverLines(dir);
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
        process.stderr.write('usage: arrival_report [--dir <arrivals dir>] [--limit <n>] [--json]\n');
        return 2;
    }
    const records = recordsIn(args.dir, args.limit);
    for (const r of records) {
        const errs = validateArrivalRecord(r);
        if (errs.length > 0) process.stderr.write(`arrival_report: ${r.session}: ${errs.join('; ')}\n`);
    }
    const lastError = lastObserverError(args.dir);
    if (lastError !== null) process.stdout.write(`observer's last write failure: ${lastError}\n`);
    if (args.json) process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
    else if (records.length === 0) process.stdout.write(`no arrival record in ${args.dir} — the observer has not seen a session\n`);
    else process.stdout.write(`${records.flatMap(renderRecord).join('\n')}\n`);
    process.stdout.write(`scanned: ${String(records.length)}\n`);
    return 0;
}

/**
 * True when this module is the process entry. Compared as resolved URLs, then
 * as real paths: a raw `file://` string misses spaces, percent-encoding and
 * symlinked paths (macOS `/var`), and a missed match exits 0 having run nothing.
 */
function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    try {
        return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href ||
            fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main());
}
