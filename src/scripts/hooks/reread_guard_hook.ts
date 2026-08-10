#!/usr/bin/env node
/**
 * Re-read guard + post-edit scope hint — `pre_tool_use` concern
 * (road-to-token-economy-cache Phase 6.1/6.2).
 *
 * Two signals, one session-scoped read ledger:
 *
 *   6.1 A full-file `Read` of a path that was ALREADY fully read this session
 *       AND is unchanged since (mtime + size compare against the ledger) gets
 *       one advisory line naming the earlier read and the ranged-read
 *       alternative. A ranged read (any `offset`/`limit` in the tool input)
 *       is already the cheap form and never fires — nor is it recorded as a
 *       full read.
 *   6.2 A full-file `Read` immediately following THIS session's own
 *       `Edit`/`Write` to the same path (last-write tracked in the same
 *       ledger — PreToolUse sees those tool calls too) gets the same advisory
 *       shape pointing at a ranged re-read of the edited hunk.
 *
 * ## The ledger — paths and numbers only, never content
 *
 * `<workspace_root>/agents/runtime/state/reread-guard/<sha256(session)>.json`
 * (gitignored — `agents/runtime/` is blanket-ignored), keyed by session id
 * the same way `end_review_nudge_hook.deriveSessionKey` does (hashed, never
 * raw). Per path it stores `{mtime, size, ts}` for reads, a `ts` for the last
 * own write, and a per-path fired flag — NO field can hold file content, by
 * construction (same PII/content-exclusion-by-construction discipline as the
 * telemetry schemas).
 *
 * Population: PreToolUse sees the Read BEFORE it happens, so the ledger is
 * populated in this same hook — after the staleness check, the current
 * `{mtime, size}` of the path is recorded (the read is about to happen;
 * recording pre-read is equivalent for every subsequent comparison).
 *
 * ## ADVISORY ONLY — never a block, never exit 1
 *
 * This concern binds on `pre_tool_use`, the slot that carries the blocking
 * guards — but it is advisory by construction and never returns exit 1: a
 * stale-ledger false positive on a BLOCK would corrupt work (the agent would
 * be denied a read it genuinely needs over a bookkeeping artifact). The
 * escalation decision waits on the 6.4 telemetry, per the roadmap.
 *
 * ## Path exemptions (committed constant — shared list with `edit-shape`)
 *
 * `dist/**`, any path containing `/generated/`, `*.lock`, `*.min.*`, and
 * `agents/runtime/**`. Deliberately DUPLICATED from `edit_shape_hook.ts`
 * (noted there too): the two concerns share the list by convention, and a
 * shared module would couple two independently-rollback-able hooks.
 *
 * ## Delivery — `{decision:"warn", reason, additional_context}` at exit 2
 *
 * Mirrors `delegation_nudge_hook.ts` exactly. WHY EXIT 2 NEVER BLOCKS
 * (copied from that hook's verified trace): `host_semantics.emitFor`'s
 * `severity === "warn"` branch returns `{exit: 0, stdout:
 * claudeAdditionalContext(event, reason)}` UNCONDITIONALLY — it does not
 * consult `CLAUDE_BLOCK_CAPABLE_EVENTS` (that check only gates the `"block"`
 * severity branch). On the verified `claude` platform the host-facing exit is
 * always 0 for a warn verdict; `EXIT_WARN` is dispatcher-internal
 * bookkeeping, never the byte that reaches the host.
 *
 * ROBUSTNESS: malformed payload → exit 0 silently; every fs error swallowed;
 * an unreadable/corrupt ledger resets to empty (worst case: one missed or
 * repeated advisory, never a lost read).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { atomic_write_json } from './state_io.js';

const EXIT_ALLOW = 0;
// Severity is taken from the EXIT CODE, not from the `decision` field — see
// the file header for why this never blocks on `claude`. This concern never
// returns exit 1 on any path.
const EXIT_WARN = 2;

/**
 * Committed exemption list — deliberately duplicated from
 * `edit_shape_hook.ts` (see the header note there and here).
 */
