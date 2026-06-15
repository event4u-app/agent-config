#!/usr/bin/env node
/**
 * corpus-grounding · ground — CLI entry point (interface v1).
 *
 * TypeScript twin of `src/skills/corpus-grounding/scripts/ground.py`
 * (ADR-096 Python→TS migration). Mirrors the Python CLI contract: subcommands
 * (search / ground / validate), snake_case flags, exit codes, the
 * stdout/stderr split, and byte-identical JSON (json.dumps indent=2,
 * ensure_ascii=False) and markdown rendering.
 *
 * Usage (paths resolve as given — relative to cwd, like the Python original):
 *
 *   ground.ts search --manifest <manifest.json> "fintech dashboard"
 *   ground.ts search --manifest m.json --domain color "muted palette" --json
 *   ground.ts search --manifest m.json --filter "Severity=HIGH" "forms"
 *   ground.ts search --manifest m.json --stack react "memo rerender"
 *   ground.ts ground --manifest m.json "luxury e-commerce" [--persist DIR]
 *   ground.ts validate --manifest m.json
 *
 * Pure stdlib · read-only except --persist · no network · no subprocess.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    PyFloat,
    _render_markdown,
    ground as run_ground,
    persist_grounding,
    type ResultDict,
    search_domain,
    search_stack,
} from './decision_engine.js';
import {
    ManifestError,
    load_manifest,
    type Manifest,
    validate_manifest,
} from './schema_validator.js';

// ── filter parsing ──────────────────────────────────────────────────────────

/** Mirror _parse_filters: COLUMN=VALUE pairs → {col: value | [values]}. */
function _parse_filters(pairs: string[]): Record<string, string | string[]> {
    const collected: Record<string, string[]> = {};
    for (const pair of pairs || []) {
        if (!pair.includes('=')) {
            // Python: raise SystemExit(f"--filter expects COLUMN=VALUE, got: {pair!r}")
            process.stderr.write(`--filter expects COLUMN=VALUE, got: ${_repr(pair)}\n`);
            process.exit(1);
        }
        const idx = pair.indexOf('=');
        const col = pair.slice(0, idx);
        const value = pair.slice(idx + 1);
        if (!(col in collected)) {
            collected[col] = [];
        }
        (collected[col] as string[]).push(value);
    }
    const out: Record<string, string | string[]> = {};
    for (const k of Object.keys(collected)) {
        const v = collected[k] as string[];
        out[k] = v.length > 1 ? v : (v[0] as string);
    }
    return out;
}

// ── search text formatter ────────────────────────────────────────────────

function _format_search(result: ResultDict): string {
    if (_truthy(result.error)) {
        return `Error: ${result.error as string}`;
    }
    const out: string[] = ['## Corpus search results'];
    const head = `**Domain:** ${_orStr(result.stack, result.domain)} | **Query:** ${_str(result.query)}`;
    out.push(head);
    const conf = (result.confidence as ResultDict | null) || {};
    out.push(
        `**Source:** ${_str(result.file)} | **Found:** ${_str(result.count)} ` +
            `| **Confidence:** ${_str(conf.label)} (${_confScore(conf.score)})`,
    );
    out.push('');
    const results = (result.results as Record<string, unknown>[] | null) || [];
    let i = 1;
    for (const row of results) {
        out.push(`### Result ${i}`);
        for (const key of Object.keys(row)) {
            let value_str = _str(row[key]);
            if (value_str.length > 300) {
                value_str = `${value_str.slice(0, 300)}…`;
            }
            if (value_str) {
                out.push(`- **${key}:** ${value_str}`);
            }
        }
        out.push('');
        i += 1;
    }
    const gaps = (result.evidence_gap as string[] | null) || [];
    if (gaps.length > 0) {
        out.push('### Evidence gap');
        for (const g of gaps) {
            out.push(`- ${g}`);
        }
    }
    return out.join('\n');
}

// ── argument parsing ─────────────────────────────────────────────────────

interface Args {
    op: 'search' | 'ground' | 'validate';
    manifest: string;
    json: boolean;
    query?: string;
    domain?: string | null;
    stack?: string | null;
    max_results?: number | null;
    filter: string[];
    retriever?: string | null;
    hasRetriever: boolean;
    context?: string | null;
    persist?: string | null;
    project_name?: string | null;
    page?: string | null;
}

/**
 * Minimal argparse-compatible parser for the documented surface. argparse
 * usage/error text (exit 2) is intentionally NOT reproduced byte-for-byte
 * (per ADR-096 test guidance — `--help` and argparse rejections are excluded
 * from byte-parity); the success + documented-error paths are exact.
 */
