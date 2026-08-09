#!/usr/bin/env node
/**
 * End-review nudge — `stop` concern
 * (road-to-orchestrator-discipline-carriers Phase 5, F4-lite).
 *
 * Five measured session transcripts found ZERO neutral end-of-task reviews —
 * every session self-attested "CI green, ready for review". This concern
 * fires the advisory obligation at the exact moment a mutating session ends
 * without one, and counts the skip deterministically (hook-carried, not
 * model-carried) so a future blocking decision has a measured distribution to
 * cite. That decision — its threshold AND the stop-slot delivery question
 * underneath it — is open and maintainer-owned; it is recorded in
 * `agents/settings/contexts/orchestrator-carriers-open-decisions.md` § 1.
 * It used to be cited here as blocker `f4-full-blocking-decision`, which
 * stopped resolving the moment its roadmap was archived.
 *
 * Fires ONLY when BOTH hold:
 *   (a) the session mutated tracked, non-doc files beyond
 *       `MUTATION_LINE_THRESHOLD` (default 50) changed lines, AND
 *   (b) no reviewer ran this session (no Agent/Task dispatch whose prompt is
 *       review/judge-shaped, and no review/judge-skill invocation observed
 *       in the transcript).
 *
 * ## Diff source — chosen, not assumed
 *
 * `git diff --numstat HEAD` at `workspace_root`: the working tree vs the
 * last commit, TRACKED files only, PLUS every untracked non-doc file
 * (`git ls-files --others --exclude-standard`, one `git diff --numstat
 * --no-index /dev/null <file>` per file — see "Untracked files" below;
 * fixes a review finding, F6, that a brand-new file was previously invisible
 * to this count entirely). Chosen over a session-start SHA/timestamp
 * baseline because no such baseline exists anywhere a `stop` concern can
 * read it (recording one would be new session-wide state, out of this
 * roadmap phase's one-concern scope). Two consequences, stated rather than
 * hidden:
 *   - Uncommitted changes that PREDATE this session (a dirty working tree
 *     the user already had) are counted as if they were this session's
 *     mutation. Per `commit-policy`, an agent almost never commits without
 *     explicit permission, so "uncommitted since HEAD" is usually a good
 *     proxy for "mutated this session" in practice — but it is a proxy, not
 *     an exact measure.
 *   - A session that DID commit mid-turn (one of `commit-policy`'s four
 *     exceptions) moves HEAD, so mutations already committed are invisible
 *     to this diff. Declared, not silently assumed away.
 *   - No git repo, no HEAD commit yet, or `git` unavailable → the diff read
 *     fails closed to `0` lines (silent), never a crash.
 *
 * ### Untracked files (F6)
 *
 * `git diff --numstat HEAD` diffs the INDEX/HEAD against the working tree —
 * it is blind to a file that was never `git add`-ed at all, so a session
 * that authored a brand-new 300-line module was previously measured as a
 * 0-line mutation. `untrackedNonDocFiles` lists the candidates
 * (`git ls-files --others --exclude-standard`, filtered by the same
 * `isDocPath` carve-out); `untrackedFileLineCount` sizes each one via
 * `git diff --no-index /dev/null <file>` (the only way to diff a path git's
 * index has never seen). Past `UNTRACKED_FILE_CAP` untracked non-doc files
 * this hook refuses to spawn one subprocess per file — an unbounded loop is
 * worse than an imprecise answer — and instead reports a line count
 * GUARANTEED to be over `MUTATION_LINE_THRESHOLD`: "many new files this
 * session" is itself sufficient signal to fire without the exact count.
 *
 * ## Reviewer detection — a heuristic over the transcript, honestly scoped
 *
 * `payload.transcript_path` (present on Claude Code / Cowork stop events,
 * per `chat_history.ts`'s `_extract_cursor_text` / `_extract_gemini_text`
 * sibling readers) is scanned for an assistant `tool_use` block that is
 * either:
 *   - an Agent/Task dispatch whose description/subagent_type text looks
 *     review- or judge-shaped (matched against the broader
 *     `REVIEW_SHAPED_LABEL_RE` — a short, deliberately-named field, so a
 *     bare `review`/`judge` keyword IS itself the signal), or its free-form
 *     `prompt` text matches the NARROWER `REVIEW_SHAPED_PROMPT_RE` (F15,
 *     review: the broader pattern false-positived on ordinary prose like
 *     "update the review docs" when it leaked into prompt text — a bare
 *     `\breview\b` is too weak a signal once the field can hold ANY prose
 *     an author writes, so the prompt-text pattern requires a more specific
 *     phrase: "code review", "neutral review", "adversarial", "judge",
 *     "critique", "second opinion", "blind pass/review", "cross-model" —
 *     each names the SHAPE of a review rather than merely mentioning the
 *     word), or
 *   - a Skill invocation naming a review/judge skill
 *     (`review-changes`, `judge-*`, `adversarial-review`, `code-review`).
 *
 * What this does NOT observe, stated per `security-sensitive-stop` /
 * `untrusted-input-defense`'s honesty convention rather than left implicit:
 *   - A review narrated in prose with no tool call is invisible.
 *   - No `transcript_path` on the envelope (a platform this hook is not
 *     wired to, or a stripped payload) means reviewer activity CANNOT be
 *     confirmed — this hook resolves that ambiguity toward firing the
 *     advisory (favours recall: a spurious one-line nudge is cheap, a
 *     silently missed no-review session is the defect this concern exists
 *     to catch).
 *
 * ### Transcript-path hardening (gate finding fd47df62)
 *
 * `payload.transcript_path` is HOST-SUPPLIED, untrusted input, and this
 * concern would otherwise `fs.readFileSync` it unconditionally. Before any
 * read, `isSafeTranscriptPath` requires ALL of: (a) the path ends in
 * `.jsonl` — the one extension a real transcript ever carries; (b) the path
 * RESOLVES (`fs.realpathSync`, following any symlink) to somewhere under
 * `os.homedir()` — real transcripts live under `~/.claude/projects/**`
 * (`cache_realization_report.ts`, `mine_session.ts`, `orchestration_backfill.ts`
 * all hard-code that root), never under `workspace_root`; a `workspace_root`
 * prefix check would reject EVERY legitimate transcript and make this
 * concern fire on every qualifying Stop instead of only when a reviewer
 * genuinely didn't run; (c) the resolved file's size
 * (`fs.statSync`) is at or under `TRANSCRIPT_SCAN_MAX_BYTES` (50 MB) — past
 * that the scan is skipped rather than reading an unbounded file into
 * memory. ANY validation failure resolves the SAME way an unreadable
 * transcript already resolved pre-hardening: the scan is skipped and
 * `reviewerRan` stays `false` — i.e. it favours firing, exactly the recall
 * bias stated above for the missing-`transcript_path` case, never a crash
 * and never a silent "reviewer ran" false positive.
 *
 * A TOCTOU/symlink race between the `realpathSync` check and the later
 * `readFileSync` call exists in principle, but opens no new channel: the
 * once-per-session marker derived from this same path
 * (`deriveSessionKey`) hashes the path STRING, never reads or emits file
 * content, so the worst case a race could still produce is the same 1-bit
 * fire/no-fire outcome this concern already exposes by design — never a
 * content leak.
 *
 * ## Once-per-session fire gate (F2) — and the cost ordering that protects it (F12)
 *
 * Every `stop` event re-evaluates the SAME session's diff and transcript, so
 * without a fire gate this concern injected the advisory (and appended a
 * `review_skipped` telemetry line) on EVERY qualifying Stop in a long
 * session — a "session mutated N lines without review" nudge is a
 * session-scope fact, not a per-turn one, and repeating it past the first
 * fire is exactly the per-turn-canary shape `delegation-nudge`'s own header
 * warns against. A marker file under
 * `<workspace_root>/agents/runtime/state/end-review-nudge/<key>.json`
 * (gitignored — `agents/runtime/` is a blanket-ignored path) records that
 * THIS session already fired; a later Stop in the same session sees the
 * marker and returns silently, without re-running the transcript scan.
 *
 * `<key>` is a SHA-256 of `envelope.session_id` (present on every
 * dispatcher-built envelope, `envelope.ts`), falling back to
 * `payload.transcript_path` for a legacy/raw-payload invocation that
 * carries no `session_id` at all — hashed, never the raw value, so the
 * state filename never leaks a real transcript path (mirrors the
 * PRIVACY-BY-CONSTRUCTION discipline `review_skipped_record.ts` already
 * states for the telemetry line itself: the fire-gate marker carries a
 * timestamp and nothing else that could identify a session by content).
 *
 * ORDERING (F12, review): the once-per-session check runs AFTER the cheap
 * `git diff --numstat` mutation check but BEFORE the expensive transcript
 * read + line-by-line JSON parse. A session that already fired stops at a
 * single `fs.existsSync` call — it never re-reads a (potentially large)
 * transcript file it already knows the answer for.
 *
 * DELIVERY PATH — fixed to mirror `language_mirror_hook.ts` (found while
 * verifying this concern end-to-end; the original plain-text
 * `process.stdout.write(buildAdvisoryLine(...))` at exit 0 below is
 * superseded). Plain text on stdout at exit 0 never reached the model on ANY
 * platform: `dispatch_hook._parse_concern_stdout` fails to `JSON.parse` it
 * and returns `{_raw_stdout: …}`, which carries neither a `reason` nor an
 * `additional_context` key, so the concern's message text is silently
 * dropped before `host_semantics.emitFor` is even called — independent of
 * severity or platform. This concern now reports
 * `{decision:"warn", reason, additional_context}` at exit `EXIT_WARN` (2),
 * the one shape `dispatch_hook.ts` forwards into
 * `hookSpecificOutput.additionalContext` on the verified `claude` platform.
 *
 * WHY EXIT 2 NEVER BLOCKS (verified, not assumed). `host_semantics.emitFor`'s
 * `severity === "warn"` branch returns `{exit: 0, stdout:
 * claudeAdditionalContext(event, reason)}` UNCONDITIONALLY — it does not
 * consult `CLAUDE_BLOCK_CAPABLE_EVENTS` at all (that set only gates the
 * `"block"` severity branch, which this concern never reports). So on
 * `claude` the real process exit handed back to the host is always 0 for a
 * warn verdict on `stop`, exactly as it is on `user_prompt_submit` for
 * `language_mirror_hook.ts` — the shipped concern this pattern is copied
 * from, which returns the identical exit code on effectively every prompt
 * carrying language markers without ever blocking a turn in production.
 *
 * `team_review_gate_hook.ts` — the other existing `stop` concern — was
 * checked as a candidate second precedent and found to diverge in a way that
 * is NOT worth following: it writes a plain-text `notice` at exit 0
 * (`src/scripts/team_review_gate_hook.ts`), which the same
 * `_parse_concern_stdout` / `severity==="allow"` discard applies to — its
 * own advisory notice is, by the same trace, never delivered to the model on
 * `claude` either. That is a pre-existing gap in a different concern, out of
 * this task's scope to fix; this concern follows the ONE pattern verified to
 * actually deliver (`language_mirror_hook.ts`), not the one that shares this
 * concern's `stop` slot but does not deliver.
 *
 * PLATFORM SCOPE — bound only on `claude` in the manifest.
 * `host_semantics.VERIFIED_PLATFORMS` covers only `claude` (the "never
 * blocks" proof above). `cowork` is DELIBERATELY NOT bound (F10, review) —
 * `scripts/hooks/cowork-dispatcher.sh` discards the dispatcher's exit code
 * and stdout unconditionally (`>/dev/null 2>&1 || true; exit 0`), and this
 * concern's entire delivery depends on `additional_context` reaching the
 * model via stdout at the verified exit-2 warn path — a delivery that
 * trampoline makes structurally impossible. The payload shape was never the
 * blocker here: that same trampoline's own header comment states Cowork's
 * `Stop` event does carry `transcript_path`, matching what this concern
 * reads — the exit/stdout discard is what makes binding it dead weight, not
 * a missing field. Cursor / Cline / Windsurf / Gemini are deliberately NOT
 * added: none was inspected for the same discard property, their `stop`
 * payload shape for `transcript_path` is undocumented here, and extending an
 * exit-2 warn onto an unverified propagation path is exactly the
 * speculative mapping `host_semantics.ts` exists to avoid.
 *
 * CONTRACT: never blocks THE ACTUAL TURN. The DISPATCHER-INTERNAL exit is 2
 * on a fire (never 1/BLOCK, never >=3), `fail_closed: false`; the HOST-FACING
 * exit on `claude` is 0 either way, per the proof above. Doc-only
 * diffs, a reviewer having run, or any unreadable/malformed input all
 * resolve to silence (dispatcher-internal exit 0), not a crash.
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildReviewSkippedLine, type MutationMeasure } from '../_lib/review_skipped_record.js';
import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { atomic_write_json, is_replay_mode } from './state_io.js';

/** Default fire threshold — the council's high-risk shape (roadmap 5.1). */
export const MUTATION_LINE_THRESHOLD = 50;

