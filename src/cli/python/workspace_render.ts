#!/usr/bin/env tsx
/**
 * Role-prompt placeholder rendering — ADR-069 (TypeScript twin).
 *
 * TypeScript twin of `src/cli/python/workspace_render.py` (ADR-200, py2ts
 * migration). Byte-for-byte CLI parity with the Python original — same
 * subcommands, same exit codes, same `json.dumps(..., sort_keys=True)` output,
 * same `PromptError` / `SystemExit` semantics, same single-pass `{{name}}`
 * substitution, same text `inspect` format. No behaviour changes — latent
 * quirks are replicated, not fixed.
 *
 * A role prompt at `agents/roles/<role>/prompts/<name>.md` carries YAML
 * frontmatter declaring its inputs and a body with `{{name}}` placeholders.
 * This module fills those placeholders from a caller-supplied `name → value`
 * map and returns the rendered prompt. It is the missing piece between the
 * role prompt library and the host hand-off: Tier-3 inbox auto-routing and
 * Tier-1 pre-rendering (Codex / Gemini have no skill surface) both consume a
 * *filled* prompt, not a template.
 *
 * Design (AI-council 2026-06-08, claude-sonnet-4-5 + gpt-4o, design mode):
 *
 * - Single responsibility — render placeholders only; the renderer returns the
 *   `skill_hint` so the caller decides (ADR-066 owns skill pre-rendering).
 * - Missing REQUIRED input → hard error (`PromptError`, CLI exits 1).
 * - Missing OPTIONAL input → empty string, heading stays.
 * - Unknown placeholder → hard error.
 * - Single-pass literal substitution — a value containing `{{...}}` is never
 *   re-expanded.
 *
 * The `shape` field is advisory documentation only (not enforced).
 *
 * CLI:
 *
 *     workspace_render.ts render  --role <r> --prompt <p> [--inputs-json <f|->] [--root <dir>]
 *     workspace_render.ts inspect --role <r> --prompt <p> [--root <dir>] [--json]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as YAML from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

/**
 * `raise SystemExit(str)` — Python prints `str` to stderr and exits 1. Caught
 * at the CLI entry, which writes the message + sets exit code 1.
 */
class SystemExitError extends Error {
    constructor(public readonly msg: string) {
        super(msg);
    }
}

/**
 * `class PromptError(ValueError)` — a prompt template or input-set error that
 * should fail the render.
 */
class PromptError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PromptError';
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

// --- Python-value mirroring -------------------------------------------------
//
// `_load_inputs_json` parses the input map with `json.loads`, so each value
// carries Python's int/float distinction (`5` → int, `5.0` → float). Plain
// `JSON.parse` loses that distinction (both → JS `number`) AND truncates large
// integers. To mirror `str(val)` in `_sub`, we parse with a reviver-equivalent
// that tags every number node with its source literal + whether it was a JSON
// float (had `.`, `e`, or `E`). `PyNum` boxes that; `pyStr` renders it the way
// Python's `str()` would.

interface PyNum {
    readonly __pynum: true;
    /** true when the JSON literal had a `.` / `e` / `E` → Python `float`. */
    readonly isFloat: boolean;
    /** the original JSON number literal, verbatim. */
    readonly literal: string;
}

function isPyNum(v: unknown): v is PyNum {
    return (
        typeof v === 'object' &&
        v !== null &&
        (v as { __pynum?: unknown }).__pynum === true
    );
}

/**
 * `repr(float)` for the value of a JSON float literal — CPython's
 * shortest-round-trip decimal, reformatted into Python's style:
 *
 * - integral magnitudes in `[1e-4, 1e16)` render with a trailing `.0`
 *   (`5.0`, `15000000000.0`);
 * - magnitudes `>= 1e16` or `< 1e-4` render in scientific form with a
 *   two-digit, sign-bearing exponent (`1e+16`, `1e-07`, `1e+21`);
 * - `-0.0` keeps its sign.
 *
 * The shortest-decimal digits come from JS `Number.prototype.toString`, which
 * uses the same shortest-round-trip family as CPython, so the significant
 * digits agree; only the surface formatting is reshaped here.
 */
