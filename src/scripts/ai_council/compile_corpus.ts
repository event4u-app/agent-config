/**
 * Compile the human-edited low-impact corpus Markdown to a YAML lockfile.
 *
 * TypeScript twin of `src/scripts/ai_council/compile_corpus.py`
 * (ADR-094 — Python→TS migration, Phase 1).
 *
 * Step-10 — see `agents/roadmaps/step-10-corpus-yaml-lockfile.md`.
 *
 * Markdown (`agents/decisions/low-impact-decisions.md`) stays the
 * human-authored source-of-truth for PR review. This script reads it
 * through the hardened {@link parse_corpus_strict} parser and writes a YAML
 * lockfile that becomes the **runtime** source-of-truth. The pattern mirrors
 * `dist/agent-src/` vs `.agent-src.uncondensed/`: human edits Markdown,
 * `task consistency` enforces lockfile parity via the same
 * `git diff --quiet` gate.
 *
 * YAML schema (`schema_version: 1`):
 *
 *     schema_version: 1
 *     provenance:
 *       source_path: agents/decisions/low-impact-decisions.md
 *       source_sha256: <hex>             # SHA-256 of the parsed Markdown bytes
 *       last_upstreamed: <40-hex sha>     # mirrored from the Markdown footer
 *     validated:
 *       - phrase: "raw bullet text"
 *         normalised: "raw bullet text"
 *         line_no: 42
 *         trailing_metadata: "validated 2025-01-15"
 *     probation: [...]
 *     anti_examples: [...]
 *
 * Determinism: sorted keys disabled (preserve schema order), entries
 * ordered by `line_no`, single trailing newline. The YAML emitter mirrors
 * PyYAML `safe_dump` with `allow_unicode=True` byte-for-byte so phrases with
 * non-ASCII characters round-trip unchanged.
 *
 * Failure-mode contract:
 *
 * - Parser raises {@link CorpusParseError} -> compiler exits non-zero, does
 *   NOT write a partial lockfile.
 * - `--check` mode compares the freshly compiled output against the
 *   committed lockfile and exits non-zero on drift (CI gate).
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    CorpusParseError,
    type CorpusEntry,
    type CorpusParseResult,
    parse_corpus_strict,
} from './low_impact_corpus.js';

export const SCHEMA_VERSION = 1;

// Python: re.compile(r"^last-upstreamed:\s*([0-9a-f]{40})\s*$", re.MULTILINE)
// \s is Unicode in Python; emulate with the explicit Unicode whitespace class.
const _SP = '[ \\t\\f\\v\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff\\u0085]';
const _LAST_UPSTREAMED_RE = new RegExp(
    `^last-upstreamed:${_SP}*([0-9a-f]{40})${_SP}*$`,
    'mu',
);

const _DEFAULT_SOURCE = 'agents/decisions/low-impact-decisions.md';
const _DEFAULT_OUT = 'agents/decisions/low-impact-decisions.lock.yaml';

/** Schema-stable mapping for one corpus entry (section dropped). */
type EntryDict = {
    phrase: string;
    normalised: string;
    line_no: number;
    trailing_metadata: string;
};

/** The schema-v1 document shape. */
interface LockDocument {
    schema_version: number;
    provenance: {
        source_path: string;
        source_sha256: string;
        last_upstreamed: string;
    };
    validated: EntryDict[];
    probation: EntryDict[];
    anti_examples: EntryDict[];
}

/** Serialise a {@link CorpusEntry} to a schema-stable mapping. */
function _entryToDict(entry: CorpusEntry): EntryDict {
    // Python: asdict(entry); data.pop("section", None). Section is implicit by
    // the parent key, so it is dropped to keep the YAML lean.
    return {
        phrase: entry.phrase,
        normalised: entry.normalised,
        line_no: entry.line_no,
        trailing_metadata: entry.trailing_metadata,
    };
}

