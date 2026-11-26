/**
 * deliberation-mode — `user_prompt_submit` concern that tells the agent, in one
 * line, which `deliberation.mode` is in force for THIS session and what it
 * obliges: `offer` → offer `/council`, `/arena` or `/panel` as numbered options
 * when the prompt carries a real decision; `auto` → the user's own opt-in to an
 * automatic mode: run the fitting tool, and answer the agent's own
 * implementation questions instead of asking, with the Hard Floor
 * (`non-destructive-by-default`) still asking for merge, deploy, push, release,
 * production data/infra, bulk deletion and irreversible external actions. The
 * line is the carrier on purpose — no rule file, so the per-spawn preamble does
 * not grow; the procedure is `/deliberation` and the `ai-council` skill's
 * § Deliberation mode.
 *
 * Resolution: session override (`state/deliberation/<session_id>.json`) >
 * user-global `deliberation.mode` > `off` (`_lib/deliberation_mode.ts`). `off`
 * is the default: the mode is switched on only when the user asks, for this
 * session unless they say globally (owner ruling 2026-11-26).
 *
 * Silent on: mode `off` (except a prompt that itself names council, arena,
 * panel or deliberation — then one line says how to switch it on for this
 * session or globally, so the toggle has the session id it needs), slash
 * commands, harness-generated turns, and replies under three words.
 *
 * Never blocks; exit 0 on every path. Kill switch:
 * `AGENT_CONFIG_NO_DELIBERATION_HINT=1`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveDeliberationMode, validSessionId, type DeliberationMode } from '../_lib/deliberation_mode.js';
import { isSyntheticPrompt } from '../_lib/prompt_shape.js';
import { EXIT_ALLOW } from './exit_codes.js';
import { readHookStdin } from './hook_stdin.js';

type JsonObject = Record<string, unknown>;

export const CONCERN = 'deliberation-mode';
export const KILL_SWITCH = 'AGENT_CONFIG_NO_DELIBERATION_HINT';
export const MIN_WORDS = 3;
const TOPIC = /\b(?:council|arena|panel|deliberation|deliberations?-?modus)\b/i;
const TOOLS =
    '/council (other model families\' second opinion), /arena (competing solutions judged pairwise), ' +
    '/panel decide|review (independent judges vote or verify)';
/** The Hard Floor, named in the `auto` line itself so no reader of the line takes `auto` past it. */
export const ALWAYS_ASK =
    'merge, deploy, push, release or tag, production data or infra, bulk deletion, any irreversible external action ' +
    '(send, publish, post, purchase), owner-reserved decisions, and facts only the user holds';

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Whether this prompt is one the line is worth spending on. Pure. */
export function promptWarrantsLine(prompt: string): boolean {
    const text = prompt.trim();
    if (text === '' || text.startsWith('/')) return false;
    if (isSyntheticPrompt(text)) return false;
    return text.split(/\s+/).length >= MIN_WORDS;
}

/** The line for one mode, or `null` for silence. Pure. */
export function deliberationLine(mode: DeliberationMode, sessionId: string | null, prompt: string): string | null {
    const topic = TOPIC.test(prompt);
    const sid = sessionId === null ? '' : ` session="${sessionId}"`;
    const session = sessionId === null ? '' : ` --session ${sessionId}`;
    const toggle = topic
        ? ` Only if the user asks to change it: agent-config deliberation:set <off|offer|auto>${session}` +
          `${sessionId === null ? '' : ' for this chat (inherit removes that)'}; without --session only when they say globally or everywhere.`
        : '';
    if (mode === 'off') {
        if (!topic) return null;
        return (
            `<deliberation mode="off"${sid}>Deliberation is off (the default): never offer or start /council, /arena or /panel unasked. ` +
            `Switch it on only if the user asks: agent-config deliberation:set <offer|auto>${session}` +
            `${sessionId === null ? '' : ' for this chat'}; without --session only when they say globally or everywhere.</deliberation>`
        );
    }
    if (mode === 'offer') {
        return (
            `<deliberation mode="offer"${sid}>If this prompt asks for a real decision with trade-offs (a design choice, a contested claim, several viable solutions), ` +
            `offer the fitting one(s) as numbered options — ${TOOLS} — with one recommendation line and the plain answer as the last option. ` +
            `Never on a trivial ask. Procedure: /deliberation.${toggle}</deliberation>`
        );
    }
    return (
        `<deliberation mode="auto"${sid}>The user switched on automatic mode. Answer your own implementation questions inside the task ` +
        `(how to do it, approach, design, library) yourself — directly, or via ${TOOLS} when that is worth it — and state each decision ` +
        `with a one-line reason instead of asking. Run a fitting tool yourself when it adds value, saying which and why in one line; ` +
        `its own spend and seat rules still apply. Never on a trivial ask. Still ask, always: ${ALWAYS_ASK}. Procedure: /deliberation.${toggle}</deliberation>`
    );
}

function field(o: JsonObject, keys: readonly string[]): string {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v.trim() !== '') return v;
    }
    return '';
}

export interface HookDeps {
    readonly env: NodeJS.ProcessEnv;
    readonly settingsPaths?: readonly string[];
}

/** The concern's decision for one envelope: the line to inject, or `null`. */
export function decide(envelope: JsonObject, deps: HookDeps): string | null {
    if (deps.env[KILL_SWITCH] === '1') return null;
    const event = envelope['event'];
    if (typeof event === 'string' && event !== '' && event !== 'user_prompt_submit') return null;
    const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const prompt = field(payload, ['prompt', 'userPrompt', 'user_prompt', 'message', 'text']);
    if (!promptWarrantsLine(prompt)) return null;
    const sessionId = validSessionId(field(payload, ['session_id', 'sessionId']) || field(envelope, ['session_id', 'sessionId']));
    const effective = resolveDeliberationMode({ sessionId, settingsPaths: deps.settingsPaths, env: deps.env });
    // A settings layer that exists but cannot be read may hold `off`; without a
    // session override deciding, stay silent rather than assume the default.
    if (effective.source !== 'session' && effective.global.unreadable === true) return null;
    return deliberationLine(effective.mode, sessionId, prompt);
}

export function main(): number {
    try {
        const raw = readHookStdin();
        const parsed: unknown = raw.trim() ? JSON.parse(raw) : {};
        const line = decide(isObject(parsed) ? parsed : {}, { env: process.env });
        if (line === null) return EXIT_ALLOW;
        process.stdout.write(`${JSON.stringify({ decision: 'allow', reason: `${CONCERN}: mode line`, context: line })}\n`);
    } catch {
        // A malformed envelope or an unreadable state file never costs the turn.
    }
    return EXIT_ALLOW;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
