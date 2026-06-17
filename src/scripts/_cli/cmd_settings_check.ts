/**
 * `agent-config settings:check` — validate `.agent-settings.yml` against the
 * supported YAML subset (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_settings_check.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output. Read-only — no filesystem mutation, no network. No behaviour
 * changes; latent quirks are replicated and flagged inline, not fixed.
 *
 * The contract this checks against is pinned in
 * `docs/contracts/settings-sync-yaml-subset.md`; out-of-subset constructs
 * cause `sync_yaml_rt` to throw `ValueError` (here: `Error`) during a sync.
 * This CLI surfaces the same findings *before* a sync runs.
 *
 * Output line format:
 *
 *     line:N  <kind>  <verdict>  <fix hint>
 *
 * Exit codes:
 *
 * - `0` — file is inside the supported subset (or absent and `--allow-missing`).
 * - `1` — one or more findings (verdict `not supported`).
 * - `2` — file absent (without `--allow-missing`) or unreadable.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `process.exitCode` is set; `process.exit()` is never called. argparse
 *   usage errors throw `ArgparseExit(2)`; `-h`/`--help` throws `ArgparseExit(0)`
 *   after printing usage — both caught at the CLI entry guard.
 * - Python `f"{x:<N}"` left-justify (code-point width) → `_ljust(String(x), N)`.
 *   All padded fields are ASCII so code-point width == UTF-16 length here, but
 *   `_ljust` counts code points to stay faithful regardless.
 * - Python `re.compile(...)` patterns: every rule is anchored / literal ASCII;
 *   the JS `RegExp` equivalents use identical patterns. `pattern.search(s)` →
 *   `RegExp.test(s)` (search = unanchored find; patterns carry their own `^`).
 * - The round-trip parser gate imports the `sync_yaml_rt` `.ts` twin (eager
 *   static import; the Python lazy import is an import-resolution detail with
 *   no observable effect). `_rt.parse(text)` throwing → a `parser` finding with
 *   `hint = String(exc.message)`, matching the Python `str(exc)`.
 * - `str.strip()` (Python) strips Unicode whitespace; `\t in raw[:leadlen]`
 *   indent-tab detection mirrors the Python slice. JS `.trim()` strips a
 *   slightly different whitespace set, so leading/trailing whitespace handling
 *   uses an explicit Python-`str.strip`-faithful helper.
 */

import process from 'node:process';
import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';

import { parse as _rtParse } from '../sync_yaml_rt.js';

const DEFAULT_PATH = '.agent-settings.yml';

// ---------------------------------------------------------------------------
// Python-runtime parity helpers
// ---------------------------------------------------------------------------

/** argparse usage-error / help sentinel: exit 2 for errors, 0 for --help. */
class ArgparseExit extends Error {
    code: number;
    constructor(code: number) {
        super(`ArgparseExit(${code})`);
        this.name = 'ArgparseExit';
        this.code = code;
    }
}

interface OutSink {
    write(text: string): void;
}
function _stdoutSink(): OutSink {
    return { write: (t) => process.stdout.write(t) };
}
function _stderrSink(): OutSink {
    return { write: (t) => process.stderr.write(t) };
}
/** `print(line, file=out)` — append a trailing newline like Python's print. */
function _print(out: OutSink, line = ''): void {
    out.write(line + '\n');
}

/**
 * Python `str.ljust(width)` — left-justify, pad with spaces to `width`
 * **code points**. Python measures width in code points; mirror that.
 */
function _ljust(s: string, width: number): string {
    const len = [...s].length;
    if (len >= width) return s;
    return s + ' '.repeat(width - len);
}

/**
 * Python `str.isspace()` set (the chars `str.strip()` removes). Covers ASCII
 * whitespace + the Unicode space separators Python treats as whitespace.
 */
