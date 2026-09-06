#!/usr/bin/env node
/**
 * `agent-config handoff` — pick a recent session, generate a handoff,
 * seed a fresh session (road-to-agent-handoff-resume Phase 4).
 *
 * Default TTY flow: numbered picker over the unified session list
 * (chat-history primary; Claude-transcript + Codex-session adapters),
 * then the Phase-2 deterministic generator writes
 * `agents/runtime/state/handoff-context.md`, which the Phase-3
 * session_start hook injects into the NEXT session exactly once.
 *
 * Flags:
 *   --list             print the sessions and exit
 *   --json             with --list: machine-readable output
 *   --session <id>     skip the picker (exact id or unique prefix)
 *   --print            emit the handoff to stdout instead of the state
 *                      file (legacy copy-paste mode)
 *   --launch <host>    spawn a fresh interactive host session after
 *                      generating (claude: hook-seeded; codex: handoff as
 *                      initial prompt — this package binds no hook there)
 *   --llm              narrative-polish seam; v1: clear not-implemented error
 *   --root <path>      repo root override (default: cwd)
 *
 * Exit codes: 0 ok · 1 no sessions / session not found · 2 invocation error
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import process from 'node:process';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    build_handoff,
    handoff_target_path,
    LlmPolishNotImplementedError,
    write_handoff,
} from './handoff_generate.js';
import { list_handoff_sessions } from './handoff_sessions.js';
import type { HandoffSession } from './handoff_sessions.js';

const PROG = 'agent-config handoff';
const USAGE = `usage: ${PROG} [--list] [--json] [--session <id>] [--print] [--launch <host>] [--llm] [--root <path>]`;

const _HELP = `${USAGE}

Pick a recent session, generate a deterministic handoff, and seed a fresh
session with it. Without flags (in a TTY): numbered picker, then the handoff
lands in agents/runtime/state/handoff-context.md and auto-injects into the
next session on hook-capable hosts.

options:
  --list             print the recent sessions and exit
  --json             with --list: JSON output
  --session <id>     generate for this session id (exact or unique prefix)
  --print            print the handoff to stdout (no state file)
  --launch <host>    start a fresh interactive session (claude | codex)
  --llm              optional LLM polish — not implemented in v1
  --root <path>      repo root (default: current directory)
  -h, --help         show this help

exit codes:
  0  handoff generated (or list printed)
  1  no sessions found / session id not found
  2  invocation error (bad flag, non-TTY without --session, unsupported host)
`;

class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`exit ${code}`);
    }
}

// ---------------------------------------------------------------------
// launch adapter table (v1: claude + codex live, gemini stubbed)
// ---------------------------------------------------------------------

export interface LaunchAdapter {
    supports_launch: boolean;
    /** 'hook' = state file + session_start injection; 'initial-prompt' = argv. */
    seeding: 'hook' | 'initial-prompt';
    build_argv: (handoffText: string) => string[];
}

export const LAUNCH_ADAPTERS: Record<string, LaunchAdapter> = {
    claude: {
        supports_launch: true,
        seeding: 'hook',
        build_argv: () => ['claude'],
    },
    codex: {
        // Codex is a bundle host without hooks — seed via the initial prompt.
        supports_launch: true,
        seeding: 'initial-prompt',
        build_argv: (handoffText: string) => ['codex', handoffText],
    },
    gemini: {
        supports_launch: false,
        seeding: 'hook',
        build_argv: () => ['gemini'],
    },
};

// ---------------------------------------------------------------------
// options + seams
// ---------------------------------------------------------------------

export interface Opts {
    list: boolean;
    json: boolean;
    session: string | null;
    print: boolean;
    launch: string | null;
    llm: boolean;
    root: string | null;
}

type Runner = (cmd: string[]) => number;

export interface MainOptions {
    out?: (text: string) => void;
    err?: (text: string) => void;
    /** TTY availability override (default: stdin AND stdout are TTYs). */
    isTTY?: boolean;
    /** Picker input; returns the raw line or null on read failure. */
    readLine?: (prompt: string) => string | null;
    /** Interactive child spawn (default: spawnSync stdio-inherit). */
    runner?: Runner;
}

