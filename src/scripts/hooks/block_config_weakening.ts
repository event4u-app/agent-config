#!/usr/bin/env node
// MIGRATE: precompiled-hook-layer — carry this hook when road-to-credible-install
// Phase 1 precompiles the hook path (touch-once preserved at migration).
/**
 * PreToolUse guard: "fix the code, not the config."
 *
 * The recorded antipattern (`autonomous-execution` § Antipattern —
 * allowlist-growth as silent budget bypass): during a fix loop the agent
 * weakens the gate instead of the code, growing a lint allowlist entry by
 * entry until the linter no longer objects. The rule already states the
 * threshold in words —
 *
 *     ALLOWLIST > 20 ENTRIES IN ONE SESSION = THE LINTER IS WRONG.
 *     STOP. PROPOSE LINTER REDESIGN OR REMOVAL.
 *
 * — and two linters cite it in their own failure messages. Nothing enforced
 * it: by the time CI sees the diff the session has already spent its budget
 * on the wrong fix. This hook moves that stated threshold to tool-call time.
 *
 * Deliberately NOT built (council 2026-08-02, anthropic/claude-sonnet-4-5 +
 * openai/gpt-4o):
 *
 * - **No invented "fix-loop is active" predicate.** Both members rejected it
 *   as speculative — no such state exists in the repo and defining entry/exit
 *   invites false positives in both directions. The SESSION is the window the
 *   recorded rule already names, so the session id off the hook envelope is
 *   the predicate, and it is not an invention.
 * - **No blocking on baselines or budgets.** Whether a violation-baseline
 *   count rising is weakening or a legitimate ratchet reset after a refactor
 *   is not mechanically decidable from the edit alone. Those surfaces warn
 *   (exit 2) and stay a review decision; only allowlist growth — mechanical,
 *   countable, and already carrying a stated numeric threshold — blocks.
 *
 * Cumulative within a session, per allowlist file. Small additions warn from
 * the first one so the count is visible while it is still cheap to change
 * course; crossing the recorded cap blocks.
 *
 * Exit codes (docs/contracts/hook-architecture-v1.md):
 *   0 — allow
 *   1 — block
 *   2 — warn
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { EDIT_TOOLS } from '../minimal_safe_diff_hook.js';
import { readHookStdin } from './hook_stdin.js';

const _HERE = fileURLToPath(import.meta.url);

const EXIT_ALLOW = 0;
const EXIT_BLOCK = 1;
const EXIT_WARN = 2;

/**
 * The stated cap from `autonomous-execution` § Antipattern. Crossing it in one
 * session is defined there as the third validation-target failure — the point
 * at which the linter, not the content, is wrong.
 */
export const SESSION_ENTRY_CAP = 20;

/** Warn from this many cumulative added entries so the count stays visible. */
export const SESSION_WARN_AT = 5;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: JsonValue | undefined): v is JsonObject {
    return v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);
}

const _PATH_KEYS: readonly string[] = ['file_path', 'path', 'target_file', 'filePath', 'notebook_path'];

/**
 * Config surfaces this guard recognises.
 *
 * `allowlist` is the blocking class — an entry count is a plain number and the
 * recorded rule already fixes its threshold. `advisory` covers the surfaces
 * where "weakening" needs context a tool call does not carry (a baseline count
 * may legitimately reset after a refactor); those warn and never block.
 */
export type ConfigKind = 'allowlist' | 'advisory' | null;

/** Classify a target path into a config surface, or null for everything else. */
export function classify_target(p: string): ConfigKind {
    const posix = p.split(path.sep).join('/');
    const base = posix.split('/').pop() ?? '';
    if (/_allowlist\.(json|txt)$/.test(base) || /^allowlist[-_.]/.test(base)) {
        return 'allowlist';
    }
    if (/(^|-)baselines?\.json$/.test(base)) {
        return 'advisory';
    }
    if (/-budget(s)?\.(json|ya?ml)$/.test(base) || base === 'budgets.yml') {
        return 'advisory';
    }
    return null;
}

/**
 * Count allowlist entries in a blob.
 *
 * JSON: every string leaf in the structure (arrays of paths, and
 * `{"rule": ["path", …]}` maps alike) — parsing beats a line count because a
 * reformat would otherwise read as growth. Falls back to non-blank,
 * non-comment lines for `.txt` allowlists and for JSON fragments that do not
 * parse on their own (an `Edit` payload is rarely a whole document).
 */
export function count_entries(text: string): number {
    const trimmed = text.trim();
    if (trimmed) {
        try {
            let n = 0;
            const walk = (v: unknown): void => {
                if (typeof v === 'string') {
                    n += 1;
                } else if (Array.isArray(v)) {
                    v.forEach(walk);
                } else if (v !== null && typeof v === 'object') {
                    Object.values(v as Record<string, unknown>).forEach(walk);
                }
            };
            walk(JSON.parse(trimmed));
            return n;
        } catch {
            /* not a standalone JSON document — fall through */
        }
    }
    return text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//')).length;
}

/**
 * Entries this single tool call adds to an allowlist.
 *
 * `Write` carries the whole new document, so the delta is measured against
 * what is on disk. `Edit` carries a replacement pair, so the delta is the pair
 * itself. Negative results (a shrinking allowlist — the direction this guard
 * wants) collapse to 0: removals must never bank credit against a later
 * addition.
 */