/** Read the provenance SHA from the Markdown footer; `""` if absent. */
function _extractLastUpstreamed(text: string): string {
    const m = _LAST_UPSTREAMED_RE.exec(text);
    return m ? (m[1] as string) : '';
}

/**
 * Return `path` as a POSIX string relative to cwd when possible.
 *
 * Absolute paths inside the current working directory are stripped to their
 * relative form so the committed lockfile carries
 * `agents/decisions/low-impact-decisions.md` regardless of how the compiler
 * was invoked (CLI default, absolute path from a test, etc.).
 */
function _normaliseSourcePath(p: string): string {
    let rel: string;
    const resolved = path.resolve(p);
    const cwd = path.resolve(process.cwd());
    // Python: path.resolve().relative_to(Path.cwd().resolve()) — only succeeds
    // when resolved is inside cwd; otherwise fall back to the basename.
    if (resolved === cwd) {
        rel = '.';
    } else if (resolved.startsWith(cwd + path.sep)) {
        rel = resolved.slice(cwd.length + 1);
    } else {
        rel = _basename(p);
    }
    return rel.replace(/\\/gu, '/');
}

/** Python `Path(p).name`. */
function _basename(p: string): string {
    // pathlib drops trailing slashes before taking the final component.
    let s = p;
    while (s.length > 1 && s.endsWith('/')) {
        s = s.slice(0, -1);
    }
    const i = s.lastIndexOf('/');
    return i < 0 ? s : s.slice(i + 1);
}

/** Return the schema-v1 mapping for `parseResult`. */
export function build_lock_document(
    sourcePath: string,
    parseResult: CorpusParseResult,
    sourceText: string,
): LockDocument {
    const sha256 = createHash('sha256').update(Buffer.from(sourceText, 'utf-8')).digest('hex');
    return {
        schema_version: SCHEMA_VERSION,
        provenance: {
            source_path: _normaliseSourcePath(sourcePath),
            source_sha256: sha256,
            last_upstreamed: _extractLastUpstreamed(sourceText),
        },
        validated: parseResult.validated.map(_entryToDict),
        probation: parseResult.probation.map(_entryToDict),
        anti_examples: parseResult.anti_examples.map(_entryToDict),
    };
}

/** Serialise `document` deterministically to YAML text (PyYAML parity). */
export function dump_lock_yaml(document: LockDocument): string {
    // Mirror yaml.safe_dump(sort_keys=False, allow_unicode=True,
    // default_flow_style=False, width=10_000): block style, single trailing
    // newline.
    const lines: string[] = [];
    _emitMapping(document as unknown as Record<string, unknown>, 0, lines);
    return lines.join('\n') + '\n';
}

/** Read `source_path` Markdown, write YAML lockfile to `out_path`. */
export function compile_corpus(sourcePath: string, outPath: string): string {
    const sourceText = fs.existsSync(sourcePath)
        ? fs.readFileSync(sourcePath, { encoding: 'utf-8' })
        : '';
    const parseResult = parse_corpus_strict(sourcePath);
    const document = build_lock_document(sourcePath, parseResult, sourceText);
    const yamlText = dump_lock_yaml(document);
    fs.mkdirSync(_dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, yamlText, { encoding: 'utf-8' });
    return yamlText;
}

/** Python `Path(p).parent` (used for mkdir of the out-file's directory). */
function _dirname(p: string): string {
    const i = p.lastIndexOf('/');
    if (i < 0) {
        return '.';
    }
    if (i === 0) {
        return '/';
    }
    return p.slice(0, i);
}

// ── PyYAML safe_dump emitter (block style, width=10000) ──────────────────────
// Faithful port of the subset of PyYAML's emitter that this document shape
// exercises: a top-level mapping of scalar→{scalar|mapping|list}, lists of
// mappings whose leaf values are str|int. width=10000 means the line-wrapping
// branches in PyYAML's writers never fire for the short single-line content
// here, so single-/double-quoted writers reduce to escape-then-wrap.

const _BEST_INDENT = 2;

