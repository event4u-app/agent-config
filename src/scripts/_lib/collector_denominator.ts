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
 * ## What that property does NOT survive: a restart
 *
 * R2 round-4 finding 6, and the correction is to the CLAIM rather than to the
 * code. Captures are spooled to disk while the daemon is down, and the next
 * start replays the whole spool with each record's ORIGINAL `occurred_on` — so
 * the historical rate is repaired retroactively and the outage becomes
 * invisible in the very window the design says would expose it. The two writers
 * fail differently *while the daemon stays down*, not across a restart.
 *
 * That is the right behaviour and the wrong sentence. Dropping the spool on
 * restart would lose real captures to make a graph honest; re-dating them to
 * the drain would move a dispatch that happened on Tuesday into Thursday's
 * denominator. The spool is bounded ({@link SPOOL_MAX_BYTES}) so an unbounded
 * outage still loses records rather than replaying forever, and the reading a
 * human takes from a repaired window is the one this paragraph exists to
 * qualify: a rate that recovered may mean capture recovered, or may mean a
 * daemon came back and flushed. `heartbeat.json`'s three-valued liveness is
 * what distinguishes them, and it is why that file is a state rather than a
 * boolean.
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

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
    COLLECTOR_EVENTS,
    COLLECTOR_PLATFORMS,
    COLLECTOR_SCHEMA_VERSION,
    type CollectorEvent,
    type CollectorPlatform,
} from './collector_record.js';
import { isOptedOut, resolveCollectorStore, RETENTION_DAYS } from './collector_store.js';

/**
 * The collector's own version, recorded on every captured record.
 *
 * A literal rather than a read of `package.json`: the record contract calls this
 * the version of the COLLECTOR, and tying it to the package version would make
 * every release look like a collector change to anyone diffing the store.
 */
export const COLLECTOR_VERSION = '1.0.0';

/** Monotonic per-process counters, declared above their first use — the same
 * rule `UUID_RE` was moved for, applied to the other binding added in the same
 * change (R2 round-5 finding 11). */
let pruneSequence = 0;

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
    // The KILL SWITCH stops collection, not merely the daemon (R2 round-5
    // finding 1). Nothing on the dispatch path read it: with `STOP` in place the
    // hook kept appending opportunities and kept spooling captures, and
    // `drainOnce` replays that spool with each record's original `occurred_on`
    // — so the window an operator believed was stopped was captured
    // retroactively the moment the switch came off. That contradicted two
    // shipped statements outright: the operator page's "Nothing is captured"
    // and `DISPATCH_MODE_CONTRACT`'s "not a second, quieter writer".
    //
    // It belongs HERE rather than at the call site for the reason the
    // self-observation exclusion moved here: a guard in the caller's control
    // flow is one an alias or a refactor can remove without the module noticing.
    if (fs.existsSync(killSwitchPathLocal(userRoot))) return false;
    return fs.existsSync(enabledMarkerPath(userRoot));
}

/**
 * The kill-switch marker path.
 *
 * Duplicated from `collector_supervision.killSwitchPath` rather than imported,
 * and the reason is the one thing this module may not do: importing that module
 * would make `collector_denominator` — which the dispatch path loads on EVERY
 * hook invocation — pull in the supervision surface, its heartbeat handling and
 * its process signalling. The literal is one filename, the two are pinned equal
 * by `tests/scripts/collector_self_observation.test.ts`, and a shared constants
 * module for a single string is a third file to keep in sync.
 */
