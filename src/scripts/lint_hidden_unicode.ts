// P1.1 — hidden-Unicode / smuggling-codepoint linter (road-to-security-pillar.md).
//
// Ported from the retired Python `src/scripts/lint_hidden_unicode.py` (ADR-200 —
// Python→TS migration). Behaviour mirrors the Python module byte-for-byte.
//
// Detects the invisible-character class used by the "rules-file backdoor"
// attack: instructions a human reviewer cannot see but the model reads. The
// codepoint set covers bidi controls (Trojan Source), zero-width / format
// chars, the Unicode Tag block, variation-selector runs, Private Use Area,
// and stray C0/C1 controls.
//
// Scope: every `.md` under src/{skills,rules,agent-src,domains} + frontmatter.
// Containment: a real teaching doc never needs the *actual* invisible char (it
// writes ``U+200B`` as text), so this linter scans even inside ordinary code
// fences; only a ```security-example fence or a `security-lint: allow
// hidden-unicode` pragma exempts a file/region.
//
// Exit 0 clean, 1 on any blocking finding. ``--fix`` writes an NFKC-normalised,
// zero-width-stripped sibling ``<file>.sanitized`` for human review.
//
// Unicode parity: Python iterates by code point and reports
// `file:line:codepoint:name` via `unicodedata.name(ch, "<unnamed>")`. JS has no
// `unicodedata`, so the exact CPython names for the *finite* set of codepoints
// this linter can ever report (the three explicit sets + the named Tag-block
// entries) are embedded in `_CP_NAME`, generated from CPython. Every other
// classified codepoint (PUA, C0/C1 controls, unnamed Tag-block) falls back to
// the same `"<unnamed>"` default the .py passes to `unicodedata.name`.
//
// Usage: ./scripts-run src/scripts/lint_hidden_unicode [--json] [--fix]

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as sl from './_lib/security_lint.js';

export const CHECK = 'hidden-unicode';

// (codepoint sets) — ordered by specificity.
const _BIDI: ReadonlySet<number> = new Set([
    0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x200e, 0x200f, 0x061c,
]);
const _ZERO_WIDTH: ReadonlySet<number> = new Set([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x00ad]);
const _DEPRECATED: ReadonlySet<number> = new Set([
    0x206a, 0x206b, 0x206c, 0x206d, 0x206e, 0x206f, 0xfff9, 0xfffa, 0xfffb,
]);

export function _classify(cp: number): string | null {
    if (_BIDI.has(cp)) {
        return 'bidi-control';
    }
    if (_ZERO_WIDTH.has(cp)) {
        return 'zero-width';
    }
    if (cp >= 0xe0000 && cp <= 0xe007f) {
        return 'unicode-tag';
    }
    if (_DEPRECATED.has(cp)) {
        return 'deprecated-format';
    }
    if (
        (cp >= 0xe000 && cp <= 0xf8ff) ||
        (cp >= 0xf0000 && cp <= 0xffffd) ||
        (cp >= 0x100000 && cp <= 0x10fffd)
    ) {
        return 'private-use-area';
    }
    // C0/C1 controls except tab/newline/CR
    if (((cp >= 0x00 && cp <= 0x1f) || (cp >= 0x7f && cp <= 0x9f)) &&
        cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) {
        return 'control-char';
    }
    return null;
}

// Variation selectors flagged only in runs of >=3 on one line (steganography).
// Restricted to the SUPPLEMENTARY block (U+E0100–E01EF).
const _VS_LO = 0xe0100;
const _VS_HI = 0xe01ef; // inclusive; Python set(range(0xE0100, 0xE01F0))
function _isVS(cp: number): boolean {
    return cp >= _VS_LO && cp <= _VS_HI;
}

