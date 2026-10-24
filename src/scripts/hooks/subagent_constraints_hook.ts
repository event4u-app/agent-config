/**
 * Carries a project's instruction files to a subagent whose definition skips
 * them (road-to-a-tick-the-shipped-path-earns 2.4).
 *
 * A definition with `omitClaudeMd: true` starts without the project's CLAUDE.md
 * files; measured on Claude Code 2.1.306, it also loses the user-level rule
 * layer. The safety floor is baked into the definition body, so what such a
 * worker lacks is the consumer's own constraints. This concern fires on the
 * host's `SubagentStart`, whose `additionalContext` the host adds to the
 * subagent's context, and hands it a bounded digest of those files.
 *
 * This deliberately overrides part of `omitClaudeMd` for the project's own
 * instruction files, and a project file can permit as well as forbid, so the
 * concern changes what such a subagent may decide; it grants no tool or file
 * permission. Each injection lands in its own subagent's context; how many
 * subagents a turn may start is not bounded here.
 *
 * It reads the definition the host will run — `<project>/.claude/agents/<type>.md`,
 * then `<config dir>/agents/<type>.md` — rather than a list of agent names, so a
 * definition that stops skipping stops receiving the digest. A type that is not
 * a plain id (a plugin's `plugin:agent`, a path) is not looked up.
 *
 * Ships in its own chunk (decision A9), `yaml` external like `chat_history`'s:
 * the dispatch bundle carries only its `LAZY_CONCERNS` row. Kill switch: `AGENT_CONFIG_SUBAGENT_CONSTRAINTS=off`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
import { readHookStdin } from './hook_stdin.js';

/**
 * The byte ceiling of the whole reply line this concern writes, JSON escaping
 * included; `hook-token-budget.json` registers the same number for it.
 */
export const EMISSION_MAX_BYTES = 4_096;

/** The files the host loads per directory and `omitClaudeMd` skips, in load order. */
export const INSTRUCTION_FILES: readonly string[] = ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md'];

const AGENT_TYPE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const REPLY_OVERHEAD = Buffer.byteLength(`${JSON.stringify({ additional_context: '' })}\n`, 'utf-8');
const CUT = '\n[cut here]';
/** A file with less room than this left is listed as omitted rather than shown as a stub. */
const MIN_SHOWN = 120;
/** Escaped-byte bounds on the fixed part, so bodies keep most of the room. */
const ROOT_MAX = 400;
const LABEL_MAX = 160;
const INVENTORY_MAX = 1_200;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(o: Obj, ...keys: string[]): string | null {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v !== '') return v;
    }
    return null;
}

/** True when the definition the host runs for `agentType` parses `omitClaudeMd` as `true`. */
export function definitionSkipsInstructions(projectDir: string, agentType: string, configDir: string): boolean {
    if (!AGENT_TYPE.test(agentType)) return false;
    for (const dir of [path.join(projectDir, '.claude', 'agents'), path.join(configDir, 'agents')]) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(dir, `${agentType}.md`), 'utf-8');
        } catch {
            continue;
        }
        const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
        if (fm === null) return false;
        try {
            const data: unknown = parseYaml(fm[1] as string);
            return isObj(data) && data['omitClaudeMd'] === true;
        } catch {
            return false;
        }
    }
    return false;
}

/** `start` and its ancestors up to the nearest directory holding `.git`, root-most first. */
export function instructionDirs(start: string): string[] {
    const chain: string[] = [];
    let dir = path.resolve(start);
    for (;;) {
        chain.push(dir);
        if (fs.existsSync(path.join(dir, '.git'))) return chain.reverse();
        const up = path.dirname(dir);
        if (up === dir) return [path.resolve(start)];
        dir = up;
    }
}

/** Bytes `s` occupies inside a JSON string literal. */
function escBytes(s: string): number {
    return Buffer.byteLength(JSON.stringify(s), 'utf-8') - 2;
}

/** The longest prefix of `s` within `budget` escaped bytes, cut at a line end when one is in reach. */
function fitEscaped(s: string, budget: number): string {
    if (escBytes(s) <= budget) return s;
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (escBytes(s.slice(0, mid)) <= budget) lo = mid;
        else hi = mid - 1;
    }
    let cut = s.slice(0, lo);
    if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
    const nl = cut.lastIndexOf('\n');
    return nl > cut.length / 2 ? cut.slice(0, nl) : cut;
}

interface Found {
    readonly label: string;
    readonly body: string;
}

