#!/usr/bin/env tsx
/**
 * Gate script for memory promotion (intake → curated).
 *
 * TypeScript twin of `src/scripts/check_memory_proposal.py` (ADR-088,
 * Phase 4 / Wave 4c). Mirrors the Python CLI contract EXACTLY — mutually
 * exclusive `--intake-id` / `--proposal` (one required), `--format`
 * (text|json), `--quiet`, exit codes (0 pass, 1 gate failure / not-found,
 * 2 PyYAML missing — N/A here, 3 internal), stdout/stderr split,
 * byte-identical messages (incl. Python set-repr of VALID_TYPES), same
 * intake scan + pattern logic. No behaviour changes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

// Relative to cwd, mirroring Python `Path("agents/memory/intake")`.
// Injectable for tests (monkeypatch parity).
let INTAKE_ROOT = path.join('agents', 'memory', 'intake');

const VALID_TYPES: ReadonlySet<string> = new Set([
    'historical-patterns',
    'incident-learnings',
    'ownership',
    'domain-invariants',
    'architecture-decisions',
    'product-rules',
]);
const REQUIRED_INTAKE = ['id', 'entry_type', 'path', 'body'] as const;
const PATTERN_MIN_PATHS = 2;
const MIN_FUTURE_DECISIONS = 3;

type Record_ = Record<string, unknown>;

/** Mirror Python `repr(sorted(set))` for a string set. */
function _pyList(items: readonly string[]): string {
    const sorted = items.slice().sort();
    return '[' + sorted.map((s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ') + ']';
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Mirror sorted(glob("*.jsonl")) on INTAKE_ROOT — full paths, sorted. */
function _jsonlFilesSorted(): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(INTAKE_ROOT);
    } catch {
        return [];
    }
    return entries
        .filter((e) => e.endsWith('.jsonl'))
        .map((e) => path.join(INTAKE_ROOT, e))
        .sort();
}

/** Unsorted glob (Python `.glob` without sorted) for _count_sibling_paths. */
function _jsonlFilesUnsorted(): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(INTAKE_ROOT);
    } catch {
        return [];
    }
    return entries.filter((e) => e.endsWith('.jsonl')).map((e) => path.join(INTAKE_ROOT, e));
}

function _load_yaml(p: string): Record_ {
    let data: unknown;
    data = YAML.parse(fs.readFileSync(p, 'utf-8'), { version: '1.1' });
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        process.stderr.write(`error: ${p} is not a YAML mapping\n`);
        process.exit(1);
    }
    return data as Record_;
}

function _find_intake(intake_id: string): Record_ | null {
    if (!_isDir(INTAKE_ROOT)) {
        return null;
    }
    for (const jsonl of _jsonlFilesSorted()) {
        const text = fs.readFileSync(jsonl, 'utf-8');
        for (let line of text.split('\n')) {
            line = line.trim();
            if (line === '') {
                continue;
            }
            let obj: unknown;
            try {
                obj = JSON.parse(line);
            } catch {
                continue;
            }
            if (obj !== null && typeof obj === 'object' && (obj as Record_)['id'] === intake_id) {
                return obj as Record_;
            }
        }
    }
    return null;
}

function _count_sibling_paths(entry_type: unknown, body: unknown): number {
    if (!_isDir(INTAKE_ROOT)) {
        return 0;
    }
    const seen = new Set<string>();
    for (const jsonl of _jsonlFilesUnsorted()) {
        const text = fs.readFileSync(jsonl, 'utf-8');
        for (let line of text.split('\n')) {
            line = line.trim();
            if (line === '') {
                continue;
            }
            let obj: unknown;
            try {
                obj = JSON.parse(line);
            } catch {
                continue;
            }
            if (obj === null || typeof obj !== 'object') {
                continue;
            }
            const o = obj as Record_;
            if (
                o['entry_type'] === entry_type &&
                o['body'] === body &&
                typeof o['path'] === 'string'
            ) {
                seen.add(o['path'] as string);
            }
        }
    }
    return seen.size;
}

function _check_future_decisions(fds: unknown): string[] {
    const failures: string[] = [];
    if (!Array.isArray(fds)) {
        return ['future_decisions: missing or not a list'];
    }
    if (fds.length < MIN_FUTURE_DECISIONS) {
        failures.push(
            `future_decisions: needs ≥${MIN_FUTURE_DECISIONS}, got ${fds.length}`,
        );
    }
    for (let idx = 0; idx < fds.length; idx++) {
        const i = idx + 1;
        const fd = fds[idx];
        if (fd === null || typeof fd !== 'object' || Array.isArray(fd)) {
            failures.push(`future_decisions[${i}]: must be a mapping`);
            continue;
        }
        const fdObj = fd as Record_;
        for (const key of ['decision', 'expected_by', 'owner']) {
            if (!fdObj[key]) {
                failures.push(`future_decisions[${i}]: missing \`${key}\``);
            }
        }
    }
    return failures;
}

