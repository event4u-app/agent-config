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

import {
    emptyCounters,
    eolSessionKey,
    eolStateFile,
    readNewCompleteLines,
    scanEolSlice,
    type EolCounters,
} from '../_lib/session_eol.js';
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
        updated_at: '',
    };
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

/** The exactly-one advisory line injected past threshold (Phase 3.2). */
export function buildAdvisoryLine(tokens: number, threshold: number): string {
    return (
        `context past recycle threshold (${tokens.toLocaleString('en-US')} of ` +
        `${threshold.toLocaleString('en-US')} tokens): run \`agent-config session:recycle\` to ` +
        `write the recycle envelope, then /clear — the successor session resumes from the ` +
        `envelope at session_start (road-to-token-economy-recycling)`
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

    const nextState: SessionEolState = {
        schema_version: 1,
        counters,
        advisory_fired_at: shouldAdvise ? now : state.advisory_fired_at,
        updated_at: now,
    };
    try {
        atomic_write_json(file, nextState);
    } catch {
        // recording is best-effort; never block the Stop path
    }

    writeContextFill(workspaceRoot, tokens, threshold, now);

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