/**
 * Untracked non-doc files past which this hook refuses to spawn one
 * `git diff --no-index` subprocess per file and instead reports the
 * mutation as certainly over threshold (F6, review — see the file header's
 * "Untracked files" section).
 */
export const UNTRACKED_FILE_CAP = 20;

/**
 * Transcript-scan size cap (gate finding fd47df62 — see the file header's
 * "Transcript-path hardening" section). Past this many bytes,
 * `isSafeTranscriptPath` refuses the path and the scan is skipped.
 */
export const TRANSCRIPT_SCAN_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Validate a `transcript_path` BEFORE any `fs.readFileSync` of it (gate
 * finding fd47df62). All three checks must pass:
 *   (a) the path ends in `.jsonl`;
 *   (b) it RESOLVES (`fs.realpathSync`, following any symlink) to a
 *       location under `homeDir` (defaults to `os.homedir()` — injectable
 *       for tests; production callers never override it — real transcripts
 *       live under `~/.claude/projects/**`, never under `workspace_root`,
 *       see the file header for why the prefix check is home, not
 *       workspace);
 *   (c) its resolved size is at or under `maxBytes` (defaults to
 *       `TRANSCRIPT_SCAN_MAX_BYTES` — injectable for tests only).
 *
 * Never throws — a missing file, a broken symlink, or any `fs` error all
 * resolve to `false` (refuse), matching this hook's fail-open-to-firing
 * contract for every other unreadable-transcript case.
 */