// Exact CPython `unicodedata.name(chr(cp))` for every codepoint this linter
// can flag *and* that has a name. Generated from CPython. Everything not here
// → the `"<unnamed>"` default (PUA, C0/C1 controls, Tag-block E0000).
const _CP_NAME: Readonly<Record<number, string>> = {
    0x00ad: 'SOFT HYPHEN',
    0x061c: 'ARABIC LETTER MARK',
    0x200b: 'ZERO WIDTH SPACE',
    0x200c: 'ZERO WIDTH NON-JOINER',
    0x200d: 'ZERO WIDTH JOINER',
    0x200e: 'LEFT-TO-RIGHT MARK',
    0x200f: 'RIGHT-TO-LEFT MARK',
    0x202a: 'LEFT-TO-RIGHT EMBEDDING',
    0x202b: 'RIGHT-TO-LEFT EMBEDDING',
    0x202c: 'POP DIRECTIONAL FORMATTING',
    0x202d: 'LEFT-TO-RIGHT OVERRIDE',
    0x202e: 'RIGHT-TO-LEFT OVERRIDE',
    0x2060: 'WORD JOINER',
    0x2066: 'LEFT-TO-RIGHT ISOLATE',
    0x2067: 'RIGHT-TO-LEFT ISOLATE',
    0x2068: 'FIRST STRONG ISOLATE',
    0x2069: 'POP DIRECTIONAL ISOLATE',
    0x206a: 'INHIBIT SYMMETRIC SWAPPING',
    0x206b: 'ACTIVATE SYMMETRIC SWAPPING',
    0x206c: 'INHIBIT ARABIC FORM SHAPING',
    0x206d: 'ACTIVATE ARABIC FORM SHAPING',
    0x206e: 'NATIONAL DIGIT SHAPES',
    0x206f: 'NOMINAL DIGIT SHAPES',
    0xfeff: 'ZERO WIDTH NO-BREAK SPACE',
    0xfff9: 'INTERLINEAR ANNOTATION ANCHOR',
    0xfffa: 'INTERLINEAR ANNOTATION SEPARATOR',
    0xfffb: 'INTERLINEAR ANNOTATION TERMINATOR',
    0xe0001: 'LANGUAGE TAG',
    0xe0020: 'TAG SPACE',
    0xe0021: 'TAG EXCLAMATION MARK',
    0xe0022: 'TAG QUOTATION MARK',
    0xe0023: 'TAG NUMBER SIGN',
    0xe0024: 'TAG DOLLAR SIGN',
    0xe0025: 'TAG PERCENT SIGN',
    0xe0026: 'TAG AMPERSAND',
    0xe0027: 'TAG APOSTROPHE',
    0xe0028: 'TAG LEFT PARENTHESIS',
    0xe0029: 'TAG RIGHT PARENTHESIS',
    0xe002a: 'TAG ASTERISK',
    0xe002b: 'TAG PLUS SIGN',
    0xe002c: 'TAG COMMA',
    0xe002d: 'TAG HYPHEN-MINUS',
    0xe002e: 'TAG FULL STOP',
    0xe002f: 'TAG SOLIDUS',
    0xe0030: 'TAG DIGIT ZERO',
    0xe0031: 'TAG DIGIT ONE',
    0xe0032: 'TAG DIGIT TWO',
    0xe0033: 'TAG DIGIT THREE',
    0xe0034: 'TAG DIGIT FOUR',
    0xe0035: 'TAG DIGIT FIVE',
    0xe0036: 'TAG DIGIT SIX',
    0xe0037: 'TAG DIGIT SEVEN',
    0xe0038: 'TAG DIGIT EIGHT',
    0xe0039: 'TAG DIGIT NINE',
    0xe003a: 'TAG COLON',
    0xe003b: 'TAG SEMICOLON',
    0xe003c: 'TAG LESS-THAN SIGN',
    0xe003d: 'TAG EQUALS SIGN',
    0xe003e: 'TAG GREATER-THAN SIGN',
    0xe003f: 'TAG QUESTION MARK',
    0xe0040: 'TAG COMMERCIAL AT',
    0xe0041: 'TAG LATIN CAPITAL LETTER A',
    0xe0042: 'TAG LATIN CAPITAL LETTER B',
    0xe0043: 'TAG LATIN CAPITAL LETTER C',
    0xe0044: 'TAG LATIN CAPITAL LETTER D',
    0xe0045: 'TAG LATIN CAPITAL LETTER E',
    0xe0046: 'TAG LATIN CAPITAL LETTER F',
    0xe0047: 'TAG LATIN CAPITAL LETTER G',
    0xe0048: 'TAG LATIN CAPITAL LETTER H',
    0xe0049: 'TAG LATIN CAPITAL LETTER I',
    0xe004a: 'TAG LATIN CAPITAL LETTER J',
    0xe004b: 'TAG LATIN CAPITAL LETTER K',
    0xe004c: 'TAG LATIN CAPITAL LETTER L',
    0xe004d: 'TAG LATIN CAPITAL LETTER M',
    0xe004e: 'TAG LATIN CAPITAL LETTER N',
    0xe004f: 'TAG LATIN CAPITAL LETTER O',
    0xe0050: 'TAG LATIN CAPITAL LETTER P',
    0xe0051: 'TAG LATIN CAPITAL LETTER Q',
    0xe0052: 'TAG LATIN CAPITAL LETTER R',
    0xe0053: 'TAG LATIN CAPITAL LETTER S',
    0xe0054: 'TAG LATIN CAPITAL LETTER T',
    0xe0055: 'TAG LATIN CAPITAL LETTER U',
    0xe0056: 'TAG LATIN CAPITAL LETTER V',
    0xe0057: 'TAG LATIN CAPITAL LETTER W',
    0xe0058: 'TAG LATIN CAPITAL LETTER X',
    0xe0059: 'TAG LATIN CAPITAL LETTER Y',
    0xe005a: 'TAG LATIN CAPITAL LETTER Z',
    0xe005b: 'TAG LEFT SQUARE BRACKET',
    0xe005c: 'TAG REVERSE SOLIDUS',
    0xe005d: 'TAG RIGHT SQUARE BRACKET',
    0xe005e: 'TAG CIRCUMFLEX ACCENT',
    0xe005f: 'TAG LOW LINE',
    0xe0060: 'TAG GRAVE ACCENT',
    0xe0061: 'TAG LATIN SMALL LETTER A',
    0xe0062: 'TAG LATIN SMALL LETTER B',
    0xe0063: 'TAG LATIN SMALL LETTER C',
    0xe0064: 'TAG LATIN SMALL LETTER D',
    0xe0065: 'TAG LATIN SMALL LETTER E',
    0xe0066: 'TAG LATIN SMALL LETTER F',
    0xe0067: 'TAG LATIN SMALL LETTER G',
    0xe0068: 'TAG LATIN SMALL LETTER H',
    0xe0069: 'TAG LATIN SMALL LETTER I',
    0xe006a: 'TAG LATIN SMALL LETTER J',
    0xe006b: 'TAG LATIN SMALL LETTER K',
    0xe006c: 'TAG LATIN SMALL LETTER L',
    0xe006d: 'TAG LATIN SMALL LETTER M',
    0xe006e: 'TAG LATIN SMALL LETTER N',
    0xe006f: 'TAG LATIN SMALL LETTER O',
    0xe0070: 'TAG LATIN SMALL LETTER P',
    0xe0071: 'TAG LATIN SMALL LETTER Q',
    0xe0072: 'TAG LATIN SMALL LETTER R',
    0xe0073: 'TAG LATIN SMALL LETTER S',
    0xe0074: 'TAG LATIN SMALL LETTER T',
    0xe0075: 'TAG LATIN SMALL LETTER U',
    0xe0076: 'TAG LATIN SMALL LETTER V',
    0xe0077: 'TAG LATIN SMALL LETTER W',
    0xe0078: 'TAG LATIN SMALL LETTER X',
    0xe0079: 'TAG LATIN SMALL LETTER Y',
    0xe007a: 'TAG LATIN SMALL LETTER Z',
    0xe007b: 'TAG LEFT CURLY BRACKET',
    0xe007c: 'TAG VERTICAL LINE',
    0xe007d: 'TAG RIGHT CURLY BRACKET',
    0xe007e: 'TAG TILDE',
    0xe007f: 'CANCEL TAG',
};

