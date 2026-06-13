#!/usr/bin/env node
/**
 * Tool Registry — manages available external tools and their permissions.
 *
 * TypeScript twin of `src/scripts/tool_registry.py` (ADR-094 — Python→TS
 * migration, Phase 8 / Wave 8e). The CLI contract is mirrored EXACTLY:
 * same flags (`--format text|json`, `--validate-tools [...]`), same exit
 * codes (0 on success / valid, 1 when validation finds errors), same
 * byte-identical text + JSON output (json.dumps indent=2), same emoji
 * prose. No behaviour changes.
 *
 * Responsibilities:
 * - Define available tools and their supported actions
 * - Validate tool declarations from skills
 * - Check tool permissions
 * - Report on tool usage across skills
 *
 * Usage:
 *     ./scripts-run src/scripts/tool_registry [--format text|json]
 *     ./scripts-run src/scripts/tool_registry --validate-skill SKILL_TOOLS
 */
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Definition of an available tool (mirrors the `ToolDefinition` dataclass). */
export interface ToolDefinition {
    name: string;
    description: string;
    supported_actions: ReadonlySet<string>;
    default_mode: string; // "read-only" or "read-write"
    requires_auth: boolean;
}

// --- Built-in tool definitions ---
export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
    github: {
        name: 'github',
        description: 'GitHub API — PRs, issues, files, commits',
        supported_actions: new Set([
            'read_pr',
            'read_issue',
            'create_pr',
            'list_files',
            'read_commit',
        ]),
        default_mode: 'read-only',
        requires_auth: true,
    },
    jira: {
        name: 'jira',
        description: 'Jira API — tickets, search, comments',
        supported_actions: new Set([
            'read_ticket',
            'search_tickets',
            'add_comment',
            'transition_ticket',
        ]),
        default_mode: 'read-only',
        requires_auth: true,
    },
};

/** Result of validating tool declarations (mirrors `ToolValidationResult`). */
export interface ToolValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/** Look up a tool by name. */
export function get_tool(name: string): ToolDefinition | null {
    return TOOL_REGISTRY[name] ?? null;
}

/** List all registered tools. */
export function list_tools(): ToolDefinition[] {
    return Object.values(TOOL_REGISTRY);
}

/** Tool-permission shape: `{ actions?: string[] }` per tool. */
export type ToolPermissions = Record<string, { actions?: string[] } & Record<string, unknown>>;