export function added_entries(
    tool_input: JsonObject,
    on_disk: string | null,
): number {
    const content = tool_input['content'];
    if (typeof content === 'string') {
        const before = on_disk === null ? 0 : count_entries(on_disk);
        return Math.max(0, count_entries(content) - before);
    }
    const oldS = tool_input['old_string'] ?? tool_input['oldStr'] ?? tool_input['old_str'];
    const newS = tool_input['new_string'] ?? tool_input['newStr'] ?? tool_input['new_str'];
    if (typeof newS === 'string') {
        const before = typeof oldS === 'string' ? count_entries(oldS) : 0;
        return Math.max(0, count_entries(newS) - before);
    }
    return 0;
}

export interface Decision {
    action: 'allow' | 'warn' | 'block';
    reason: string;
}

/** Decide from the cumulative session total for one allowlist file. */
export function decide(kind: ConfigKind, rel_path: string, session_total: number, added: number): Decision {
    if (kind === null || added <= 0) {
        return { action: 'allow', reason: '' };
    }
    if (kind === 'advisory') {
        return {
            action: 'warn',
            reason:
                `${rel_path}: this edit loosens a gate threshold. Whether that is a ` +
                'legitimate ratchet reset or the config being bent around a failing ' +
                'check is a review decision — state which in the diff.',
        };
    }
    if (session_total > SESSION_ENTRY_CAP) {
        return {
            action: 'block',
            reason:
                `${rel_path}: ${session_total} allowlist entries added this session ` +
                `(cap ${SESSION_ENTRY_CAP}). Per autonomous-execution § Antipattern — ` +
                'allowlist-growth as silent budget bypass, crossing this cap means the ' +
                'LINTER is wrong, not the content. Fix the code or redesign the check; ' +
                'do not expand the allowlist further.\n' +
                '  Legitimate override is a human action outside this session: land the ' +
                'linter redesign, or remove the `block-config-weakening` entry in ' +
                'src/scripts/hook_manifest.yaml.',
        };
    }
    if (session_total >= SESSION_WARN_AT) {
        return {
            action: 'warn',
            reason:
                `${rel_path}: ${session_total} allowlist entries added this session ` +
                `(cap ${SESSION_ENTRY_CAP}). Fix the code, not the config.`,
        };
    }
    return { action: 'allow', reason: '' };
}

// --- session state -------------------------------------------------------

function _state_file(root: string): string {
    return path.join(root, 'agents', 'runtime', 'state', 'config-weakening.json');
}

/** Read the cumulative count, add `added`, persist, and return the new total. */
export function bump_session(root: string, session: string, key: string, added: number): number {
    const f = _state_file(root);
    let data: Record<string, Record<string, number>> = {};
    try {
        data = JSON.parse(fs.readFileSync(f, 'utf-8')) as Record<string, Record<string, number>>;
    } catch {
        data = {};
    }
    const bucket = data[session] ?? {};
    const total = (bucket[key] ?? 0) + added;
    bucket[key] = total;
    data[session] = bucket;
    try {
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
    } catch {
        /* state is an optimisation, never a gate — a read-only tree still decides */
    }
    return total;
}

// --- entry ---------------------------------------------------------------

function _extract(envelope: JsonObject): { tool: string; paths: string[]; ti: JsonObject | null } {
    const payload = _isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const nameVal =
        payload['tool_name'] ?? payload['toolName'] ?? payload['tool'] ?? envelope['tool_name'] ?? envelope['tool'];
    const tool = typeof nameVal === 'string' ? nameVal : '';
    const ti = _isObject(payload['tool_input'])
        ? payload['tool_input']
        : _isObject(envelope['tool_input'])
          ? envelope['tool_input']
          : null;
    const paths: string[] = [];
    if (ti !== null) {
        for (const key of _PATH_KEYS) {
            const v = ti[key];
            if (typeof v === 'string' && v) {
                paths.push(v);
            }
        }
    }
    return { tool, paths, ti };
}

export function main(): number {
    let envelope: JsonValue;
    try {
        const raw = readHookStdin();
        envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
    } catch {
        return EXIT_ALLOW;
    }
    if (!_isObject(envelope)) {
        return EXIT_ALLOW;
    }

    const { tool, paths, ti } = _extract(envelope);
    if (!tool || !EDIT_TOOLS.has(tool) || ti === null) {
        return EXIT_ALLOW;
    }

    const cwd = envelope['cwd'];
    const pr = envelope['workspace_root'] ?? envelope['project_root'];
    const root = typeof cwd === 'string' && cwd ? cwd : typeof pr === 'string' && pr ? pr : '.';
    const sidRaw = envelope['session_id'] ?? envelope['sessionId'];
    const session = typeof sidRaw === 'string' && sidRaw ? sidRaw : 'default';

    for (const p of paths) {
        const kind = classify_target(p);
        if (kind === null) {
            continue;
        }
        const abs = path.isAbsolute(p) ? p : path.join(root, p);
        let on_disk: string | null = null;
        try {
            on_disk = fs.readFileSync(abs, 'utf-8');
        } catch {
            on_disk = null;
        }
        const added = added_entries(ti, on_disk);
        if (added <= 0) {
            continue;
        }
        const rel = path.relative(root, abs) || p;
        const total = kind === 'allowlist' ? bump_session(root, session, rel, added) : added;
        const d = decide(kind, rel, total, added);
        if (d.action === 'block') {
            process.stderr.write(`block-config-weakening: BLOCKED — ${d.reason}\n`);
            return EXIT_BLOCK;
        }
        if (d.action === 'warn') {
            process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: d.reason })}\n`);
            return EXIT_WARN;
        }
    }
    return EXIT_ALLOW;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url`.
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
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
