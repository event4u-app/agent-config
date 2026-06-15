#!/usr/bin/env tsx
/**
 * File-backed memory status (no external backend).
 *
 * TypeScript twin of `src/agent-src/templates/scripts/memory_status.py`
 * (ADR-200, consumer-template memory; byte-identical to the dev-side
 * `src/scripts/memory_status.py`). The public API and CLI contract mirror
 * the Python original EXACTLY — same exported names (snake_case kept
 * deliberately), same exit codes, stdout/stderr split, byte-identical
 * messages and JSON shape. No behaviour changes.
 *
 * The optional `@event4u/agent-memory` package was removed; retrieval
 * (`scripts/memory_lookup.py`) and signal-writing (`scripts/memory_signal.py`)
 * are entirely file-backed now. `status()` / `health()` report the file
 * backend so the v1 retrieval-contract health envelope stays stable for
 * consumers (e.g. the MCP `memory_status` tool).
 *
 * Usage:
 *     memory_status                 # human-readable line
 *     memory_status --format json   # stable JSON
 *     memory_status --health        # v1 health envelope
 */

import process from 'node:process';
import { pathToFileURL } from 'node:url';

// Retrieval contract version served by the file-backed backend.
// Source of truth: internal/schemas/retrieval-v1.schema.json.
export const CONTRACT_VERSION = 1;
const _FILE_BACKEND_VERSION = '0.0.0-file';
const _FILE_BACKEND_FEATURES = ['file-fallback'] as const;

export interface Result {
    status: string;
    backend: string;
    reason: string;
    elapsed_ms: number;
}

/** Return the (constant) file-backend status. Never raises. */
export function status(_refresh = false): Result {
    return {
        status: 'file', // always "file" — no external backend
        backend: 'file',
        reason: 'file-backed memory (no external backend)',
        elapsed_ms: 0,
    };
}

/** Return a v1 retrieval-contract health envelope (file backend). */
export function health(_refresh = false): Record<string, unknown> {
    return {
        contract_version: CONTRACT_VERSION,
        status: 'ok',
        backend_version: _FILE_BACKEND_VERSION,
        features: [..._FILE_BACKEND_FEATURES],
    };
}

/** Mirror json.dumps(obj) — compact ", " / ": " separators, ensure_ascii. */
function _pyJsonDumps(value: unknown): string {
    return _escapeNonAscii(_pyCompactSeparators(JSON.stringify(value)));
}

function _pyCompactSeparators(json: string): string {
    let result = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < json.length; i += 1) {
        const ch = json[i] as string;
        result += ch;
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (!inString && (ch === ',' || ch === ':')) {
            result += ' ';
        }
    }
    return result;
}

function _escapeNonAscii(s: string): string {
    let out = '';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x7f) {
            for (let i = 0; i < ch.length; i += 1) {
                out += `\\u${ch.charCodeAt(i).toString(16).padStart(4, '0')}`;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

interface ParsedArgs {
    format: string;
    refresh: boolean;
    health: boolean;
}

const _PROG = 'memory_status.py';
const _USAGE = 'usage: memory_status.py [-h] [--format {text,json}] [--refresh] [--health]\n';

class _ExitError extends Error {
    constructor(readonly code: number) {
        super(`exit ${code}`);
    }
}

/** Mirror argparse error: print usage + "<prog>: error: <msg>" to stderr, exit 2. */
function _usageError(msg: string): never {
    process.stderr.write(_USAGE);
    process.stderr.write(`${_PROG}: error: ${msg}\n`);
    throw new _ExitError(2);
}

function _parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = { format: 'text', refresh: false, health: false };
    const checkFormat = (v: string): string => {
        if (v !== 'text' && v !== 'json') {
            _usageError(`argument --format: invalid choice: '${v}' (choose from 'text', 'json')`);
        }
        return v;
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const takeValue = (flag: string): string => {
            const v = argv[++i];
            if (v === undefined) {
                _usageError(`argument ${flag}: expected one argument`);
            }
            return v as string;
        };
        if (a === '--format') {
            args.format = checkFormat(takeValue('--format'));
        } else if (a.startsWith('--format=')) {
            args.format = checkFormat(a.slice('--format='.length));
        } else if (a === '--refresh') {
            args.refresh = true;
        } else if (a === '--health') {
            args.health = true;
        } else if (a === '-h' || a === '--help') {
            // --help is not a parity contract (per ADR-200); emit the usage block.
            process.stdout.write(_USAGE);
            throw new _ExitError(0);
        } else {
            _usageError(`unrecognized arguments: ${a}`);
        }
    }
    return args;
}

export function main(): number {
    const args = _parseArgs(process.argv.slice(2));
    if (args.health) {
        process.stdout.write(`${_pyJsonDumps(health())}\n`);
        return 0;
    }
    const r = status();
    if (args.format === 'json') {
        process.stdout.write(`${_pyJsonDumps(r)}\n`);
    } else {
        process.stdout.write(`  ℹ️  backend=${r.backend}  status=${r.status}  reason=${r.reason}\n`);
    }
    return 0;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (_isMain) {
    try {
        process.exitCode = main();
    } catch (e) {
        if (e instanceof _ExitError) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}