function pyFloatRepr(value: number): string {
    if (Number.isNaN(value)) return 'nan';
    if (value === Infinity) return 'inf';
    if (value === -Infinity) return '-inf';

    const neg = value < 0 || Object.is(value, -0);
    const abs = Math.abs(value);
    let body: string;

    if (abs === 0) {
        body = '0.0';
    } else if (abs >= 1e16 || abs < 1e-4) {
        // Scientific. JS toExponential gives the shortest mantissa via
        // toString first; derive digits, then format Python-style.
        // Use toExponential() with no arg → shortest representation in JS.
        const exp = abs.toExponential(); // e.g. "1e+16", "1.2345678901234567e+19"
        const m = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(exp);
        if (m === null) {
            body = String(abs);
        } else {
            const intDigit = m[1] as string;
            const fracDigits = m[2] ?? '';
            const mantissa = fracDigits === '' ? intDigit : `${intDigit}.${fracDigits}`;
            const e = Number(m[3]);
            const esign = e < 0 ? '-' : '+';
            const emag = Math.abs(e).toString().padStart(2, '0');
            body = `${mantissa}e${esign}${emag}`;
        }
    } else {
        // Fixed-point. JS toString gives the shortest decimal; append `.0`
        // when there is no fractional part (Python always shows a float dot).
        body = abs.toString();
        if (!body.includes('.')) {
            body += '.0';
        }
    }
    return neg ? '-' + body : body;
}

/**
 * `str(val)` for a value loaded from a JSON input map, mirroring CPython:
 * `None` → "" (handled by the caller before this is reached), bool → "True" /
 * "False", int → the literal digits (arbitrary precision), float → `repr`,
 * str → itself. Containers fall back to a JSON-ish dump (Python `str(list)` /
 * `str(dict)` shapes are out of scope for placeholder values — a placeholder
 * would never be a sensible container — but render deterministically).
 */
function pyStr(value: unknown): string {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'string') return value;
    if (isPyNum(value)) {
        return value.isFloat ? pyFloatRepr(Number(value.literal)) : intLiteralStr(value.literal);
    }
    if (typeof value === 'number') {
        // No source literal (synthetic value) — best effort.
        return Number.isInteger(value) ? String(value) : pyFloatRepr(value);
    }
    // Container — Python would render its repr; we never feed one here.
    return _dumpSorted(value);
}

/**
 * `str(int(literal))` — normalize a JSON integer literal to Python's `int`
 * surface: a leading `+` is never present in JSON; `-0` collapses to `0`;
 * arbitrary magnitude is preserved verbatim (no float coercion).
 */
function intLiteralStr(literal: string): string {
    let neg = false;
    let digits = literal;
    if (digits.startsWith('-')) {
        neg = true;
        digits = digits.slice(1);
    }
    // Strip leading zeros (JSON forbids them anyway except a lone "0").
    digits = digits.replace(/^0+(?=\d)/, '');
    if (digits === '0' || digits === '') return '0';
    return neg ? '-' + digits : digits;
}

/**
 * `json.loads(raw)` with int/float distinction preserved. Returns the parsed
 * value where every number is a `PyNum` box (so `pyStr` can mirror Python's
 * `str()`). Throws `SyntaxError`-shaped errors on malformed input, like
 * `json.loads`. Minimal recursive-descent JSON parser — only the surface
 * `_load_inputs_json` needs (object root, but parses any value defensively).
 */
