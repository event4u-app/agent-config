#!/usr/bin/env tsx
/**
 * `agent-config analyze-session` — post-session report from on-disk runtime
 * state.
 *
 * Read-only diagnostic. No daemon, no network, no model calls. It reads two
 * real data sources the work-engine / context-hygiene hook leave behind and
 * prints a deterministic Markdown report:
 *
 *   1. the work_engine state envelope `.work-state.json` (version 1) — loaded
 *      via `load_state` from `explain_last/state_loader.ts`. Fields read:
 *        - `changes`  — files touched (array of {kind, stack, file, summary}).
 *        - `outcomes` — directive → "success" / "blocked" / … .
 *        - `halts`    — array of recorded halts.
 *   2. `agents/runtime/state/context-hygiene.json` — fields read:
 *        - `tool_calls`           (int)
 *        - `consecutive_same_tool`(int)
 *        - `loop_detected`        (bool)
 *
 * There is NO general token/cost data source in this package (only
 * video-specific telemetry), so the report deliberately does NOT report
 * tokens or cost — it prints a single honest "not tracked" line instead.
 *
 * Exit codes (mirroring `cmd_explain`'s `last` subject):
 *   0  report rendered (even when a source file is absent — graceful note).
 *   1  the work-state file is missing or unreadable.
 *   2  invocation error (bad project root, bad --state-file path).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ProjectRootError, resolve_project_root } from '../_lib/agent_settings.js';
import { StateLoadError, load_state } from './explain_last/state_loader.js';

type Dict = Record<string, unknown>;

const _HERE = fileURLToPath(import.meta.url);

const CONTEXT_HYGIENE_RELATIVE = path.join(
    'agents',
    'runtime',
    'state',
    'context-hygiene.json',
);

/** Python `raise SystemExit(code)` analogue — propagates an explicit code. */
class SystemExitError extends Error {
    constructor(public readonly code: number) {
        super(`system-exit-${code}`);
    }
}

/** argparse-style usage / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

function eprint(line = ''): void {
    process.stderr.write(line + '\n');
}

function isPlainObject(value: unknown): value is Dict {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _resolve_root(arg: string | null): string {
    try {
        const [root] = resolve_project_root(arg, { cwd: process.cwd() });
        return root;
    } catch (exc) {
        if (exc instanceof ProjectRootError) {
            eprint(`❌  analyze-session: ${exc.message}`);
            throw new SystemExitError(2);
        }
        throw exc;
    }
}

/** `Path.relative_to(base)` — returns null when `p` is not under `base`. */
function relativeToOrNull(p: string, base: string): string | null {
    const rel = path.relative(base, p);
    if (rel === '') return rel;
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return rel;
}

/**
 * Read the context-hygiene snapshot. Returns the parsed object, or `null`
 * when the file is absent / unreadable / not an object — the caller renders
 * a graceful "not available" note rather than failing the whole report.
 */
function _load_context_hygiene(project_root: string): Dict | null {
    const p = path.join(project_root, CONTEXT_HYGIENE_RELATIVE);
    if (!fs.existsSync(p)) {
        return null;
    }
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return null;
    }
    let payload: unknown;
    try {
        payload = JSON.parse(text);
    } catch {
        return null;
    }
    return isPlainObject(payload) ? payload : null;
}

/** Render `value` as an integer string, or `'?'` when not a finite number. */
function intOrUnknown(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(Math.trunc(value));
    }
    return '?';
}

/**
 * Build the deterministic Markdown report from already-loaded state.
 *
 * Pure function — no I/O, no clock, no environment. Both inputs come from the
 * caller so the report is unit-testable in isolation.
 *
 * @param state    the parsed `.work-state.json` (version 1).
 * @param hygiene  the parsed context-hygiene snapshot, or `null` when absent.
 */
