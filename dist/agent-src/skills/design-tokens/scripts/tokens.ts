#!/usr/bin/env tsx
/**
 * design-tokens · tokens — DTCG token toolchain (generate / validate / embed).
 *
 * TypeScript twin of `src/skills/design-tokens/scripts/tokens.py` (ADR-094
 * py2ts). The CLI contract is mirrored EXACTLY — the subcommands
 * `generate` / `validate` / `embed`, their flags, exit codes, the
 * stdout/stderr split, byte-identical messages, AND byte-identical generated
 * output (the CSS / Tailwind config / embedded CSS / JSON findings are all
 * write/print targets, so every byte — key order, quoting, whitespace,
 * `json.dumps` separators — must match python3).
 *
 * No behaviour changes — latent Python quirks are replicated verbatim:
 *   - `re.findall` group semantics (the hexColor pattern has a capture group,
 *     so `findall` yields the group captures, not whole matches; the scanner
 *     re-derives the whole match via `search().group(0)`).
 *   - one finding per pattern per line (the `break` after the first hit).
 *   - `str.strip("{}")` strips the {} *character set* off both ends.
 *   - `Path.rglob("*")` sorted order; `.blade.php` two-suffix detection.
 *   - `json.dumps(..., indent=2)` with the DEFAULT `ensure_ascii=True`
 *     (non-ASCII → `\uXXXX`, astral → surrogate pairs).
 *
 * Pure stdlib (Node builtins only) · read-only except `generate -o` · no
 * network · no subprocess. A `.ts` MUST NOT import a `.py`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ── Python-shim helpers ──────────────────────────────────────────────────

type Json = unknown;
type JsonObject = Record<string, Json>;

function _isPlainObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Mirror `str.strip(chars)` — strip the given char *set* off both ends. */
function _stripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) {
        start += 1;
    }
    while (end > start && chars.includes(s[end - 1] as string)) {
        end -= 1;
    }
    return s.slice(start, end);
}

