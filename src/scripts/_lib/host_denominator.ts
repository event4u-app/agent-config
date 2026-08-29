/**
 * The host-emitted-event denominator — a typed, privacy-bounded count
 * reconstructed from a HOST-authored artefact.
 *
 * `road-to-journal-host-capture-measurement` Phase 2 step 2.1 and AC-2. The
 * survey of step 1.1
 * (`agents/evidence/analysis/host-denominator-obtainability-2026-08-29.md`)
 * established that exactly six `(platform, event)` cells carry an obtainable
 * host denominator, all on `claude`, all reconstructable from the per-session
 * transcript Claude Code writes at
 * `~/.claude/projects/<project-slug>/<session-id>.jsonl`.
 *
 * ## Why this module exists rather than a one-off script
 *
 * AC-2 requires the denominator's record type to be *asserted against a
 * committed key set, with a free-form write failing to type-check* — the same
 * privacy property `_lib/runtime_journal.ts` carries for the numerator. A
 * denominator computed inline in a script has no record type to assert, so the
 * two halves of the capture rate would have been held to different standards.
 * They are held to the same one here: {@link DENOMINATOR_RECORD_KEYS} is bound
 * to {@link HostDenominator} in both directions, and the record is passed
 * through the journal's own {@link NoFreeForm} guard rather than a local copy
 * of it.
 *
 * ## The reconstruction is a stated rule set, not a heuristic
 *
 * {@link RECONSTRUCTION_RULE_VERSION} pins the rules, and the pinning matters:
 * a denominator whose derivation can be adjusted after the numerator is known
 * is not a denominator. The four rules are the survey's own, carried verbatim,
 * plus two refinements that are named rather than folded in silently — see
 * {@link RECONSTRUCTION_RULES}.
 *
 * ## What this module refuses to count, and why that is the interesting half
 *
 * `stop` is journal-bound on `claude` and would widen the measurement from
 * five journal-bound cells to six. Three candidate denominators for it were
 * examined and **all three are refused**; {@link STOP_CANDIDATES} records them
 * with the reading that refuses each. A `stop` denominator chosen from among
 * three mutually inconsistent candidates would be a number with a footnote
 * where the footnote is load-bearing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

import type { NoFreeForm } from './runtime_journal.js';

type Assert<T extends true> = T;

/**
 * Bumped whenever any rule in {@link RECONSTRUCTION_RULES} changes. A published
 * rate cites this number, so a later reader can tell a re-measurement from a
 * re-derivation.
 */
export const RECONSTRUCTION_RULE_VERSION = 1;

/**
 * The six `(claude, event)` cells the 1.1 survey found `counted`. This is the
 * measurement's scope and no more: a rate over six of 43 bound cells is a
 * different claim from a rate over all of them.
 */
export const COUNTED_EVENTS = [
    'session_start',
    'user_prompt_submit',
    'pre_tool_use',
    'post_tool_use',
    'subagent_start',
    'subagent_stop',
] as const;

export type CountedEvent = (typeof COUNTED_EVENTS)[number];

/**
 * Of the six, the five where `journal-record` is actually bound in
 * `src/scripts/hook_manifest.yaml` on the `claude` platform.
 *
 * `pre_tool_use` is the omission and it is deliberate rather than an oversight
 * to be corrected here: that slot carries the safety guards, and the journal is
 * not among them. Its numerator is therefore zero **by construction**, which is
 * a different fact from zero-because-nothing-fired, and the published table
 * separates the two instead of averaging them into one rate.
 */
export const JOURNAL_BOUND_COUNTED_EVENTS = [
    'session_start',
    'user_prompt_submit',
    'post_tool_use',
    'subagent_start',
    'subagent_stop',
] as const;

type _BoundIsSubsetOfCounted = Assert<
    Exclude<(typeof JOURNAL_BOUND_COUNTED_EVENTS)[number], CountedEvent> extends never ? true : false
>;

