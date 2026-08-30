/**
 * collector_denominator — the capture rate's DENOMINATOR, and the spool the
 * numerator is drained from.
 *
 * `road-to-supervised-telemetry-collector` step 1.2 item 1, restated as a
 * constraint on this module: *"the denominator must be produced by a writer
 * that cannot fail in the same way the numerator does; a collector counting its
 * own opportunities is the failure `road-to-journal-host-capture-measurement`
 * exists for."* This is that independent writer, and it also discharges the
 * received item merged into Phase 4 by the AI council on 2026-08-29 — a
 * per-event dispatch counter with no payload and no free-form field, written on
 * hook invocation only.
 *
 * ## Why two writers and not one
 *
 * A collector that counts both halves cannot report its own death. If the
 * daemon is not running, a self-counting instrument records zero opportunities
 * and zero captures, and 0/0 reads as "nothing happened" rather than as "the
 * observer was down". Here the *hook process* writes the denominator
 * synchronously, in-process, with no daemon involved — so a dead collector
 * produces a denominator that keeps climbing and a numerator that does not, and
 * the ratio falls, which is the true statement.
 *
 * The two writers therefore fail differently ON PURPOSE. The denominator fails
 * only if the hook itself does not run; the numerator fails if the daemon is
 * absent, wedged, budget-stopped, opted out, or refusing invalid records.
 *
 * ## Never throws, and that is a contract rather than defensive habit
 *
 * `docs/contracts/resident-process-floors.md` § 1 permits observation only, and
 * § 2 Q2 requires that a dispatch the collector cannot serve is DEGRADED, never
 * blocked. A denominator write that can raise would make the observer able to
 * fail a dispatch — which is precisely the falsifiable form § 1 states: *if the
 * module were killed, every dispatch would resolve identically*. Every export
 * here returns a boolean instead of raising, and the boolean is for tests and
 * for the daemon's own diagnostics, never for the dispatch path.
 *
 * ## What is written
 *
 * One tab-separated line per opportunity: UTC **date**, event, platform. No
 * payload, no free-form field, no path, no identifier — the same
 * exclusion-by-construction `collector_record` argues for, applied to a file
 * whose format cannot express anything else. A date rather than a timestamp,
 * for the fingerprinting reason `collector_record.FIELD_PURPOSE` states about
 * `occurred_on`.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
    COLLECTOR_EVENTS,
    COLLECTOR_PLATFORMS,
    type CollectorEvent,
    type CollectorPlatform,
} from './collector_record.js';
import { isOptedOut, resolveCollectorStore } from './collector_store.js';

/** Append-only opportunity log. One short line per dispatch. */
export const DENOMINATOR_FILE_NAME = 'opportunities.log';
/** Where hook processes hand records to the daemon. */
export const SPOOL_DIR_NAME = 'spool';
/** The file hook processes append to. Renamed away by the daemon to drain it. */
export const SPOOL_PENDING_NAME = 'pending.jsonl';

/**
 * Opt-IN marker. **Absent means off**, which is what "default-off" has to mean
 * to be a property rather than a hope: a fresh install has no marker, so there
 * is no configuration state in which the collector starts by accident.
 */
export const ENABLED_MARKER_NAME = 'ENABLED';

export function denominatorPath(userRoot?: string): string {
    return path.join(resolveCollectorStore(userRoot).root, DENOMINATOR_FILE_NAME);
}

export function spoolDir(userRoot?: string): string {
    return path.join(resolveCollectorStore(userRoot).root, SPOOL_DIR_NAME);
}

export function spoolPendingPath(userRoot?: string): string {
    return path.join(spoolDir(userRoot), SPOOL_PENDING_NAME);
}

export function enabledMarkerPath(userRoot?: string): string {
    return path.join(resolveCollectorStore(userRoot).root, ENABLED_MARKER_NAME);
}

/**
 * Default-off, expressed as the absence of a file.
 *
 * Opt-out still wins over opt-in: a user who has opted out and then somehow
 * acquires an ENABLED marker is opted out. The order matters because the two
 * markers answer different questions — "may this machine capture at all" and
 * "has this user asked for the collector" — and the privacy answer outranks.
 */
export function isCollectorEnabled(userRoot?: string): boolean {
    if (isOptedOut(userRoot)) return false;
    return fs.existsSync(enabledMarkerPath(userRoot));
}

/** Create the opt-in marker. Idempotent. */
export function enableCollector(userRoot?: string): void {
    const target = enabledMarkerPath(userRoot);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
        target,
        'The collector is enabled for this user. Delete this file to return to default-off.\n',
    );
}

/** Remove the opt-in marker. Idempotent. */
export function disableCollector(userRoot?: string): void {
    fs.rmSync(enabledMarkerPath(userRoot), { force: true });
}

/** The UTC date, `YYYY-MM-DD`. Never a time. */
export function utcDate(at: number = Date.now()): string {
    return new Date(at).toISOString().slice(0, 10);
}

