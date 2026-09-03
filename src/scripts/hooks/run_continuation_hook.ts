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
 *   roadmap unreadable from the
 *   authoritative tree         → allow  (event: halt-roadmap-absent, ONCE PER
 *                                ABSENCE EPISODE with a readable state and ONCE PER
 *                                RUN without one — the two guards have different
 *                                carriers: `absent_fires` resets on a successful
 *                                read, the ledger guard cannot forget. So a second
 *                                episode on an unparseable state is SILENT,
 *                                only for a run this concern had already engaged
 *                                on THIS roadmap — the keyed state is the
 *                                discriminator. State absent stays silent,
 *                                because nothing was ever driven. The budget is
 *                                reclaimed only after `ABSENT_CONFIRM_FIRES`
 *                                consecutive absent fires: one fire cannot tell
 *                                an archival from a non-atomic rewrite, two can.
 *                                Deliberately NOT in `HALT_ACTIONS` — it clears
 *                                the budget rather than stamping `halted`, and
 *                                the two are exclusive)
 *   transcript over the shared
 *   read cap                   → allow  (event: inert-transcript-over-cap, ONCE
 *                                per run. The concern cannot compute a turn
 *                                ordinal past the cap, so it goes inert — and an
 *                                inert mechanism that says nothing is
 *                                indistinguishable from a healthy idle run,
 *                                which is the failure this file exists over)
 *   plan premise moved         → allow  (event: halt-premise-invalidated, ONCE per
 *                                run. Engaged-under fingerprint and newest
 *                                observation both known and differing. Before the
 *                                counter rungs: iterating against a stale plan
 *                                does not make it current, and capping out would
 *                                report `exhausted`, a budget word, for staleness.
 *                                Never fires on traffic the run did not observe)
 *   quality-gate refusal       → defer            (event: deferred-quality-gate)
 *   duplicate stop fire        → repeat the BLOCK, no count (event: none —
 *                                an allow here would END the reply the block
 *                                one event earlier exists to continue). A fire
 *                                whose roadmap SOURCE changed is never a
 *                                duplicate, whatever the counts say.
 *   scope complete (0 open,
 *   none blocked)              → allow            (event: complete; state cleared)
 *   remaining work externally
 *   impossible (0 open, ≥1
 *   blocked)                   → allow  (event: blocked, ONCE per run, guarded by
 *                                the LEDGER: the state is cleared like `complete`,
 *                                so no field there outlives the event. A terminal
 *                                outcome — not a sixth halt, never in
 *                                `HALT_ACTIONS`, never stamped into `halted`.
 *                                ADR-237 narrows what may legally wear a
 *                                `blocked-by:` marker; semantics unchanged.)
 *   iterations ≥ MAX (25)      → allow            (event: halt-max-iterations)
 *   wall clock ≥ cap (4 h)     → allow            (event: halt-wall-clock)
 *   stall (3 engagements, no
 *   checkbox delta)            → allow            (event: halt-stall)
 *   otherwise                  → BLOCK + continue (event: engage)
 *
 * Every event this concern writes carries `workspace_root`, `session_root`,
 * `session_cwd`, `git_dir`, `git_common_dir` and `claim_path` — the two-tree
 * provenance, per `provenance()` below — plus `roadmap_path`, the file the
 * open-step count on that same line was read from (round 4 finding 4). Seven
 * fields. The count has been caught wrong in three separate rounds; if you add
 * one, this line, `provenance()`s heading and the roadmap enumeration all move. Without them the ledger records that an
 * engagement happened but not that it crossed the tree boundary the fix was
 * about, and crossing it is the whole claim. This list is the file's canonical
 * statement of the contract: R2 round 2 finding 4 caught it enumerating four
 * fields while the function emitted five, which would have let a later edit drop
 * one without contradicting any documented promise.
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
 * FAIL-OPEN THROUGHOUT. severity: BLOCKING, fail_closed: false. Any read
 * error, any malformed state, any surprise → EXIT_ALLOW. A continuation
 * mechanism must never be the thing that blocks a stop for a reason nobody
 * can see; the only BLOCK this file emits is the one that carries its own
 * explanation on stderr.
 *
 * The severity word matters and this docblock had the wrong one. It read
 * `advisory` — which the dispatcher enforces as a CEILING, downgrading any
 * EXIT_BLOCK to WARN, so the whole mechanism was inert. That was round 1's
 * critical finding; the manifest moved and this line did not, which round 3
 * then caught as a doc contradicting the declaration it describes. Blocking
 * and fail-open are not in tension: fail-open governs what happens when this
 * file cannot decide, blocking governs what happens when it decides to
 * continue.
 */

import * as fs from 'node:fs';
import { revokeBillingGrant } from '../_lib/billing_grant.js';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { is_replay_mode } from './state_io.js';
import { readTranscriptTail } from './turn_end_gate_hook.js';
import { resolve_claim, session_checkout } from '../session_register_hook.js';
import { git_common_dir, git_dir } from '../_lib/git_common_dir.js';
import {
    deriveSessionKey,
    parseRecord,
    sessionRefusalFile,
} from '../_lib/turn_end_refusals.js';
import { phaseLines } from '../_lib/roadmap_checkboxes.js';

const EXIT_ALLOW = 0;
/** Dispatcher-internal block code; the dispatcher maps stop-slot 1 → host 2. */
const EXIT_BLOCK = 1;

/**
 * The gate's cap, IMPORTED rather than restated — the two must agree by
 * construction, not by two numbers that happened to match.
 *
 * R2 round 2, finding 1, and it was critical. This file carried its own 2 MB
 * ("same cap the interruption ledger reads its tail under") while
 * `turn_end_gate_hook` uses 8 MB, and `readTranscriptTail` returns
 * `turnOrdinal: 0` over its cap WITHOUT throwing. So on any 2-8 MB transcript
 * the gate computed ordinal N and wrote `refused_turn: N`, this concern
 * computed 0, `refusedThisTurn` compared `N === 0`, the defer was skipped, and
 * the concern BLOCKED a stop the quality gate had just refused — silently, and
 * in exactly the long-running regime this roadmap targets. That is Risk 1 of
 * the register ("quality gates outrank continuation, always") inverted.
 *
 * Sharing the constant is the fix; a matching literal would re-introduce the
 * same defect the next time one side is tuned.
 */
import { TRANSCRIPT_READ_MAX_BYTES } from './turn_end_gate_hook.js';
import {
    atomicWriteJson,
    readUnavailableDependency,
    stallSignal,
    type StallLevel,
} from '../_lib/loop_guards.js';
import { premiseMoved, readContextObservation } from '../_lib/context_observation.js';
import { RUN_TERMINAL_VOCABULARY_VERSION } from '../_lib/outcome_vocabularies.js';
import {
    HALT_ACTIONS,
    ladder,
    MAX_ITERATIONS,
    parseHaltStamp,
    STALL_WINDOW,
    terminalStateFor,
    WALL_CLOCK_CAP_MS,
    type LadderAction,
} from '../_lib/continuation_ladder.js';

/**
 * DECLARED in `_lib/continuation_ladder.ts`, re-exported here: one declaration,
 * two import paths, no second copy to drift. That module's header says why the
 * move happened (`road-to-wired-instruments` Phase 2).
 */