/** Human-readable statement of every rule the reconstruction applies. */
export const RECONSTRUCTION_RULES: Readonly<Record<string, string>> = Object.freeze({
    session_start:
        'One per transcript file. A transcript exists if and only if a session started.',
    user_prompt_submit:
        'A `type: "user"` record carrying no `tool_result` content block. REFINEMENT 1: records with `isMeta: true` are excluded — an injected system reminder is not a user prompt submit. REFINEMENT 2: records with `isSidechain: true` are excluded — a subagent prompt does not fire the host event in the parent session.',
    pre_tool_use: 'One per `tool_use` content block in a `type: "assistant"` record.',
    post_tool_use: 'One per `tool_use` content block in a `type: "assistant"` record.',
    subagent_start:
        'One per `tool_use` content block whose `name` is `Agent` or `Task`. A subset of the tool_use blocks, and a distinct host event.',
    subagent_stop:
        'One per `tool_use` content block whose `name` is `Agent` or `Task`.',
});

/**
 * The three refused candidates for a `stop` denominator, each with the reading
 * that refuses it. Kept in code rather than only in prose so a later attempt
 * meets the measurement before it meets the idea.
 *
 * All three readings are from one transcript,
 * `b818ccad-3581-4773-b9a2-c7272af04ce2`, and they disagree by a factor of 40.
 */
export const STOP_CANDIDATES: readonly Readonly<{
    candidate: string;
    reading: number;
    refused_because: string;
}>[] = Object.freeze([
    Object.freeze({
        candidate: 'assistant records carrying a `stop_reason`',
        reading: 305,
        refused_because:
            'counts assistant MESSAGES, not turn completions — every one read `stop_reason: "tool_use"` and none `end_turn`, so it over-counts by about two orders of magnitude (the 1.1 survey established this).',
    }),
    Object.freeze({
        candidate: '`type: "last-prompt"` records',
        reading: 95,
        refused_because:
            'written once per assistant leaf and repeating the SAME prompt text, so it is a per-turn marker whose mapping onto the `stop` hook event is unverified rather than a published count.',
    }),
    Object.freeze({
        candidate: '`hookInfos` entries whose command carries `--event stop`',
        reading: 7,
        refused_because:
            'host-authored and event-named — the strongest of the three — but it appears on only 7 of about 95 turns in the same session, so the host records these entries selectively (they co-occur with `hookAdditionalContext` / `preventedContinuation`) and the artefact UNDER-counts dispatches.',
    }),
]);

/**
 * One denominator reading. These fields and no others.
 *
 * Every field is a bounded scalar: a count, an ISO calendar date, or the one
 * platform literal the survey found countable. Nothing here can hold a path, a
 * project name, a session id, a prompt, or a tool name — the same property the
 * numerator's record carries, asserted the same way.
 */
export interface HostDenominator {
    /** The only platform with an obtainable host denominator (1.1 survey). */
    platform: 'claude';
    /** Which rule set produced the counts. See {@link RECONSTRUCTION_RULE_VERSION}. */
    reconstruction_rule_version: number;
    /** Inclusive window start, ISO calendar date (`YYYY-MM-DD`). */
    window_start: string;
    /** Inclusive window end, ISO calendar date (`YYYY-MM-DD`). */
    window_end: string;
    /** Transcripts found on the measured machine, before windowing. */
    transcripts_found: number;
    /** Transcripts whose first timestamped record falls inside the window. */
    sessions_in_window: number;
    /** Transcripts excluded because their first record predates the window. */
    sessions_before_window: number;
    /** Transcripts carrying no parseable timestamped record at all. */
    sessions_undatable: number;
    session_start: number;
    user_prompt_submit: number;
    pre_tool_use: number;
    post_tool_use: number;
    subagent_start: number;
    subagent_stop: number;
    /** `user` records excluded by refinement 1 (`isMeta`). Audit trail. */
    excluded_meta_user_records: number;
    /** `user` records excluded by refinement 2 (`isSidechain`). Audit trail. */
    excluded_sidechain_user_records: number;
}

/** The committed key set. AC-2 asserts the record's keys against exactly this. */
export const DENOMINATOR_RECORD_KEYS = Object.freeze([
    'platform',
    'reconstruction_rule_version',
    'window_start',
    'window_end',
    'transcripts_found',
    'sessions_in_window',
    'sessions_before_window',
    'sessions_undatable',
    'session_start',
    'user_prompt_submit',
    'pre_tool_use',
    'post_tool_use',
    'subagent_start',
    'subagent_stop',
    'excluded_meta_user_records',
    'excluded_sidechain_user_records',
] as const);

