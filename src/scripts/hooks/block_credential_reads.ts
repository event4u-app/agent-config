#!/usr/bin/env node
/**
 * PreToolUse guard: refuse reading a credential-class file, and refuse a
 * command that prints the process environment — road-to-one-detector-and-the-
 * senders-we-own 1.1.
 *
 * Prevention ahead of the egress stage: a value that is never read cannot reach
 * a model provider through any later bug, and everything the session reads goes
 * into the conversation, so a `.env` read is a `.env` sent. It is a best-effort
 * guard over the shapes it recognises, not a boundary: it allows what it cannot
 * decide (`fail_closed: false`), and the residue below is not caught.
 *
 * What it refuses, with the class list in `_lib/credential_files.ts` (shared
 * with the installer's native deny tier):
 *
 *   - a file tool (Read, Edit, Grep, …) whose target path is an environment
 *     file (`.env`, `.env.*`, `.envrc` — `.env.example` and the other template
 *     names pass), a private key, a cloud or CLI credential file, or a
 *     package-registry credential file;
 *   - a shell command that hands such a path — as an argument, a redirect or an
 *     option value (`--config=.env`) — to anything but a short list of commands
 *     that neither print nor run it (`ls`, `rm`, `chmod`, …), looking through
 *     `sudo`/`command`/`nice`-style wrappers, `sh -c`, `eval` and command
 *     substitutions;
 *   - a shell command that prints the environment (`env`, `printenv`, a bare
 *     `export`, a bare `set`, `declare -x`).
 *
 * What it allows: a write-only tool (the value is the model's own), a tool that
 * returns names rather than content (Glob, LS), and a guard it cannot decide —
 * a malformed envelope or any crash allows (`fail_closed: false`), so this
 * guard is never the reason an unrelated call fails. Not caught, and recorded
 * as the residue `tests/fixtures/egress-prevention-gaps/` names: a program that
 * reads the file itself (`node -e "…readFileSync('.env')"`), a value printed by
 * a running process, a secret typed by the user.
 *
 * Kill switch: `AGENT_CONFIG_ALLOW_CREDENTIAL_READS=1`.
 *
 * Only a host that binds `pre_tool_use` AND honours a deny refuses; elsewhere
 * the dispatcher lowers the block to a warning (`host_semantics.ts`), and
 * `agent-config hooks:status` answers which applies on the host in use.
 *
 * Exit codes (docs/contracts/hook-architecture-v1.md): 0 allow · 1 block.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    CREDENTIAL_CLASS_LABEL,
    credentialBasename,
    credentialFileClass,
    HOST,
    segmentVerdict,
    type CredentialFileClass,
    type PathHost,
} from '../_lib/credential_files.js';
import { isEnvKillSwitchActive } from '../_lib/env_kill_switch.js';
import { invokedSegments } from './git_command_classifier.js';
import { readHookStdin } from './hook_stdin.js';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

export const KILL_SWITCH = 'AGENT_CONFIG_ALLOW_CREDENTIAL_READS';

const PATH_KEYS: ReadonlySet<string> = new Set([
    'file_path', 'path', 'target_file', 'filename', 'filePath', 'notebook_path', 'paths', 'files', 'file_paths',
]);

/** Every string held under a path key, at any depth and inside arrays. */
function pathValues(v: JsonValue | undefined, underPathKey: boolean, out: string[]): string[] {
    if (typeof v === 'string') {
        if (underPathKey && v !== '') out.push(v);
    } else if (Array.isArray(v)) {
        for (const x of v) pathValues(x, underPathKey, out);
    } else if (isObject(v)) {
        for (const [k, x] of Object.entries(v)) pathValues(x, underPathKey || PATH_KEYS.has(k), out);
    }
    return out;
}

/** Tools that write a value the model already has, or list names without content. */
const NON_READING_TOOLS: ReadonlySet<string> = new Set(['write', 'create_file', 'glob', 'ls', 'list_dir', 'file_search']);

function isObject(v: JsonValue | undefined): v is JsonObject {
    return v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);
}

export interface Refusal {
    readonly class: CredentialFileClass;
    readonly what: string;
}

/** The refusal for one tool call, or null. Pure: the host whose paths are judged is an argument. */
export function verdictFor(toolName: string, input: JsonObject, host: PathHost = HOST): Refusal | null {
    const tool = toolName.trim().toLowerCase();
    if (!NON_READING_TOOLS.has(tool)) {
        for (const v of pathValues(input, false, [])) {
            const cls = credentialFileClass(v, host);
            if (cls !== null) return { class: cls, what: `\`${credentialBasename(v)}\`` };
        }
    }
    const cmd = input['command'];
    if (typeof cmd === 'string' && cmd !== '') {
        for (const segment of invokedSegments(cmd)) {
            const r = segmentVerdict(segment, host);
            if (r !== null) return r;
        }
    }
    return null;
}

export function denyMessage(r: Refusal): string {
    const alternative =
        r.class === 'process-environment'
            ? 'Print one variable you need by name, and only one that holds no secret.'
            : 'Reference the variable by name (`$NAME`, `process.env.NAME`) instead of reading its value; `.env.example` lists the keys.';
    return (
        `Blocked: ${r.what} is ${CREDENTIAL_CLASS_LABEL[r.class]}. What a session reads is sent to the model ` +
        `provider, so a credential read is a credential sent. ${alternative} ` +
        `(block-credential-reads; maintainer override: ${KILL_SWITCH}=1)\n`
    );
}

export function main(): number {
    if (isEnvKillSwitchActive(KILL_SWITCH)) return 0;
    let envelope: JsonObject;
    try {
        const raw = readHookStdin();
        if (!raw) return 0;
        envelope = JSON.parse(raw) as JsonObject;
    } catch {
        return 0;
    }
    try {
        const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
        const input = isObject(payload['tool_input']) ? payload['tool_input'] : isObject(envelope['tool_input']) ? envelope['tool_input'] : null;
        if (input === null) return 0;
        const rawTool = payload['tool_name'] ?? envelope['tool_name'];
        const r = verdictFor(typeof rawTool === 'string' ? rawTool : '', input);
        if (r === null) return 0;
        process.stderr.write(denyMessage(r));
        return 1;
    } catch {
        return 0;
    }
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main());
}
