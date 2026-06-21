#!/usr/bin/env node
/**
 * `./agent-config telemetry:status` — read-only status report.
 *
 * TypeScript twin of `telemetry_status.py` (ADR-200). Byte-for-byte parity on
 * stdout / stderr / exit code for both text and JSON formats. Safe even when
 * telemetry is disabled — never creates the log, never validates, never writes.
 */
import * as fs from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import * as path from 'node:path';

import { EngagementSchemaError, parse_event } from './telemetry/engagement.js';
import { type TelemetrySettings, read_settings } from './telemetry/settings.js';

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Return the `ts` of the last well-formed event, or null. Reads from the tail. */
function _last_event_ts(log_path: string): string | null {
    if (!_isFile(log_path)) {
        return null;
    }
    let tail: string;
    try {
        const fd = fs.openSync(log_path, 'r');
        try {
            const size = fs.fstatSync(fd).size;
            const chunk_size = Math.min(size, 4096);
            const buf = Buffer.alloc(chunk_size);
            fs.readSync(fd, buf, 0, chunk_size, size - chunk_size);
            tail = _utf8Replace(buf);
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return null;
    }
    const lines = tail.split('\n');
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = (lines[i] as string).trim();
        if (!line) {
            continue;
        }
        try {
            const event = parse_event(`${line}\n`);
            return event.ts;
        } catch (exc) {
            if (exc instanceof EngagementSchemaError) {
                continue;
            }
            throw exc;
        }
    }
    return null;
}

