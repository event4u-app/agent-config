#!/usr/bin/env node
/**
 * Re-read guard + post-edit scope hint — `pre_tool_use` concern
 * (road-to-token-economy-cache Phase 6.1/6.2). A subagent's reads are keyed
 * apart from its parent's (`agent_id`).
 *
 * Also bound on claude `post_tool_use`, where a completed Bash `cat <absolute
 * file>` that returned the whole file counts as a full read, and on claude
 * `pre_compact`, where it clears the recorded reads: compaction drops what was read.
 *
 * Two signals, one session-scoped read ledger:
 *
 *   6.1 A full-file `Read` of a path that was ALREADY fully read this session
 *       AND whose content is unchanged since (sha256 compare against the
 *       ledger; above HASH_BOUND_BYTES, mtime + size, said so in the line; a
 *       file under the bound without both digests never fires) gets
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
 * raw). Per path it stores `{mtime, size, ts, sha256?}` for reads, a `ts` for the last
 * own write, and a per-path fired flag — numbers and a digest; NO field can hold file content, by
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
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { atomic_write_json } from './state_io.js';
import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
import { ledgerKey } from '../_lib/ledger_key.js';
import type { DutyScan, DutyState } from '../_lib/reference_duty.js';
import { ACT_WORDS, loadReferenceDuty, type ReferenceDuty } from './reference_duty_loader.js';

// Severity is taken from the EXIT CODE, not from the `decision` field — see
// the file header for why this never blocks on `claude`. This concern never
// returns exit 1 on any path.

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

/** Per-path read record — numbers and a digest, never content. */
export interface ReadRecord {
    mtime: number;
    size: number;
    ts: number;
    /** sha256 of the file; absent above {@link HASH_BOUND_BYTES}, on a read failure, or in a legacy entry. */
    sha256?: string;
}

/**
 * Above this size the guard keeps mtime + size and says so: the
 * hash is a full read of the file on the pre_tool_use path.
 */
export const HASH_BOUND_BYTES = 2 * 1024 * 1024;

/** How long the post-execution `cat` verification may spend reading, between chunks. */
export const CAT_VERIFY_DEADLINE_MS = 50;

/**
 * What the content key could say about one read. Only `over-bound` — the stat
 * itself was over — licenses the stat fallback: after `grew-during-read` the
 * stat pair is stale, and after `unreadable` nothing was compared.
 */
export type Digest =
    | { kind: 'sha256'; value: string }
    | { kind: 'over-bound' }
    | { kind: 'grew-during-read' }
    | { kind: 'unreadable' };

/**
 * sha256 of a file at or under the bound. The stat `size` skips the read when it
 * is already over; the read itself stops at `HASH_BOUND_BYTES + 1`, because the
 * file can grow between the stat and the read.
 */
export function contentDigest(absPath: string, size: number): Digest {
    if (size > HASH_BOUND_BYTES) return { kind: 'over-bound' };
    let fd: number | undefined;
    try {
        fd = fs.openSync(absPath, 'r');
        // Sized to the stat, not the bound: a full 2 MB buffer per small Read
        // is the hottest slot's largest cost. One byte over the stat size is
        // enough to see that the file grew, which voids the stat pair anyway.
        const limit = Math.max(0, Math.min(size, HASH_BOUND_BYTES));
        const buf = Buffer.allocUnsafe(limit + 1);
        let filled = 0;
        while (filled < buf.length) {
            const n = fs.readSync(fd, buf, filled, buf.length - filled, null);
            if (n === 0) break;
            filled += n;
        }
        if (filled > limit) return { kind: 'grew-during-read' };
        return { kind: 'sha256', value: crypto.createHash('sha256').update(buf.subarray(0, filled)).digest('hex') };
    } catch {
        return { kind: 'unreadable' };
    } finally {
        if (fd !== undefined) {
            try {
                fs.closeSync(fd);
            } catch {
                // closing a descriptor we opened cannot change the answer
            }
        }
    }
}

/** The basis on which a read was found unchanged. */
export type CompareBasis = 'content' | 'stat-over-bound';

