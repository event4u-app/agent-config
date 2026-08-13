#!/usr/bin/env tsx
/**
 * PreToolUse UI-route nudge — deterministic, warn-only, default-OFF.
 *
 * The two UI rules have `enforced_by: none` and say so honestly: nothing
 * observes whether a UI write consulted the design surface first. This concern
 * observes it — and it is a nudge, not a gate. It never blocks (dispatcher
 * contract: 0 allow · 2 warn), because the obligation it points at is a
 * judgement call and a block on a judgement call trades an ignore-problem for
 * a friction-problem.
 *
 * IT DOES NOT READ THE RULES. Stated because the first draft of this header
 * claimed it did. The UI-surface decision comes from `_lib/ui_surface.ts`; no
 * code here parses `src/rules/*.md` frontmatter, so the rules' `keyword:`
 * triggers still have no runtime consumer and this predicate is deliberately
 * wider than their `file_pattern` list. The two are kept from drifting by
 * `ui_rule_triggers.test.ts`, which asserts every declared pattern is accepted
 * here — a test, not a dependency.
 *
 * WHAT IT OBSERVES, WHICH IS ALSO THE MEASUREMENT.
 * Every PreToolUse event passes through here. A read or search touching a
 * design surface (`fe-design`, `existing-ui-audit`, `design-review`,
 * `design-intelligence`) latches "consulted" for the session. A Write or Edit
 * to a UI path with no such latch is the case the nudge exists for. That latch
 * is exactly the consultation signal the pre-registered consultation rate
 * counts, so the nudge and the metric read the same event stream rather than
 * two populations that could drift apart.
 *
 * ANTI-LOOP. At most `MAX_NUDGES` per session, then silent — the same
 * degradation valve `design_slop_hook` carries, for the same reason: an agent
 * that has decided to proceed must not be re-prompted into a loop.
 *
 * HOST BOUNDARY, STATED RATHER THAN IMPLIED. `pre_tool_use` exists on three
 * hosts. Everywhere else this concern has nowhere to bind and the obligation
 * stays model-carried, exactly as the two rules already declare. Run
 * `agent-config hooks:status` for the host you are actually on.
 *
 * Default-OFF: no-ops unless `hooks.ui_route_nudge.enabled: true`.
 * fail_closed: false — any error returns allow.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hookSectionEnabled } from '../_lib/hook_settings.js';
import { isUiPath, isUiTreePath } from '../_lib/ui_surface.js';
import { readHookStdin } from './hook_stdin.js';

const EXIT_ALLOW = 0;
const EXIT_WARN = 2;
/** Nudges per session before the valve goes silent. */
export const MAX_NUDGES = 2;

/** Reads or searches that count as consulting the design surface. */
export const DESIGN_SURFACES = [
    'fe-design',
    'existing-ui-audit',
    'design-review',
    'design-intelligence',
] as const;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function unwrap(envelope: JsonObject): JsonObject {
    const inner = envelope['payload'];
    return isObject(inner) ? inner : envelope;
}

export interface ToolEvent {
    /** Path the tool touches; "" when the tool names none. */
    file: string;
    /** True when the tool proposes new content (Write / Edit). */
    isWrite: boolean;
}

/** Best-effort extraction; mirrors the shape `design_slop_hook` reads. */
export function extractEvent(outer: JsonObject): ToolEvent | null {
    const envelope = unwrap(outer);
    const ti = envelope['tool_input'] ?? envelope['toolInput'] ?? envelope['input'];
    if (!isObject(ti)) return null;

    const fileVal = ti['file_path'] ?? ti['path'] ?? ti['filePath'];
    const file = typeof fileVal === 'string' ? fileVal : '';

    let isWrite = false;
    for (const key of ['content', 'new_string', 'new_str', 'text', 'newText']) {
        if (typeof ti[key] === 'string' && (ti[key] as string).length > 0) isWrite = true;
    }

    return { file, isWrite };
}