export function isSafeTranscriptPath(
    rawPath: string,
    opts: { homeDir?: string; maxBytes?: number } = {},
): boolean {
    if (!rawPath || !/\.jsonl$/i.test(rawPath)) return false;
    const homeDir = opts.homeDir ?? os.homedir();
    const maxBytes = opts.maxBytes ?? TRANSCRIPT_SCAN_MAX_BYTES;
    try {
        const realHome = fs.realpathSync(homeDir);
        const realPath = fs.realpathSync(rawPath);
        const relative = path.relative(realHome, realPath);
        if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
            return false;
        }
        const { size } = fs.statSync(realPath);
        return size <= maxBytes;
    } catch {
        return false;
    }
}

// Severity is taken from the EXIT CODE, not from the `decision` field in the
// stdout payload — mirrors `language_mirror_hook.ts`. A warn verdict is
// reported at exit 2 so `host_semantics.emitFor` reduces it to severity
// `"warn"` and forwards `additional_context`; see the file header for why
// this exit code never actually blocks the turn on `claude`.
const EXIT_WARN = 2;

/** One `git diff --numstat` row: added/deleted line counts + the path. */
export interface NumstatRow {
    added: number;
    deleted: number;
    path: string;
}

/**
 * Parse `git diff --numstat` output. Binary files print `-\t-\tpath` — those
 * rows count as 0 lines (there is no line-level diff to weigh).
 */
