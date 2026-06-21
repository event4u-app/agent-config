#!/usr/bin/env tsx
/**
 * Lint that every command in `hooks/hooks.json` resolves to a real
 * dispatcher subcommand in `scripts/_dispatch.bash`.
 *
 * TypeScript twin of `src/scripts/lint_marketplace_install_completeness.py`
 * (ADR-200, Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY —
 * `--hooks-json` / `--dispatch-bash` flags, exit codes (0 clean, 1 unknown
 * subcommand, 2 schema/file error), stdout/stderr split, byte-identical
 * finding messages, same command-extraction regexes and scan order.
 *
 * Phase 6 of `road-to-hooks-actually-fire-in-consumers`.
 *
 * The linter checks plugin-side completeness — the package ships a valid
 * `hooks.json` whose every command line points at a subcommand the
 * dispatcher knows about. It does NOT check consumer-side scaffolding.
 *
 * Exit codes:
 *   0 — every command resolves; clean.
 *   1 — at least one command references an unknown subcommand.
 *   2 — schema / file error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/lint_marketplace_install_completeness.ts → two dirs up is the
// repo root. Mirrors `Path(__file__).resolve().parent.parent.parent`.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const HOOKS_JSON = path.join(REPO_ROOT, 'hooks', 'hooks.json');
const DISPATCH_BASH = path.join(REPO_ROOT, 'src', 'scripts', '_dispatch.bash');

/**
 * Map agent-config-cli subcommand → dispatcher function name. The
 * subcommand is what appears after `./agent-config <subcommand>` in the
 * hooks.json command line; the function is what's defined in
 * _dispatch.bash. The user-facing subcommand uses colons; the function uses
 * underscores (e.g. `dispatch:hook` → `cmd_dispatch_hook`).
 */
function subcommand_to_function(subcommand: string): string {
    const sanitised = subcommand.replaceAll(':', '_').replaceAll('-', '_');
    return `cmd_${sanitised}`;
}

// Pattern A: `"$CLAUDE_PROJECT_DIR"/agent-config <subcommand> [args...]`.
// Accepts both quoted and bare CLAUDE_PROJECT_DIR.
const _CMD_RE = /(?:"?\$\{?CLAUDE_PROJECT_DIR\}?"?\/)?agent-config\s+([a-zA-Z0-9:_-]+)/;
// Pattern B (ADR-020 global-binary fallback wrapper).
const _BIN_CMD_RE = /"\$\{?BIN\}?"\s+([a-zA-Z0-9:_-]+)/;

/** Return [(event_name, command_line)] for every hook entry. */
function load_hook_commands(hooks_path: string): Array<[string, string]> {
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(hooks_path, 'utf-8'));
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        throw new SystemExit(`lint-marketplace-install: cannot read ${hooks_path}: ${msg}`);
    }

    const hooks = (isPlainObject(data) ? (data as Record<string, unknown>)['hooks'] : null) ?? {};
    if (!isPlainObject(hooks)) {
        throw new SystemExit(`lint-marketplace-install: ${hooks_path} \`hooks\` is not an object`);
    }

    const out: Array<[string, string]> = [];
    for (const [event, groups] of Object.entries(hooks as Record<string, unknown>)) {
        if (!Array.isArray(groups)) {
            continue;
        }
        for (const group of groups) {
            if (!isPlainObject(group)) {
                continue;
            }
            const entries = (group as Record<string, unknown>)['hooks'];
            if (!Array.isArray(entries)) {
                continue;
            }
            for (const entry of entries) {
                if (!isPlainObject(entry)) {
                    continue;
                }
                const cmd = (entry as Record<string, unknown>)['command'];
                if (typeof cmd === 'string' && cmd.trim()) {
                    out.push([String(event), cmd]);
                }
            }
        }
    }
    return out;
}

/** Pull the agent-config subcommand out of a hooks.json command line. */
function extract_subcommand(command_line: string): string | null {
    const m = _CMD_RE.exec(command_line);
    if (m) {
        return m[1] as string;
    }
    if (command_line.includes('agent-config')) {
        const m2 = _BIN_CMD_RE.exec(command_line);
        if (m2) {
            return m2[1] as string;
        }
    }
    return null;
}

