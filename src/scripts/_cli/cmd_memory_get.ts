#!/usr/bin/env tsx
/**
 * `agent-config memory:get` — CLI twin of the `memory_get` MCP tool
 * (`src/scripts/mcp_server/tools.ts` `_memoryGetHandler`, road-to-memory-
 * retrieval-economy Phase 1).
 *
 * Batch-fetches FULL memory entries by id — the second half of the
 * index-first retrieval workflow: `memory:lookup --detail index` returns
 * compact priced rows, this fetches ONLY the bodies actually needed, in one
 * call. Reuses the exact same shared function the MCP tool calls
 * (`memory_get_v1` in `../memory_lookup.js`) — no duplicated lookup logic.
 *
 * Unlike the MCP handler (which `chdir`s into the consumer root before
 * calling), this CLI relies on `agent-config`'s existing invariant that the
 * dispatcher never changes CWD — `memory_get_v1` resolves `agents/memory`
 * relative to `process.cwd()`, which is already the consumer's repo root.
 *
 * Usage: memory:get <id> [<id> ...] [--format text|json]
 * Exit codes:
 *   0 — every requested id was found.
 *   1 — at least one requested id was not found (unknown id).
 *   2 — usage error (no ids given, unrecognized flag, missing flag value).
 */
import process from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { memory_get_v1 } from '../memory_lookup.js';

const PROG = 'agent-config memory:get';
const USAGE = `usage: ${PROG} <id> [<id> ...] [--format text|json]\n`;

/** argparse-style usage / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

interface Opts {
    ids: string[];
    format: 'text' | 'json';
}

function _argError(msg: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): Opts {
    const opts: Opts = { ids: [], format: 'text' };
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(
                `${USAGE}\n` +
                    'Batch-fetch FULL memory entries by id — the second half of the\n' +
                    "index-first retrieval workflow (`memory:lookup --detail index`\n" +
                    'first, then `memory:get` the ids that justify the fetch).\n\n' +
                    'options:\n' +
                    '  --format text|json   output format (default: text)\n' +
                    '  -h, --help           show this help and exit\n\n' +
                    'exit codes:\n' +
                    '  0  every requested id was found\n' +
                    '  1  at least one requested id was not found\n' +
                    '  2  usage error\n',
            );
            throw new ArgparseExit(0);
        } else if (a === '--format') {
            const val = argv[i + 1];
            if (val === undefined) _argError('argument --format: expected one argument');
            if (val !== 'text' && val !== 'json') {
                _argError(`argument --format: invalid choice: '${val}' (choose from 'text', 'json')`);
            }
            opts.format = val;
            i += 2;
        } else if (a.startsWith('--format=')) {
            const val = a.slice('--format='.length);
            if (val !== 'text' && val !== 'json') {
                _argError(`argument --format: invalid choice: '${val}' (choose from 'text', 'json')`);
            }
            opts.format = val;
            i += 1;
        } else if (a.startsWith('--')) {
            _argError(`unrecognized arguments: ${a}`);
        } else {
            opts.ids.push(a);
            i += 1;
        }
    }
    if (opts.ids.length === 0) {
        _argError('at least one <id> is required');
    }
    return opts;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Render one fetched entry as an indented `key: value` block. */
function _renderEntryText(entry: Record<string, unknown>): string {
    const lines: string[] = [];
    const id = typeof entry['id'] === 'string' ? entry['id'] : '(unknown id)';
    const type = typeof entry['type'] === 'string' ? entry['type'] : '(unknown type)';
    lines.push(`[${id}] ${type}`);
    const body = entry['body'];
    if (isPlainObject(body)) {
        for (const key of Object.keys(body).sort()) {
            lines.push(`  ${key}: ${_renderValue(body[key])}`);
        }
    }
    return lines.join('\n');
}

/**
 * Render one body value for text output. `memory_lookup.ts` wraps YAML
 * date scalars in a `PyTimestamp`-shaped object (`{ pyStr: string }`, not
 * exported) to mirror Python's `yaml.safe_load` date parsing — duck-type
 * that shape rather than importing the private class.
 */
function _renderValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (isPlainObject(value) && typeof value['pyStr'] === 'string' && Object.keys(value).length === 1) {
        return value['pyStr'];
    }
    return JSON.stringify(value);
}

export function main(argv: string[] | null = null): number {
    const opts = _parse(argv ?? process.argv.slice(2));
    const envelope = memory_get_v1(opts.ids);
    const entries = Array.isArray(envelope['entries']) ? (envelope['entries'] as Record<string, unknown>[]) : [];
    const idStatus = isPlainObject(envelope['ids']) ? (envelope['ids'] as Record<string, string>) : {};
    const unknown = opts.ids.filter((id) => idStatus[id] === 'unknown');

    if (opts.format === 'json') {
        process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
    } else {
        if (entries.length === 0) {
            process.stdout.write('  (no entries found)\n');
        } else {
            for (const entry of entries) {
                process.stdout.write(`${_renderEntryText(entry)}\n`);
            }
        }
        for (const id of unknown) {
            process.stderr.write(`${PROG}: unknown id: ${id}\n`);
        }
    }

    return unknown.length > 0 ? 1 : 0;
}

// --- CLI entry ---

const _HERE = fileURLToPath(import.meta.url);

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (exc) {
        if (exc instanceof ArgparseExit) {
            process.exitCode = exc.code;
        } else {
            throw exc;
        }
    }
}

export { ArgparseExit };
export type { Opts };