function jsonLoadsTagged(raw: string): unknown {
    let i = 0;
    const n = raw.length;

    function err(msg: string): never {
        throw new SyntaxError(msg);
    }
    function skipWs(): void {
        while (i < n) {
            const c = raw[i] as string;
            if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i += 1;
            else break;
        }
    }
    function parseValue(): unknown {
        skipWs();
        if (i >= n) err('Expecting value');
        const c = raw[i] as string;
        if (c === '{') return parseObject();
        if (c === '[') return parseArray();
        if (c === '"') return parseString();
        if (c === '-' || (c >= '0' && c <= '9')) return parseNumber();
        if (raw.startsWith('true', i)) {
            i += 4;
            return true;
        }
        if (raw.startsWith('false', i)) {
            i += 5;
            return false;
        }
        if (raw.startsWith('null', i)) {
            i += 4;
            return null;
        }
        return err('Expecting value');
    }
    function parseObject(): Record<string, unknown> {
        const obj: Record<string, unknown> = {};
        i += 1; // {
        skipWs();
        if (raw[i] === '}') {
            i += 1;
            return obj;
        }
        for (;;) {
            skipWs();
            if (raw[i] !== '"') err('Expecting property name enclosed in double quotes');
            const key = parseString();
            skipWs();
            if (raw[i] !== ':') err("Expecting ':' delimiter");
            i += 1;
            obj[key] = parseValue();
            skipWs();
            const d = raw[i];
            if (d === ',') {
                i += 1;
                continue;
            }
            if (d === '}') {
                i += 1;
                return obj;
            }
            err("Expecting ',' delimiter");
        }
    }
    function parseArray(): unknown[] {
        const arr: unknown[] = [];
        i += 1; // [
        skipWs();
        if (raw[i] === ']') {
            i += 1;
            return arr;
        }
        for (;;) {
            arr.push(parseValue());
            skipWs();
            const d = raw[i];
            if (d === ',') {
                i += 1;
                continue;
            }
            if (d === ']') {
                i += 1;
                return arr;
            }
            err("Expecting ',' delimiter");
        }
    }
    function parseString(): string {
        i += 1; // opening quote
        let out = '';
        for (;;) {
            if (i >= n) err('Unterminated string starting at');
            const c = raw[i] as string;
            if (c === '"') {
                i += 1;
                return out;
            }
            if (c === '\\') {
                const e = raw[i + 1] as string;
                i += 2;
                switch (e) {
                    case '"':
                        out += '"';
                        break;
                    case '\\':
                        out += '\\';
                        break;
                    case '/':
                        out += '/';
                        break;
                    case 'b':
                        out += '\b';
                        break;
                    case 'f':
                        out += '\f';
                        break;
                    case 'n':
                        out += '\n';
                        break;
                    case 'r':
                        out += '\r';
                        break;
                    case 't':
                        out += '\t';
                        break;
                    case 'u': {
                        const hex = raw.slice(i, i + 4);
                        if (!/^[0-9a-fA-F]{4}$/.test(hex)) err('Invalid \\uXXXX escape');
                        out += String.fromCharCode(parseInt(hex, 16));
                        i += 4;
                        break;
                    }
                    default:
                        err(`Invalid \\escape: ${e}`);
                }
            } else {
                out += c;
                i += 1;
            }
        }
    }
    function isDigit(idx: number): boolean {
        const c = raw[idx];
        return c !== undefined && c >= '0' && c <= '9';
    }
    function parseNumber(): PyNum {
        const start = i;
        if (raw[i] === '-') i += 1;
        while (i < n && isDigit(i)) i += 1;
        let isFloat = false;
        if (raw[i] === '.') {
            isFloat = true;
            i += 1;
            while (i < n && isDigit(i)) i += 1;
        }
        if (raw[i] === 'e' || raw[i] === 'E') {
            isFloat = true;
            i += 1;
            if (raw[i] === '+' || raw[i] === '-') i += 1;
            while (i < n && isDigit(i)) i += 1;
        }
        const literal = raw.slice(start, i);
        if (literal === '' || literal === '-') err('Expecting value');
        return { __pynum: true, isFloat, literal };
    }

    const result = parseValue();
    skipWs();
    if (i !== n) err('Extra data');
    return result;
}

// ---------------------------------------------------------------------------
// Module body (workspace_render.py).
// ---------------------------------------------------------------------------

// <repo>/src/cli/python/workspace_render.ts → repo root is parents[3].
const ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');
const ROLES_ROOT_DEFAULT = path.join(ROOT, 'agents', 'roles');

// Placeholder token: `{{ name }}` with an identifier-shaped name. Whitespace
// inside the braces is tolerated; the captured name is matched against the
// declared inputs.
const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