/** Mirror `unicodedata.name(ch, "<unnamed>")` for the bounded flagged set. */
function _cpName(cp: number): string {
    const n = _CP_NAME[cp];
    return n !== undefined ? n : '<unnamed>';
}

export function _scan(sf: sl.ScannedFile): sl.Finding[] {
    if (sf.pragma_allows(CHECK)) {
        return [];
    }
    const out: sl.Finding[] = [];
    for (const [lineno, text] of sf.iter_lines({ skip_example_fence: true })) {
        let vs_run = 0;
        for (const ch of text) {
            const cp = ch.codePointAt(0) as number;
            if (_isVS(cp)) {
                vs_run += 1;
                continue;
            }
            const kind = _classify(cp);
            if (kind) {
                const name = _cpName(cp);
                out.push(
                    new sl.Finding(
                        sf.rel,
                        lineno,
                        CHECK,
                        'HIGH',
                        `${kind} U+${cp.toString(16).toUpperCase().padStart(4, '0')} (${name})`,
                        sf.weight,
                    ),
                );
            }
        }
        if (vs_run >= 3) {
            out.push(
                new sl.Finding(
                    sf.rel,
                    lineno,
                    CHECK,
                    'HIGH',
                    `variation-selector run x${vs_run} (steganography signature)`,
                    sf.weight,
                ),
            );
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Source-file pass — raw C0 control bytes make a text file INVISIBLE to tools
// ---------------------------------------------------------------------------
//
// The `.md` corpus pass above defends the model's eyes. This pass defends the
// *reviewer's* and the *gate's* eyes, which is a different failure.
//
// A raw control byte (NUL above all) in a text-intended source file makes
// `file(1)`, `grep`, and every tool that sniffs for binary content classify the
// file as binary and SKIP IT SILENTLY. A linter grepping such a file reads
// nothing and reports clean; an agent gathering evidence concludes the code
// does not exist. That is indistinguishable from a pass, which is the point.
//
// Discovered the hard way: `road-to-runtime-encoding-hardening` was authored on
// the premise that `memory_lookup.ts` had "zero imports" and that the sanitize
// floor therefore ran nowhere. The file simply carried a raw NUL as a composite
// map-key separator, so `grep` never read it. The premise was a measurement
// artifact. See `agents/evidence/reports/nul-byte-source-census.md`.
//
// Precision by construction — this pass flags ONLY raw C0 controls, never the
// invisible/confusable classes `_scan` owns. In a `.ts` file a real bidi or
// zero-width codepoint is usually a deliberate test fixture or a regex
// character class (this repo has several, legitimately), so flagging those here
// would demand an allowlist that grows until the gate is worthless. A raw
// control byte has NO legitimate use in text-intended source: the language
// escape (`\0`, `\x01`) compiles to the identical runtime string and keeps the
// file readable by tools. The fix is always available, so the false-positive
// rate is structurally zero rather than merely low.

/** Extensions whose content is legitimately binary — never flagged. */
const _BINARY_EXT: ReadonlySet<string> = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp', 'avif', 'bmp', 'tiff',
    'pdf', 'woff', 'woff2', 'ttf', 'otf', 'eot',
    'zip', 'gz', 'tgz', 'bz2', 'xz', 'zst', '7z', 'rar',
    'wasm', 'mp3', 'mp4', 'wav', 'ogg', 'webm', 'mov', 'avi',
    'so', 'dylib', 'dll', 'node', 'a', 'o', 'exe',
    'jar', 'class', 'pyc', 'pyo',
    'db', 'sqlite', 'sqlite3', 'bin', 'dat',
    'docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'odt', 'ods', 'odp',
]);

/**
 * Generated trees — skipped, because this is an AUTHORING rule.
 *
 * `dist/` and the per-tool projections are outputs of `src/` (see the
 * `source-of-truth` rule: a projection is never edited by hand). Flagging a
 * control byte there would point the author at a file they must not touch, and
 * `dist/install/*.mjs` is a bundler artifact whose bytes are not even
 * hand-authorable. Fix the source; the projection follows on `task sync`.
 */
const _GENERATED_PREFIXES: readonly string[] = [
    'dist/',
    '.augment/',
    '.claude/',
    '.cursor/',
    '.clinerules/',
    // Verbatim captured tool output, not authored text. These are RECORDINGS:
    // escaping a control byte inside one would falsify the record it exists to
    // preserve. If a capture needs to stay grep-readable, the fix is to escape
    // at capture time — never to edit the artifact afterwards.
    'agents/evidence/analysis/',
    // The frozen hostile-encoding corpus. Its positives ARE raw control
    // characters — that is the thing under test, so flagging them would demand
    // escaping the fixtures and thereby delete the test. The corpus has its own,
    // stronger integrity controls: a sha256 freeze plus a scope-guard test that
    // is itself falsified by an out-of-scope fixture. Excluded here because it
    // is DATA, on the same principle as the captures above.
    'internal/bench/corpora/encoding-channels/',
];

function _isGenerated(rel: string): boolean {
    return _GENERATED_PREFIXES.some((p) => rel.startsWith(p));
}

/**
 * True for a raw control CODEPOINT that is not benign whitespace.
 *
 * Codepoints, not bytes, and that distinction is the whole point. A first cut
 * of this pass tested bytes ≤ 0x1F and let two classes through: DEL (U+007F,
 * a single byte above the range) and the C1 controls (U+0080–009F, which encode
 * to a two-byte UTF-8 sequence containing no byte ≤ 0x1F). Both make `file(1)`
 * and git classify a file as binary — `tests/scripts/retrieval_sanitize.test.ts`
 * carried U+007F and U+009F, rendered as `Bin` in `git diff`, unreviewable on a
 * PR, and passed the byte-level check. A gate that misses the thing it exists to
 * catch is the failure this whole roadmap is about, so the range now matches
 * `_classify`'s: C0 + DEL + C1, minus tab / LF / CR.
 */
function _isRawControlCodepoint(cp: number): boolean {
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) return false;
    return cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f);
}

