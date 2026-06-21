#!/usr/bin/env node
/**
 * Redact captured hook payloads for the verified-platforms roadmap.
 *
 * TypeScript twin of `redact_hook_capture.py` (Phase 8 / Wave 8g).
 *
 * Reads JSON capture files written by `dispatch_hook.py` (when
 * `AGENT_HOOK_CAPTURE_DIR` is set) and produces a redacted version
 * suitable for pasting into the verified-platforms roadmap.
 *
 * Redaction policy (per the roadmap's Capture-and-redact protocol):
 *
 * - Replace string values at known user-content paths with `<REDACTED>`.
 *   Default field allowlist mirrors the fallback list in
 *   `scripts/chat_history.py::_extract_hook_text` plus Augment's nested
 *   `conversation.*` shape.
 * - Preserve envelope keys (`hook_event_name`, `session_id`, `platform`,
 *   `event`, `cwd`, `workspace_roots`, `transcript_path`, `model`,
 *   `cursor_version`, …) so the schema is reviewable.
 * - `--strict` redacts any string longer than `--max-len` (default 120)
 *   chars regardless of key, as a safety net for unknown fields.
 *
 * Usage:
 *
 *     node redact_hook_capture.js <input> [--out <path>] [--strict]
 *
 * Input may be a single JSON file or a directory; with a directory, every
 * `*.json` is redacted and written next to the original with the suffix
 * `.redacted.json`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

export const REDACTED = '<REDACTED>';

// Field names that carry user / agent content (from
// scripts/chat_history.py::_extract_hook_text fallback list + nested
// Augment shape). Matched case-insensitively against the leaf key.
const _USER_CONTENT_KEYS = new Set<string>([
    'prompt', 'user_prompt', 'userprompt', 'first_user_msg',
    'firstusermsg', 'usermessage', 'user_message', 'text',
    'response', 'message', 'content',
    // Augment Code with includeConversationData
    'agenttextresponse', 'agent_text_response',
    'agentcoderesponse', 'agent_code_response',
    // Cursor / generic
    'submitted_prompt', 'submittedprompt',
    // Free-form transcript bodies (path stays — content is in another file)
    'transcript', 'transcript_text',
]);

// Keys whose value is a structural / schema marker — keep as-is even when
// --strict would otherwise redact long values.
const _ENVELOPE_KEYS_KEEP = new Set<string>([
    'hook_event_name', 'session_id', 'transcript_path', 'transcriptpath',
    'platform', 'event', 'native_event', 'captured_at', 'cwd',
    'workspace_roots', 'model', 'cursor_version', 'user_email',
    'conversation_id', 'generation_id', 'agent', 'type',
    'schema_version', 'started_at', 'completed_at', '_raw_text',
    'path', 'changetype', 'change_type',
]);

/** Python `len(str)` — count Unicode code points, not UTF-16 units. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/** Recursively redact a value. Mirrors `_redact_value`. */
function _redactValue(
    val: unknown,
    key: string | null,
    strict: boolean,
    maxLen: number,
): unknown {
    const normKey = (key ?? '').toLowerCase().replaceAll('-', '_');
    if (Array.isArray(val)) {
        return val.map((item) => _redactValue(item, key, strict, maxLen));
    }
    if (val !== null && typeof val === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            out[k] = _redactValue(v, k, strict, maxLen);
        }
        return out;
    }
    if (typeof val === 'string') {
        if (_ENVELOPE_KEYS_KEEP.has(normKey)) {
            return val;
        }
        if (_USER_CONTENT_KEYS.has(normKey)) {
            return REDACTED;
        }
        if (strict && _pyLen(val) > maxLen) {
            return REDACTED;
        }
        return val;
    }
    return val;
}

/** Redact a single capture record. Top-level envelope is preserved. */
export function redact(
    record: Record<string, unknown>,
    strict = false,
    maxLen = 120,
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
        if (k === 'raw_payload') {
            out[k] = _redactValue(v, null, strict, maxLen);
        } else {
            out[k] = _redactValue(v, k, strict, maxLen);
        }
    }
    return out;
}

/**
 * Mirror `json.dumps(obj, indent=2)` (ensure_ascii default = True).
 * Item separator `,`, key separator `: `, no trailing whitespace on
 * empty containers.
 */
function _pyJsonDumpsIndent2(obj: unknown): string {
    return _dumpValue(obj, 0);
}

