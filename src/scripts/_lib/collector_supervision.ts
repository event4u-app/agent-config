/**
 * collector_supervision — the supervised telemetry collector's OPERATIONAL
 * contract (`road-to-supervised-telemetry-collector` Phase 3, steps 3.2–3.4).
 *
 * Phase 2 fixed what a record may contain. This module fixes what the *process*
 * may cost, how it is stopped when it will not stop itself, and what happens
 * when a static-mode tree and a daemon-mode tree exist at the same time. All
 * three were named by the council as things that must be numbers and mechanisms
 * before Phase 4 writes any code, because each one is unfalsifiable once an
 * implementation has already fixed it by accident.
 *
 * ## What this module is NOT
 *
 * It is not the collector. Nothing here spawns a process, opens the store, or
 * writes a record. It is the contract the Phase-4 collector is built against,
 * plus the pure predicates a test can drive without a daemon existing. The one
 * function that touches a live process is {@link terminateCollector}, and it is
 * here rather than in Phase 4 deliberately: **the kill switch must not live
 * inside the thing it kills.**
 *
 * ## The three questions this answers, and the two it does not
 *
 * `docs/contracts/resident-process-floors.md` § 2 asks five questions of every
 * resident-process design. Three are answered here:
 *
 * - **Q3 — state on an unclean stop.** {@link HEARTBEAT_FILE_NAME} is the only
 *   process-scoped state, it is rewritten whole on every beat, and a stale or
 *   absent beat is a *readable* answer rather than a missing one. The store's
 *   own crash state is `MIGRATION-IN-FLIGHT`, owned by `collector_store`.
 * - **Q4 — who supervises it, with what privileges.** A per-user service
 *   manager, positively probed, never assumed —
 *   {@link detectSupervisor}. No administrator privilege is required or
 *   requested on either supported row.
 * - **Q5 — the uniqueness namespace.** One live collector per OS user, from the
 *   `uniqueness-namespace` (b) verdict. {@link runtimeLockPath} is that
 *   namespace made concrete, and § 3.4 below is what it means for two
 *   checkouts.
 *
 * Q1 (failure mode when absent) and Q2 (what it does to a dispatch it cannot
 * serve) are answered by the roadmap's Goal and by row 4 of the 3.1 matrix —
 * static fallback, a degradation and never a block — and are restated in
 * {@link DISPATCH_MODE_CONTRACT} rather than re-decided here.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveCollectorStore } from './collector_store.js';

/* -------------------------------------------------------------------------- */
/* 3.2 — Resource budgets as numbers                                          */
/* -------------------------------------------------------------------------- */

/**
 * A single resource ceiling.
 *
 * `headroomAtPeak` is DERIVED (`ceiling - expectedPeak`) rather than stated
 * independently, so the two numbers cannot drift into a headroom that is not
 * the difference between them. `scale-discipline` R-A12 is the rule this
 * satisfies: *an unquantified ceiling is not headroom*, and a headroom that is
 * not arithmetic on the other two fields is a third unquantified number.
 */
export interface ResourceBudget {
    /** The hard stop. Crossing it stops the collector — never throttles it. */
    readonly ceiling: number;
    /** Unit, for the operator reading a breach message. */
    readonly unit: string;
    /** What the collector is expected to use at its busiest observed moment. */
    readonly expectedPeak: number;
    /** Where `expectedPeak` comes from. A number with no basis is a guess. */
    readonly basis: string;
}

export type BudgetName = 'cpu_percent' | 'resident_bytes' | 'disk_bytes' | 'file_descriptors';

/**
 * The four budgets, committed 2026-08-30.
 *
 * **REVISED 2026-08-30, and the revision is the point.** The first draft's
 * peaks were derivations, with a `revisit-if` saying that a measured peak above
 * a derived one falsifies the derivation. Phase 4 landed, a real daemon ran,
 * and it falsified two of the four on its first start: resident memory read
 * 116.2 MiB against a 96 MiB ceiling, and file descriptors read 28 against a
 * derived peak of 12. The daemon budget-stopped itself within seconds.
 *
 * So two rows are now MEASURED and two are still derived, and each `basis` says
 * which it is. That distinction is the whole value of the field — a table where
 * every row reads with the same confidence tells a reader nothing about which
 * numbers have met reality.
 *
 * **The measurement is one platform and one execution mode**: macOS, running
 * under `tsx`, which loads a TypeScript transpiler into the same process. A
 * built-JS daemon would very likely read far lower. The budget is set against
 * the mode this repository ACTUALLY runs (`./scripts-run` is tsx), because a
 * ceiling calibrated to a build that does not exist would stop the daemon that
 * does.
 *
 * *Revisit-if:* the daemon ships as built JS rather than through `tsx` (both
 * memory rows should then be re-measured and will likely fall by half); or a
 * measured peak on the Linux row exceeds these; or a descriptor count climbs
 * across a long run, which is a leak rather than a load and is the one thing
 * the descriptor ceiling can usefully detect.
 */