// `re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n?", re.DOTALL)` matched with
// `.match()` (anchored at the start of the string).
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** `yaml.safe_load(text)` (PyYAML is YAML 1.1). `null` on YAMLError. */
function yamlSafeLoad(text: string): unknown {
    try {
        return YAML.parse(text, { version: '1.1' });
    } catch {
        return null;
    }
}

interface InputSpec {
    name: string;
    required: boolean;
    shape: unknown;
}

interface PromptSpec {
    name: unknown;
    intent: unknown;
    inputs: InputSpec[];
    output_shape: unknown;
    skill_hint: unknown;
    body: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _splitFrontmatter(text: string): [Record<string, unknown>, string] {
    const m = FRONTMATTER_RE.exec(text);
    if (m === null || m.index !== 0) {
        return [{}, text];
    }
    let fm: unknown;
    const loaded = yamlSafeLoad(m[1] as string);
    fm = loaded === null || loaded === undefined ? {} : loaded; // `... or {}`
    if (!isPlainObject(fm)) {
        fm = {};
    }
    const end = m.index + m[0].length;
    return [fm as Record<string, unknown>, text.slice(end)];
}

/**
 * Load + parse a role prompt → `{name,intent,inputs,output_shape,skill_hint,body}`.
 * Raises `PromptError` when the prompt file does not exist.
 */
function loadPrompt(role: string, prompt: string, root: string = ROLES_ROOT_DEFAULT): PromptSpec {
    const p = path.join(root, role, 'prompts', `${prompt}.md`);
    if (!isFile(p)) {
        throw new PromptError(`prompt not found: ${role}/${prompt}`);
    }
    const [fm, body] = _splitFrontmatter(fs.readFileSync(p, 'utf-8'));
    const rawInputs = fm['inputs'];
    const inputs: InputSpec[] = [];
    if (Array.isArray(rawInputs)) {
        for (const entry of rawInputs) {
            if (isPlainObject(entry) && typeof entry['name'] === 'string') {
                inputs.push({
                    name: entry['name'],
                    required: Boolean(entry['required'] ?? false),
                    shape: entry['shape'] ?? '',
                });
            }
        }
    }
    return {
        name: fm['name'] ?? prompt,
        intent: fm['intent'] ?? '',
        inputs,
        output_shape: fm['output_shape'] ?? '',
        skill_hint: pyOr(fm['skill_hint'], null), // `fm.get("skill_hint") or None`
        body,
    };
}

/** Python `a or b` truthiness for the `skill_hint` field. */
function pyOr<T>(a: unknown, b: T): unknown | T {
    if (a === null || a === undefined) return b;
    if (a === false) return b;
    if (a === '') return b;
    if (a === 0) return b;
    return a;
}

/**
 * Render a role prompt with `inputs` → `{rendered, skill_hint}`.
 * Raises `PromptError` on a missing required input or an undeclared
 * `{{placeholder}}` in the body.
 */
function render(
    role: string,
    prompt: string,
    inputs: Record<string, unknown>,
    root: string = ROLES_ROOT_DEFAULT,
): { rendered: string; skill_hint: unknown } {
    const spec = loadPrompt(role, prompt, root);
    const declared = new Set(spec.inputs.map((i) => i.name));
    const required = spec.inputs.filter((i) => i.required).map((i) => i.name);

    const isBlank = (v: unknown): boolean =>
        v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

    const missing = required.filter((nm) => isBlank(inputs[nm])).sort(pyStrCmp);
    if (missing.length > 0) {
        throw new PromptError('missing required input(s): ' + missing.join(', '));
    }

    // `set(PLACEHOLDER_RE.findall(body))` → captured group strings.
    const used = new Set<string>();
    for (const m of spec.body.matchAll(PLACEHOLDER_RE)) {
        used.add(m[1] as string);
    }
    const unknown = [...used].filter((nm) => !declared.has(nm)).sort(pyStrCmp);
    if (unknown.length > 0) {
        throw new PromptError('undeclared placeholder(s) in template: ' + unknown.join(', '));
    }

    // Single pass over the ORIGINAL body. Optional declared inputs that are
    // absent → empty string. A value of `None` → "".
    const rendered = spec.body.replace(PLACEHOLDER_RE, (_full, name: string) => {
        const has = Object.prototype.hasOwnProperty.call(inputs, name);
        const val = has ? inputs[name] : '';
        return val === null || val === undefined ? '' : pyStr(val);
    });
    return { rendered, skill_hint: spec.skill_hint };
}

/** Python's default string sort (code-point order on the UTF-16 surface used
 * here, which matches Python's code-point order for the ASCII identifier names
 * that pass `PLACEHOLDER_RE`). */
function pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** `Path.resolve()` — absolute, symlink-resolved where possible. */
function realResolve(p: string): string {
    try {
        return fs.realpathSync(path.resolve(p));
    } catch {
        return path.resolve(p);
    }
}

/**
 * The CLI root must be a `roles` directory (mirrors the other workspace CLIs'
 * `--root` discipline). Raises `SystemExit` (printing the ORIGINAL `root`) on
 * mismatch.
 */
function _validateCliRoot(root: string): string {
    const resolved = realResolve(root);
    if (path.basename(resolved) !== 'roles') {
        throw new SystemExitError(`--root must be an agents/roles directory; got '${root}'`);
    }
    return resolved;
}

function _loadInputsJson(spec: string | null): Record<string, unknown> {
    if (spec === null) {
        return {};
    }
    const raw = spec === '-' ? fs.readFileSync(0, 'utf-8') : fs.readFileSync(spec, 'utf-8');
    if (raw.trim() === '') {
        return {};
    }
    const data = jsonLoadsTagged(raw);
    // `not isinstance(data, dict)` — a tagged number (`PyNum`) is a JS object
    // but NOT a Python dict, so it must fail this check like an int/float/bool.
    if (!isPlainObject(data) || isPyNum(data)) {
        throw new SystemExitError('--inputs-json must contain a JSON object (name → value)');
    }
    return data;
}

interface ParsedArgs {
    cmd: string;
    role?: string;
    prompt?: string;
    inputs_json: string | null;
    root: string;
    rootGiven: boolean;
    json: boolean;
}

const PROG = 'workspace_render';

const USAGE = `usage: ${PROG} [-h] {render,inspect} ...\n`;
const USAGE_RENDER = `usage: ${PROG} render [-h] --role ROLE --prompt PROMPT [--inputs-json INPUTS_JSON] [--root ROOT] [--json]\n`;
const USAGE_INSPECT = `usage: ${PROG} inspect [-h] --role ROLE --prompt PROMPT [--root ROOT] [--json]\n`;

function _argError(usage: string, prog: string, msg: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${prog}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): ParsedArgs {
    let i = 0;
    if (i < argv.length && (argv[i] === '-h' || argv[i] === '--help')) {
        process.stdout.write(USAGE);
        throw new ArgparseExit(0);
    }
    if (i >= argv.length) {
        _argError(USAGE, PROG, 'the following arguments are required: cmd');
    }
    const cmd = argv[i] as string;
    i += 1;
    if (cmd !== 'render' && cmd !== 'inspect') {
        _argError(
            USAGE,
            PROG,
            `argument cmd: invalid choice: '${cmd}' (choose from 'render', 'inspect')`,
        );
    }
    const subUsage = cmd === 'render' ? USAGE_RENDER : USAGE_INSPECT;
    const subProg = `${PROG} ${cmd}`;
    const out: ParsedArgs = {
        cmd,
        inputs_json: null,
        root: ROLES_ROOT_DEFAULT,
        rootGiven: false,
        json: false,
    };
    // Leftovers (stray positionals + unknown optionals) are reported by
    // argparse as "unrecognized arguments" in their original argv order.
    const leftover: string[] = [];

    // Value-flag spec per subcommand. `--inputs-json` only on `render`.
    const takesValue = (flag: string): boolean =>
        flag === '--role' || flag === '--prompt' || flag === '--root' ||
        (cmd === 'render' && flag === '--inputs-json');

    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(subUsage);
            throw new ArgparseExit(0);
        }
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;