function _default_runner(cmd: string[]): number {
    const r = spawnSync(cmd[0] as string, cmd.slice(1), { stdio: 'inherit' });
    if (r.error) {
        process.stderr.write(`${PROG}: cannot run ${cmd[0]}: ${String(r.error)}\n`);
        return 127;
    }
    return r.status ?? 1;
}

/**
 * Synchronous /dev/tty line read (never fd 0 — EAGAIN under go-task
 * `interactive: true` silently auto-aborts a fd-0 prompt).
 */
function _tty_read_line(prompt: string): string | null {
    try {
        process.stdout.write(prompt);
        const fd = fs.openSync('/dev/tty', 'rs');
        try {
            const buf = Buffer.alloc(1);
            let line = '';
            for (;;) {
                let n = 0;
                try {
                    n = fs.readSync(fd, buf, 0, 1, null);
                } catch (exc) {
                    const code = (exc as NodeJS.ErrnoException).code;
                    if (code === 'EAGAIN' || code === 'EINTR') continue;
                    return null;
                }
                if (n === 0) break;
                const ch = buf.toString('utf-8');
                if (ch === '\n') break;
                line += ch;
            }
            return line;
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------
// arg parsing (hand-rolled, house style — no commander in _cli/)
// ---------------------------------------------------------------------

function _argError(err: (t: string) => void, message: string): never {
    err(`${USAGE}\n${PROG}: error: ${message}\n`);
    throw new ArgparseExit(2);
}

export function _parse(argv: string[], err: (t: string) => void): Opts {
    const opts: Opts = {
        list: false,
        json: false,
        session: null,
        print: false,
        launch: null,
        llm: false,
        root: null,
    };
    let i = 0;
    const takeValue = (flag: string): string => {
        const arg = argv[i] as string;
        const eq = arg.indexOf('=');
        if (eq >= 0) return arg.slice(eq + 1);
        i += 1;
        const value = argv[i];
        if (value === undefined) _argError(err, `argument ${flag}: expected one argument`);
        return value;
    };
    while (i < argv.length) {
        const arg = argv[i] as string;
        const flag = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
        switch (flag) {
            case '-h':
            case '--help':
                process.stdout.write(_HELP);
                throw new ArgparseExit(0);
            case '--list':
                opts.list = true;
                break;
            case '--json':
                opts.json = true;
                break;
            case '--print':
                opts.print = true;
                break;
            case '--llm':
                opts.llm = true;
                break;
            case '--session':
                opts.session = takeValue('--session');
                break;
            case '--launch':
                opts.launch = takeValue('--launch');
                break;
            case '--root':
                opts.root = takeValue('--root');
                break;
            default:
                _argError(err, `unrecognized arguments: ${arg}`);
        }
        i += 1;
    }
    return opts;
}

// ---------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------

function _fmt_date(iso: string | null): string {
    if (!iso) return 'unknown-date';
    return iso.slice(0, 16).replace('T', ' ');
}

export function render_session_line(s: HandoffSession, index: number): string {
    const branch = s.branch ? ` · ${s.branch}` : '';
    return `${String(index + 1).padStart(2)}. ${_fmt_date(s.endedAt ?? s.startedAt)} · ${s.source}${branch} · ${s.summary}`;
}

function _render_list(sessions: HandoffSession[], json: boolean): string {
    if (json) return JSON.stringify(sessions, null, 2) + '\n';
    return sessions.map((s, i) => render_session_line(s, i)).join('\n') + '\n';
}

// ---------------------------------------------------------------------
// main
// ---------------------------------------------------------------------

export function main(argv: string[] | null = null, options: MainOptions = {}): number {
    const out = options.out ?? ((t: string): void => void process.stdout.write(t));
    const err = options.err ?? ((t: string): void => void process.stderr.write(t));
    const isTTY = options.isTTY ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
    const readLine = options.readLine ?? _tty_read_line;
    const runner = options.runner ?? _default_runner;

    let opts: Opts;
    try {
        opts = _parse(argv ?? process.argv.slice(2), err);
    } catch (exc) {
        if (exc instanceof ArgparseExit) return exc.code;
        throw exc;
    }

    // The bash dispatcher strips a global `--root` and exports it as
    // AGENT_CONFIG_PROJECT_ROOT instead — honor both channels.
    const envRoot =
        process.env.AGENT_CONFIG_ROOT_OVERRIDE === '1'
            ? process.env.AGENT_CONFIG_PROJECT_ROOT || null
            : null;
    const root = path.resolve(opts.root ?? envRoot ?? process.cwd());
    const sessions = list_handoff_sessions({ cwd: root });

    if (opts.list) {
        if (sessions.length === 0) {
            out('no recent sessions found for this repo\n');
            return 1;
        }
        out(_render_list(sessions, opts.json));
        return 0;
    }

    if (sessions.length === 0) {
        err(`${PROG}: no recent sessions found for this repo\n`);
        return 1;
    }

    if (opts.launch && !(opts.launch in LAUNCH_ADAPTERS)) {
        err(`${USAGE}\n${PROG}: error: unknown --launch host '${opts.launch}' (claude | codex)\n`);
        return 2;
    }
    const adapter = opts.launch ? (LAUNCH_ADAPTERS[opts.launch] as LaunchAdapter) : null;
    if (opts.launch && adapter && !adapter.supports_launch) {
        err(`${PROG}: --launch ${opts.launch} is not supported yet (hook injection already works there)\n`);
        return 2;
    }

    // resolve the session — flag, or picker in a TTY
    let picked: HandoffSession | undefined;
    if (opts.session) {
        const matches = sessions.filter((s) => s.id === opts.session || s.id.startsWith(opts.session as string));
        if (matches.length === 0) {
            err(`${PROG}: session '${opts.session}' not found — run --list\n`);
            return 1;
        }
        if (matches.length > 1) {
            err(`${PROG}: session prefix '${opts.session}' is ambiguous (${matches.length} matches)\n`);
            return 2;
        }
        picked = matches[0];
    } else if (isTTY) {
        out('Recent sessions:\n');
        out(_render_list(sessions, false));
        const raw = readLine(`Pick a session [1-${sessions.length}]: `);
        const n = Number((raw ?? '').trim());
        if (!Number.isInteger(n) || n < 1 || n > sessions.length) {
            err(`${PROG}: invalid selection\n`);
            return 2;
        }
        picked = sessions[n - 1];
    } else {
        out(_render_list(sessions, false));
        err(`${PROG}: non-interactive invocation needs --session <id> (list above)\n`);
        return 2;
    }
    if (!picked) return 2;

    let text: string;
    try {
        text = build_handoff(picked, { cwd: root, llm: opts.llm });
    } catch (exc) {
        if (exc instanceof LlmPolishNotImplementedError) {
            err(`${PROG}: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    if (opts.print) {
        out(text);
        return 0;
    }

    if (adapter && adapter.seeding === 'initial-prompt') {
        // no state file on this path — nothing would consume it
        out(`launching ${opts.launch} with the handoff as initial prompt…\n`);
        return runner(adapter.build_argv(text));
    }

    // Only the most recent handoff persists — a second `handoff` run before
    // the next session start replaces the unconsumed file (by design; the
    // hook consumes exactly one).
    const existed = fs.existsSync(handoff_target_path(root));
    const target = write_handoff(text, { cwd: root });
    if (existed) out('note: replaced an unconsumed handoff — only the most recent one persists.\n');
    out(`handoff written: ${target}\n`);
    out('start a new session — the handoff will be injected automatically (hook-capable hosts).\n');

    if (adapter) {
        out(`launching ${opts.launch}…\n`);
        return runner(adapter.build_argv(text));
    }
    return 0;
}

// ---------------------------------------------------------------------
// entry guard (symlink-safe; same shape as cmd_analyze_session.ts —
// under the cli-delegate bundle the argv-URL compare matches the bundle)
// ---------------------------------------------------------------------

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // Symlinked invocation (installed projection, /var → /private/var):
    // compare realpaths so the entry guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
