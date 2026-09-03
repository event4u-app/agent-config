#!/usr/bin/env node
/**
 * session-eol — Stop-slot session end-of-life instrument + recycle advisory
 * (road-to-token-economy-recycling Phases 1.1 / 3.2 / 4.2).
 *
 * Phase 1.1 (record-only): per session, maintain counts-only end-of-life
 * state — final main-chain context size in parsed tokens (via
 * `_lib/session_eol.ts` → `cc_transcript.billableInputTokens`), turn count,
 * and every observed compaction event — under
 * `agents/runtime/state/session-eol/<sha256(session)>.json`. Incremental:
 * each Stop reads only the transcript bytes appended since the last scan.
 *
 * Phase 3.2 (advisory, once per session): past the committed recycle
 * threshold (`src/config/recycle-threshold-budget.json`), inject ONE line
 * advising `session:recycle` — the F2 once-per-session pattern of
 * `end_review_nudge_hook.ts`. Absent/unreadable config or transcript is
 * SILENCE, never a block (fail-open); hooks cannot inject `/clear`, so the
 * recycle action itself stays advisory-carried by design (roadmap 5.1).
 *
 * Counter-check (second warn path, also once per session): when the advisory
 * fired on an earlier Stop and no envelope written since then exists, inject
 * one further line saying so — the advisory recommends an action whose next
 * step destroys the session, so recommending it without ever checking the
 * result is how a silent write failure becomes total context loss. Stamped by
 * `missing_envelope_warned_at`, gated on the same threshold, so the emergency
 * off-switch silences BOTH paths. Two independent emitters, at most one line
 * each per session — the budget the Stop slot carries from this hook is two,
 * not one.
 *
 * Phase 4.2 (read surface): every Stop also overwrites
 * `agents/runtime/state/context-fill.json` with the machine-readable fill
 * level + threshold state — display substrate for an external statusline;
 * carries counts only, and this hook's behaviour is identical whether or
 * not anything reads it.
 *
 * Never blocks: exit 0 on every silent path; the advisory reports at
 * exit 2 ({decision:"warn", additional_context}) which `host_semantics`
 * reduces to a non-blocking warn on claude. `AGENT_CONFIG_REPLAY=1` → no-op.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import recycleThresholdConfig from '../../config/recycle-threshold-budget.json';

import { RECYCLE_ENVELOPE_REL } from '../_lib/recycle_envelope_paths.js';
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
import { read_claimed_slug } from '../session_register_hook.js';
import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { atomic_write_json, is_replay_mode } from './state_io.js';
import { isSafeTranscriptPath } from './end_review_nudge_hook.js';

const EXIT_WARN = 2;

/**
 * Per-process threshold override — the test seam and the emergency off
 * switch (`0` or any non-positive value disables the advisory lane while
 * recording continues). The committed value lives in
 * `src/config/recycle-threshold-budget.json` and is statically imported so
 * the hook bundle carries it into consumers — one threshold, one constant.
 */
export const THRESHOLD_OVERRIDE_ENV = 'AGENT_RECYCLE_THRESHOLD_TOKENS';

/** Machine-readable fill-level surface (Phase 4.2). Counts only, overwritten per Stop. */
export const CONTEXT_FILL_REL = path.join('agents', 'runtime', 'state', 'context-fill.json');