/** Mirror `str.strip()` over ASCII + common Unicode whitespace. */
function _strip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/** Code-point count, mirroring Python `len(str)`. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

// ── json.dumps(..., indent=2, ensure_ascii=True) byte-parity ─────────────
//
// The default `ensure_ascii=True` escapes every code point >= 0x80 as a
// `\uXXXX` sequence (astral chars become a UTF-16 surrogate pair, exactly as
// CPython emits them). Integer-valued numbers stay integers (no `.0`) since
// the only numbers we ever dump are violation line numbers (ints).

function _pyJsonStr(s: string): string {
    let out = '"';
    // Iterate UTF-16 code units so astral chars emit surrogate pairs like CPython.
    for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];
        const code = s.charCodeAt(i);
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
                if (code < 0x20 || code > 0x7e) {
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    out += ch;
                }
        }
    }
    return out + '"';
}

function _pyJsonNum(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return String(n);
}

function _pyJsonScalar(value: unknown): string | null {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _pyJsonNum(value);
    }
    if (typeof value === 'string') {
        return _pyJsonStr(value);
    }
    return null;
}

/** Mirror `json.dumps(obj, indent=2)` (ensure_ascii=True). */
function _pyDumpsIndent2(value: unknown, depth = 0): string {
    const scalar = _pyJsonScalar(value);
    if (scalar !== null) {
        return scalar;
    }
    const pad = ' '.repeat(2 * (depth + 1));
    const closePad = ' '.repeat(2 * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _pyDumpsIndent2(v, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (_isPlainObject(value)) {
        const keys = Object.keys(value);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map(
            (k) => `${pad}${_pyJsonStr(k)}: ${_pyDumpsIndent2(value[k], depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _pyJsonStr(String(value));
}

// --------------------------------------------------------------- generate

/** Resolve `{primitive.color.blue.600}`-style references recursively. */
export function resolveReference(value: Json, tokens: JsonObject): Json {
    if (typeof value !== 'string' || !value.startsWith('{')) {
        return value;
    }
    const stripped = _stripChars(value, '{}');
    const pathParts = stripped.split('.');
    let node: Json = tokens;
    for (const key of pathParts) {
        if (!_isPlainObject(node)) {
            return value;
        }
        node = node[key] === undefined ? null : node[key];
        if (node === null) {
            return value;
        }
    }
    if (_isPlainObject(node) && '$value' in node) {
        return resolveReference(node['$value'], tokens);
    }
    return node !== null ? node : value;
}

/** Flatten a DTCG token tree into `--css-var → resolved value`. */
export function flattenTokens(
    obj: JsonObject,
    tokens: JsonObject,
    prefix: string[] | null = null,
    result: Record<string, Json> | null = null,
): Record<string, Json> {
    const pfx = prefix || [];
    const res = result !== null ? result : {};
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        const current = [...pfx, key];
        if (_isPlainObject(value)) {
            if ('$value' in value) {
                const cssVar = '--' + current.join('-').replace(/\./g, '-');
                res[cssVar] = resolveReference(value['$value'], tokens);
            } else {
                flattenTokens(value, tokens, current, res);
            }
        }
    }
    return res;
}

/** Mirror `(d.get(k) or {})` — None / missing / falsy → `{}`. */
function _orEmpty(v: Json): JsonObject {
    if (_isPlainObject(v)) {
        // A non-empty dict is truthy; an empty dict ({}) is falsy in Python,
        // but `{} or {}` is still `{}`, so returning it is correct either way.
        return v;
    }
    return {};
}

export function generateCss(tokens: JsonObject): string {
    const primitive = flattenTokens(_orEmpty(tokens['primitive']), tokens, ['primitive']);
    const semantic = flattenTokens(_orEmpty(tokens['semantic']), tokens, []);
    const component = flattenTokens(_orEmpty(tokens['component']), tokens, []);
    const dark = flattenTokens(_orEmpty(_orEmpty(tokens['dark'])['semantic']), tokens, []);

    const block = (entries: Record<string, Json>): string =>
        Object.keys(entries)
            .map((k) => `  ${k}: ${_pyValueStr(entries[k])};`)
            .join('\n');

    let css =
        '/* Design Tokens - Auto-generated */\n' +
        '/* Do not edit directly - modify tokens.json instead */\n\n' +
        `/* === PRIMITIVES === */\n:root {\n${block(primitive)}\n}\n\n` +
        `/* === SEMANTIC === */\n:root {\n${block(semantic)}\n}\n\n` +
        `/* === COMPONENTS === */\n:root {\n${block(component)}\n}\n`;
    if (_pyTruthy(dark)) {
        css += `\n/* === DARK MODE === */\n.dark {\n${block(dark)}\n}\n`;
    }
    return css;
}

export function generateTailwind(tokens: JsonObject): string {
    const semantic = flattenTokens(_orEmpty(tokens['semantic']), tokens, []);
    const colors: Record<string, string> = {};
    for (const key of Object.keys(semantic)) {
        if (key.includes('color')) {
            const newKey = key.replace('--color-', '').replace(/-/g, '.');
            colors[newKey] = `var(${key})`;
        }
    }
    const body = _pyDumpsIndent2(colors).replace(/"/g, "'");
    return (
        '// Tailwind color config - Auto-generated\n' +
        '// Add to tailwind.config.ts theme.extend.colors\n\n' +
        `module.exports = {\n  colors: ${body}\n};\n`
    );
}

// --------------------------------------------------------------- validate

interface Pattern {
    regex: RegExp;
    message: string;
    suggestion: string;
}

// Insertion order mirrors the Python `PATTERNS` dict (hexColor → rgbColor →
// pixelValue → remValue). Object key order is preserved in JS.
const PATTERNS: Record<string, Pattern> = {
    hexColor: {
        // `#([0-9A-Fa-f]{3}){1,2}\b` — has a capture group (matters for findall).
        regex: /#([0-9A-Fa-f]{3}){1,2}\b/,
        message: 'Hardcoded hex color',
        suggestion: 'Use var(--color-*) token',
    },
    rgbColor: {
        regex: /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/i,
        message: 'Hardcoded RGB(A) color',
        suggestion: 'Use var(--color-*) token',
    },
    pixelValue: {
        regex: /:\s*(\d{2,})px/,
        message: 'Hardcoded pixel value',
        suggestion: 'Use var(--space-*) or var(--radius-*) token',
    },
    remValue: {
        regex: /:\s*\d+\.?\d*rem/,
        message: 'Hardcoded rem value',
        suggestion: 'Use var(--space-*) or var(--font-size-*) token',
    },
};

const EXTENSIONS = new Set([
    '.css', '.scss', '.tsx', '.jsx', '.ts', '.js', '.vue',
    '.svelte', '.html', '.blade.php',
]);
const SKIP_FILE_PATTERNS: RegExp[] = [
    /\.min\.(css|js)$/,
    /tailwind\.config/,
    /globals\.css/,
    /tokens\.(css|json)/,
];
const HEX_EXCEPTIONS = new Set(['#000', '#FFF', '#000000', '#FFFFFF']);
const DEFAULT_IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'vendor']);
const ALLOWED_HOST_HINTS = [
    'fonts.googleapis.com', 'fonts.gstatic.com', 'unsplash.com', 'pexels.com',
];

interface Violation {
    file: string;
    line: number;
    type: string;
    value: string;
    message: string;
    suggestion: string;
    context: string;
    kind: string;
}

/** Recursively list files under `root`, mirroring `Path.rglob("*")` sorted. */
function _rglobSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            out.push(full);
            if (ent.isDirectory() && !ent.isSymbolicLink()) {
                walk(full);
            }
        }
    };
    walk(root);
    // `sorted(root.rglob("*"))` sorts the PosixPath objects lexicographically
    // by their string form.
    out.sort();
    return out;
}

