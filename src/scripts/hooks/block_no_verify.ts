#!/usr/bin/env tsx
/**
 * PreToolUse guard: block git --no-verify and hook-bypass patterns.
 *
 * TypeScript twin of `src/scripts/hooks/block_no_verify.py` (ADR-200,
 * Python→TypeScript migration). The CLI/stdin contract is mirrored EXACTLY —
 * `--command` / `--platform` argparse flags, the JSON-envelope-on-stdin shape,
 * shlex tokenisation (POSIX, no comments), the subcommand split on shell
 * separators, the fail-closed-on-parse-error-for-git behaviour, byte-identical
 * stderr block message, and exit codes (0 allow · 1 block; 2 = argparse error).
 * snake_case kept. No behaviour changes — latent quirks replicated.
 *
 * Intercepts the agent's Bash tool calls BEFORE git runs so that
 * `git --no-verify` / `git -n` / `git -c core.hooksPath=` cannot silently
 * bypass the pre-commit and pre-push hooks that enforce code quality gates.
 *
 * Exit codes (per docs/contracts/hook-architecture-v1.md):
 *   0 — allow (command is safe)
 *   1 — block (command would bypass hooks; agent is told to stop)
 *   2 — warn  (not used by this guard)
 *
 * No ALLOW_NO_VERIFY-style env bypass is provided. See src/rules/git-history-discipline.md
 */

import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';

const _HERE = fileURLToPath(import.meta.url);

const _SHELL_SEPARATORS: ReadonlySet<string> = new Set(['&&', '||', ';', '|']);
const _NO_VERIFY_FLAGS: ReadonlySet<string> = new Set(['--no-verify']);
const _NO_VERIFY_SHORT: ReadonlySet<string> = new Set(['-n']);
const _HOOKS_PATH_RE = /^core\.hooksPath\s*=/i;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

/**
 * Faithful port of `shlex.split(s, comments=False, posix=True)` for the
 * subset block_no_verify needs: whitespace tokenisation, single + double
 * quotes, backslash escaping (POSIX), and a `ValueError("No closing
 * quotation")` on an unterminated quote. `&&` / `|` / `;` are ordinary word
 * characters here (no `punctuation_chars`), so they survive as embedded
 * tokens exactly as CPython's shlex returns them — the separator split below
 * matches them as whole tokens.
 */
class ShlexError extends Error {}

function shlexSplit(s: string): string[] {
    const whitespace = ' \t\r\n\f\v';
    const quotes = '\'"';
    const escape = '\\';
    const escapedquotes = '"';

    const tokens: string[] = [];
    let token: string | null = null; // null => no token in progress (mirrors shlex token = '')
    let i = 0;
    const n = s.length;

    // shlex state: ' ' (whitespace), 'a' (in word), quote char (in quote),
    // or escape char (in escape). We track via explicit flags for clarity.
    let state: 'ws' | 'word' = 'ws';

    const push = (ch: string): void => {
        token = (token ?? '') + ch;
    };

    while (i < n) {
        const c = s[i] as string;

        if (state === 'ws') {
            if (whitespace.includes(c)) {
                i += 1;
                continue;
            }
            // start a new token
            state = 'word';
            token = '';
            // fall through to word handling without advancing
        }

        // state === 'word'
        if (whitespace.includes(c)) {
            tokens.push(token as string);
            token = null;
            state = 'ws';
            i += 1;
            continue;
        }
        if (quotes.includes(c)) {
            const quote = c;
            i += 1;
            // read until matching close quote
            let closed = false;
            while (i < n) {
                const qc = s[i] as string;
                if (qc === quote) {
                    closed = true;
                    i += 1;
                    break;
                }
                if (escape.includes(qc) && escapedquotes.includes(quote)) {
                    // POSIX: inside double quotes, backslash escapes only
                    // the escape char itself and the surrounding quote.
                    const nxt = i + 1 < n ? (s[i + 1] as string) : null;
                    if (nxt !== null && (nxt === escape || nxt === quote)) {
                        push(nxt);
                        i += 2;
                        continue;
                    }
                    push(qc);
                    i += 1;
                    continue;
                }
                push(qc);
                i += 1;
            }
            if (!closed) {
                throw new ShlexError('No closing quotation');
            }
            continue;
        }
        if (escape.includes(c)) {
            // POSIX escape outside quotes: backslash preserves the next char.
            const nxt = i + 1 < n ? (s[i + 1] as string) : null;
            if (nxt === null) {
                // shlex raises "No escaped character" at EOF; block_no_verify
                // does not exercise this, but mirror the error class.
                throw new ShlexError('No escaped character');
            }
            push(nxt);
            i += 2;
            continue;
        }
        push(c);
        i += 1;
    }

    if (token !== null) {
        tokens.push(token);
    }
    return tokens;
}

