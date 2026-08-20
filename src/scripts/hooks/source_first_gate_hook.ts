#!/usr/bin/env tsx
/**
 * source-first-gate — SHADOW ONLY (road-to-source-first-frontend Phase 3
 * Steps 1–2, activated per `docs/contracts/concern-activation-policy.md`).
 *
 * What it does: on every capture-shaped tool call, record what a source-first
 * gate WOULD have warned under several candidate gating rules. It emits
 * nothing to the model and it never blocks. Exit is always 0.
 *
 * ── Why shadow and not the step's literal "exit 2 warn" ───────────────────
 *
 * Phase 3 Step 1 was drafted as `exit 2 warn`; Step 2 left the posture as an
 * explicit maintainer call and the roadmap's own 2026-08-17 correction records
 * that the activation policy **contradicts** the drafted default-ON warn and
 * that the step "needs re-arguing against it, not a citation". Re-argued, and
 * the policy wins on both of the step's own dependencies:
 *
 *   1. **The verifier exemption stops being a shipping dependency.** Risk 3 of
 *      that roadmap is "the gate warns the one actor doing it right" — a
 *      verifier subagent screenshotting for QA. The harm in that risk is
 *      entirely in the *emission*: a concern that emits nothing warns nobody,
 *      correctly or otherwise. The clean exemption key is the payload
 *      `agent_id` / `agent_type` field that `road-to-subagent-lifecycle-
 *      integrity` Phase 0 Step 4 spikes and its Phase 4 Step 1 binds; both are
 *      still `[ ]`, and both are *fields on the record below* rather than
 *      branches, so the shadow window measures how large the exemption would
 *      have to be instead of guessing it.
 *   2. **The matcher census stops being a shipping dependency.** Phase 1
 *      Step 2 is `[~]`: one host was censused and its only capture tool
 *      (`screencapture`) photographs the display rather than a page, so a
 *      matcher built from it alone "would watch the wrong surface". Under a
 *      warn posture that is a false-positive generator. Under shadow it is the
 *      measurement — `capture_kind` below separates page-reaching capture from
 *      display capture on every record, which is exactly the datum the census
 *      is missing.
 *
 * The policy's ladder is `shadow → blocking`, with advisory as a *destination*
 * rather than a waiting room. This concern's intended terminal posture IS
 * advisory (a screenshot is a judgement call, the `ui-route-nudge` argument
 * verbatim, and Phase 3 Step 1 says "never a block"). That does not license
 * skipping shadow: the policy skips the advisory *rung* on the way to blocking
 * because a reminder buys little, and the same measurement debt applies to a
 * terminal advisory — without the shadow window there is no false-positive
 * rate for a warn either.
 *
 * ── Flip condition, pre-registered as Step 2 requires ─────────────────────
 *
 * Shadow → advisory (warn, exit 2) when ALL of:
 *   a. >= 100 capture-shaped records, or >= 2 weeks of window, whichever
 *      comes first, including at least one record with
 *      `handover_seen_in_session: true` (the policy's window floor);
 *   b. one candidate rule's false-positive share — records where the
 *      candidate would warn AND `capture_kind` is not `page` — is <= 1 %;
 *   c. `verifier_exemption_decidable` is true on the records, i.e. SLI
 *      Phase 4 Step 1 has landed and the payload axis can carry the
 *      exemption;
 *   d. the shipped matcher is narrowed to the entries that actually appear,
 *      which closes Phase 1 Step 2's multi-host half by observation.
 * Reverse trigger: no records in 8 weeks → evaluate removal; the concern's
 * population would then be as empty as the read-before-write rate's.
 *
 * ── What this does NOT measure, stated rather than implied ────────────────
 *
 * "The session has a routed design handover" is the step's first condition and
 * **nothing records it**. `design-fidelity` is a rule; it has no runtime
 * carrier, so "the same trigger event `design-fidelity` records" describes an
 * event that does not exist. Two observable proxies are recorded side by side
 * instead of one being promoted by preference — a handover path named by any
 * tool this session, and a handover artifact present on disk — and the
 * candidate spread is what tells them apart. Picking one now would be the
 * threshold-first mistake the activation policy names.
 *
 * PRIVACY BY CONSTRUCTION: booleans, counts, a matcher label, and the
 * id-shaped `agent_type` enum (recorded verbatim, the same stance
 * `subagent_ledger_hook.ts` states for that field). No prompt, no command
 * text, no file path, no `agent_id` — the record type has no field able to
 * hold any.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { is_replay_mode } from './state_io.js';
import { readHookStdin } from './hook_stdin.js';
import { resolveConsumerRoot } from './subagent_ledger_hook.js';

const EXIT_ALLOW = 0;

/** Would-warns per session before the valve goes silent — `MAX_NUDGES` shape. */
export const MAX_SHADOW_WARNS = 2;

