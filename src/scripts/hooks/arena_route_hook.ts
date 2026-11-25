#!/usr/bin/env tsx
/**
 * PreToolUse guard: an arena is the bracket engine, never a hand-written
 * Workflow named after one.
 *
 * `/arena` (= `/judge bracket`) runs a resumable bracket whose state lives in
 * `agents/runtime/bracket/<run>/bracket.json`: lines, script-scored matches,
 * appeals. Workflow agents may CARRY its lines and judges. What went wrong in
 * session 58d6a4d2 (2026-11-25) is the other thing: the owner answered an ask
 * with "entscheide das in einer 10 agent arena", the agent loaded the generic
 * workflow-authoring reference and wrote `pr-gate-arena` — four proposers, five
 * judges, one synthesizer, no engine, no state file. It was not an arena in
 * this package's sense, it left nothing Agent Switch could show as one, and
 * nothing fired: the ask came back as a tool result, which no
 * `user_prompt_submit` route sees, and top-level commands such as `/arena` are
 * not in the model-visible listing (only `judge:bracket` is).
 *
 * The Workflow call is the one point every path to a hand-rolled arena passes.
 * The trigger is literal: the script's `meta` names an arena, bracket or
 * tournament as a word. The release is STATE, not text: the script must name a
 * run whose `bracket.json` exists — through a path `…/agents/runtime/bracket/<run>`
 * (absolute, or relative to the session's cwd) or `agent-config bracket … --run
 * <run>`. A mention alone, in a comment or of a folder the engine never wrote,
 * releases nothing: ratification round 1 refused the earlier substring release
 * on exactly that ground, and a real case confirmed it (a hand-written
 * `vertrags-arena` named `agents/runtime/bracket/vertrag-01`, a folder holding
 * its own `ergebnis.json` and no `bracket.json`).
 *
 * A script passed by `scriptPath` is read (bounded); an unreadable one, a
 * named saved workflow, or a malformed envelope is ALLOWED — this guards a
 * routing mistake, not a safety boundary, and must never wedge a session.
 *
 * Kill switch: `AGENT_CONFIG_ALLOW_HANDROLLED_ARENA=1`.
 *
 * Exit codes (docs/contracts/hook-architecture-v1.md):
 *   0 — allow
 *   1 — block (a hand-rolled arena)
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readHookStdin } from './hook_stdin.js';

const _HERE = fileURLToPath(import.meta.url);

const KILL_SWITCH = 'AGENT_CONFIG_ALLOW_HANDROLLED_ARENA';
const SCRIPT_MAX_BYTES = 256 * 1024;
const META_WINDOW = 2000;
const MAX_RUN_REFS = 32;
const ARENA_WORD = /(^|[^A-Za-z0-9])(arena|bracket|tournament)s?($|[^A-Za-z0-9])/i;
const RUN_ID = '[A-Za-z0-9][A-Za-z0-9._-]*';
// An absolute prefix, when the script spells one out; a `${REPO}/` prefix is left to the cwd.
const PATH_REF = new RegExp(`(/[^\\s'"\`$\\{\\}/][^\\s'"\`$\\{\\}]*/)?agents/runtime/bracket/(${RUN_ID})`, 'g');
const CLI_REF = new RegExp(`agent-config\\s+bracket\\b[^\\n]*?--run[=\\s]+(${RUN_ID})`, 'g');

type JsonObject = Record<string, unknown>;

function _isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface WorkflowCall {
    readonly tool: string;
    /** The script text, '' when there is none or it could not be read. */
    readonly script: string;
    /** The session's working directory: where a relative run folder lives. */
    readonly cwd: string;
}

function readBounded(file: string): string {
    try {
        const fd = fs.openSync(file, 'r');
        try {
            const buf = Buffer.alloc(SCRIPT_MAX_BYTES);
            const n = fs.readSync(fd, buf, 0, SCRIPT_MAX_BYTES, 0);
            return buf.subarray(0, n).toString('utf8');
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return '';
    }
}

/** Read (tool name, script text, cwd) off a PreToolUse envelope. */
export function extractWorkflowCall(envelope: JsonObject): WorkflowCall {
    const payload = _isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const nameVal = payload['tool_name'] ?? payload['toolName'] ?? payload['tool'] ?? envelope['tool_name'] ?? envelope['tool'];
    const tool = typeof nameVal === 'string' ? nameVal : '';
    const ti = _isObject(payload['tool_input']) ? payload['tool_input'] : _isObject(envelope['tool_input']) ? envelope['tool_input'] : {};
    const inline = typeof ti['script'] === 'string' ? ti['script'] : '';
    const scriptPath = typeof ti['scriptPath'] === 'string' ? ti['scriptPath'] : '';
    const cwdVal = payload['cwd'] ?? envelope['cwd'];
    const cwd = typeof cwdVal === 'string' && cwdVal !== '' ? cwdVal : process.cwd();
    return { tool, script: inline || (scriptPath ? readBounded(scriptPath) : ''), cwd };
}

/** The `name` and `description` strings of the script's `export const meta`. Pure. */
export function metaText(script: string): string {
    const at = script.indexOf('export const meta');
    if (at < 0) return '';
    const head = script.slice(at, at + META_WINDOW);
    const field = (key: string) => new RegExp(`\\b${key}\\s*:\\s*(['"\`])([^'"\`]*)\\1`).exec(head)?.[2] ?? '';
    return `${field('name')} ${field('description')}`;
}

/** Every run folder the script names, as candidate directories. Pure. */
export function runDirs(script: string, cwd: string): string[] {
    const out = new Set<string>();
    for (const m of script.matchAll(PATH_REF)) {
        const id = m[2] as string;
        if (m[1]) out.add(path.join(m[1], 'agents/runtime/bracket', id));
        out.add(path.join(cwd, 'agents/runtime/bracket', id));
        if (out.size >= MAX_RUN_REFS) break;
    }
    for (const m of script.matchAll(CLI_REF)) {
        out.add(path.join(cwd, 'agents/runtime/bracket', m[1] as string));
        if (out.size >= MAX_RUN_REFS) break;
    }
    return [...out].slice(0, MAX_RUN_REFS);
}

/** Whether the engine wrote this run: its `bracket.json` exists. */
function engineRun(dir: string): boolean {
    try {
        return fs.statSync(path.join(dir, 'bracket.json')).isFile();
    } catch {
        return false;
    }
}

/** The verdict, separated from I/O so the fixtures exercise the decision itself. */
export function verdict(call: WorkflowCall): { block: boolean; reason: string } {
    if (call.tool !== 'Workflow') return { block: false, reason: 'not a Workflow call' };
    if (!call.script) return { block: false, reason: 'no readable script — allowed, never guessed' };
    if (!ARENA_WORD.test(metaText(call.script))) return { block: false, reason: 'not an arena' };
    if (runDirs(call.script, call.cwd).some(engineRun)) return { block: false, reason: 'carries a bracket run the engine wrote' };
    return {
        block: true,
        reason:
            'This Workflow is named an arena but carries no bracket run the engine wrote (no ' +
            'agents/runtime/bracket/<run>/bracket.json it names exists). An arena here is /arena ' +
            '(= /judge bracket): `agent-config bracket plan`, then `agent-config bracket init --run <id> ' +
            '--task <file> --tier S1`, then dispatch the lines, scan, advance, collect, appeals. Workflow ' +
            'agents may carry the lines and judges once the run exists — name its folder in the script. ' +
            'A comparison of options by independent judges that is not a bracket is a panel ' +
            '(`/panel decide|review`) and must not be named an arena.',
    };
}

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    if (args.includes('--self-test')) return selfTest();
    if (process.env[KILL_SWITCH] === '1') return 0;
    const raw = readHookStdin();
    if (!raw.trim()) return 0;
    let envelope: JsonObject;
    try {
        const parsed: unknown = JSON.parse(raw);
        envelope = _isObject(parsed) ? parsed : {};
    } catch {
        return 0;
    }
    const v = verdict(extractWorkflowCall(envelope));
    if (v.block) {
        process.stderr.write(`arena-route: BLOCKED — ${v.reason}\n`);
        return 1;
    }
    return 0;
}

