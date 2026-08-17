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
 * HOST BOUNDARY, STATED RATHER THAN IMPLIED. `pre_tool_use` is BOUND on three
 * hosts. Everywhere else the obligation stays model-carried, exactly as the two
 * rules already declare. Corrected 2026-08-17: this comment said the concern has
 * "nowhere to bind" elsewhere, which the manifest's own `native_event_aliases`
 * table refutes for cursor, cline and gemini — unbound, not unbindable. See
 * `docs/contracts/hook-architecture-v1.md` § Which hosts carry pre_tool_use. Run
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
 * A SHARED PREDICATE, NOT A DECISION INPUT HERE. `decide` does not branch on
 * it: the nudge's behaviour is unchanged by an artifact read, and the phase
 * that introduced this states `nothing behavioural`. The one consumer is
 * `report_consultation_rate`, which measures over transcripts. Keeping the
 * predicate beside `isUiWrite` / `isConsultation` is what stops the analyzer
 * and the nudge from classifying the same event differently.
 *
 * THIS IS A COPY OF THE RULE'S TRIGGERS, NOT A READ OF THEM — same honesty
 * boundary the header states for `ui_surface.ts`: nothing here parses
 * `src/rules/*.md`. `ui_route_nudge_artifact_read.test.ts` pins the two against
 * the rule's own frontmatter so the copy cannot drift silently.
 *
 * **Not disjoint from `isConsultation` by construction** —
 * `src/skills/design-review/references/design.html` satisfies both. Callers
 * must evaluate the two independently rather than branching on the first hit;
 * an early return on this predicate silently removes such an event from the
 * consultation numerator.
 *
 * **Known over-count, not fixed here.** A `Grep` / `Glob` whose `path` argument
 * happens to be the artifact satisfies this predicate although nothing was
 * read — the same search-is-not-a-read class `isConsultation` was narrowed to
 * exclude. It is not excluded here because `ToolEvent` carries no tool name,
 * and adding one would change the shared shape `isConsultation` and `isUiWrite`
 * are measured through, moving a published rate this branch does not own. The
 * consequence is stated where it matters: the rate is a CEILING on
 * read-before-write, and `report_consultation_rate`'s output says so.
 */
export function isArtifactRead(event: ToolEvent): boolean {
    if (event.isWrite || !event.file) return false;
    const normalized = event.file.replace(/\\/g, '/').toLowerCase();
    return normalized.endsWith('design.html') || normalized.includes('.claude/design-system/');
}

export interface SessionState {
    consulted: boolean;
    nudges: number;
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
    if (isConsultation(event)) {
        return { state: { ...state, consulted: true }, warn: false };
    }
    if (!isUiWrite(event)) return { state, warn: false };
    if (state.consulted) return { state, warn: false };
    if (state.nudges >= MAX_NUDGES) return { state, warn: false };
    return { state: { ...state, nudges: state.nudges + 1 }, warn: true };
}

/**
 * Did anything worth persisting change?
 *
 * Enumerated per field rather than deep-compared. **A new field must be added
 * here or it does not persist** — a review on this branch caught exactly that
 * shape: two session fields were computed on every event and written on none,
 * because the guard tested the two older fields by name. Those fields are gone
 * (the measurement lives in the analyzer, one implementation instead of two),
 * but the guard stays enumerated and this note stays with it.
 */
export function stateChanged(before: SessionState, after: SessionState): boolean {
    return before.consulted !== after.consulted || before.nudges !== after.nudges;
}

export function nudgeReason(file: string): string {
    return `Non-trivial UI write to ${file} with no design consultation this session. Run \`existing-ui-audit\` first, then the fe-design loop (brief → inventory, if an artifact was provided → build → review). Skip only if this is ui-trivial: <=1 file, <=5 lines, no new component, no new state, no new dependency.`;
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
