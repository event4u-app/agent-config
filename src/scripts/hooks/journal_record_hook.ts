#!/usr/bin/env tsx
/**
 * Runtime event journal — the hook binding
 * (road-to-runtime-event-journal Phase 1, step 1.4; AI council 2026-08-28,
 * decision 3).
 *
 * ## Why this exists
 *
 * `_lib/runtime_journal.ts` shipped as a module bound in no hook slot, so
 * production capture was **zero by construction** and step 1.4's measurement
 * had no numerator AND no denominator. Both council seats read the honest
 * `undefined` as correct and as NOT discharging 1.4: *"zero numerator does not
 * establish 0 % when the population itself was not observed."* This concern is
 * the population. Binding is inside Phase 1's own goal — the phase is titled
 * "The journal, written by hooks that terminate" — not scope creep.
 *
 * ## Class A, and provably so
 *
 * Start, write, exit. No resident process, no listening socket, no timer, no
 * shared in-memory state between invocations — `openJournal` … `close()` inside
 * one call and nothing survives it. Identical shape to `_lib/test_red_state.ts`
 * and to the sibling instruments (`tool_result_bytes_hook`,
 * `subagent_ledger_hook`, `orchestration_record_hook`). AC-8 is checkable from
 * this file alone.
 *
 * ## It never blocks and never fails a turn
 *
 * Exit code is ALWAYS `EXIT_ALLOW` (0) on every path — settings unreadable,
 * `node:sqlite` unavailable, envelope malformed, database locked, disk full,
 * contract violation raised by the writer. A journal write problem is swallowed
 * and the turn proceeds; a hook `warn` (exit 2) is read as a hard BLOCK on this
 * host and this concern has nothing to say to the model, so it never warns
 * either. `fail_closed: false`, `severity: advisory` in the manifest.
 *
 * ## Default-OFF, and the cost of that choice is stated rather than hidden
 *
 * Gated on `hooks.runtime_journal.enabled` in `.agent-settings.yml`; absent or
 * unreadable ⇒ off. Two conventions exist for a new concern in this tree and
 * the choice is deliberate:
 *
 *   - The append-a-JSONL-line instruments (`orchestration-record`,
 *     `tool-result-bytes`, `subagent-ledger`) ship ON with no setting at all.
 *     They write into `agents/runtime/state/`, a gitignored directory that
 *     already exists.
 *   - The journal creates a **new storage surface** — a SQLite database and a
 *     directory under `<git-common-dir>` — in every repository it runs in. That
 *     is engine-shaped, and ADR-124 § 3 ("falsifiability-first: every native
 *     engine ships default-off, activates via tripwire or explicit setting") is
 *     explicitly NOT superseded by ADR-249.
 *
 * So: OFF. **The honest consequence is that a default install still records
 * nothing**, and 1.4's production number moves from *zero by construction* to
 * *zero until opted in*. That is a change in kind — the path now exists, is
 * bound, and is exercisable — and it is not yet a production capture rate. The
 * evidence page says so in those words rather than reporting the dispatch-path
 * figure as if it were the host one.
 *
 * ## What is recorded, and what is refused
 *
 * PRIVACY BY CONSTRUCTION — never widen this file to read or emit free text.
 * The record type it writes has no field able to hold content
 * (`JOURNAL_RECORD_KEYS`, bound to the type in both directions by a
 * compile-time assertion). This concern additionally reads only:
 *
 *   - the dispatcher's `event` — a member of a closed vocabulary;
 *   - `session_id` — an opaque host token, already recorded by
 *     `session_register` and stored here as an id, never parsed;
 *   - `task_id` / `prompt_id` where the host supplies them (Cline's `taskId` is
 *     the one observed source today — see § The task_id gap);
 *   - the TOOL NAME, reduced to a bounded identifier. `Read` / `Bash` / `Grep`
 *     is the id-shaped enum class `tool_result_bytes_hook` and
 *     `orchestration_record_hook` already record verbatim.
 *
 * It never reads `tool_input`, `tool_response`, a prompt, a path, or a diff —
 * which is why it declares no `needs_payload_bodies` in the manifest and would
 * be no more informed if it did.
 *
 * ## The task_id gap, stated because it bounds the episode spine
 *
 * The boundary rule opens an episode on the first event carrying a `task_id`
 * (council 2026-08-28, envelope correlation). The DISPATCHER envelope carries
 * no task id on Claude: `hooks/envelope.ts`'s documented shape is
 * `{schema_version, platform, event, native_event, session_id, workspace_root,
 * payload, settings}`. Cline's native payload carries `taskId` and is read.
 * Everywhere else every record lands `boundary_status: session_fallback` —
 * MARKED, never silently dropped, exactly as the blocker's resolution requires.
 * Threading the outcome envelope's task id into the dispatcher envelope is
 * Phase 3's, and inventing one here would fabricate the boundary provenance the
 * spine exists to record.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hookSectionEnabled } from '../_lib/hook_settings.js';
import {
    RECORDED_EVENTS,
    isJournalAvailable,
    recordEvent,
    withJournal,
} from '../_lib/runtime_journal.js';
import { readHookStdin } from './hook_stdin.js';
import { is_replay_mode } from './state_io.js';

const EXIT_ALLOW = 0;

/** The `.agent-settings.yml` section under `hooks:` that arms this concern. */
export const SETTINGS_SECTION = 'runtime_journal';