function _isPyWs(code: number): boolean {
    return (
        code === 0x09 || // \t
        code === 0x0a || // \n
        code === 0x0b || // \v
        code === 0x0c || // \f
        code === 0x0d || // \r
        code === 0x1c ||
        code === 0x1d ||
        code === 0x1e ||
        code === 0x1f ||
        code === 0x20 || // space
        code === 0x85 ||
        code === 0xa0 ||
        code === 0x1680 ||
        (code >= 0x2000 && code <= 0x200a) ||
        code === 0x2028 ||
        code === 0x2029 ||
        code === 0x202f ||
        code === 0x205f ||
        code === 0x3000
    );
}

/** Python `str.strip()` — strip leading + trailing Unicode whitespace. */
function _pyStrip(s: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && _isPyWs(s.charCodeAt(start))) start += 1;
    while (end > start && _isPyWs(s.charCodeAt(end - 1))) end -= 1;
    return s.slice(start, end);
}

/** Python `str.lstrip(" \t")` length — count leading spaces/tabs. */
function _leadWsLen(s: string): number {
    let i = 0;
    while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i += 1;
    return i;
}

/** Python `str.splitlines()` — split on the Python universal-newline set. */
function _splitlines(text: string): string[] {
    if (text === '') return [];
    // Python splitlines() splits on \n \r \r\n \v \f \x1c \x1d \x1e \x85
    // . The settings file is line-oriented text; match the full set so a
    // CR / LF mix in the source produces the same line count as Python.
    const out: string[] = [];
    let cur = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        if (ch === '\r') {
            if (text[i + 1] === '\n') i += 1;
            out.push(cur);
            cur = '';
        } else if (
            ch === '\n' ||
            code === 0x0b ||
            code === 0x0c ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029
        ) {
            out.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    if (cur !== '') out.push(cur);
    return out;
}

// ---------------------------------------------------------------------------
// Pre-scan rules — (label, regex, fix hint), mirroring _PRESCAN_RULES.
// ---------------------------------------------------------------------------

type PrescanRule = [string, RegExp, string];

const _PRESCAN_RULES: readonly PrescanRule[] = [
    [
        'multi-doc separator',
        /^(---|\.\.\.)\s*(#.*)?$/,
        'remove the separator — one YAML document per file only.',
    ],
    ['complex key', /^\?\s/, 'rewrite as a plain ``key: value`` mapping line.'],
    [
        'block-scalar indicator',
        /:\s*[|>][+-]?\s*(#.*)?$/,
        'inline the value as a single-line quoted scalar.',
    ],
    ['tagged scalar', /:\s*!!?[A-Za-z_]/, 'remove the ``!tag``; the parser does not honour it.'],
    [
        'anchor / alias',
        /:\s*[&*][A-Za-z_]/,
        'expand the anchor inline — anchors / aliases are not supported.',
    ],
    [
        'nested flow-mapping',
        /:\s*\{[^}]*:[^}]*\}/,
        'rewrite as a block-style nested mapping (indented child keys).',
    ],
];

interface Finding {
    line: number;
    kind: string;
    verdict: string;
    hint: string;
}

function _scan_line(stripped: string): [string, string] | null {
    if (!stripped || stripped.startsWith('#')) {
        return null;
    }
    for (const [label, pattern, hint] of _PRESCAN_RULES) {
        if (pattern.test(stripped)) {
            return [label, hint];
        }
    }
    return null;
}

function _scan_text(text: string): Finding[] {
    const findings: Finding[] = [];
    const lines = _splitlines(text);
    for (let idx = 0; idx < lines.length; idx++) {
        const raw = lines[idx] as string;
        const lineno = idx + 1;
        const stripped = _pyStrip(raw);
        // Python: `raw[: len(raw) - len(raw.lstrip(" \t"))]` — the leading-WS
        // run; flag a tab anywhere in it.
        const lead = raw.slice(0, _leadWsLen(raw));
        if (lead.includes('\t')) {
            findings.push({
                line: lineno,
                kind: 'tab in indent',
                verdict: 'not supported',
                hint: 'replace leading tabs with 2 or 4 spaces.',
            });
            continue;
        }
        const hit = _scan_line(stripped);
        if (hit !== null) {
            const [label, hint] = hit;
            findings.push({
                line: lineno,
                kind: label,
                verdict: 'not supported',
                hint,
            });
        }
    }
    return findings;
}

function _format(finding: Finding): string {
    return (
        `  ❌  line:${_ljust(String(finding.line), 4)}  ` +
        `${_ljust(finding.kind, 22)}  ${_ljust(finding.verdict, 14)}  ${finding.hint}`
    );
}

// ---------------------------------------------------------------------------
// arg parsing — mirrors argparse flags + usage / error exits
// ---------------------------------------------------------------------------

interface Opts {
    path: string;
    allow_missing: boolean;
    quiet: boolean;
}

function _parse(argv: string[], out: OutSink, err: OutSink): Opts {
    const prog = 'agent-config settings:check';
    // argparse wraps the usage to terminal width; the `[--quiet]` option wraps
    // to a continuation line indented to `len("usage: ") + len(prog) + 1` (35).
    const usage =
        `usage: ${prog} [-h] [--path PATH] [--allow-missing]\n` +
        `${' '.repeat(35)}[--quiet]\n`;

    const emitError = (msg: string): never => {
        err.write(usage);
        err.write(`${prog}: error: ${msg}\n`);
        throw new ArgparseExit(2);
    };

    const opts: Opts = { path: DEFAULT_PATH, allow_missing: false, quiet: false };

    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        if (tok === '-h' || tok === '--help') {
            out.write(usage);
            throw new ArgparseExit(0);
        } else if (tok === '--path') {
            const val: string | undefined = argv[i + 1];
            if (val === undefined) {
                emitError('argument --path: expected one argument');
            }
            opts.path = val as string;
            i += 2;
        } else if (tok.startsWith('--path=')) {
            opts.path = tok.slice('--path='.length);
            i += 1;
        } else if (tok === '--allow-missing') {
            opts.allow_missing = true;
            i += 1;
        } else if (tok === '--quiet') {
            opts.quiet = true;
            i += 1;
        } else {
            emitError(`unrecognized arguments: ${tok}`);
        }
    }
    return opts;
}