/** Shadow log; `/agents/runtime/` is gitignored, so this stays local-only. */
export const SHADOW_LOG = path.join('agents', 'runtime', 'state', 'source-first-gate.jsonl');
/** Per-session latches. */
export const STATE_FILE = path.join('agents', 'runtime', 'state', 'source-first-gate.json');

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function unwrapPayload(envelope: JsonObject): JsonObject {
    const inner = envelope['payload'];
    return isObject(inner) ? inner : envelope;
}

/**
 * What a capture-shaped tool call reaches.
 *
 * `page` is the surface this concern cares about; `display` is the Phase-1
 * census finding that the one tool actually present on the censused host
 * photographs the physical screen, so it cannot be the "screenshot instead of
 * source" path at all. Keeping them apart on every record is what lets the
 * flip condition compute a false-positive share instead of asserting one.
 */
export type CaptureKind = 'page' | 'display' | 'unknown';

export interface MatcherHit {
    readonly label: string;
    readonly capture_kind: CaptureKind;
}

/**
 * Tool-name matchers. TREE-SOURCED, not recalled — each entry is a name this
 * repository already writes down, which is the closest available substitute
 * for the multi-host census Phase 1 Step 2 could not finish:
 *
 *   - `browser_take_screenshot` — `src/skills/mcp/SKILL.md` § tool table.
 *   - `claude-in-chrome` — `src/skills/screenshot-hygiene/SKILL.md`,
 *     `docs/decisions/ADR-125-doc-screenshot-anonymization.md`.
 *   - `screencapture` — the one entry the census measured present,
 *     `tests/design-artifacts/eval-fixtures.md` § the census note.
 *
 * The trailing generic patterns exist because host tool naming varies (the
 * `Bash`/`BashTool`/`launch-process` spread the manifest already warns about
 * for the blocking guards). Under shadow an over-broad matcher costs a log
 * line, and its breadth is the thing being measured; a narrowed shipped
 * matcher is flip condition (d).
 */
export const TOOL_MATCHERS: readonly { pattern: RegExp; hit: MatcherHit }[] = [
    { pattern: /^browser_take_screenshot$/i, hit: { label: 'playwright-mcp', capture_kind: 'page' } },
    { pattern: /^mcp__claude-in-chrome__/i, hit: { label: 'claude-in-chrome', capture_kind: 'page' } },
    { pattern: /^(browser_)?take_screenshot$/i, hit: { label: 'chrome-devtools-mcp', capture_kind: 'page' } },
    { pattern: /screen_?shot/i, hit: { label: 'tool-name-generic', capture_kind: 'unknown' } },
    { pattern: /screen_?capture/i, hit: { label: 'tool-name-generic', capture_kind: 'unknown' } },
];

/** Shell-shaped tool names whose command string is worth reading. */
const SHELL_TOOLS = /^(bash|bashtool|launch[-_]process|shell|run[-_]command)$/i;

/** Command-text matchers for a capture reached through a shell. */
export const COMMAND_MATCHERS: readonly { pattern: RegExp; hit: MatcherHit }[] = [
    { pattern: /\bscreencapture\b/i, hit: { label: 'macos-screencapture', capture_kind: 'display' } },
    { pattern: /\bimport\s+-window\b/i, hit: { label: 'x11-import', capture_kind: 'display' } },
    { pattern: /\bgnome-screenshot\b|\bspectacle\b|\bscrot\b/i, hit: { label: 'linux-screenshot', capture_kind: 'display' } },
];

/**
 * The handover path shapes `design-fidelity` routes on a FILE rather than on a
 * word: `file_pattern: *design.html` and `path_prefix: .claude/design-system/`.
 *
 * DIRECTION-AGNOSTIC ON PURPOSE, and that is the one difference from
 * `ui_route_nudge_hook.isArtifactRead`, which requires a non-write. Handover
 * *presence* and handover *having been read* are the two separate facts this
 * concern needs, and a single predicate cannot carry both. The read latch
 * below delegates to that exported predicate rather than re-deriving it;
 * `source_first_gate.test.ts` pins the two path shapes against each other so
 * the copy cannot drift.
 */
export function isHandoverPath(file: string): boolean {
    if (!file) return false;
    const normalized = file.replace(/\\/g, '/').toLowerCase();
    return normalized.endsWith('design.html') || normalized.includes('.claude/design-system/');
}

export interface CaptureEvent {
    /** Matcher hit, or null when this is not a capture-shaped call. */
    readonly capture: MatcherHit | null;
    /** Path the tool names; "" when it names none. */
    readonly file: string;
    /** True when the tool proposes new content (Write / Edit shape). */
    readonly isWrite: boolean;
    readonly agentIdPresent: boolean;
    readonly agentType: string | null;
}