/**
 * True when the event OPENS one of the design surfaces.
 *
 * Deliberately narrow, and the narrowness is the fix for a real defect: an
 * earlier version matched the surface name anywhere in the path OR in any
 * search text the tool carried, including `command`. That silenced the nudge
 * for a whole session on a `git log -- src/skills/fe-design`, on a grep for
 * `design-review` while writing a review artefact, and on a read of
 * `src/rules/design-review-after-ui-write.md` — whose path contains the skill
 * name without being the skill. Since the same latch is the consultation
 * signal the pre-registered rate counts, one false positive corrupted both the
 * gate and the metric.
 *
 * So consultation means: a non-write touching `skills/<surface>/`. A search is
 * not a consultation — reading the skill is.
 */
export function isConsultation(event: ToolEvent): boolean {
    if (event.isWrite || !event.file) return false;
    const normalized = event.file.replace(/\\/g, '/').toLowerCase();
    return DESIGN_SURFACES.some((surface) => normalized.includes(`skills/${surface}/`));
}

/** True when the event writes a UI surface. */
export function isUiWrite(event: ToolEvent): boolean {
    if (!event.isWrite || !event.file) return false;
    return isUiPath(event.file) || isUiTreePath(event.file);
}

/**
 * The two handover shapes `design-fidelity` routes on a FILE rather than on a
 * word: its `file_pattern: *design.html` and its
 * `path_prefix: .claude/design-system/`. Reading one is the agent reaching
 * rung 1 of the data-basis ladder before it writes.
 *
 * THIS IS A COPY OF THE RULE'S TRIGGERS, NOT A READ OF THEM — same honesty
 * boundary the header states for `ui_surface.ts`: nothing here parses
 * `src/rules/*.md`. `ui_route_nudge_artifact_read.test.ts` pins the two against
 * the rule's own frontmatter so the copy cannot drift silently.
 */
export function isArtifactRead(event: ToolEvent): boolean {
    if (event.isWrite || !event.file) return false;
    const normalized = event.file.replace(/\\/g, '/').toLowerCase();
    return normalized.endsWith('design.html') || normalized.includes('.claude/design-system/');
}

export interface SessionState {
    consulted: boolean;
    nudges: number;
    /**
     * CAPTURE-ONLY. True once a provided-artifact file was read this session.
     *
     * It is deliberately NOT folded into `consulted`, and the distinction is
     * the whole point: folding it in would silence the nudge for a session that
     * opened a `design.html`, which is a **behaviour** change. The phase that
     * introduced this field ships instrumentation and states `nothing
     * behavioural` in its own rollback line, so the two cannot both be honoured
     * by one field. Whether an artifact read SHOULD latch consultation is a
     * real question and a separate decision — it needs the rate below to answer
     * it, which is why the rate is measured first.
     */
    artifactRead?: boolean;
    /**
     * CAPTURE-ONLY. The instrument: was an artifact read before the session's
     * FIRST UI write? Latched once, at that write. `undefined` = no UI write
     * yet, which is distinct from `false` (a write happened, unread) and must
     * stay distinct — collapsing them would count every read-only session as a
     * failure.
     */
    artifactReadBeforeFirstUiWrite?: boolean;
}

function stateFile(root: string): string {
    return path.join(root, 'agents', 'runtime', 'state', 'ui-route-nudge.json');
}

export function readState(root: string, session: string): SessionState {
    try {
        const all = JSON.parse(fs.readFileSync(stateFile(root), 'utf-8')) as Record<
            string,
            SessionState
        >;
        const entry = all[session];
        if (entry && typeof entry.consulted === 'boolean' && typeof entry.nudges === 'number') {
            return entry;
        }
    } catch {
        /* fresh session */
    }
    return { consulted: false, nudges: 0 };
}

/** Sessions retained in the state file; oldest entries drop past this. */
export const MAX_SESSIONS = 50;

/** Drop the oldest entries so the file cannot grow without bound. */
export function pruneSessions(
    all: Record<string, SessionState>,
    keep: number = MAX_SESSIONS,
): Record<string, SessionState> {
    const keys = Object.keys(all);
    if (keys.length <= keep) return all;
    const survivors = keys.slice(keys.length - keep);
    const pruned: Record<string, SessionState> = {};
    for (const key of survivors) pruned[key] = all[key]!;
    return pruned;
}

