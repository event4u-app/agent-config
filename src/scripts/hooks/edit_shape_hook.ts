#!/usr/bin/env node
/**
 * Edit-shape advisory — `post_tool_use` concern
 * (road-to-token-economy-cache Phase 5.1/5.2).
 *
 * Fires when a `Write` tool call REPLACED an existing, git-tracked file of at
 * least `MIN_FILE_LINES` lines while the effective change was at most
 * `MAX_DIFF_RATIO` of the file — the wasteful shape where the agent re-emits
 * a whole file to change a few lines. One advisory line names the cheaper
 * primitive: a targeted Edit pays for the diff, not the file.
 *
 * ## Committed thresholds (roadmap 5.1 — committed in this concern header)
 *
 * `MIN_FILE_LINES = 50` and `MAX_DIFF_RATIO = 0.20` are COMMITTED constants,
 * not tunables: the roadmap requires the thresholds to live in the concern
 * header so a threshold change is a reviewed diff, never a silent drift.
 * Ratio definition: `(added + deleted) / current file line count` from
 * `git diff --numstat` — a 5-line in-place change on a 60-line file measures
 * as 10/60 ≈ 17 % (numstat counts a changed line once on each side).
 *
 * ## Honest mechanism — why git, not the payload
 *
 * At PostToolUse time the target file is ALREADY overwritten on disk, and the
 * PostToolUse payload carries only the NEW content (`tool_input.content`) —
 * the pre-image is not observable from the event itself (verified against the
 * payload shapes `design_slop_hook.ts` / `orchestration_record_hook.ts`
 * read). The pre-image that IS still observable is git's: for a tracked file,
 * `git diff HEAD --numstat -- <path>` diffs the working tree against the last
 * commit, so `added + deleted` is a deterministic effective-diff measure.
 * Two consequences, stated rather than hidden:
 *   - The measured diff is CUMULATIVE since HEAD for that path, not the delta
 *     of this one Write. A session's second small Write to the same file
 *     measures both writes together — an over-count that only makes the
 *     ratio LARGER, i.e. biases toward silence, never toward a false fire.
 *   - An untracked (brand-new) file has no HEAD pre-image and produces no
 *     numstat row → silent. Correct: writing a new file is not a wasteful
 *     replace, it is the only primitive that creates one.
 * A path with NO unstaged/staged modification vs HEAD (diff of 0 lines) is
 * also silent — the fire condition per the roadmap is "tracked in git with an
 * observable modification whose ratio is small", and a 0-row diff cannot
 * distinguish a no-op Write from an already-committed state.
 *
 * ## Once-per-session gate (roadmap 5.2)
 *
 * Mirrors `end_review_nudge_hook.ts`'s F2 marker: a JSON marker under
 * `<workspace_root>/agents/runtime/state/edit-shape/<sha256(session)>.json`
 * (gitignored — `agents/runtime/` is blanket-ignored) records that THIS
 * session already fired; later qualifying Writes in the same session return
 * silently. The marker carries a timestamp and nothing else — counts/flags
 * only, never content. The economy nudge must not itself become an economy
 * problem.
 *
 * ## Path exemptions (committed constant — shared list with `reread-guard`)
 *
 * `dist/**`, any path containing `/generated/`, `*.lock`, `*.min.*`, and
 * `agents/runtime/**` are exempt: generated/derived surfaces are legitimately
 * re-emitted wholesale, and nudging there is pure noise.
 *
 * ## Delivery — `{decision:"warn", reason, additional_context}` at exit 2
 *
 * Mirrors `delegation_nudge_hook.ts` exactly. Severity is taken from the
 * EXIT CODE, not the `decision` field: a warn verdict is reported at exit
 * `EXIT_WARN` (2) so `host_semantics.emitFor` reduces it to severity `"warn"`
 * and forwards `additional_context` into
 * `hookSpecificOutput.additionalContext`.
 *
 * WHY EXIT 2 NEVER BLOCKS (copied from `delegation_nudge_hook.ts`, verified
 * there against the real dispatcher): `host_semantics.emitFor`'s
 * `severity === "warn"` branch returns `{exit: 0, stdout:
 * claudeAdditionalContext(event, reason)}` UNCONDITIONALLY — it does not
 * consult `CLAUDE_BLOCK_CAPABLE_EVENTS` at all (that check only gates the
 * `"block"` severity branch). On the verified `claude` platform the real
 * process exit handed back to the host is always 0 for a warn verdict; the
 * internal `EXIT_WARN` is dispatcher-internal bookkeeping, never the byte
 * that reaches Claude Code.
 *
 * ROBUSTNESS: malformed payload → exit 0 silently; every fs/git error is
 * swallowed. This concern never blocks a tool call on any path.
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { atomic_write_json } from './state_io.js';

const EXIT_ALLOW = 0;
// Severity is taken from the EXIT CODE, not from the `decision` field in the
// stdout payload — see the file header for why this never blocks on `claude`.
const EXIT_WARN = 2;

/** Committed threshold (roadmap 5.1): minimum current line count of the
 *  replaced file before this concern has anything to say. */