function _is_env_assignment(token: string): boolean {
    return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function _split_subcommands(tokens: string[]): string[][] {
    const groups: string[][] = [];
    let current: string[] = [];
    for (const tok of tokens) {
        if (_SHELL_SEPARATORS.has(tok)) {
            if (current.length) {
                groups.push(current);
            }
            current = [];
        } else {
            current.push(tok);
        }
    }
    if (current.length) {
        groups.push(current);
    }
    return groups;
}

function _git_base(tokens: string[]): string[] | null {
    let i = 0;
    while (i < tokens.length && _is_env_assignment(tokens[i] as string)) {
        i += 1;
    }
    if (i < tokens.length && tokens[i] === 'git') {
        return tokens.slice(i);
    }
    return null;
}

function _is_blocked(git_tokens: string[]): [boolean, string] {
    let i = 1; // skip 'git'
    while (i < git_tokens.length) {
        const tok = git_tokens[i] as string;
        if (_NO_VERIFY_FLAGS.has(tok)) {
            return [true, `'${tok}' bypasses git hooks (git-history-discipline)`];
        }
        if (_NO_VERIFY_SHORT.has(tok)) {
            return [
                true,
                `'${tok}' is short for --no-verify and bypasses git hooks (git-history-discipline)`,
            ];
        }
        // Short flag bundles containing 'n': -nm, -mn, etc.
        if (/^-[a-zA-Z]*n[a-zA-Z]*$/.test(tok) && !tok.startsWith('--')) {
            return [
                true,
                `'${tok}' contains -n (--no-verify) and bypasses git hooks (git-history-discipline)`,
            ];
        }
        if (tok === '-c') {
            if (i + 1 < git_tokens.length) {
                const val = git_tokens[i + 1] as string;
                if (_HOOKS_PATH_RE.test(val)) {
                    return [true, `'-c ${val}' disables git hooks via hooksPath (git-history-discipline)`];
                }
                i += 1;
            }
        } else if (tok.startsWith('-c=')) {
            const val = tok.slice(3);
            if (_HOOKS_PATH_RE.test(val)) {
                return [true, `'${tok}' disables git hooks via hooksPath (git-history-discipline)`];
            }
        } else if (tok === '--config') {
            if (i + 1 < git_tokens.length) {
                const val = git_tokens[i + 1] as string;
                if (_HOOKS_PATH_RE.test(val)) {
                    return [
                        true,
                        `'--config ${val}' disables git hooks via hooksPath (git-history-discipline)`,
                    ];
                }
                i += 1;
            }
        }
        i += 1;
    }
    return [false, ''];
}

/** Return (blocked, reason). Fail-closed on parse error for git commands. */
function _check_command(cmd: string): [boolean, string] {
    let tokens: string[];
    try {
        tokens = shlexSplit(cmd);
    } catch (e) {
        if (e instanceof ShlexError) {
            if (/\bgit\b/.test(cmd)) {
                return [
                    true,
                    'command parse failed (shlex) on a git-containing command — fail-closed (git-history-discipline)',
                ];
            }
            return [false, ''];
        }
        throw e;
    }

    for (const sub of _split_subcommands(tokens)) {
        const git_tokens = _git_base(sub);
        if (git_tokens === null) {
            continue;
        }
        const [blocked, reason] = _is_blocked(git_tokens);
        if (blocked) {
            return [true, reason];
        }
    }
    return [false, ''];
}

function _extract_command(envelope: JsonObject): string | null {
    const payload = (_asObject(envelope['payload']) ?? {}) as JsonObject;
    const tool_input = (_asObject(payload['tool_input']) ?? {}) as JsonObject;
    let cmd = tool_input['command'];
    if (typeof cmd === 'string') {
        return cmd;
    }
    cmd = payload['command'];
    if (typeof cmd === 'string') {
        return cmd;
    }
    return null;
}

function _asObject(v: JsonValue | undefined): JsonObject | null {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return v as JsonObject;
    }
    return null;
}