function _extensionOf(rel: string): string {
    const base = rel.slice(rel.lastIndexOf('/') + 1);
    const dot = base.lastIndexOf('.');
    return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase();
}

/** Tracked files, or `null` when git is unavailable (then the pass no-ops). */
function _trackedFiles(): string[] | null {
    const res = spawnSync('git', ['ls-files', '-z'], {
        cwd: sl.ROOT,
        maxBuffer: 64 * 1024 * 1024,
    });
    if (res.status !== 0 || res.stdout === null) return null;
    return res.stdout
        .toString('utf-8')
        .split('\0')
        .filter((p) => p !== '');
}

/**
 * Tracked files this pass is responsible for — text-intended, non-generated.
 *
 * Exported so a green run can state HOW MANY files it actually read. A check
 * that reports "clean" without naming its scope is indistinguishable from a
 * check whose scope matched nothing, which is the failure class this repo has
 * already been bitten by.
 */
export function _eligibleSourceFiles(): string[] | null {
    const tracked = _trackedFiles();
    if (tracked === null) return null;
    return tracked.filter((rel) => !_isGenerated(rel) && !_BINARY_EXT.has(_extensionOf(rel)));
}

/**
 * Flag raw C0 control bytes in every tracked, text-intended file.
 *
 * `files` is injectable so the regression test can assert a synthetic NUL is
 * caught — without that assertion there is no way to know this pass can still
 * fail, which is the failure mode the whole check exists to prevent.
 */
