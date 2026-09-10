#!/usr/bin/env node
/**
 * session-eol — Stop-slot session end-of-life instrument + automatic
 * continuity record (road-to-token-economy-recycling Phases 1.1 / 3.2 / 4.2,
 * road-to-continuity-writer-activation Phase 1 and step 3.2).
 *
 * Phase 1.1 (record-only): per session, maintain counts-only end-of-life
 * state — final main-chain context size in parsed tokens (via
 * `_lib/session_eol.ts` → `cc_transcript.billableInputTokens`), turn count,
 * and every observed compaction event — under
 * `agents/runtime/state/session-eol/<sha256(session)>.json`. Incremental:
 * each Stop reads only the transcript bytes appended since the last scan.
 *
 * Phase 3.2 — RETIRED 2026-09-10 (road-to-continuity-writer-activation step
 * 3.2). This hook used to inject one line past the committed recycle threshold
 * (`src/config/recycle-threshold-budget.json`) advising a human to run
 * `agent-config session:recycle` before `/clear`, plus a second line when that
 * advice had been given and no envelope had appeared. Both are gone. They
 * existed because nothing else wrote the continuity record, and
 * `writeContinuityRecord` below now does — armed by default since the same
 * change, on an AI-council verdict of 2026-09-10 (2 seats, convergent, under
 * the owner's written delegation). An advisory telling a human to do by hand
 * what the concern now does on its own is a manual action on the normal path,
 * which is what step 3.2 removes and what `check_continuity_surface` counts on
 * its `normal_path_manual_actions` axis.
 *
 * `agent-config session:recycle` itself is RETAINED, and deliberately: the
 * same verdict refused to retire a public callable contract, and the automatic
 * writer is not a strict superset of it — it skips a session that claimed no
 * roadmap and omits the `git status` anchors the command collects. It is an
 * explicit affordance now, not a step anybody is told to remember.
 *
 * What SURVIVES the retirement is the state machine underneath it.
 * `advisory_fired_at` still stamps the first Stop at which a session crosses
 * the recycle threshold, because the run-checkpoint writer below gates on
 * exactly that edge. The field keeps its name: it is a persisted state key
 * under `agents/runtime/state/session-eol/`, and renaming it would strand
 * every state file already on disk to make one docblock read better.
 *
 * Phase 4.2 (read surface): every Stop also overwrites
 * `agents/runtime/state/context-fill.json` with the machine-readable fill
 * level + threshold state — display substrate for an external statusline;
 * carries counts only, and this hook's behaviour is identical whether or
 * not anything reads it.
 *
 * Never blocks: exit 0 on every path. With both advisory emitters retired this
 * hook no longer returns the warn exit at all — it records, writes the context
 * fill, the run checkpoint and the continuity record, and says nothing.
 * `AGENT_CONFIG_REPLAY=1` → no-op.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import recycleThresholdConfig from '../../config/recycle-threshold-budget.json';

import {
    listContinuityRecords,
    RECYCLE_MAX_AGE_HOURS,
} from '../_lib/recycle_envelope_paths.js';
import {
    emptyCounters,
    eolSessionKey,
    eolStateFile,
    readNewCompleteLines,
    scanEolSlice,
    type EolCounters,
} from '../_lib/session_eol.js';
import { readContextObservation } from '../_lib/context_observation.js';
import { buildCheckpoint, writeCheckpoint } from '../_lib/run_checkpoint.js';
import {
    auto_record_enabled,
    buildContinuityRecord,
    run_checkpoints_enabled,
} from '../_lib/continuity_writer.js';
import { publishContinuityRecord } from '../_lib/continuity_slot.js';
import { read_claimed_slug } from '../session_register_hook.js';
import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { atomic_write_json, is_replay_mode } from './state_io.js';
import { isSafeTranscriptPath } from './end_review_nudge_hook.js';

/**
 * Per-process threshold override — the test seam and the emergency off
 * switch (`0` or any non-positive value disables the threshold lane, so the
 * run checkpoint and the continuity record stop while plain recording
 * continues). The committed value lives in
 * `src/config/recycle-threshold-budget.json` and is statically imported so
 * the hook bundle carries it into consumers — one threshold, one constant.
 */
export const THRESHOLD_OVERRIDE_ENV = 'AGENT_RECYCLE_THRESHOLD_TOKENS';

/** Machine-readable fill-level surface (Phase 4.2). Counts only, overwritten per Stop. */
export const CONTEXT_FILL_REL = path.join('agents', 'runtime', 'state', 'context-fill.json');