export function writeState(root: string, session: string, state: SessionState): void {
    try {
        const file = stateFile(root);
        let all: Record<string, SessionState> = {};
        try {
            all = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, SessionState>;
        } catch {
            // Fresh file, or one nothing can parse. There is no other session
            // state to preserve in either case — a corrupt file has already
            // lost it — so starting from empty is recovery, not discard. The
            // cost is bounded: a lost latch means at most MAX_NUDGES extra
            // reminders in the sessions that were in flight.
        }
        if (typeof all !== 'object' || all === null || Array.isArray(all)) all = {};
        all[session] = state;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(pruneSessions(all)));
    } catch {
        /* fail-open: a persistence failure must never break a tool call */
    }
}

/**
 * The decision, pure — so the test exercises the logic rather than the
 * filesystem. Returns the next state and whether to warn.
 */
export function decide(
    event: ToolEvent,
    state: SessionState,
): { state: SessionState; warn: boolean } {
    // Capture-only, and ordered first so it records even on an event the
    // branches below return early on. It never reaches `warn`.
    if (isArtifactRead(event)) {
        return { state: { ...state, artifactRead: true }, warn: false };
    }
    if (isConsultation(event)) {
        return { state: { ...state, consulted: true }, warn: false };
    }
    if (!isUiWrite(event)) return { state, warn: false };

    // Latch the instrument at the FIRST UI write, before any early return —
    // otherwise a session that consulted, or one past the valve, would never
    // record its own read-before-write outcome and the rate would be measured
    // over the nudged sessions alone.
    const measured: SessionState =
        state.artifactReadBeforeFirstUiWrite === undefined
            ? { ...state, artifactReadBeforeFirstUiWrite: state.artifactRead === true }
            : state;

    if (measured.consulted) return { state: measured, warn: false };
    if (measured.nudges >= MAX_NUDGES) return { state: measured, warn: false };
    return { state: { ...measured, nudges: measured.nudges + 1 }, warn: true };
}

/**
 * Did anything worth persisting change?
 *
 * Enumerated per field rather than deep-compared, and it is a real trap: the
 * predicate this replaced tested `consulted` and `nudges` only, so the two
 * capture-only fields would have been computed on every event and written on
 * none — an instrument that silently records nothing. A new field must be added
 * here or it does not persist.
 */
export function stateChanged(before: SessionState, after: SessionState): boolean {
    return (
        before.consulted !== after.consulted ||
        before.nudges !== after.nudges ||
        before.artifactRead !== after.artifactRead ||
        before.artifactReadBeforeFirstUiWrite !== after.artifactReadBeforeFirstUiWrite
    );
}

export function nudgeReason(file: string): string {
    return `Non-trivial UI write to ${file} with no design consultation this session. Run \`existing-ui-audit\` first, then the fe-design loop (brief → build → review). Skip only if this is ui-trivial: <=1 file, <=5 lines, no new component, no new state, no new dependency.`;
}

export function main(): number {
    let envelope: JsonValue;
    try {
        const raw = readHookStdin();
        if (!raw.trim()) return EXIT_ALLOW;
        envelope = JSON.parse(raw) as JsonValue;
    } catch {
        return EXIT_ALLOW;
    }
    if (!isObject(envelope)) return EXIT_ALLOW;

    const rootVal = envelope['workspace_root'];
    const root = typeof rootVal === 'string' && rootVal ? rootVal : process.cwd();
    if (!hookSectionEnabled(root, 'ui_route_nudge')) return EXIT_ALLOW;

    const sessionVal = envelope['session_id'];
    const session = typeof sessionVal === 'string' && sessionVal ? sessionVal : 'unknown';

    const event = extractEvent(envelope);
    if (!event) return EXIT_ALLOW;

    const before = readState(root, session);
    const { state, warn } = decide(event, before);
    if (stateChanged(before, state)) {
        writeState(root, session, state);
    }
    if (!warn) return EXIT_ALLOW;

    process.stdout.write(`${JSON.stringify({ reason: nudgeReason(event.file) })}\n`);
    return EXIT_WARN;
}

function isCliEntry(): boolean {
    const entry = process.argv[1];
    if (!entry) return false;
    return pathToFileURL(path.resolve(entry)).href === import.meta.url;
}

if (isCliEntry()) process.exit(main());

export const _HOOK_FILE = fileURLToPath(import.meta.url);