// Exported so the test constructs fixtures against THIS definition rather than
// a hand-copied twin: `tsconfig.scripts.json` is stricter than the base config
// and rejects `Record<string, unknown>` here, which is the drift a second copy
// would reintroduce the moment either side changed.
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
export type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function unwrapPayload(envelope: JsonObject): JsonObject {
    const inner = envelope['payload'];
    return isObject(inner) ? inner : envelope;
}

/** First non-empty string under any of `keys`, searched envelope then payload. */
function firstString(envelope: JsonObject, payload: JsonObject, keys: readonly string[]): string | null {
    for (const source of [envelope, payload]) {
        for (const key of keys) {
            const v = source[key];
            if (typeof v === 'string' && v.trim() !== '') return v.trim();
        }
    }
    return null;
}

/**
 * Reduce a host string to the journal's bounded-identifier shape
 * (`^[a-z0-9][a-z0-9._:-]{0,63}$`), or `null` when nothing survives.
 *
 * Lower-cases, folds every character outside the allowed set to `-`, collapses
 * runs, trims to a legal first character, and truncates to 64. A value that
 * cannot be reduced to a legal identifier is REFUSED rather than coerced into
 * something shorter and wrong — the caller then falls back to the event name,
 * which is always legal.
 */
export function toCapability(raw: string): string | null {
    const folded = raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._:-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[^a-z0-9]+/, '')
        .slice(0, 64)
        // Trailing separators are legal in the grammar and read as truncation
        // damage, so they are trimmed rather than kept.
        .replace(/[._:-]+$/, '');
    return folded === '' ? null : folded;
}

/** The tool name, read from the positions the sibling instruments read. */
export function toolName(envelope: JsonObject, payload: JsonObject): string | null {
    return firstString(envelope, payload, ['tool_name', 'toolName', 'tool']);
}

/** What this event invoked, as a bounded identifier. Never free text. */
export function capabilityFor(event: string, envelope: JsonObject, payload: JsonObject): string {
    const tool = toolName(envelope, payload);
    if (tool !== null) {
        const reduced = toCapability(tool);
        if (reduced !== null) return reduced;
    }
    // Always legal: every member of the event vocabulary is already
    // lower-snake and inside the identifier grammar.
    return toCapability(event) ?? 'unknown';
}

/** One dispatcher envelope reduced to the fields the journal accepts. */
export interface JournalInput {
    event: string;
    session_id: string;
    task_id: string | null;
    prompt_id: string | null;
    capability: string;
}

/**
 * Reduce an envelope, or `null` when it cannot be recorded.
 *
 * `null` is returned for an event outside {@link RECORDED_EVENTS} (a host
 * vocabulary this journal has not placed in one set or the other) and for an
 * envelope carrying no session id — an event with no session cannot be keyed at
 * all, and a synthesised key would be a fabricated boundary.
 */
export function reduceEnvelope(envelope: JsonObject): JournalInput | null {
    const event = typeof envelope['event'] === 'string' ? envelope['event'] : '';
    if (!RECORDED_EVENTS.has(event)) return null;

    const payload = unwrapPayload(envelope);
    const session_id = firstString(envelope, payload, ['session_id', 'sessionId']);
    if (session_id === null) return null;

    return {
        event,
        session_id,
        // `taskId` is Cline's native payload key; the dispatcher envelope
        // carries none on Claude. Absent ⇒ session_fallback, marked.
        task_id: firstString(envelope, payload, ['task_id', 'taskId']),
        prompt_id: firstString(envelope, payload, ['prompt_id', 'promptId']),
        capability: capabilityFor(event, envelope, payload),
    };
}

