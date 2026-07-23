#!/usr/bin/env tsx
/**
 * PreToolUse code-graph nudge (ADR-124 Phase 4) — deterministic, warn-only.
 *
 * When a code-graph source is available and the agent is about to search or
 * read source files, surface a one-line reminder to query the graph first.
 * NEVER blocks (dispatcher contract: 0 allow · 2 warn) — Source G's strict
 * block-the-first-read mode is deliberately NOT ported (blocking reads on a
 * possibly-stale index violates the minimal-safe-diff posture). Once per
 * session (a latch keyed by session id), so it cannot nag.
 *
 * Default-OFF. Fires only when `hooks.code_graph.enabled: true`. Disabled /
 * missing / already-latched → no-op exit 0. fail_closed: false — any error
 * returns allow; a token optimisation must never break a tool call.
 *
 * Branches (first eligible search/read this session):
 *   present + fresh → "query the graph first"
 *   present + stale → "index N commits behind — rebuild"
 *   absent          → "no graph — build one?"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { detectSources, pickSource } from '../code_graph/detect.js';

const SETTINGS_FILE = '.agent-settings.yml';
const EXIT_ALLOW = 0;
const EXIT_WARN = 2;
const CODE_EXT = /\.(php|ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `hooks.code_graph.enabled: true` mini-parser (mirrors rtk_wrap_hook). */
export function enabled(root: string): boolean {
    const f = path.join(root, SETTINGS_FILE);
    let text: string;
    try {
        if (!fs.statSync(f).isFile()) return false;
        text = fs.readFileSync(f, 'utf-8');
    } catch {
        return false;
    }
    let inHooks = false;
    let inCg = false;
    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.replace(/^\s+/, '').startsWith('#')) continue;
        if (!(line.startsWith(' ') || line.startsWith('\t'))) {
            inHooks = /^hooks\s*:\s*$/.test(line);
            inCg = false;
            continue;
        }
        if (inHooks) {
            if (/^\s+code_graph\s*:\s*$/.test(line)) {
                inCg = true;
                continue;
            }
            if (inCg && /^\s{0,3}\S/.test(line)) inCg = false;
        }
        if (inCg && /^\s+enabled\s*:\s*true\b/.test(line)) return true;
    }
    return false;
}

interface ToolIntent {
    isSearch: boolean;
    isCodeRead: boolean;
}

/** Best-effort read of the intercepted tool + its target from the envelope. */
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
    return path.join(root, 'agents', 'runtime', 'state', 'code-graph-nudge.json');
}
function alreadyNudged(root: string, session: string): boolean {
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

/** The nudge line for the current source state (≤40 tokens, one line). */
export function nudgeReason(root: string): string {
    const verdicts = detectSources(root, path.join(root, NATIVE_CACHE));
    const picked = pickSource(verdicts);
    if (!picked) {
        return 'No code-graph found. For "who calls / where used / impact" run `code_graph build` once, then `code_graph query <symbol>` instead of grepping blind.';
    }
    if (picked.stale) {
        return `code-graph is ${picked.commits_behind ?? 'N'} commit(s) behind — rebuild with \`code_graph build --update\` before trusting relationship answers.`;
    }
    return 'A fresh code-graph is present — for structure questions run `code_graph query|affected <symbol>` first; grep is the fallback (say which answered).';
}

export function main(): number {
    let envelope: JsonValue;
    try {
        const raw = process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf-8');
        envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
    } catch {
        return EXIT_ALLOW;
    }
    if (!isObject(envelope)) return EXIT_ALLOW;

    const cwd = envelope['cwd'];
    const pr = envelope['workspace_root'] ?? envelope['project_root'];
    const root = typeof cwd === 'string' && cwd ? cwd : typeof pr === 'string' && pr ? pr : '.';
    if (!enabled(root)) return EXIT_ALLOW;

    const { isSearch, isCodeRead } = classifyTool(envelope);
    if (!isSearch && !isCodeRead) return EXIT_ALLOW;

    const session = sessionId(envelope);
    if (alreadyNudged(root, session)) return EXIT_ALLOW; // once per session

    let reason: string;
    try {
        reason = nudgeReason(root);
    } catch {
        return EXIT_ALLOW;
    }
    latch(root, session);
    process.stdout.write(`${JSON.stringify({ decision: 'warn', reason })}\n`);
    return EXIT_WARN;
}

function isCliEntry(): boolean {
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