export function _scanSourceControlBytes(files: readonly string[] | null = null): sl.Finding[] {
    const tracked = files ?? _eligibleSourceFiles();
    if (tracked === null) return [];
    const out: sl.Finding[] = [];
    for (const rel of tracked) {
        // Re-applied here, not only in `_eligibleSourceFiles`: the exclusions
        // are a property of the CHECK, so an explicit `files` list (a caller, a
        // test) can never widen the scan past what the check is willing to
        // claim. `_eligibleSourceFiles` exists to count, not to be the gate.
        if (_isGenerated(rel)) continue;
        if (_BINARY_EXT.has(_extensionOf(rel))) continue;
        let data: Buffer;
        try {
            data = fs.readFileSync(path.join(sl.ROOT, rel));
        } catch {
            continue; // deleted, unreadable, or a submodule pointer
        }
        // A file that is not valid UTF-8 is binary regardless of its extension
        // (an extensionless fixture, say) — not this check's business.
        try {
            new TextDecoder('utf-8', { fatal: true }).decode(data);
        } catch {
            continue;
        }
        // Iterate CODEPOINTS (the string is already known-valid UTF-8 here), so
        // DEL and the C1 range are visible — see `_isRawControlCodepoint`.
        let line = 1;
        for (const ch of data.toString('utf-8')) {
            const cp = ch.codePointAt(0);
            if (cp === undefined) continue;
            if (cp === 0x0a) {
                line += 1;
                continue;
            }
            if (!_isRawControlCodepoint(cp)) continue;
            const hex = cp.toString(16).toUpperCase().padStart(2, '0');
            out.push(
                new sl.Finding(
                    rel,
                    line,
                    CHECK,
                    'HIGH',
                    `raw control character U+${hex} in a text source — makes ` +
                        'grep/file(1)/git treat this file as binary and skip it ' +
                        'silently; use the language escape (e.g. \\0, \\x7F) instead',
                    1.0,
                ),
            );
        }
    }
    return out;
}