export function parseNumstat(raw: string): NumstatRow[] {
    const rows: NumstatRow[] = [];
    for (const line of raw.split('\n')) {
        const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
        if (!m) continue;
        const addedStr = m[1] as string;
        const deletedStr = m[2] as string;
        rows.push({
            added: addedStr === '-' ? 0 : Number(addedStr),
            deleted: deletedStr === '-' ? 0 : Number(deletedStr),
            path: m[3] as string,
        });
    }
    return rows;
}

const DOC_PATH_RE = /\.md$/i;

/** True for the "outside `*.md`/docs" carve-out the roadmap's threshold names. */
export function isDocPath(p: string): boolean {
    return DOC_PATH_RE.test(p);
}

/** Sum of added+deleted lines across every NON-doc row. */
export function nonDocMutatedLines(rows: readonly NumstatRow[]): number {
    return rows
        .filter((r) => !isDocPath(r.path))
        .reduce((sum, r) => sum + r.added + r.deleted, 0);
}

/**
 * `git diff --numstat HEAD` at `cwd`. Fails closed to `[]` (never throws) —
 * no repo, no HEAD, or `git` missing all read as "nothing to measure".
 */
export function gitNumstatRows(cwd: string): NumstatRow[] {
    try {
        const r = spawnSync('git', ['diff', '--numstat', 'HEAD'], {
            cwd,
            encoding: 'utf8',
            maxBuffer: 16 * 1024 * 1024,
        });
        if (r.status !== 0) return [];
        return parseNumstat(r.stdout ?? '');
    } catch {
        return [];
    }
}