export interface SessionEolState {
    schema_version: 1;
    counters: EolCounters;
    /**
     * ISO stamp of the first Stop at which this session crossed the recycle
     * threshold, or null.
     *
     * Named for the advisory it used to fire (retired 2026-09-10, step 3.2).
     * The name is kept because this is a persisted key: renaming it would
     * strand every `session-eol/<key>.json` already on disk. What it marks is
     * the threshold-crossing edge, which the run-checkpoint writer still gates
     * on.
     */
    advisory_fired_at: string | null;
    /**
     * ISO stamp when the follow-up "advised, but no envelope exists" line
     * fired, or null. NOTHING WRITES THIS ANY MORE — the counter-check was
     * retired with the advisory on 2026-09-10 (step 3.2). It is still parsed,
     * and `session_eol_report.ts` still counts it, because state files written
     * before that date carry it and dropping the read would silently reinterpret
     * their history as "never happened". Separate from `advisory_fired_at` so the counter-check
     * is once-per-session in its own right: one reminder is a safety net, one
     * per Stop for the rest of the session is a nag the reader learns to skip.
     */
    missing_envelope_warned_at?: string | null;
    updated_at: string;
}

function str(value: JsonValue | undefined): string {
    return typeof value === 'string' ? value : '';
}

/** Re-exported so existing importers keep one path; derivation lives in the lib. */
export const stateFile = eolStateFile;

/**
 * Same derivation as `end_review_nudge_hook.deriveSessionKey` — hashed, never
 * raw. The hashing itself is `eolSessionKey`, shared with the readers so a
 * reader can never key a state file differently than the writer wrote it.
 */
export function deriveSessionKey(envelope: JsonObject, payload: JsonObject): string {
    return eolSessionKey(
        str(envelope['session_id'] as JsonValue | undefined) ||
            str((payload['transcript_path'] ?? payload['transcriptPath']) as JsonValue | undefined),
    );
}

/**
 * The RAW session id, not the hashed key.
 *
 * `read_claimed_slug` keys the per-session claim file off the id the host
 * exported, so handing it `deriveSessionKey`'s hash would look up a file that
 * cannot exist and silently report "no contract" for every claimed run.
 * Falls back to the envelope, which is where the dispatcher puts it, and
 * deliberately does NOT fall back to the transcript path: that is a filename,
 * not an identity, and `sessions:claim` never wrote a claim under one.
 */
export function payloadSessionId(payload: JsonObject, envelope: JsonObject): string {
    return (
        str(payload['session_id'] as JsonValue | undefined) ||
        str(envelope['session_id'] as JsonValue | undefined)
    ).trim();
}

/** Load prior per-session state; any read/shape error reads as "fresh session". */
export function readState(file: string): SessionEolState {
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<SessionEolState>;
        if (
            parsed &&
            typeof parsed === 'object' &&
            parsed.schema_version === 1 &&
            parsed.counters &&
            typeof parsed.counters.scanned_bytes === 'number'
        ) {
            return {
                schema_version: 1,
                counters: parsed.counters,
                advisory_fired_at:
                    typeof parsed.advisory_fired_at === 'string' ? parsed.advisory_fired_at : null,
                missing_envelope_warned_at:
                    typeof parsed.missing_envelope_warned_at === 'string'
                        ? parsed.missing_envelope_warned_at
                        : null,
                updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : '',
            };
        }
    } catch {
        // fall through — fresh state
    }
    return {
        schema_version: 1,
        counters: emptyCounters(),
        advisory_fired_at: null,
        missing_envelope_warned_at: null,
        updated_at: '',
    };
}

/**
 * Records that were written and never read — the detection layer this defect
 * did not have.
 *
 * `road-to-a-recycle-envelope-that-is-consumed` step 1.2. Twelve unconsumed
 * envelopes accumulated across the estate over roughly a month, and the only
 * reason anyone found them was a stray-copy check during an unrelated task. The
 * producer reported success, the consumer reported `absent`, and nothing
 * compared the two — so the mechanism was inert for weeks with no signal.
 *
 * Advisory ONLY. A hook that blocks a session end over a stale runtime file is
 * worse than the file, and that is Kill-register K3 of the roadmap rather than
 * a preference here.
 *
 * Silent in the normal case, which is what keeps it worth reading: a record
 * younger than {@link RECYCLE_MAX_AGE_HOURS} is a pending resume, not a defect,
 * and past that age the consumer discards it loudly on its own. What this
 * reports is the third state — old enough to be dead, still sitting there,
 * which means no successor ever came for it.
 */