type _KeysCoverTheRecord = Assert<
    Exclude<keyof HostDenominator, (typeof DENOMINATOR_RECORD_KEYS)[number]> extends never
        ? true
        : false
>;
type _KeysAddNothing = Assert<
    Exclude<(typeof DENOMINATOR_RECORD_KEYS)[number], keyof HostDenominator> extends never
        ? true
        : false
>;
/**
 * Fails to compile if {@link HostDenominator} ever grows a key from the
 * journal's `FREE_FORM_KEYS` — the numerator's guard, reused rather than
 * re-implemented, so the two halves cannot drift apart. The list itself is not
 * imported as a value here: only the type-level guard is needed, and the test
 * asserts the runtime mirror against the journal's own export directly.
 */
type _RecordCarriesNoFreeFormField = Assert<
    [NoFreeForm<HostDenominator>] extends [never] ? false : true
>;

/** Raised when a record is handed to {@link validateDenominator} and fails it. */
export class DenominatorContractError extends Error {}

/**
 * Runtime half of the schema guard: an unknown key is **REJECTED, not
 * dropped**, on the same reasoning `_lib/collector_record.ts` states — a
 * producer whose extra field is silently discarded has been told the field is
 * fine, and the leak then lives upstream where this schema cannot see it.
 */
export function validateDenominator(record: Record<string, unknown>): HostDenominator {
    const allowed = new Set<string>(DENOMINATOR_RECORD_KEYS);
    for (const key of Object.keys(record)) {
        if (!allowed.has(key)) {
            throw new DenominatorContractError(`unknown field '${key}' — REJECTED, not dropped`);
        }
    }
    for (const key of DENOMINATOR_RECORD_KEYS) {
        if (!(key in record)) {
            throw new DenominatorContractError(`missing field '${key}'`);
        }
    }
    if (record.platform !== 'claude') {
        throw new DenominatorContractError(
            `platform must be 'claude' — the only cell set with an obtainable host denominator`,
        );
    }
    for (const key of DENOMINATOR_RECORD_KEYS) {
        if (key === 'platform' || key === 'window_start' || key === 'window_end') continue;
        const value = record[key];
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            throw new DenominatorContractError(`field '${key}' must be a non-negative integer`);
        }
    }
    for (const key of ['window_start', 'window_end'] as const) {
        const value = record[key];
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new DenominatorContractError(
                `field '${key}' must be an ISO calendar date (YYYY-MM-DD) — a per-second timestamp beside a session count reconstructs working hours`,
            );
        }
    }
    return record as unknown as HostDenominator;
}

/** A zeroed record for the given window. */
export function emptyDenominator(windowStart: string, windowEnd: string): HostDenominator {
    return validateDenominator({
        platform: 'claude',
        reconstruction_rule_version: RECONSTRUCTION_RULE_VERSION,
        window_start: windowStart,
        window_end: windowEnd,
        transcripts_found: 0,
        sessions_in_window: 0,
        sessions_before_window: 0,
        sessions_undatable: 0,
        session_start: 0,
        user_prompt_submit: 0,
        pre_tool_use: 0,
        post_tool_use: 0,
        subagent_start: 0,
        subagent_stop: 0,
        excluded_meta_user_records: 0,
        excluded_sidechain_user_records: 0,
    });
}

/** Per-transcript counts, before windowing folds them into a total. */
export interface TranscriptCounts {
    /** ISO instant of the first timestamped record, or null when undatable. */
    first_at: string | null;
    user_prompt_submit: number;
    tool_use_blocks: number;
    agent_tool_use_blocks: number;
    excluded_meta_user_records: number;
    excluded_sidechain_user_records: number;
}

/**
 * Apply {@link RECONSTRUCTION_RULES} to one transcript's records.
 *
 * Pure: takes already-parsed records, touches no filesystem, so the rules are
 * testable against inline fixtures and the published counts are reproducible
 * without the measured machine's `~/.claude`.
 */
export function countTranscript(records: readonly Record<string, unknown>[]): TranscriptCounts {
    const out = emptyTranscriptCounts();
    for (const record of records) foldRecord(out, record);
    return out;
}

/** A zeroed per-transcript accumulator. */
export function emptyTranscriptCounts(): TranscriptCounts {
    return {
        first_at: null,
        user_prompt_submit: 0,
        tool_use_blocks: 0,
        agent_tool_use_blocks: 0,
        excluded_meta_user_records: 0,
        excluded_sidechain_user_records: 0,
    };
}

