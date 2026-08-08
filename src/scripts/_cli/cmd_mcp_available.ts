/**
 * `agent-config mcp:available` — what is declared, what can actually launch,
 * and the static allowlist that is neither.
 *
 * Phase 2.3 of `road-to-capability-answerability`. Three surfaces in this tree
 * answer "which tools do I have" and they disagree: `mcp.json` declares the MCP
 * servers, `TOOL_REGISTRY` is a two-entry constant governing what a skill may
 * put in `allowed_tools`, and the `mcp` skill tabulates a larger set as prose.
 * An agent asking the question reads whichever it finds first. This verb prints
 * all three, labelled, in one place — the step's requirement is literally "keep
 * the two apart in the output; conflating them is the current defect".
 *
 * ## The honesty constraint, which shapes the whole design
 *
 * This verb does NOT perform an MCP handshake. It reports whether each declared
 * server's command resolves to an executable on `PATH`, which is a strictly
 * weaker fact, so it is labelled `launchable` and never `reachable`. Calling a
 * PATH lookup "reachable" would repeat verbatim the defect Phase 1.2 exists to
 * fix — a probe reporting a derived answer as though it were a detection.
 *
 * Remote (`url`) servers are reported as declared-but-unprobed rather than
 * fetched. A read-only status verb that opens outbound connections would add an
 * egress leg to a surface that has none (`lethal-trifecta-guard`), and a probe
 * is not worth a network call the caller did not ask for.
 *
 * Read-only by construction: no writer is imported and no file is opened for
 * writing.
 *
 * Exit codes: `0` answered, including "nothing declared" · `1` `mcp.json` exists
 * but cannot be parsed — a declaration file that does not parse is a failure to
 * answer, not an answer of "none".
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolve_project_root } from '../_lib/agent_settings.js';
import { list_tools } from '../tool_registry.js';

/** How a declared server is addressed. */
export type ServerTransport = 'command' | 'url' | 'unknown';

/** Whether the declared command could be started at all. */
export type LaunchState = 'launchable' | 'not-on-path' | 'not-probed';

export interface DeclaredServer {
    name: string;
    transport: ServerTransport;
    /** The command word, or the URL, or null when the entry declares neither. */
    target: string | null;
    launch: LaunchState;
    /** Absolute path the command resolved to, when it resolved. */
    resolved: string | null;
}

export interface McpAvailableOptions {
    cwd: string;
    json: boolean;
    /** `PATH` to search. Injected by the tests; defaults to the process value. */
    pathEnv: string;
}

export interface McpAvailableResult {
    code: 0 | 1;
    out: string[];
    err: string[];
}

interface RawServerEntry {
    command?: unknown;
    url?: unknown;
    args?: unknown;
}

/**
 * The first executable named `command` on `pathEnv`, or `null`.
 *
 * A command containing a path separator is treated as a path and checked
 * directly — that is how `mcp.json` entries pointing at a repo-local script
 * behave, and searching `PATH` for `./bin/server` would always miss.
 */
export function resolveOnPath(command: string, pathEnv: string, cwd: string): string | null {
    if (command === '') return null;
    const candidates = command.includes(path.sep)
        ? [path.resolve(cwd, command)]
        : pathEnv.split(path.delimiter).filter((p) => p !== '').map((dir) => path.join(dir, command));
    for (const candidate of candidates) {
        try {
            const stat = fs.statSync(candidate);
            // eslint-disable-next-line no-bitwise
            if (stat.isFile() && (stat.mode & 0o111) !== 0) return candidate;
        } catch {
            continue;
        }
    }
    return null;
}

/** Parse one `servers` entry into the shape the report prints. */
export function classifyServer(
    name: string,
    entry: RawServerEntry,
    pathEnv: string,
    cwd: string,
): DeclaredServer {
    if (typeof entry.command === 'string' && entry.command !== '') {
        const resolved = resolveOnPath(entry.command, pathEnv, cwd);
        return {
            name,
            transport: 'command',
            target: entry.command,
            launch: resolved === null ? 'not-on-path' : 'launchable',
            resolved,
        };
    }
    if (typeof entry.url === 'string' && entry.url !== '') {
        return { name, transport: 'url', target: entry.url, launch: 'not-probed', resolved: null };
    }
    return { name, transport: 'unknown', target: null, launch: 'not-probed', resolved: null };
}

