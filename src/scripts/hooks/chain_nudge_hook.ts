#!/usr/bin/env tsx
/**
 * PreToolUse chain nudge — deterministic, warn-only.
 *
 * WHY A CARRIER EXISTS AT ALL. `token-efficiency` § One command per Bash call
 * is `type: auto`, so its triggers match the PROMPT, and no prompt announces
 * that the next tool call will be a chained Bash command. The obligation
 * applies at tool-call time and was reachable by nothing there. This concern
 * is that reach, and it is the only thing in the tree that reads
 * `tool_input.command` for this purpose.
 *
 * WHAT IT IS FOR, MEASURED. The host splits a compound command on `&&`, `||`,
 * `;`, `|`, `|&`, `&` and newlines and requires each segment to match the
 * allowlist independently, so one unmatched segment sends the whole call down
 * the permission path even when every other segment was already allowed. Over
 * 40,268 real Bash calls on the maintainer's machine, 17.9 % had a head token
 * matching no pattern and 5,037 of those were a leading `VAR=…` assignment —
 * a shape that cannot be written as an allowlist pattern at all. That class
 * shrinks only by not writing it.
 *
 * WHAT IT DOES NOT FLAG, DELIBERATELY. A pipe of ordinary filters
 * (`grep foo file | head`) is one command with a filter, not two work steps.
 * A redirect has its target checked against the file rules on its own. A
 * heredoc is a command with input. Flagging any of those would make the
 * nudge noise, and a nudge that fires on correct usage is worse than none.
 *
 * NEVER BLOCKS. The dispatcher contract is 0 allow · 2 warn, and a warn on
 * `pre_tool_use` with `severity: advisory` is an injection, not a deny — the
 * same channel `code-graph-nudge` and `ui-route-nudge` already use. Every
 * failure path returns allow: unreadable stdin, malformed JSON, unwritable
 * latch. A token optimisation must never break a tool call.
 *
 * ONCE PER SESSION. A latch keyed by session id, in the state directory
 * `code-graph-nudge.json` already occupies. The rule body reaches the model
 * once, early, on the first chained call — repeating it every call would be
 * the nagging this codebase refuses elsewhere.
 *
 * ON BY DEFAULT, WITH AN OPT-OUT. Unlike `code-graph-nudge`, which gates on a
 * project capability that may not exist, the fact this nudge carries is a
 * property of the HOST's permission matcher and is therefore true in every
 * consumer. `hooks.chain_nudge.enabled: false` turns it off.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readHookStdin } from './hook_stdin.js';

const SETTINGS_FILE = '.agent-settings.yml';
const EXIT_ALLOW = 0;
const EXIT_WARN = 2;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * `hooks.chain_nudge.enabled: false` mini-parser. Absent means ON, which is
 * the inverse of `code_graph_nudge.enabled` and stated in the header: the
 * fact carried here holds on every host, so absent-means-off would ship a
 * carrier nobody receives.
 */
export function enabled(root: string): boolean {
    let text: string;
    try {
        const f = path.join(root, SETTINGS_FILE);
        if (!fs.statSync(f).isFile()) return true;
        text = fs.readFileSync(f, 'utf-8');
    } catch {
        return true;
    }
    let inHooks = false;
    let inCn = false;
    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.replace(/^\s+/, '').startsWith('#')) continue;
        if (!(line.startsWith(' ') || line.startsWith('\t'))) {
            inHooks = /^hooks\s*:\s*$/.test(line);
            inCn = false;
            continue;
        }
        if (inHooks) {
            if (/^\s+chain_nudge\s*:\s*$/.test(line)) {
                inCn = true;
                continue;
            }
            if (inCn && /^\s{0,3}\S/.test(line)) inCn = false;
        }
        if (inCn && /^\s+enabled\s*:\s*false\b/.test(line)) return false;
    }
    return true;
}

/**
 * Strip quoted spans and heredoc bodies so an operator inside a string
 * literal cannot be read as chaining. `grep "a && b" f` is one command, and a
 * scanner that misses that fires on correct usage — the failure this concern
 * must not have.
 */
