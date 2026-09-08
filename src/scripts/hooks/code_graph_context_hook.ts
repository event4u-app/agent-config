#!/usr/bin/env tsx
/**
 * PreToolUse code-graph context line (road-to-a-graph-that-is-shipped 1.2).
 *
 * Replaces `code_graph_nudge_hook.ts`, which shipped default-OFF behind
 * `hooks.code_graph.enabled` — a flag the settings table itself described as
 * "deprecated — honest null 2026-07-28", requiring a manual install of the
 * ABI-locked parser pair. Phase 0.1 made that manual install unnecessary, so
 * the flag's premise is gone and the flag with it.
 *
 * Two behavioural changes, and both are the reason the replacement exists
 * rather than a rename:
 *
 * 1. It speaks ONLY when a graph actually exists — `fresh` or `behind:N`.
 *    The nudge also fired on ABSENT, i.e. it advertised a capability the
 *    consumer had not built and, before 0.1, could not build. A hook whose
 *    common case is "you do not have this" is an advertisement, not context.
 *    Absent → silent, which is what makes default-on defensible: a consumer
 *    who never builds a graph never hears from this hook at all.
 * 2. It carries STATE, not an instruction. `fresh` and `behind:N` are facts
 *    the model cannot otherwise see, and `behind:N` is the one that changes a
 *    decision — an answer from a graph N commits stale is worth less than the
 *    same answer from a fresh one, and only the hook knows N.
 *
 * Delivery is the dispatcher's, not this hook's: returning `warn` + a reason
 * makes `emitFor` lower it to the host's structured envelope — on Claude Code
 * `hookSpecificOutput.additionalContext` at exit 0 (`claudeAdditionalContext`
 * in host_semantics.ts). It is never a plain echo. On a host with no verified
 * PreToolUse contract the dispatcher swallows concern stdout, so the same line
 * is carried as a rule instead (`external-code-graph-interop`), which is what
 * "per-host `enforced_by` resolved from the table, not from a host name" means
 * in practice.
 *
 * Once per session (a latch keyed by session id), so it cannot nag.
 * fail_closed: false — every error path returns allow; a context line must
 * never break a tool call.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { detectSources, pickSource } from '../code_graph/detect.js';
import { readHookStdin } from './hook_stdin.js';

const EXIT_ALLOW = 0;
const EXIT_WARN = 2;
const CODE_EXT = /\.(php|ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

interface ToolIntent {
    isSearch: boolean;
    isCodeRead: boolean;
}

/**
 * Best-effort read of the intercepted tool + its target from the envelope.
 *
 * Carried over from the nudge unchanged, and the manifest's `tools:` filter is
 * pinned against exactly this branch surface — Grep, Glob, Read.
 */
export function classifyTool(envelope: JsonObject): ToolIntent {
    const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const nameVal =
        payload['tool_name'] ?? payload['toolName'] ?? payload['tool'] ?? envelope['tool_name'] ?? envelope['tool'];
    const name = typeof nameVal === 'string' ? nameVal : '';
    const ti = (isObject(payload['tool_input']) ? payload['tool_input'] : envelope['tool_input']) as
        | JsonObject
        | undefined;
    const isSearch = name === 'Grep' || name === 'Glob';
    let isCodeRead = false;
    if (name === 'Read' && isObject(ti)) {
        const fp = ti['file_path'] ?? ti['path'];
        if (typeof fp === 'string') isCodeRead = CODE_EXT.test(fp);
    }
    return { isSearch, isCodeRead };
}

function sessionId(envelope: JsonObject): string {
    const s = envelope['session_id'] ?? envelope['sessionId'];
    return typeof s === 'string' && s ? s : 'default';
}

function latchFile(root: string): string {
    return path.join(root, 'agents', 'runtime', 'state', 'code-graph-context.json');
}
function alreadySpoke(root: string, session: string): boolean {
    try {
        const state = JSON.parse(fs.readFileSync(latchFile(root), 'utf-8')) as Record<string, boolean>;
        return state[session] === true;
    } catch {
        return false;
    }
}
function latch(root: string, session: string): void {
    try {
        const p = latchFile(root);
        let state: Record<string, boolean> = {};
        try {
            state = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, boolean>;
        } catch {
            /* fresh */
        }
        state[session] = true;
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(state));
    } catch {
        /* fail-open: a persistence failure must not break the tool call */
    }
}

const NATIVE_CACHE = path.join('agents', 'runtime', 'state', 'code-graph-v1.json');

/** The three-state staleness token this hook reports. */
export type GraphState = 'absent' | 'fresh' | `behind:${number}`;

/**
 * Resolve the graph's state for `root`.
 *
 * `absent` means no source at all — the silent case. A picked source whose
 * staleness is UNKNOWN reads as `fresh`, mirroring `computeVerdict`'s own
 * `picked.stale ? STALE : FRESH`: unknown is not treated as stale, because
 * inventing a commit count would be worse than reporting none.
 */
export function graphState(root: string): GraphState {
    const picked = pickSource(detectSources(root, path.join(root, NATIVE_CACHE)));
    if (!picked) return 'absent';
    if (picked.stale !== true) return 'fresh';
    const behind = picked.commits_behind;
    return `behind:${typeof behind === 'number' ? behind : 0}`;
}

/**
 * The one line, ≤ ~45 tokens.
 *
 * It names the state and the verbs, and — on the stale branch — what the state
 * costs. It does NOT claim the graph beats grep: that ordering question is
 * `later/road-to-a-graph-that-wins.md`'s, and Kill register K5 forbids
 * "graph-first" wording here.
 */
export function contextLine(state: GraphState): string {
    if (state === 'fresh') {
        return (
            'code-graph: fresh. For structure questions (who calls / where used / impact) ' +
            '`agent-config code-graph query|affected <symbol>` answers from the index; ' +
            'grep is the other path — say which one answered.'
        );
    }
    const n = state.slice('behind:'.length);
    return (
        `code-graph: ${n} commit(s) behind. Relationship answers may miss anything newer — ` +
        '`agent-config code-graph refresh` rebuilds it, or use grep and say so.'
    );
}

export function main(): number {
    let envelope: JsonValue;
    try {
        const raw = readHookStdin();
        envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
    } catch {
        return EXIT_ALLOW;
    }
    if (!isObject(envelope)) return EXIT_ALLOW;

    const cwd = envelope['cwd'];
    const pr = envelope['workspace_root'] ?? envelope['project_root'];
    const root = typeof cwd === 'string' && cwd ? cwd : typeof pr === 'string' && pr ? pr : '.';

    const { isSearch, isCodeRead } = classifyTool(envelope);
    if (!isSearch && !isCodeRead) return EXIT_ALLOW;

    const session = sessionId(envelope);
    if (alreadySpoke(root, session)) return EXIT_ALLOW; // once per session

    let state: GraphState;
    try {
        state = graphState(root);
    } catch {
        return EXIT_ALLOW;
    }
    // No graph is the silent case — see the header. Nothing is latched either,
    // so a session that builds a graph mid-flight still gets the line once.
    if (state === 'absent') return EXIT_ALLOW;

    latch(root, session);
    process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: contextLine(state) })}\n`);
    return EXIT_WARN;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (isCliEntry()) process.exit(main());