export {
    HALT_ACTIONS,
    ladder,
    MAX_ITERATIONS,
    parseHaltStamp,
    STALL_WINDOW,
    terminalStateFor,
    WALL_CLOCK_CAP_MS,
    type LadderAction,
};

/** Re-exported so a test can assert the IDENTITY, not two matching literals. */
export { TRANSCRIPT_READ_MAX_BYTES };

/**
 * The blocked-step marker, as § 3c of the process loop documents it. Anchored on
 * the comment form with the id REQUIRED: this decides a terminal outcome and
 * whether a budget is cleared, so prose merely mentioning the words must not
 * remove a step from the open count.
 */
const BLOCKED_BY_MARKER = /<!--\s*blocked-by:\s*\S[^>]*-->/;

/** Tail bound for `eventAlreadyLogged` — the line it seeks is near the end. */
const LEDGER_TAIL_MAX_BYTES = 512 * 1024;

export const EVENTS_RELPATH = path.join(
    'agents',
    'runtime',
    'state',
    'run-continuation.jsonl',
);
const STATE_DIR_REL = path.join('agents', 'runtime', 'state');

/**
 * How many consecutive absent-roadmap fires confirm the absence.
 *
 * Two, because that is the smallest number that separates the two causes: a
 * non-atomic rewrite is open for well under one turn, an archival lasts across
 * them. Round 7 findings 1 and 4 measured the cost of treating one fire as
 * confirmation — an unbounded budget reset, repeatable.
 */
export const ABSENT_CONFIRM_FIRES = 2;