/**
 * Record one dispatch opportunity. Returns whether the line landed.
 *
 * The append is a single `appendFileSync` of a line well under `PIPE_BUF`, so
 * concurrent hook processes interleave whole lines rather than fragments. That
 * is the reason the format is one flat line and not a structure that would need
 * a lock.
 *
 * **Gated on the opt-in MARKER, never on the daemon.** That distinction is the
 * whole independence argument and it is easy to lose: the marker is a file the
 * user created, the daemon is a process that may be absent, wedged,
 * budget-stopped or dead. Counting while the marker exists means a dead daemon
 * produces a climbing denominator and a flat numerator — the capture rate falls
 * and says so. Counting while the DAEMON is up would make the instrument
 * self-reporting and 0/0-blind, which is the failure this module exists for.
 *
 * Gating on the marker at all is a cost decision, and it is the reason a
 * default-off install writes nothing on any hook invocation: one `stat` and a
 * return. An earlier draft wrote unconditionally so that the ratio would exist
 * for users who never opted in — which is a measurement nobody consented to,
 * paid for by every dispatch on every machine.
 */
export function recordOpportunity(
    event: CollectorEvent | string,
    platform: CollectorPlatform | string,
    userRoot?: string,
    at: number = Date.now(),
): boolean {
    try {
        if (!isCollectorEnabled(userRoot)) return false;
        if (!(COLLECTOR_EVENTS as readonly string[]).includes(event)) return false;
        if (!(COLLECTOR_PLATFORMS as readonly string[]).includes(platform)) return false;
        const target = denominatorPath(userRoot);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.appendFileSync(target, `${utcDate(at)}\t${event}\t${platform}\n`);
        return true;
    } catch {
        // Observation-only: a failed observation is never a failed dispatch.
        return false;
    }
}

export interface DenominatorReading {
    readonly total: number;
    readonly byEvent: Readonly<Record<string, number>>;
    /** Lines the parser refused. A silent skip would understate the denominator. */
    readonly malformed: number;
}

/** Read the opportunity log. Absent file reads as zero, not as an error. */
export function readOpportunities(userRoot?: string): DenominatorReading {
    let raw = '';
    try {
        raw = fs.readFileSync(denominatorPath(userRoot), 'utf8');
    } catch {
        return Object.freeze({ total: 0, byEvent: Object.freeze({}), malformed: 0 });
    }
    const byEvent: Record<string, number> = {};
    let total = 0;
    let malformed = 0;
    for (const line of raw.split('\n')) {
        if (line.length === 0) continue;
        const parts = line.split('\t');
        if (parts.length !== 3 || !(COLLECTOR_EVENTS as readonly string[]).includes(parts[1] ?? '')) {
            malformed += 1;
            continue;
        }
        const event = parts[1] as string;
        byEvent[event] = (byEvent[event] ?? 0) + 1;
        total += 1;
    }
    return Object.freeze({ total, byEvent: Object.freeze(byEvent), malformed });
}

/**
 * Hand a record to the daemon. Returns whether it was spooled.
 *
 * The hook does NOT write to the SQLite store. Short-lived processes opening a
 * database on every dispatch is the write contention and the version-skew risk
 * the daemon exists to remove, and it would put a `node:sqlite` dependency on
 * the dispatch path — which the observation-only contract's "resolve
 * identically" clause cannot survive on a runtime without it.
 *
 * Refuses when the collector is off, so a disabled collector accumulates no
 * spool to drain later. That is deliberate: a spool that survives the disabled
 * period would make a re-enable look like a capture spike.
 */
export function spoolRecord(record: unknown, userRoot?: string): boolean {
    try {
        if (!isCollectorEnabled(userRoot)) return false;
        const target = spoolPendingPath(userRoot);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.appendFileSync(target, `${JSON.stringify(record)}\n`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Atomically claim the pending spool for draining, returning the claimed path
 * or null when there is nothing to drain.
 *
 * The rename is what makes concurrent appends safe: writers that already have
 * the old inode finish into the claimed file, and every writer that opens after
 * the rename creates a fresh `pending.jsonl`. No lock, no lost line.
 */
export function claimSpool(userRoot?: string, at: number = Date.now()): string | null {
    const pending = spoolPendingPath(userRoot);
    if (!fs.existsSync(pending)) return null;
    const claimed = path.join(spoolDir(userRoot), `draining-${at}-${process.pid}.jsonl`);
    try {
        fs.renameSync(pending, claimed);
        return claimed;
    } catch {
        return null;
    }
}

/** Parse a claimed spool file into records. Unparseable lines are reported, never dropped silently. */
export function readClaimedSpool(claimed: string): { records: unknown[]; malformed: number } {
    let raw = '';
    try {
        raw = fs.readFileSync(claimed, 'utf8');
    } catch {
        return { records: [], malformed: 0 };
    }
    const records: unknown[] = [];
    let malformed = 0;
    for (const line of raw.split('\n')) {
        if (line.length === 0) continue;
        try {
            records.push(JSON.parse(line));
        } catch {
            malformed += 1;
        }
    }
    return { records, malformed };
}
