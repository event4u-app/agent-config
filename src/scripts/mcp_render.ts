#!/usr/bin/env node
/**
 * MCP config renderer — one `mcp.json` → per-tool output files.
 *
 * TypeScript twin of `mcp_render.py` (Phase 8 / Wave 8g).
 *
 * Reads `mcp.json` at repo root (`{ "servers": { <name>: { command, args,
 * env, cwd } } }`), substitutes `${env:VAR}` placeholders from the
 * environment, and writes each target tool's concrete config format.
 *
 * Targets:
 *     .cursor/mcp.json                                       (in-project)
 *     .windsurf/mcp.json                                     (in-project)
 *     ~/.config/claude-desktop/claude_desktop_config.json    (user, opt-in)
 *
 * All targets use the same `mcpServers` top-level key. The source file uses
 * `servers` to keep our internal schema stable if a downstream format ever
 * diverges.
 *
 * Failure mode: unresolved `${env:VAR}` placeholders are collected first,
 * then reported together and a non-zero exit is raised. No target file is
 * written when any placeholder is missing.
 *
 * See docs/mcp.md for schema, usage, and worked examples.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const ENV_PLACEHOLDER = /\$\{env:([^}]+)\}/g;

// Project root defaults to the current working directory so the renderer
// works both for package maintainers (running from the package root via
// Taskfile) and for consumer projects (running via `./agent-config
// mcp:render` from their own repo root). Override with --project-root.
export function default_project_root(): string {
    return fs.realpathSync(process.cwd());
}

export function in_project_targets(projectRoot: string): Record<string, string> {
    return {
        cursor: path.join(projectRoot, '.cursor', 'mcp.json'),
        windsurf: path.join(projectRoot, '.windsurf', 'mcp.json'),
    };
}

// Mutable so tests can override (mirrors monkeypatch.setattr on the module
// constant in the Python test suite).
export const _claudeDesktop = {
    target: path.join(os.homedir(), '.config', 'claude-desktop', 'claude_desktop_config.json'),
};

/** Raised on a JSON / schema problem to mirror Python's `SystemExit(msg)`. */
export class RenderExit extends Error {}

/**
 * Recursively substitute `${env:VAR}` in strings.
 *
 * Missing variables are appended to `missing` as `[var_name, json_path]`
 * instead of raising, so a single run surfaces *all* gaps at once.
 */
export function substitute(
    value: unknown,
    jsonPath: string,
    missing: Array<[string, string]>,
): unknown {
    if (typeof value === 'string') {
        return value.replace(ENV_PLACEHOLDER, (match, name: string) => {
            const envValue = process.env[name];
            if (envValue === undefined) {
                missing.push([name, jsonPath]);
                return match;
            }
            return envValue;
        });
    }
    if (Array.isArray(value)) {
        return value.map((v, i) => substitute(v, `${jsonPath}[${i}]`, missing));
    }
    if (value !== null && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = substitute(v, `${jsonPath}.${k}`, missing);
        }
        return out;
    }
    return value;
}

export function load_source(source: string): Record<string, unknown> {
    if (!fs.existsSync(source)) {
        throw new RenderExit(`❌  Source file not found: ${source}`);
    }
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(source, 'utf-8'));
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        throw new RenderExit(`❌  Invalid JSON in ${source}: ${msg}`);
    }
    if (
        data === null ||
        typeof data !== 'object' ||
        Array.isArray(data) ||
        !('servers' in (data as Record<string, unknown>)) ||
        (data as Record<string, unknown>)['servers'] === null ||
        typeof (data as Record<string, unknown>)['servers'] !== 'object' ||
        Array.isArray((data as Record<string, unknown>)['servers'])
    ) {
        throw new RenderExit(`❌  ${source} must contain a top-level 'servers' object.`);
    }
    return data as Record<string, unknown>;
}

/** Return [rendered, missing]. Caller decides what to do on missing. */
export function render(
    data: Record<string, unknown>,
): [Record<string, unknown>, Array<[string, string]>] {
    const missing: Array<[string, string]> = [];
    const resolvedServers = substitute(data['servers'], 'servers', missing);
    return [{ mcpServers: resolvedServers }, missing];
}

export function format_missing_report(missing: Array<[string, string]>): string {
    const grouped = new Map<string, string[]>();
    for (const [name, p] of missing) {
        if (!grouped.has(name)) {
            grouped.set(name, []);
        }
        grouped.get(name)!.push(p);
    }
    const lines: string[] = [
        `❌  Unresolved \${env:VAR} placeholders (${grouped.size} variable(s)):`,
    ];
    for (const name of [...grouped.keys()].sort()) {
        lines.push(`  - ${name}  used at:`);
        for (const p of grouped.get(name)!) {
            lines.push(`      ${p}`);
        }
    }
    lines.push('\nSet the variable(s) in your environment and re-run.');
    return lines.join('\n');
}

/**
 * Mirror `json.dumps(content, indent=2, sort_keys=True)` for JSON-shaped
 * values. ensure_ascii defaults to True.
 */
function _pyJsonDumpsSorted(obj: unknown): string {
    return _dumpValue(obj, 0);
}