export const MIN_FILE_LINES = 50;

/** Committed threshold (roadmap 5.1): maximum `(added+deleted)/fileLines`
 *  ratio for the Write to count as a full-rewrite-with-small-diff. */
export const MAX_DIFF_RATIO = 0.2;

/**
 * Committed exemption list (roadmap 5.2/6.2 — deliberately duplicated in
 * `reread_guard_hook.ts`; the two concerns share the list by convention, and
 * a shared module would couple two independently-rollback-able hooks).
 */
export const EXEMPT_PATH_PATTERNS: readonly RegExp[] = [
    /(^|\/)dist\//i, // dist/**
    /\/generated\//i, // any path containing /generated/
    /\.lock$/i, // *.lock
    /\.min\.[^/]+$/i, // *.min.*
    /(^|\/)agents\/runtime\//i, // agents/runtime/**
];

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: JsonValue | undefined): string {
    return typeof v === 'string' ? v : '';
}

/** True when `filePath` (absolute or repo-relative) matches the exemption list. */
export function isExemptPath(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return EXEMPT_PATH_PATTERNS.some((re) => re.test(normalized));
}

/** One `git diff --numstat` row reduced to its added+deleted line count. */
export function parseNumstatLines(raw: string): number {
    let total = 0;
    for (const line of raw.split('\n')) {
        const m = /^(\d+|-)\t(\d+|-)\t.+$/.exec(line);
        if (!m) continue;
        const added = m[1] === '-' ? 0 : Number(m[1]);
        const deleted = m[2] === '-' ? 0 : Number(m[2]);
        total += added + deleted;
    }
    return total;
}

/**
 * Effective-diff line count for ONE path: `git diff HEAD --numstat -- <path>`
 * at `cwd` (working tree + index vs the last commit — git still holds the
 * pre-image the PostToolUse payload no longer carries). Fails closed to `0`
 * (silent) — no repo, no HEAD, untracked path, or `git` missing all read as
 * "nothing observable to nudge about".
 */
export function effectiveDiffLines(cwd: string, relPath: string): number {
    try {
        const r = spawnSync('git', ['diff', 'HEAD', '--numstat', '--', relPath], {
            cwd,
            encoding: 'utf8',
            maxBuffer: 16 * 1024 * 1024,
        });
        if (r.status !== 0) return 0;
        return parseNumstatLines(r.stdout ?? '');
    } catch {
        return 0;
    }
}

/** Current line count of the file on disk. Fails closed to `0` (silent). */
export function fileLineCount(absPath: string): number {
    try {
        const text = fs.readFileSync(absPath, 'utf8');
        if (text.length === 0) return 0;
        // Trailing newline does not open a new line.
        return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
    } catch {
        return 0;
    }
}

/** The exactly-one advisory line this concern injects when it fires. */
export function buildAdvisoryLine(fileLines: number, diffLines: number): string {
    const pct = Math.round((diffLines / fileLines) * 100);
    return (
        `this Write replaced ${fileLines} lines for an effective diff of ~${pct}% ` +
        `(${diffLines} changed lines) — a targeted Edit pays for the diff, not the file.`
    );
}