/**
 * The project's instruction files as one block whose serialized reply fits in
 * `maxBytes`, or null when there are none.
 *
 * Room goes to the file nearest the project directory first, because it is the
 * most specific, and every file found is named in an inventory with what became
 * of it (`full`, `cut`, `omitted`), so a cut never hides that a file exists.
 * Sections are then printed root-most first, the order the host loads them.
 */
export function instructionDigest(projectDir: string, maxBytes: number = EMISSION_MAX_BYTES): string | null {
    const dirs = instructionDirs(projectDir);
    const root = dirs[0] as string;
    const found: Found[] = [];
    for (const dir of dirs) {
        for (const rel of INSTRUCTION_FILES) {
            let text: string;
            try {
                text = fs.readFileSync(path.join(dir, rel), 'utf-8');
            } catch {
                continue;
            }
            const body = text.replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
            const label = fitEscaped(path.relative(root, path.join(dir, rel)) || rel, LABEL_MAX);
            if (body !== '') found.push({ label, body });
        }
    }
    if (found.length === 0) return null;
    const head =
        "A bounded digest of this project's instruction files, which this subagent's definition omitted at " +
        'startup (omitClaudeMd). It is not the files as the host loads them: comments are removed and a file ' +
        `may be cut or omitted, as listed below; read a listed file before relying on its missing part. Paths are relative to ${fitEscaped(root, ROOT_MAX)}.`;
    // Nearest files are listed by name first; the rest are counted when the names would not fit.
    const inventory = (status: readonly string[]): string => {
        const named = found.map((f, i) => `${f.label} (${status[i]})`);
        let from = 0;
        const render = (): string =>
            `Files, nearest last: ${from > 0 ? `${from} nearer the root not named, ` : ''}${named.slice(from).join(', ')}.`;
        while (from < named.length - 1 && escBytes(render()) > INVENTORY_MAX) from += 1;
        return render();
    };
    const status: string[] = found.map(() => 'omitted');
    const shown: string[] = found.map(() => '');
    let room = maxBytes - REPLY_OVERHEAD - escBytes(`${head}\n${inventory(status)}`);
    for (let i = found.length - 1; i >= 0; i--) {
        const f = found[i] as Found;
        const frame = escBytes(`\n\n--- ${f.label} ---\n`);
        if (room - frame < MIN_SHOWN) continue;
        if (escBytes(f.body) <= room - frame) {
            shown[i] = f.body;
            status[i] = 'full';
        } else {
            shown[i] = `${fitEscaped(f.body, room - frame - escBytes(CUT))}${CUT}`;
            status[i] = 'cut';
        }
        room -= frame + escBytes(shown[i] as string);
    }
    const sections = found.map((f, i) => (status[i] === 'omitted' ? '' : `\n\n--- ${f.label} ---\n${shown[i]}`));
    // The serialized line is the final authority: whatever the parts measured, the reply never exceeds maxBytes.
    return fitEscaped(`${head}\n${inventory(status)}${sections.join('')}`, maxBytes - REPLY_OVERHEAD);
}

/** The reply line for one digest. */
export function replyLine(digest: string): string {
    return `${JSON.stringify({ additional_context: digest })}\n`;
}

/** The digest to inject for one dispatcher envelope, or null. */
export function digestFor(envelope: unknown, env: NodeJS.ProcessEnv = process.env): string | null {
    if (env['AGENT_CONFIG_SUBAGENT_CONSTRAINTS'] === 'off' || !isObj(envelope)) return null;
    if (envelope['event'] !== undefined && envelope['event'] !== 'subagent_start') return null;
    const payload = isObj(envelope['payload']) ? envelope['payload'] : envelope;
    const agentType = str(payload, 'agent_type', 'agentType', 'subagent_type', 'subagentType');
    if (agentType === null) return null;
    const projectDir =
        str(envelope, 'workspace_root', 'project_root') ?? str(payload, 'cwd') ?? env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
    const configDir = env['CLAUDE_CONFIG_DIR'] || path.join(os.homedir(), '.claude');
    if (!definitionSkipsInstructions(projectDir, agentType, configDir)) return null;
    return instructionDigest(projectDir);
}

export function main(): number {
    try {
        const raw = readHookStdin();
        const digest = digestFor(raw.trim() ? JSON.parse(raw) : {});
        if (digest === null) return EXIT_ALLOW;
        process.stdout.write(replyLine(digest));
        return EXIT_WARN;
    } catch {
        return EXIT_ALLOW;
    }
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (isCliEntry()) process.exit(main());