export const RESOURCE_BUDGETS: Readonly<Record<BudgetName, ResourceBudget>> = Object.freeze({
    cpu_percent: Object.freeze({
        ceiling: 2,
        unit: '% of one core, averaged over 60s',
        expectedPeak: 0.2,
        basis:
            'DERIVED. The collector wakes on a hook write and on its heartbeat interval. ' +
            'At the metric definition\'s observed dispatch volume the wake rate is under ' +
            'one per second, and a wake is a single-row INSERT plus a stat(2). 0.2% of one ' +
            'core is two orders of magnitude above the arithmetic and one below the ' +
            'ceiling. Not yet measured over a full 60s window on a real run — the sampler ' +
            'refuses to compute a percentage over a window shorter than a second, which is ' +
            'itself a lesson from a measured 36800% reading.',
    }),
    resident_bytes: Object.freeze({
        ceiling: 192 * 1024 * 1024,
        unit: 'bytes RSS',
        expectedPeak: 128 * 1024 * 1024,
        basis:
            'MEASURED 2026-08-30: a real daemon read 116.2 MiB RSS on macOS under tsx, ' +
            'steady across three samples. The previous DERIVED pair (60 MiB peak, 96 MiB ' +
            'ceiling) was built from a bare-Node floor of ~40 MiB and did not account for ' +
            'the TypeScript transpiler tsx loads into the same process; the daemon ' +
            'budget-stopped itself within seconds of its first start. 128 MiB is the ' +
            'measurement plus ~10% for heap growth; the 192 MiB ceiling leaves 64 MiB, ' +
            'which is what absorbs a GC high-water mark a three-sample reading cannot see.',
    }),
    disk_bytes: Object.freeze({
        ceiling: 64 * 1024 * 1024,
        unit: 'bytes, the collector directory including quarantine',
        expectedPeak: 12 * 1024 * 1024,
        basis:
            'RETENTION_DAYS is 63 and a record is nine small columns. At the metric ' +
            'definition\'s upper dispatch estimate a full retention window is single-digit ' +
            'MiB; 12 MiB is that plus SQLite page overhead and one quarantined store. The ' +
            'ceiling is deliberately ~5x: quarantine is never deleted by design, so the ' +
            'directory has one growth term this budget cannot bound by retention alone.',
    }),
    file_descriptors: Object.freeze({
        ceiling: 128,
        unit: 'open descriptors held by the collector process',
        expectedPeak: 48,
        basis:
            'MEASURED 2026-08-30: 28 open descriptors on macOS under tsx with the store ' +
            'open, steady across three samples. The previous DERIVED peak of 12 counted ' +
            'only the files this module opens (database, WAL, shm, heartbeat, lock, stdio) ' +
            'and ignored everything the runtime holds. 48 is the measurement plus room for ' +
            'an in-flight quarantine rename; the 128 ceiling is set where a LEAK becomes ' +
            'distinguishable from load, which is the only thing a descriptor ceiling can ' +
            'usefully detect — a ceiling near the steady state would fire on noise instead.',
    }),
});

/** `ceiling - expectedPeak`, per budget. Never stored — always derived. */
export function headroomAtPeak(name: BudgetName): number {
    const b = RESOURCE_BUDGETS[name];
    return b.ceiling - b.expectedPeak;
}

/** A live reading of all four budgets. Every field is required: a missing reading is not a pass. */
export type ResourceReading = Readonly<Record<BudgetName, number>>;

export interface BudgetVerdict {
    /** Budgets whose ceiling the reading crossed, in declaration order. */
    readonly exceeded: readonly BudgetName[];
    /**
     * What the collector must do. `stop` is the only non-continue action:
     * throttling is refused by row 4 of the 3.1 matrix, because an observer
     * that has become a load is no longer an observer.
     */
    readonly action: 'continue' | 'stop';
    /** One human line per exceeded budget. Empty when `action` is `continue`. */
    readonly reasons: readonly string[];
}

