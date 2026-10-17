/**
 * The retro queue and its calendar (`docs/contracts/retro-v1.md`).
 *
 * One file per unit in the git common directory, so every worktree of a
 * repository sees one queue and a unit enqueued from two of them is one unit.
 * Writes are temp-file-then-hard-link, and an existing entry is never rewritten:
 * the first enqueue's timestamp is the discovery time a later measurement reads.
 *
 * Days are local calendar days in an IANA zone, and all arithmetic is on the
 * calendar date, never on elapsed hours — a 23- or 25-hour day at a DST switch
 * is still exactly one day, so a switch can neither drop a day from a sweep nor
 * sweep one twice.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { git_common_dir } from './_lib/git_common_dir.js';

/** Catch-up window in local days; stays below the 7-day session-state TTL. */
export const CATCH_UP_WINDOW_DAYS = 5;

export const QUEUE_DIRNAME = path.join('agent-config', 'retro-queue');

export interface QueueEntry {
    unit_key: string;
    kind: 'pr' | 'session';
    pr?: number;
    session?: string;
}

export interface StoredEntry extends QueueEntry {
    enqueued_at: string;
}

export function queueDir(workspaceRoot: string): string | null {
    const common = git_common_dir(workspaceRoot);
    return common === null ? null : path.join(common, QUEUE_DIRNAME);
}

function entryFile(dir: string, unitKey: string): string {
    return path.join(dir, `${createHash('sha256').update(unitKey).digest('hex').slice(0, 32)}.json`);
}

export type EnqueueResult = 'enqueued' | 'exists' | 'no-queue';

export function enqueue(workspaceRoot: string, entry: QueueEntry, nowIso: string): EnqueueResult {
    const dir = queueDir(workspaceRoot);
    if (dir === null) return 'no-queue';
    fs.mkdirSync(dir, { recursive: true });
    const file = entryFile(dir, entry.unit_key);
    if (fs.existsSync(file)) return 'exists';
    const stored: StoredEntry = { ...entry, enqueued_at: nowIso };
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(stored)}\n`, { flag: 'wx' });
    try {
        fs.linkSync(tmp, file);
        return 'enqueued';
    } catch (err) {
        // A concurrent enqueue of the same unit won; theirs stands. Any other
        // failure would lose the unit, so it is not reported as `exists`.
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') return 'exists';
        throw err;
    } finally {
        fs.rmSync(tmp, { force: true });
    }
}

export function listQueue(workspaceRoot: string): StoredEntry[] {
    const dir = queueDir(workspaceRoot);
    if (dir === null) return [];
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out: StoredEntry[] = [];
    for (const n of names.sort()) {
        if (!n.endsWith('.json')) continue;
        try {
            const v = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf-8')) as Partial<StoredEntry>;
            if (typeof v.unit_key === 'string' && (v.kind === 'pr' || v.kind === 'session')) {
                out.push(v as StoredEntry);
            }
        } catch {
            continue;
        }
    }
    return out;
}

/** The local calendar day (`YYYY-MM-DD`) of an instant in an IANA zone. */
export function localDay(iso: string, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(iso));
    const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
}

const DAY_MS = 86_400_000;
function dayNumber(day: string): number {
    const ms = /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(`${day}T00:00:00Z`) : NaN;
    if (!Number.isFinite(ms)) throw new Error(`retro_queue: not a calendar day: ${day}`);
    return Math.round(ms / DAY_MS);
}
const dayString = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);

/**
 * The finished local days a sweep on `today` examines: from the high-water mark
 * (first day not yet swept, inclusive) up to yesterday, clipped to the window.
 */
export function sweepDays(highWater: string, today: string): string[] {
    const end = dayNumber(today);
    const start = Math.max(dayNumber(highWater), end - CATCH_UP_WINDOW_DAYS);
    const out: string[] = [];
    for (let d = start; d < end; d++) out.push(dayString(d));
    return out;
}

export type WindowClass = 'in-window' | 'covered' | 'expired';

export interface UnitDay {
    /** Local day the unit finished. */
    day: string;
    today: string;
    /** The session's PR already has a retro. */
    covered: boolean;
    /** The session was itself a retro (K5). */
    retroSession: boolean;
}

export function classifyUnit(u: UnitDay): WindowClass {
    if (u.covered || u.retroSession) return 'covered';
    return dayNumber(u.today) - dayNumber(u.day) > CATCH_UP_WINDOW_DAYS ? 'expired' : 'in-window';
}
