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
 * Once per distinct SEARCH TARGET, capped at five lines per session (step 2.2),
 * so it cannot nag. It was once-per-session until step 2.1 added `Bash`: with
 * shell searches in scope a single line covered the first `grep` of a session
 * and nothing after it, which is the opposite of the problem — the state that
 * matters is the state at the question being asked.
 * fail_closed: false — every error path returns allow; a context line must
 * never break a tool call.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { type GraphState, graphState } from '../code_graph/detect.js';
import { readHookStdin } from './hook_stdin.js';
import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';

const CODE_EXT = /\.(php|ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

interface ToolIntent {
    isSearch: boolean;
    isCodeRead: boolean;
    /**
     * What this call is ABOUT — a Grep/Glob pattern, a read path, or the search
     * term of a shell search. The per-target latch key (step 2.2): the same
     * question asked twice is one question, and a hook that answered it once
     * has nothing to add the second time.
     *
     * Empty when the call is neither a search nor a code read, and never the
     * raw command line of an arbitrary Bash call — see {@link bashSearchToken}.
     */
    target: string;
}

/**
 * The shell search heads this hook recognises.
 *
 * A closed list on purpose. "Any Bash command might be a search" is the reading
 * that makes the hook chatty — Risk-Register rank 2 — so a command whose head
 * is not here is silent AND does not latch, exactly as a non-code `Read` is.
 */
const SEARCH_HEADS = new Set(['grep', 'rg', 'ag', 'find', 'ack', 'fd']);

/**
 * The thing a shell search is searching FOR, or `null` when the command is not
 * a structure search at all.
 *
 * `git grep` is the one two-word head, so it is handled before the single-word
 * set rather than by putting `git` in it — `git log` is not a search.
 *
 * The token is the first argument that is not an option and not an option's
 * value we can recognise; failing that, the command's head, which collapses a
 * flag-only search onto one latch slot rather than leaking the whole command
 * line into a state file. Shell metacharacters end the read: everything after a
 * pipe belongs to another command.
 */
export function bashSearchToken(command: string): string | null {
    const words = command.trim().split(/\s+/).filter((w) => w !== '');
    if (words.length === 0) return null;
    let i = 0;
    let head = (words[0] as string).split('/').pop() as string;
    if (head === 'git' && words[1] === 'grep') {
        head = 'git grep';
        i = 2;
    } else if (SEARCH_HEADS.has(head)) {
        i = 1;
    } else {
        return null;
    }
    for (; i < words.length; i += 1) {
        const w = words[i] as string;
        if (w === '|' || w === '||' || w === '&&' || w === ';') break;
        if (w.startsWith('-')) continue;
        return w.replace(/^["']|["']$/g, '');
    }
    return head;
}

/**
 * Best-effort read of the intercepted tool + its target from the envelope.
 *
 * The manifest's `tools:` filter is pinned against exactly this branch surface
 * — Grep, Glob, Read, Bash. `Bash` joined it in step 2.1 for the reason the
 * step gives: the searches an agent actually runs in this tree are shell
 * searches, so a matcher that saw only the structured search tools was watching
 * the door nobody uses.
 */
export function classifyTool(envelope: JsonObject): ToolIntent {
    const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const nameVal =
        payload['tool_name'] ?? payload['toolName'] ?? payload['tool'] ?? envelope['tool_name'] ?? envelope['tool'];
    const name = typeof nameVal === 'string' ? nameVal : '';
    const ti = (isObject(payload['tool_input']) ? payload['tool_input'] : envelope['tool_input']) as
        | JsonObject
        | undefined;
    const silent: ToolIntent = { isSearch: false, isCodeRead: false, target: '' };

    if (name === 'Grep' || name === 'Glob') {
        const pat = isObject(ti) ? (ti['pattern'] ?? ti['query']) : undefined;
        return { isSearch: true, isCodeRead: false, target: typeof pat === 'string' ? pat : name };
    }
    if (name === 'Read' && isObject(ti)) {
        const fp = ti['file_path'] ?? ti['path'];
        if (typeof fp === 'string' && CODE_EXT.test(fp)) {
            return { isSearch: false, isCodeRead: true, target: fp };
        }
        return silent;
    }
    if (name === 'Bash' && isObject(ti)) {
        const cmd = ti['command'];
        if (typeof cmd !== 'string') return silent;
        const token = bashSearchToken(cmd);
        // Any other Bash command is silent AND does not latch: it consumed no
        // slot, so the next real search still gets its line.
        if (token === null) return silent;
        return { isSearch: true, isCodeRead: false, target: token };
    }
    return silent;
}

function sessionId(envelope: JsonObject): string {
    const s = envelope['session_id'] ?? envelope['sessionId'];
    return typeof s === 'string' && s ? s : 'default';
}

function latchFile(root: string): string {
    return path.join(root, 'agents', 'runtime', 'state', 'code-graph-context.json');
}

/**
 * At most this many context lines in one session (step 2.2).
 *
 * The cap is the chattiness bound, and it is the half that does not depend on
 * the agent's behaviour: per-target alone is unbounded, because a session that
 * greps thirty distinct symbols would hear thirty lines and the consumer would
 * turn the hook off. Five is a stated default, not a measurement — a session
 * that has been told the graph's state five times has been told.
 */
export const MAX_CONTEXT_LINES_PER_SESSION = 5;

/**
 * What the latch file records for a target: a truncated digest, never the
 * target itself.
 *
 * A council review of step 2.1 (2026-10-01, anthropic + openai) asked for one
 * concrete thing before the shell tool was routed here — that command text is
 * neither persisted nor carried into diagnostics. Routing on the shell tool
 * makes the target a search TERM an operator typed, and a term can be a
 * customer name, a token fragment or an internal hostname. Nothing downstream
 * needs to read it back: the latch answers "have I spoken about this one", and
 * equality over a digest answers that exactly as well.
 *
 * Not a security boundary and not claimed as one — a short digest of a short
 * term is guessable by anyone who can enumerate terms. It is the same
 * PII-exclusion-by-construction move `domain-safety-pii` § Surface 2 asks for:
 * the file is shaped so the plaintext is not in it to leak.
 */
export function latchKey(target: string): string {
    return createHash('sha256').update(target).digest('hex').slice(0, 16);
}

/**
 * Should this target get a line, given what this session already heard?
 *
 * Pure, so the two rules it encodes can be tested without a filesystem: a
 * repeat is silent at any count, and a NEW target is silent once the cap is
 * reached. Takes the target in the clear and hashes here, so no caller can
 * forget to.
 */
export function speaksFor(spoken: readonly string[], target: string): boolean {
    if (spoken.includes(latchKey(target))) return false;
    return spoken.length < MAX_CONTEXT_LINES_PER_SESSION;
}

function readLatch(root: string): Record<string, string[]> {
    try {
        const raw = JSON.parse(fs.readFileSync(latchFile(root), 'utf-8')) as Record<string, unknown>;
        const out: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(raw)) {
            // A pre-2.2 file stored `true` per session. Read it as "this session
            // is done", which is what it meant — never as an empty list, which
            // would hand an upgraded session a fresh budget it already spent.
            if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string');
            else if (v === true) out[k] = Array.from({ length: MAX_CONTEXT_LINES_PER_SESSION }, (_, i) => `legacy:${String(i)}`);
        }
        return out;
    } catch {
        return {};
    }
}

/**
 * The cheap read-only half, so the `git status` probe behind `graphState` runs
 * only for a call that could still produce a line (Risk-Register rank 3).
 *
 * Advisory only — {@link latchTarget} re-reads and remains the authority. A
 * disagreement between the two can only come from a concurrent write, and it
 * resolves toward silence, which is the safe direction for a context line.
 */
export function wouldSpeak(root: string, session: string, target: string): boolean {
    return speaksFor(readLatch(root)[session] ?? [], target);
}

/**
 * Decide and record in one step, because the two must not drift apart: a reader
 * that says yes and a writer that records something else is how a cap leaks.
 * Returns whether the caller may speak.
 */
export function latchTarget(root: string, session: string, target: string): boolean {
    const state = readLatch(root);
    const spoken = state[session] ?? [];
    if (!speaksFor(spoken, target)) return false;
    try {
        state[session] = [...spoken, latchKey(target)];
        const p = latchFile(root);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(state));
    } catch {
        /* fail-open: a persistence failure must not break the tool call */
    }
    return true;
}

/**
 * The four-state staleness token this hook reports.
 *
 * Re-exported, not defined here: Phase 3's verbs must print the same token, and
 * an engine module importing this hook to learn it would invert the dependency
 * direction D9 measures. The definition lives in `code_graph/detect.ts`; this
 * re-export keeps every existing importer of the hook working unchanged.
 */
export { type GraphState, graphState };

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
    if (state === 'edited') {
        return (
            'code-graph: level with HEAD, but indexed files are edited in the working tree. ' +
            'Relationship answers miss anything written since the last build — ' +
            '`agent-config code-graph refresh` picks the edits up, or use grep and say so.'
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

    const { isSearch, isCodeRead, target } = classifyTool(envelope);
    if (!isSearch && !isCodeRead) return EXIT_ALLOW;

    const session = sessionId(envelope);
    // Once per distinct target, at most five per session (2.2). Checked BEFORE
    // `graphState`, because that call now runs a `git status` probe and a line
    // this session will not emit must not pay for one.
    if (!wouldSpeak(root, session, target)) return EXIT_ALLOW;

    let state: GraphState;
    try {
        state = graphState(root);
    } catch {
        return EXIT_ALLOW;
    }
    // No graph is the silent case — see the header. Nothing is latched either,
    // so a session that builds a graph mid-flight still gets the line once.
    if (state === 'absent') return EXIT_ALLOW;

    if (!latchTarget(root, session, target)) return EXIT_ALLOW;
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