function str(o: JsonObject, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v) return v;
    }
    return null;
}

/** Classify one envelope. Pure apart from the regex tables above. */
export function extractEvent(outer: JsonValue): CaptureEvent | null {
    if (!isObject(outer)) return null;
    const payload = unwrapPayload(outer);
    const toolName = str(payload, 'tool_name', 'toolName', 'tool');

    const ti = payload['tool_input'] ?? payload['toolInput'] ?? payload['input'];
    const input = isObject(ti) ? ti : {};
    const file = str(input, 'file_path', 'path', 'filePath') ?? '';
    let isWrite = false;
    for (const key of ['content', 'new_string', 'new_str', 'text', 'newText']) {
        if (typeof input[key] === 'string' && (input[key] as string).length > 0) isWrite = true;
    }

    let capture: MatcherHit | null = null;
    if (toolName) {
        for (const m of TOOL_MATCHERS) {
            if (m.pattern.test(toolName)) {
                capture = m.hit;
                break;
            }
        }
        if (!capture && SHELL_TOOLS.test(toolName)) {
            const command = str(input, 'command', 'cmd', 'script') ?? '';
            for (const m of COMMAND_MATCHERS) {
                if (m.pattern.test(command)) {
                    capture = m.hit;
                    break;
                }
            }
        }
    }

    return {
        capture,
        file,
        isWrite,
        agentIdPresent: str(payload, 'agent_id', 'agentId') !== null,
        agentType: str(payload, 'agent_type', 'agentType'),
    };
}

export interface SessionState {
    /** A handover path was named by any tool this session. */
    handoverSeen: boolean;
    /** A handover artifact was READ this session (rung 1 of the ladder). */
    sourceRead: boolean;
    /** Would-warns already recorded, for the valve arm. */
    wouldWarn: number;
}

export const EMPTY_STATE: SessionState = { handoverSeen: false, sourceRead: false, wouldWarn: 0 };

/** Sessions retained; oldest drop past this — `ui_route_nudge` shape. */
export const MAX_SESSIONS = 50;

export function readState(root: string, session: string): SessionState {
    try {
        const all = JSON.parse(fs.readFileSync(path.join(root, STATE_FILE), 'utf-8')) as Record<
            string,
            SessionState
        >;
        const entry = all[session];
        if (
            entry &&
            typeof entry.handoverSeen === 'boolean' &&
            typeof entry.sourceRead === 'boolean' &&
            typeof entry.wouldWarn === 'number'
        ) {
            return entry;
        }
    } catch {
        /* fresh session */
    }
    return { ...EMPTY_STATE };
}

export function writeState(root: string, session: string, state: SessionState): void {
    if (is_replay_mode()) return;
    try {
        const file = path.join(root, STATE_FILE);
        let all: Record<string, SessionState> = {};
        try {
            all = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, SessionState>;
        } catch {
            // Fresh or unparseable. A corrupt file has already lost whatever
            // it held, so starting empty is recovery rather than discard; the
            // cost is bounded to a re-latch in the sessions in flight.
        }
        if (!isObject(all as unknown)) all = {};
        all[session] = state;
        const keys = Object.keys(all);
        if (keys.length > MAX_SESSIONS) {
            const pruned: Record<string, SessionState> = {};
            for (const key of keys.slice(keys.length - MAX_SESSIONS)) pruned[key] = all[key]!;
            all = pruned;
        }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(all));
    } catch {
        /* fail-open: a persistence failure must never disturb a tool call */
    }
}

/** One candidate gating rule under shadow evaluation. */
export interface Candidate {
    readonly label: string;
    readonly requiresHandoverSeen: boolean;
    readonly requiresHandoverOnDisk: boolean;
    /** Either proxy satisfies the handover condition. */
    readonly handoverEither: boolean;
}

/**
 * The candidate spread. `handover-session` is Phase 3 Step 1's literal gating
 * rule, carried as ONE candidate rather than as the answer; `unread-only` is
 * the loosest rule and therefore the fire-volume ceiling the others are read
 * against. A spread yields the curve the activation policy derives from — one
 * candidate would only yield a yes/no.
 */
export const CANDIDATES: readonly Candidate[] = [
    { label: 'handover-session', requiresHandoverSeen: true, requiresHandoverOnDisk: false, handoverEither: false },
    { label: 'handover-disk', requiresHandoverSeen: false, requiresHandoverOnDisk: true, handoverEither: false },
    { label: 'handover-either', requiresHandoverSeen: false, requiresHandoverOnDisk: false, handoverEither: true },
    { label: 'unread-only', requiresHandoverSeen: false, requiresHandoverOnDisk: false, handoverEither: false },
];