/**
 * Untracked, non-doc files at `cwd` (F6, review). `git diff --numstat HEAD`
 * only ever diffs paths git's index already knows about — a brand-new file
 * this session created is invisible to it. Fails closed to `[]` (never
 * throws), matching `gitNumstatRows`'s own contract.
 */
export function untrackedNonDocFiles(cwd: string): string[] {
    try {
        const r = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {
            cwd,
            encoding: 'utf8',
            maxBuffer: 16 * 1024 * 1024,
        });
        if (r.status !== 0) return [];
        return (r.stdout ?? '')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !isDocPath(l));
    } catch {
        return [];
    }
}

/**
 * Added+deleted line count for ONE untracked file, via
 * `git diff --numstat --no-index /dev/null <relPath>` — the only way to
 * diff a path git's index has never seen. `--no-index` exits `1` whenever a
 * diff exists (by design, unlike `gitNumstatRows`'s tracked-diff contract,
 * where a nonzero status means failure) — only the parsed numstat rows
 * matter here, never the exit code. Fails closed to `0`, never throws.
 */
export function untrackedFileLineCount(cwd: string, relPath: string): number {
    try {
        const r = spawnSync('git', ['diff', '--numstat', '--no-index', '/dev/null', relPath], {
            cwd,
            encoding: 'utf8',
            maxBuffer: 16 * 1024 * 1024,
        });
        return parseNumstat(r.stdout ?? '').reduce((sum, row) => sum + row.added + row.deleted, 0);
    } catch {
        return 0;
    }
}

/** Result of {@link totalNonDocMutatedLinesWithMeasure}. */
export interface MutationMeasurement {
    lines: number;
    /** Whether `lines` is exact, or a capped, guaranteed-over-threshold
     * approximation (`UNTRACKED_FILE_CAP` path) — see that function. */
    measure: MutationMeasure;
}

/**
 * Total non-doc mutated lines across BOTH tracked (`git diff --numstat
 * HEAD`) and untracked (`git ls-files --others --exclude-standard`) files —
 * see the file header's "Untracked files (F6)" section for why both sources
 * are required. Past `UNTRACKED_FILE_CAP` untracked non-doc files this
 * function refuses to spawn one `git diff --no-index` subprocess per file
 * (an unbounded loop) and instead returns a value GUARANTEED to be over
 * `MUTATION_LINE_THRESHOLD` — "many new files this session" is itself
 * sufficient signal, no exact count needed. `measure` records WHICH of
 * those two shapes the returned `lines` value is, so a consumer (the
 * `review_skipped` telemetry line, via `main()`) never mixes exact and
 * approximated counts in one unlabeled stream.
 */
