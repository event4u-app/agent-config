/**
 * run_continuation — road-to-long-horizon-execution Phase 1 (H-1).
 *
 * The stop slot's first WORK-REMAINING concern. Every other stop concern is a
 * quality or state concern; this one compares the session's contracted scope
 * against roadmap checkbox state and, when contracted work remains, returns
 * the dispatcher's block verdict with a continuation naming the next unchecked
 * step and its `verify:` line. The dispatcher translates a stop-slot block to
 * host exit 2, and the host feeds this concern's stderr back to the agent —
 * that channel IS the re-engagement; no daemon, no second process.
 *
 * SHAPE PROVENANCE, and the three deliberate differences. The allow/deny-plus-
 * continuation shape is claude-flow's `autopilotCheck` (commands/autopilot.ts
 * @ fa13ee4, v3.38.12), verified at source in the roadmap's § 1. AC's version
 * differs by design, not oversight:
 *
 *   1. The progress signal is the claimed roadmap's own checkboxes — the same
 *      artefact `roadmap-progress` already watches — never a parallel task
 *      file that can drift from the roadmap it mirrors.
 *   2. Quality gates take precedence. Concerns run SEQUENTIALLY in chain
 *      order (dispatch_hook.ts § runner); this concern is registered AFTER
 *      `turn-end-gate`, and when the gate refused THIS turn (its refusal
 *      marker carries the turn ordinal) this concern defers. A turn refused
 *      for unverified claims is never re-engaged past the refusal — the
 *      upstream's naked "Do not stop until all are complete" is the
 *      anti-pattern this branch exists against.
 *   3. Every re-engagement names the next step and its `verify:` line. A
 *      continuation that does not say what "continue" means just burns an
 *      iteration on re-orientation.
 *
 * CONTRACT GATING — when this concern is a no-op, which is almost always:
 *   · no roadmap claim for this session (`sessions:claim` never ran), or
 *   · the claimed roadmap's frontmatter `execution.mode` is anything but
 *     `autonomous` (absent, `interactive`, `phase-checkpoints` — a
 *     checkpointed run WANTS its phase-boundary conversation), or
 *   · replay mode, or the kill switch `AGENT_CONFIG_NO_RUN_CONTINUATION=1`.
 * The claim file plus the mode field is the run contract this file consumes;
 * it invents no second contract carrier.
 *
 * TERMINATION LADDER (Phase 1.1) — every rung a named event in
 * `agents/runtime/state/run-continuation.jsonl`:
 *   contract absent            → no-op (no event; the common case is silent)
 *   quality-gate refusal       → defer            (event: deferred-quality-gate)
 *   duplicate stop fire        → repeat the BLOCK, no count (event: none —
 *                                an allow here would END the reply the block
 *                                one event earlier exists to continue)
 *   scope complete (0 open)    → allow            (event: complete; state cleared)
 *   iterations ≥ MAX (25)      → allow            (event: halt-max-iterations)
 *   wall clock ≥ cap (4 h)     → allow            (event: halt-wall-clock)
 *   stall (3 engagements, no
 *   checkbox delta)            → allow            (event: halt-stall)
 *   otherwise                  → BLOCK + continue (event: engage)
 *
 * Stall counts CONSECUTIVE ENGAGEMENTS whose open-step count did not move.
 * The upstream stalls on 5-of-5 completed-count readings; AC's checkbox
 * signal is finer-grained (a step in progress usually flips SOMETHING), so
 * the default is tighter at 3 — pre-registered for revisit against Phase 4
 * data in the roadmap, not tuned here.
 *
 * `[~]` (deferred) and `[-]` (cancelled) boxes are not open work — the
 * vocabulary is `update_roadmap_progress.ts`'s. A step carrying a
 * `blocked-by:` marker is open work this RUN cannot do, so it neither counts
 * toward the open total nor gets named as the next step: re-engaging an
 * agent into a step the roadmap itself declares blocked is a guaranteed
 * stall, manufactured by the mechanism whose job is to detect one.
 *
 * FAIL-OPEN THROUGHOUT. severity: advisory, fail_closed: false. Any read
 * error, any malformed state, any surprise → EXIT_ALLOW. A continuation
 * mechanism must never be the thing that blocks a stop for a reason nobody
 * can see; the only BLOCK this file emits is the one that carries its own
 * explanation on stderr.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { is_replay_mode } from './state_io.js';
import { readTranscriptTail } from './turn_end_gate_hook.js';
import { read_claimed_slug } from '../session_register_hook.js';
import {
    deriveSessionKey,
    parseRecord,
    sessionRefusalFile,
} from '../_lib/turn_end_refusals.js';

const EXIT_ALLOW = 0;
/** Dispatcher-internal block code; the dispatcher maps stop-slot 1 → host 2. */
const EXIT_BLOCK = 1;