/** The consumer repo root, same precedence as the sibling instruments. */
export function resolveConsumerRoot(envelope: JsonValue): string {
    if (isObject(envelope)) {
        for (const key of ['workspace_root', 'project_root']) {
            const v = envelope[key];
            if (typeof v === 'string' && v) return v;
        }
        const cwd = unwrapPayload(envelope)['cwd'];
        if (typeof cwd === 'string' && cwd) return cwd;
    }
    return process.cwd();
}

/**
 * Process an ALREADY-PARSED envelope. Always returns `EXIT_ALLOW`.
 *
 * Returns nothing about whether it wrote — deliberately. A concern that
 * reported its own success to the dispatcher would be a channel the dispatcher
 * has no use for; {@link recordedFor} is the test-facing answer.
 */
export function processEnvelope(envelope: JsonValue, consumerRoot: string): number {
    try {
        if (!isObject(envelope)) return EXIT_ALLOW;
        if (is_replay_mode()) return EXIT_ALLOW;
        if (!hookSectionEnabled(consumerRoot, SETTINGS_SECTION)) return EXIT_ALLOW;
        if (!isJournalAvailable()) return EXIT_ALLOW;

        const input = reduceEnvelope(envelope);
        if (input === null) return EXIT_ALLOW;

        withJournal(consumerRoot, (h) => {
            recordEvent(h, {
                event: input.event,
                session_id: input.session_id,
                task_id: input.task_id,
                prompt_id: input.prompt_id,
                capability: input.capability,
            });
        });
    } catch {
        // Locked database, unreadable settings, contract violation, full disk —
        // never disturb the run. An instrument that can fail a turn is a
        // mechanism, and this is not one.
        return EXIT_ALLOW;
    }
    return EXIT_ALLOW;
}

/**
 * Test-facing: did this envelope produce a record, and if not, why not?
 *
 * Exists so a capture measurement can state a DENOMINATOR. Counting only the
 * records would make "the gate is off" and "the event is not in the vocabulary"
 * and "the write failed" indistinguishable, which is the blind-zero class the
 * roadmap's own 1.4 verify line refuses.
 */
export type SkipReason =
    | 'not-an-envelope'
    | 'replay-mode'
    | 'disabled'
    | 'sqlite-unavailable'
    | 'event-not-recorded'
    | 'no-session-id'
    | 'write-failed';

export function recordedFor(envelope: JsonValue, consumerRoot: string): SkipReason | null {
    if (!isObject(envelope)) return 'not-an-envelope';
    if (is_replay_mode()) return 'replay-mode';
    if (!hookSectionEnabled(consumerRoot, SETTINGS_SECTION)) return 'disabled';
    if (!isJournalAvailable()) return 'sqlite-unavailable';
    const input = reduceEnvelope(envelope);
    if (input === null) {
        const event = typeof envelope['event'] === 'string' ? envelope['event'] : '';
        return RECORDED_EVENTS.has(event) ? 'no-session-id' : 'event-not-recorded';
    }
    try {
        withJournal(consumerRoot, (h) => {
            recordEvent(h, {
                event: input.event,
                session_id: input.session_id,
                task_id: input.task_id,
                prompt_id: input.prompt_id,
                capability: input.capability,
            });
        });
    } catch {
        return 'write-failed';
    }
    return null;
}

/** The dispatcher's string-in entry point, kept for direct invocation. */
export function run(stdin_text: string, options: { consumer_root: string }): number {
    let envelope: JsonValue;
    try {
        const raw = stdin_text.trim();
        if (!raw) return EXIT_ALLOW;
        envelope = JSON.parse(raw) as JsonValue;
    } catch {
        return EXIT_ALLOW;
    }
    return processEnvelope(envelope, options.consumer_root);
}

export function main(): number {
    const raw = readHookStdin();
    let envelope: JsonValue = {};
    try {
        envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
    } catch {
        return EXIT_ALLOW;
    }
    return processEnvelope(envelope, resolveConsumerRoot(envelope));
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url`.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main());