function _parseArgs(argv: string[]): Args {
    const op = argv[0];
    if (op !== 'search' && op !== 'ground' && op !== 'validate') {
        process.stderr.write(`ground: invalid operation: ${op ?? '(none)'}\n`);
        process.exit(2);
    }
    const rest = argv.slice(1);
    const args: Args = {
        op,
        manifest: '',
        json: false,
        filter: [],
        domain: null,
        stack: null,
        max_results: null,
        retriever: null,
        hasRetriever: op === 'search',
        context: null,
        persist: null,
        project_name: null,
        page: null,
    };
    const positionals: string[] = [];
    let manifestSet = false;
    for (let i = 0; i < rest.length; i += 1) {
        const a = rest[i] as string;
        const eat = (): string => {
            const v = rest[i + 1];
            if (v === undefined) {
                process.stderr.write(`argument ${a}: expected one argument\n`);
                process.exit(2);
            }
            i += 1;
            return v;
        };
        if (a === '--manifest') {
            args.manifest = eat();
            manifestSet = true;
        } else if (a.startsWith('--manifest=')) {
            args.manifest = a.slice('--manifest='.length);
            manifestSet = true;
        } else if (a === '--json') {
            args.json = true;
        } else if (a === '--domain' || a === '-d') {
            args.domain = eat();
        } else if (a.startsWith('--domain=')) {
            args.domain = a.slice('--domain='.length);
        } else if (a === '--stack' || a === '-s') {
            args.stack = eat();
        } else if (a.startsWith('--stack=')) {
            args.stack = a.slice('--stack='.length);
        } else if (a === '--max-results' || a === '-n') {
            args.max_results = parseInt(eat(), 10);
        } else if (a.startsWith('--max-results=')) {
            args.max_results = parseInt(a.slice('--max-results='.length), 10);
        } else if (a === '--filter') {
            args.filter.push(eat());
        } else if (a.startsWith('--filter=')) {
            args.filter.push(a.slice('--filter='.length));
        } else if (a === '--retriever') {
            args.retriever = eat();
        } else if (a.startsWith('--retriever=')) {
            args.retriever = a.slice('--retriever='.length);
        } else if (a === '--context') {
            args.context = eat();
        } else if (a.startsWith('--context=')) {
            args.context = a.slice('--context='.length);
        } else if (a === '--persist') {
            args.persist = eat();
        } else if (a.startsWith('--persist=')) {
            args.persist = a.slice('--persist='.length);
        } else if (a === '--project-name' || a === '-p') {
            args.project_name = eat();
        } else if (a.startsWith('--project-name=')) {
            args.project_name = a.slice('--project-name='.length);
        } else if (a === '--page') {
            args.page = eat();
        } else if (a.startsWith('--page=')) {
            args.page = a.slice('--page='.length);
        } else {
            positionals.push(a);
        }
    }
    if (!manifestSet) {
        process.stderr.write('the following arguments are required: --manifest\n');
        process.exit(2);
    }
    if (op === 'search' || op === 'ground') {
        if (positionals.length === 0) {
            process.stderr.write('the following arguments are required: query\n');
            process.exit(2);
        }
        args.query = positionals[0] as string;
    }
    if ((op === 'search' || op === 'ground') && args.retriever !== null && args.retriever !== undefined) {
        const r = args.retriever;
        if (!['bm25', 'structured', 'hybrid'].includes(r)) {
            process.stderr.write(
                `argument --retriever: invalid choice: '${r}' (choose from 'bm25', 'structured', 'hybrid')\n`,
            );
            process.exit(2);
        }
    }
    return args;
}

// ── main ────────────────────────────────────────────────────────────────