export function selfTest(): number {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-route-self-'));
    fs.mkdirSync(path.join(root, 'agents/runtime/bracket/live'), { recursive: true });
    fs.writeFileSync(path.join(root, 'agents/runtime/bracket/live/bracket.json'), '{}');
    fs.mkdirSync(path.join(root, 'agents/runtime/bracket/imitation'), { recursive: true });
    const wf = (script: string): WorkflowCall => ({ tool: 'Workflow', script, cwd: root });
    const cases: Array<[string, WorkflowCall, boolean]> = [
        ['a hand-rolled arena is denied', wf("export const meta = { name: 'pr-gate-arena', description: 'x' }"), true],
        ['a tournament bracket in the description is denied', wf("export const meta = { name: 'pick', description: 'Tournament of designs' }"), true],
        ['a carrier of a run the engine wrote is allowed', wf("export const meta = { name: 'a-arena-judge' }\nconst RUN = `${REPO}/agents/runtime/bracket/live`"), false],
        ['a CLI-driving carrier of a live run is allowed', wf("export const meta = { name: 'a-arena' }\n// agent-config bracket scan --run live"), false],
        ['a mention of a run the engine never wrote is denied', wf("export const meta = { name: 'x-arena' }\n// agents/runtime/bracket/nothing-here"), true],
        ['a folder without bracket.json is denied', wf("export const meta = { name: 'x-arena' }\nconst B = 'agents/runtime/bracket/imitation'"), true],
        ['an ordinary workflow is allowed', wf("export const meta = { name: 'find-bugs', description: 'find bugs' }"), false],
        ['a longer identifier is not the word', wf("export const meta = { name: 'map-arenaview' }"), false],
        ['another tool is never seen', { tool: 'Bash', script: "export const meta = { name: 'arena' }", cwd: root }, false],
        ['an empty script is allowed', wf(''), false],
    ];
    let failed = 0;
    try {
        for (const [name, call, want] of cases) {
            const got = verdict(call).block;
            const ok = got === want;
            process.stdout.write(`${ok ? '✅' : '❌'}  ${name} — block=${String(got)}${ok ? '\n' : ` (wanted ${String(want)})\n`}`);
            if (!ok) failed += 1;
        }
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
    process.stdout.write(`\narena_route --self-test: ${String(cases.length - failed)}/${String(cases.length)} case(s) behaved\n`);
    return failed > 0 ? 1 : 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}

export { _HERE };