export function totalNonDocMutatedLinesWithMeasure(cwd: string): MutationMeasurement {
    const trackedLines = nonDocMutatedLines(gitNumstatRows(cwd));
    const untracked = untrackedNonDocFiles(cwd);
    if (untracked.length > UNTRACKED_FILE_CAP) {
        return { lines: MUTATION_LINE_THRESHOLD + 1 + trackedLines, measure: 'capped_approximation' };
    }
    const untrackedLines = untracked.reduce(
        (sum, relPath) => sum + untrackedFileLineCount(cwd, relPath),
        0,
    );
    return { lines: trackedLines + untrackedLines, measure: 'exact' };
}

/**
 * Backward-compatible, lines-only view of
 * {@link totalNonDocMutatedLinesWithMeasure} — kept for callers (and tests)
 * that only need the count, not which measure produced it.
 */
export function totalNonDocMutatedLines(cwd: string): number {
    return totalNonDocMutatedLinesWithMeasure(cwd).lines;
}

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: JsonValue | undefined): string {
    return typeof v === 'string' ? v : '';
}

// Agent/Task dispatch tool names this environment's subagent-spawn primitive
// is known under. Matched case-insensitively.
const DISPATCH_TOOL_RE = /^(agent|task)$/i;
// `description`/`subagent_type` are short, deliberately-named fields (an
// author names a subagent's TYPE or writes a one-line label for it) — a
// bare `review`/`judge`/etc keyword there IS itself the signal.
const REVIEW_SHAPED_LABEL_RE =
    /\b(review|judge|adversarial|critique|second[- ]opinion|blind\s+(pass|review)|cross-model)\b/i;
// F15 (review): `prompt` is free-form prose an author writes for ANY
// purpose, so the same bare `\breview\b` false-positived on ordinary work
// ("update the review docs"). Narrower on purpose — each phrase names the
// SHAPE of a review rather than merely mentioning the word.
const REVIEW_SHAPED_PROMPT_RE =
    /\b(code\s+review|neutral\s+review|adversarial|judge|critique|second[- ]opinion|blind\s+(pass|review)|cross-model)\b/i;
// Skill invocation naming a review/judge skill (hyphen- or colon-separated
// namespace forms both seen across this suite's skill/command catalogue).
const REVIEW_SKILL_NAME_RE =
    /^(review[-:]changes|judge[-:][a-z0-9-]+|adversarial-review|code-review)$/i;

/**
 * True when at least one assistant `tool_use` block in `transcriptText`
 * looks like a neutral review/judge pass — an Agent/Task dispatch with a
 * review-shaped `description`/`subagent_type` label or `prompt` text, or a
 * Skill invocation naming a review/judge skill.
 *
 * Scans the WHOLE transcript (session scope), not just the latest turn —
 * "no reviewer ran this session" is a session-wide claim.
 */
export function scanTranscriptForReviewer(transcriptText: string): boolean {
    for (const raw of transcriptText.split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        let obj: unknown;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        if (!isObject(obj) || obj['type'] !== 'assistant') continue;
        const msg = obj['message'];
        if (!isObject(msg)) continue;
        const content = msg['content'];
        if (!Array.isArray(content)) continue;
        for (const blk of content) {
            if (!isObject(blk) || blk['type'] !== 'tool_use') continue;
            const name = str(blk['name'] as JsonValue | undefined);
            const input = blk['input'];
            const inputObj = isObject(input) ? input : {};
            if (DISPATCH_TOOL_RE.test(name)) {
                const label = [
                    str(inputObj['description'] as JsonValue | undefined),
                    str(inputObj['subagent_type'] as JsonValue | undefined),
                ]
                    .filter(Boolean)
                    .join(' ');
                if (REVIEW_SHAPED_LABEL_RE.test(label)) return true;
                const prompt = str(inputObj['prompt'] as JsonValue | undefined);
                if (REVIEW_SHAPED_PROMPT_RE.test(prompt)) return true;
                continue;
            }
            if (/^skill$/i.test(name)) {
                const skillName =
                    str(inputObj['skill'] as JsonValue | undefined) ||
                    str(inputObj['name'] as JsonValue | undefined) ||
                    str(inputObj['command'] as JsonValue | undefined);
                if (REVIEW_SKILL_NAME_RE.test(skillName)) return true;
                continue;
            }
            // A tool_use literally named after a review/judge skill (some
            // hosts expose a skill invocation as its own tool name).
            if (REVIEW_SKILL_NAME_RE.test(name)) return true;
        }
    }
    return false;
}