export interface SessionEolState {
    schema_version: 1;
    counters: EolCounters;
    /** ISO stamp when the recycle advisory fired for this session (F2), or null. */
    advisory_fired_at: string | null;
    /**
     * ISO stamp when the follow-up "advised, but no envelope exists" line
     * fired, or null. Separate from `advisory_fired_at` so the counter-check
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
 * Is there a recycle envelope under this workspace, written since `since`?
 *
 * Two properties, both load-bearing:
 *
 * **Only ENOENT counts as missing.** `fs.existsSync` swallows every error into
 * `false`, so an unreadable directory (EACCES on a mounted or root-owned tree)
 * would read as "no envelope" and produce the manufactured "your envelope is
 * gone" warning this check exists to avoid. `statSync` + an errno test is the
 * only shape that can tell the two apart.
 *
 * **Freshness, not mere existence.** The consumer moves the envelope aside at
 * session_start, so a file still sitting here belongs to a session that never
 * cleared. Counting it would silence the warning in the case it exists to
 * catch, and worse: `/clear` would then resume the successor from another
 * session's state — a wrong resume instead of an empty one. An envelope whose
 * `written_at` predates the advisory is not this session's.
 */
export function envelopeExists(workspaceRoot: string, since: string | null = null): boolean {
    const target = path.join(workspaceRoot, RECYCLE_ENVELOPE_REL);
    let raw: string;
    try {
        raw = fs.readFileSync(target, 'utf-8');
    } catch (exc) {
        // ENOENT is the real "no envelope"; anything else is a failed CHECK,
        // and a failed check must never assert absence.
        return (exc as NodeJS.ErrnoException)?.code !== 'ENOENT';
    }
    if (since === null) return true;
    try {
        const written = (JSON.parse(raw) as { written_at?: unknown }).written_at;
        // Unparseable or undated: present, and not provably stale. Treat it as
        // this session's — the alternative warns about a file that is there.
        if (typeof written !== 'string') return true;
        return Date.parse(written) >= Date.parse(since);
    } catch {
        return true;
    }
}

/**
 * The follow-up line: the advisory already fired, and no envelope arrived.
 *
 * This is the half of the reported minimum fix that lives outside the command
 * — the hook that recommends the call making the same counter-check before the
 * operator acts on it. Whatever stopped the write (a wrong root, a refusal
 * scrolled past, a forgotten step), the state visible here is identical, and
 * the next action the advisory recommended is the one that destroys the
 * session.
 */
export function buildMissingEnvelopeLine(workspaceRoot: string): string {
    return (
        `recycle advised earlier, but no envelope exists at ` +
        `${path.join(workspaceRoot, RECYCLE_ENVELOPE_REL)} — /clear now starts the successor ` +
        `from nothing. Re-run \`agent-config session:recycle\` and check that it prints the ` +
        `absolute path it wrote before clearing.`
    );
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

/**
 * The exactly-one advisory line injected past threshold (Phase 3.2).
 *
 * The `/clear` half is conditional on purpose. An earlier wording read
 * `run X … then /clear`, which is an instruction to destroy the session with
 * no check in between — and a reader who followed it while the command was
 * silently writing nothing lost everything. The proof to wait for is the
 * absolute path the command prints; naming it costs one clause.
 */
export function buildAdvisoryLine(tokens: number, threshold: number): string {
    return (
        `context past recycle threshold (${tokens.toLocaleString('en-US')} of ` +
        `${threshold.toLocaleString('en-US')} tokens): run \`agent-config session:recycle\` to ` +
        `write the recycle envelope. It prints the absolute path it wrote — /clear only after ` +
        `you have seen that line. The successor session then resumes from the envelope at ` +
        `session_start (road-to-token-economy-recycling)`
    );
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

    const shouldAdvise =
        threshold !== null &&
        tokens !== null &&
        tokens >= threshold &&
        state.advisory_fired_at === null;

    // The counter-check: the advisory fired on an EARLIER Stop (so `state`,
    // the pre-update snapshot, already carries the stamp) and no envelope has
    // appeared since. It can never collide with `shouldAdvise` — that branch
    // requires `advisory_fired_at === null` — so at most one line is emitted
    // per Stop, and this one at most once per session.
    //
    // `threshold !== null` gates it for the same reason the advisory is gated:
    // `AGENT_RECYCLE_THRESHOLD_TOKENS=0` is documented as the emergency switch
    // for the whole advisory lane, and a lane that keeps one more warn after
    // being switched off is not off.
    const shouldWarnMissing =
        threshold !== null &&
        state.advisory_fired_at !== null &&
        (state.missing_envelope_warned_at ?? null) === null &&
        !envelopeExists(workspaceRoot, state.advisory_fired_at);

    const nextState: SessionEolState = {
        schema_version: 1,
        counters,
        advisory_fired_at: shouldAdvise ? now : state.advisory_fired_at,
        missing_envelope_warned_at: shouldWarnMissing
            ? now
            : (state.missing_envelope_warned_at ?? null),
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
    if (shouldAdvise && checkpointRunId !== '') {
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

    if (shouldAdvise && threshold !== null && tokens !== null) {
        process.stdout.write(
            `${JSON.stringify({
                decision: 'warn',
                reason: `session-eol: context ${tokens} >= recycle threshold ${threshold}`,
                additional_context: buildAdvisoryLine(tokens, threshold),
            })}\n`,
        );
        return EXIT_WARN;
    }
    if (shouldWarnMissing) {
        process.stdout.write(
            `${JSON.stringify({
                decision: 'warn',
                reason: 'session-eol: recycle advised, no envelope written',
                additional_context: buildMissingEnvelopeLine(workspaceRoot),
            })}\n`,
        );
        return EXIT_WARN;
    }
    return 0;
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