/** Same cap the interruption ledger reads its tail under. */
const TRANSCRIPT_READ_MAX_BYTES = 2 * 1024 * 1024;

export const EVENTS_RELPATH = path.join(
    'agents',
    'runtime',
    'state',
    'run-continuation.jsonl',
);
const STATE_DIR_REL = path.join('agents', 'runtime', 'state');

/** Ladder defaults. Phase 1.1 pre-registers all three for revisit, not tuning. */
export const MAX_ITERATIONS = 25;
export const WALL_CLOCK_CAP_MS = 4 * 60 * 60 * 1000;
export const STALL_WINDOW = 3;

export interface RunState {
    started_at: string;
    iterations: number;
    last_turn: number;
    /** Open-step count recorded at each engagement, newest last. */
    history: number[];
    /** ISO stamp of the most recent engagement — half of the duplicate key. */
    last_engaged_at?: string;
}

/**
 * A host may fire `stop` more than once for one reply (the turn-end gate
 * documents the same quirk). The duplicate key is ordinal + open-count +
 * a short window, because the ordinal ALONE is not a turn identity here:
 * a re-engaged reply often lands in the same user turn, so its ordinal is
 * unchanged even though real work happened — the open count is what moved.
 */
export const DUPLICATE_WINDOW_MS = 60 * 1000;

export function isDuplicateFire(
    state: RunState | null,
    turnOrdinal: number,
    openCount: number,
    nowMs: number,
): boolean {
    if (state === null) return false;
    if (state.last_turn !== turnOrdinal) return false;
    if (state.history.length === 0 || state.history[state.history.length - 1] !== openCount) {
        return false;
    }
    const at = Date.parse(state.last_engaged_at ?? '');
    return Number.isFinite(at) && nowMs - at < DUPLICATE_WINDOW_MS;
}

export interface NextStep {
    /** The step's own line, checkbox stripped, truncated for the message. */
    text: string;
    /** The step's `verify:` command, when its line carries one. */
    verify: string | null;
}

export interface ScanResult {
    /** Open (`- [ ]`) steps that are not `blocked-by:`-marked. */
    open: number;
    /** Open steps excluded because their line carries `blocked-by:`. */
    blocked: number;
    next: NextStep | null;
}

export type LadderAction =
    | 'engage'
    | 'complete'
    | 'halt-max-iterations'
    | 'halt-wall-clock'
    | 'halt-stall';

/**
 * Frontmatter `execution.mode`, or null. Line-oriented on purpose: the
 * frontmatter this repo writes is two levels deep at most, and a YAML parser
 * on the Stop path is a dependency this read does not need.
 */
export function parseExecutionMode(text: string): string | null {
    if (!text.startsWith('---')) return null;
    const end = text.indexOf('\n---', 3);
    if (end === -1) return null;
    const fm = text.slice(0, end);
    if (!/^execution:\s*$/m.test(fm)) return null;
    const m = fm.match(/^\s+mode:\s*(\S+)\s*$/m);
    return m ? m[1]! : null;
}

const OPEN_BOX = /^[ \t]*-\s\[ \]\s+(.*)$/;

/**
 * Count open steps and pick the next one. `[~]` / `[-]` never match the open
 * pattern; a `blocked-by:` marker on the step's own line excludes it from
 * both the count and the pick (see the header for why).
 */