export function stripLiterals(cmd: string): string {
    let out = '';
    let i = 0;
    let quote: string | null = null;
    while (i < cmd.length) {
        const c = cmd[i] as string;
        if (quote) {
            if (c === '\\' && quote === '"') {
                i += 2;
                continue;
            }
            if (c === quote) quote = null;
            i += 1;
            continue;
        }
        if (c === '\\') {
            i += 2;
            continue;
        }
        if (c === '"' || c === "'") {
            quote = c;
            i += 1;
            continue;
        }
        const heredoc = /^<<-?\s*'?"?([A-Za-z_][A-Za-z0-9_]*)'?"?/.exec(cmd.slice(i));
        if (heredoc) {
            const tag = heredoc[1] as string;
            const end = cmd.indexOf(`\n${tag}`, i);
            i = end === -1 ? cmd.length : end + tag.length + 1;
            continue;
        }
        out += c;
        i += 1;
    }
    return out;
}

/** What the nudge saw, or null when the command is not chained work. */
export function detectChaining(command: string): string | null {
    const bare = stripLiterals(command);
    if (/^\s*[A-Za-z_][A-Za-z0-9_]*=/.test(bare) && /[;\n]/.test(bare)) {
        return 'a leading `VAR=…` assignment carrying state into a later segment';
    }
    if (/&&|\|\|/.test(bare)) return 'work steps chained with `&&` / `||`';
    if (/;\s*\S/.test(bare)) return 'work steps chained with `;`';
    return null;
}

/**
 * Tools that carry a shell command. Mirrors `ship_diff_volume_hook` and
 * `git_command_classifier` rather than hardcoding `Bash`: the tool name is
 * host-specific, and the manifest's own `code-graph-nudge` block warns about
 * exactly this spread. A named tool outside the set is declined; a payload
 * naming no tool still reads, which is the bare-host shape.
 */
const COMMAND_TOOLS: ReadonlySet<string> = new Set([
    'launch-process',
    'launch_process',
    'Bash',
    'BashTool',
    'run-process',
    'runProcess',
    'shell',
    'execute_shell',
    'RunShellCommand',
]);

/** The shell command this call carries, or '' when it carries none. */
export function bashCommand(envelope: JsonObject): string {
    const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const nameVal = payload['tool_name'] ?? payload['toolName'] ?? payload['tool'];
    if (typeof nameVal === 'string' && !COMMAND_TOOLS.has(nameVal)) return '';
    const ti = payload['tool_input'] ?? payload['toolInput'];
    if (isObject(ti)) {
        const c = ti['command'];
        if (typeof c === 'string') return c;
    }
    const c = payload['command'];
    return typeof c === 'string' ? c : '';
}

function sessionId(envelope: JsonObject): string {
    const s = envelope['session_id'] ?? envelope['sessionId'];
    return typeof s === 'string' && s ? s : 'default';
}

function latchFile(root: string): string {
    return path.join(root, 'agents', 'runtime', 'state', 'chain-nudge.json');
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

/** The nudge line — one line, names what was seen and what to do instead. */
export function nudgeReason(seen: string): string {
    return (
        `This Bash call chains work: ${seen}. The host matches each segment against ` +
        'the allowlist independently, so one unmatched segment sends the whole call ' +
        'down the permission path. Send N commands as N Bash calls in ONE block — ' +
        'that is the batch. `D=/repo; cd $D && git status` is `git -C /repo status`. ' +
        'Pipes of filters, redirects and heredocs are fine and are not what this flags. ' +
        'See `token-efficiency` § One command per Bash call.'
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
    if (!enabled(root)) return EXIT_ALLOW;

    const command = bashCommand(envelope);
    if (!command) return EXIT_ALLOW;

    const seen = detectChaining(command);
    if (!seen) return EXIT_ALLOW;

    const session = sessionId(envelope);
    if (alreadyNudged(root, session)) return EXIT_ALLOW;

    latch(root, session);
    process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: nudgeReason(seen) })}\n`);
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