function _suffix(p: string): string {
    const name = path.basename(p);
    const idx = name.lastIndexOf('.');
    if (idx <= 0) {
        return '';
    }
    return name.slice(idx);
}

function _iterFiles(root: string, ignore: Set<string>): string[] {
    const files: string[] = [];
    for (const p of _rglobSorted(root)) {
        // `any(part in ignore for part in path.parts)` — split on the OS sep.
        const parts = p.split(path.sep);
        if (parts.some((part) => ignore.has(part))) {
            continue;
        }
        const name = path.basename(p);
        const suffix = name.endsWith('.blade.php') ? '.blade.php' : _suffix(p);
        let isFile = false;
        try {
            isFile = fs.statSync(p).isFile();
        } catch {
            isFile = false;
        }
        if (isFile && EXTENSIONS.has(suffix)) {
            if (SKIP_FILE_PATTERNS.some((pat) => pat.test(p))) {
                continue;
            }
            files.push(p);
        }
    }
    return files;
}

/**
 * Mirror Python `regex.findall(line)` for the four patterns used here.
 * - Patterns with NO capture group → returns each whole match.
 * - The hexColor pattern (one capture group) → returns the GROUP capture per
 *   match (Python `findall` semantics). The scanner re-derives the whole
 *   match separately, so the *content* of these does not matter — only the
 *   count (≥1 ⇒ at least one finding candidate).
 */
function _findall(regex: RegExp, line: string): string[] {
    const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
    const g = new RegExp(regex.source, flags);
    const res: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = g.exec(line)) !== null) {
        // Python findall: with one group → the group; without → whole match.
        res.push(m.length > 1 ? (m[1] ?? '') : m[0]);
        if (m.index === g.lastIndex) {
            g.lastIndex += 1;
        }
    }
    return res;
}

/** Mirror `regex.search(line).group(0)` — the first whole match, or null. */
function _searchGroup0(regex: RegExp, line: string): string | null {
    const flags = regex.flags.replace('g', '');
    const s = new RegExp(regex.source, flags);
    const m = s.exec(line);
    return m ? m[0] : null;
}

