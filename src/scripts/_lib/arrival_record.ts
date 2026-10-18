/**
 * The per-session arrival record: which instruction files the host loaded, and
 * why, built from the `InstructionsLoaded` observer's lines.
 *
 * It is the observable predicate of the activation ladder's `visible` rung for
 * standing rules — no new state vocabulary. A record is `visible` only when
 * every line of its session reads cleanly; any anomaly makes the whole record
 * `unknown`, which the layer-form decision reads as "no arrival record", so a
 * doubtful session can only ever keep a machine full.
 *
 * Anomalies, each of which yields `unknown` rather than an arrival:
 *   · no line for the session — the host did not send the event;
 *   · a line the observer could not classify — a malformed payload;
 *   · the same file loaded twice for the same reason — a duplicate call;
 *   · no `session_start` load at all — the start-up events were lost;
 *   · more than one host version within one session.
 *
 * ORDER IS NOT EVIDENCE, IN EITHER DIRECTION. The host runs these hooks
 * asynchronously and in parallel, so the order lines reach disk is the
 * scheduler's, not the host's. The record is therefore built as a set: a
 * reordered sequence yields exactly the record the ordered one does, and no
 * ordering can create an arrival the set does not contain.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { ActivationReceipt } from './activation_ladder.js';
import type { ArrivalEvidence } from './layer_form_decision.js';
import { isSessionFile, type CaptureLine } from './instructions_loaded_event.js';
import {
    LOAD_REASONS,
    classifyCapture,
    type LoadReason,
    type LoadedLine,
    type ObserverLine,
} from './instructions_loaded_classify.js';

export type ArrivalUnknownReason =
    | 'event-unavailable'
    | 'malformed'
    | 'duplicate-events'
    | 'no-session-start'
    | 'host-version-mixed';

export interface ArrivalFile {
    readonly file: string;
    readonly kind: LoadedLine['kind'];
    readonly scope: LoadedLine['scope'];
    readonly reason: LoadReason;
}

export interface ArrivalRecord {
    readonly v: 1;
    readonly session: string;
    readonly host_version: string | null;
    readonly launch: string | null;
    /** Every line was written by a concern the dispatcher ran, so any line means it was reached. */
    readonly dispatcher_reached: boolean;
    readonly status: 'visible' | 'unknown';
    readonly unknown_reason: ArrivalUnknownReason | null;
    readonly files: readonly ArrivalFile[];
    readonly counts: { readonly loaded: number; readonly unknown: number; readonly duplicates: number };
}

/** Parse every session file under the observer directory; lines that are not observer lines are dropped. */
export function readObserverLines(dir: string): ObserverLine[] {
    let names: string[] = [];
    try {
        names = fs.readdirSync(dir).filter(isSessionFile);
    } catch {
        return [];
    }
    const out: ObserverLine[] = [];
    for (const f of names) {
        let text = '';
        try {
            text = fs.readFileSync(path.join(dir, f), 'utf8');
        } catch {
            // Pruned between the listing and the read; the other sessions still count.
            continue;
        }
        for (const raw of text.split('\n')) {
            if (!raw.trim()) continue;
            try {
                const o = JSON.parse(raw) as CaptureLine;
                if (o && o.v === 2) out.push(classifyCapture(o));
            } catch {
                // A torn line is skipped; it carries no session to attribute it to.
            }
        }
    }
    return out;
}

/** Build one session's record. `lines` may hold every session; only `session`'s are read. */
export function buildArrivalRecord(lines: readonly ObserverLine[], session: string): ArrivalRecord {
    const mine = lines.filter((l) => l.session === session);
    const loaded = mine.filter((l): l is LoadedLine => l.event === 'loaded');
    const unknownCount = mine.length - loaded.length;
    const seen = new Set<string>();
    let duplicates = 0;
    const files: ArrivalFile[] = [];
    for (const l of loaded) {
        const key = `${l.scope}:${l.file}:${l.reason}`;
        if (seen.has(key)) {
            duplicates += 1;
            continue;
        }
        seen.add(key);
        files.push({ file: l.file, kind: l.kind, scope: l.scope, reason: l.reason });
    }
    const versions = new Set(mine.map((l) => l.host_version));
    let reason: ArrivalUnknownReason | null = null;
    if (mine.length === 0) reason = 'event-unavailable';
    else if (unknownCount > 0) reason = 'malformed';
    else if (duplicates > 0) reason = 'duplicate-events';
    else if (versions.size > 1) reason = 'host-version-mixed';
    else if (!loaded.some((l) => l.reason === 'session_start')) reason = 'no-session-start';
    return {
        v: 1,
        session,
        host_version: mine[0]?.host_version ?? null,
        launch: mine[0]?.launch ?? null,
        dispatcher_reached: mine.length > 0,
        status: reason === null ? 'visible' : 'unknown',
        unknown_reason: reason,
        files,
        counts: { loaded: loaded.length, unknown: unknownCount, duplicates },
    };
}