export function scanOpenSteps(text: string): ScanResult {
    let open = 0;
    let blocked = 0;
    let next: NextStep | null = null;
    for (const line of text.split('\n')) {
        const m = OPEN_BOX.exec(line);
        if (!m) continue;
        const body = m[1]!;
        if (body.includes('blocked-by:')) {
            blocked += 1;
            continue;
        }
        open += 1;
        if (next === null) {
            const verifyMatch = body.match(/<!--\s*verify:\s*(.*?)\s*-->/);
            const cleaned = body
                .replace(/<!--.*?-->/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            next = {
                text: cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned,
                verify: verifyMatch ? verifyMatch[1]! : null,
            };
        }
    }
    return { open, blocked, next };
}

/**
 * The termination ladder, pure. `state` is the record BEFORE this stop;
 * `openCount` is the scan of the claimed roadmap as it stands now.
 */
export function ladder(
    state: RunState,
    openCount: number,
    nowMs: number,
    caps: { maxIterations: number; wallClockMs: number; stallWindow: number } = {
        maxIterations: MAX_ITERATIONS,
        wallClockMs: WALL_CLOCK_CAP_MS,
        stallWindow: STALL_WINDOW,
    },
): LadderAction {
    if (openCount === 0) return 'complete';
    if (state.iterations >= caps.maxIterations) return 'halt-max-iterations';
    const started = Date.parse(state.started_at);
    if (Number.isFinite(started) && nowMs - started >= caps.wallClockMs) {
        return 'halt-wall-clock';
    }
    const tail = state.history.slice(-caps.stallWindow);
    if (tail.length >= caps.stallWindow && tail.every((n) => n === openCount)) {
        return 'halt-stall';
    }
    return 'engage';
}

export function stateRelPath(runId: string): string {
    const safe = runId.replace(/[^A-Za-z0-9_-]/g, '_');
    return path.join(STATE_DIR_REL, `run-continuation-${safe}.json`);
}

function readState(file: string): RunState | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (parsed === null || typeof parsed !== 'object') return null;
        const o = parsed as Record<string, unknown>;
        if (typeof o['started_at'] !== 'string') return null;
        if (typeof o['iterations'] !== 'number') return null;
        if (typeof o['last_turn'] !== 'number') return null;
        if (!Array.isArray(o['history'])) return null;
        const rec: RunState = {
            started_at: o['started_at'],
            iterations: o['iterations'],
            last_turn: o['last_turn'],
            history: (o['history'] as unknown[]).filter(
                (n): n is number => typeof n === 'number',
            ),
        };
        if (typeof o['last_engaged_at'] === 'string') {
            rec.last_engaged_at = o['last_engaged_at'];
        }
        return rec;
    } catch {
        return null;
    }
}

function appendEvent(workspaceRoot: string, record: JsonObject): void {
    try {
        const file = path.join(workspaceRoot, EVENTS_RELPATH);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
    } catch {
        // The ledger is observability, never a reason to change the verdict.
    }
}

/**
 * True when `turn-end-gate` refused exactly this turn — the defer branch.
 * Race-free by chain order: concerns run sequentially and this concern is
 * registered after the gate, so the gate's marker for this turn is on disk
 * before this read happens.
 */
export function refusedThisTurn(
    workspaceRoot: string,
    sessionId: string,
    turnOrdinal: number,
): boolean {
    try {
        const file = sessionRefusalFile(workspaceRoot, deriveSessionKey(sessionId || 'unknown-session'));
        const rec = parseRecord(fs.readFileSync(file, 'utf-8'));
        return rec !== null && rec.refused_turn === turnOrdinal;
    } catch {
        return false;
    }
}

function str(v: JsonValue | undefined): string {
    return typeof v === 'string' ? v : '';
}