/**
 * Stable, filesystem-safe once-per-session key — mirrors
 * `end_review_nudge_hook.deriveSessionKey`: the envelope's `session_id`
 * (falling back to the payload's) is HASHED, never stored raw.
 */
export function deriveSessionKey(envelope: JsonObject, payload: JsonObject): string {
    const raw =
        str(envelope['session_id'] as JsonValue | undefined) ||
        str((payload['session_id'] ?? payload['sessionId']) as JsonValue | undefined);
    const material = raw || 'unknown-session';
    return crypto.createHash('sha256').update(material).digest('hex');
}

function sessionStateFile(workspaceRoot: string, sessionKey: string): string {
    return path.join(workspaceRoot, 'agents', 'runtime', 'state', 'edit-shape', `${sessionKey}.json`);
}

/** True when THIS session already fired. Fails closed to `false` (may repeat,
 *  never silences over an unreadable state dir). */
export function hasFiredThisSession(workspaceRoot: string, sessionKey: string): boolean {
    try {
        return fs.existsSync(sessionStateFile(workspaceRoot, sessionKey));
    } catch {
        return false;
    }
}

function markFiredThisSession(workspaceRoot: string, sessionKey: string): void {
    try {
        atomic_write_json(sessionStateFile(workspaceRoot, sessionKey), {
            fired_at: new Date().toISOString(),
        });
    } catch {
        // a state-write failure must never affect the tool call
    }
}

function extractToolName(payload: JsonObject): string {
    return str((payload['tool_name'] ?? payload['toolName'] ?? payload['tool']) as JsonValue | undefined);
}

function extractFilePath(payload: JsonObject): string {
    const ti = payload['tool_input'] ?? payload['toolInput'] ?? payload['input'];
    if (!isObject(ti)) return '';
    return str((ti['file_path'] ?? ti['path'] ?? ti['filePath']) as JsonValue | undefined);
}

export function main(): number {
    try {
        const [envelope, payload] = unwrap(readHookStdin(), 'claude');

        const event = str(envelope['event'] as JsonValue | undefined);
        if (event !== '' && event !== 'post_tool_use') return EXIT_ALLOW;

        const toolName = extractToolName(payload);
        if (toolName !== 'Write') return EXIT_ALLOW; // manifest `tools: [Write]` twin — belt and braces

        const filePath = extractFilePath(payload);
        if (!filePath) return EXIT_ALLOW;

        const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
        const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
        const relPath = path.relative(workspaceRoot, absPath);
        if (isExemptPath(relPath) || isExemptPath(absPath)) return EXIT_ALLOW;

        const fileLines = fileLineCount(absPath);
        if (fileLines < MIN_FILE_LINES) return EXIT_ALLOW;

        const diffLines = effectiveDiffLines(workspaceRoot, relPath.startsWith('..') ? absPath : relPath);
        // 0 = no observable modification vs HEAD (untracked file, clean path,
        // no repo) — silent per the header's honest-mechanism note.
        if (diffLines === 0) return EXIT_ALLOW;
        if (diffLines / fileLines > MAX_DIFF_RATIO) return EXIT_ALLOW;

        // Cheap checks first, then the once-per-session gate (same ordering
        // discipline as end_review_nudge's F12).
        const sessionKey = deriveSessionKey(envelope, payload);
        if (hasFiredThisSession(workspaceRoot, sessionKey)) return EXIT_ALLOW;
        markFiredThisSession(workspaceRoot, sessionKey);

        process.stdout.write(
            `${JSON.stringify({
                decision: 'warn',
                reason: `edit-shape: Write replaced a ${fileLines}-line file for a ${diffLines}-line effective diff`,
                additional_context: buildAdvisoryLine(fileLines, diffLines),
            })}\n`,
        );
        return EXIT_WARN;
    } catch {
        return EXIT_ALLOW; // malformed payload / any error — never touch the tool call
    }
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
