#!/usr/bin/env tsx
/**
 * Host-agent tier detection — ADR-068 (TypeScript twin).
 *
 * TypeScript twin of `src/cli/python/workspace_hosts.py` (ADR-200, py2ts
 * migration). Byte-for-byte CLI parity with the Python original — same
 * subcommands, same exit codes, same `json.dumps(..., sort_keys=True)` output,
 * same fail-soft `detect()` shape, same `list` text format. No behaviour
 * changes — latent quirks are replicated, not fixed.
 *
 * The workspace shells out to a host agent per ADR-023. This module reports a
 * host's **effective tier** so the launcher knows whether the host is CLI-
 * drivable (Tier 1) or needs the inbox hand-off (Tier 3). Detection is
 * **deterministic and side-effect-free** — it never spawns a host CLI; it only
 * checks the inventory tier and whether the host's CLI is on PATH (`which`).
 *
 * `HOST_INVENTORY` mirrors the source-of-truth table in
 * `docs/contracts/host-agent-protocol.md`; `tests/test_workspace_hosts.py`
 * asserts the two agree, so the human-readable contract stays canonical without
 * fragile runtime markdown parsing (ADR-068 H1).
 *
 * Effective tier (ADR-068 H2): `1` iff the inventory tier is 1 **and** the CLI
 * is on PATH; otherwise `3` (the contract's fail-closed rule — a Tier-1 host
 * whose CLI is missing demotes to the inbox hand-off). An **unknown** host id
 * fails **soft** to Tier 3 with `known: false` (so a launcher never 500s on a
 * host string), while the `detect` CLI exits non-zero on an unknown id (so
 * tooling / tests catch typos — ADR-068 § unknown-host).
 *
 * CLI:
 *
 *     workspace_hosts.ts detect <host-id> [--json]
 *     workspace_hosts.ts list [--json]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

// --- JSON byte-parity (compact, ensure_ascii=True, sort_keys=True) ----------
//
// `json.dumps(obj, sort_keys=True)` (no indent) → default separators
// `(", ", ": ")`, every non-ASCII code point escaped to `\uXXXX`, keys sorted.

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else if (code < 0x7f) {
                    out += ch;
                } else if (code <= 0xffff) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    const v = code - 0x10000;
                    const hi = 0xd800 + (v >> 10);
                    const lo = 0xdc00 + (v & 0x3ff);
                    out +=
                        '\\u' +
                        hi.toString(16).padStart(4, '0') +
                        '\\u' +
                        lo.toString(16).padStart(4, '0');
                }
        }
    }
    return out + '"';
}

function _jsonScalarSorted(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

function _dumpSorted(value: unknown): string {
    const scalar = _jsonScalarSorted(value);
    if (scalar !== null) return scalar;
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _dumpSorted(v)).join(', ') + ']';
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        return (
            '{' +
            keys.map((k) => `${_jsonStrAscii(k)}: ${_dumpSorted(obj[k])}`).join(', ') +
            '}'
        );
    }
    return _jsonStrAscii(String(value));
}

/** `json.dumps(value, sort_keys=True)` (compact, ensure_ascii=True). */
function jsonDumpsSorted(value: unknown): string {
    return _dumpSorted(value);
}

function print(line = ''): void {
    process.stdout.write(line + '\n');
}