/** Validate tool declarations from a skill's execution block. */
export function validate_tool_declarations(
    allowed_tools: string[],
    tool_permissions?: ToolPermissions | null,
): ToolValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const tool_name of allowed_tools) {
        const tool_def = get_tool(tool_name);
        if (tool_def === null) {
            errors.push(`Tool '${tool_name}' is not registered in the tool registry`);
            continue;
        }

        // Check permissions if declared
        if (tool_permissions && tool_name in tool_permissions) {
            const perms = tool_permissions[tool_name];
            const actions = (perms?.actions ?? []) as string[];
            for (const action of actions) {
                if (!tool_def.supported_actions.has(action)) {
                    errors.push(`Tool '${tool_name}' does not support action '${action}'`);
                }
            }
        }
    }

    // Check for tools in permissions but not in allowed_tools
    if (tool_permissions) {
        for (const tool_name of Object.keys(tool_permissions)) {
            if (!allowed_tools.includes(tool_name)) {
                warnings.push(`Tool '${tool_name}' has permissions but is not in allowed_tools`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

// --- json.dumps(indent=2) parity -----------------------------------------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** Mirror `json.dumps(obj, indent=2)` (ensure_ascii=True default). */
function _jsonDumpsIndent2(obj: Json): string {
    const pad = '  ';

    function enc(value: Json, depth: number): string {
        if (value === null) {
            return 'null';
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'number') {
            return String(value);
        }
        if (typeof value === 'string') {
            return encStr(value);
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[]';
            }
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as { [k: string]: Json };
        const keys = Object.keys(o);
        if (keys.length === 0) {
            return '{}';
        }
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k]!, depth + 1),
        );
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }

    function encStr(s: string): string {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    }

    return enc(obj, 0);
}

/** Python `sorted(set)` — ascending codepoint order, like the .py default. */
function _sorted(values: Iterable<string>): string[] {
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

interface ParsedArgs {
    format: string;
    validate_tools: string[] | null;
}

/**
 * Mirror the .py argparse surface: `--format {text,json}` (default text)
 * and `--validate-tools` with `nargs="*"` (null when absent, [] when the
 * flag is given with no operands). On an argparse error, write a usage
 * line to stderr and exit 2 (the prose differs from CPython argparse but
 * the channel + exit code match; golden tests assert exit + non-empty
 * stderr only, per the migration contract).
 */
function parse_args(argv: readonly string[]): ParsedArgs {
    let format = 'text';
    let validate_tools: string[] | null = null;
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i]!;
        if (arg === '--format') {
            const value = argv[i + 1];
            if (value === undefined) {
                _argError('argument --format: expected one argument');
            }
            if (value !== 'text' && value !== 'json') {
                _argError(
                    `argument --format: invalid choice: '${value}' (choose from 'text', 'json')`,
                );
            }
            format = value as string;
            i += 2;
            continue;
        }
        if (arg.startsWith('--format=')) {
            const value = arg.slice('--format='.length);
            if (value !== 'text' && value !== 'json') {
                _argError(
                    `argument --format: invalid choice: '${value}' (choose from 'text', 'json')`,
                );
            }
            format = value;
            i += 1;
            continue;
        }
        if (arg === '--validate-tools') {
            // nargs="*" — consume following non-option tokens.
            validate_tools = [];
            i += 1;
            while (i < argv.length && !argv[i]!.startsWith('-')) {
                validate_tools.push(argv[i]!);
                i += 1;
            }
            continue;
        }
        _argError(`unrecognized arguments: ${arg}`);
    }
    return { format, validate_tools };
}

function _argError(message: string): never {
    process.stderr.write(
        `usage: tool_registry [-h] [--format {text,json}] [--validate-tools [VALIDATE_TOOLS ...]]\n`,
    );
    process.stderr.write(`tool_registry: error: ${message}\n`);
    process.exit(2);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);

    if (args.validate_tools !== null) {
        const result = validate_tool_declarations(args.validate_tools);
        if (args.format === 'json') {
            // asdict(result) → {valid, errors, warnings}
            process.stdout.write(
                _jsonDumpsIndent2({
                    valid: result.valid,
                    errors: result.errors,
                    warnings: result.warnings,
                }) + '\n',
            );
        } else {
            if (result.valid) {
                process.stdout.write(
                    `✅  All ${args.validate_tools.length} tool declarations are valid\n`,
                );
            } else {
                for (const e of result.errors) {
                    process.stdout.write(`❌  ${e}\n`);
                }
                for (const w of result.warnings) {
                    process.stdout.write(`⚠️  ${w}\n`);
                }
            }
        }
        return result.valid ? 0 : 1;
    }

    // List tools
    const tools = list_tools();
    if (args.format === 'json') {
        process.stdout.write(
            _jsonDumpsIndent2(
                tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    actions: _sorted(t.supported_actions),
                    default_mode: t.default_mode,
                    requires_auth: t.requires_auth,
                })),
            ) + '\n',
        );
    } else {
        process.stdout.write(`Registered tools: ${tools.length}\n\n`);
        for (const t of tools) {
            const actions = _sorted(t.supported_actions).join(', ');
            process.stdout.write(`  ${t.name} (${t.default_mode})\n`);
            process.stdout.write(`    ${t.description}\n`);
            process.stdout.write(`    Actions: ${actions}\n`);
            process.stdout.write(`\n`);
        }
    }
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