/** Decode UTF-8 with replacement (Python `errors="replace"`). */
function _utf8Replace(buf: Buffer): string {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

interface LogStats {
    exists: boolean;
    size_bytes?: number;
    line_count?: number;
    error?: string;
}

function _log_stats(log_path: string): LogStats {
    if (!_isFile(log_path)) {
        return { exists: false, size_bytes: 0, line_count: 0 };
    }
    try {
        const size = fs.statSync(log_path).size;
        const buf = fs.readFileSync(log_path);
        let line_count = 0;
        for (const b of buf) {
            if (b === 0x0a) {
                line_count += 1;
            }
        }
        // Python `sum(1 for _ in fh)` counts lines: a final line without a
        // trailing newline still counts. Match `open(..,"rb")` iteration.
        if (buf.length > 0 && buf[buf.length - 1] !== 0x0a) {
            line_count += 1;
        }
        return { exists: true, size_bytes: size, line_count };
    } catch (exc) {
        return { exists: true, error: _osErr(exc) };
    }
}

interface Report {
    enabled: boolean;
    section_present: boolean;
    granularity: string;
    record: { consulted: boolean; applied: boolean };
    log: Record<string, unknown>;
}

function _build_report(settings: TelemetrySettings): Report {
    const log_path = settings.log_path;
    const stats = _log_stats(log_path);
    const log: Record<string, unknown> = {
        path: log_path,
        ...stats,
        last_event_ts: _last_event_ts(log_path),
    };
    return {
        enabled: settings.enabled,
        section_present: settings.section_present,
        granularity: settings.granularity,
        record: {
            consulted: settings.record_consulted,
            applied: settings.record_applied,
        },
        log,
    };
}

function _render_text(report: Report): string {
    const lines: string[] = [];
    let enabled = report.enabled ? '✅  enabled' : '⛔  disabled';
    if (!report.section_present) {
        enabled += ' (no telemetry section in .agent-settings.yml — using defaults)';
    }
    lines.push(`  artifact-engagement: ${enabled}`);
    lines.push(`  granularity:         ${report.granularity}`);
    const rec = report.record;
    lines.push(
        `  record:              consulted=${_pyBool(rec.consulted)} `
        + `applied=${_pyBool(rec.applied)}`,
    );
    const log = report.log;
    lines.push(`  log path:            ${log['path'] as string}`);
    if (log['exists']) {
        if ('error' in log && log['error'] !== undefined) {
            lines.push(`  log error:           ${log['error'] as string}`);
        } else {
            lines.push(
                `  log size:            ${log['size_bytes'] as number} bytes `
                + `(${log['line_count'] as number} events)`,
            );
            if (log['last_event_ts']) {
                lines.push(`  last event ts:       ${log['last_event_ts'] as string}`);
            }
        }
    } else {
        lines.push('  log:                 not yet created');
    }
    return lines.join('\n');
}

/** Python `str(bool)` → `True` / `False` (f-string of a bool). */
function _pyBool(b: boolean): string {
    return b ? 'True' : 'False';
}

interface StatusArgs {
    format: string;
    settings: string;
}

class ArgError extends Error {}

function _reprStr(s: string): string {
    return `'${s}'`;
}

function _parseArgs(argv: string[]): StatusArgs {
    const a: StatusArgs = { format: 'text', settings: '.agent-settings.yml' };
    const formatChoices = ['text', 'json'];
    for (let i = 0; i < argv.length; i += 1) {
        let tok = argv[i] as string;
        let inlineVal: string | null = null;
        const eq = tok.indexOf('=');
        if (tok.startsWith('--') && eq !== -1) {
            inlineVal = tok.slice(eq + 1);
            tok = tok.slice(0, eq);
        }
        const next = (): string => {
            if (inlineVal !== null) {
                return inlineVal;
            }
            i += 1;
            return argv[i] as string;
        };
        if (tok === '--format') {
            const v = next();
            if (!formatChoices.includes(v)) {
                throw new ArgError(
                    `argument --format: invalid choice: ${_reprStr(v)} `
                    + `(choose from ${formatChoices.map(_reprStr).join(', ')})`,
                );
            }
            a.format = v;
        } else if (tok === '--settings') a.settings = next();
        else throw new ArgError(`unrecognized arguments: ${argv[i]}`);
    }
    return a;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let args: StatusArgs;
    try {
        args = _parseArgs(argv);
    } catch (exc) {
        if (exc instanceof ArgError) {
            process.stderr.write(`error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    let settings: TelemetrySettings;
    try {
        settings = read_settings(args.settings);
    } catch (exc) {
        process.stderr.write(`❌  cannot read settings: ${_osErr(exc)}\n`);
        return 2;
    }

    const report = _build_report(settings);
    if (args.format === 'json') {
        // print(json.dumps(report, sort_keys=True, indent=2)) → +trailing \n
        process.stdout.write(`${_py_json_dumps_indent2_sorted(report)}\n`);
    } else {
        process.stdout.write(`${_render_text(report)}\n`);
    }
    return 0;
}

function _osErr(exc: unknown): string {
    return exc instanceof Error ? exc.message : String(exc);
}

// ── Python-parity JSON (indent=2, sorted keys) ──────────────────────────

function _py_json_dumps_indent2_sorted(value: unknown): string {
    return _dumpIndent2(value, 0);
}

function _dumpIndent2(value: unknown, depth: number): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : String(value);
    }
    if (typeof value === 'string') {
        return _pyJsonStringAscii(value);
    }
    const pad = '  '.repeat(depth + 1);
    const closePad = '  '.repeat(depth);
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpIndent2(v, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
    if (keys.length === 0) {
        return '{}';
    }
    const items = keys.map(
        (k) => `${pad}${_pyJsonStringAscii(k)}: ${_dumpIndent2(obj[k], depth + 1)}`,
    );
    return `{\n${items.join(',\n')}\n${closePad}}`;
}

function _pyJsonStringAscii(s: string): string {
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
        else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, '0')}`;
        else if (code < 0x7f) out += ch;
        else if (code <= 0xffff) out += `\\u${code.toString(16).padStart(4, '0')}`;
        else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return `${out}"`;
}

const _invokedDirectly =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_invokedDirectly) {
    process.exitCode = main();
}