export const EXEMPT_PATH_PATTERNS: readonly RegExp[] = [
    /(^|\/)dist\//i, // dist/**
    /\/generated\//i, // any path containing /generated/
    /\.lock$/i, // *.lock
    /\.min\.[^/]+$/i, // *.min.*
    /(^|\/)agents\/runtime\//i, // agents/runtime/**
];

/** Tool names this concern reacts to (manifest `tools:` twin). */
export const READ_TOOLS: ReadonlySet<string> = new Set(['Read']);
export const WRITE_TOOLS: ReadonlySet<string> = new Set(['Edit', 'Write']);

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

/** Per-path read record — NUMBERS ONLY (mtime ms, byte size, epoch-ms ts). */
export interface ReadRecord {
    mtime: number;
    size: number;
    ts: number;
}

/** The session ledger — paths as keys, numbers as values, no content field. */
export interface Ledger {
    reads: Record<string, ReadRecord>;
    /** Last own Edit/Write per path, epoch ms. */
    writes: Record<string, number>;
    /** Per-path once-per-session advisory latch. */
    fired: Record<string, boolean>;
}

function emptyLedger(): Ledger {
    return { reads: {}, writes: {}, fired: {} };
}

/** Hashed session key — mirrors `end_review_nudge_hook.deriveSessionKey`. */
export function deriveSessionKey(envelope: JsonObject, payload: JsonObject): string {
    const raw =
        str(envelope['session_id'] as JsonValue | undefined) ||
        str((payload['session_id'] ?? payload['sessionId']) as JsonValue | undefined);
    const material = raw || 'unknown-session';
    return crypto.createHash('sha256').update(material).digest('hex');
}

export function ledgerFile(workspaceRoot: string, sessionKey: string): string {
    return path.join(workspaceRoot, 'agents', 'runtime', 'state', 'reread-guard', `${sessionKey}.json`);
}

export function readLedger(workspaceRoot: string, sessionKey: string): Ledger {
    try {
        const parsed = JSON.parse(fs.readFileSync(ledgerFile(workspaceRoot, sessionKey), 'utf8'));
        if (!isObject(parsed)) return emptyLedger();
        return {
            reads: isObject(parsed['reads']) ? (parsed['reads'] as unknown as Record<string, ReadRecord>) : {},
            writes: isObject(parsed['writes']) ? (parsed['writes'] as Record<string, number>) : {},
            fired: isObject(parsed['fired']) ? (parsed['fired'] as Record<string, boolean>) : {},
        };
    } catch {
        return emptyLedger(); // missing/corrupt ledger → fresh; never a crash
    }
}

function writeLedger(workspaceRoot: string, sessionKey: string, ledger: Ledger): void {
    try {
        atomic_write_json(ledgerFile(workspaceRoot, sessionKey), ledger);
    } catch {
        // a state-write failure must never affect the tool call
    }
}

function extractToolName(payload: JsonObject): string {
    return str((payload['tool_name'] ?? payload['toolName'] ?? payload['tool']) as JsonValue | undefined);
}

function extractToolInput(payload: JsonObject): JsonObject {
    const ti = payload['tool_input'] ?? payload['toolInput'] ?? payload['input'];
    return isObject(ti) ? ti : {};
}

function extractFilePath(toolInput: JsonObject): string {
    return str((toolInput['file_path'] ?? toolInput['path'] ?? toolInput['filePath']) as JsonValue | undefined);
}

/** True when the incoming Read is already narrowed (offset/limit present). */
export function isRangedRead(toolInput: JsonObject): boolean {
    for (const key of ['offset', 'limit', 'start_line', 'end_line', 'startLine', 'endLine']) {
        const v = toolInput[key];
        if (typeof v === 'number' || (typeof v === 'string' && v !== '')) return true;
    }
    return false;
}

