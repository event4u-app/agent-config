/**
 * Whether a host may have a skill materialised into it — the Phase 4 gate of
 * `road-to-skills-that-arrive-when-called`, as code rather than as prose.
 *
 * WHY THIS IS CODE. The roadmap states the gate as a sentence: Phase 4 is
 * "gated on 0.2 (a)–(b) and 0.3 being `observed-true` for the host in question".
 * A sentence is applied by whoever reads it, and the probe rows it points at are
 * a JSON file with an expiry — so the gate and the evidence can drift apart with
 * nobody noticing. Reading the rows at the decision point makes the gate fail
 * the moment the evidence stops supporting it, including when a row expires.
 *
 * WHAT THE GATE ACTUALLY ASKS. Not "has every probe been run" — two cells stay
 * `unobserved` because the host's own permission classifier refused the set-up
 * twice, and a third lane did not re-attempt it. It asks the narrower question
 * materialisation depends on: **can this host pick up a skill that appears
 * after its session started, and does a removal not break a session already
 * using one?** For the first host both are `observed-true` (by symlink, racing
 * the watcher — hence the single retry callers owe). For the second host the
 * pickup cell is `unobserved` after four runs, three of them stopped by a
 * subscription rate limit, so materialisation is OFF there and 4.1's
 * install-time resident set is what that host gets instead.
 *
 * `unobserved` and `observed-false` both deny. They are not the same answer —
 * one is a wait and one is a reading — but neither is permission, and a gate
 * that treated silence as a yes would be the failure the probe rows exist to
 * prevent.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** One probe row, as `skill-lifecycle-probes*.json` carries it. */
export interface ProbeRow {
    host: string;
    state: string;
    host_version: string | null;
    transcript: string | null;
    date: string | null;
    expiry?: string;
    reason: string;
}

export type ProbeFile = Record<string, ProbeRow | string>;

export interface GateVerdict {
    enabled: boolean;
    /** Every cell the gate read, with the state it found. */
    cells: Array<{ id: string; state: string; expired: boolean }>;
    /** Empty when `enabled`. One sentence per cell that denied. */
    reasons: string[];
}

/**
 * The cells each host's materialisation depends on, by probe-file key.
 *
 * (a) is same-turn pickup and (b) is what a removal does to a live session.
 * `d-context-large` is NOT here: it answers Phase 3's question, not this one.
 */
export const REQUIRED_CELLS: Readonly<Record<string, readonly string[]>> = {
    'claude-code': ['a-same-turn-pickup-symlink', 'b-removed-skill-second-session'],
    codex: ['live-pickup-agents-skills'],
};

/** Probe file per host, relative to the package root. */
export const PROBE_FILES: Readonly<Record<string, string>> = {
    'claude-code': path.join('src', 'config', 'skill-lifecycle-probes.json'),
    codex: path.join('src', 'config', 'skill-lifecycle-probes-codex.json'),
};

function isRow(v: ProbeRow | string | undefined): v is ProbeRow {
    return typeof v === 'object' && v !== null && typeof (v as ProbeRow).state === 'string';
}

/**
 * Decide from already-loaded rows. Pure — no I/O, no clock beyond `now`.
 *
 * A host with no entry in {@link REQUIRED_CELLS} is denied: an unlisted host is
 * one nobody has decided about, and materialisation is not the safe default.
 */
export function materialisationEnabledFrom(
    host: string,
    rows: ProbeFile,
    now: Date = new Date(),
): GateVerdict {
    const required = REQUIRED_CELLS[host];
    if (required === undefined) {
        return { enabled: false, cells: [], reasons: [`host ${host} has no recorded materialisation cells`] };
    }
    const cells: GateVerdict['cells'] = [];
    const reasons: string[] = [];
    for (const id of required) {
        const row = rows[id];
        if (!isRow(row)) {
            cells.push({ id, state: 'missing', expired: false });
            reasons.push(`${id}: no row`);
            continue;
        }
        const expired = typeof row.expiry === 'string' && Date.parse(row.expiry) < now.getTime();
        cells.push({ id, state: row.state, expired });
        if (row.state !== 'observed-true') {
            reasons.push(`${id}: ${row.state}`);
        } else if (expired) {
            reasons.push(`${id}: observed-true but the row expired on ${row.expiry}`);
        }
    }
    return { enabled: reasons.length === 0, cells, reasons };
}