export function scanFile(p: string): Violation[] {
    const violations: Violation[] = [];
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return violations;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const lineno = i + 1;
        const line = lines[i] as string;
        const stripped = _strip(line);
        if (
            stripped.startsWith('//') ||
            stripped.startsWith('/*') ||
            stripped.startsWith('*') ||
            line.includes('var(--')
        ) {
            continue;
        }
        if (ALLOWED_HOST_HINTS.some((host) => line.includes(host))) {
            continue;
        }
        for (const kind of Object.keys(PATTERNS)) {
            const { regex, message, suggestion } = PATTERNS[kind] as Pattern;
            const matches = _findall(regex, line);
            for (const match of matches) {
                let value: string = match;
                if (kind === 'hexColor') {
                    const whole = _searchGroup0(regex, line) as string;
                    if (HEX_EXCEPTIONS.has(whole.toUpperCase())) {
                        continue;
                    }
                    value = whole;
                }
                violations.push({
                    file: p,
                    line: lineno,
                    type: kind,
                    value,
                    message,
                    suggestion,
                    context: _sliceCodePoints(stripped, 80),
                    // Maps onto the UI directive set's finding kind so the
                    // polish step can auto-convert against audit tokens.
                    kind: 'token_violation',
                });
                break; // one finding per pattern per line is enough
            }
        }
    }
    return violations;
}

/** Mirror Python `s[:80]` over code points. */
function _sliceCodePoints(s: string, n: number): string {
    let out = '';
    let count = 0;
    for (const ch of s) {
        if (count >= n) {
            break;
        }
        out += ch;
        count += 1;
    }
    return out;
}

export function formatReport(violations: Violation[]): string {
    if (violations.length === 0) {
        return '✅ No token violations found';
    }
    const out: string[] = [`⚠️  Found ${violations.length} potential token violations:`, ''];
    const byFile = new Map<string, Violation[]>();
    for (const v of violations) {
        if (!byFile.has(v.file)) {
            byFile.set(v.file, []);
        }
        byFile.get(v.file)!.push(v);
    }
    for (const [file, items] of byFile) {
        out.push(`📁 ${file}`);
        for (const v of items) {
            out.push(
                `   Line ${v.line}: ${v.message}`,
                `   Found: ${v.value}`,
                `   Suggestion: ${v.suggestion}`,
                `   Context: ${v.context}`,
                '',
            );
        }
    }
    const counts = new Map<string, number>();
    for (const v of violations) {
        counts.set(v.message, (counts.get(v.message) ?? 0) + 1);
    }
    out.push('📊 Summary:');
    for (const [msg, n] of counts) {
        out.push(`   ${msg}: ${n}`);
    }
    return out.join('\n');
}

// --------------------------------------------------------------- embed

const MINIMAL_TOKEN_PREFIXES = [
    '--primitive-spacing-', '--primitive-fontSize-', '--primitive-fontWeight-',
    '--primitive-lineHeight-', '--primitive-radius-', '--primitive-shadow-glow-',
    '--primitive-gradient-', '--primitive-duration-', '--color-primary',
    '--color-secondary', '--color-accent', '--color-background',
    '--color-surface', '--color-foreground', '--color-border',
    '--typography-font-', '--card-',
];

/** Mirror `re.findall(pat, s)` for patterns WITHOUT a capture group. */
function _findallNoGroup(pattern: RegExp, s: string): string[] {
    const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
    const g = new RegExp(pattern.source, flags);
    const res: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = g.exec(s)) !== null) {
        res.push(m[0]);
        if (m.index === g.lastIndex) {
            g.lastIndex += 1;
        }
    }
    return res;
}

/** Mirror `re.findall(r":root\s*\{([^}]+)\}", css)` — returns the group capture. */
function _findallRootBlocks(css: string): string[] {
    const g = /:root\s*\{([^}]+)\}/g;
    const res: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = g.exec(css)) !== null) {
        res.push(m[1] as string);
        if (m.index === g.lastIndex) {
            g.lastIndex += 1;
        }
    }
    return res;
}

export function extractTokens(css: string, minimal = false): string {
    const blocks = _findallRootBlocks(css);
    let allVars: string[] = [];
    for (const block of blocks) {
        allVars = allVars.concat(_findallNoGroup(/--[\w-]+:\s*[^;]+;/, block));
    }
    if (minimal) {
        allVars = allVars.filter((v) => MINIMAL_TOKEN_PREFIXES.some((p) => v.includes(p)));
    }
    const seen: string[] = [];
    for (const v of allVars) {
        if (!seen.includes(v)) {
            seen.push(v);
        }
    }
    return ':root {\n  ' + seen.join('\n  ') + '\n}';
}

// --------------------------------------------------------------- shims