function check(record: Record_, _source: string): string[] {
    const failures: string[] = [];
    // 1. required fields
    for (const key of REQUIRED_INTAKE) {
        const v = record[key];
        if (!(key in record) || v === null || v === undefined || v === '') {
            failures.push(`missing field: \`${key}\``);
        }
    }
    // 2. type value
    const etype = record['entry_type'];
    if (!VALID_TYPES.has(etype as string)) {
        failures.push(
            `entry_type \`${etype === undefined || etype === null ? 'None' : String(etype)}\` not in ${_pyList([...VALID_TYPES])}`,
        );
    }
    // 3. pattern vs one-off
    const body = record['body'];
    const sibling_paths = body && etype ? _count_sibling_paths(etype, body) : 0;
    const fds = record['future_decisions'];
    if (sibling_paths >= PATTERN_MIN_PATHS) {
        // strong pattern signal
    } else {
        const fd_errors = _check_future_decisions(fds);
        if (fd_errors.length > 0) {
            failures.push(
                `weak pattern evidence (${sibling_paths} sibling path(s)) ` +
                    `and future_decisions insufficient:`,
            );
            for (const e of fd_errors) {
                failures.push(`  - ${e}`);
            }
        }
    }
    return failures;
}

// --- argparse port ---------------------------------------------------------

interface ParsedArgs {
    intake_id: string | null;
    proposal: string | null;
    format: 'text' | 'json';
    quiet: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write(`check_memory_proposal: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let intake_id: string | null = null;
    let proposal: string | null = null;
    let format: 'text' | 'json' = 'text';
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--intake-id') {
            intake_id = _need(argv, ++i, '--intake-id');
        } else if (arg.startsWith('--intake-id=')) {
            intake_id = arg.slice('--intake-id='.length);
        } else if (arg === '--proposal') {
            proposal = _need(argv, ++i, '--proposal');
        } else if (arg.startsWith('--proposal=')) {
            proposal = arg.slice('--proposal='.length);
        } else if (arg === '--format') {
            const v = _need(argv, ++i, '--format');
            format = _checkFormat(v);
        } else if (arg.startsWith('--format=')) {
            format = _checkFormat(arg.slice('--format='.length));
        } else if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_memory_proposal [-h] (--intake-id INTAKE_ID | --proposal PROPOSAL)\n' +
                    '                             [--format {text,json}] [--quiet]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    if (intake_id !== null && proposal !== null) {
        _argparse_error('argument --proposal: not allowed with argument --intake-id');
    }
    if (intake_id === null && proposal === null) {
        _argparse_error('one of the arguments --intake-id --proposal is required');
    }
    return { intake_id, proposal, format, quiet };
}

function _need(argv: readonly string[], i: number, flag: string): string {
    const v = argv[i];
    if (v === undefined) {
        _argparse_error(`argument ${flag}: expected one argument`);
    }
    return v;
}

function _checkFormat(v: string): 'text' | 'json' {
    if (v !== 'text' && v !== 'json') {
        _argparse_error(`argument --format: invalid choice: '${v}' (choose from 'text', 'json')`);
    }
    return v;
}

/** Mirror Python `json.dumps(obj, indent=2)` with ensure_ascii. */
function _json_dumps_ascii(obj: unknown): string {
    const raw = JSON.stringify(obj, null, 2);
    let out = '';
    for (const ch of raw) {
        const code = ch.codePointAt(0)!;
        if (code < 0x80) {
            out += ch;
        } else {
            for (let k = 0; k < ch.length; k++) {
                out += '\\u' + ch.charCodeAt(k).toString(16).padStart(4, '0');
            }
        }
    }
    return out;
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    let record: Record_;
    let source: string;
    if (args.intake_id !== null) {
        const found = _find_intake(args.intake_id);
        if (found === null) {
            process.stderr.write(`error: no intake entry with id=${args.intake_id}\n`);
            return 1;
        }
        record = found;
        source = `intake:${args.intake_id}`;
    } else {
        record = _load_yaml(args.proposal!);
        source = args.proposal!;
    }
    const failures = check(record, source);
    if (args.format === 'json') {
        process.stdout.write(_json_dumps_ascii({ source, failures }) + '\n');
    } else {
        if (failures.length > 0) {
            process.stdout.write(`❌  ${source} — gate failed:\n`);
            for (const f of failures) {
                process.stdout.write(`  🔴 ${f}\n`);
            }
        } else {
            if (!args.quiet) {
                process.stdout.write(`✅  ${source} — gate passed\n`);
            }
        }
    }
    return failures.length > 0 ? 1 : 0;
}

function _set_intake_root_for_test(root: string): void {
    INTAKE_ROOT = root;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    VALID_TYPES,
    REQUIRED_INTAKE,
    _find_intake,
    _count_sibling_paths,
    _check_future_decisions,
    check,
    main,
    _set_intake_root_for_test,
};
