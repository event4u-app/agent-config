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
 * It reads the definition the host will run — `<project>/.claude/agents/<type>.md`,
 * then `<config dir>/agents/<type>.md` — rather than a list of agent names, so a
 * definition that stops skipping stops receiving the digest. A type that is not
 * a plain id (a plugin's `plugin:agent`, a path) is not looked up.
 *
 * Ships in its own chunk (decision A9): the dispatch bundle carries only its
 * `LAZY_CONCERNS` row. Kill switch: `AGENT_CONFIG_SUBAGENT_CONSTRAINTS=off`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
import { readHookStdin } from './hook_stdin.js';

/** The digest's byte ceiling; `hook-token-budget.json` caps the concern above it. */
export const DIGEST_MAX_BYTES = 3_500;

/** The files the host loads per directory and `omitClaudeMd` skips, in load order. */
export const INSTRUCTION_FILES: readonly string[] = ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md'];

const AGENT_TYPE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

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

/** True when the definition the host runs for `agentType` declares `omitClaudeMd: true`. */
export function definitionSkipsInstructions(projectDir: string, agentType: string, configDir: string): boolean {
    if (!AGENT_TYPE.test(agentType)) return false;
    for (const dir of [path.join(projectDir, '.claude', 'agents'), path.join(configDir, 'agents')]) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(dir, `${agentType}.md`), 'utf-8');
        } catch {
            continue;
        }
        const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
        return fm !== null && /^omitClaudeMd:[ \t]*true[ \t]*$/m.test(fm[1] as string);
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

/** The project's instruction files as one block of at most `maxBytes`, or null when there are none. */
export function instructionDigest(projectDir: string, maxBytes: number = DIGEST_MAX_BYTES): string | null {
    const parts: string[] = [];
    for (const dir of instructionDirs(projectDir)) {
        for (const rel of INSTRUCTION_FILES) {
            const abs = path.join(dir, rel);
            let text: string;
            try {
                text = fs.readFileSync(abs, 'utf-8');
            } catch {
                continue;
            }
            const body = text.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim();
            if (body !== '') parts.push(`--- ${abs} ---\n${body}`);
        }
    }
    if (parts.length === 0) return null;
    const head =
        'Project instructions this subagent was started without (its definition sets omitClaudeMd). ' +
        'They bind this subagent as if loaded:';
    const full = `${head}\n\n${parts.join('\n\n')}`;
    if (Buffer.byteLength(full, 'utf-8') <= maxBytes) return full;
    const tail = '\n[truncated: read the files named above for the rest before acting on them]';
    let cut = full.slice(0, maxBytes - Buffer.byteLength(tail, 'utf-8'));
    while (Buffer.byteLength(cut, 'utf-8') > maxBytes - Buffer.byteLength(tail, 'utf-8')) cut = cut.slice(0, -1);
    const nl = cut.lastIndexOf('\n');
    return `${nl > head.length ? cut.slice(0, nl) : cut}${tail}`;
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
        process.stdout.write(`${JSON.stringify({ additional_context: digest })}\n`);
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
