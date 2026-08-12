#!/usr/bin/env tsx
/**
 * PreToolUse UI-route nudge — deterministic, warn-only, default-OFF.
 *
 * The two UI rules have `enforced_by: none` and say so honestly: nothing
 * observes whether a UI write consulted the design surface first. This is the
 * first runtime consumer those rules' triggers have ever had — and it is a
 * nudge, not a gate. It never blocks (dispatcher contract: 0 allow · 2 warn),
 * because the obligation it points at is a judgement call and a block on a
 * judgement call trades an ignore-problem for a friction-problem.
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
    /** Free-text the tool carries (a grep pattern, a glob). */
    query: string;
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

    const parts: string[] = [];
    for (const key of ['pattern', 'query', 'glob', 'command']) {
        const v = ti[key];
        if (typeof v === 'string') parts.push(v);
    }

    return { file, isWrite, query: parts.join(' ') };
}

/** True when the event reads or searches one of the design surfaces. */
export function isConsultation(event: ToolEvent): boolean {
    if (event.isWrite) return false;
    const haystack = `${event.file} ${event.query}`.toLowerCase();
    return DESIGN_SURFACES.some((surface) => haystack.includes(surface));
}

/** True when the event writes a UI surface. */
export function isUiWrite(event: ToolEvent): boolean {
    if (!event.isWrite || !event.file) return false;
    return isUiPath(event.file) || isUiTreePath(event.file);
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

export function writeState(root: string, session: string, state: SessionState): void {
    try {
        const file = stateFile(root);
        let all: Record<string, SessionState> = {};
        try {
            all = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, SessionState>;
        } catch {
            /* fresh file */
        }
        all[session] = state;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(all));
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
    if (state.consulted !== before.consulted || state.nudges !== before.nudges) {
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