        if (cmd === 'render' && flag === '--json' && eq < 0) {
            out.json = true;
            i += 1;
            continue;
        }
        if (cmd === 'inspect' && flag === '--json' && eq < 0) {
            out.json = true;
            i += 1;
            continue;
        }
        if (takesValue(flag)) {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) {
                    _argError(subUsage, subProg, `argument ${flag}: expected one argument`);
                }
                value = argv[i + 1] as string;
                i += 1;
            }
            if (flag === '--role') out.role = value;
            else if (flag === '--prompt') out.prompt = value;
            else if (flag === '--root') {
                out.root = value;
                out.rootGiven = true;
            } else if (flag === '--inputs-json') out.inputs_json = value;
            i += 1;
            continue;
        }
        // Any other arg (unknown optional OR stray positional, including a
        // lone `-`) is a leftover, recorded in original order.
        leftover.push(a);
        i += 1;
    }

    // Required-argument check (argparse reports all missing required options).
    const missingReq: string[] = [];
    if (out.role === undefined) missingReq.push('--role');
    if (out.prompt === undefined) missingReq.push('--prompt');
    if (missingReq.length > 0) {
        _argError(subUsage, subProg, `the following arguments are required: ${missingReq.join(', ')}`);
    }

    if (leftover.length > 0) {
        _argError(USAGE, PROG, `unrecognized arguments: ${leftover.join(' ')}`);
    }
    return out;
}