/** Read the host's probe file and decide. A missing or unreadable file denies. */
export function materialisationEnabled(
    host: string,
    packageRoot: string,
    now: Date = new Date(),
): GateVerdict {
    const rel = PROBE_FILES[host];
    if (rel === undefined) {
        return { enabled: false, cells: [], reasons: [`host ${host} has no probe file`] };
    }
    let rows: ProbeFile;
    try {
        rows = JSON.parse(fs.readFileSync(path.join(packageRoot, rel), 'utf-8')) as ProbeFile;
    } catch (e) {
        return { enabled: false, cells: [], reasons: [`probe file unreadable: ${String(e)}`] };
    }
    return materialisationEnabledFrom(host, rows, now);
}

/**
 * The host's observed pickup mechanism — what a materialiser may use to place
 * an entry, and the only one 0.2 observed.
 *
 * `symlink` for the first host. A copy is `unobserved` there, so no caller may
 * assume it, and the materialiser never uses one.
 */
export const PLACEMENT: Readonly<Record<string, 'symlink'>> = { 'claude-code': 'symlink' };

/**
 * Whether a caller must retry once on `Unknown skill` after placing an entry.
 *
 * 0.2 (a): one of two sessions missed the first call and launched on one retry —
 * the host's directory watcher races the write. Risk-register row 1.
 */
export const RETRY_ONCE_AFTER_PLACEMENT: ReadonlySet<string> = new Set(['claude-code']);

/**
 * The completeness reading the package promises — the blocker
 * `which-completeness-skills-owe`, resolved to (b) by ADR-289.
 *
 * Kept as a type rather than hard-coded to `reach` so {@link firstHostMaterialisation}
 * can be exercised for all three, which is what 4.6's verify asks for: a
 * decision test for EACH answer, not for the one that happened to win.
 */
export type CompletenessAnswer =
    /** (a) every skill installed on every host with native skills. */
    | 'presence'
    /** (b) every skill reachable in one deterministic step; presence per host. */
    | 'reach'
    /** (c) today's pack-scoped install, recorded as the promise. */
    | 'pack-scoped';

/** What Phase 5 read about materialisation's effect, if it has run. */
export type Phase5Reading = 'no-harm' | 'harm' | 'not-read';

export interface FirstHostDecision {
    materialises: boolean;
    reason: string;
}

/**
 * Step 4.6 — whether the FIRST host gets materialisation, or keeps the full
 * install.
 *
 * Two conditions, both required: the completeness answer must make presence
 * optional, and Phase 5 must have read no harm. Under (a) presence is the
 * promise, so there is nothing to materialise on demand — every skill is
 * already there. Under (c) the pack-scoped install IS the recorded promise, so
 * widening it on demand would quietly exceed what was promised rather than
 * fulfil it. Only (b) makes presence a per-host decision, which is what
 * materialisation needs to be legal at all.
 *
 * `not-read` is a wait and `harm` is a reading, and like the probe states
 * above neither is permission.
 */
export function firstHostMaterialisation(
    answer: CompletenessAnswer,
    phase5: Phase5Reading,
): FirstHostDecision {
    if (answer === 'presence') {
        return { materialises: false, reason: '(a) presence: every skill is installed, so nothing is materialised' };
    }
    if (answer === 'pack-scoped') {
        return { materialises: false, reason: '(c) pack-scoped: the install as it stands is the promise' };
    }
    if (phase5 !== 'no-harm') {
        return {
            materialises: false,
            reason:
                phase5 === 'harm'
                    ? '(b) reach: presence is optional, but Phase 5 read harm'
                    : '(b) reach: presence is optional, and Phase 5 has not read yet',
        };
    }
    return { materialises: true, reason: '(b) reach, and Phase 5 read no harm' };
}

/**
 * The answer on record: ADR-289 § Decision 2, AI council 2026-10-18 under the
 * owner's delegation of that day.
 */
export const RECORDED_COMPLETENESS_ANSWER: CompletenessAnswer = 'reach';