export function render_report(state: Dict, hygiene: Dict | null): string {
    const lines: string[] = [];
    lines.push('# Session analysis');
    lines.push('');

    // --- Files touched (from state.changes) ---
    const changes = Array.isArray(state['changes']) ? (state['changes'] as unknown[]) : [];
    lines.push(`## Files touched (${changes.length})`);
    lines.push('');
    if (changes.length === 0) {
        lines.push('_No files recorded as changed._');
    } else {
        for (const change of changes) {
            if (!isPlainObject(change)) continue;
            const file = typeof change['file'] === 'string' ? change['file'] : '(unknown file)';
            const summary =
                typeof change['summary'] === 'string' && change['summary'].length > 0
                    ? ` — ${change['summary']}`
                    : '';
            lines.push(`- \`${file}\`${summary}`);
        }
    }
    lines.push('');

    // --- Per-directive outcomes (from state.outcomes) ---
    const outcomes = isPlainObject(state['outcomes']) ? (state['outcomes'] as Dict) : {};
    const directives = Object.keys(outcomes).sort(); // deterministic order
    const blocked = directives.filter((d) => outcomes[d] === 'blocked');
    lines.push(`## Outcomes (${directives.length})`);
    lines.push('');
    if (directives.length === 0) {
        lines.push('_No directive outcomes recorded._');
    } else {
        for (const directive of directives) {
            const result = outcomes[directive];
            const marker = result === 'blocked' ? '⚠️ ' : '';
            lines.push(`- ${marker}\`${directive}\`: ${String(result)}`);
        }
    }
    lines.push('');
    if (blocked.length > 0) {
        lines.push(`**Blocked directives (${blocked.length}):** ${blocked.join(', ')}`);
        lines.push('');
    }

    // --- Halts (from state.halts) ---
    const halts = Array.isArray(state['halts']) ? (state['halts'] as unknown[]) : [];
    lines.push(`## Halts (${halts.length})`);
    lines.push('');
    if (halts.length === 0) {
        lines.push('_No halts recorded._');
    } else {
        lines.push(`This session recorded ${halts.length} halt(s).`);
    }
    lines.push('');

    // --- Tool activity (from context-hygiene) ---
    lines.push('## Tool activity');
    lines.push('');
    if (hygiene === null) {
        lines.push('_Context-hygiene snapshot not available._');
    } else {
        const toolCalls = intOrUnknown(hygiene['tool_calls']);
        const consecutive = intOrUnknown(hygiene['consecutive_same_tool']);
        const loop = hygiene['loop_detected'] === true;
        lines.push(`- Tool calls: ${toolCalls}`);
        lines.push(`- Consecutive same-tool calls: ${consecutive}`);
        lines.push(`- Loop detected: ${loop ? 'yes' : 'no'}`);
    }
    lines.push('');

    // --- Honest token/cost note (no per-session source in this package) ---
    lines.push('## Token / cost');
    lines.push('');
    lines.push('Token/cost: not tracked (no per-session source).');
    lines.push('');

    return lines.join('\n');
}

function _analyze_session(project_root: string, state_file: string | null): number {
    const target_state = state_file || path.join(project_root, '.work-state.json');
    let state: Dict;
    try {
        state = load_state(target_state) as Dict;
    } catch (exc) {
        if (exc instanceof StateLoadError) {
            // Never print absolute paths in errors (username leakage).
            const rel = relativeToOrNull(target_state, project_root);
            const shown = rel !== null ? rel : path.basename(target_state);
            const msg = exc.message.split(target_state).join(shown);
            eprint(`❌  analyze-session: ${msg}`);
            return exc.exitCode;
        }
        throw exc;
    }
    const hygiene = _load_context_hygiene(project_root);
    process.stdout.write(render_report(state, hygiene));
    return 0;
}

interface Opts {
    project: string | null;
    state_file: string | null;
}

const PROG = 'agent-config analyze-session';
const USAGE = `usage: ${PROG} [-h] [--project PROJECT] [--state-file STATE_FILE]\n`;

const _HELP = `\
usage: ${PROG} [--project PATH] [--state-file PATH]

Print a post-session report from on-disk runtime state. Read-only;
no daemon, no network, no model calls.

Sources read:
  .work-state.json (version 1)
    · changes  — files touched
    · outcomes — per-directive success / blocked
    · halts    — recorded halts
  agents/runtime/state/context-hygiene.json
    · tool_calls · consecutive_same_tool · loop_detected

Token/cost is NOT reported — this package has no per-session token
source (only video-specific telemetry).

options:
  --project PATH       project root (defaults to anchor walk from cwd)
  --state-file PATH    .work-state.json path (default <root>/.work-state.json)
  -h, --help           show this help and exit

exit codes:
  0  report rendered (a missing source file is noted, not fatal)
  1  no recent run found (state file missing or unreadable)
  2  invocation error (bad project root, bad --state-file path)
`;

function _argError(msg: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): Opts {
    const opts: Opts = { project: null, state_file: null };
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(_HELP);
            throw new ArgparseExit(0);
        }
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;
        if (flag === '--project' || flag === '--state-file') {
            const dest = flag === '--project' ? 'project' : 'state_file';
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) {
                    _argError(`argument ${flag}: expected one argument`);
                }
                value = argv[i + 1] as string;
                i += 1;
            }
            opts[dest] = value;
            i += 1;
            continue;
        }
        _argError(`unrecognized arguments: ${a}`);
    }
    return opts;
}

export function main(argv: string[] | null = null): number {
    const argv_list = argv !== null ? Array.from(argv) : process.argv.slice(2);
    const opts = _parse(argv_list);
    let project_root: string;
    try {
        project_root = _resolve_root(opts.project);
    } catch (exc) {
        if (exc instanceof SystemExitError) {
            return exc.code;
        }
        throw exc;
    }
    return _analyze_session(project_root, opts.state_file);
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else if (e instanceof SystemExitError) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}

export { _parse, _resolve_root, _load_context_hygiene, _analyze_session, ArgparseExit, SystemExitError };
export type { Opts };
