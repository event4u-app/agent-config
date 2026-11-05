#!/usr/bin/env tsx
/**
 * Memory audience — RECORD-ONLY / SHADOW (road-to-a-memory-each-worker-is-handed
 * 2.2 + 2.3). One concern, two observations, no code path that can deny or
 * inject:
 *
 *   - **Child writes** (2.2). A Write / Edit / MultiEdit whose payload carries
 *     an `agent_id` — the host's marker that a subagent, not the session, made
 *     the call — and whose target lies under `agents/memory/` appends one
 *     `memory_child_write_attempt` line. Without `agent_id` nothing is recorded: the
 *     orchestrator writing its own store is the normal path.
 *   - **Slice shadow** (2.3). At the orchestrator's `Agent` / `Task` call, the
 *     curated references the prompt names are cut to the spawn contract's cap
 *     and only the counts are logged: `{ref_count, dropped, est_tokens}`. The
 *     slice is not delivered; Phase 3 delivers it once these counts exist.
 *
 * PRIVACY BY CONSTRUCTION: the prompt and the tool input are read in memory and
 * never written. A line carries the tool name, a target class (`intake` /
 * `curated`) and integers — no path, no agent id, no prompt text.
 *
 * Exit is always 0 and stdout stays empty.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { MAX_KNOWLEDGE_REFS } from '../_lib/subagent_spawn.js';
import { appendLedgerLine, resolveConsumerRoot } from './subagent_ledger_hook.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW } from './exit_codes.js';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

const WRITE_TOOLS: ReadonlySet<string> = new Set(['Write', 'Edit', 'MultiEdit']);
const SPAWN_TOOLS: ReadonlySet<string> = new Set(['Agent', 'Task']);
const MEMORY_DIR = 'agents/memory/';
/** A curated store entry named in a prompt; intake is the raw log, never a slice member. */
// Starts at a name boundary or after `./`, never inside another path or word;
// ends where the extension ends, with a sentence-final `.` still allowed. The
// bounded quantifier caps backtracking per start on an adversarial prompt.
const CURATED_REF_RE =
    /(?<=^|[^A-Za-z0-9._/~-]|(?:^|[^A-Za-z0-9._/~-])\.\/)agents\/memory\/(?!intake\/)[A-Za-z0-9._/-]{1,200}?\.(?:ya?ml|md|json)(?![A-Za-z0-9_/~-]|\.[A-Za-z0-9])/g;
/**
 * Distinct names resolved per spawn. The filesystem work on the tool path is
 * bounded by this, not by the prompt: names past it are counted, never resolved.
 */
export const MAX_EXAMINED_REFS = 20;
/** Prompt characters scanned for refs; the matcher never sees more than this. */
export const MAX_SCAN_CHARS = 100_000;
/** Missing path levels walked to find where a write lands; deeper is not resolved. */
export const MAX_RESOLVE_DEPTH = 32;
/** Same rough estimate the hook budgets use: four bytes per token. */
const BYTES_PER_TOKEN = 4;

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(o: JsonObject, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v) return v;
    }
    return null;
}

/**
 * Where a write would land: the real path of the nearest existing ancestor, with
 * the not-yet-existing tail appended, so a new file under a symlinked directory
 * is placed where the filesystem will put it. At most {@link MAX_RESOLVE_DEPTH}
 * missing levels are walked; past that the destination is unresolved (null).
 */
function resolveDestination(abs: string): string | null {
    const tail: string[] = [];
    let cur = abs;
    for (;;) {
        try {
            return path.join(fs.realpathSync(cur), ...tail.reverse());
        } catch {
            const parent = path.dirname(cur);
            if (parent === cur || tail.length >= MAX_RESOLVE_DEPTH) return null;
            tail.push(path.basename(cur));
            cur = parent;
        }
    }
}

/**
 * `intake` / `curated` when the write lands in the store's real directory —
 * judged on the resolved destination, so a symlink out of the store is not a
 * memory write and a symlink into it is — else null.
 */
