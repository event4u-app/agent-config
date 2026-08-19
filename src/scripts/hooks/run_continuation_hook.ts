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
 * Every event this concern writes carries `workspace_root`, `session_root`,
 * `session_cwd`, `git_dir`, `git_common_dir` and `claim_path` — the two-tree
 * provenance, per `provenance()` below — plus `roadmap_path`, the file the
 * open-step count on that same line was read from (round 4 finding 4). Without them the ledger records that an
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

/** Re-exported so a test can assert the IDENTITY, not two matching literals. */
export { TRANSCRIPT_READ_MAX_BYTES };

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

/** The terminal rungs — the set `RunState.halted` may hold. */
export const HALT_ACTIONS: readonly LadderAction[] = [
    'halt-max-iterations',
    'halt-wall-clock',
    'halt-stall',
];

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
        if (body.includes('blocked-by:')) {
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
    // A halt is terminal for this run id. Checked BEFORE `complete` so a
    // halted run whose roadmap later reads zero-open does not report a
    // completion it never reached.
    if (state.halted) return state.halted;
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
        // Round-tripped, and it has to be: dropping it here would make the
        // source look changed on EVERY fire, reset the window every time, and
        // silently disable the stall detector the field was added to protect.
        if (typeof o['history_source'] === 'string') {
            rec.history_source = o['history_source'];
        }
        // Validated against the halt set rather than accepted as any string:
        // an unrecognised value would be returned verbatim by `ladder` and
        // become an action no branch below handles.
        const halted = o['halted'];
        if (
            typeof halted === 'string' &&
            (HALT_ACTIONS as readonly string[]).includes(halted)
        ) {
            rec.halted = halted as LadderAction;
        }
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
    const rel = path.join(dirRel, `${slug}.md`);
    // `path.join` has already collapsed `..`; the assertion is that what came out
    // is still inside the roadmaps directory.
    const norm = path.normalize(rel);
    if (!norm.startsWith(`${dirRel}${path.sep}`) || norm.includes('..')) return null;
    if (sessionRoot !== workspaceRoot && isDirectory(path.join(sessionRoot, dirRel))) {
        return path.join(sessionRoot, norm);
    }
    return path.join(workspaceRoot, norm);
}

function isDirectory(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
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
    if (roadmapPath === null) return EXIT_ALLOW;
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
        if (fs.statSync(transcriptPath).size > TRANSCRIPT_READ_MAX_BYTES) return EXIT_ALLOW;
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

    const runId = deriveSessionKey(sessionId || 'unknown-session');

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
    roots['roadmap_path'] = roadmapPath;

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
            ...roots,
        });
        if (action === 'complete') {
            // Only a COMPLETION clears the state, so a later run on the same
            // roadmap (post-merge follow-up, re-claim) starts a fresh budget.
            // A halt must NOT clear it — see `RunState.halted`.
            try {
                fs.rmSync(stateFile, { force: true });
            } catch {
                /* fail-open */
            }
            return EXIT_ALLOW;
        }
        // A halt is recorded in place. A failed write is fail-open in the safe
        // direction here: the rung already decided to allow this stop, and the
        // worst case of a lost stamp is the pre-fix behaviour, never a block.
        if (!state.halted) {
            state.halted = action;
            try {
                fs.mkdirSync(path.dirname(stateFile), { recursive: true });
                fs.writeFileSync(stateFile, `${JSON.stringify(state)}\n`, 'utf8');
            } catch {
                /* fail-open */
            }
        }
        return EXIT_ALLOW;
    }

    state.iterations += 1;
    state.last_turn = turnOrdinal;
    // Reset the stall window when the source document changed — see
    // `RunState.history_source`.
    if (state.history_source !== roadmapPath) {
        state.history = [];
        state.history_source = roadmapPath;
    }
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