/**
 * The basis on which the file is unchanged since `prior`, or `null` when that
 * cannot be asserted. Content equality needs both digests; the stat pair
 * decides only for a file over the bound. A hash-eligible file missing either
 * digest — a legacy ledger entry, a read that failed — is never called unchanged.
 */
export function compareRead(prior: ReadRecord, mtime: number, size: number, digest: Digest): CompareBasis | null {
    if (digest.kind === 'over-bound') return prior.mtime === mtime && prior.size === size ? 'stat-over-bound' : null;
    if (digest.kind === 'sha256' && prior.sha256 !== undefined) return prior.sha256 === digest.value ? 'content' : null;
    return null;
}

/** The session ledger — paths as keys, numbers as values, no content field. */
export interface Ledger {
    reads: Record<string, ReadRecord>;
    /** Last own Edit/Write per path, epoch ms. */
    writes: Record<string, number>;
    /** Per-path once-per-session advisory latch. */
    fired: Record<string, boolean>;
    /** Reference duty observed at file acts, `rule::reference` → counts and latest state. */
    duty?: Record<string, DutyRecord>;
    /** File acts whose duty could not be computed (an unreadable router). */
    duty_errors?: number;
    /** Duty keys dropped at {@link MAX_DUTY_KEYS}. */
    duty_overflow?: number;
}

function emptyLedger(): Ledger {
    return { reads: {}, writes: {}, fired: {} };
}

/** Hashed session key — mirrors `end_review_nudge_hook.deriveSessionKey`. */
export function deriveSessionKey(envelope: JsonObject, payload: JsonObject): string {
    const raw =
        str(envelope['session_id'] as JsonValue | undefined) ||
        str((payload['session_id'] ?? payload['sessionId']) as JsonValue | undefined);
    const agent = str((payload['agent_id'] ?? payload['agentId']) as JsonValue | undefined);
    // A subagent reads into its own context, so its reads never satisfy the parent's.
    const material = `${raw || 'unknown-session'}${agent ? `::${agent}` : ''}`;
    return crypto.createHash('sha256').update(material).digest('hex');
}

export function ledgerFile(workspaceRoot: string, sessionKey: string): string {
    return path.join(workspaceRoot, 'agents', 'runtime', 'state', 'reread-guard', `${sessionKey}.json`);
}

/**
 * The duty map as loaded, held to {@link MAX_DUTY_KEYS}: a ledger written before
 * the cap, or by hand, keeps its most recent keys and counts the rest.
 */
function boundedDuty(parsed: JsonObject): Pick<Ledger, 'duty' | 'duty_overflow'> {
    const prior = typeof parsed['duty_overflow'] === 'number' ? parsed['duty_overflow'] : 0;
    if (!isObject(parsed['duty'])) return prior > 0 ? { duty_overflow: prior } : {};
    const entries = Object.entries(parsed['duty'] as unknown as Record<string, DutyRecord>);
    if (entries.length <= MAX_DUTY_KEYS) return { duty: Object.fromEntries(entries), ...(prior > 0 ? { duty_overflow: prior } : {}) };
    const ts = (r: unknown): number => {
        const v = isObject(r as JsonValue) ? (r as Record<string, unknown>)['ts'] : undefined;
        return typeof v === 'number' && Number.isFinite(v) ? v : 0;
    };
    entries.sort((a, b) => ts(b[1]) - ts(a[1]));
    return { duty: Object.fromEntries(entries.slice(0, MAX_DUTY_KEYS)), duty_overflow: prior + entries.length - MAX_DUTY_KEYS };
}

