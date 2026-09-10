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
 * THE SECOND CLASS, AND WHY IT BELONGS HERE. A Bash command that writes a
 * file — `sed -i`, `cat > f`, `tee f`, `perl -i`, a `python3 -c` that opens a
 * path for writing — costs a confirmation for a reason no allowlist entry
 * fixes: a write-shaped Bash grant does NOT persist. The host's own
 * permission documentation records that "don't ask again" saves a permanent
 * rule for read-only and pre-approved commands and that write-shaped ones
 * last until session end, so the same shape is confirmed again next session.
 * The Edit and Write tools carry no such expiry for a path inside the working
 * directory. That makes the substitution a strictly cheaper primitive rather
 * than a style preference, which is why the concern that already reads
 * `tool_input.command` carries it instead of a second concern reading the
 * same field. Measured over 7,488 real Bash calls in 40 transcripts on the
 * maintainer's machine: 326 (4.4 %) wrote a file through the shell — 214
 * `cat >`, 61 `sed -i`, 49 `python3 -c` with a write-mode `open`.
 *
 * WHAT IT DOES NOT FLAG, DELIBERATELY. A pipe of ordinary filters
 * (`grep foo file | head`) is one command with a filter, not two work steps.
 * A redirect whose target is not a file the shell is filling with content —
 * `2>&1`, `> /dev/null` — is not a write. A heredoc is a command with input.
 * Flagging any of those would make the nudge noise, and a nudge that fires on
 * correct usage is worse than none.
 *
 * NEVER BLOCKS. The dispatcher contract is 0 allow · 2 warn, and a warn on
 * `pre_tool_use` with `severity: advisory` is an injection, not a deny — the
 * same channel `code-graph-nudge` and `ui-route-nudge` already use. Every
 * failure path returns allow: unreadable stdin, malformed JSON, unwritable
 * latch. A token optimisation must never break a tool call.
 *
 * ONCE PER SHAPE CLASS PER SESSION. A latch keyed by session id, in the state
 * directory `code-graph-nudge.json` already occupies. Each class reaches the
 * model once, early, on the first call carrying it — so a session sees at most
 * two lines, never one line for two different mistakes.
 *
 * That is a per-CLASS latch, not a per-CALL one, and the distinction is the
 * whole reason it is allowed to change: the recorded decision this file
 * carried refuses "repeating it every call", which is the nagging this
 * codebase refuses elsewhere, and a second class firing once is a different
 * mechanism from a first class firing twice. The single-boolean latch was
 * written when there was one class; with two, it would have let whichever
 * shape came first silence the other for the rest of the session.
 *
 * A latch file written by the single-class version holds `true` rather than an
 * object. That is read as "the chain class has fired", which is what it meant,
 * so an in-flight session upgrades without losing its latch and without
 * replaying a line it already showed.
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
 * The five shapes that fill a file's content from the shell, each matched on
 * the literal-stripped command so a quoted mention cannot fire it.
 *
 * A positive list, not a redirect scan: `>` alone is a redirect and the header
 * says a redirect is not flagged. What is flagged is a command whose named
 * operation IS "put this content in that path", which is the operation Edit
 * and Write perform without an expiring grant. `/dev/null` and an fd
 * duplication (`2>&1`) are excluded because neither names a file being filled.
 */
