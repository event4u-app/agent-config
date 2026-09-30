/**
 * What this install does on the network — the two `doctor` surfaces that
 * answer that question, in one module under the source-size cap.
 *
 * `road-to-host-traffic-knobs-that-ship` Phases 2.1 and 2.2. Its own module
 * rather than a function inside `cmd_doctor.ts` for the reason
 * `_lib/doctor_runtime_checks.ts` states for itself: that file is ~3,600 lines
 * and `check_source_size_budget` counts every line above 1,500, so a change
 * that adds lines there pays for them by taking lines away. Wiring the traffic
 * section in costs two lines; `checkOfflineReadiness` moving here returns more
 * than that, and lands beside a cohesive sibling rather than in an arbitrary
 * bin — "can this install work with no registry" and "which host traffic is
 * switched off" are the same question asked from two ends.
 *
 * `checkOfflineReadiness` is a PURE MOVE: same id, same statuses, same message
 * and remedy strings. Its `pathExists` is `fs.statSync` in a try, matching the
 * helper it used in `cmd_doctor.ts` — `existsSync` would differ on a path whose
 * parent denies traversal, and this is a move, not a repair.
 *
 * Why the traffic section reports rather than decides: the variables below belong to the HOST, not to this package. Writing one into
 * a consumer environment changes behaviour the consumer never asked to change,
 * and — per the mapping measured in `docs/setup/host-traffic-environment.md` —
 * could stop their background security updates as a side effect of a telemetry
 * preference. So this module reads `env` and returns; it writes nothing, opens
 * no socket, and touches no settings file. Two consecutive calls return equal
 * payloads and leave the tree byte-identical.
 *
 * Why an inapplicable row is PRESENT and says so: the obvious implementation lists only the variables that resolve on the
 * current host, which produces a short, clean section on a host that documents
 * none of them. An operator reading that concludes their traffic is governed,
 * when in fact the package simply had nothing to say. An omission that reads as
 * a clean bill of health is the precise failure this surface exists to prevent,
 * so a row that does not apply is emitted with the literal state
 * {@link NOT_APPLICABLE} instead of being dropped.
 *
 * A variable that is SET on a host that does not document it still reports its
 * value beside that state. The state says "this host is not known to read it";
 * dropping the value as well would hide a fact the reader has.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** The doctor's structured check row. Mirrors `cmd_doctor`'s internal `Dict`. */
export interface NetworkCheck {
    id: string;
    status: 'ok' | 'warn' | 'fail' | 'skipped';
    message: string;
    remedy: string;
    /** Structural compatibility with `cmd_doctor`'s `Dict` row type. */
    [k: string]: string;
}

/** The literal a row carries where the host has no documented meaning for it. */
export const NOT_APPLICABLE = 'not applicable on this host';

/** The documentation surface every row points at. One copy of the mapping. */
export const TRAFFIC_DOC = 'docs/setup/host-traffic-environment.md';

/** Host id used when nothing in the environment identifies the host. */
export const UNKNOWN_HOST = 'unknown';

/**
 * One documented host traffic variable.
 *
 * `hosts` lists the host ids whose shipped build was actually READ for this
 * variable — never a host somebody expects to behave the same way. A host
 * absent from the list gets {@link NOT_APPLICABLE}, which is the honest answer
 * and also the safe one.
 */
export interface TrafficVariable {
    readonly variable: string;
    readonly hosts: readonly string[];
    /** Host build and date the row was read from, e.g. `claude-code 2.1.284 · 2026-09-29`. */
    readonly checked_against: string;
    /**
     * May THIS PACKAGE write the variable into the host env block?
     *
     * `false` on both traffic variables and it is not a policy setting — it is a
     * structural fact: `install.ts`'s `WRITABLE_HOST_ENV` is a two-row allow
     * table and the settings schema admits only those two keys, so neither
     * traffic variable is expressible anywhere in the write path. Reported
     * because a consumer reading `set` on a row deserves to know whether this
     * package could have been the one that set it.
     */
    readonly writable_by_this_package: boolean;
}

/** The host build every row below was read from. One place to bump on a re-check. */
const CHECKED = 'claude-code 2.1.284 · 2026-09-29';

/**
 * The documented set, in the order `docs/setup/host-traffic-environment.md`
 * lists it. What each one governs — and does not — lives in that page and is
 * deliberately not duplicated here: a second copy is a second thing to keep
 * true, and this one would be the copy nobody re-reads.
 */