function killSwitchPathLocal(userRoot?: string): string {
    return path.join(resolveCollectorStore(userRoot).root, 'STOP');
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

/**
 * The one option both writers take.
 *
 * `includeSelfObserved` is a TEST SEAM and is named as one. The exclusion sits
 * inside the writers rather than at the call site, because putting it in the
 * dispatcher's control flow made both `check_static_parity` runs skip the calls
 * entirely and the comparison vacuous (R2 round-4 finding 3). But the same
 * placement means a test — which always runs under `VITEST` — cannot exercise
 * the write path at all without saying so explicitly. Nothing in `src/` passes
 * it, and `tests/scripts/collector_vocabulary_parity.test.ts` asserts the
 * default still excludes.
 */
export interface WriterOptions {
    readonly includeSelfObserved?: boolean;
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
 * default-off install writes nothing on any hook invocation: **two `existsSync`
 * calls and a return per writer, so FOUR per dispatch once both are wired** — the opt-out probe first, then the ENABLED marker, in
 * that order because the privacy answer outranks. (The first draft of this
 * paragraph said "one `stat`", counting only the marker and forgetting the
 * opt-out check immediately above it — R2 finding 14.) An earlier draft wrote
 * unconditionally so that the ratio would exist for users who never opted in —
 * which is a measurement nobody consented to, paid for by every dispatch on
 * every machine.
 */
export function recordOpportunity(
    event: CollectorEvent | string,
    platform: CollectorPlatform | string,
    userRoot?: string,
    at: number = Date.now(),
    opts: WriterOptions = {},
): boolean {
    try {
        if (opts.includeSelfObserved !== true && isSelfObservation()) return false;
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
    /** Earliest and latest UTC date seen, or null on an empty read. */
    readonly firstDate: string | null;
    readonly lastDate: string | null;
}

export interface ReadWindow {
    /** Inclusive lower bound, `YYYY-MM-DD`. Lines before it are not counted. */
    readonly since?: string;
    /** Inclusive upper bound, `YYYY-MM-DD`. */
    readonly until?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Read the opportunity log. Absent file reads as zero, not as an error.
 *
 * **The window is a parameter now, and its absence was a real defect** (R2
 * round-2 finding 5). Every line carries a UTC date and this function never
 * parsed it, returning a LIFETIME total — while the numerator side is pruned to
 * {@link RETENTION_DAYS} on every daemon iteration. The two halves of the ratio
 * were therefore computed over different time bases, and once the store began
 * pruning, the measured capture rate would have fallen monotonically toward
 * zero regardless of real capture. That is precisely the failure the two-writer
 * design exists to make impossible, arriving through the back door.
 *
 * A date that does not parse is `malformed`, not silently skipped: an
 * understated denominator biases the rate UPWARD.
 */
export function readOpportunities(userRoot?: string, window: ReadWindow = {}): DenominatorReading {
    let raw = '';
    try {
        raw = fs.readFileSync(denominatorPath(userRoot), 'utf8');
    } catch {
        return Object.freeze({
            total: 0,
            byEvent: Object.freeze({}),
            malformed: 0,
            firstDate: null,
            lastDate: null,
        });
    }
    const byEvent: Record<string, number> = {};
    let total = 0;
    let malformed = 0;
    let firstDate: string | null = null;
    let lastDate: string | null = null;
    for (const line of raw.split('\n')) {
        if (line.length === 0) continue;
        const parts = line.split('\t');
        if (parts.length !== 3 || !(COLLECTOR_EVENTS as readonly string[]).includes(parts[1] ?? '')) {
            malformed += 1;
            continue;
        }
        const date = parts[0] as string;
        if (!DATE_RE.test(date)) {
            malformed += 1;
            continue;
        }
        if (window.since !== undefined && date < window.since) continue;
        if (window.until !== undefined && date > window.until) continue;
        const event = parts[1] as string;
        byEvent[event] = (byEvent[event] ?? 0) + 1;
        total += 1;
        if (firstDate === null || date < firstDate) firstDate = date;
        if (lastDate === null || date > lastDate) lastDate = date;
    }
    return Object.freeze({
        total,
        byEvent: Object.freeze(byEvent),
        malformed,
        firstDate,
        lastDate,
    });
}

/**
 * Drop opportunity lines older than the retention horizon, rewriting the log.
 *
 * The denominator's half of what `pruneOlderThan` does for the store, and it
 * exists for two reasons that are easy to conflate. The ratio one: both sides
 * must age out on the same clock or the rate drifts by construction. The
 * resource one: nothing bounded this file, and it lives inside the directory
 * `RESOURCE_BUDGETS.disk_bytes` puts a ceiling on — a ceiling whose breach
 * STOPS the collector. An unbounded log in a budgeted directory is a slow
 * self-shutdown.
 *
 * Whole-file rewrite through a temp and a rename, so a crash mid-prune leaves
 * either the old file or the new one and never a truncated log. Returns how
 * many lines were dropped.
 */
export function pruneOpportunitiesOlderThan(
    userRoot: string | undefined,
    today: string,
    days: number = RETENTION_DAYS,
): number {
    const target = denominatorPath(userRoot);
    // The on-disk size BEFORE the read, not after the filter (R2 round-5
    // finding 2). Taking it afterwards made the lost-append window the WHOLE
    // filter — a line appended between the read and the `statSync` was inside
    // `consumed` (so excluded from the carried tail) and absent from `raw` (so
    // excluded from the kept set), i.e. silently dropped — while the comment
    // beneath claimed the window was microseconds. The direction is the
    // dangerous one: an understated denominator biases the rate UPWARD.
    let consumed = 0;
    let raw = '';
    try {
        consumed = fs.statSync(target).size;
        raw = fs.readFileSync(target, 'utf8');
    } catch {
        return 0;
    }
    const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000)
        .toISOString()
        .slice(0, 10);
    const lines = raw.split('\n').filter((l) => l.length > 0);
    const kept = lines.filter((l) => {
        const date = l.split('\t')[0] ?? '';
        // A line whose date does not parse is KEPT: it is already counted as
        // malformed by the reader, and deleting what you cannot classify is how
        // a prune quietly becomes a truncation.
        if (!DATE_RE.test(date)) return true;
        return date >= cutoff;
    });
    if (kept.length === lines.length) return 0;

    // CARRY THE TAIL (R2 round-3 finding 5). Hook processes append to this file
    // from other processes while the prune runs, and a plain read-filter-rename
    // drops everything written into the old inode inside that window. The
    // direction is the dangerous one and this module states it three functions
    // earlier: an understated denominator biases the rate UPWARD, toward making
    // the target look met.
    //
    // So: remember how many bytes we read, and before the rename, append
    // whatever arrived after that offset. A line that lands between the tail
    // read and the rename is still lost — the window is now microseconds rather
    // than the whole filter, and closing it completely needs a lock the
    // append path deliberately does not take.
    // `consumed` is the on-disk size taken BEFORE the read (see above): the
    // stat, not `Buffer.byteLength(raw)`, because that re-encode round-trips
    // through U+FFFD for any invalid byte and misaligns the carried tail
    // (R2 round-4 finding 7).
    let tail = '';
    try {
        const fd = fs.openSync(target, 'r');
        try {
            const size = fs.fstatSync(fd).size;
            if (size > consumed) {
                const buf = Buffer.alloc(size - consumed);
                fs.readSync(fd, buf, 0, buf.length, consumed);
                tail = buf.toString('utf8');
            }
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        /* the file vanished; the rename below re-creates it from `kept` */
    }

    // A unique temp name, for the reason `claimSpool` was given a counter: the
    // function is exported and driven directly by tests, and two concurrent
    // prunes sharing one staging path clobber each other.
    pruneSequence += 1;
    const tmp = `${target}.${String(process.pid)}.${String(pruneSequence)}.tmp`;
    const body = kept.length === 0 ? '' : `${kept.join('\n')}\n`;
    fs.writeFileSync(tmp, `${body}${tail}`);
    fs.renameSync(tmp, target);
    return lines.length - kept.length;
}

/**
 * Is this dispatch the package observing ITSELF?
 *
 * Metric definition item 3 excludes *"dispatches in the package's own test
 * suite and CI (self-observation)"*, and nothing implemented it (R2 round-3
 * finding 3): on an opted-in developer machine every dispatcher test that
 * reached `main` appended to the real `~/.event4u/agent-config` opportunity
 * log. Those dispatches spool no capture, so they biased the measured rate
 * DOWN.
 *
 * Three signals, all set by the RUNNER rather than by this package, so none can
 * be spoofed by the thing being measured: vitest exports `VITEST`, every CI
 * provider exports `CI`, and `NODE_ENV=test` is the conventional third. A
 * consumer's own CI is excluded too, and that is correct — a dispatch from a
 * pipeline is not a dispatch from a session, and the metric is about sessions.
 *
 * It lives here rather than in the dispatcher because it is a statement about
 * the METRIC, not about hook dispatch; the dispatcher merely asks.
 */
export function isSelfObservation(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.VITEST !== undefined || env.CI !== undefined || env.NODE_ENV === 'test';
}

/** Where the stable per-machine id lives. Generated once, never derived from a host fact. */
export const MACHINE_ID_NAME = 'machine-id';
/** Where the per-episode sequence counter lives, keyed by episode. */
export const EPISODE_DIR_NAME = 'episodes';

/** Declared ABOVE its first use: `machineId` reads it, and a TDZ ReferenceError
 * inside a function whose whole contract is never to throw is a defect waiting
 * for a re-order (R2 round-4 finding 11). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function machineIdPath(userRoot?: string): string {
    return path.join(resolveCollectorStore(userRoot).root, MACHINE_ID_NAME);
}

/**
 * The machine id: read it, or mint one.
 *
 * `FIELD_PURPOSE` requires a LOCALLY GENERATED random UUID and explicitly not a
 * derived one — a hash of a hostname or a username is a pseudonym for the thing
 * it derives from, which is the leak class the whole schema is built against.
 * So this is `randomUUID()` and nothing else, persisted so it is stable across
 * invocations and rotatable by deleting one file.
 */
export function machineId(userRoot?: string): string | null {
    const target = machineIdPath(userRoot);
    try {
        const existing = fs.readFileSync(target, 'utf8').trim();
        if (UUID_RE.test(existing)) return existing;
    } catch {
        /* mint below */
    }
    try {
        const minted = crypto.randomUUID();
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, `${minted}\n`);
        return minted;
    } catch {
        return null;
    }
}

/**
 * The episode id for this process.
 *
 * One per session, per `FIELD_PURPOSE`. A hook runs as a fresh process per
 * event, so "this process" is not a session — the id is derived from the host's
 * own session identifier when it exposes one, and is otherwise minted per
 * process, which degrades the SCOPE of `sequence` and nothing else.
 *
 * The host id is HASHED rather than carried: it is an opaque host value, and
 * this schema's rule is that no field holds a foreign identifier. The hash is
 * one-way and the result is shaped as a UUID so `validateRecord` accepts it.
 */
/**
 * The per-process fallback episode, minted once.
 *
 * A fresh UUID per CALL was the defect: with no host session id in the
 * environment, two `recordCapture` calls in one process landed in two
 * episodes, so `dedup_key` scoping and the per-episode sequence counter both
 * broke. It was invisible on a developer machine because the host exports
 * `CLAUDE_CODE_SESSION_ID`, and it surfaced only on CI, where nothing does —
 * which is the whole population of unattended runs.
 *
 * Memoised per process, not per file: a hook is one process per event, so the
 * honest degradation without a host session is one episode per event rather
 * than one episode per record. That is a coarser grouping, and it is a
 * grouping.
 */
let fallbackEpisode: string | null = null;

export function episodeId(env: NodeJS.ProcessEnv = process.env): string {
    const hostSession = env.CLAUDE_CODE_SESSION_ID ?? env.AGENT_CONFIG_SESSION_ID ?? '';
    if (hostSession === '') {
        fallbackEpisode ??= crypto.randomUUID();
        return fallbackEpisode;
    }
    const digest = crypto.createHash('sha256').update(hostSession).digest('hex');
    return [
        digest.slice(0, 8),
        digest.slice(8, 12),
        `4${digest.slice(13, 16)}`,
        `8${digest.slice(17, 20)}`,
        digest.slice(20, 32),
    ].join('-');
}

/**
 * The next sequence number within an episode.
 *
 * Monotonic and non-negative per `FIELD_PURPOSE`, and it has to survive across
 * PROCESSES because a hook is one process per event. So it is a counter file
 * per episode, incremented under `wx`-free read-then-write — a lost update
 * costs a duplicate `dedup_key`, which the store already collapses at read
 * time, so the failure mode is a duplicate rather than a gap.
 */
export function nextSequence(episode: string, userRoot?: string): number {
    const dir = path.join(resolveCollectorStore(userRoot).root, EPISODE_DIR_NAME);
    const target = path.join(dir, `${episode}.seq`);
    try {
        fs.mkdirSync(dir, { recursive: true });
        let current = 0;
        try {
            const raw = Number.parseInt(fs.readFileSync(target, 'utf8').trim(), 10);
            if (Number.isInteger(raw) && raw >= 0) current = raw + 1;
        } catch {
            /* first record of this episode */
        }
        fs.writeFileSync(target, `${current}\n`);
        return current;
    } catch {
        return 0;
    }
}

/**
 * Drop episode counters older than the retention horizon.
 *
 * `nextSequence` writes one `episodes/<id>.seq` per session and nothing pruned
 * the directory (R2 round-4 finding 4) — inside the very directory
 * `RESOURCE_BUDGETS.disk_bytes` ceilings, whose breach STOPS the collector.
 * That is the argument the disk-budget basis already makes for
 * `opportunities.log`, left unapplied to the sibling directory added in the
 * same change. `directorySize` also re-`stat`s every one of these files on
 * every beat, so the per-beat cost grew without bound too.
 *
 * Pruned by MTIME rather than by content: a counter file carries a number, not
 * a date, and inventing a date format for it would be a second thing to keep in
 * sync with the retention horizon.
 */
export function pruneEpisodeCounters(
    userRoot: string | undefined,
    now: number = Date.now(),
    days: number = RETENTION_DAYS,
): number {
    const dir = path.join(resolveCollectorStore(userRoot).root, EPISODE_DIR_NAME);
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return 0;
    }
    const cutoff = now - days * 86_400_000;
    let dropped = 0;
    for (const name of entries) {
        if (!name.endsWith('.seq')) continue;
        const full = path.join(dir, name);
        try {
            if (fs.statSync(full).mtimeMs >= cutoff) continue;
            fs.rmSync(full, { force: true });
            dropped += 1;
        } catch {
            /* raced with another prune */
        }
    }
    return dropped;
}

/**
 * Record a CAPTURE — the numerator's production writer.
 *
 * **This function is the fix for the defect three review rounds took to find**
 * (R2 round-3 finding 1): `spoolRecord` had no production caller at all. The
 * denominator was wired into `dispatch_hook.main` and climbed; the numerator
 * stayed 0 by construction, so once the observation window and sample
 * thresholds were met, the miss branch would have fired a decision record for a
 * WIRING OMISSION rather than for a capture failure — and the two are
 * indistinguishable from the number.
 *
 * It builds a valid record from the three facts a hook has (event, platform,
 * date) plus the three the store needs to deduplicate (machine, episode,
 * sequence), and hands it to {@link spoolRecord}. Same never-throw contract as
 * everything else on this path.
 */
export function recordCapture(
    event: CollectorEvent | string,
    platform: CollectorPlatform | string,
    userRoot?: string,
    at: number = Date.now(),
    opts: WriterOptions = {},
): boolean {
    try {
        if (opts.includeSelfObserved !== true && isSelfObservation()) return false;
        if (!isCollectorEnabled(userRoot)) return false;
        if (!(COLLECTOR_EVENTS as readonly string[]).includes(event)) return false;
        if (!(COLLECTOR_PLATFORMS as readonly string[]).includes(platform)) return false;
        const machine = machineId(userRoot);
        if (machine === null) return false;
        const episode = episodeId();
        return spoolRecord(
            {
                schema_version: COLLECTOR_SCHEMA_VERSION,
                machine_id: machine,
                episode_id: episode,
                event,
                sequence: nextSequence(episode, userRoot),
                outcome: 'captured',
                platform,
                occurred_on: utcDate(at),
                collector_version: COLLECTOR_VERSION,
            },
            userRoot,
        );
    } catch {
        return false;
    }
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
/**
 * Hard ceiling on the undrained spool, in bytes.
 *
 * The spool is written by hook processes and drained ONLY by the daemon, and
 * "collector enabled, daemon not running" is a supported state — the daemon is
 * a separate opt-in process and `start()` legitimately refuses on `lock-held`
 * or `store-unavailable`. Without a cap the spool grew without limit in exactly
 * that state, and the disk budget that would have noticed is enforced by the
 * process that is not running (R2 round-4 finding 5).
 *
 * 8 MiB is two thirds of the disk budget's 12 MiB expected peak, so a spool at
 * its ceiling still leaves the store's own share. A record is ~250 bytes, so
 * this is roughly 33,000 undrained captures — far past any plausible drain
 * interval, which is what makes hitting it a signal rather than a limit.
 */
export const SPOOL_MAX_BYTES = 8 * 1024 * 1024;

export function spoolRecord(record: unknown, userRoot?: string): boolean {
    try {
        if (!isCollectorEnabled(userRoot)) return false;
        const target = spoolPendingPath(userRoot);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        // Refuse rather than rotate. A rotated spool would keep the newest
        // captures and silently drop the oldest, which inflates the measured
        // rate for the window that follows an outage; refusing loses the same
        // records and does not pretend otherwise. Either way the loss is real —
        // the difference is whether the numerator lies about it.
        try {
            if (fs.statSync(target).size >= SPOOL_MAX_BYTES) return false;
        } catch {
            /* absent is size 0 */
        }
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
let claimSequence = 0;

export function claimSpool(userRoot?: string, at: number = Date.now()): string | null {
    const pending = spoolPendingPath(userRoot);
    if (!fs.existsSync(pending)) return null;
    // A monotonic per-process counter, because the timestamp alone is not
    // unique (R2 round-2 finding 14): two claims by one process inside the same
    // millisecond produced the same name, and `renameSync` overwrites silently
    // — so the earlier batch was destroyed rather than the collision being
    // noticed. The per-user lock makes that narrow in production, but both
    // functions are exported and driven directly by tests, and the docstring's
    // "no lock, no lost line" is only true if the claimed name is unique.
    claimSequence += 1;
    const claimed = path.join(
        spoolDir(userRoot),
        `draining-${at}-${process.pid}-${claimSequence}.jsonl`,
    );
    try {
        fs.renameSync(pending, claimed);
        return claimed;
    } catch {
        return null;
    }
}

/**
 * Parse a claimed spool file into records. Unparseable lines are reported,
 * never dropped silently — and an UNREADABLE FILE is reported too.
 *
 * `unreadable` exists because its absence destroyed batches (R2 round-3 finding
 * 2): a read error returned `{records: [], malformed: 0}`, which is
 * indistinguishable from an empty file, and the caller then deleted the batch.
 * A transient `EACCES` or `EMFILE` therefore lost every record in it and
 * reported nothing — the exact loss class the crash-recovery re-drain exists to
 * prevent, arriving through the recovery path itself.
 */
export function readClaimedSpool(
    claimed: string,
): { records: unknown[]; malformed: number; unreadable: boolean } {
    let raw = '';
    try {
        raw = fs.readFileSync(claimed, 'utf8');
    } catch {
        return { records: [], malformed: 0, unreadable: true };
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
    return { records, malformed, unreadable: false };
}