export interface CandidateVerdict {
    readonly label: string;
    readonly would_warn: boolean;
}

export function evaluateCandidates(
    handoverSeen: boolean,
    handoverOnDisk: boolean,
    sourceRead: boolean,
): CandidateVerdict[] {
    return CANDIDATES.map((c) => {
        if (sourceRead) return { label: c.label, would_warn: false };
        if (c.requiresHandoverSeen) return { label: c.label, would_warn: handoverSeen };
        if (c.requiresHandoverOnDisk) return { label: c.label, would_warn: handoverOnDisk };
        if (c.handoverEither) return { label: c.label, would_warn: handoverSeen || handoverOnDisk };
        return { label: c.label, would_warn: true };
    });
}

/** True when a handover artifact sits in the workspace, independent of reads. */
export function handoverPresentOnDisk(root: string): boolean {
    try {
        return fs.statSync(path.join(root, '.claude', 'design-system')).isDirectory();
    } catch {
        return false;
    }
}

export function appendShadowLine(root: string, line: Record<string, unknown>): void {
    if (is_replay_mode()) return;
    try {
        const file = path.join(root, SHADOW_LOG);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
    } catch {
        /* never disturb a tool call for a measurement */
    }
}

/**
 * The state transition, pure — so the test exercises the logic rather than the
 * filesystem. A handover path seen latches presence; a handover READ latches
 * rung 1. The read latch must be evaluated independently of the presence latch:
 * an early return on the first hit would drop the read from the numerator, the
 * same not-disjoint hazard `isArtifactRead`'s own header records.
 */
export function nextState(event: CaptureEvent, state: SessionState): SessionState {
    let next = state;
    if (isHandoverPath(event.file)) next = { ...next, handoverSeen: true };
    if (!event.isWrite && isHandoverPath(event.file)) next = { ...next, sourceRead: true };
    return next;
}

export function processEnvelope(envelope: JsonValue, consumerRoot: string, session: string): number {
    try {
        const event = extractEvent(envelope);
        if (!event) return EXIT_ALLOW;

        const before = readState(consumerRoot, session);
        const after = nextState(event, before);

        if (event.capture === null) {
            if (
                after.handoverSeen !== before.handoverSeen ||
                after.sourceRead !== before.sourceRead
            ) {
                writeState(consumerRoot, session, after);
            }
            return EXIT_ALLOW;
        }

        const onDisk = handoverPresentOnDisk(consumerRoot);
        const verdicts = evaluateCandidates(after.handoverSeen, onDisk, after.sourceRead);
        const anyWarn = verdicts.some((v) => v.would_warn);
        const valveWouldSilence = before.wouldWarn >= MAX_SHADOW_WARNS;
        const nowIso = new Date().toISOString();

        appendShadowLine(consumerRoot, {
            event: 'source_first_gate_shadow',
            ts: nowIso,
            tool_matcher: event.capture.label,
            // The census finding, on every record: `display` capture cannot be
            // the "screenshot instead of source" path, so a candidate warning
            // on one is a false positive by construction. Flip condition (b)
            // computes its share from this field.
            capture_kind: event.capture.capture_kind,
            handover_seen_in_session: after.handoverSeen,
            handover_present_on_disk: onDisk,
            source_read_in_session: after.sourceRead,
            prior_would_warn_this_session: before.wouldWarn,
            valve_would_silence: valveWouldSilence,
            candidates: verdicts.map((v) => ({ label: v.label, would_warn: v.would_warn })),
            // The verifier exemption's key, measured rather than assumed. Both
            // SLI Phase 0 Step 4 and Phase 4 Step 1 are open, so this is
            // expected false today; a run of trues is what makes flip
            // condition (c) satisfiable.
            agent_id_present: event.agentIdPresent,
            agent_type: event.agentType,
            verifier_exemption_decidable: event.agentIdPresent || event.agentType !== null,
            // Shadow is a property of this file, not of a setting — there is no
            // code path here that can warn or deny.
            posture: 'shadow',
        });

        const persisted =
            anyWarn && !valveWouldSilence ? { ...after, wouldWarn: after.wouldWarn + 1 } : after;
        writeState(consumerRoot, session, persisted);
    } catch {
        return EXIT_ALLOW;
    }
    return EXIT_ALLOW;
}

export function main(): number {
    const raw = readHookStdin();
    let envelope: JsonValue = {};
    try {
        envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
    } catch {
        return EXIT_ALLOW;
    }
    const sessionVal = isObject(envelope) ? envelope['session_id'] : null;
    const session = typeof sessionVal === 'string' && sessionVal ? sessionVal : 'unknown';
    return processEnvelope(envelope, resolveConsumerRoot(envelope), session);
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url`.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
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