/** Return the set of subcommand identifiers the dispatcher knows. */
function load_dispatcher_subcommands(dispatch_path: string): Set<string> {
    let text: string;
    try {
        text = fs.readFileSync(dispatch_path, 'utf-8');
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        throw new SystemExit(`lint-marketplace-install: cannot read ${dispatch_path}: ${msg}`);
    }

    const out = new Set<string>();
    const re = /^cmd_([a-zA-Z0-9_]+)\(\)/gm;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
        const ident = match[1] as string;
        out.add(ident);
        if (ident.includes('_')) {
            const idx = ident.indexOf('_');
            const head = ident.slice(0, idx);
            const tail = ident.slice(idx + 1);
            out.add(`${head}:${tail}`);
        }
    }
    return out;
}

function lint(
    hooks_path: string = HOOKS_JSON,
    dispatch_path: string = DISPATCH_BASH,
): number {
    if (!_isFile(hooks_path)) {
        process.stderr.write(`lint-marketplace-install: ${hooks_path} not found\n`);
        return 2;
    }
    if (!_isFile(dispatch_path)) {
        process.stderr.write(`lint-marketplace-install: ${dispatch_path} not found\n`);
        return 2;
    }

    const commands = load_hook_commands(hooks_path);
    const known = load_dispatcher_subcommands(dispatch_path);

    const issues: string[] = [];
    let checked = 0;
    for (const [event, cmd] of commands) {
        const sub = extract_subcommand(cmd);
        if (sub === null) {
            issues.push(
                `  ${event}: command does not reference \`agent-config <subcommand>\`: ` +
                    `${_pyRepr(cmd)}`,
            );
            continue;
        }
        checked += 1;
        if (!known.has(sub)) {
            issues.push(
                `  ${event}: unknown_dispatcher_subcommand: ${_pyRepr(sub)} ` +
                    `(not in scripts/_dispatch.bash)`,
            );
        }
    }

    if (issues.length) {
        let relative: string;
        const resolvedHooks = path.resolve(hooks_path);
        if (resolvedHooks.startsWith(REPO_ROOT + path.sep)) {
            relative = path.relative(REPO_ROOT, resolvedHooks);
        } else {
            relative = hooks_path;
        }
        process.stderr.write(
            `lint-marketplace-install: ${issues.length} issue(s) in ${relative}:\n`,
        );
        for (const line of issues) {
            process.stderr.write(line + '\n');
        }
        return 1;
    }

    process.stdout.write(
        `✅  lint-marketplace-install: ${checked} hook command(s) checked, ` +
            `all resolve to known dispatcher subcommands.\n`,
    );
    return 0;
}

// --- helpers --------------------------------------------------------------

class SystemExit extends Error {}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Mirror Python `repr(str)` for finding output: single-quoted. */
function _pyRepr(s: string): string {
    let out = "'";
    for (const ch of s) {
        if (ch === '\\') {
            out += '\\\\';
        } else if (ch === "'") {
            out += "\\'";
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else {
            out += ch;
        }
    }
    return out + "'";
}

interface Args {
    hooks_json: string;
    dispatch_bash: string;
}

function parse_args(argv: readonly string[]): Args {
    let hooks_json = HOOKS_JSON;
    let dispatch_bash = DISPATCH_BASH;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] as string;
        if (arg === '--hooks-json') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --hooks-json: expected one argument');
            }
            hooks_json = v;
        } else if (arg.startsWith('--hooks-json=')) {
            hooks_json = arg.slice('--hooks-json='.length);
        } else if (arg === '--dispatch-bash') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --dispatch-bash: expected one argument');
            }
            dispatch_bash = v;
        } else if (arg.startsWith('--dispatch-bash=')) {
            dispatch_bash = arg.slice('--dispatch-bash='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_marketplace_install_completeness [-h] ' +
                    '[--hooks-json HOOKS_JSON] [--dispatch-bash DISPATCH_BASH]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { hooks_json, dispatch_bash };
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_marketplace_install_completeness: error: ${message}\n`);
    process.exit(2);
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    try {
        return lint(args.hooks_json, args.dispatch_bash);
    } catch (exc) {
        if (exc instanceof SystemExit) {
            process.stderr.write(exc.message + '\n');
            return 1;
        }
        throw exc;
    }
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO_ROOT,
    HOOKS_JSON,
    DISPATCH_BASH,
    subcommand_to_function,
    load_hook_commands,
    extract_subcommand,
    load_dispatcher_subcommands,
    lint,
    parse_args,
    main,
};