function _emitMapping(map: Record<string, unknown>, indent: number, out: string[]): void {
    const pad = ' '.repeat(indent);
    for (const [key, value] of Object.entries(map)) {
        const keyStr = _scalarToYaml(key, false);
        if (_isPlainMapping(value)) {
            const child = value as Record<string, unknown>;
            if (Object.keys(child).length === 0) {
                out.push(`${pad}${keyStr}: {}`);
            } else {
                out.push(`${pad}${keyStr}:`);
                _emitMapping(child, indent + _BEST_INDENT, out);
            }
        } else if (Array.isArray(value)) {
            if (value.length === 0) {
                out.push(`${pad}${keyStr}: []`);
            } else {
                out.push(`${pad}${keyStr}:`);
                // PyYAML block sequence under a mapping key: indentless, so the
                // `- ` indicator sits at the parent's indent.
                _emitSequence(value, indent, out);
            }
        } else {
            out.push(`${pad}${keyStr}: ${_scalarToYaml(value, false)}`);
        }
    }
}

function _emitSequence(seq: unknown[], indent: number, out: string[]): void {
    const pad = ' '.repeat(indent);
    for (const item of seq) {
        if (_isPlainMapping(item)) {
            const child = item as Record<string, unknown>;
            const lines = _emitMappingInline(child, indent + _BEST_INDENT);
            // First key follows "- " on the same line; rest indented.
            out.push(`${pad}- ${lines[0]}`);
            for (let i = 1; i < lines.length; i += 1) {
                out.push(`${pad}  ${lines[i]}`);
            }
        } else {
            out.push(`${pad}- ${_scalarToYaml(item, false)}`);
        }
    }
}

/** Emit a mapping's `key: value` lines (no leading pad); for inline-in-list use. */
function _emitMappingInline(map: Record<string, unknown>, _indent: number): string[] {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(map)) {
        const keyStr = _scalarToYaml(key, false);
        lines.push(`${keyStr}: ${_scalarToYaml(value, false)}`);
    }
    return lines;
}

function _isPlainMapping(v: unknown): v is Record<string, unknown> {
    return (
        v !== null &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        Object.getPrototypeOf(v) === Object.prototype
    );
}

/** Render one scalar value (str | int) the way PyYAML safe_dump would. */
function _scalarToYaml(value: unknown, simpleKeyContext: boolean): string {
    if (typeof value === 'number') {
        // Only ints appear in this document; render via Python int repr.
        return String(Math.trunc(value));
    }
    const text = String(value);
    const style = _chooseScalarStyle(text, simpleKeyContext);
    if (style === '"') {
        return _writeDoubleQuoted(text);
    }
    if (style === "'") {
        return _writeSingleQuoted(text);
    }
    return text; // plain
}

// ── PyYAML resolver: would a plain string be implicitly re-typed? ────────────
// Mirrors yaml.resolver.Resolver implicit resolvers for the SafeDumper.