interface MainOptions {
    out?: OutSink;
    err?: OutSink;
}

export function main(argv: string[] | null = null, options: MainOptions = {}): number {
    const out = options.out ?? _stdoutSink();
    const err = options.err ?? _stderrSink();
    const opts = _parse(argv ?? process.argv.slice(2), out, err);

    const target = opts.path;
    // Python `Path(opts.path).is_file()`.
    let isFile: boolean;
    try {
        isFile = fs.statSync(target).isFile();
    } catch {
        isFile = false;
    }
    if (!isFile) {
        if (opts.allow_missing) {
            if (!opts.quiet) {
                _print(out, `✅  ${target}: file absent (allow-missing).`);
            }
            return 0;
        }
        _print(err, `❌  ${target}: file not found.`);
        _print(err, '    Run `./agent-config sync-agent-settings` to create it.');
        return 2;
    }

    let text: string;
    try {
        text = fs.readFileSync(target, { encoding: 'utf-8' });
    } catch (exc) {
        _print(err, `❌  ${target}: cannot read: ${(exc as Error).message}`);
        return 2;
    }

    const findings = _scan_text(text);
    if (findings.length === 0) {
        // Final gate: run the round-trip parser to catch anything the pre-scan
        // missed (mismatched indent, malformed mapping lines).
        try {
            _rtParse(text);
        } catch (exc) {
            findings.push({
                line: 0,
                kind: 'parser',
                verdict: 'not supported',
                hint: String((exc as Error).message),
            });
        }
    }

    if (findings.length === 0) {
        if (!opts.quiet) {
            _print(
                out,
                `✅  ${target}: inside the supported subset ` +
                    '(docs/contracts/settings-sync-yaml-subset.md).',
            );
        }
        return 0;
    }
    _print(err, `❌  ${target}: ${findings.length} finding(s) outside the supported subset.`);
    for (const finding of findings) {
        _print(err, _format(finding));
    }
    _print(err, '');
    _print(err, '    Contract: docs/contracts/settings-sync-yaml-subset.md');
    return 1;
}

// CLI entry guard — set process.exitCode; never call process.exit().
const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
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