export async function main(argv: string[] | null = null): Promise<number> {
    const args = _parseArgs(argv ?? process.argv.slice(2));

    try {
        if (args.op === 'validate') {
            const raw = JSON.parse(fs.readFileSync(args.manifest, 'utf-8')) as unknown;
            const errors = validate_manifest(raw);
            if (errors.length > 0) {
                process.stdout.write('INVALID manifest:\n');
                for (const err of errors) {
                    process.stdout.write(`  - ${err}\n`);
                }
                return 1;
            }
            process.stdout.write('OK — manifest satisfies contract v1\n');
            return 0;
        }

        const manifest: Manifest = load_manifest(args.manifest);
        // Python: if args.retriever if hasattr(args, "retriever") else None.
        // Only the search subparser defines --retriever; ground/validate don't.
        if (args.hasRetriever && args.retriever) {
            manifest.retriever = args.retriever;
        }

        if (args.op === 'search') {
            let result: ResultDict;
            if (args.stack) {
                result = search_stack(
                    manifest,
                    args.query as string,
                    args.stack,
                    args.max_results ?? 3,
                    _filtersOrNull(_parse_filters(args.filter)),
                );
            } else {
                result = search_domain(
                    manifest,
                    args.query as string,
                    args.domain ?? null,
                    args.max_results,
                    _filtersOrNull(_parse_filters(args.filter)),
                );
            }
            process.stdout.write(
                (args.json ? _jsonDumps(result, 2) : _format_search(result)) + '\n',
            );
            return _truthy(result.error) ? 1 : 0;
        }

        // ground
        const context = args.context ? (JSON.parse(args.context) as Record<string, unknown>) : {};
        const grounded = await run_ground(manifest, args.query as string, context);
        if (args.persist) {
            const info = persist_grounding(
                grounded,
                args.persist,
                args.project_name ?? null,
                args.page ?? null,
            );
            grounded.persisted = info;
        }
        if (args.json) {
            process.stdout.write(_jsonDumps(grounded, 2) + '\n');
        } else {
            process.stdout.write(_render_markdown(grounded) + '\n');
        }
        return 0;
    } catch (exc) {
        // Python catches (ManifestError, json.JSONDecodeError, OSError).
        if (_isExpected(exc)) {
            process.stderr.write(`Error: ${_errText(exc)}\n`);
            return 1;
        }
        throw exc;
    }
}

function _isExpected(exc: unknown): boolean {
    if (exc instanceof ManifestError) {
        return true;
    }
    if (exc instanceof SyntaxError) {
        // JSON.parse failure ≈ json.JSONDecodeError.
        return true;
    }
    if (exc instanceof Error) {
        const code = (exc as NodeJS.ErrnoException).code;
        // OSError family — ENOENT, EISDIR, EACCES, etc.
        if (code && /^E[A-Z]+$/u.test(code)) {
            return true;
        }
    }
    return false;
}

function _errText(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

// ── value coercion helpers (Python str() / truthiness for the CLI) ──────────

function _truthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value).length > 0;
    }
    return true;
}

function _str(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (value instanceof PyFloat) {
        return Number.isInteger(value.value) ? `${value.value}.0` : String(value.value);
    }
    return String(value);
}

/** Python f-string `{result.get('stack') or result.get('domain')}`. */
function _orStr(a: unknown, b: unknown): string {
    return _truthy(a) ? _str(a) : _str(b);
}

/** Render confidence score inside `(...)` — float when present (PyFloat). */
function _confScore(score: unknown): string {
    if (score instanceof PyFloat) {
        return Number.isInteger(score.value) ? `${score.value}.0` : String(score.value);
    }
    if (score === undefined || score === null) {
        return 'None';
    }
    return String(score);
}

function _filtersOrNull(
    filters: Record<string, string | string[]>,
): Record<string, string | string[]> | null {
    return Object.keys(filters).length > 0 ? filters : null;
}

/** Python repr() of a string (for the --filter error). */
function _repr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    if (hasSingle && !hasDouble) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// ── JSON serializer — json.dumps(indent=2, ensure_ascii=False) parity ───────

function _jsonDumps(value: unknown, indent: number): string {
    return _dumps(value, indent, 0);
}

function _dumps(value: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (value instanceof PyFloat) {
        return _jsonFloat(value.value);
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _jsonNum(value);
    }
    if (typeof value === 'string') {
        return _jsonStr(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumps(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map(
            (k) => `${pad}${_jsonStr(k)}: ${_dumps(obj[k], indent, depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStr(String(value));
}

function _jsonNum(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return String(n);
}

/** Render a Python float: integer-valued floats keep the `.0` suffix. */
function _jsonFloat(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    if (Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

/**
 * json.dumps string escaping with ensure_ascii=False: escape only the JSON
 * control set + quote + backslash; leave all non-ASCII raw (the `—` em-dash in
 * the evidence-gap text re-emits verbatim).
 */
function _jsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
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
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    out += ch;
                }
        }
    }
    return `${out}"`;
}

const _isMain =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    main()
        .then((code) => {
            process.exitCode = code;
        })
        .catch((err: unknown) => {
            // Unexpected error — surface like an uncaught Python traceback would
            // (non-zero exit). Should not happen for the documented paths.
            process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
            process.exitCode = 1;
        });
}
