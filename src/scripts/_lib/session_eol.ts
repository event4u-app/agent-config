/**
 * Session end-of-life scanner (road-to-token-economy-recycling Phase 1).
 *
 * Pure counting over Claude Code transcript JSONL: per session, the FINAL
 * main-chain context size in parsed tokens, the turn count, and every
 * compaction event — the three numbers the recycle roadmap's baseline and
 * threshold are built from. Token math delegates to `cc_transcript.ts`
 * (`billableInputTokens` — input + cache_read + cache_creation); this module
 * adds no second token definition ("no new parser", roadmap prerequisite).
 *
 * Compaction detector — pinned to OBSERVED reality (blocker
 * `compaction-marker-shape`): a real auto-compaction recorded 2026-08-06 on
 * host v2.1.222 writes TWO markers into the transcript:
 *
 *   1. `{"type":"system","subtype":"compact_boundary","compactMetadata":
 *      {"trigger":"auto","preTokens":1000410,"postTokens":15870,...}}`
 *   2. a `{"type":"user","isCompactSummary":true,...}` record carrying the
 *      summary the session was restarted from.
 *
 * The fixture in `tests/scripts/_lib_session_eol.test.ts` freezes both
 * shapes. Never-silent discipline: the scanner counts BOTH markers
 * independently — `compactions[]` from the boundary records,
 * `compact_summaries` from the summary records. A host update that changes
 * one shape but not the other makes the two counters diverge, which the
 * report surfaces as marker drift instead of silently zeroing the metric.
 *
 * Incremental by design: the Stop-slot carrier re-runs every turn, so
 * `scanEolSlice` accepts prior counters and only the newly appended complete
 * lines (`readNewCompleteLines`). A full rescan is only ever the bounded
 * 50 MB `isSafeTranscriptPath` cap away.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { billableInputTokens } from './cc_transcript.js';

/** The observed compaction boundary marker (host v2.1.222, 2026-08-06). */
export const COMPACT_BOUNDARY_SUBTYPE = 'compact_boundary';

/** One compaction event, read from a `compact_boundary` system record. */
export interface CompactionEvent {
    /** `"auto"` observed; the field is host territory — kept as an open string. */
    trigger: string;
    /** Context tokens immediately before compaction (`compactMetadata.preTokens`). */
    pre_tokens: number | null;
    /** Context tokens immediately after (`compactMetadata.postTokens`). */
    post_tokens: number | null;
    timestamp: string | null;
}

/** Accumulated per-session end-of-life counters. Counts and refs only — never content. */
export interface EolCounters {
    schema_version: 1;
    /** Byte offset up to which the transcript has been consumed (end of last complete line). */
    scanned_bytes: number;
    /** External user prompts on the main chain (excl. meta / compact-summary records). */
    turns: number;
    /** Main-chain assistant records carrying a `usage` block. */
    assistant_records: number;
    /**
     * Main-chain assistant records carrying at least one `tool_use` content
     * block. Added after the initial schema, so a state file written before
     * it is missing the key — readers MUST treat `undefined` as *unknown*,
     * never as zero (`is_substantive` in `_cli/handoff_sessions.ts` does).
     */
    tool_calls: number;
    /** Billable input tokens of the LAST main-chain assistant record — the fill level. */
    final_context_tokens: number | null;
    /** `timestamp` of that record. */
    final_context_at: string | null;
    /** Every `compact_boundary` event seen, in order. */
    compactions: CompactionEvent[];
    /** `isCompactSummary` user records seen — the drift twin of `compactions`. */
    compact_summaries: number;
    /** Lines that failed `JSON.parse`. */
    bad_lines: number;
}

export function emptyCounters(): EolCounters {
    return {
        schema_version: 1,
        scanned_bytes: 0,
        turns: 0,
        assistant_records: 0,
        tool_calls: 0,
        final_context_tokens: null,
        final_context_at: null,
        compactions: [],
        compact_summaries: 0,
        bad_lines: 0,
    };
}

function numOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numOr0(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Detect the observed compaction boundary marker on one parsed record.
 * Returns the event, or `null` for every other record shape.
 */
export function detectCompaction(record: Record<string, unknown>): CompactionEvent | null {
    if (record['type'] !== 'system' || record['subtype'] !== COMPACT_BOUNDARY_SUBTYPE) {
        return null;
    }
    const md = (record['compactMetadata'] ?? {}) as Record<string, unknown>;
    return {
        trigger: typeof md['trigger'] === 'string' ? md['trigger'] : 'unknown',
        pre_tokens: numOrNull(md['preTokens']),
        post_tokens: numOrNull(md['postTokens']),
        timestamp: typeof record['timestamp'] === 'string' ? record['timestamp'] : null,
    };
}

/** True for a main-chain external user PROMPT record (a turn), per the baseline heuristic. */
function isTurnRecord(record: Record<string, unknown>): boolean {
    if (record['type'] !== 'user') return false;
    if (record['isCompactSummary'] === true || record['isMeta'] === true) return false;
    const message = record['message'];
    if (typeof message !== 'object' || message === null) return false;
    const content = (message as Record<string, unknown>)['content'];
    if (typeof content === 'string') return content.trim().length > 0;
    if (Array.isArray(content)) {
        return content.some(
            (b) => typeof b === 'object' && b !== null && (b as Record<string, unknown>)['type'] === 'text',
        );
    }
    return false;
}

/**
 * Fold newly appended COMPLETE transcript lines into the counters. Pure —
 * returns a new counters object; `scanned_bytes` is the caller's business
 * (it knows the byte offsets, this function only sees text).
 */
export function scanEolSlice(text: string, prior: EolCounters): EolCounters {
    const next: EolCounters = {
        ...prior,
        compactions: [...prior.compactions],
    };
    for (const line of text.split('\n')) {
        if (line.trim().length === 0) continue;
        let record: Record<string, unknown>;
        try {
            const parsed = JSON.parse(line) as unknown;
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                next.bad_lines += 1;
                continue;
            }
            record = parsed as Record<string, unknown>;
        } catch {
            next.bad_lines += 1;
            continue;
        }
        if (record['isSidechain'] === true) continue; // subagent legs are not this session's context

        const compaction = detectCompaction(record);
        if (compaction) {
            next.compactions.push(compaction);
            continue;
        }
        if (record['type'] === 'user' && record['isCompactSummary'] === true) {
            next.compact_summaries += 1;
            continue;
        }
        if (isTurnRecord(record)) {
            next.turns += 1;
            continue;
        }
        if (record['type'] === 'assistant') {
            const message = record['message'];
            const content =
                typeof message === 'object' && message !== null
                    ? (message as Record<string, unknown>)['content']
                    : undefined;
            if (
                Array.isArray(content) &&
                content.some(
                    (b) =>
                        typeof b === 'object' &&
                        b !== null &&
                        (b as Record<string, unknown>)['type'] === 'tool_use',
                )
            ) {
                next.tool_calls += 1;
            }
            const usage =
                typeof message === 'object' && message !== null
                    ? ((message as Record<string, unknown>)['usage'] as Record<string, unknown> | undefined)
                    : undefined;
            if (typeof usage === 'object' && usage !== null && usage['input_tokens'] !== undefined) {
                next.assistant_records += 1;
                next.final_context_tokens = billableInputTokens({
                    input_tokens: numOr0(usage['input_tokens']),
                    cache_read_input_tokens: numOr0(usage['cache_read_input_tokens']),
                    cache_creation_input_tokens: numOr0(usage['cache_creation_input_tokens']),
                });
                next.final_context_at =
                    typeof record['timestamp'] === 'string' ? record['timestamp'] : null;
            }
        }
    }
    return next;
}

// ---------------------------------------------------------------------
// State location — one derivation, shared by the writer (the Stop-slot
// concern) and every reader (`agent-config handoff`).
// ---------------------------------------------------------------------

/** Directory holding the per-session counts-only state files. */
export function eolStateDir(workspaceRoot: string): string {
    return path.join(workspaceRoot, 'agents', 'runtime', 'state', 'session-eol');
}

/** Absolute path of one session's state file. */
export function eolStateFile(workspaceRoot: string, sessionKey: string): string {
    return path.join(eolStateDir(workspaceRoot), `${sessionKey}.json`);
}

/**
 * The state-file key for a session: sha256 of the raw session id, or of the
 * transcript path when no id is known. Hashed, never raw — the filename must
 * not carry an identifier.
 */
export function eolSessionKey(raw: string | null | undefined): string {
    return crypto.createHash('sha256').update(raw || 'unknown-session').digest('hex');
}

/**
 * Counters as they come off DISK. `tool_calls` is optional here and required
 * in `EolCounters` on purpose: a file written before that counter existed
 * carries no key, and "the writer never counted" must stay distinguishable
 * from "the writer counted zero".
 */
export type StoredEolCounters = Omit<EolCounters, 'tool_calls'> & { tool_calls?: number };

/**
 * Read one session's counters. Returns `null` for absent, unreadable, or
 * mis-shaped state — the caller decides what that means, and every current
 * caller fails OPEN (a wrongly listed session is noise; a wrongly hidden one
 * is data loss).
 */
export function readEolCounters(
    workspaceRoot: string,
    sessionKey: string,
): StoredEolCounters | null {
    try {
        const raw = fs.readFileSync(eolStateFile(workspaceRoot, sessionKey), 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const counters = parsed['counters'];
        if (typeof counters !== 'object' || counters === null || Array.isArray(counters)) {
            return null;
        }
        return counters as StoredEolCounters;
    } catch {
        return null;
    }
}

export interface NewLinesRead {
    /** The complete lines appended since `fromByte` (possibly empty). */
    text: string;
    /** The offset to persist — end of the last complete line consumed. */
    nextOffset: number;
    /** True when the file shrank below `fromByte` (rotation/truncation) — caller rescans from 0. */
    truncated: boolean;
}

/**
 * Read the bytes appended to `filePath` since `fromByte`, trimmed to the
 * last complete line (a JSONL writer may be mid-line). Never throws — any
 * fs error reads as "nothing new".
 */
export function readNewCompleteLines(filePath: string, fromByte: number): NewLinesRead {
    try {
        const { size } = fs.statSync(filePath);
        if (size < fromByte) {
            return { text: '', nextOffset: 0, truncated: true };
        }
        if (size === fromByte) {
            return { text: '', nextOffset: fromByte, truncated: false };
        }
        const length = size - fromByte;
        const buffer = Buffer.alloc(length);
        const fd = fs.openSync(filePath, 'r');
        try {
            fs.readSync(fd, buffer, 0, length, fromByte);
        } finally {
            fs.closeSync(fd);
        }
        const lastNewline = buffer.lastIndexOf(0x0a);
        if (lastNewline === -1) {
            return { text: '', nextOffset: fromByte, truncated: false };
        }
        return {
            text: buffer.subarray(0, lastNewline + 1).toString('utf-8'),
            nextOffset: fromByte + lastNewline + 1,
            truncated: false,
        };
    } catch {
        return { text: '', nextOffset: fromByte, truncated: false };
    }
}