const _RESOLVER_BOOL = /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/u;
const _RESOLVER_NULL = /^(?:~|null|Null|NULL|)$/u;
const _RESOLVER_FLOAT =
    /^(?:[-+]?(?:[0-9][0-9_]*)\.[0-9_]*(?:[eE][-+][0-9]+)?|\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/u;
const _RESOLVER_INT =
    /^(?:[-+]?0b[0-1_]+|[-+]?0[0-7_]+|[-+]?(?:0|[1-9][0-9_]*)|[-+]?0x[0-9a-fA-F_]+|[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)$/u;
const _RESOLVER_TIMESTAMP =
    /^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]|[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?(?:[Tt]|[ \t]+)[0-9][0-9]?:[0-9][0-9]:[0-9][0-9](?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)$/u;
const _RESOLVER_MERGE = /^(?:<<)$/u;
const _RESOLVER_VALUE = /^(?:=)$/u;
const _RESOLVER_YAML = /^(?:!|&|\*)$/u;

// First-char → ordered resolver list, mirroring registration order in
// resolver.py (bool, float, int, merge, null, timestamp, value, yaml).
// Only the leading char gates which resolvers run; order within is the
// registration order of add_implicit_resolver calls.
const _RESOLVERS_BY_FIRST: Record<string, RegExp[]> = {};
function _registerResolver(rx: RegExp, firsts: string): void {
    for (const ch of firsts) {
        if (!(ch in _RESOLVERS_BY_FIRST)) {
            _RESOLVERS_BY_FIRST[ch] = [];
        }
        (_RESOLVERS_BY_FIRST[ch] as RegExp[]).push(rx);
    }
}
// Registration order matches PyYAML Resolver.add_implicit_resolver calls.
_registerResolver(_RESOLVER_BOOL, 'yYnNtTfFoO');
_registerResolver(_RESOLVER_FLOAT, '-+0123456789.');
_registerResolver(_RESOLVER_INT, '-+0123456789');
_registerResolver(_RESOLVER_MERGE, '<');
_registerResolver(_RESOLVER_NULL, '~nN\0'); // '' handled separately
_registerResolver(_RESOLVER_TIMESTAMP, '0123456789');
_registerResolver(_RESOLVER_VALUE, '=');
_registerResolver(_RESOLVER_YAML, '!&*');
// Empty-string resolves to null (registered under the '' key in PyYAML).
const _RESOLVERS_EMPTY: RegExp[] = [_RESOLVER_NULL];

/** True when `value`, emitted plain, would NOT resolve back to str. */
function _wouldRetype(value: string): boolean {
    const resolvers = value === '' ? _RESOLVERS_EMPTY : _RESOLVERS_BY_FIRST[value[0] as string] ?? [];
    for (const rx of resolvers) {
        if (rx.test(value)) {
            return true;
        }
    }
    return false;
}

// ── PyYAML analyze_scalar (block-context decision) ───────────────────────────

interface ScalarAnalysis {
    empty: boolean;
    multiline: boolean;
    allowBlockPlain: boolean;
    allowSingleQuoted: boolean;
}

const _WS_SET = new Set(['\0', ' ', '\t', '\r', '\n', '\x85', '\u2028', '\u2029']);
const _BREAK_SET = new Set(['\n', '\x85', '\u2028', '\u2029']);

function _isPrintableAscii(ch: string): boolean {
    return ch >= '\x20' && ch <= '\x7e';
}

function _isAllowedUnicode(ch: string): boolean {
    // matches PyYAML allow_unicode branch (ch != BOM)
    return (
        (ch === '\x85' ||
            (ch >= '\xa0' && ch <= '\ud7ff') ||
            (ch >= '\ue000' && ch <= '\ufffd') ||
            (ch >= '\u{10000}' && ch < '\u{10ffff}')) &&
        ch !== '\ufeff'
    );
}

function _analyzeScalar(scalar: string): ScalarAnalysis {
    if (scalar === '') {
        return { empty: true, multiline: false, allowBlockPlain: true, allowSingleQuoted: true };
    }
    const chars = Array.from(scalar); // iterate by code point, like Python str

    let blockIndicators = false;
    let lineBreaks = false;
    let specialCharacters = false;

    let leadingSpace = false;
    let leadingBreak = false;
    let trailingSpace = false;
    let trailingBreak = false;
    let breakSpace = false;
    let spaceBreak = false;

    if (scalar.startsWith('---') || scalar.startsWith('...')) {
        blockIndicators = true;
    }

    let precededByWhitespace = true;
    let followedByWhitespace = chars.length === 1 || _WS_SET.has(chars[1] as string);
    let previousSpace = false;
    let previousBreak = false;

    let index = 0;
    while (index < chars.length) {
        const ch = chars[index] as string;

        if (index === 0) {
            if ('#,[]{}&*!|>\'"%@`'.includes(ch)) {
                blockIndicators = true;
            }
            if (ch === '?' || ch === ':') {
                if (followedByWhitespace) {
                    blockIndicators = true;
                }
            }
            if (ch === '-' && followedByWhitespace) {
                blockIndicators = true;
            }
        } else {
            if (ch === ':' && followedByWhitespace) {
                blockIndicators = true;
            }
            if (ch === '#' && precededByWhitespace) {
                blockIndicators = true;
            }
        }

        if (_BREAK_SET.has(ch)) {
            lineBreaks = true;
        }
        if (!(ch === '\n' || _isPrintableAscii(ch))) {
            if (_isAllowedUnicode(ch)) {
                // allow_unicode=True → not special
            } else {
                specialCharacters = true;
            }
        }

        if (ch === ' ') {
            if (index === 0) {
                leadingSpace = true;
            }
            if (index === chars.length - 1) {
                trailingSpace = true;
            }
            if (previousBreak) {
                breakSpace = true;
            }
            previousSpace = true;
            previousBreak = false;
        } else if (_BREAK_SET.has(ch)) {
            if (index === 0) {
                leadingBreak = true;
            }
            if (index === chars.length - 1) {
                trailingBreak = true;
            }
            if (previousSpace) {
                spaceBreak = true;
            }
            previousSpace = false;
            previousBreak = true;
        } else {
            previousSpace = false;
            previousBreak = false;
        }

        index += 1;
        precededByWhitespace = _WS_SET.has(ch);
        followedByWhitespace =
            index + 1 >= chars.length || _WS_SET.has(chars[index + 1] as string);
    }

    let allowBlockPlain = true;
    let allowSingleQuoted = true;

    if (leadingSpace || leadingBreak || trailingSpace || trailingBreak) {
        allowBlockPlain = false;
    }
    if (breakSpace) {
        allowBlockPlain = false;
        allowSingleQuoted = false;
    }
    if (spaceBreak || specialCharacters) {
        allowBlockPlain = false;
        allowSingleQuoted = false;
    }
    if (lineBreaks) {
        allowBlockPlain = false;
    }
    if (blockIndicators) {
        allowBlockPlain = false;
    }

    return { empty: false, multiline: lineBreaks, allowBlockPlain, allowSingleQuoted };
}

/** Mirror PyYAML Emitter.choose_scalar_style for block context, default style. */
function _chooseScalarStyle(text: string, simpleKeyContext: boolean): '' | "'" | '"' {
    const analysis = _analyzeScalar(text);
    // implicit[0] is true unless the plain form would re-type away from str.
    const implicit0 = !_wouldRetype(text);
    if (implicit0) {
        if (
            !(simpleKeyContext && (analysis.empty || analysis.multiline)) &&
            !analysis.empty &&
            analysis.allowBlockPlain
        ) {
            // Note: allow_block_plain already false for empty; the explicit
            // empty guard mirrors PyYAML returning '' only when plain allowed.
            return '';
        }
    }
    if (analysis.allowSingleQuoted && !(simpleKeyContext && analysis.multiline)) {
        return "'";
    }
    return '"';
}

/** PyYAML write_single_quoted with width=10000 (no wrapping). */
function _writeSingleQuoted(text: string): string {
    return "'" + text.replace(/'/gu, "''") + "'";
}

const _ESCAPE_REPLACEMENTS: Record<string, string> = {
    '\x00': '0',
    '\x07': 'a',
    '\x08': 'b',
    '\t': 't',
    '\n': 'n',
    '\x0b': 'v',
    '\x0c': 'f',
    '\r': 'r',
    '\x1b': 'e',
    '"': '"',
    '\\': '\\',
    '\x85': 'N',
    '\xa0': '_',
    '\u2028': 'L',
    '\u2029': 'P',
};

/** PyYAML write_double_quoted with width=10000 + allow_unicode=True. */
function _writeDoubleQuoted(text: string): string {
    let out = '"';
    for (const ch of text) {
        const needsEscape =
            ch === '"' ||
            ch === '\\' ||
            ch === '\x85' ||
            ch === '\u2028' ||
            ch === '\u2029' ||
            ch === '\ufeff' ||
            !(_isPrintableAscii(ch) || (ch >= '\xa0' && ch <= '\ud7ff') || (ch >= '\ue000' && ch <= '\ufffd'));
        if (!needsEscape) {
            out += ch;
            continue;
        }
        if (ch in _ESCAPE_REPLACEMENTS) {
            out += '\\' + _ESCAPE_REPLACEMENTS[ch];
        } else {
            const cp = ch.codePointAt(0) as number;
            if (cp <= 0xff) {
                out += '\\x' + cp.toString(16).toUpperCase().padStart(2, '0');
            } else if (cp <= 0xffff) {
                out += '\\u' + cp.toString(16).toUpperCase().padStart(4, '0');
            } else {
                out += '\\U' + cp.toString(16).toUpperCase().padStart(8, '0');
            }
        }
    }
    out += '"';
    return out;
}

// ── CLI entry-point (argparse parity) ────────────────────────────────────────

function _prog(): string {
    return 'compile_corpus';
}

class _ExitSignal extends Error {
    constructor(readonly code: number) {
        super(`exit ${code}`);
    }
}

const _USAGE = `usage: ${_prog()} [-h] [--source SOURCE] [--out OUT] [--check]`;

const _HELP =
    `${_USAGE}\n\n` +
    'Compile low-impact-decisions.md to YAML lockfile.\n\n' +
    'optional arguments:\n' +
    '  -h, --help       show this help message and exit\n' +
    '  --source SOURCE\n' +
    '  --out OUT\n' +
    '  --check          Exit non-zero if the lockfile is stale (CI gate).\n';

function _argError(message: string): never {
    process.stderr.write(`${_USAGE}\n`);
    process.stderr.write(`${_prog()}: error: ${message}\n`);
    process.exitCode = 2;
    throw new _ExitSignal(2);
}

interface _Args {
    source: string;
    out: string;
    check: boolean;
}

function _parseArgs(args: string[]): _Args {
    let source = _DEFAULT_SOURCE;
    let out = _DEFAULT_OUT;
    let check = false;
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(_HELP);
            throw new _ExitSignal(0);
        } else if (a === '--source') {
            const v = args[i + 1];
            if (v === undefined) {
                _argError('argument --source: expected one argument');
            }
            source = v as string;
            i += 1;
        } else if (a.startsWith('--source=')) {
            source = a.slice('--source='.length);
        } else if (a === '--out') {
            const v = args[i + 1];
            if (v === undefined) {
                _argError('argument --out: expected one argument');
            }
            out = v as string;
            i += 1;
        } else if (a.startsWith('--out=')) {
            out = a.slice('--out='.length);
        } else if (a === '--check') {
            check = true;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return { source, out, check };
}

export function _main(argv: string[]): number {
    let args: _Args;
    try {
        args = _parseArgs(argv);
    } catch (exc) {
        if (exc instanceof _ExitSignal) {
            return exc.code;
        }
        throw exc;
    }
    try {
        if (!args.check) {
            compile_corpus(args.source, args.out);
        } else {
            const sourceText = fs.existsSync(args.source)
                ? fs.readFileSync(args.source, { encoding: 'utf-8' })
                : '';
            const parseResult = parse_corpus_strict(args.source);
            const document = build_lock_document(args.source, parseResult, sourceText);
            const fresh = dump_lock_yaml(document);
            const existing = fs.existsSync(args.out)
                ? fs.readFileSync(args.out, { encoding: 'utf-8' })
                : '';
            if (fresh !== existing) {
                process.stderr.write(
                    `low-impact corpus lockfile is stale: ${args.out}\n` +
                        '  run: python3 -m scripts.ai_council.compile_corpus\n',
                );
                return 1;
            }
        }
    } catch (exc) {
        if (exc instanceof CorpusParseError) {
            process.stderr.write(`corpus parse failed: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = _main(process.argv.slice(2));
}