export const TRAFFIC_VARIABLES: readonly TrafficVariable[] = [
    // Both traffic variables reach the host's update-disabled resolver, the
    // blanket one as its third rung, so neither is writable by this package —
    // owner-decided 2026-09-30.
    { variable: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', hosts: ['claude-code'], checked_against: CHECKED, writable_by_this_package: false },
    { variable: 'DISABLE_AUTOUPDATER', hosts: ['claude-code'], checked_against: CHECKED, writable_by_this_package: false },
    // Size caps. Neither reaches the updater resolver, and neither suppresses a
    // call, an update check or a download.
    { variable: 'BASH_MAX_OUTPUT_LENGTH', hosts: ['claude-code'], checked_against: CHECKED, writable_by_this_package: true },
    { variable: 'MAX_MCP_OUTPUT_TOKENS', hosts: ['claude-code'], checked_against: CHECKED, writable_by_this_package: true },
];

/** An environment map, in the shape `process.env` has. */
export type EnvMap = Readonly<Record<string, string | undefined>>;

/** Which host this process is running under, and whether that was observed. */
export interface TrafficHost {
    host: string;
    observed: boolean;
}

/**
 * Resolve the host from the environment it exported.
 *
 * `observed` carries the same distinction `routing:doctor` draws for its own
 * platform field: a host that identified itself is a fact, and the absence of
 * any marker is NOT evidence of a different host — only evidence that nobody
 * said. An unidentified host resolves to {@link UNKNOWN_HOST}, which documents
 * no variable, so every row reads {@link NOT_APPLICABLE} rather than reporting
 * against a host this code guessed at.
 */
export function resolveTrafficHost(env: EnvMap): TrafficHost {
    const claude =
        (env['CLAUDECODE'] ?? '').trim() !== '' || (env['CLAUDE_CODE_SESSION_ID'] ?? '').trim() !== '';
    if (claude) return { host: 'claude-code', observed: true };
    return { host: UNKNOWN_HOST, observed: false };
}

/** One emitted row: the variable, its state on this host, and its value if set. */
export interface TrafficRow {
    variable: string;
    state: string;
    value: string | null;
    checked_against: string;
    writable_by_this_package: boolean;
}

/**
 * Build one row. A variable the host does not document reports
 * {@link NOT_APPLICABLE} whether or not it happens to be exported.
 */
function trafficRow(spec: TrafficVariable, env: EnvMap, host: string): TrafficRow {
    const raw = env[spec.variable];
    const present = raw !== undefined && raw !== '';
    const applicable = spec.hosts.includes(host);
    return {
        variable: spec.variable,
        state: applicable ? (present ? 'set' : 'unset') : NOT_APPLICABLE,
        value: present ? String(raw) : null,
        checked_against: spec.checked_against,
        writable_by_this_package: spec.writable_by_this_package,
    };
}

/**
 * The `traffic_environment` block of `agent-config doctor --json`.
 *
 * Read-only by construction: the only input is the injected `env` map, and the
 * only output is a fresh object. `hostOverride` is the test seam Phase 2.2's
 * non-Claude fixture needs, and is never passed by the production call site.
 *
 * `reporting_read_only` replaced a flat `read_only: true` on 2026-09-30, and the
 * rename is the point rather than cosmetics: this REPORT is still read-only, but
 * the PACKAGE is no longer, so the old key had become a true statement about the
 * wrong subject. Two of the four rows are now writable by the installer when the
 * consumer sets a cap, and `writable_by_this_package` says which — a consumer
 * reading `set` deserves to know whether we could have been the one who set it.
 */
export function trafficEnvironmentJson(
    env: EnvMap,
    hostOverride?: TrafficHost,
): Record<string, unknown> {
    const resolved = hostOverride ?? resolveTrafficHost(env);
    return {
        host: resolved.host,
        host_observed: resolved.observed,
        doc: TRAFFIC_DOC,
        reporting_read_only: true,
        writable_by_this_package: TRAFFIC_VARIABLES.filter((v) => v.writable_by_this_package).map(
            (v) => v.variable,
        ),
        rows: TRAFFIC_VARIABLES.map((spec) => trafficRow(spec, env, resolved.host)),
    };
}

/** `fs.statSync` in a try — the `cmd_doctor.ts` helper this move preserves. */
function pathExists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/**
 * The `offline-readiness` check — a pure move out of `cmd_doctor.ts`.
 *
 * `packageRoot` is passed IN rather than resolved here for the reason
 * `doctor_runtime_checks.ts` gives for its `which` parameter: `_package_root`
 * lives in `cmd_doctor.ts` and importing it back would make the two modules
 * circular.
 */
export function checkOfflineReadiness(packageRoot: string): NetworkCheck {
    const script = path.join(packageRoot, 'src', 'scripts', 'hermetic-install.sh');
    if (!pathExists(script)) {
        return {
            id: 'offline-readiness',
            status: 'warn',
            message: 'src/scripts/hermetic-install.sh not found in package',
            remedy: 'reinstall @event4u/agent-config or pull missing files',
        };
    }
    return {
        id: 'offline-readiness',
        status: 'ok',
        message: 'verified-offline install entrypoint present',
        remedy: '',
    };
}