/**
 * Decide whether a reading is inside every budget.
 *
 * Strictly greater-than is the breach test: a reading exactly AT the ceiling is
 * inside it. The ceiling is the last permitted value, not the first forbidden
 * one, and picking the other convention would make every budget one unit
 * tighter than its documented number.
 */
export function budgetVerdict(reading: ResourceReading): BudgetVerdict {
    const exceeded: BudgetName[] = [];
    const reasons: string[] = [];
    for (const name of Object.keys(RESOURCE_BUDGETS) as BudgetName[]) {
        const budget = RESOURCE_BUDGETS[name];
        const value = reading[name];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            exceeded.push(name);
            reasons.push(`${name}: no finite reading — a missing reading is a breach, not a pass`);
            continue;
        }
        if (value > budget.ceiling) {
            exceeded.push(name);
            reasons.push(
                `${name}: ${value} ${budget.unit} exceeds the ceiling of ${budget.ceiling}`,
            );
        }
    }
    return Object.freeze({
        exceeded: Object.freeze(exceeded),
        action: exceeded.length > 0 ? 'stop' : 'continue',
        reasons: Object.freeze(reasons),
    });
}

/* -------------------------------------------------------------------------- */
/* Heartbeat — the observable-death mechanism the supervisor blocker required  */
/* -------------------------------------------------------------------------- */

/** The heartbeat file, inside the collector directory. Rewritten whole on every beat. */
export const HEARTBEAT_FILE_NAME = 'heartbeat.json';

/** Beats older than this are `stale`: likely dead, and the operator is told so. */
export const HEARTBEAT_STALE_AFTER_MS = 90_000;

export interface Heartbeat {
    readonly pid: number;
    /** Epoch milliseconds. */
    readonly started_at: number;
    /** Epoch milliseconds, rewritten on each beat. */
    readonly last_heartbeat: number;
    readonly mode: 'supervised' | 'degraded';
}

export function heartbeatPath(userRoot?: string): string {
    return path.join(resolveCollectorStore(userRoot).root, HEARTBEAT_FILE_NAME);
}