export function unconsumedRecordLines(
    workspaceRoot: string,
    now: Date = new Date(),
    maxAgeHours: number = RECYCLE_MAX_AGE_HOURS,
): string[] {
    const out: string[] = [];
    for (const file of listContinuityRecords(workspaceRoot)) {
        let raw: string;
        try {
            raw = fs.readFileSync(file, 'utf-8');
        } catch {
            continue; // an unreadable record proves nothing in either direction
        }
        let written: unknown;
        let nextTask: unknown;
        try {
            const parsed = JSON.parse(raw) as { written_at?: unknown; next_task?: unknown };
            written = parsed.written_at;
            nextTask = parsed.next_task;
        } catch {
            continue;
        }
        if (typeof written !== 'string') continue;
        const stamp = Date.parse(written);
        if (Number.isNaN(stamp)) continue;
        const ageHours = (now.getTime() - stamp) / 3_600_000;
        if (ageHours <= maxAgeHours) continue;
        const task = typeof nextTask === 'string' && nextTask.trim() !== '' ? nextTask.trim() : '(no next_task)';
        out.push(
            `unconsumed continuity record: ${path.relative(workspaceRoot, file)} is ` +
                `${ageHours.toFixed(0)}h old and was never read — next_task was "${task.slice(0, 120)}"`,
        );
    }
    return out;
}

/**
 * Resolve the recycle threshold (Phase 3.1): the per-process override wins
 * (tests; `0` = advisory lane off), else the committed constant from
 * `recycle-threshold-budget.json`. Returns `null` when the lane is
 * disabled or the value is not a positive number — recording continues
 * either way (fail-open, never a block).
 */