function _dumpValue(value: unknown, depth: number): string {
    const pad = '  '.repeat(depth);
    const padInner = '  '.repeat(depth + 1);
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return _dumpString(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => padInner + _dumpValue(v, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    const entries = Object.entries(value as Record<string, unknown>).sort((a, b) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    );
    if (entries.length === 0) return '{}';
    const items = entries.map(
        ([k, v]) => padInner + _dumpString(k) + ': ' + _dumpValue(v, depth + 1),
    );
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
}

function _dumpString(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0');
        else if (code < 0x7f) out += ch;
        else if (code <= 0xffff) out += '\\u' + code.toString(16).padStart(4, '0');
        else {
            const v = code - 0x10000;
            const hi = 0xd800 + (v >> 10);
            const lo = 0xdc00 + (v & 0x3ff);
            out += '\\u' + hi.toString(16).padStart(4, '0');
            out += '\\u' + lo.toString(16).padStart(4, '0');
        }
    }
    return out + '"';
}

export function write_target(p: string, content: Record<string, unknown>): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const serialized = _pyJsonDumpsSorted(content) + '\n';
    fs.writeFileSync(p, serialized, 'utf-8');
}

export function collect_targets(
    projectRoot: string,
    includeClaudeDesktop: boolean,
): Record<string, string> {
    const targets: Record<string, string> = { ...in_project_targets(projectRoot) };
    if (includeClaudeDesktop) {
        targets['claude-desktop'] = _claudeDesktop.target;
    }
    return targets;
}

interface ParsedArgs {
    source: string | null;
    projectRoot: string | null;
    claudeDesktop: boolean;
    check: boolean;
}

export function resolve_source(args: ParsedArgs, projectRoot: string): string {
    return args.source ? args.source : path.join(projectRoot, 'mcp.json');
}

/** Python `f"{name:16}"` — left-justify, pad to width 16. */
function _ljust(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function cmd_render(args: ParsedArgs): number {
    const projectRoot = args.projectRoot ? fs.realpathSync(args.projectRoot) : default_project_root();
    const data = load_source(resolve_source(args, projectRoot));
    const [rendered, missing] = render(data);
    if (missing.length > 0) {
        process.stderr.write(format_missing_report(missing) + '\n');
        return 1;
    }
    const targets = collect_targets(projectRoot, args.claudeDesktop);
    for (const [name, p] of Object.entries(targets)) {
        write_target(p, rendered);
        process.stdout.write(`✅  ${_ljust(name, 16)} → ${p}\n`);
    }
    return 0;
}

function cmd_check(args: ParsedArgs): number {
    const projectRoot = args.projectRoot ? fs.realpathSync(args.projectRoot) : default_project_root();
    const data = load_source(resolve_source(args, projectRoot));
    const [rendered, missing] = render(data);
    if (missing.length > 0) {
        process.stderr.write(format_missing_report(missing) + '\n');
        return 1;
    }
    const serialized = _pyJsonDumpsSorted(rendered) + '\n';
    const targets = collect_targets(projectRoot, args.claudeDesktop);
    const diffs: Array<[string, string]> = [];
    for (const [name, p] of Object.entries(targets)) {
        const actual = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
        if (actual !== serialized) {
            diffs.push([name, p]);
        }
    }
    if (diffs.length > 0) {
        process.stderr.write('❌  Targets out of date (run `./agent-config mcp:render`):\n');
        for (const [name, p] of diffs) {
            process.stderr.write(`  - ${name}: ${p}\n`);
        }
        return 1;
    }
    process.stdout.write('✅  All MCP targets match source.\n');
    return 0;
}

class ArgError extends Error {}

function _parseArgs(argv: string[]): ParsedArgs {
    let source: string | null = null;
    let projectRoot: string | null = null;
    let claudeDesktop = false;
    let check = false;
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '--source') {
            source = argv[i + 1] ?? null;
            if (source === null) throw new ArgError('argument --source: expected one argument');
            i += 2;
        } else if (a.startsWith('--source=')) {
            source = a.slice('--source='.length);
            i += 1;
        } else if (a === '--project-root') {
            projectRoot = argv[i + 1] ?? null;
            if (projectRoot === null) {
                throw new ArgError('argument --project-root: expected one argument');
            }
            i += 2;
        } else if (a.startsWith('--project-root=')) {
            projectRoot = a.slice('--project-root='.length);
            i += 1;
        } else if (a === '--claude-desktop') {
            claudeDesktop = true;
            i += 1;
        } else if (a === '--check') {
            check = true;
            i += 1;
        } else {
            throw new ArgError(`unrecognized arguments: ${a}`);
        }
    }
    return { source, projectRoot, claudeDesktop, check };
}

export function main(argv: string[] | null = null): number {
    let args: ParsedArgs;
    try {
        args = _parseArgs(argv ?? process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgError) {
            process.stderr.write(`mcp_render: ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    try {
        return args.check ? cmd_check(args) : cmd_render(args);
    } catch (e) {
        if (e instanceof RenderExit) {
            process.stderr.write(e.message + '\n');
            return 1;
        }
        throw e;
    }
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