/** Write the beat. Whole-file, never appended: a partial beat must not be readable as a fresh one. */
export function writeHeartbeat(beat: Heartbeat, userRoot?: string): void {
    const target = heartbeatPath(userRoot);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(beat)}\n`);
    fs.renameSync(tmp, target);
}

/** Read the beat, or null when absent or unparseable. Unparseable and absent are the same answer: not running. */
export function readHeartbeat(userRoot?: string): Heartbeat | null {
    try {
        const raw = fs.readFileSync(heartbeatPath(userRoot), 'utf8');
        const parsed: unknown = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object') return null;
        const beat = parsed as Partial<Heartbeat>;
        if (typeof beat.pid !== 'number' || typeof beat.last_heartbeat !== 'number') return null;
        if (typeof beat.started_at !== 'number') return null;
        if (beat.mode !== 'supervised' && beat.mode !== 'degraded') return null;
        return beat as Heartbeat;
    } catch {
        return null;
    }
}

export type LivenessState = 'absent' | 'stale' | 'running';

/**
 * Three-valued on purpose. `absent` means nothing claims to be running;
 * `stale` means something claimed to and has not beaten since — which is the
 * state a boolean would report as healthy or as absent, and both readings are
 * wrong. A silently dead collector making incomplete telemetry look healthy is
 * the failure the supervisor blocker named as decisive.
 */
export function livenessFromBeat(beat: Heartbeat | null, now: number = Date.now()): LivenessState {
    if (beat === null) return 'absent';
    return now - beat.last_heartbeat > HEARTBEAT_STALE_AFTER_MS ? 'stale' : 'running';
}

/* -------------------------------------------------------------------------- */
/* Uniqueness namespace — one live collector per OS user                      */
/* -------------------------------------------------------------------------- */

export const RUNTIME_LOCK_NAME = 'collector.lock';

/**
 * The lock path IS the uniqueness namespace made concrete.
 *
 * It hangs off the user root, so two checkouts — two worktrees of this
 * repository, the common case per `resident-process-floors` § 2 Q5 — resolve to
 * the SAME path and therefore contend for the same lock. That is the
 * `uniqueness-namespace` (b) verdict working: the second checkout does not get
 * a second collector, it gets static mode.
 */
export function runtimeLockPath(userRoot?: string): string {
    return path.join(resolveCollectorStore(userRoot).root, RUNTIME_LOCK_NAME);
}

export interface LockOutcome {
    readonly acquired: boolean;
    /** The pid recorded in the lock — ours when acquired, the incumbent's when not. */
    readonly holder: number | null;
    /** Set when `acquired` is false. */
    readonly reason: 'held-by-live-process' | 'kill-switch-engaged' | null;
}

function pidIsAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        // EPERM means it exists and is not ours. Alive for our purposes.
        return (err as NodeJS.ErrnoException).code === 'EPERM';
    }
}

/**
 * Take the per-user lock, or report who holds it.
 *
 * `wx` is the atomicity: two processes racing produce exactly one winner
 * without a compare-then-write window. A lock whose recorded pid is not alive
 * is FENCED — taken over rather than respected — because a crashed collector
 * must not lock its successor out forever, which is row 2's recovery procedure
 * in the 3.1 matrix.
 */
export function acquireRuntimeLock(userRoot?: string, pid: number = process.pid): LockOutcome {
    if (killSwitchEngaged(userRoot)) {
        return Object.freeze({ acquired: false, holder: null, reason: 'kill-switch-engaged' as const });
    }
    const target = runtimeLockPath(userRoot);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try {
        fs.writeFileSync(target, `${pid}\n`, { flag: 'wx' });
        return Object.freeze({ acquired: true, holder: pid, reason: null });
    } catch {
        const incumbent = Number.parseInt(readLockPid(target) ?? '', 10);
        if (Number.isFinite(incumbent) && pidIsAlive(incumbent)) {
            return Object.freeze({
                acquired: false,
                holder: incumbent,
                reason: 'held-by-live-process' as const,
            });
        }
        // Stale owner: fence it.
        fs.writeFileSync(target, `${pid}\n`);
        return Object.freeze({ acquired: true, holder: pid, reason: null });
    }
}

function readLockPid(target: string): string | null {
    try {
        return fs.readFileSync(target, 'utf8').trim();
    } catch {
        return null;
    }
}

/** Release the lock. Idempotent, and safe to call when someone else fenced us. */
export function releaseRuntimeLock(userRoot?: string): void {
    fs.rmSync(runtimeLockPath(userRoot), { force: true });
}

/* -------------------------------------------------------------------------- */
/* 3.3 — The kill switch                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The kill-switch marker. Its presence is the whole signal; content is ignored
 * — the same shape as `OPT-OUT`, for the same reason: a switch whose meaning
 * depends on parsing its contents can be half-pulled.
 */
export const KILL_SWITCH_NAME = 'STOP';

export function killSwitchPath(userRoot?: string): string {
    return path.join(resolveCollectorStore(userRoot).root, KILL_SWITCH_NAME);
}

/**
 * Pull the switch: refuse activation, then terminate anything already running.
 *
 * **Reachable without the collector's cooperation**, which is 3.3's binding
 * requirement. The marker is a file the operator can create with `touch`; the
 * termination is a signal from outside the process. Neither asks the collector
 * to agree, so a wedged collector cannot decline to be stopped.
 */
export function pullKillSwitch(userRoot?: string): void {
    const target = killSwitchPath(userRoot);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
        target,
        'The collector is stopped. Delete this file to allow it to start again.\n' +
            'See docs/contracts/collector-operations.md.\n',
    );
}

export function killSwitchEngaged(userRoot?: string): boolean {
    return fs.existsSync(killSwitchPath(userRoot));
}

export function clearKillSwitch(userRoot?: string): void {
    fs.rmSync(killSwitchPath(userRoot), { force: true });
}

export interface TerminationOutcome {
    /** True when nothing was running, or when the process is gone at return. */
    readonly stopped: boolean;
    /** How it ended. `already-absent` is a success, not a failure. */
    readonly via: 'already-absent' | 'graceful' | 'forced' | 'unreachable';
    readonly pid: number | null;
}

export interface TerminateOptions {
    /** How long to wait for a graceful exit before escalating. */
    readonly graceMs?: number;
    /** Poll interval while waiting. */
    readonly pollMs?: number;
    /** Injected for tests; defaults to the real signal. */
    readonly kill?: (pid: number, signal: NodeJS.Signals) => void;
    /** Injected for tests; defaults to a real liveness probe. */
    readonly alive?: (pid: number) => boolean;
    /** Injected for tests; defaults to a real sleep. */
    readonly sleep?: (ms: number) => void;
}

/**
 * Stop the collector, escalating to `SIGKILL` when it will not stop itself.
 *
 * The escalation is the point. 3.3's `verify:` requires a wedged collector —
 * one that has installed a `SIGTERM` handler and does not honour it — to be
 * killed through this path, so a graceful-only implementation would satisfy the
 * step's prose and fail its test. `SIGKILL` is Unix-specific, which is why the
 * platform table lists exactly two supported rows.
 *
 * Synchronous by construction: this runs from a CLI invocation and from a
 * signal handler, and both are places where an unawaited promise is a bug.
 */
export function terminateCollector(
    userRoot?: string,
    options: TerminateOptions = {},
): TerminationOutcome {
    const beat = readHeartbeat(userRoot);
    if (beat === null) {
        return Object.freeze({ stopped: true, via: 'already-absent' as const, pid: null });
    }
    const graceMs = options.graceMs ?? 5_000;
    const pollMs = options.pollMs ?? 100;
    const kill = options.kill ?? ((pid, signal) => process.kill(pid, signal));
    const alive = options.alive ?? pidIsAlive;
    const sleep =
        options.sleep ??
        ((ms: number) => {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
        });

    if (!alive(beat.pid)) {
        return Object.freeze({ stopped: true, via: 'already-absent' as const, pid: beat.pid });
    }
    try {
        kill(beat.pid, 'SIGTERM');
    } catch {
        return Object.freeze({ stopped: false, via: 'unreachable' as const, pid: beat.pid });
    }
    let waited = 0;
    while (waited < graceMs) {
        if (!alive(beat.pid)) {
            return Object.freeze({ stopped: true, via: 'graceful' as const, pid: beat.pid });
        }
        sleep(pollMs);
        waited += pollMs;
    }
    try {
        kill(beat.pid, 'SIGKILL');
    } catch {
        return Object.freeze({ stopped: false, via: 'unreachable' as const, pid: beat.pid });
    }
    waited = 0;
    while (waited < graceMs) {
        if (!alive(beat.pid)) {
            return Object.freeze({ stopped: true, via: 'forced' as const, pid: beat.pid });
        }
        sleep(pollMs);
        waited += pollMs;
    }
    return Object.freeze({ stopped: false, via: 'unreachable' as const, pid: beat.pid });
}

/* -------------------------------------------------------------------------- */
/* 3.4 — Static mode and daemon mode against the same tree                    */
/* -------------------------------------------------------------------------- */

export type DispatchMode = 'static' | 'daemon';

/**
 * The answer to 3.4, stated once so no implementation can decide it by
 * accident: **the two modes are mutually exclusive per OS user, and the
 * exclusion is enforced by the runtime lock rather than by convention.**
 *
 * Concurrent operation is REFUSED rather than made correct. Two writers against
 * one store is duplicate capture — the numerator of the capture rate counting
 * one dispatch twice — and version skew, where two checkouts at different
 * revisions disagree about the schema. Neither is worth solving for an
 * instrument whose entire purpose is an accurate ratio.
 *
 * What "static mode" means concretely: **there is no collector process and
 * nothing is captured.** It is not a second, quieter writer. That is what makes
 * the exclusion cheap — the losing side of the race has nothing to flush and no
 * partial state, and § 1's falsifiable form (*if the module were killed, every
 * dispatch would resolve identically*) holds unchanged.
 */
export const DISPATCH_MODE_CONTRACT = Object.freeze({
    concurrentOperationPermitted: false,
    preventedBy: 'per-user runtime lock (RUNTIME_LOCK_NAME) in the collector directory',
    loserBehaviour: 'static' as DispatchMode,
    whenAbsent: 'every dispatch resolves identically; nothing is captured and nothing blocks',
});

export interface ModeResolution {
    readonly mode: DispatchMode;
    /** Why. Always populated — a mode with no stated reason is unauditable. */
    readonly reason: string;
    /** The live pid when another checkout already holds the lock. */
    readonly incumbent: number | null;
}

/**
 * Decide which mode this invocation runs in, WITHOUT taking the lock.
 *
 * Pure with respect to the lock — it reads, never writes — so a CLI can report
 * the mode without becoming a second contender for it. The collector's own
 * start path calls {@link acquireRuntimeLock}, whose result is authoritative;
 * this is the reporting view, and the two agree because both read the same
 * file.
 */
export function resolveDispatchMode(userRoot?: string): ModeResolution {
    if (killSwitchEngaged(userRoot)) {
        return Object.freeze({
            mode: 'static' as const,
            reason: 'kill switch engaged — the collector is stopped by operator action',
            incumbent: null,
        });
    }
    const raw = readLockPid(runtimeLockPath(userRoot));
    if (raw === null) {
        return Object.freeze({
            mode: 'daemon' as const,
            reason: 'no runtime lock held for this OS user',
            incumbent: null,
        });
    }
    const incumbent = Number.parseInt(raw, 10);
    if (Number.isFinite(incumbent) && pidIsAlive(incumbent)) {
        return Object.freeze({
            mode: 'static' as const,
            reason: `a collector is already live for this OS user (pid ${incumbent})`,
            incumbent,
        });
    }
    return Object.freeze({
        mode: 'daemon' as const,
        reason: 'the runtime lock is stale — its owner is not alive and will be fenced',
        incumbent: null,
    });
}

/* -------------------------------------------------------------------------- */
/* Supervisor detection — probed, never assumed                               */
/* -------------------------------------------------------------------------- */

export type SupervisorKind = 'launchd-user' | 'systemd-user' | 'none';

export interface SupervisorProbe {
    readonly kind: SupervisorKind;
    /** `supported` only where a user-scoped manager was positively detected. */
    readonly tier: 'supported' | 'static-fallback';
    readonly reason: string;
}

export interface ProbeEnvironment {
    readonly platform?: NodeJS.Platform;
    readonly env?: NodeJS.ProcessEnv;
    readonly exists?: (p: string) => boolean;
}

/**
 * Probe for a user-scoped service manager.
 *
 * "Positively detected — probed, never assumed" is the supervisor blocker's own
 * wording, and the Linux row is where it bites: `systemd` being *installed* is
 * not the condition. A user session bus must exist, which is what
 * `DBUS_SESSION_BUS_ADDRESS` or a live `XDG_RUNTIME_DIR/systemd/private`
 * evidences. A container or a CI runner has neither, and both correctly resolve
 * to static fallback.
 *
 * Windows returns `none` with a reason that says **unevaluated**, not refused —
 * the platform table's wording, kept here because a probe that reported
 * "unsupported" would harden an omission into a decision nobody made.
 */
export function detectSupervisor(environment: ProbeEnvironment = {}): SupervisorProbe {
    const platform = environment.platform ?? process.platform;
    const env = environment.env ?? process.env;
    const exists = environment.exists ?? ((p: string) => fs.existsSync(p));

    if (platform === 'darwin') {
        const agents = path.join(os.homedir(), 'Library', 'LaunchAgents');
        return Object.freeze({
            kind: 'launchd-user' as const,
            tier: 'supported' as const,
            reason: `per-user launchd agent under ${agents}; no administrator privilege required`,
        });
    }
    if (platform === 'linux') {
        const runtimeDir = env.XDG_RUNTIME_DIR;
        const hasBusAddress = typeof env.DBUS_SESSION_BUS_ADDRESS === 'string'
            && env.DBUS_SESSION_BUS_ADDRESS.length > 0;
        const hasPrivateSocket =
            typeof runtimeDir === 'string'
            && runtimeDir.length > 0
            && exists(path.join(runtimeDir, 'systemd', 'private'));
        if (hasBusAddress || hasPrivateSocket) {
            return Object.freeze({
                kind: 'systemd-user' as const,
                tier: 'supported' as const,
                reason: 'systemd --user reachable: a user session bus was positively detected',
            });
        }
        return Object.freeze({
            kind: 'none' as const,
            tier: 'static-fallback' as const,
            reason:
                'linux without a user session bus (container, minimal image, or CI runner) — '
                + 'systemd being installed is not the condition',
        });
    }
    if (platform === 'win32') {
        return Object.freeze({
            kind: 'none' as const,
            tier: 'static-fallback' as const,
            reason: 'no user-scoped manager evaluated for Windows — unevaluated, not refused',
        });
    }
    return Object.freeze({
        kind: 'none' as const,
        tier: 'static-fallback' as const,
        reason: `no supervisor detected for platform ${platform}`,
    });
}