export function runMcpAvailable(opts: McpAvailableOptions): McpAvailableResult {
    const out: string[] = [];
    const err: string[] = [];

    const [projectRoot] = resolve_project_root(null, { cwd: opts.cwd });
    const configPath = path.join(projectRoot, 'mcp.json');

    let declared: DeclaredServer[] = [];
    let configExists = true;
    let rawText: string;
    try {
        rawText = fs.readFileSync(configPath, 'utf-8');
    } catch {
        configExists = false;
        rawText = '';
    }

    if (configExists) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(rawText);
        } catch (exc) {
            err.push(
                `❌  mcp:available — ${configPath} exists but is not valid JSON.`,
                `    ${exc instanceof Error ? exc.message : String(exc)}`,
                '    Refusing to report "no servers": an unparseable declaration file is a',
                '    failure to answer, not an answer.',
            );
            return { code: 1, out, err };
        }
        const servers =
            typeof parsed === 'object' && parsed !== null
                ? ((parsed as { servers?: unknown }).servers ?? {})
                : {};
        if (typeof servers === 'object' && servers !== null && !Array.isArray(servers)) {
            declared = Object.keys(servers)
                .sort()
                .map((name) =>
                    classifyServer(
                        name,
                        (servers as Record<string, RawServerEntry>)[name] ?? {},
                        opts.pathEnv,
                        projectRoot,
                    ),
                );
        }
    }

    const registryTools = list_tools().map((t) => t.name).sort();

    if (opts.json) {
        out.push(
            JSON.stringify(
                {
                    config: configExists ? configPath : null,
                    declared_servers: declared,
                    tool_registry: registryTools,
                    handshake_performed: false,
                },
                null,
                2,
            ),
        );
        return { code: 0, out, err };
    }

    out.push(`declared servers   ${configExists ? configPath : '— no mcp.json in this project'}`);
    if (declared.length === 0) {
        out.push('  none');
    }
    for (const s of declared) {
        const state =
            s.launch === 'launchable'
                ? `launchable — ${s.resolved ?? ''}`
                : s.launch === 'not-on-path'
                  ? `NOT on PATH — \`${s.target ?? ''}\` does not resolve to an executable`
                  : s.transport === 'url'
                    ? 'remote — declared, deliberately not probed'
                    : 'malformed entry — declares neither command nor url';
        out.push(`  ${s.name}   ${state}`);
    }

    out.push('');
    out.push('tool registry      static allowlist for skill `allowed_tools` — NOT MCP, not probed');
    out.push(`  ${registryTools.length > 0 ? registryTools.join(', ') : 'none'}`);

    out.push('');
    out.push('⚠️  No MCP handshake was performed. "launchable" means the command resolves to an');
    out.push('    executable on PATH — strictly weaker than "the server responds". Any list of');
    out.push('    TOOLS a server exposes can only come from a live session, never from here.');

    return { code: 0, out, err };
}

interface ParsedArgv {
    ok: boolean;
    message?: string;
    json?: boolean;
}

export function parseArgv(argv: readonly string[]): ParsedArgv {
    let json = false;
    for (const a of argv) {
        if (a === '--json') {
            json = true;
        } else if (a === '-h' || a === '--help') {
            return { ok: false, message: 'usage: agent-config mcp:available [--json]' };
        } else {
            return { ok: false, message: `unknown argument: ${a}` };
        }
    }
    return { ok: true, json };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const parsed = parseArgv(argv);
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message ?? 'usage error'}\n`);
        return 2;
    }
    const result = runMcpAvailable({
        cwd: process.cwd(),
        json: parsed.json === true,
        pathEnv: process.env['PATH'] ?? '',
    });
    for (const line of result.out) process.stdout.write(`${line}\n`);
    for (const line of result.err) process.stderr.write(`${line}\n`);
    return result.code;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