function _dumpValue(value: unknown, depth: number): string {
    const pad = '  '.repeat(depth);
    const padInner = '  '.repeat(depth + 1);
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return _dumpNumber(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'string') return _dumpString(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => padInner + _dumpValue(v, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + pad + ']';
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const items = entries.map(
        ([k, v]) => padInner + _dumpString(k) + ': ' + _dumpValue(v, depth + 1),
    );
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
}

/** Mirror Python json integer-valued float vs int rendering. */
function _dumpNumber(n: number): string {
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

/** Mirror json.dumps string escaping (ensure_ascii=True default). */
function _dumpString(s: string): string {
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
        else if (code < 0x20) out += '\\u' + code.toString(16).padStart(4, '0');
        else if (code < 0x7f) out += ch;
        else if (code <= 0xffff) out += '\\u' + code.toString(16).padStart(4, '0');
        else {
            const v = code - 0x10000;
            const hi = 0xd800 + (v >> 10);
            const lo = 0xdc00 + (v & 0x3ff);
            out += '\\u' + hi.toString(16).padStart(4, '0');
            out += '\\u' + lo.toString(16).padStart(4, '0');
        }
    }
    return out + '"';
}

/** Expand a leading `~` like Python `Path.expanduser`. */
function _expanduser(p: string): string {
    if (p === '~') {
        return os.homedir();
    }
    if (p.startsWith('~/')) {
        return path.join(os.homedir(), p.slice(2));
    }
    return p;
}

/** Mirror `Path.with_suffix(".redacted.json")` for a capture file. */
function _withRedactedSuffix(p: string): string {
    const dir = path.dirname(p);
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    // Path.with_suffix replaces the final suffix; a name with no dot (or a
    // leading-dot-only name) gets the suffix appended.
    const stem = dot > 0 ? base.slice(0, dot) : base;
    return path.join(dir, stem + '.redacted.json');
}

function _processFile(
    filePath: string,
    out: string | null,
    strict: boolean,
    maxLen: number,
): string {
    const record = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    const redacted = redact(record, strict, maxLen);
    const target = out ?? _withRedactedSuffix(filePath);
    fs.writeFileSync(target, _pyJsonDumpsIndent2(redacted) + '\n', 'utf-8');
    return target;
}

interface ParsedArgs {
    input: string;
    out: string | null;
    strict: boolean;
    maxLen: number;
}

/**
 * Minimal argparse-equivalent for this script's surface.
 * Throws `ArgError` (exit code 2) on parse failure to mirror argparse.
 */
class ArgError extends Error {}

function _parseArgs(argv: string[]): ParsedArgs {
    let input: string | null = null;
    let out: string | null = null;
    let strict = false;
    let maxLen = 120;
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '--out') {
            out = argv[i + 1] ?? null;
            if (out === null) throw new ArgError('argument --out: expected one argument');
            i += 2;
        } else if (a.startsWith('--out=')) {
            out = a.slice('--out='.length);
            i += 1;
        } else if (a === '--strict') {
            strict = true;
            i += 1;
        } else if (a === '--max-len') {
            const v = argv[i + 1];
            if (v === undefined) throw new ArgError('argument --max-len: expected one argument');
            maxLen = parseInt(v, 10);
            i += 2;
        } else if (a.startsWith('--max-len=')) {
            maxLen = parseInt(a.slice('--max-len='.length), 10);
            i += 1;
        } else if (a.startsWith('-') && a !== '-') {
            throw new ArgError(`unrecognized arguments: ${a}`);
        } else {
            if (input !== null) throw new ArgError(`unrecognized arguments: ${a}`);
            input = a;
            i += 1;
        }
    }
    if (input === null) {
        throw new ArgError('the following arguments are required: input');
    }
    return { input, out, strict, maxLen };
}

export function main(argv: string[] | null = null): number {
    let args: ParsedArgs;
    try {
        args = _parseArgs(argv ?? process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgError) {
            process.stderr.write(`redact: ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    const src = _expanduser(args.input);
    if (!fs.existsSync(src)) {
        process.stderr.write(`redact: input not found: ${src}\n`);
        return 2;
    }

    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (args.out !== null) {
            process.stderr.write('redact: --out is single-file only\n');
            return 2;
        }
        // Mirror `sorted(src.glob("*.json"))` — glob matches any entry whose
        // name ends in `.json`; no is_file() filter in the Python original.
        const files = fs
            .readdirSync(src)
            .filter((name) => name.endsWith('.json') && !name.endsWith('.redacted.json'))
            .sort()
            .map((name) => path.join(src, name));
        for (const filePath of files) {
            const target = _processFile(filePath, null, args.strict, args.maxLen);
            process.stdout.write(`redacted: ${target}\n`);
        }
        return 0;
    }

    const target = _processFile(src, args.out, args.strict, args.maxLen);
    process.stdout.write(`redacted: ${target}\n`);
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