export function main(): number {
    if (is_replay_mode()) return EXIT_ALLOW;
    if (process.env['AGENT_CONFIG_NO_RUN_CONTINUATION'] === '1') return EXIT_ALLOW;

    let envelope: JsonObject;
    let payload: JsonObject;
    try {
        [envelope, payload] = unwrap(readHookStdin(), 'claude');
    } catch {
        return EXIT_ALLOW;
    }

    const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined) || process.cwd();
    const sessionId =
        str(payload['session_id'] as JsonValue | undefined) ||
        str(envelope['session_id'] as JsonValue | undefined);

    // ── contract gate ────────────────────────────────────────────────
    const slug = read_claimed_slug(workspaceRoot, sessionId || null);
    if (slug === null) return EXIT_ALLOW;

    const roadmapPath = path.join(workspaceRoot, 'agents', 'roadmaps', `${slug}.md`);
    let roadmapText: string;
    try {
        roadmapText = fs.readFileSync(roadmapPath, 'utf8');
    } catch {
        // A claim naming no readable roadmap is the stale-claim state the
        // session register already labels; not this concern's problem.
        return EXIT_ALLOW;
    }
    if (parseExecutionMode(roadmapText) !== 'autonomous') return EXIT_ALLOW;

    // ── turn identity ────────────────────────────────────────────────
    const transcriptPath = str(
        (payload['transcript_path'] ?? payload['transcriptPath']) as JsonValue | undefined,
    );
    if (!transcriptPath) return EXIT_ALLOW;
    let turnOrdinal = 0;
    try {
        turnOrdinal = readTranscriptTail(transcriptPath, {
            maxBytes: TRANSCRIPT_READ_MAX_BYTES,
        }).turnOrdinal;
    } catch {
        return EXIT_ALLOW;
    }

    const runId = deriveSessionKey(sessionId || 'unknown-session');

    // ── defer to the quality gate ────────────────────────────────────
    if (refusedThisTurn(workspaceRoot, sessionId, turnOrdinal)) {
        appendEvent(workspaceRoot, {
            event: 'deferred-quality-gate',
            run_id: runId,
            roadmap: slug,
            turn: turnOrdinal,
            at: new Date().toISOString(),
        });
        return EXIT_ALLOW;
    }

    // ── state + duplicate-fire detection ─────────────────────────────
    const stateFile = path.join(workspaceRoot, stateRelPath(runId));
    const prev = readState(stateFile);
    const state: RunState = prev ?? {
        started_at: new Date().toISOString(),
        iterations: 0,
        last_turn: -1,
        history: [],
    };

    const scan = scanOpenSteps(roadmapText);

    // A duplicate stop fire repeats the SAME verdict without consuming an
    // iteration. It must repeat the BLOCK: this concern just blocked this
    // very stop, and an allow on the re-fire would end the reply the block
    // exists to continue. (An earlier draft allowed here — the smoke run
    // caught it ending the run it had re-engaged one event earlier.)
    if (isDuplicateFire(prev, turnOrdinal, scan.open, Date.now())) {
        process.stderr.write(_continuationText(slug, scan, state.iterations));
        return EXIT_BLOCK;
    }

    const action = ladder(state, scan.open, Date.now());

    if (action !== 'engage') {
        appendEvent(workspaceRoot, {
            event: action,
            run_id: runId,
            roadmap: slug,
            turn: turnOrdinal,
            iterations: state.iterations,
            open: scan.open,
            blocked: scan.blocked,
            at: new Date().toISOString(),
        });
        // A finished ladder clears its state so a later run on the same
        // roadmap (post-merge follow-up, re-claim) starts a fresh budget.
        try {
            fs.rmSync(stateFile, { force: true });
        } catch {
            /* fail-open */
        }
        return EXIT_ALLOW;
    }

    state.iterations += 1;
    state.last_turn = turnOrdinal;
    state.history.push(scan.open);
    state.last_engaged_at = new Date().toISOString();
    try {
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        fs.writeFileSync(stateFile, `${JSON.stringify(state)}\n`, 'utf8');
    } catch {
        // If the counter cannot persist, the ladder cannot bound the loop —
        // so the loop must not run. Allowing here is the fail-open posture
        // applied to the ONE branch where a lost write means an unbounded
        // re-engagement rather than a missed one.
        return EXIT_ALLOW;
    }

    appendEvent(workspaceRoot, {
        event: 'engage',
        run_id: runId,
        roadmap: slug,
        turn: turnOrdinal,
        iteration: state.iterations,
        open: scan.open,
        blocked: scan.blocked,
        at: new Date().toISOString(),
    });

    process.stderr.write(_continuationText(slug, scan, state.iterations));
    return EXIT_BLOCK;
}

function _continuationText(slug: string, scan: ScanResult, iteration: number): string {
    const stepLine = scan.next
        ? `Next step: ${scan.next.text}` +
          (scan.next.verify ? `\n  verify: ${scan.next.verify}` : '')
        : 'Next step: (first open checkbox in the roadmap)';
    return (
        `run-continuation: the contracted roadmap \`${slug}\` has ${scan.open} open ` +
        `step${scan.open === 1 ? '' : 's'}` +
        (scan.blocked > 0 ? ` (+${scan.blocked} blocked-by, not yours this run)` : '') +
        ` — iteration ${iteration}/${MAX_ITERATIONS}.\n` +
        `${stepLine}\n` +
        'Continue with this step now: do the work, run its verify line, flip ' +
        'the box, then end the turn. Escalate instead of continuing ONLY for a ' +
        'locked decision class (high_impact / user_required) or a halt your ' +
        'contract names.\n'
    );
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
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
