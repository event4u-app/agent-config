/**
 * The obligation ledger — write side.
 *
 * This repository already knows which obligations it delivered into a turn.
 * `hooks/rule_inject_hook.ts` writes one record per session naming every rule
 * whose body it injected, and until now the only reads of that path were the
 * writer itself and its own test. The tree could say what it delivered and
 * nothing could ask whether the turn discharged any of it.
 *
 * This module is the state that closes that gap, and ONLY the state. It adds
 * no reader, no detector and no refusal — those arrive in later phases of
 * `road-to-a-ledger-that-closes-the-loop`, deliberately after the rows exist,
 * so that a detector is written against real recorded shapes instead of
 * against an imagined one.
 *
 * WHAT A `delivered` ROW MEANS, AND WHAT IT MAY NEVER BE CITED FOR.
 * A row records that an EMITTER RAN. It does not record that a rule reached
 * the model, and it may not be cited as evidence that one did. That question
 * is council-locked as blocked-by-architecture (2026-08-31, two convergent
 * seats) on a reproducible probe: an obligation present in the shipped tree
 * was absent from the operator's installed copy, so installation proves
 * availability and not exposure. The lock tested a different mechanism than
 * this one, which is why the write side is allowed at all — but a reader who
 * turns these rows into a compliance claim has made exactly the assertion the
 * council refused.
 *
 * WHY THE PATH COMES FROM A HELPER AND NOT A LITERAL.
 * `statePathFor` below is the same shape as `before_complete_hook.ts:128` —
 * `session_state_file(<dir>, session_id)` — and shares that function rather
 * than reimplementing it. The digest keying matters: it removes the
 * filename-length failure mode for long ids, and it is the property an
 * in-file `session_id` integrity check is written against. A second
 * hand-rolled sanitiser here would be a second shape, and two shapes for one
 * concept is how a session's state becomes unfindable by the tool meant to
 * read it.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
    atomic_write_json,
    is_replay_mode,
    session_state_file,
    update_json_under_lock,
} from '../hooks/state_io.js';
import { type EnforcementClass, is_enforcement_class } from './obligation_frequency.js';

/**
 * Directory holding one ledger file per session.
 *
 * Under `agents/runtime/state/`, which is gitignored and janitor-pruned, and
 * which carries a `disposition: excluded` row in
 * `src/config/continuity-surface.json` — this is per-session instrumentation,
 * not continuity state a later session must be able to resume from.
 */
export const OBLIGATION_STATE_DIR = path.join('agents', 'runtime', 'state', 'obligations');

/** Path of one session's ledger. Same shape as the existing consumer. */
export function statePathFor(session_id: string): string {
    return session_state_file(OBLIGATION_STATE_DIR, session_id);
}

/**
 * One rule delivered into this session, with the class its frontmatter declares.
 *
 * `cls` rather than `class` because `class` is a reserved word, and a field
 * named around a keyword is worse than a field named honestly. The serialised
 * key is `class`, which is what a reader of the JSON expects to see.
 */
export interface DeliveredRow {
    /** Rule id, as the injector names it. */
    readonly rule: string;
    /** Declared enforcement class, or `none` when the rule declares none. */
    readonly cls: EnforcementClass;
    /** ISO-8601, second precision. */
    readonly at: string;
}

/**
 * One obligation discharged this session.
 *
 * Written by the concern that ALREADY made the decision — the design-pass
 * concern knows the UI audit is fresh, so it is the only thing that can say so
 * without re-deriving a verdict it does not own. A discharge nobody observed
 * is never inferred: absence of a row means nothing was recorded, not that
 * nothing happened, and the shadow rows below are labelled accordingly.
 */
export interface DischargeRow {
    /** Rule id whose obligation this discharges. */
    readonly rule: string;
    /** What observed it — a concern name, so a reader can go and check. */
    readonly by: string;
    readonly at: string;
}

/**
 * One turn-end reading that WOULD have refused, had anything been armed.
 *
 * The whole point of the shadow phase: the detector runs, the verdict is
 * recorded, and nothing is refused. A row here is evidence about the
 * detector's behaviour, never about the turn's compliance.
 */
export interface ShadowRow {
    readonly at: string;
    /** The missing SET, as one row. Never one row per obligation — see `appendShadow`. */
    readonly missing: readonly string[];
    /** 1 for the first reading of a given missing set, incrementing after. */
    readonly attempt: number;
    /** Always true today: a row is only written when the detector would refuse. */
    readonly would_refuse: boolean;
}

/** The on-disk shape of one session's ledger. */
export interface ObligationLedger {
    /** Cheap integrity check against a copied or hand-edited file. */
    readonly session_id: string;
    readonly delivered: readonly DeliveredRow[];
    readonly discharged: readonly DischargeRow[];
    readonly shadow: readonly ShadowRow[];
}