const EDIT_BY_SHELL: ReadonlyArray<{ re: RegExp; seen: string; raw?: true }> = [
    { re: /(^|[\s;&|(])sed\s+(-[A-Za-z]+\s+)*-i\b/, seen: '`sed -i` edits a file in place' },
    { re: /(^|[\s;&|(])perl\s+(-[A-Za-z]+\s+)*-[A-Za-z]*i\b/, seen: '`perl -i` edits a file in place' },
    { re: /(^|[\s;&|(])cat\s*>{1,2}\s*(?!&|\/dev\/null)\S/, seen: '`cat >` fills a file from the shell' },
    { re: /(^|[\s;&|(])tee\s+(?!-)(?!\/dev\/null)\S/, seen: '`tee` writes its input to a file' },
    // RAW, and it has to be: an interpreter's program is a quoted argument, so
    // `stripLiterals` removes the whole body and this rule could never fire
    // against the stripped text. Matched on the raw string it needs the write
    // MODE to be named — `open(p, "w")` — so a path merely being read, and a
    // quoted mention of the shape in prose, both stay silent.
    { re: /python3?\s+-c[\s\S]*\bopen\s*\([^)]*['"][wax]\+?['"]/, seen: 'a `python3 -c` one-liner opens a path for writing', raw: true },
];

/** What the write-shaped detector saw, or null when the call writes no file. */
export function detectEditByShell(command: string): string | null {
    const bare = stripLiterals(command);
    for (const shape of EDIT_BY_SHELL) {
        if (shape.re.test(shape.raw ? command : bare)) return shape.seen;
    }
    return null;
}

/** The two shape classes this concern carries. */
export type NudgeClass = 'edit-by-shell' | 'chain';

/** One finding: which class fired, and what it saw. */
export interface NudgeFinding {
    klass: NudgeClass;
    seen: string;
}

/**
 * The finding for this command, or null.
 *
 * `edit-by-shell` is tested first, and on a call that is both — `cd d && sed
 * -i … f` is — it wins: its line names a primitive that costs no confirmation
 * at all, while the chain line only explains why this one did.
 */
export function detectShape(command: string): NudgeFinding | null {
    const write = detectEditByShell(command);
    if (write) return { klass: 'edit-by-shell', seen: write };
    const chained = detectChaining(command);
    if (chained) return { klass: 'chain', seen: chained };
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

/** One session's latch: the object form, or the pre-two-class `true`. */
type LatchEntry = boolean | Record<string, boolean>;

/**
 * Has `klass` already fired for this session?
 *
 * A legacy `true` is read as the chain class having fired, which is what the
 * single-class version wrote it to mean. The write class is then unlatched in
 * that session and gets its first line — correct, because it never had one.
 */
export function classAlreadyNudged(entry: LatchEntry | undefined, klass: NudgeClass): boolean {
    if (entry === true) return klass === 'chain';
    if (isObject(entry)) return entry[klass] === true;
    return false;
}

/** `klass` recorded on top of whatever the entry already held. */
export function withClassLatched(entry: LatchEntry | undefined, klass: NudgeClass): Record<string, boolean> {
    const next: Record<string, boolean> = entry === true ? { chain: true } : isObject(entry) ? { ...(entry as Record<string, boolean>) } : {};
    next[klass] = true;
    return next;
}

function readLatch(root: string): Record<string, LatchEntry> {
    try {
        return JSON.parse(fs.readFileSync(latchFile(root), 'utf-8')) as Record<string, LatchEntry>;
    } catch {
        return {};
    }
}

function alreadyNudged(root: string, session: string, klass: NudgeClass): boolean {
    return classAlreadyNudged(readLatch(root)[session], klass);
}

function latch(root: string, session: string, klass: NudgeClass): void {
    try {
        const p = latchFile(root);
        const state = readLatch(root);
        state[session] = withClassLatched(state[session], klass);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(state));
    } catch {
        /* fail-open: a persistence failure must not break the tool call */
    }
}

/** The write-shape line — names the expiry, then the primitive without one. */
export function editByShellReason(seen: string): string {
    return (
        `This Bash call writes a file through the shell: ${seen}. A write-shaped ` +
        'Bash grant does not persist — the host saves a permanent rule for ' +
        'read-only commands, while a write-shaped one lasts until session end, so ' +
        'this same shape costs another confirmation next session. Edit and Write ' +
        'carry no such expiry inside the working directory: Edit for a targeted ' +
        'change, Write for a new file, the shell for reads. ' +
        'See `token-efficiency` § One command per Bash call.'
    );
}

/** The line for a finding, dispatched on its class. */
export function reasonFor(finding: NudgeFinding): string {
    return finding.klass === 'edit-by-shell' ? editByShellReason(finding.seen) : nudgeReason(finding.seen);
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

    // ORDER IS LOAD-BEARING, and getting it wrong cost 26 ms at p95. Every
    // predicate below that touches the filesystem runs AFTER the in-memory
    // ones, so the overwhelming majority of tool calls — every non-shell
    // call, and every unchained shell call — exit having read no file at all.
    // The first draft called `enabled()` first, which put a settings read in
    // front of every single pre_tool_use event on the host.
    const command = bashCommand(envelope);
    if (!command) return EXIT_ALLOW;

    const finding = detectShape(command);
    if (!finding) return EXIT_ALLOW;

    const cwd = envelope['cwd'];
    const pr = envelope['workspace_root'] ?? envelope['project_root'];
    const root = typeof cwd === 'string' && cwd ? cwd : typeof pr === 'string' && pr ? pr : '.';
    if (!enabled(root)) return EXIT_ALLOW;

    const session = sessionId(envelope);
    if (alreadyNudged(root, session, finding.klass)) return EXIT_ALLOW;

    latch(root, session, finding.klass);
    process.stdout.write(`${JSON.stringify({ decision: 'warn', reason: reasonFor(finding) })}\n`);
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