export function readLedger(workspaceRoot: string, sessionKey: string): Ledger {
    try {
        const parsed = JSON.parse(fs.readFileSync(ledgerFile(workspaceRoot, sessionKey), 'utf8'));
        if (!isObject(parsed)) return emptyLedger();
        return {
            reads: isObject(parsed['reads']) ? (parsed['reads'] as unknown as Record<string, ReadRecord>) : {},
            writes: isObject(parsed['writes']) ? (parsed['writes'] as Record<string, number>) : {},
            fired: isObject(parsed['fired']) ? (parsed['fired'] as Record<string, boolean>) : {},
            ...boundedDuty(parsed),
            ...(typeof parsed['duty_errors'] === 'number' ? { duty_errors: parsed['duty_errors'] } : {}),
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

/**
 * The file a plain `cat <absolute file>` reads whole, or null. A relative path
 * resolves against the shell's cwd, which the hook cannot see; a pipe, a
 * redirect, a flag, a second file or a shell expansion is not a whole-file read
 * of one known path.
 */
export function wholeFileCatPath(command: string): string | null {
    const m = /^[ \t]*cat[ \t]+(?:"([^"\n]+)"|'([^'\n]+)'|([^\s|&;<>'"]+))[ \t]*$/.exec(command);
    if (m === null) return null;
    const p = m[1] ?? m[2] ?? m[3] ?? '';
    return p.startsWith('/') && !/[$*?~`\\{}[\]]/.test(p) ? p : null;
}

/** 6.1 advisory — duplicate full read of an unchanged, already-read path. */
export function buildDuplicateReadLine(relPath: string, earlierTs: number, compared: CompareBasis): string {
    const when = new Date(earlierTs).toISOString();
    const basis =
        compared === 'content' ? 'unchanged content (same sha256)' : 'unchanged since (same mtime+size; over the 2 MB hash bound)';
    return (
        `re-read guard: ${relPath} was already fully read this session (${when}) with ` +
        `${basis} — the content is still in context; if you only ` +
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

/**
 * Distinct `rule::reference` keys a ledger keeps. The real bound is the router's
 * path- and file-triggered references (a handful); the cap only stops a corrupt
 * or hostile router from growing the file, and a dropped key is counted.
 */
export const MAX_DUTY_KEYS = 256;

export interface DutyRecord {
    state: DutyState;
    pending: number;
    read: number;
    ts: number;
}

/** The duty a bound shell act makes due; the command itself is never stored. */
function recordActDuty(envelope: JsonObject, payload: JsonObject, command: string): void {
    if (!ACT_WORDS.test(command)) return;
    const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
    const sessionKey = deriveSessionKey(envelope, payload);
    const ledger = readLedger(workspaceRoot, sessionKey);
    if (_recordActDutyWith(ledger, command, workspaceRoot, loadReferenceDuty())) writeLedger(workspaceRoot, sessionKey, ledger);
}

/** True when the ledger changed. Exported as a testing seam. */
export function _recordActDutyWith(ledger: Ledger, command: string, workspaceRoot: string, duty: ReferenceDuty | null): boolean {
    if (duty === null) {
        ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
        return true;
    }
    let scan: DutyScan;
    try {
        scan = duty.scanActDuties(command, workspaceRoot);
    } catch {
        ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
        return true;
    }
    if (scan.duties.length === 0 && scan.errors.length === 0) return false;
    applyScan(ledger, scan, workspaceRoot, duty);
    return true;
}

function recordDuty(ledger: Ledger, key: string, workspaceRoot: string): void {
    const duty = loadReferenceDuty();
    if (duty === null) {
        ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
        return;
    }
    let scan: DutyScan;
    try {
        scan = duty.scanDuties(key, workspaceRoot);
    } catch {
        ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
        return;
    }
    applyScan(ledger, scan, workspaceRoot, duty);
}

function applyScan(ledger: Ledger, scan: DutyScan, workspaceRoot: string, duty: ReferenceDuty): void {
    let states: Record<string, DutyState>;
    try {
        // Each matched rule whose duties could not be read is one unobserved duty.
        if (scan.errors.length > 0) ledger.duty_errors = (ledger.duty_errors ?? 0) + scan.errors.length;
        states = duty.dutyStates(scan.duties, ledger.reads, workspaceRoot);
    } catch {
        ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
        return;
    }
    if (Object.keys(states).length === 0) return;
    const ts = Date.now();
    ledger.duty = { ...(ledger.duty ?? {}) };
    for (const [k, state] of Object.entries(states)) {
        if (ledger.duty[k] === undefined && Object.keys(ledger.duty).length >= MAX_DUTY_KEYS) {
            ledger.duty_overflow = (ledger.duty_overflow ?? 0) + 1;
            continue;
        }
        const prior = ledger.duty[k] ?? { state, pending: 0, read: 0, ts };
        ledger.duty[k] = {
            state,
            pending: prior.pending + (state === 'required-pending' ? 1 : 0),
            read: prior.read + (state === 'read' ? 1 : 0),
            ts,
        };
    }
}

/**
 * One regular file read through one descriptor: opened non-blocking (a FIFO or
 * device returns instead of hanging the hook), refused unless it is a regular file
 * within `limit` bytes, refused when its size or mtime moved during the read, when
 * the path no longer names the inode that was read, or when `deadlineMs` passes
 * between chunks. Null on any of those, or on any error. A single system call is
 * not preemptible in-process — true of every filesystem call a hook makes — so the
 * deadline bounds the loop, not one blocked syscall. `now` and `afterRead` are
 * testing seams.
 */
export function _readRegularFileBounded(
    file: string,
    limit: number,
    opts: { deadlineMs?: number; now?: () => number; afterRead?: () => void } = {},
): { bytes: Buffer; stat: fs.Stats } | null {
    const now = opts.now ?? ((): number => performance.now());
    const deadline = now() + (opts.deadlineMs ?? CAT_VERIFY_DEADLINE_MS);
    let fd: number | null = null;
    try {
        fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
        const before = fs.fstatSync(fd);
        if (!before.isFile() || before.size > limit) return null;
        const buf = Buffer.alloc(before.size + 1);
        let got = 0;
        for (;;) {
            if (now() > deadline) return null;
            const n = fs.readSync(fd, buf, got, buf.length - got, null);
            if (n === 0) break;
            got += n;
            if (got > before.size) return null;
        }
        opts.afterRead?.();
        const after = fs.fstatSync(fd);
        if (got !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) return null;
        const named = fs.statSync(file);
        if (named.ino !== after.ino || named.dev !== after.dev || now() > deadline) return null;
        return { bytes: buf.subarray(0, got), stat: after };
    } catch {
        return null;
    } finally {
        if (fd !== null) fs.closeSync(fd);
    }
}

/**
 * A Bash `cat <absolute file>` earns read credit only after it ran, and only when
 * the whole file came back: not interrupted, nothing on stderr, no non-zero exit
 * status, and stdout byte-identical to the file now on disk (up to the hash bound).
 * A pre_tool_use cannot know any of that, which is why a `cat` is never credited
 * there.
 */
function recordCompletedCat(envelope: JsonObject, payload: JsonObject): void {
    if (extractToolName(payload) !== 'Bash') return;
    const catPath = wholeFileCatPath(str(extractToolInput(payload)['command']));
    if (catPath === null) return;
    const resp = payload['tool_response'] ?? payload['toolResponse'];
    if (!isObject(resp)) return;
    const stdout = resp['stdout'];
    if (typeof stdout !== 'string' || resp['interrupted'] === true || str(resp['stderr'] as JsonValue | undefined) !== '') return;
    const exit = resp['exit_code'] ?? resp['exitCode'] ?? resp['returnCode'];
    if (exit !== undefined && exit !== null && exit !== 0) return;
    const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
    if (Buffer.byteLength(stdout, 'utf8') > HASH_BOUND_BYTES) return;
    const snap = _readRegularFileBounded(catPath, HASH_BOUND_BYTES);
    if (snap === null || Buffer.byteLength(stdout, 'utf8') !== snap.bytes.length) return;
    const st = snap.stat;
    // The bytes returned must be the file as it is now: a length match alone
    // would credit an equal-length replacement made after the cat ran.
    if (!snap.bytes.equals(Buffer.from(stdout, 'utf8'))) return;
    const sessionKey = deriveSessionKey(envelope, payload);
    const ledger = readLedger(workspaceRoot, sessionKey);
    ledger.reads[ledgerKey(workspaceRoot, catPath)] = { mtime: st.mtimeMs, size: st.size, ts: Date.now() };
    writeLedger(workspaceRoot, sessionKey, ledger);
}

export function main(): number {
    try {
        const [envelope, payload] = unwrap(readHookStdin(), 'claude');

        const event = str(envelope['event'] as JsonValue | undefined);
        if (event === 'pre_compact') {
            // Compaction drops what was read, so recorded reads must not outlive it.
            // Everything else — own writes, advisory latches, the duty counts that
            // are this observation's measurement — is not a read and is kept.
            const root = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
            const sk = deriveSessionKey(envelope, payload);
            const prior = readLedger(root, sk);
            writeLedger(root, sk, {
                ...prior,
                reads: {},
            });
            return EXIT_ALLOW;
        }
        if (event === 'post_tool_use') {
            recordCompletedCat(envelope, payload);
            return EXIT_ALLOW;
        }
        if (event !== '' && event !== 'pre_tool_use') return EXIT_ALLOW;

        const toolName = extractToolName(payload);
        const toolInput = extractToolInput(payload);
        if (toolName === 'Bash') {
            recordActDuty(envelope, payload, str(toolInput['command']));
            return EXIT_ALLOW;
        }
        const isRead = READ_TOOLS.has(toolName);
        const isWrite = WRITE_TOOLS.has(toolName);
        if (!isRead && !isWrite) return EXIT_ALLOW;

        const filePath = extractFilePath(toolInput);
        if (!filePath) return EXIT_ALLOW;

        const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
        const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
        const relPath = path.relative(workspaceRoot, absPath);
        const exempt = isExemptPath(relPath) || isExemptPath(absPath);

        const sessionKey = deriveSessionKey(envelope, payload);
        const ledger = readLedger(workspaceRoot, sessionKey);
        const key = ledgerKey(workspaceRoot, absPath);

        if (exempt && isWrite) {
            // No 6.2 bookkeeping on an exempt path, but the duty is observed:
            // `dist/agent-src/` is itself a trigger prefix.
            recordDuty(ledger, key, workspaceRoot);
            writeLedger(workspaceRoot, sessionKey, ledger);
            return EXIT_ALLOW;
        }
        if (exempt) {
            // No advisory on an exempt path, but the read is recorded: a projected
            // rule reference lives under dist/, and the reference duty asks whether
            // it was read.
            if (!isRangedRead(toolInput)) {
                try {
                    const st = fs.statSync(absPath);
                    ledger.reads[key] = { mtime: st.mtimeMs, size: st.size, ts: Date.now() };
                    writeLedger(workspaceRoot, sessionKey, ledger);
                } catch {
                    // unreadable target — nothing to record
                }
            }
            return EXIT_ALLOW;
        }

        if (isWrite) {
            // 6.2 bookkeeping: remember this session's own write. The write has
            // not happened yet, but for every later comparison "about to write"
            // and "wrote" are equivalent.
            ledger.writes[key] = Date.now();
            recordDuty(ledger, key, workspaceRoot);
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

        const digest = contentDigest(absPath, size);
        const prior = ledger.reads[key];
        const ownWrite = ledger.writes[key];
        const alreadyFired = ledger.fired[key] === true;

        let advisory: string | null = null;
        const compared = prior === undefined ? null : compareRead(prior, mtime, size, digest);
        if (!alreadyFired && ownWrite !== undefined) {
            advisory = buildPostEditReadLine(key); // 6.2 wins when both hold
        } else if (!alreadyFired && prior !== undefined && compared !== null) {
            advisory = buildDuplicateReadLine(key, prior.ts, compared);
        }

        // Record the read that is about to happen (numbers only), consume the
        // one-shot own-write marker, and latch the per-path fire flag.
        ledger.reads[key] =
            digest.kind === 'sha256' ? { mtime, size, ts: Date.now(), sha256: digest.value } : { mtime, size, ts: Date.now() };
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