/** `shutil.which(cmd)` — first match on PATH; null if not found. */
function which(cmd: string): string | null {
    const sep = process.platform === 'win32' ? ';' : ':';
    const pathenv = process.env['PATH'] ?? '';
    const exts =
        process.platform === 'win32'
            ? (process.env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD').split(';')
            : [''];
    // An absolute / relative path with a separator is checked directly.
    if (cmd.includes(path.sep) || (process.platform === 'win32' && cmd.includes('/'))) {
        for (const ext of exts) {
            const cand = cmd + ext;
            if (_isExecFile(cand)) return cand;
        }
        return null;
    }
    for (const dir of pathenv.split(sep)) {
        if (dir === '') continue;
        for (const ext of exts) {
            const cand = path.join(dir, cmd + ext);
            if (_isExecFile(cand)) return cand;
        }
    }
    return null;
}

function _isExecFile(p: string): boolean {
    try {
        const st = fs.statSync(p);
        if (!st.isFile()) return false;
        if (process.platform === 'win32') return true;
        fs.accessSync(p, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Module body (workspace_hosts.py).
// ---------------------------------------------------------------------------

interface InventoryEntry {
    tier: number;
    cli: string | null;
}

// Mirrors docs/contracts/host-agent-protocol.md § Today's inventory. `cli` is
// the PATH binary that proves the Tier-1 surface is reachable; Tier-3 hosts
// have no drivable CLI (null). Insertion order matches the Python dict.
export const HOST_INVENTORY: Record<string, InventoryEntry> = {
    'claude-code': { tier: 1, cli: 'claude' },
    codex: { tier: 1, cli: 'codex' },
    gemini: { tier: 1, cli: 'gemini' },
    augment: { tier: 3, cli: null },
    cursor: { tier: 3, cli: null },
    cline: { tier: 3, cli: null },
    windsurf: { tier: 3, cli: null },
};

type WhichFn = (cmd: string) => string | null;

/**
 * Resolve a host id → effective-tier classification.
 *
 * Never raises. Unknown id → fail-soft to Tier 3 with `known: false`.
 * `whichFn` is injectable for tests.
 */
export function detect(
    host_id: string,
    opts?: { which?: WhichFn },
): Record<string, unknown> {
    const whichFn = opts?.which ?? which;
    const entry = HOST_INVENTORY[host_id];
    if (entry === undefined) {
        return {
            host: host_id,
            known: false,
            inventory_tier: null,
            cli: null,
            cli_present: false,
            effective_tier: 3,
            mode: 'handoff',
        };
    }
    const cli = entry.cli;
    const cli_present = Boolean(cli) && whichFn(cli as string) !== null;
    const effective = entry.tier === 1 && cli_present ? 1 : 3;
    // Honest mode: Tier-1-with-CLI would be drivable, but the drive loop is
    // unbuilt — so report 'tier1-drive-pending', never a fake 'driven'. Tier-3
    // (or demoted) → 'handoff' (the inbox path).
    let mode: string;
    if (effective === 1) {
        mode = 'tier1-drive-pending';
    } else {
        mode = 'handoff';
    }
    return {
        host: host_id,
        known: true,
        inventory_tier: entry.tier,
        cli,
        cli_present,
        effective_tier: effective,
        mode,
    };
}

interface ParsedArgs {
    cmd: string;
    host_id?: string;
    json: boolean;
}

const PROG = 'workspace_hosts';

const USAGE = `usage: ${PROG} [-h] {detect,list} ...\n`;
const USAGE_DETECT = `usage: ${PROG} detect [-h] [--json] host_id\n`;
const USAGE_LIST = `usage: ${PROG} list [-h] [--json]\n`;

function _argError(usage: string, prog: string, msg: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${prog}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): ParsedArgs {
    let i = 0;
    // Top-level -h/--help before the subcommand.
    if (i < argv.length && (argv[i] === '-h' || argv[i] === '--help')) {
        process.stdout.write(USAGE);
        throw new ArgparseExit(0);
    }
    if (i >= argv.length) {
        _argError(USAGE, PROG, 'the following arguments are required: cmd');
    }
    const cmd = argv[i] as string;
    i += 1;
    if (cmd !== 'detect' && cmd !== 'list') {
        _argError(
            USAGE,
            PROG,
            `argument cmd: invalid choice: '${cmd}' (choose from 'detect', 'list')`,
        );
    }
    const subUsage = cmd === 'detect' ? USAGE_DETECT : USAGE_LIST;
    const subProg = `${PROG} ${cmd}`;
    const out: ParsedArgs = { cmd, json: false };
    const positionals: string[] = [];
    // argparse collects every arg the subparser cannot consume and reports the
    // whole leftover list against the TOP-LEVEL parser as "unrecognized
    // arguments". Order is preserved.
    const unrecognized: string[] = [];
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(subUsage);
            throw new ArgparseExit(0);
        }
        if (a === '--json') {
            out.json = true;
            i += 1;
            continue;
        }
        if (a.startsWith('-') && a !== '-') {
            unrecognized.push(a);
            i += 1;
            continue;
        }
        positionals.push(a);
        i += 1;
    }
    if (cmd === 'detect') {
        if (positionals.length < 1 && unrecognized.length === 0) {
            _argError(subUsage, subProg, 'the following arguments are required: host_id');
        }
        if (positionals.length < 1) {
            // host_id never satisfied, but leftover flags exist → argparse
            // still demands the positional first (sub-parser error).
            _argError(subUsage, subProg, 'the following arguments are required: host_id');
        }
        out.host_id = positionals[0] as string;
        const extra = [...positionals.slice(1), ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    } else {
        const extra = [...positionals, ...unrecognized];
        if (extra.length > 0) {
            _argError(USAGE, PROG, `unrecognized arguments: ${extra.join(' ')}`);
        }
    }
    return out;
}

export function main(argv: string[]): number {
    const args = _parse(argv);
    if (args.cmd === 'detect') {
        const result = detect(args.host_id as string);
        print(jsonDumpsSorted(result));
        // Fail-loud for tooling/tests: an unknown host id is almost always a
        // typo or a missing inventory row. The detect() function stays
        // fail-soft for in-process launcher callers.
        return result['known'] ? 0 : 1;
    }
    if (args.cmd === 'list') {
        const rows = Object.keys(HOST_INVENTORY)
            .sort()
            .map((h) => detect(h));
        if (args.json) {
            print(jsonDumpsSorted(rows));
        } else {
            print(
                rows
                    .map(
                        (r) =>
                            `${r['host']}\ttier${r['inventory_tier']}\t` +
                            `${r['cli_present'] ? 'cli' : 'no-cli'}`,
                    )
                    .join('\n'),
            );
        }
        return 0;
    }
    return 2;
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
        } else {
            throw e;
        }
    }
}

export { ArgparseExit, jsonDumpsSorted, which };