/** 6.1 advisory — duplicate full read of an unchanged, already-read path. */
export function buildDuplicateReadLine(relPath: string, earlierTs: number): string {
    const when = new Date(earlierTs).toISOString();
    return (
        `re-read guard: ${relPath} was already fully read this session (${when}) and is ` +
        `unchanged since (same mtime+size) — the content is still in context; if you only ` +
        `need part of it, a ranged Read (offset/limit) pays for the range, not the file.`
    );
}

/** 6.2 advisory — full re-read right after this session's own edit. */
export function buildPostEditReadLine(relPath: string): string {
    return (
        `re-read guard: this session just edited ${relPath} — a full-file re-read re-pays ` +
        `for content you already have; a ranged Read (offset/limit) over the edited hunk ` +
        `is enough to verify the change.`
    );
}

export function main(): number {
    try {
        const [envelope, payload] = unwrap(readHookStdin(), 'claude');

        const event = str(envelope['event'] as JsonValue | undefined);
        if (event !== '' && event !== 'pre_tool_use') return EXIT_ALLOW;

        const toolName = extractToolName(payload);
        const isRead = READ_TOOLS.has(toolName);
        const isWrite = WRITE_TOOLS.has(toolName);
        if (!isRead && !isWrite) return EXIT_ALLOW;

        const toolInput = extractToolInput(payload);
        const filePath = extractFilePath(toolInput);
        if (!filePath) return EXIT_ALLOW;

        const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
        const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
        const relPath = path.relative(workspaceRoot, absPath);
        if (isExemptPath(relPath) || isExemptPath(absPath)) return EXIT_ALLOW;

        const sessionKey = deriveSessionKey(envelope, payload);
        const ledger = readLedger(workspaceRoot, sessionKey);
        // Ledger keys are workspace-relative where possible (stable across
        // absolute-vs-relative host payloads), absolute otherwise.
        const key = relPath.startsWith('..') ? absPath : relPath;

        if (isWrite) {
            // 6.2 bookkeeping: remember this session's own write. The write has
            // not happened yet, but for every later comparison "about to write"
            // and "wrote" are equivalent.
            ledger.writes[key] = Date.now();
            writeLedger(workspaceRoot, sessionKey, ledger);
            return EXIT_ALLOW;
        }

        // ── Read path ────────────────────────────────────────────────────
        if (isRangedRead(toolInput)) {
            return EXIT_ALLOW; // already the cheap form; not recorded as a full read
        }

        let mtime: number;
        let size: number;
        try {
            const st = fs.statSync(absPath);
            mtime = st.mtimeMs;
            size = st.size;
        } catch {
            return EXIT_ALLOW; // unreadable/missing target — nothing to compare
        }

        const prior = ledger.reads[key];
        const ownWrite = ledger.writes[key];
        const alreadyFired = ledger.fired[key] === true;

        let advisory: string | null = null;
        if (!alreadyFired && ownWrite !== undefined) {
            advisory = buildPostEditReadLine(key); // 6.2 wins when both hold
        } else if (!alreadyFired && prior !== undefined && prior.mtime === mtime && prior.size === size) {
            advisory = buildDuplicateReadLine(key, prior.ts);
        }

        // Record the read that is about to happen (numbers only), consume the
        // one-shot own-write marker, and latch the per-path fire flag.
        ledger.reads[key] = { mtime, size, ts: Date.now() };
        if (ownWrite !== undefined) delete ledger.writes[key];
        if (advisory !== null) ledger.fired[key] = true;
        writeLedger(workspaceRoot, sessionKey, ledger);

        if (advisory === null) return EXIT_ALLOW;

        process.stdout.write(
            `${JSON.stringify({
                decision: 'warn',
                reason: `reread-guard: full-file Read of ${key} the session already paid for`,
                additional_context: advisory,
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