/** The JSON spelling of a row — `class` on disk, `cls` in TypeScript. */
interface SerialisedRow {
    rule: string;
    class: string;
    at: string;
}

function serialise(row: DeliveredRow): SerialisedRow {
    return { rule: row.rule, class: row.cls, at: row.at };
}

/**
 * Read rows back out of whatever is on disk, discarding anything malformed.
 *
 * Deliberately lenient about the FILE and strict about the ROW. A truncated or
 * hand-edited ledger must not cost the rows that are still intact, and a row
 * whose class is outside the closed set must not enter the ledger wearing a
 * value the vocabulary denies — `is_enforcement_class` is the gate, so a
 * future widening of the schema cannot leak in through the state file.
 */
export function parseRows(loaded: unknown): DeliveredRow[] {
    if (typeof loaded !== 'object' || loaded === null) return [];
    const raw = (loaded as { delivered?: unknown }).delivered;
    if (!Array.isArray(raw)) return [];
    const out: DeliveredRow[] = [];
    for (const entry of raw) {
        if (typeof entry !== 'object' || entry === null) continue;
        const e = entry as Record<string, unknown>;
        const rule = e['rule'];
        const cls = e['class'];
        const at = e['at'];
        if (typeof rule !== 'string' || rule === '') continue;
        if (typeof at !== 'string' || at === '') continue;
        if (!is_enforcement_class(cls)) continue;
        out.push({ rule, cls, at });
    }
    return out;
}

/** ISO-8601 to second precision — the ledger has no use for milliseconds. */
export function stamp(now: Date = new Date()): string {
    return `${now.toISOString().slice(0, 19)}Z`;
}

/**
 * Append delivered rows for one session, idempotently per rule.
 *
 * Idempotent because the injector's own contract is once-per-session-per-rule
 * re-armed on compaction: after a compaction a rule is legitimately delivered
 * again, and a second row would say the same thing twice while a reader
 * counting distinct obligations wants it once. First delivery wins, so the
 * timestamp is the one that answers "when did this session first come under
 * this rule".
 *
 * Returns the number of rows actually added — 0 is a real answer (every rule
 * already recorded) and is not a failure.
 *
 * NEVER THROWS, and never fails a turn. A ledger that cannot be written is an
 * instrument that missed a reading; a turn refused because an instrument
 * missed a reading is a worse outcome than the missing reading, and this
 * module has no refusal to offer in the first place.
 */
export function appendDelivered(
    root: string,
    session_id: string,
    rows: readonly DeliveredRow[],
): number {
    if (rows.length === 0) return 0;
    if (is_replay_mode()) return 0;
    if (session_id.trim() === '') return 0;

    const target = path.join(root, statePathFor(session_id));
    let added = 0;
    try {
        update_json_under_lock<LedgerFile>(target, (loaded) => {
            const existing = parseRows(loaded);
            const seen = new Set(existing.map((r) => r.rule));
            const merged = existing.map(serialise);
            for (const row of rows) {
                if (seen.has(row.rule)) continue;
                seen.add(row.rule);
                merged.push(serialise(row));
                added += 1;
            }
            if (added === 0) return null; // deliberate no-write
            return { ...carryOver(loaded), session_id, delivered: merged };
        });
    } catch {
        return 0;
    }
    return added;
}

/** The on-disk file, as the lock's mutator sees it. */
interface LedgerFile {
    session_id: string;
    delivered: SerialisedRow[];
    discharged: DischargeRow[];
    shadow: ShadowRow[];
}

/**
 * The arrays this write is not touching, preserved verbatim.
 *
 * Three writers share one file and each owns one array. Without this, the
 * last writer of a turn silently truncates the other two — the kind of loss
 * that shows up as a detector reporting a clean turn because the discharges
 * it was meant to read were dropped by the delivery write that followed them.
 */
function carryOver(loaded: Partial<LedgerFile>): Pick<LedgerFile, 'discharged' | 'shadow'> {
    return {
        discharged: Array.isArray(loaded.discharged) ? loaded.discharged : [],
        shadow: Array.isArray(loaded.shadow) ? loaded.shadow : [],
    };
}

/**
 * Record that one concern observed an obligation discharged.
 *
 * Idempotent per (rule, by): the design-pass concern may fire many times in a
 * turn and the ledger wants the fact, not the frequency.
 */
export function appendDischarge(
    root: string,
    session_id: string,
    rows: readonly DischargeRow[],
): number {
    if (rows.length === 0) return 0;
    if (is_replay_mode()) return 0;
    if (session_id.trim() === '') return 0;

    const target = path.join(root, statePathFor(session_id));
    let added = 0;
    try {
        update_json_under_lock<LedgerFile>(target, (loaded) => {
            const existing = Array.isArray(loaded.discharged) ? loaded.discharged : [];
            const key = (r: DischargeRow): string => `${r.rule}::${r.by}`;
            const seen = new Set(existing.map(key));
            const merged = [...existing];
            for (const row of rows) {
                if (seen.has(key(row))) continue;
                seen.add(key(row));
                merged.push(row);
                added += 1;
            }
            if (added === 0) return null;
            return {
                session_id,
                delivered: parseRows(loaded).map(serialise),
                discharged: merged,
                shadow: Array.isArray(loaded.shadow) ? loaded.shadow : [],
            };
        });
    } catch {
        return 0;
    }
    return added;
}