interface ParsedArgs {
    command: string;
    platform: string;
}

/**
 * Mirror argparse for `--command` / `--platform` (both string, default '').
 * Unknown argument → usage error on stderr + exit 2. `-h`/`--help` → usage on
 * stdout + exit 0. We never byte-compare --help prose per the migration brief.
 */
function _parseArgs(argv: string[]): { args?: ParsedArgs; exitCode?: number } {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(_usage());
        return { exitCode: 0 };
    }
    let command = '';
    let platform = '';
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '--command') {
            command = (argv[i + 1] as string) ?? '';
            i += 2;
            continue;
        }
        if (a.startsWith('--command=')) {
            command = a.slice('--command='.length);
            i += 1;
            continue;
        }
        if (a === '--platform') {
            platform = (argv[i + 1] as string) ?? '';
            i += 2;
            continue;
        }
        if (a.startsWith('--platform=')) {
            platform = a.slice('--platform='.length);
            i += 1;
            continue;
        }
        process.stderr.write(_usageError(a));
        return { exitCode: 2 };
    }
    return { args: { command, platform } };
}

function _usage(): string {
    return 'usage: block_no_verify.py [-h] [--command COMMAND] [--platform PLATFORM]\n';
}

function _usageError(arg: string): string {
    return (
        'usage: block_no_verify.py [-h] [--command COMMAND] [--platform PLATFORM]\n' +
        `block_no_verify.py: error: unrecognized arguments: ${arg}\n`
    );
}

function _readStdin(): string {
    // Mirror `sys.stdin.read() if not sys.stdin.isatty() else ""`.
    try {
        if (process.stdin.isTTY) {
            return '';
        }
        return fs.readFileSync(0, 'utf-8');
    } catch {
        return '';
    }
}

export function main(argv?: string[]): number {
    const parsed = _parseArgs(argv ?? process.argv.slice(2));
    if (parsed.exitCode !== undefined) {
        return parsed.exitCode;
    }
    const args = parsed.args as ParsedArgs;

    let cmd: string;
    if (args.command) {
        cmd = args.command;
    } else {
        const raw = _readStdin();
        let envelope: JsonObject = {};
        if (raw.trim()) {
            try {
                const obj = JSON.parse(raw) as JsonValue;
                envelope = (_asObject(obj) ?? {}) as JsonObject;
            } catch {
                envelope = {};
            }
        }
        cmd = _extract_command(envelope) ?? '';
    }

    if (!cmd) {
        return 0;
    }

    const [blocked, reason] = _check_command(cmd);
    if (blocked) {
        process.stderr.write(
            `block-no-verify: BLOCKED — ${reason}\n` +
                `  Legitimate bypass requires a human action outside the agent session:\n` +
                `  disable or remove the 'block-no-verify' entry in src/scripts/hook_manifest.yaml.\n` +
                `  Rule: src/rules/git-history-discipline.md\n`,
        );
        return 1; // EXIT_BLOCK
    }

    return 0; // EXIT_ALLOW
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export {
    _SHELL_SEPARATORS,
    _NO_VERIFY_FLAGS,
    _NO_VERIFY_SHORT,
    _HOOKS_PATH_RE,
    ShlexError,
    shlexSplit,
    _is_env_assignment,
    _split_subcommands,
    _git_base,
    _is_blocked,
    _check_command,
    _extract_command,
};