export function main(argv: string[]): number {
    const args = _parse(argv);
    // `_validate_cli_root(args.root) if args.root != ROLES_ROOT_DEFAULT else args.root`
    // The Python default is a Path object equal only to the unchanged default;
    // any user-supplied --root (even a string equal to the default) triggers
    // validation. Mirror via the explicit `rootGiven` flag.
    const root = args.rootGiven ? _validateCliRoot(args.root) : args.root;

    if (args.cmd === 'inspect') {
        let spec: PromptSpec;
        try {
            spec = loadPrompt(args.role as string, args.prompt as string, root);
        } catch (err) {
            if (err instanceof PromptError) {
                throw new SystemExitError(err.message);
            }
            throw err;
        }
        const meta: Record<string, unknown> = {
            name: spec.name,
            intent: spec.intent,
            inputs: spec.inputs,
            output_shape: spec.output_shape,
            skill_hint: spec.skill_hint,
        };
        if (args.json) {
            print(jsonDumpsSorted(meta));
        } else {
            print(`${pyStr(meta['name'])} — ${pyStr(meta['intent'])}`);
            for (const inp of meta['inputs'] as InputSpec[]) {
                const req = inp.required ? 'required' : 'optional';
                print(`  - ${inp.name} (${req}): ${pyStr(inp.shape)}`);
            }
            const hint = meta['skill_hint'];
            print(`skill_hint: ${hint ? pyStr(hint) : '—'}`);
        }
        return 0;
    }

    if (args.cmd === 'render') {
        let result: { rendered: string; skill_hint: unknown };
        try {
            const inputs = _loadInputsJson(args.inputs_json);
            result = render(args.role as string, args.prompt as string, inputs, root);
        } catch (err) {
            if (err instanceof PromptError) {
                process.stderr.write(String(err.message) + '\n');
                return 1;
            }
            throw err;
        }
        if (args.json) {
            print(jsonDumpsSorted(result));
        } else {
            process.stdout.write(result.rendered);
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
        } else if (e instanceof SystemExitError) {
            // `raise SystemExit(str)` → message to stderr, exit 1.
            process.stderr.write(e.msg + '\n');
            process.exitCode = 1;
        } else if (e instanceof SyntaxError) {
            // `json.loads` failure surfaces as an uncaught traceback in Python
            // (exit 1); mirror by re-throwing so the runtime prints + exits 1.
            throw e;
        } else {
            throw e;
        }
    }
}

export {
    ArgparseExit,
    PromptError,
    SystemExitError,
    jsonDumpsSorted,
    loadPrompt,
    render,
    pyStr,
    pyFloatRepr,
};