export interface RunState {
    started_at: string;
    iterations: number;
    last_turn: number;
    /** Open-step count recorded at each engagement, newest last. */
    history: number[];
    /**
     * The derived stall level (Phase 6.6): `progressing` | `flat` | `stalled`.
     * Written by the producer so a reader never re-derives it from `history`.
     */
    stall?: StallLevel;
    /**
     * Set once the over-cap-transcript rung has reported this run inert.
     *
     * The rung fires on every stop for the rest of a long run, and one line saying
     * so is information while a stream of identical lines is noise.
     */
    inert_reported?: boolean;
    /**
     * CONSECUTIVE stop fires on which the roadmap was unreadable — a run of
     * absences, not a total, which is why the main path deletes it on a successful
     * read. At `ABSENT_CONFIRM_FIRES` the budget is reclaimed; below it the state
     * is left alone. The absent branch says why one fire is not enough.
     */
    absent_fires?: number;
    /**
     * The roadmap slug this state belongs to.
     *
     * Round 6 finding 2: the state is keyed on the session id alone, and one
     * session may re-claim a different roadmap. A halt stamp is never cleared —
     * only `complete` unlinks — so a later legitimate claim of roadmap B inherited
     * A's stamp, emitted a halt line naming B without ever engaging, and reported
     * A's iteration count under B's slug.
     *
     * Keying the FILE on the slug would have orphaned every state file in
     * existence; recording the slug inside it does the same work and degrades
     * cleanly. A mismatch is read as a fresh run, which is what it is.
     *
     * Optional so a state file written before this field parses unchanged; absent
     * means "unknown roadmap" and is trusted, because the alternative is
     * discarding a live budget on an upgrade.
     */
    roadmap?: string;
    /**
     * The roadmap file the counts in `history` were read from.
     *
     * Round 4 finding 2: `resolveRoadmap` re-chooses the source tree on every
     * fire, and `ladder`'s stall test compares the counts for equality — so a run
     * whose source changed mid-flight compared numbers from two different
     * documents. Both directions were wrong: a differing earlier count from the
     * other tree reset a genuine stall streak, and a coincidentally equal one
     * contributed a false match toward `halt-stall`. Recording the source lets a
     * change reset the window, which is the only honest reading — the counts
     * before the change measured a different file.
     *
     * Optional so a state file written before this field parses unchanged; absent
     * means "unknown source", which resets once and then tracks.
     */
    history_source?: string;
    /** ISO stamp of the most recent engagement — half of the duplicate key. */
    last_engaged_at?: string;
    /**
     * Which halt rung ended this run's budget, if one did. Set instead of
     * deleting the state file, and the difference is the whole point: a host
     * may fire `stop` several times for one reply, and a deleted state makes
     * the next fire read `prev === null`, build `iterations: 0` with a fresh
     * `started_at`, and engage again — so the 25-iteration cap bounded a
     * 25-block and the 4 h clock restarted on every halt. The R2 review found
     * this; the roadmap's Risk 2 ("the agent loops forever on a roadmap it
     * cannot finish") named these rungs as its mitigation.
     */
    halted?: LadderAction;
    /**
     * The fingerprint this run ENGAGED under — its plan premise, recorded once on
     * the first engagement from `_lib/context_observation` and then left alone.
     * Refreshing it every fire would make both sides of the premise comparison
     * equal by construction and the rung unreachable. Absent means the run never
     * observed one, which is never a disagreement (`premiseMoved`).
     */
    context_fingerprint?: string;
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
    roadmapSource?: string,
): boolean {
    if (state === null) return false;
    if (state.last_turn !== turnOrdinal) return false;
    // Round 5 finding 6: this compared the recorded count against the fresh scan
    // with no regard for which FILE either came from — the same cross-document
    // comparison `history_source` exists to stop, in the one place that returns
    // BLOCK without consuming an iteration or writing a line. A source change with
    // a coincidentally equal count therefore erased a genuine engagement from the
    // ledger the acceptance criteria are counted from. A changed source is never a
    // duplicate fire.
    // Round 7 finding 6: this read an ABSENT recorded source as a changed one, so
    // the first fire after the upgrade that introduced the field failed to
    // recognise a genuine duplicate — it consumed an iteration and appended an
    // extra `engage` line to the ledger the acceptance criteria count from, which
    // is the false count round 5 finding 6 added the guard to prevent. Both sides
    // must be known before a difference means anything.
    if (
        state.history_source !== undefined &&
        roadmapSource !== undefined &&
        state.history_source !== roadmapSource
    ) {
        return false;
    }
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

/**
 * An OPEN step. The mark set is the dashboard's, narrowed to the one mark that
 * means "not done": `[~]` and `[-]` are parked by a human decision, and `[x]`
 * is finished. The BULLET set is the dashboard's in full, because a `*` bullet
 * is a legitimate authoring shape that used to read as zero open steps.
 */
const OPEN_BOX = /^[ \t]*[-*][ \t]+\[ \][ \t]+(.*)$/;

/**
 * Count open steps and pick the next one. `[~]` / `[-]` never match the open
 * pattern; a `blocked-by:` marker on the step's own line excludes it from
 * both the count and the pick (see the header for why).
 */
export function scanOpenSteps(text: string): ScanResult {
    let open = 0;
    let blocked = 0;
    let next: NextStep | null = null;
    // Phase spans only. A `- [ ]` under `## Acceptance criteria`,
    // `## Blockers` or `## Risk Register` is a criterion, a gate or a risk
    // row — never an executable step, and re-engaging on one is a guaranteed
    // stall. See `_lib/roadmap_checkboxes.ts`.
    const lines = phaseLines(text);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] as string;
        const m = OPEN_BOX.exec(line);
        if (!m) continue;
        // A step spans its own line plus the indented continuation lines under
        // it, and the `verify:` command is conventionally written on one of
        // those rather than inline. Gathered up to the next checkbox or
        // heading, so one step never absorbs the next one's verify line.
        const step: string[] = [line];
        for (let j = i + 1; j < lines.length; j++) {
            const cont = lines[j] as string;
            if (cont.trim() === '') break;
            if (/^[ \t]*[-*][ \t]+\[/.test(cont)) break;
            if (/^#{1,6}[ \t]/.test(cont)) break;
            if (!/^[ \t]/.test(cont)) break;
            step.push(cont);
        }
        const full = step.join('\n');
        const body = m[1] as string;
        if (BLOCKED_BY_MARKER.test(body)) {
            blocked += 1;
            continue;
        }
        open += 1;
        if (next === null) {
            next = {
                text: (() => {
                    const cleaned = body
                        .replace(/<!--.*?-->/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    return cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned;
                })(),
                verify: extractVerify(full),
            };
        }
    }
    return { open, blocked, next };
}

/**
 * The step's `verify:` command, in either form the tree writes.
 *
 * R2 round 2, finding 10. Only the HTML-comment form was matched, and only on
 * the step's OWN line — while 18 roadmaps, including both this branch ships,
 * write the backticked form on a continuation line:
 *
 *     - [ ] **1.0** do the thing
 *           `verify:` `./scripts-run src/scripts/lint_thing`
 *
 * So the continuation named a next step and omitted the command that proves it
 * — and Risk 7 of the roadmap names exactly that command as its mitigation
 * against a re-engagement that cannot check its own work.
 *
 * The comment form wins when both are present: it is the machine-readable one,
 * and a step carrying both has a human-facing line and a tooling-facing line
 * rather than two commands.
 */
export function extractVerify(stepText: string): string | null {
    const html = /<!--\s*verify:\s*(.*?)\s*-->/.exec(stepText);
    if (html !== null) return (html[1] as string).trim() || null;
    // `verify:` then the command, both backticked. The label's own backticks
    // are optional because the tree carries `verify:` and `` `verify:` ``.
    const backticked = /`?verify:`?\s*`([^`]+)`/.exec(stepText);
    if (backticked !== null) return (backticked[1] as string).trim() || null;
    return null;
}

/**
 * Where a run's state lives: keyed on the session AND the roadmap.
 *
 * ## Round 6 keyed it on the session alone, and round 7 killed that
 *
 * Round 6 finding 2 observed that one session may re-claim, so a halt stamped on
 * roadmap A was inherited by a later claim of roadmap B. It fixed that by
 * recording the slug INSIDE the file and reading a mismatch as a fresh run —
 * declining to key the path on the slug because that "would have orphaned every
 * state file in existence".
 *
 * Round 7 findings 2 and 3 showed the in-file discriminator trades one defect for
 * two. The absent-roadmap branch never applied it, so it reported A's iteration
 * count under B's slug and deleted A's live state; and on the main path, nulling
 * `prev` on a mismatch means the next write OVERWRITES A's halt stamp — so a
 * halted roadmap became re-engageable with a full budget by the detour of
 * claiming something else once. "A halt must NOT clear it" was not durable.
 *
 * One file cannot hold two roadmaps' budgets, which is what both findings say from
 * opposite ends. So the path carries the slug, and the orphaning objection is
 * answered by MIGRATING rather than by avoiding: `readRunState` falls back to the
 * legacy per-session path when the keyed one is absent, and adopts it only when its
 * recorded roadmap is absent or equal. A live budget survives the upgrade; a
 * foreign one is not inherited.
 */
export function stateRelPath(runId: string, slug: string): string {
    const safeRun = runId.replace(/[^A-Za-z0-9_-]/g, '_');
    const safeSlug = slug.replace(/[^A-Za-z0-9_-]/g, '_');
    return path.join(STATE_DIR_REL, `run-continuation-${safeRun}-${safeSlug}.json`);
}

/** The pre-round-7 path, read for migration and never written. */
export function legacyStateRelPath(runId: string): string {
    const safe = runId.replace(/[^A-Za-z0-9_-]/g, '_');
    return path.join(STATE_DIR_REL, `run-continuation-${safe}.json`);
}

/**
 * This run's state, from the keyed path or — once, on migration — from the legacy
 * per-session one.
 *
 * Returns the state and the file it came from, because the caller has to know
 * whether it is looking at a keyed file (safe to delete) or a legacy one shared
 * with other roadmaps (never deleted; the keyed write supersedes it).
 */
export function readRunState(
    workspaceRoot: string,
    runId: string,
    slug: string,
): { state: RunState | null; from: 'keyed' | 'legacy' | 'none'; keyedFile: string } {
    const keyedFile = path.join(workspaceRoot, stateRelPath(runId, slug));
    const keyed = readState(keyedFile);
    if (keyed !== null) return { state: keyed, from: 'keyed', keyedFile };
    if (fileExists(keyedFile)) {
        // Present but unreadable. NOT a migration case: adopting the legacy file
        // here would silently replace a corrupt budget with a foreign one.
        return { state: null, from: 'keyed', keyedFile };
    }
    const legacy = readState(path.join(workspaceRoot, legacyStateRelPath(runId)));
    if (legacy === null) return { state: null, from: 'none', keyedFile };
    // Adopted only when the legacy file is not another roadmap's.
    if (legacy.roadmap !== undefined && legacy.roadmap !== slug) {
        return { state: null, from: 'none', keyedFile };
    }
    return { state: legacy, from: 'legacy', keyedFile };
}

/**
 * The only writer of a run-state file. Never throws — the state is a budget, and
 * throwing here would turn an observability concern into a turn-end failure.
 *
 * RETURNS whether the write landed, and the return is load-bearing exactly once:
 * the engage path must not BLOCK on a counter it could not persist, because there
 * the ladder cannot bound the loop. Every other caller ignores it (fail-open).
 */
function writeState(file: string, state: RunState): boolean {
    // ATOMIC (runtime-enforcement Phase 5.2): temp beside the target, then
    // rename. This file is the loop's ITERATION BUDGET — a torn direct write
    // leaves a record `parseRecord` rejects, the counter restarts at zero, and
    // the cap stops bounding anything. A non-atomic budget write fails as an
    // UNBOUNDED loop, which is what the budget exists to prevent.
    return atomicWriteJson(file, state);
}

/**
 * Clear a run's budget: the keyed file, and the legacy per-session file ONLY when
 * this read adopted it. Both halves are load-bearing.
 *
 * Touching the legacy file at all: `readRunState` adopts it for a migrated run, so
 * clearing only the keyed one made every clear a no-op there — `complete` stayed
 * resumable and the absent-confirm clear became a repeating cycle.
 *
 * Gating on `adoptedLegacy` rather than on the adoption predicate: adoption and
 * deletion want OPPOSITE defaults. A pre-round-7 file carries no `roadmap` field
 * and is therefore adoptable by every slug — right for adopting, catastrophic for
 * deleting, where one slug's clear would take another slug's live budget or halt
 * stamp with it. Adoption is a fact this read already established; it is passed in
 * rather than re-derived from a condition that cannot express it.
 */
export function clearRunState(
    workspaceRoot: string,
    runId: string,
    keyedFile: string,
    adoptedLegacy: boolean,
): void {
    revokeBillingGrant(workspaceRoot, runId); // the run IS the grant's TTL
    try {
        fs.rmSync(keyedFile, { force: true });
    } catch {
        /* fail-open */
    }
    if (!adoptedLegacy) return;
    try {
        fs.rmSync(path.join(workspaceRoot, legacyStateRelPath(runId)), { force: true });
    } catch {
        /* fail-open */
    }
}

function fileExists(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
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
        // Round-tripped, and it has to be: dropping it here would make the
        // source look changed on EVERY fire, reset the window every time, and
        // silently disable the stall detector the field was added to protect.
        if (typeof o['history_source'] === 'string') {
            rec.history_source = o['history_source'];
        }
        if (typeof o['roadmap'] === 'string') {
            rec.roadmap = o['roadmap'];
        }
        if (typeof o['absent_fires'] === 'number' && Number.isFinite(o['absent_fires'])) {
            rec.absent_fires = o['absent_fires'];
        }
        if (o['inert_reported'] === true) {
            rec.inert_reported = true;
        }
        // Round-tripped for the same reason `history_source` is: dropped, the
        // premise would be re-recorded every fire from the newest observation, so
        // the two sides could never differ and the rung would be dead code.
        if (typeof o['context_fingerprint'] === 'string' && o['context_fingerprint'] !== '') {
            rec.context_fingerprint = o['context_fingerprint'];
        }
        // Tolerant, not permissive — see `parseHaltStamp` for what it accepts
        // beyond the halt set and why dropping a newer build's stamp was the
        // wrong failure direction for a budget.
        const halted = parseHaltStamp(o['halted']);
        if (halted !== null) rec.halted = halted;
        return rec;
    } catch {
        return null;
    }
}

/**
 * The six fields that make an event's two-tree property checkable by a third
 * party holding nothing but the ledger line. The caller adds a seventh,
 * `roadmap_path`, which it knows and this function does not.
 *
 * Keep this count in step with the file header and the call-site comment. Round 2
 * finding 4 caught the header saying four where the function emitted five; the
 * edit that fixed it added `session_cwd` and left THIS heading saying five, which
 * round 3 finding 3 then caught. Two rounds, same drift, opposite direction — the
 * count is load-bearing because it is what a later edit dropping a field would
 * have to contradict.
 *
 * The defect this concern shipped with was a writer and a reader resolving
 * DIFFERENT trees: `sessions:claim` wrote under `process.cwd()` (the operator's
 * worktree) while this concern read under `--project-dir` (the parent
 * checkout), so the claim was never found and no event was written. An empty
 * ledger looked exactly like a healthy idle run, which is how it survived a
 * release.
 *
 * A reader therefore has to see, from the line alone, which trees were in play
 * and where the contract was actually read out of. A boolean such as
 * `worktree_started: true` would be another assertion by the system under
 * observation rather than a check on it; the falsifiable facts are concrete
 * (AI council 2026-08-19, 2/2 convergent):
 *
 *   `session_root !== workspace_root`   → writer and reader resolved different
 *                                         trees. After the fix this is the
 *                                         NORMAL healthy two-tree arrangement,
 *                                         not a defect: the claim now lives in
 *                                         the shared root, so the line existing
 *                                         at all with the two roots differing is
 *                                         the fix working. Round 2 finding 7
 *                                         caught the previous wording calling it
 *                                         "the shipped defect condition", which
 *                                         made a healthy engagement line read as
 *                                         evidence of the bug
 *   `git_dir !== git_common_dir`        → the session's own tree IS a linked
 *                                         worktree. Only meaningful when both
 *                                         are non-empty — see the degenerate
 *                                         reading below
 *   `claim_path` under `git_common_dir` → the contract crossed into the shared
 *                                         root. Also gated on a non-empty
 *                                         `git_common_dir`: round 2 finding 2
 *                                         measured that on a non-repo line both
 *                                         git fields are `''` and every absolute
 *                                         path satisfies `startsWith('')`, so a
 *                                         reader applying the rule unguarded
 *                                         concludes the contract crossed a
 *                                         boundary the line says nothing about
 *   `session_cwd`                       → the raw directory the session reported
 *                                         before any resolution, so a reader can
 *                                         tell "same tree" from "could not
 *                                         resolve"
 *
 * ## The degenerate reading, stated so it cannot be mistaken for a negative
 *
 * Two of the three path relations above are only interpretable on a line whose
 * git fields are non-empty. Empty means git could not be read from the session's
 * root at all — a plain temp directory, a broken checkout — and that is an
 * ABSENCE of evidence rather than evidence of a same-root run. A reader must
 * check `git_common_dir !== ''` before applying either relation.
 *
 * `session_cwd` exists for the same reason, and it is a fact rather than an
 * assertion. `session_checkout` degrades to `workspace_root` when its guards
 * fail, and the raw `cwd` is what can make a degraded line distinguishable from a
 * genuine same-tree one. A boolean `resolved: false` would have been the system
 * under observation asserting its own health; the raw path is checkable.
 *
 * **The relation is SUFFICIENT, never necessary, and this file has now written it
 * as necessary three rounds running.** A `session_cwd` outside `session_root`
 * proves a fallback happened. The converse does not hold: round 4 finding 3 names
 * three reachable inputs where the resolver falls back and the raw cwd still sits
 * under `session_root` — a cwd inside a DIFFERENT repository nested under this
 * checkout (a vendored clone, a test fixture) failing the identity check, a cwd
 * that does not exist, and a relative cwd resolved against the reader's root. On
 * those lines the provenance cannot tell a reader that a fallback occurred, and
 * saying so is the honest bound rather than a wider claim that keeps being
 * refuted.
 *
 * **The degradation this field was introduced for is gone, and the field stayed.**
 * Round 2 added it because a session started from a SUBDIRECTORY of a worktree
 * failed the resolver's checkout-root condition and collapsed onto the reader's
 * root. Round 3 finding 2 then showed the field was BLIND to exactly that case in
 * the layout it mattered in: with the worktree nested under the parent, the
 * collapsed root, both git fields AND the raw cwd all read healthy same-tree.
 * The fix was upstream — `session_checkout` now walks up to the nearest enclosing
 * checkout root — so a subdirectory is no longer a degradation at all.
 *
 * What remains, and what the field is now for: a cwd inside a DIFFERENT
 * repository, a cwd that does not exist, a cwd under no checkout root at all.
 * Those still fall back, and on those lines `session_cwd` is still the only
 * thing that says so. Two cases pin both directions.
 *
 * ## Both git fields come from `session_root`, not from `workspace_root`
 *
 * The first shipped version of this function derived both of them from the
 * READER's root, and R2 finding 1 killed it: in the arrangement documented
 * three paragraphs up as the live one — the concern running under
 * `--project-dir <parent checkout>` — `git_dir(parent)` and
 * `git_common_dir(parent)` are the SAME path, so the discriminator above read
 * FALSE for every real worktree-started run. The enrichment existed to make
 * the two-tree property auditable and could not express it. `claim_path` could
 * not rescue it either: the claim lands under `git_common_dir` in a plain
 * checkout too, so that containment holds in both arrangements.
 *
 * `session_root` is the session's OWN checkout, resolved through the register's
 * `session_checkout` — the same three-condition guard (existing directory,
 * checkout root, same repository) rather than a second, divergent reading of
 * `payload.cwd`. It degrades to `workspace_root` when any condition fails,
 * which makes `session_root === workspace_root` mean "same tree, or unresolvable"
 * and never a false two-tree claim.
 *
 * `process.cwd()` is deliberately NOT among the fields. The dispatcher chdirs
 * into `--project-dir` before the chain runs, so at concern time cwd equals
 * `workspace_root` on every shipped path — a field that can never disagree with
 * another cannot falsify anything, and shipping it as provenance would be the
 * decorative-evidence shape this whole change exists to remove. Measured while
 * writing the test that asserted the opposite.
 *
 * Absolute AND realpath-normalised, deliberately: a relative form is
 * interpreted against whichever root the reader happens to hold, and a
 * symlinked form defeats the containment test above. R2 finding 3 measured the
 * second half — the git fields come back realpath-resolved from
 * `_lib/git_common_dir.ts` while the first version passed the envelope string
 * verbatim, so on macOS a healthy run wrote `workspace_root: /var/...` against
 * `git_common_dir: /private/var/...` and the documented prefix test failed on
 * it. Normalising here is the only place a ledger-only reader can inherit it
 * from. These are local filesystem paths in gitignored runtime state, never
 * published — the same posture the session register already takes.
 */
function normalizeDir(p: string): string {
    const abs = path.resolve(p);
    try {
        return fs.realpathSync(abs);
    } catch {
        return abs;
    }
}

/**
 * Realpath a file path without requiring the file to exist: the directory is
 * normalised and the basename rejoined. The per-tree claim fallback names a
 * path that may not have been written, and a missing file must not downgrade
 * the whole line to un-normalised paths.
 */
function normalizeFile(p: string): string {
    const abs = path.resolve(p);
    return path.join(normalizeDir(path.dirname(abs)), path.basename(abs));
}

export function provenance(
    workspaceRoot: string,
    claimPath: string,
    sessionRoot: string,
    sessionCwd: string,
): JsonObject {
    const reader = normalizeDir(workspaceRoot);
    const writer = normalizeDir(sessionRoot);
    return {
        workspace_root: reader,
        session_root: writer,
        // Empty when the host sent no `cwd` at all, which is a different fact
        // from a `cwd` that failed resolution — the first says the host is
        // silent, the second says the session sat somewhere `session_checkout`
        // would not trust. Both are readable; neither is guessed.
        //
        // Trimmed with the SAME rule `session_checkout` applies to the same
        // string (round 3 finding 6). Without it a whitespace-padded value
        // validated fine there and was `path.resolve`d here against the reader's
        // cwd, fabricating a path that is neither `session_root` nor under it —
        // precisely the shape the docblock above says no healthy resolution
        // produces, so a healthy line read as degraded. A whitespace-only value
        // now reads as host silence, which is what it is.
        session_cwd: sessionCwd.trim() === '' ? '' : normalizeDir(sessionCwd.trim()),
        git_dir: git_dir(writer) ?? '',
        git_common_dir: git_common_dir(writer) ?? '',
        claim_path: normalizeFile(claimPath),
    };
}

/**
 * The roadmap file this run is executing, chosen by which tree OWNS the
 * roadmaps directory — never by whether one particular file is present.
 *
 * ## The per-file fallback was wrong, and round 4 finding 1 named the cost
 *
 * The first version resolved per FILE: session copy if it exists, else the
 * reader's. That reads correctly in a fresh worktree and breaks a finished run.
 * `roadmap-progress-sync` mandates archival in the SAME change that closes the
 * last step, so a completing run `git mv`s the file into
 * `agents/roadmaps/archive/`. On the next stop fire the session copy is gone, the
 * per-file rule silently fell back to the parent's UN-archived copy, read its
 * still-open steps, and blocked with "continue with this step now" against a path
 * that no longer exists in the tree the agent is editing — re-engaging to the
 * iteration cap instead of ever reaching `complete`.
 *
 * Per DIRECTORY instead: if the session's tree has `agents/roadmaps/` at all,
 * that tree is authoritative and a missing slug file means the roadmap is gone
 * from this run — archived, renamed, or never created — which the caller's
 * unreadable-roadmap branch already handles correctly by allowing the turn to
 * end. The fallback survives for the case it was actually for: a session root
 * that is not a checkout of this project layout.
 *
 * ## Slug containment
 *
 * The slug comes from a claim file, and `_read_claim_file` accepts any non-empty
 * trimmed string. `claim_is_stale` in the same module treats containment as
 * necessary before any read; round 4 finding 7 observed that this function did
 * not, and that it now builds paths in TWO trees rather than one. A slug that
 * escapes `agents/roadmaps/` returns `null` and the caller allows — refusing to
 * name a file is the safe direction for a concern whose only power is refusing to
 * end a turn.
 */
function resolveRoadmap(
    sessionRoot: string,
    workspaceRoot: string,
    slug: string,
): string | null {
    const dirRel = path.join('agents', 'roadmaps');
    // The SAME normalisation `claim_is_stale` applies to the same claim string
    // (round 5 finding 7). Without it a claim whose slug already carries the
    // suffix rendered as live work in the register while this concern resolved
    // `<slug>.md.md`, failed the read, and allowed every stop — two functions in
    // one flow disagreeing about one string.
    const stem = slug.trim().replace(/\.md$/, '');
    const rel = path.join(dirRel, `${stem}.md`);
    const norm = path.normalize(rel);
    // Containment on the STRUCTURE, not on the characters: `path.join` has already
    // collapsed traversal, so what matters is whether the result is still inside
    // the roadmaps directory and names a file directly in it. Round 5 finding 10:
    // a substring test for `..` also rejected a legitimate slug like
    // `road-to-a..b`, which then silently allowed every stop.
    if (path.dirname(norm) !== dirRel) return null;
    if (sessionRoot !== workspaceRoot && isDirectory(path.join(sessionRoot, dirRel))) {
        return path.join(sessionRoot, norm);
    }
    // Canonical, like every emitted path field (round 5 finding 9). The fallback
    // branch joined the RAW reader root while `workspace_root` on the same line is
    // normalised, so under a symlinked ancestor a reader's containment test failed
    // on a perfectly healthy line — the regression round 2 finding 3 fixed for the
    // other six fields, reintroduced on the seventh.
    return path.join(normalizeDir(workspaceRoot), norm);
}

function isDirectory(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/**
 * True when a line with this event name, run id and roadmap is already in the
 * ledger — the durable once-guard for the two rungs that cannot keep one in the
 * state file: `halt-roadmap-absent` fires precisely when the state is absent or
 * unparseable, and `blocked` CLEARS the state.
 */
function eventAlreadyLogged(
    workspaceRoot: string,
    runId: string,
    slug: string,
    event: string,
): boolean {
    try {
        const file = path.join(workspaceRoot, EVENTS_RELPATH);
        const size = fs.statSync(file).size;
        const start = Math.max(0, size - LEDGER_TAIL_MAX_BYTES);
        const fd = fs.openSync(file, 'r');
        let text: string;
        try {
            const buf = Buffer.alloc(size - start);
            // The byte count is honoured: a short read, or a truncation between the
            // `statSync` and here, would otherwise decode NUL padding into lines that
            // fail `JSON.parse` and become a false negative.
            const read = fs.readSync(fd, buf, 0, buf.length, start);
            text = buf.subarray(0, read).toString('utf8');
        } finally {
            fs.closeSync(fd);
        }
        for (const line of text.split('\n')) {
            if (line === '') continue;
            let rec: unknown;
            try {
                rec = JSON.parse(line);
            } catch {
                // A partial first line from the tail cut, or a torn append.
                continue;
            }
            if (rec === null || typeof rec !== 'object') continue;
            const o = rec as Record<string, unknown>;
            if (o['event'] === event && o['run_id'] === runId && o['roadmap'] === slug) {
                return true;
            }
        }
        return false;
    } catch {
        // No ledger, or unreadable: nothing proves the line was written, and
        // emitting once more is the lesser failure than going silent on a rung this
        // whole file exists to make visible.
        return false;
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
    const claim = resolve_claim(workspaceRoot, sessionId || null);
    if (claim === null) return EXIT_ALLOW;
    const slug = claim.slug;

    // ── which tree's roadmap is the run ──────────────────────────────
    //
    // The SESSION's own checkout, falling back to the reader's root. In a plain
    // checkout the two are the same path and nothing about this changes; only
    // the two-tree case moves.
    //
    // R2 round 3 finding 1: this read the READER's tree unconditionally, and the
    // count it produces feeds the stall detector. In a worktree session the agent
    // flips checkboxes in the worktree copy while the parent copy does not move
    // until a merge — so the detector watched a file nobody was editing, the
    // count never changed, and after three engagements it emitted `halt-stall`
    // and declared a working run finished. The mechanism whose job is to detect a
    // stall was manufacturing one, which is the failure this file's own header
    // warns about in the abstract.
    //
    // AI council 2026-08-19, 2/2 convergent: resolve against the session
    // checkout, keep the fallback. Both seats also flagged, independently, that
    // `execution.mode` and the open-step count need not share an authority —
    // progress is inherently session-local while a mode could be read as
    // repo-wide policy. That choice is made HERE and stated rather than left
    // implicit: BOTH come from the session's file, because the session is
    // executing the file in its own tree and the parent's copy is simply an older
    // revision of the same document. A genuinely repo-wide mode policy would need
    // its own precedence rule, and inventing one on this evidence would be
    // designing for a case nobody has met.
    const sessionRoot = session_checkout(
        workspaceRoot,
        str(payload['cwd'] as JsonValue | undefined),
    );
    const roadmapPath = resolveRoadmap(sessionRoot, workspaceRoot, slug);
    const runId = deriveSessionKey(sessionId || 'unknown-session');

    // Two locals rather than one plus a re-check: `roadmapFile` is only assigned
    // where the read succeeded, so the guard below narrows BOTH and everything
    // downstream holds a plain string. The alternative — re-testing `roadmapPath`
    // after the guard purely for the compiler — would be a branch that cannot be
    // reached and cannot be tested.
    let roadmapFile: string | null = null;
    let roadmapText: string | null = null;
    if (roadmapPath !== null) {
        try {
            roadmapText = fs.readFileSync(roadmapPath, 'utf8');
            roadmapFile = roadmapPath;
        } catch {
            roadmapText = null;
        }
    }

    if (roadmapText === null || roadmapFile === null) {
        // ── the roadmap is not readable from the authoritative tree ──────
        //
        // Round 5 findings 2, 5 and 10, which are one shape seen three ways: this
        // returned a bare `EXIT_ALLOW` and left NOTHING behind.
        //
        // Finding 2 is the sharp end. `roadmap-progress-sync` mandates archival in
        // the same change that closes the last step, so a completing run flips the
        // last box and `git mv`s the file in one reply. The next fire found it
        // gone, allowed, and never reached the `complete` rung — so no line said
        // the run finished, AND `fs.rmSync(stateFile)` never ran. The state file
        // survived with `iterations` and `started_at` from the finished run, so a
        // later claim by the same session id began with part of the 25-iteration
        // budget spent and the 4 h clock already running — exactly what the
        // comment on that rung promises will not happen.
        //
        // A prior state file is the discriminator, and it is a fact rather than a
        // guess: the state only exists if THIS concern engaged on this roadmap
        // before, which it only does on an `autonomous` one. So:
        //
        //   state present → this run was driven here and its roadmap is gone. Emit
        //                   the line, clear the budget, allow.
        //   state absent  → nothing was ever driven. Stay silent, which is the
        //                   truth rather than a gap: a `phase-checkpoints` claim
        //                   and a worktree branched before the roadmap landed
        //                   (finding 5) both land here, and neither is an event.
        //
        // What this does NOT claim is to tell archival from never-created. The
        // filesystem cannot: both are an absent file. The docblock on
        // `resolveRoadmap` used to assert the archival reading, and finding 5 was
        // right that it conflated the two — so the reading is now carried by the
        // state file, which actually knows.
        // Read THIS roadmap's state, keyed (round 7 finding 2). The previous version
        // read the session-keyed file with no roadmap discriminator, so after a
        // re-claim it reported roadmap A's iteration count under roadmap B's slug
        // and deleted A's live state — falsifying its own documented premise that
        // "state only exists if this concern engaged on THIS roadmap before".
        const runState = readRunState(workspaceRoot, runId, slug);
        const driven = runState.state;
        if (driven === null && runState.from === 'none') return EXIT_ALLOW;

        // A HALT STAMP IS NEVER ERASED HERE (round 6 finding 1, high).
        //
        // A halted run has already recorded its own end, so there is nothing to
        // announce and nothing to reclaim. Silence and no write is the whole
        // correct action.
        if (driven?.halted !== undefined) return EXIT_ALLOW;
        const absenceRoots = provenance(
            workspaceRoot,
            claim.path,
            sessionRoot,
            str(payload['cwd'] as JsonValue | undefined),
        );
        // `null` where a traversal or malformed slug refused to name a file at
        // all (finding 10): the line still exists, so a refusal is no longer
        // indistinguishable from the concern never firing.
        absenceRoots['roadmap_path'] = roadmapPath;

        // ── ONE absence is not a finished run (round 7 findings 1 and 4) ──
        //
        // Round 6 stopped this branch erasing a HALTED run's stamp and left the
        // larger half open: a run with a LIVE budget still had its state deleted on
        // a single unreadable fire. The triggers are ordinary — the agent checks out
        // a ref without the roadmap, a tool rewrites the file unlink-then-write, an
        // EACCES lands on the stop fire — and the consequence is unbounded: iteration
        // 20 becomes iteration 1 with a fresh 4 h clock, repeatable every time.
        //
        // Archival and a momentary read failure are indistinguishable from ONE fire.
        // They are not indistinguishable across two: a rewrite window is
        // sub-second, while an archived roadmap stays archived across turns. So the
        // absence is counted, the ledger line is written ONCE (on the first), and
        // the budget is reclaimed only after the absence has persisted.
        //
        // A state file that exists but cannot be parsed is never deleted here
        // (round 7 finding 4): the counter has nowhere to live, and deleting what we
        // could not read would erase an interrupted halt stamp — the exact leak the
        // presence check was added to close. The next healthy write supersedes it.
        const absentFires = (driven?.absent_fires ?? 0) + 1;
        // A readable state carries the counter; without one it has nowhere to live
        // and would recompute to 1 every fire, so the ledger answers instead.
        const firstAbsence =
            driven === null
                ? !eventAlreadyLogged(workspaceRoot, runId, slug, 'halt-roadmap-absent')
                : absentFires === 1;
        if (firstAbsence) {
            appendEvent(workspaceRoot, {
                event: 'halt-roadmap-absent',
                run_id: runId,
                roadmap: slug,
                // `null` when the state file exists but could not be parsed.
                // Reported as null rather than as 0, which would claim a fact the
                // file no longer carries.
                iterations: driven?.iterations ?? null,
                absent_fires: driven === null ? null : absentFires,
                at: new Date().toISOString(),
                ...absenceRoots,
            });
        }
        if (driven === null) return EXIT_ALLOW;
        if (absentFires < ABSENT_CONFIRM_FIRES) {
            driven.absent_fires = absentFires;
            writeState(runState.keyedFile, driven);
            return EXIT_ALLOW;
        }
        // Confirmed — see `clearRunState` for why the legacy file is in scope and
        // why only an adopted one is.
        clearRunState(workspaceRoot, runId, runState.keyedFile, runState.from === 'legacy');
        return EXIT_ALLOW;
    }
    if (parseExecutionMode(roadmapText) !== 'autonomous') return EXIT_ALLOW;

    // ── turn identity ────────────────────────────────────────────────
    const transcriptPath = str(
        (payload['transcript_path'] ?? payload['transcriptPath']) as JsonValue | undefined,
    );
    if (!transcriptPath) return EXIT_ALLOW;
    // Over the shared cap, `readTranscriptTail` returns `turnOrdinal: 0`
    // without throwing — indistinguishable from a genuinely fresh session. The
    // ordinal is the ONLY key the defer-to-the-gate check has, so an untrusted
    // one must not be used to decide a block: allow instead.
    //
    // This is the residual half of R2 round 2's finding 1. Sharing the cap
    // stops the two hooks disagreeing about the SAME transcript; this stops
    // this concern acting on an ordinal neither of them could compute. Erring
    // toward allow is the same fail-open posture the gate takes on every
    // unreadable-transcript case.
    try {
        if (fs.statSync(transcriptPath).size > TRANSCRIPT_READ_MAX_BYTES) {
            // Round 7 finding 5: this returned ALLOW with no event and no state
            // change, so in the long-run regime this concern exists for — a 4 h cap
            // — a session whose transcript crosses the cap went silently inert for
            // the rest of the run while its budget stayed live. An inert mechanism
            // indistinguishable in the ledger from a healthy idle run is the exact
            // failure this whole roadmap is about, and the header claims every rung
            // is a named event.
            //
            // Emitted ONCE per run, keyed on the state, so a long inert tail does
            // not become a long stream of identical lines. No state file means no
            // run to report on — the same silence the contract-absent rung takes.
            const inert = readRunState(workspaceRoot, runId, slug);
            if (inert.state !== null && inert.state.inert_reported !== true) {
                // The header declares the provenance mandatory for EVERY event, and
                // a rung that exists to be distinguishable in the ledger is the last
                // one that should lack the fields a reader distinguishes runs by.
                const inertRoots = provenance(
                    workspaceRoot,
                    claim.path,
                    sessionRoot,
                    str(payload['cwd'] as JsonValue | undefined),
                );
                inertRoots['roadmap_path'] = roadmapFile;
                appendEvent(workspaceRoot, {
                    event: 'inert-transcript-over-cap',
                    run_id: runId,
                    roadmap: slug,
                    iterations: inert.state.iterations,
                    at: new Date().toISOString(),
                    ...inertRoots,
                });
                inert.state.inert_reported = true;
                writeState(inert.keyedFile, inert.state);
            }
            return EXIT_ALLOW;
        }
    } catch {
        return EXIT_ALLOW;
    }
    let turnOrdinal = 0;
    try {
        turnOrdinal = readTranscriptTail(transcriptPath, {
            maxBytes: TRANSCRIPT_READ_MAX_BYTES,
        }).turnOrdinal;
    } catch {
        return EXIT_ALLOW;
    }


    // The two-tree provenance, carried on every event this run emits. See
    // `provenance()` for the six fields and why none of them is a boolean.
    //
    // Position, and what changed about the cost argument. Rounds 1 and 2 pushed
    // this call downward to stop a `phase-checkpoints` session, and then a
    // session with an over-cap transcript, from paying the git resolution for a
    // value the next line discarded.
    //
    // Round 3 finding 1 made half of that moot: the session root is now needed
    // ABOVE the mode gate, because it decides which tree's roadmap the mode is
    // read from. So the resolution happens early by necessity and this call
    // merely reuses it — the double resolution round 2 finding 5 accepted is
    // gone as a side effect, and nothing here re-derives it.
    //
    // What remains true, and round 3 finding 5 was right to catch the previous
    // comment claiming otherwise: two branches below still return without an
    // `appendEvent` — the duplicate-stop-fire guard and the failed-state-write
    // path — so this is not a position where every path writes a line. It is
    // simply the cheapest honest one now that the value is already in hand.
    //
    // The git resolution here duplicates the one `session_checkout` does to
    // validate the cwd, and that duplication is ACCEPTED rather than removed
    // (round 2 finding 5): collapsing it means widening a register API that
    // other callers use, to save six syscalls on a path that has already read a
    // roadmap file and a transcript tail. The two resolutions also answer
    // different questions — the guard asks whether the cwd belongs to this
    // repository, this asks what the session's own tree is.
    const roots = provenance(
        workspaceRoot,
        claim.path,
        sessionRoot,
        str(payload['cwd'] as JsonValue | undefined),
    );
    // Round 4 finding 4: the line carried six path fields and not the one path
    // the only tree-dependent NUMBER on it came from. On a line with
    // `session_root !== workspace_root` and `open: 2`, a reader could not tell
    // whether the count came from the session copy (the fix working) or from the
    // reader's after a fallback (the defect still live) — the exact ambiguity the
    // other six fields exist to remove.
    roots['roadmap_path'] = roadmapFile;

    // ── defer to the quality gate ────────────────────────────────────
    if (refusedThisTurn(workspaceRoot, sessionId, turnOrdinal)) {
        appendEvent(workspaceRoot, {
            event: 'deferred-quality-gate',
            run_id: runId,
            roadmap: slug,
            turn: turnOrdinal,
            at: new Date().toISOString(),
            ...roots,
        });
        return EXIT_ALLOW;
    }

    // ── state + duplicate-fire detection ─────────────────────────────
    //
    // A state file recorded against a DIFFERENT roadmap is not this run's state —
    // round 6 finding 2. The file is keyed on the session id alone and one session
    // may re-claim, so a halt stamped on roadmap A (never cleared: only `complete`
    // unlinks) was inherited by a later claim of roadmap B, which then emitted a
    // halt line naming B without ever engaging and reported A's iteration count
    // under B's slug. An absent `roadmap` field is trusted rather than discarded:
    // it means the state predates this field, and dropping a live budget on an
    // upgrade would be the worse error.
    // Keyed on (session, roadmap), with the legacy per-session file migrated once —
    // see `readRunState`. The in-file `roadmap` guard round 6 added is gone as a
    // BRANCH: it is now an identity, so a mismatch cannot reach this code at all,
    // and round 7 finding 3's "a mismatch nulls prev, so the next write overwrites
    // the other roadmap's halt stamp" has no path left.
    const mainState = readRunState(workspaceRoot, runId, slug);
    const stateFile = mainState.keyedFile;
    const prev = mainState.state;
    const state: RunState = prev ?? {
        started_at: new Date().toISOString(),
        iterations: 0,
        last_turn: -1,
        history: [],
        roadmap: slug,
    };
    // Stamped on an inherited state too, so the field fills in on first contact
    // rather than staying absent for the life of the run.
    state.roadmap = slug;
    // The reset the field's docblock promises. Reaching this line means the
    // roadmap read succeeded (the absent branch returns above), and the engage and
    // halt paths write THIS object back — so without the delete the counter is a
    // lifetime total and two separated absences reclaim a live budget.
    delete state.absent_fires;

    const scan = scanOpenSteps(roadmapText);

    // A duplicate stop fire repeats the SAME verdict without consuming an
    // iteration. It must repeat the BLOCK: this concern just blocked this
    // very stop, and an allow on the re-fire would end the reply the block
    // exists to continue. (An earlier draft allowed here — the smoke run
    // caught it ending the run it had re-engaged one event earlier.)
    if (isDuplicateFire(prev, turnOrdinal, scan.open, Date.now(), roadmapFile)) {
        process.stderr.write(_continuationText(slug, scan, state.iterations));
        return EXIT_BLOCK;
    }

    // The source-change reset runs HERE, before the ladder reads the history —
    // round 5 finding 1. It used to sit inside the engage branch, which is after
    // `ladder()` and after the non-engage branch returns, so on the ONE fire where
    // the source document changes the stall test still compared counts from two
    // different files. Three parent-copy readings at `open: 4` followed by a
    // session copy that also reads 4 produced `halt-stall` on the parent's numbers
    // and declared a working run finished — the precise failure the field's own
    // docblock claims to prevent, defeated by where the guard sat.
    if (state.history_source !== roadmapFile) {
        state.history = [];
        state.history_source = roadmapFile;
    }

    // Phase 5.4 — a dependency the run cannot obtain. Read from the transcript
    // TAIL only: an authentication failure from an hour ago that was then fixed
    // must not halt the run now. A read failure is `null` (fail-open), because a
    // detector that cannot read must not manufacture a halt.
    const unavailable = readUnavailableDependency(transcriptPath);

    // Phase 6.6 — the stall signal, WRITTEN rather than re-derived. A consumer
    // asking "is this run still making progress" had to reconstruct it from the
    // history array and the window constant, so every reader could answer
    // differently. One producer, one definition.
    state.stall = stallSignal(state.history, STALL_WINDOW).level;

    // 2.1 — repository drift, from the newest observation `roadmap:context`
    // recorded. No probe here: the fingerprint costs a `gh` call and this is the
    // Stop path. An unknown on either side is never a halt.
    const observed = readContextObservation(workspaceRoot)?.fingerprint ?? null;
    const premiseInvalidated = premiseMoved(state.context_fingerprint, observed);

    const action = ladder(
        state,
        scan.open,
        Date.now(),
        scan.blocked,
        undefined,
        unavailable,
        premiseInvalidated,
    );

    if (action !== 'engage') {
        // A run that is ALREADY stamped emits nothing further — round 6 finding 6.
        // Once `halted` is set the state file is immortal for the session (only
        // `complete` unlinks it), so every later stop fire re-entered this branch
        // and appended another line with the same `run_id` and `iterations`: an
        // unbounded number of duplicate halt records in the ledger the acceptance
        // criteria's counts are derived from. The FIRST halt is the event; the rest
        // are the same fact re-stated.
        const alreadyStamped = prev?.halted !== undefined;
        // `blocked` can use neither `halted` (not in `HALT_ACTIONS`, by ADR-235) nor
        // a state field (the state is cleared below). The ledger survives both.
        const alreadyBlocked =
            action === 'blocked' && eventAlreadyLogged(workspaceRoot, runId, slug, 'blocked');
        if (!alreadyStamped && !alreadyBlocked) {
            appendEvent(workspaceRoot, {
                event: action,
                run_id: runId,
                roadmap: slug,
                turn: turnOrdinal,
                iterations: state.iterations,
                open: scan.open,
                blocked: scan.blocked,
                // A ledger line is a persisted shape carrying a `RunTerminalState`,
                // so it names the vocabulary version it was written against: a
                // reader meeting an unknown value can then tell a newer writer
                // from a corrupt row.
                terminal_state: terminalStateFor(action),
                terminal_vocabulary_version: RUN_TERMINAL_VOCABULARY_VERSION,
                at: new Date().toISOString(),
                ...roots,
            });
        }
        if (action === 'complete') {
            // Only a COMPLETION clears the state, so a later run on the same
            // roadmap (post-merge follow-up, re-claim) starts a fresh budget.
            // A halt must NOT clear it — see `RunState.halted`.
            clearRunState(workspaceRoot, runId, stateFile, mainState.from === 'legacy');
            return EXIT_ALLOW;
        }
        if (action === 'blocked') {
            // CLEARED, like `complete`, and `runId` is why: it is
            // `deriveSessionKey(sessionId)` — a SESSION hash — so this same session
            // re-claiming this same roadmap reuses this same keyed file. Keeping the
            // state would hand the next run a spent budget, and since the ladder
            // tests `blocked` BEFORE the iteration cap, an unblocked roadmap could go
            // straight to `halt-max-iterations` without ever engaging.
            //
            // Safe only because the once-guard is the LEDGER: the next fire builds a
            // fresh state, reaches `blocked`, finds the line and stays silent.
            clearRunState(workspaceRoot, runId, stateFile, mainState.from === 'legacy');
            return EXIT_ALLOW;
        }
        // A halt is recorded in place. A failed write is fail-open in the safe
        // direction here: the rung already decided to allow this stop, and the
        // worst case of a lost stamp is the pre-fix behaviour, never a block.
        if (!state.halted) {
            state.halted = action;
            writeState(stateFile, state);
        }
        return EXIT_ALLOW;
    }

    state.iterations += 1;
    state.last_turn = turnOrdinal;
    // Recorded ONCE — the premise this run engaged under. See the field's docblock.
    if (state.context_fingerprint === undefined && observed !== null) {
        state.context_fingerprint = observed;
    }
    state.history.push(scan.open);
    state.last_engaged_at = new Date().toISOString();
    if (!writeState(stateFile, state)) {
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
        ...roots,
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