export function readThresholdTokens(): number | null {
    const override = process.env[THRESHOLD_OVERRIDE_ENV];
    if (override !== undefined) {
        const value = Number(override);
        return Number.isFinite(value) && value > 0 ? value : null;
    }
    const value = (recycleThresholdConfig as Record<string, unknown>)['recycle_threshold_tokens'];
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Overwrite the Phase 4.2 read surface. Counts only; failures are swallowed. */
function writeContextFill(
    workspaceRoot: string,
    tokens: number | null,
    threshold: number | null,
    ts: string,
): void {
    try {
        atomic_write_json(path.join(workspaceRoot, CONTEXT_FILL_REL), {
            schema_version: 1,
            final_context_tokens: tokens,
            recycle_threshold_tokens: threshold,
            past_threshold: tokens !== null && threshold !== null && tokens >= threshold,
            updated_at: ts,
        });
    } catch {
        // a state-write failure must never block the Stop path
    }
}

export function main(): number {
    const [envelope, payload] = unwrap(readHookStdin(), 'claude');

    const event = String(envelope['event'] ?? '');
    if (event !== '' && event !== 'stop') {
        return 0;
    }
    if (is_replay_mode()) {
        return 0; // replay fixtures never mutate session state
    }

    const workspaceRoot = String(envelope['workspace_root'] ?? '').trim() || process.cwd();

    const transcriptPath = str(
        (payload['transcript_path'] ?? payload['transcriptPath']) as JsonValue | undefined,
    ).trim();
    if (!transcriptPath || !isSafeTranscriptPath(transcriptPath)) {
        return 0; // no readable ledger — silence, never a block
    }

    const sessionKey = deriveSessionKey(envelope, payload);
    const file = stateFile(workspaceRoot, sessionKey);
    const state = readState(file);

    let counters = state.counters;
    const read = readNewCompleteLines(transcriptPath, counters.scanned_bytes);
    if (read.truncated) {
        const full = readNewCompleteLines(transcriptPath, 0);
        counters = scanEolSlice(full.text, emptyCounters());
        counters.scanned_bytes = full.nextOffset;
    } else if (read.text.length > 0) {
        counters = scanEolSlice(read.text, counters);
        counters.scanned_bytes = read.nextOffset;
    } else {
        counters = { ...counters, scanned_bytes: read.nextOffset };
    }

    const now = new Date().toISOString();
    const threshold = readThresholdTokens();
    const tokens = counters.final_context_tokens;

    // The threshold-crossing edge: the first Stop at which this session went
    // past the recycle threshold. It used to fire the recycle advisory (retired
    // 2026-09-10, step 3.2) and it still gates the run-checkpoint writer below,
    // which needs "crossed, once" rather than "is above".
    const crossedThresholdNow =
        threshold !== null &&
        tokens !== null &&
        tokens >= threshold &&
        state.advisory_fired_at === null;

    // Raw id, not `sessionKey`: the record path is built from the id the host
    // exported (`safe_stem`), never from the hashed state-file key.
    const rawSessionId = payloadSessionId(payload, envelope) || null;

    // `missing_envelope_warned_at` is carried forward, never set. Its writer —
    // the "advised, but no envelope exists" counter-check — retired with the
    // advisory it was checking on: with the record written automatically there
    // is no advice to have been ignored, and the line it emitted told a human
    // to run the command that step 3.2 removed from the normal path. The field
    // is preserved on read so state written before that date keeps its history
    // (`session_eol_report.ts` still counts it).
    const nextState: SessionEolState = {
        schema_version: 1,
        counters,
        advisory_fired_at: crossedThresholdNow ? now : state.advisory_fired_at,
        missing_envelope_warned_at: state.missing_envelope_warned_at ?? null,
        updated_at: now,
    };
    try {
        atomic_write_json(file, nextState);
    } catch {
        // recording is best-effort; never block the Stop path
    }

    writeContextFill(workspaceRoot, tokens, threshold, now);

    // ── UOTL Phase 6.1 — the deterministic half of the handoff ───────
    //
    // Above the threshold AND inside a running contract, leave a derived
    // checkpoint behind. Two properties the advisory alone cannot give:
    //
    //   · It costs no judgement. Every field is recomputed from the
    //     roadmap on disk, so a dying session produces it correctly even
    //     when it has no context left to summarise anything.
    //   · It is re-verifiable. A resumed run recomputes the same fields
    //     and can name WHICH claim went stale rather than trusting the
    //     record, which is the deliberate departure from resuming by
    //     bookkeeping (Phase 3.2).
    //
    // "Inside a running contract" is the same carrier `run-continuation`
    // uses — a `sessions:claim` for this session — and no second one is
    // invented. Outside a contract this is silent: a checkpoint for a
    // conversational session names work nobody is executing.
    //
    // Best-effort throughout. A checkpoint is a recovery aid, and a
    // recovery aid that can fail a Stop is a liability.
    const checkpointRunId = payloadSessionId(payload, envelope);
    if (crossedThresholdNow && checkpointRunId !== '' && run_checkpoints_enabled(workspaceRoot)) {
        try {
            const slug = read_claimed_slug(workspaceRoot, checkpointRunId);
            if (slug !== null) {
                // `road-to-wired-instruments` 2.1. The fingerprint was never
                // passed here, so `context_fingerprint` was null in every
                // checkpoint this package has ever written and the resume-time
                // drift check it exists for could not fire. The value comes from
                // the newest recorded probe rather than from a fresh one: this is
                // the Stop path, and the probe costs a `gh` call. Absent stays
                // absent, which reads as "not known" and never as "unchanged".
                const observed = readContextObservation(workspaceRoot)?.fingerprint ?? null;
                const cp = buildCheckpoint(workspaceRoot, eolSessionKey(checkpointRunId), slug, {
                    ...(observed !== null ? { contextFingerprint: observed } : {}),
                });
                if (cp !== null) writeCheckpoint(workspaceRoot, cp);
            }
        } catch {
            // never block the Stop path
        }
    }

    writeContinuityRecord(workspaceRoot, rawSessionId, counters, threshold, tokens);

    // No warn path. Both emitters this hook used to carry were the recycle
    // advisory and its counter-check, and both are retired (step 3.2). The hook
    // records, writes the context fill, the checkpoint and the continuity
    // record, and returns silently.
    return 0;
}

/**
 * The continuity-record handler — one of the three lifecycle handlers this
 * concern carries, and independently switchable from the other two.
 *
 * `road-to-continuity-writer-activation` step 1.2, and it lands INSIDE this
 * concern rather than as a fourth concern id on purpose: `check_estate_count`
 * ratchets `concern_count` with allowance 0, and the 2026-09-08 AI council
 * refused a temporary allowance 2/2. The substance the 2026-09-07 council's D2
 * asked for is independent switching and failure isolation, and a handler
 * behind its own settings key inside a `try` gives both without a manifest
 * split. The split itself is step 2.1 and stays blocked until a concern is
 * retired to pay for it.
 *
 * Fires from the recycle THRESHOLD, not from the once-per-session advisory
 * stamp: the stamp fires once, so a record written from it would be frozen at
 * the moment the session crossed the threshold and would go stale as the
 * session continued. Driving it from the raw threshold condition instead means
 * every later Stop supersedes the record under the slot's own policy, so what a
 * successor reads is always the newest state, and the write rate is still
 * bounded to the end phase of a session rather than every turn of it.
 *
 * Best-effort throughout, like the checkpoint above it: a continuity record is
 * a recovery aid, and a recovery aid that can fail a Stop is a liability.
 */
function writeContinuityRecord(
    workspaceRoot: string,
    rawSessionId: string | null,
    counters: EolCounters,
    threshold: number | null,
    tokens: number | null,
): void {
    if (threshold === null || tokens === null || tokens < threshold) return;
    const sessionId = String(rawSessionId ?? '').trim();
    if (sessionId === '') return;
    try {
        if (!auto_record_enabled(workspaceRoot)) return;
        const slug = read_claimed_slug(workspaceRoot, sessionId);
        const decision = buildContinuityRecord({
            root: workspaceRoot,
            sessionId,
            slug,
            counters,
        });
        if (decision.record === null) return;
        publishContinuityRecord(workspaceRoot, sessionId, decision.record);
    } catch {
        // never block the Stop path, and never suppress a sibling handler
    }
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