/**
 * Apply the rules to a single record. The one place the rules live — the
 * whole-file and the streaming path both call it, so they cannot diverge.
 */
export function foldRecord(out: TranscriptCounts, record: Record<string, unknown>): void {
    const at = record.timestamp;
    if (out.first_at === null && typeof at === 'string' && at.length > 0) {
        out.first_at = at;
    }

    if (record.type === 'user') {
        if (record.isSidechain === true) {
            out.excluded_sidechain_user_records += 1;
            return;
        }
        if (record.isMeta === true) {
            out.excluded_meta_user_records += 1;
            return;
        }
        const content = (record.message as { content?: unknown } | undefined)?.content;
        const carriesToolResult =
            Array.isArray(content) &&
            content.some(
                (block) =>
                    typeof block === 'object' &&
                    block !== null &&
                    (block as { type?: unknown }).type === 'tool_result',
            );
        if (!carriesToolResult) out.user_prompt_submit += 1;
        return;
    }

    if (record.type === 'assistant') {
        const content = (record.message as { content?: unknown } | undefined)?.content;
        if (!Array.isArray(content)) return;
        for (const block of content) {
            if (typeof block !== 'object' || block === null) continue;
            const typed = block as { type?: unknown; name?: unknown };
            if (typed.type !== 'tool_use') continue;
            out.tool_use_blocks += 1;
            if (typed.name === 'Agent' || typed.name === 'Task') {
                out.agent_tool_use_blocks += 1;
            }
        }
    }
}

/** Fold one transcript's counts into a denominator, honouring the window. */
export function accumulate(
    into: HostDenominator,
    counts: TranscriptCounts,
    windowStart: string,
    windowEnd: string,
): void {
    into.transcripts_found += 1;

    if (counts.first_at === null) {
        into.sessions_undatable += 1;
        return;
    }
    const day = counts.first_at.slice(0, 10);
    if (day < windowStart || day > windowEnd) {
        into.sessions_before_window += 1;
        return;
    }

    into.sessions_in_window += 1;
    into.session_start += 1;
    into.user_prompt_submit += counts.user_prompt_submit;
    into.pre_tool_use += counts.tool_use_blocks;
    into.post_tool_use += counts.tool_use_blocks;
    into.subagent_start += counts.agent_tool_use_blocks;
    into.subagent_stop += counts.agent_tool_use_blocks;
    into.excluded_meta_user_records += counts.excluded_meta_user_records;
    into.excluded_sidechain_user_records += counts.excluded_sidechain_user_records;
}

/** The total across the six counted cells — the denominator of the rate. */
export function totalCountedEvents(record: HostDenominator): number {
    return COUNTED_EVENTS.reduce((sum, event) => sum + record[event], 0);
}

/** The total across the five journal-bound counted cells. */
export function totalJournalBoundEvents(record: HostDenominator): number {
    return JOURNAL_BOUND_COUNTED_EVENTS.reduce((sum, event) => sum + record[event], 0);
}

/**
 * Every `*.jsonl` under a Claude Code projects root, recursively.
 *
 * Recursive on purpose: a flat one-level walk under-enumerates this machine's
 * store by more than half (992 of 2,297 files), and a denominator that silently
 * misses two thirds of its population is worse than none.
 */
export function findTranscripts(projectsRoot: string): string[] {
    const found: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile() && entry.name.endsWith('.jsonl')) found.push(full);
        }
    };
    walk(projectsRoot);
    found.sort();
    return found;
}

/** Stream one transcript file and count it. Unparseable lines are skipped. */
export async function countTranscriptFile(file: string): Promise<TranscriptCounts> {
    const out = emptyTranscriptCounts();
    const stream = readline.createInterface({
        input: fs.createReadStream(file, { encoding: 'utf8' }),
        crlfDelay: Infinity,
    });
    for await (const line of stream) {
        if (line.trim().length === 0) continue;
        try {
            const parsed = JSON.parse(line);
            if (typeof parsed === 'object' && parsed !== null) {
                foldRecord(out, parsed as Record<string, unknown>);
            }
        } catch {
            /* a truncated tail line is not a host event */
        }
    }
    return out;
}