/** Mirror Python truthiness for the values this module dumps. */
function _pyTruthy(v: Json): boolean {
    if (v === null || v === undefined || v === false) {
        return false;
    }
    if (v === true) {
        return true;
    }
    if (typeof v === 'number') {
        return v !== 0;
    }
    if (typeof v === 'string') {
        return v.length > 0;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (_isPlainObject(v)) {
        return Object.keys(v).length > 0;
    }
    return Boolean(v);
}

/**
 * Mirror Python f-string interpolation of a resolved token value into CSS.
 * Resolved values are nearly always strings; non-strings fall back to
 * Python's `str()` semantics for the scalars that can appear here.
 */
function _pyValueStr(v: Json): string {
    if (typeof v === 'string') {
        return v;
    }
    if (v === null || v === undefined) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    if (typeof v === 'number') {
        return _pyJsonNum(v);
    }
    return String(v);
}

// --------------------------------------------------------------- CLI

interface ArgvError extends Error {
    code: number;
}

function _argError(msg: string): ArgvError {
    const e = new Error(msg) as ArgvError;
    e.code = 2;
    return e;
}

const PROG = 'tokens';

function _usageError(message: string): never {
    // argparse prints a usage line + error to stderr and exits 2. We don't
    // byte-compare argparse output (per the task), so emit a faithful-enough
    // diagnostic and signal exit 2 via a thrown ArgvError the caller maps.
    process.stderr.write(`${PROG}: error: ${message}\n`);
    throw _argError(message);
}

interface GenerateArgs {
    op: 'generate';
    config: string;
    output: string | null;
    format: 'css' | 'tailwind';
}
interface ValidateArgs {
    op: 'validate';
    dir: string;
    ignore: string[];
    json: boolean;
}
interface EmbedArgs {
    op: 'embed';
    tokens: string;
    minimal: boolean;
    style: boolean;
}
type ParsedArgs = GenerateArgs | ValidateArgs | EmbedArgs;

function _takeValue(
    argv: string[],
    i: number,
    flag: string,
): { value: string; next: number } {
    // Support `--flag value` and `--flag=value` / short `-f value` forms.
    const tok = argv[i] as string;
    const eq = tok.indexOf('=');
    if (tok.startsWith('--') && eq !== -1) {
        return { value: tok.slice(eq + 1), next: i + 1 };
    }
    if (i + 1 >= argv.length) {
        _usageError(`argument ${flag}: expected one argument`);
    }
    return { value: argv[i + 1] as string, next: i + 2 };
}

function _parseArgs(argv: string[]): ParsedArgs {
    if (argv.length === 0) {
        _usageError('the following arguments are required: op');
    }
    const op = argv[0] as string;
    const rest = argv.slice(1);

    if (op === 'generate') {
        let config: string | null = null;
        let output: string | null = null;
        let format: 'css' | 'tailwind' = 'css';
        let i = 0;
        while (i < rest.length) {
            const t = rest[i] as string;
            const base = t.split('=')[0];
            if (base === '--config' || base === '-c') {
                const r = _takeValue(rest, i, '--config/-c');
                config = r.value;
                i = r.next;
            } else if (base === '--output' || base === '-o') {
                const r = _takeValue(rest, i, '--output/-o');
                output = r.value;
                i = r.next;
            } else if (base === '--format' || base === '-f') {
                const r = _takeValue(rest, i, '--format/-f');
                if (r.value !== 'css' && r.value !== 'tailwind') {
                    _usageError(
                        `argument --format/-f: invalid choice: '${r.value}' (choose from 'css', 'tailwind')`,
                    );
                }
                format = r.value;
                i = r.next;
            } else {
                _usageError(`unrecognized arguments: ${t}`);
            }
        }
        if (config === null) {
            _usageError('the following arguments are required: --config/-c');
        }
        return { op: 'generate', config, output, format };
    }

    if (op === 'validate') {
        let dir: string | null = null;
        const ignore: string[] = [];
        let json = false;
        let i = 0;
        while (i < rest.length) {
            const t = rest[i] as string;
            const base = t.split('=')[0];
            if (base === '--dir' || base === '-d') {
                const r = _takeValue(rest, i, '--dir/-d');
                dir = r.value;
                i = r.next;
            } else if (base === '--ignore' || base === '-i') {
                const r = _takeValue(rest, i, '--ignore/-i');
                ignore.push(r.value);
                i = r.next;
            } else if (base === '--json') {
                json = true;
                i += 1;
            } else {
                _usageError(`unrecognized arguments: ${t}`);
            }
        }
        if (dir === null) {
            _usageError('the following arguments are required: --dir/-d');
        }
        return { op: 'validate', dir, ignore, json };
    }

    if (op === 'embed') {
        let tokens: string | null = null;
        let minimal = false;
        let style = false;
        let i = 0;
        while (i < rest.length) {
            const t = rest[i] as string;
            const base = t.split('=')[0];
            if (base === '--tokens' || base === '-t') {
                const r = _takeValue(rest, i, '--tokens/-t');
                tokens = r.value;
                i = r.next;
            } else if (base === '--minimal') {
                minimal = true;
                i += 1;
            } else if (base === '--style') {
                style = true;
                i += 1;
            } else {
                _usageError(`unrecognized arguments: ${t}`);
            }
        }
        if (tokens === null) {
            _usageError('the following arguments are required: --tokens/-t');
        }
        return { op: 'embed', tokens, minimal, style };
    }

    _usageError(
        `argument op: invalid choice: '${op}' (choose from 'generate', 'validate', 'embed')`,
    );
}

export function main(argv: string[] | null = null): number {
    const args = argv === null ? process.argv.slice(2) : argv;
    let parsed: ParsedArgs;
    try {
        parsed = _parseArgs(args);
    } catch (e) {
        if (e && typeof e === 'object' && 'code' in e) {
            return (e as ArgvError).code;
        }
        throw e;
    }

    if (parsed.op === 'generate') {
        const config = parsed.config;
        if (!_exists(config)) {
            process.stderr.write(`Error: Config file not found: ${config}\n`);
            return 1;
        }
        const tokens = JSON.parse(fs.readFileSync(config, 'utf-8')) as JsonObject;
        const output =
            parsed.format === 'tailwind' ? generateTailwind(tokens) : generateCss(tokens);
        if (parsed.output) {
            const out = parsed.output;
            const dir = path.dirname(out);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(out, output, 'utf-8');
            process.stdout.write(`Generated: ${out}\n`);
        } else {
            process.stdout.write(output + '\n');
        }
        return 0;
    }

    if (parsed.op === 'validate') {
        const root = parsed.dir;
        if (!_exists(root)) {
            process.stderr.write(`Error: Directory not found: ${root}\n`);
            return 1;
        }
        const ignore = new Set([...DEFAULT_IGNORE, ...parsed.ignore]);
        let violations: Violation[] = [];
        for (const file of _iterFiles(root, ignore)) {
            violations = violations.concat(scanFile(file));
        }
        if (parsed.json) {
            process.stdout.write(_pyDumpsIndent2(violations) + '\n');
        } else {
            process.stdout.write(formatReport(violations) + '\n');
        }
        return violations.length > 0 ? 1 : 0;
    }

    // embed
    const tokensPath = parsed.tokens;
    if (!_exists(tokensPath)) {
        process.stderr.write(`Error: tokens css not found: ${tokensPath}\n`);
        return 1;
    }
    const output = extractTokens(fs.readFileSync(tokensPath, 'utf-8'), parsed.minimal);
    const header = '/* Design Tokens (embedded for standalone HTML) */';
    if (parsed.style) {
        process.stdout.write(`<style>\n${header}\n${output}\n</style>\n`);
    } else {
        process.stdout.write(`${header}\n${output}\n`);
    }
    return 0;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

// `raise SystemExit(main())` — set process.exitCode, never call process.exit.
const _INVOKED_DIRECTLY =
    typeof process.argv[1] === 'string' &&
    import.meta.url === pathToFileURL(process.argv[1]).href;

if (_INVOKED_DIRECTLY) {
    process.exitCode = main();
}

export {
    PATTERNS,
    EXTENSIONS,
    SKIP_FILE_PATTERNS,
    HEX_EXCEPTIONS,
    DEFAULT_IGNORE,
    ALLOWED_HOST_HINTS,
    MINIMAL_TOKEN_PREFIXES,
    _pyDumpsIndent2,
    _pyLen,
};