export function _sanitize(filePath: string): string {
    const raw = fs.readFileSync(filePath, 'utf-8');
    let cleaned = '';
    for (const ch of raw) {
        const cp = ch.codePointAt(0) as number;
        if (_classify(cp) === null && !_isVS(cp)) {
            cleaned += ch;
        }
    }
    cleaned = cleaned.normalize('NFKC');
    const out = filePath + '.sanitized';
    fs.writeFileSync(out, cleaned, 'utf-8');
    return out;
}

interface Args {
    json: boolean;
    fix: boolean;
}

function _argError(msg: string): never {
    process.stderr.write('usage: lint_hidden_unicode [-h] [--json] [--fix]\n');
    process.stderr.write(`lint_hidden_unicode: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): Args {
    const out: Args = { json: false, fix: false };
    const extra: string[] = [];
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_hidden_unicode [-h] [--json] [--fix]\n');
            process.exit(0);
        } else if (a === '--json') {
            out.json = true;
        } else if (a === '--fix') {
            out.fix = true;
        } else {
            extra.push(a);
        }
    }
    if (extra.length > 0) {
        _argError(`unrecognized arguments: ${extra.join(' ')}`);
    }
    return out;
}

export function main(argv: readonly string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const findings: sl.Finding[] = [];
    const flagged = new Set<string>();
    for (const sf of sl.iter_corpus()) {
        const hits = _scan(sf);
        for (const h of hits) {
            findings.push(h);
        }
        if (hits.length > 0) {
            flagged.add(sf.path);
        }
    }

    // Second pass — raw control bytes in text-intended SOURCE files, which the
    // `.md` corpus above does not cover. Deliberately not folded into
    // `iter_corpus`: different scope (all tracked text files, not the `.md`
    // corpus) and a narrower codepoint set (C0 only). `--fix` does not touch
    // these — rewriting a source file's bytes is the author's call, and the
    // finding names the escape to use.
    const sourceFiles = _eligibleSourceFiles();
    for (const h of _scanSourceControlBytes(sourceFiles)) {
        findings.push(h);
    }
    if (!args.json) {
        // State the scope on every run. A bare "clean" cannot be told apart
        // from a pass whose file list was empty.
        const n = sourceFiles === null ? 0 : sourceFiles.length;
        process.stdout.write(
            sourceFiles === null
                ? '  source pass: SKIPPED — `git ls-files` unavailable, 0 files read for raw control bytes\n'
                : `  source pass: ${n} tracked text file(s) read for raw C0 control bytes ` +
                      '(generated trees + verbatim captures excluded)\n',
        );
    }

    if (args.fix) {
        // sorted(flagged) — by path string.
        for (const p of [...flagged].sort()) {
            const sanitized = _sanitize(p);
            // relative_to(sl.ROOT)
            const rel = path.relative(path.resolve(sl.ROOT), path.resolve(sanitized));
            process.stdout.write(`  fixed → ${rel.split(path.sep).join('/')}\n`);
        }
    }

    if (args.json) {
        const payload = sl.py_json_dumps_indent2(findings.map((f) => f.toDict()));
        process.stdout.write(payload + '\n');
        return findings.some((f) => f.is_fail) ? 1 : 0;
    }

    return sl.report(findings, { check_label: 'hidden-unicode' });
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
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

if (_isCliEntry()) {
    process.exitCode = main();
}
