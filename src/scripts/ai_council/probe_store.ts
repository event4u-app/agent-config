/**
 * The observation half of provider qualification (road-to-release-review-p0
 * Phase 3).
 *
 * `qualification.ts` is pure and answers "given what has been observed, what
 * may this seat claim". This module is the only thing that observes. It exists
 * because the qualification ladder's strongest rung — has a real exchange with
 * this provider ever succeeded — cannot be answered from configuration, and
 * answering it with a fresh probe would mean spending money every time anyone
 * asked whether the council was healthy.
 *
 * So nothing here probes. A council run that receives a non-empty answer from a
 * seat has already performed the exchange; this records that it happened. The
 * cost of the observation is zero because the observation is a by-product of
 * work the operator asked for anyway, and a seat therefore decays out of
 * `unknown` through normal use rather than through a maintenance ritual.
 *
 * **The store is deliberately runtime-local and gitignored.** `agents/runtime/`
 * is not tracked, which has a consequence worth stating rather than
 * discovering: a fresh worktree starts with no observations, so every seat
 * reads `unknown` there until a run happens in it. That is the honest reading —
 * a checkout that has never talked to a provider genuinely has no evidence that
 * it can — and it is strictly better than the alternative of committing a
 * machine-specific health claim into a shared tree, where it would be stale for
 * everyone but the machine that wrote it.
 *
 * Corrupt or unreadable state is treated as "no observations", never as an
 * error: the same tolerant-reader doctrine the settings surface follows. A
 * status command that crashes because a JSON file has a stray byte is worse
 * than one that reports `unknown`, which is what the absence of evidence
 * actually means.
 */

import fs from 'node:fs';
import path from 'node:path';

import { isEnvKillSwitchActive } from '../_lib/env_kill_switch.js';
import type { CliFailureClass } from './transport_resolver.js';
import type { ProbeRecord } from './qualification.js';

/**
 * The same kill-switch the council event log honours.
 *
 * Sharing it rather than minting a second name is deliberate: both write
 * council observational state into the worktree, and the suite that needs one
 * suppressed needs the other suppressed for the identical reason. The
 * read-only witness in `tests/scripts/witness/` fails on ANY worktree path
 * appearing while it runs — including a gitignored one — so a test that
 * exercises `cmd_run` and silently dropped a probe row here would break that
 * witness whenever sharding put the two files together. Measured on this
 * branch: the first version of this module had no switch and wrote
 * `agents/runtime/state/council-probes.json` during the council suite.
 *
 * The coupling has a real cost worth stating: an operator who suppresses the
 * event log also stops accumulating observations, so seats stay `unknown`.
 * That is the correct direction — a run whose telemetry is switched off did
 * not record evidence, and pretending otherwise is the over-claim this whole
 * module exists to remove.
 */
const _KILL_SWITCH_ENV = 'AGENT_CONFIG_NO_EVENTS_LOG';

/** Repo-relative location. Runtime state, gitignored, never committed. */
export const PROBE_STORE_RELPATH = path.join('agents', 'runtime', 'state', 'council-probes.json');

export interface ProbeStore {
    readonly schema: 1;
    readonly members: Readonly<Record<string, ProbeRecord>>;
}

const EMPTY: ProbeStore = { schema: 1, members: {} };

/**
 * The closed set a stored `outcome` may hold — `ok` plus every
 * `CliFailureClass`. Duplicated as a runtime value because the type erases,
 * and this is a trust boundary: the file is hand-editable.
 */
const VALID_OUTCOMES: ReadonlySet<string> = new Set<'ok' | CliFailureClass>([
    'ok',
    'binary_missing',
    'auth_rejected',
    'cli_unsupported',
    'model_unservable',
    'timeout',
    'server_error',
    'quota_exhausted',
    'other',
]);

export function probeStorePath(root: string): string {
    return path.join(root, PROBE_STORE_RELPATH);
}

/**
 * Read the store. Any failure — missing, unreadable, malformed, wrong schema —
 * yields the empty store.
 *
 * Individual member entries are validated one by one rather than trusting the
 * object wholesale: a single corrupt row must not discard the other seats'
 * evidence, because that would silently downgrade healthy seats to `unknown`
 * and the operator would have no way to tell the two causes apart.
 */
export function readProbeStore(root: string): ProbeStore {
    let raw: string;
    try {
        raw = fs.readFileSync(probeStorePath(root), 'utf8');
    } catch {
        return EMPTY;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return EMPTY;
    }
    if (typeof parsed !== 'object' || parsed === null) {
        return EMPTY;
    }
    const obj = parsed as Record<string, unknown>;
    if (obj['schema'] !== 1) {
        return EMPTY;
    }
    const membersRaw = obj['members'];
    if (typeof membersRaw !== 'object' || membersRaw === null) {
        return EMPTY;
    }
    const members: Record<string, ProbeRecord> = {};
    for (const [name, value] of Object.entries(membersRaw as Record<string, unknown>)) {
        if (typeof value !== 'object' || value === null) {
            continue;
        }
        const v = value as Record<string, unknown>;
        const at = v['at'];
        const outcome = v['outcome'];
        if (typeof at !== 'string' || at === '' || typeof outcome !== 'string') {
            continue;
        }
        // Validated against the closed set, not cast into it. A bare
        // non-empty-string check let a corrupt or hand-edited value through,
        // where `_liveProbe` read it as `!== 'ok'` and not impaired — i.e. a
        // typo silently downgraded a healthy seat to `unavailable`
        // (R2 finding 9). Dropping the row instead yields `unknown`, which is
        // the honest reading of "this record is unreadable".
        if (!VALID_OUTCOMES.has(outcome)) {
            continue;
        }
        members[name] = { at, outcome: outcome as 'ok' | CliFailureClass };
    }
    return { schema: 1, members };
}

/**
 * Record one member's outcome, merging into whatever is already stored.
 *
 * Best-effort by construction: a write failure is swallowed. Telemetry that can
 * break a council run is worse than telemetry that occasionally misses a row —
 * the miss costs one `unknown`, the throw costs the run.
 */
export function recordProbe(
    root: string,
    name: string,
    outcome: 'ok' | CliFailureClass,
    at: string,
): void {
    recordProbes(root, [{ name, outcome, at }]);
}

/** One observation, as a caller collects them during a pass. */
export interface ProbeEntry {
    readonly name: string;
    readonly outcome: 'ok' | CliFailureClass;
    readonly at: string;
}

/** Batch form — one read/write for a whole pass rather than one per member. */
export function recordProbes(root: string, entries: readonly ProbeEntry[]): void {
    if (entries.length === 0 || isEnvKillSwitchActive(_KILL_SWITCH_ENV)) {
        return;
    }
    try {
        const current = readProbeStore(root);
        const members: Record<string, ProbeRecord> = { ...current.members };
        for (const e of entries) {
            members[e.name] = { at: e.at, outcome: e.outcome };
        }
        const target = probeStorePath(root);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, `${JSON.stringify({ schema: 1, members }, null, 2)}\n`, 'utf8');
    } catch {
        // Intentionally silent — see the docstring.
    }
}

/** The record for one member, or null when nothing was ever observed. */
export function probeFor(store: ProbeStore, name: string): ProbeRecord | null {
    return store.members[name] ?? null;
}