/** Rules discharged this session, by rule id. */
export function readDischarged(root: string, session_id: string): DischargeRow[] {
    const file = readLedgerFile(root, session_id);
    if (file === null) return [];
    return Array.isArray(file.discharged) ? file.discharged : [];
}

/** Shadow readings recorded this session. */
export function readShadow(root: string, session_id: string): ShadowRow[] {
    const file = readLedgerFile(root, session_id);
    if (file === null) return [];
    return Array.isArray(file.shadow) ? file.shadow : [];
}

/**
 * Record one would-refuse reading — ONE ROW PER MISSING SET, never per obligation.
 *
 * The aggregation is the contract, not an optimisation. Five missing
 * obligations are one reading of one turn, and emitting five rows would let a
 * later count of "refusals" read five times the truth while every one of them
 * described the same moment.
 *
 * `attempt` increments when the SAME missing set is seen again. An unchanged
 * set on a second reading is the signal that nothing moved — the caller uses
 * it to stop forcing continuation, and it is recorded here so that decision is
 * auditable rather than re-derived.
 *
 * Returns the attempt number written, or 0 when nothing was written.
 */
export function appendShadow(
    root: string,
    session_id: string,
    missing: readonly string[],
    now: string = stamp(),
): number {
    if (missing.length === 0) return 0;
    if (is_replay_mode()) return 0;
    if (session_id.trim() === '') return 0;

    const fingerprint = [...missing].sort().join('::');
    const target = path.join(root, statePathFor(session_id));
    let attempt = 0;
    try {
        update_json_under_lock<LedgerFile>(target, (loaded) => {
            const existing = Array.isArray(loaded.shadow) ? loaded.shadow : [];
            const prior = existing.filter(
                (r) => [...(r.missing ?? [])].sort().join('::') === fingerprint,
            );
            attempt = prior.length + 1;
            return {
                session_id,
                delivered: parseRows(loaded).map(serialise),
                discharged: Array.isArray(loaded.discharged) ? loaded.discharged : [],
                shadow: [
                    ...existing,
                    { at: now, missing: [...missing], attempt, would_refuse: true },
                ],
            };
        });
    } catch {
        return 0;
    }
    return attempt;
}

/** The whole file for one session, or `null` when it is absent or not ours. */
function readLedgerFile(root: string, session_id: string): Partial<LedgerFile> | null {
    if (session_id.trim() === '') return null;
    const target = path.join(root, statePathFor(session_id));
    try {
        const decoded: unknown = JSON.parse(fs.readFileSync(target, 'utf-8'));
        if (typeof decoded !== 'object' || decoded === null) return null;
        if ((decoded as { session_id?: unknown }).session_id !== session_id) return null;
        return decoded as Partial<LedgerFile>;
    } catch {
        return null;
    }
}

/**
 * Rows recorded for one session, or `[]` when there are none to read.
 *
 * A file carrying somebody else's `session_id` reads as empty rather than as
 * that session's rows — a copy, a restore or a hand-edit must not be able to
 * attribute one session's deliveries to another. The producer side repairs
 * the same case by rewriting the id; the consumer side refuses it. Both halves
 * are needed, as `hooks/state_io.ts` § Per-session concern state states for
 * the two concerns that got here first.
 */
export function readDelivered(root: string, session_id: string): DeliveredRow[] {
    if (session_id.trim() === '') return [];
    const target = path.join(root, statePathFor(session_id));
    try {
        const decoded: unknown = JSON.parse(fs.readFileSync(target, 'utf-8'));
        if (typeof decoded !== 'object' || decoded === null) return [];
        if ((decoded as { session_id?: unknown }).session_id !== session_id) return [];
        return parseRows(decoded);
    } catch {
        return [];
    }
}

/**
 * Whether the ledger directory can be written — the doctor's readiness line.
 *
 * Probes by writing and removing a sentinel rather than by checking mode bits,
 * because the modes that matter here (a read-only mount, a directory owned by
 * another user, a full disk) are not all visible in a `stat`. Returns `false`
 * rather than throwing: the doctor reports, it does not fail.
 */
export function ledgerWritable(root: string): boolean {
    if (is_replay_mode()) return false;
    const probe = path.join(root, OBLIGATION_STATE_DIR, '.writable-probe.json');
    try {
        atomic_write_json(probe, { probe: true });
        fs.rmSync(probe, { force: true });
        return true;
    } catch {
        return false;
    }
}