/** The record of the most recent session in the file, or `null` when the file holds none. */
export function latestArrivalRecord(lines: readonly ObserverLine[]): ArrivalRecord | null {
    let latest: ObserverLine | null = null;
    for (const l of lines) {
        if (l.session === null) continue;
        if (latest === null || l.ts >= latest.ts) latest = l;
    }
    return latest?.session ? buildArrivalRecord(lines, latest.session) : null;
}

const RECORD_KEYS = ['v', 'session', 'host_version', 'launch', 'dispatcher_reached', 'status', 'unknown_reason', 'files', 'counts'];
const FILE_KEYS = ['file', 'kind', 'scope', 'reason'];
const COUNT_KEYS = ['loaded', 'unknown', 'duplicates'];
const NAME_RE = /^[A-Za-z0-9._-]{1,128}$/;

function extraKeys(o: Record<string, unknown>, allowed: readonly string[], at: string): string[] {
    return Object.keys(o).filter((k) => !allowed.includes(k)).map((k) => `${at}: field \`${k}\` is not part of the record`);
}

/**
 * Validate a record against its closed shape. A field the shape does not name —
 * a body, a prompt, a path — is an error, because the record exists to carry
 * names, counts and enums and nothing a host could fill with content.
 */
export function validateArrivalRecord(value: unknown): string[] {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return ['record is not an object'];
    const o = value as Record<string, unknown>;
    const errs = extraKeys(o, RECORD_KEYS, 'record');
    if (o['v'] !== 1) errs.push('record: `v` must be 1');
    if (typeof o['session'] !== 'string' || !NAME_RE.test(o['session'])) errs.push('record: `session` must be an id');
    if (o['status'] !== 'visible' && o['status'] !== 'unknown') errs.push('record: `status` must be visible or unknown');
    if (!Array.isArray(o['files'])) errs.push('record: `files` must be an array');
    else {
        for (const [i, f] of (o['files'] as unknown[]).entries()) {
            if (typeof f !== 'object' || f === null) {
                errs.push(`files[${String(i)}]: not an object`);
                continue;
            }
            const fo = f as Record<string, unknown>;
            errs.push(...extraKeys(fo, FILE_KEYS, `files[${String(i)}]`));
            if (typeof fo['file'] !== 'string' || !NAME_RE.test(fo['file'])) errs.push(`files[${String(i)}]: \`file\` must be a basename`);
            if (!(LOAD_REASONS as readonly unknown[]).includes(fo['reason'])) errs.push(`files[${String(i)}]: unknown \`reason\``);
        }
    }
    const c = o['counts'];
    if (typeof c !== 'object' || c === null) errs.push('record: `counts` must be an object');
    else errs.push(...extraKeys(c as Record<string, unknown>, COUNT_KEYS, 'counts'));
    return errs;
}

/** User-scope rule files loaded at session start, by rule id. */
function startupRuleIds(record: ArrivalRecord): Set<string> {
    return new Set(
        record.files
            .filter((f) => f.kind === 'rule' && f.scope === 'user' && f.reason === 'session_start')
            .map((f) => f.file.replace(/\.md$/, '')),
    );
}

/**
 * What the layer-form decision needs from a record, or `null` when the record
 * cannot serve as evidence. `standingLaws` is the rule-id set that must have
 * loaded at session start — the consequence class.
 */
export function arrivalEvidence(record: ArrivalRecord | null, standingLaws: ReadonlySet<string>): ArrivalEvidence | null {
    if (record === null || record.status !== 'visible' || record.host_version === null) return null;
    const loaded = startupRuleIds(record);
    return {
        hostVersion: record.host_version,
        stubsLoaded: loaded.size > 0,
        standingLawsLoaded: [...standingLaws].every((id) => loaded.has(id)),
    };
}

/** Map a record onto the ladder's `visible` rung, one receipt per expected rule. */
export function arrivalReceipts(record: ArrivalRecord, expected: readonly string[]): ActivationReceipt[] {
    const loaded = startupRuleIds(record);
    return expected.map((id) => ({
        artefact: id,
        rungs: record.status === 'visible' ? { visible: loaded.has(id) ? 'reached' : 'not-reached' } : {},
    }));
}

export function arrivalsDirUnder(runtimeRoot: string): string {
    return path.join(runtimeRoot, 'arrivals');
}