export function memoryTarget(filePath: string, root: string): 'intake' | 'curated' | null {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
    const store = resolveDestination(path.join(root, MEMORY_DIR));
    const dest = resolveDestination(abs);
    if (store === null || dest === null) return null;
    const rel = path.relative(store, dest);
    if (rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
    return rel === 'intake' || rel.startsWith(`intake${path.sep}`) ? 'intake' : 'curated';
}

export interface SliceCounts {
    ref_count: number;
    dropped: number;
    est_tokens: number;
    /** Distinct names resolved against the filesystem. */
    examined: number;
    /** Distinct names past {@link MAX_EXAMINED_REFS}, counted but never resolved. */
    unexamined: number;
    /** True when the prompt ran past {@link MAX_SCAN_CHARS} and its tail was not scanned. */
    scan_truncated: boolean;
}

/**
 * A named ref, normalised, if it stays inside the curated store; null otherwise.
 * Normalising before the check is what closes `agents/memory/../../x` (leaves the
 * store) and `agents/memory/a/../intake/x` (lands in intake).
 */
function curatedRef(ref: string): string | null {
    const norm = path.posix.normalize(ref);
    if (!norm.startsWith(MEMORY_DIR) || norm.startsWith(`${MEMORY_DIR}intake/`)) return null;
    return norm;
}

/**
 * The real path and size of a ref that could actually be delivered: an existing
 * file whose real path lies in the curated store and not in intake. Anything else
 * is null — a symlink out of the store or into intake, a missing file, a loop.
 */
function eligibleFile(ref: string, store: string, root: string): { real: string; size: number } | null {
    try {
        const real = fs.realpathSync(path.join(root, ref));
        const rel = path.relative(store, real);
        if (rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
        // A curated name that resolves into intake is intake, whatever it is called.
        if (rel === 'intake' || rel.startsWith(`intake${path.sep}`)) return null;
        const stat = fs.statSync(real);
        return stat.isFile() ? { real, size: stat.size } : null;
    } catch {
        return null;
    }
}

/** Index just past the last whitespace before `end`, 0 when there is none. Linear. */
function lastWhitespaceBefore(text: string, end: number): number {
    for (let i = end - 1; i >= 0; i -= 1) {
        if (/\s/.test(text[i] as string)) return i + 1;
    }
    return 0;
}

/**
 * The slice a spawn naming these refs would receive, as counts only. Eligibility
 * is decided before deduplication and before the cap, so an ineligible name never
 * takes a slot from a deliverable one, and two names for one file count once.
 */
export function sliceCounts(prompt: string, root: string): SliceCounts {
    const scanTruncated = prompt.length > MAX_SCAN_CHARS;
    // A cut prefix ends at its last whitespace, so a name the cut shortened
    // (`a.yml.bak` cut to `a.yml`) is dropped rather than read as another name.
    const scanned = scanTruncated ? prompt.slice(0, lastWhitespaceBefore(prompt, MAX_SCAN_CHARS)) : prompt;
    const names = [
        ...new Set((scanned.match(CURATED_REF_RE) ?? []).map(curatedRef).filter((r): r is string => r !== null)),
    ];
    const toExamine = names.slice(0, MAX_EXAMINED_REFS);
    const unexamined = names.length - toExamine.length;
    let store: string;
    try {
        store = fs.realpathSync(path.join(root, MEMORY_DIR));
    } catch {
        return { ref_count: 0, dropped: 0, est_tokens: 0, examined: 0, unexamined: names.length, scan_truncated: scanTruncated };
    }
    const eligible = new Map<string, number>();
    for (const ref of toExamine) {
        const file = eligibleFile(ref, store, root);
        if (file !== null && !eligible.has(file.real)) eligible.set(file.real, file.size);
    }
    const sizes = [...eligible.values()];
    const kept = sizes.slice(0, MAX_KNOWLEDGE_REFS);
    const bytes = kept.reduce((a, b) => a + b, 0);
    return {
        ref_count: kept.length,
        dropped: sizes.length - kept.length,
        est_tokens: Math.ceil(bytes / BYTES_PER_TOKEN),
        examined: toExamine.length,
        unexamined,
        scan_truncated: scanTruncated,
    };
}

export function processEnvelope(envelope: JsonValue, consumerRoot: string): number {
    try {
        if (!isObject(envelope)) return EXIT_ALLOW;
        const inner = envelope['payload'];
        const payload = isObject(inner) ? inner : envelope;
        const tool = str(payload, 'tool_name', 'toolName', 'tool');
        if (tool === null) return EXIT_ALLOW;
        const input = isObject(payload['tool_input']) ? payload['tool_input'] : {};
        const isChild = str(payload, 'agent_id', 'agentId') !== null;
        const nowIso = new Date().toISOString();

        if (WRITE_TOOLS.has(tool)) {
            if (!isChild) return EXIT_ALLOW;
            const filePath = str(input, 'file_path', 'path');
            const target = filePath === null ? null : memoryTarget(filePath, consumerRoot);
            if (target === null) return EXIT_ALLOW;
            // pre_tool_use: the call may still fail or be denied, so this is an attempt.
            appendLedgerLine(consumerRoot, nowIso, { event: 'memory_child_write_attempt', ts: nowIso, tool, target, posture: 'record-only' });
            return EXIT_ALLOW;
        }

        if (SPAWN_TOOLS.has(tool) && !isChild) {
            const prompt = str(input, 'prompt') ?? '';
            appendLedgerLine(consumerRoot, nowIso, {
                event: 'memory_slice_shadow',
                ts: nowIso,
                tool,
                ...sliceCounts(prompt, consumerRoot),
                delivered: false,
                posture: 'shadow',
            });
        }
    } catch {
        // Never disturb a tool call for a measurement.
        return EXIT_ALLOW;
    }
    return EXIT_ALLOW;
}

export function main(): number {
    try {
        const raw = readHookStdin();
        const envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
        return processEnvelope(envelope, resolveConsumerRoot(envelope));
    } catch {
        return EXIT_ALLOW;
    }
}

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