/** The exactly-one advisory line this concern injects when it fires. */
export function buildAdvisoryLine(diffLines: number): string {
    return (
        `this session mutated ${diffLines} lines without a neutral review; ` +
        `spawn a cross-model reviewer before claiming done (delegation-policy / verify-budget)`
    );
}

/**
 * Append ONE `review_skipped` line to the monthly audit log. Never throws —
 * a telemetry write failure must not cost the user their turn.
 *
 * Honours `AGENT_CONFIG_REPLAY=1` the same way `orchestration_record_hook.ts`
 * does for its own per-call JSONL append (F5, review) — a fixture-replay run
 * must never write real telemetry, and this write had no such guard.
 */
export function appendReviewSkippedTelemetry(
    workspaceRoot: string,
    diffLines: number,
    mutationMeasure: MutationMeasure,
): void {
    if (is_replay_mode()) return;
    const ts = new Date().toISOString();
    const { line, errors } = buildReviewSkippedLine({
        diff_lines: diffLines,
        mutation_measure: mutationMeasure,
        ts,
        id: crypto.randomUUID(),
    });
    if (errors.length || line === null) return; // refused input — never write a broken line
    try {
        const dir = path.join(workspaceRoot, 'agents', 'runtime', 'state', 'audit');
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${ts.slice(0, 7)}.jsonl`);
        fs.appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
    } catch {
        // an unwritable audit dir must never break the Stop path
    }
}

/** Directory holding the once-per-session fire-gate markers (F2, review). */
function sessionStateDir(workspaceRoot: string): string {
    return path.join(workspaceRoot, 'agents', 'runtime', 'state', 'end-review-nudge');
}

function sessionStateFile(workspaceRoot: string, sessionKey: string): string {
    return path.join(sessionStateDir(workspaceRoot), `${sessionKey}.json`);
}

/**
 * Derive a stable, filesystem-safe once-per-session key (F2, review).
 * Prefers the dispatcher envelope's own `session_id` (present on every
 * envelope the dispatcher itself builds — `envelope.ts`'s `unwrap`); falls
 * back to `payload.transcript_path` for a legacy/raw-payload invocation
 * that carries no `session_id` at all. HASHED, never stored raw, so the
 * marker filename can never leak a real transcript path.
 *
 * FULL digest, not truncated (council finding, this task): a 64-bit
 * truncation (16 hex chars) makes birthday collisions between unrelated
 * sessions non-negligible at the population sizes this hook will
 * accumulate over time — a collision silently merges two sessions' fire
 * gates, undercounting `review_skipped` telemetry and biasing any future
 * blocking-threshold calibration downward. The full 256-bit hex digest
 * makes that collision probability negligible; the classification risk
 * this key carries is a 1-bit fire/no-fire outcome (see the file header's
 * "Transcript-path hardening" section), never file content, so there is no
 * privacy cost to keeping the full digest.
 */
export function deriveSessionKey(envelope: JsonObject, payload: JsonObject): string {
    const raw =
        str(envelope['session_id'] as JsonValue | undefined) ||
        str((payload['transcript_path'] ?? payload['transcriptPath']) as JsonValue | undefined);
    const material = raw || 'unknown-session';
    return crypto.createHash('sha256').update(material).digest('hex');
}

/**
 * True when THIS session already fired the nudge (F2, review). Fails
 * closed to `false` on a read error — "not yet fired" is the safer
 * default: worst case it repeats a nudge, it never silences a genuine one
 * over a merely-unreadable state directory.
 */
export function hasFiredThisSession(workspaceRoot: string, sessionKey: string): boolean {
    try {
        return fs.existsSync(sessionStateFile(workspaceRoot, sessionKey));
    } catch {
        return false;
    }
}

/**
 * Record that THIS session has fired. `atomic_write_json` is already
 * `AGENT_CONFIG_REPLAY`-aware (a no-op under replay), so a fixture-replay
 * run leaves no marker behind either — consistent with the telemetry-write
 * guard above.
 */
function markFiredThisSession(workspaceRoot: string, sessionKey: string, ts: string): void {
    try {
        atomic_write_json(sessionStateFile(workspaceRoot, sessionKey), { fired_at: ts });
    } catch {
        // a state-write failure must never block the Stop path
    }
}

function _read_stdin(): string {
    return readHookStdin();
}

export function main(): number {
    const [envelope, payload] = unwrap(_read_stdin(), 'claude');

    const event = String(envelope['event'] ?? '');
    if (event !== '' && event !== 'stop') {
        return 0;
    }

    const workspace_root =
        String(envelope['workspace_root'] ?? '').trim() || process.cwd();

    let diffLines: number;
    let mutationMeasure: MutationMeasure;
    try {
        const measured = totalNonDocMutatedLinesWithMeasure(workspace_root);
        diffLines = measured.lines;
        mutationMeasure = measured.measure;
    } catch {
        return 0; // fail-open — never block the agent loop
    }
    if (diffLines <= MUTATION_LINE_THRESHOLD) {
        return 0; // below threshold, or a doc-only diff — nothing to nudge
    }

    // F2/F12 (review): the once-per-session fire gate runs on the CHEAP
    // git-diff result, BEFORE the expensive transcript read + line-by-line
    // JSON parse below. A session that already fired stops here, at a
    // single `fs.existsSync` call, without re-reading a (potentially
    // large) transcript file it already knows the answer for.
    const sessionKey = deriveSessionKey(envelope, payload);
    if (hasFiredThisSession(workspace_root, sessionKey)) {
        return 0;
    }

    const transcriptPath = str(
        (payload['transcript_path'] ?? payload['transcriptPath']) as JsonValue | undefined,
    ).trim();
    let reviewerRan = false;
    // Gate finding fd47df62: validate BEFORE reading — see the file header's
    // "Transcript-path hardening" section. A path that fails validation
    // (wrong extension, resolves outside home, oversized) is treated exactly
    // like an unreadable transcript below: the scan is skipped and
    // `reviewerRan` stays `false`, resolving toward firing, not silence.
    if (transcriptPath && isSafeTranscriptPath(transcriptPath)) {
        try {
            reviewerRan = scanTranscriptForReviewer(fs.readFileSync(transcriptPath, 'utf-8'));
        } catch {
            // unreadable transcript — cannot confirm a reviewer ran; see the
            // header note on why that resolves toward firing, not silence.
            reviewerRan = false;
        }
    }
    if (reviewerRan) {
        return 0;
    }

    // Only mark THIS session as fired once the nudge is actually about to
    // be injected — a turn that stopped above (below threshold, already
    // fired, or a reviewer ran) never claims the once-per-session slot.
    markFiredThisSession(workspace_root, sessionKey, new Date().toISOString());

    try {
        appendReviewSkippedTelemetry(workspace_root, diffLines, mutationMeasure);
    } catch {
        // never let a telemetry failure block or fail the turn
    }

    process.stdout.write(
        `${JSON.stringify({
            decision: 'warn',
            reason: `end-review-nudge: session mutated ${diffLines} non-doc lines without a neutral review`,
            additional_context: buildAdvisoryLine(diffLines),
        })}\n`,
    );
    return EXIT_WARN;
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
