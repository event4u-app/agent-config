// Shared helpers for the agent-security corpus linters (road-to-security-pillar.md P1).
//
// Ported from the retired Python `src/scripts/_lib/security_lint.py` (ADR-200 — Python→TS
// migration). Public API mirrors the Python module exactly (snake_case kept
// deliberately) so the two dependent linters — lint_hidden_unicode and
// lint_instruction_smuggling — depend on one source of truth.
//
// Implements the **false-positive containment convention** (P1.5) so the
// self-audit linters can scan a corpus that legitimately *contains* attack
// strings as teaching material, without the allowlist-growth death-spiral:
//
//   1. Fenced-block exemption — content inside a ```security-example fence is
//      skipped by every check. Grep-auditable, scoped to the block.
//   2. Confidence weighting — a match in a doc / example / template / evals
//      file scores at 0.25x; below the FAIL threshold it is a WARN.
//   3. Bound pragma — `<!-- security-lint: allow <check> "<reason>" sha256:<hex> -->`
//      anywhere in the file suppresses ONE check for the specific evidence whose
//      fingerprint is listed. Repeat `sha256:<hex>` once per accepted match. The
//      unbound form (no hash) still suppresses the whole file and reports itself
//      as a `legacy-pragma` finding, because a key lookup with no content
//      binding accepts whatever that line is later changed to say.
//
// There is no global allowlist — that is the rejected pattern.
//
// Byte-parity contract:
//   - `scan_file` reads UTF-8 (Python uses errors="surrogatepass"; valid `.md`
//     never carries lone surrogates so `fs.readFileSync(path, 'utf-8')` matches).
//   - line splitting mirrors Python `str.splitlines()` *exactly* — including the
//     vertical-tab / form-feed / FS / GS / RS / NEL / LS / PS boundaries — so
//     line numbers and which-codepoints-survive-inside-a-line match Python.
//   - `report()` reproduces the glyphs (🔴 / ⚠️), the `(-rank, path, line)`
//     sort, the weight note `(weight 0.25)`, and every printed string verbatim.

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
// repo root, resolved from src/scripts/_lib/security_lint.ts
// (parents[3]: _lib → scripts → src → repo).
export const ROOT = path.resolve(_HERE, '..', '..', '..');

export const PRAGMA_CAP = 20;
export const EXAMPLE_FENCE_LANG = 'security-example';

// Shown in every linter's --help (P1.5 reference obligation).
export const GUIDELINE = 'docs/guidelines/agent-infra/security-lint-containment.md';
export const GUIDELINE_EPILOG =
    'False-positive containment (fenced security-example block, confidence ' +
    'weighting, per-file `security-lint: allow` pragma — no global allowlist): ' +
    `see ${GUIDELINE}.`;

// Source-of-truth roots scanned by the self-audit linters.
export const DEFAULT_SCAN_ROOTS: readonly string[] = [
    'src/skills',
    'src/rules',
    'src/agent-src',
    'src/domains',
    'dist/agent-src',
];

// A path is "example/teaching" (0.25x weight) when it lives under docs/ or
// evals/, or its name marks it as an example/template/fixture.
//   Python: re.compile(r"(^|/)(docs|evals|tests?|fixtures?)(/|$)|example|template|sample|/_template", re.IGNORECASE)
const _EXAMPLE_PATH =
    /(^|\/)(docs|evals|tests?|fixtures?)(\/|$)|example|template|sample|\/_template/i;

// Grammar: `<!-- security-lint: allow <check> "<reason>" [sha256:<hex>]... -->`
// JS `\w` is ASCII-only by default (matches Python re's `[\w-]` for the ASCII
// check ids used here). Global flag so finditer-style iteration works.
//
// The hash group is OPTIONAL and repeatable. Optional because the unbound form
// must keep working — a grammar change that invalidates every existing pragma
// at once turns a hardening into an outage, and the migration is what removes
// the unbound population, not the parser. Repeatable because one file can
// legitimately carry several accepted matches of the same check, and a single
// hash would force either a second pragma line or a whole-file fallback.
const _PRAGMA =
    /<!--\s*security-lint:\s*allow\s+([A-Za-z0-9_-]+)\s+"([^"]+)"((?:\s+sha256:[0-9a-f]{64})*)\s*-->/g;

//   Python: re.compile(r"^(\s*)(`{3,}|~{3,})\s*([\w-]*)\s*$")
const _FENCE = /^(\s*)(`{3,}|~{3,})\s*([A-Za-z0-9_-]*)\s*$/;

export const SEVERITY_RANK: Readonly<Record<string, number>> = { LOW: 1, MED: 2, HIGH: 3 };

/**
 * One linter hit. `weight` is the confidence multiplier (1.0 or 0.25).
 * Mirrors the frozen Python dataclass `Finding`; field order
 * (path, line, check, severity, message, weight) is the `__dict__`
 * order the `--json` mode serializes.
 */
export class Finding {
    readonly path: string; // repo-relative
    readonly line: number; // 1-based; 0 = file-level
    readonly check: string; // stable check id, also the pragma key
    readonly severity: string; // HIGH | MED | LOW
    readonly message: string;
    readonly weight: number; // 1.0 or 0.25

    constructor(
        pathArg: string,
        line: number,
        check: string,
        severity: string,
        message: string,
        weight = 1.0,
    ) {
        this.path = pathArg;
        this.line = line;
        this.check = check;
        this.severity = severity;
        this.message = message;
        this.weight = weight;
    }

    /** A HIGH-severity, full-weight finding fails the build. */
    get is_fail(): boolean {
        return this.severity === 'HIGH' && this.weight >= 1.0;
    }

    /** Mirror Python dataclass `__dict__` key order for `--json` parity. */
    toDict(): {
        path: string;
        line: number;
        check: string;
        severity: string;
        message: string;
        weight: PyFloat;
    } {
        return {
            path: this.path,
            line: this.line,
            check: this.check,
            severity: this.severity,
            message: this.message,
            // float in Python → render integer-valued (1.0) as `1.0`.
            weight: new PyFloat(this.weight),
        };
    }
}

export function is_example_path(rel_path: string): boolean {
    return _EXAMPLE_PATH.test(rel_path);
}

export function path_weight(rel_path: string): number {
    return is_example_path(rel_path) ? 0.25 : 1.0;
}

const PROJECTION_PREFIX = 'dist/agent-src/';

/**
 * Fold a projected path back onto the source it was copied from.
 *
 * `dist/agent-src/` is a byte-for-byte copy of `src/` with paths rewritten
 * (ADR-201), so an artifact and its projection are the same artifact for the
 * purpose of "which evidence did a human accept". Two identities would mean two
 * fingerprints for one accepted line, and only one of them could be written
 * into the pragma the projection copies verbatim.
 */
export function source_identity(rel: string): string {
    return rel.startsWith(PROJECTION_PREFIX) ? `src/${rel.slice(PROJECTION_PREFIX.length)}` : rel;
}

/** A file pre-split into lines with a fence/pragma mask the linters reuse. */
export class ScannedFile {
    path: string; // absolute or as-given path
    rel: string;
    lines: string[];
    // per-line flags (1-based index → flag); index 0 unused
    in_example_fence: boolean[];
    in_any_fence: boolean[];
    pragmas: Record<string, string>; // check id → reason
    /** check id → the sha256 fingerprints that pragma accepts. Empty = unbound. */
    pragma_hashes: Record<string, readonly string[]>;
    weight: number;

    constructor(
        pathArg: string,
        rel: string,
        lines: string[],
        in_example_fence: boolean[],
        in_any_fence: boolean[],
        pragmas: Record<string, string>,
        weight: number,
        pragma_hashes: Record<string, readonly string[]> = {},
    ) {
        this.path = pathArg;
        this.rel = rel;
        this.lines = lines;
        this.in_example_fence = in_example_fence;
        this.in_any_fence = in_any_fence;
        this.pragmas = pragmas;
        this.weight = weight;
        this.pragma_hashes = pragma_hashes;
    }

    pragma_allows(check: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.pragmas, check);
    }

    /**
     * Which form of pragma this file carries for `check`.
     *
     * `absent`  — no pragma; scan normally.
     * `legacy`  — a pragma with no fingerprint. Suppresses the whole file, as it
     *             always did, and says so: a key lookup accepts whatever the
     *             line is later changed to say, which is the defect being paid
     *             down, not a mode anybody should choose.
     * `bound`   — a pragma listing fingerprints. Suppresses exactly the matches
     *             whose evidence hashes to one of them; anything else survives.
     */
    pragma_form(check: string): 'absent' | 'legacy' | 'bound' {
        if (!this.pragma_allows(check)) return 'absent';
        return (this.pragma_hashes[check] ?? []).length > 0 ? 'bound' : 'legacy';
    }

    /**
     * The fingerprint one finding's evidence hashes to.
     *
     * WHAT IS HASHED, and each part earns its place:
     *   check id      — the same line may legitimately be accepted for one check
     *                   and not another.
     *   rel path      — the location IDENTITY. Not the line NUMBER: an unrelated
     *                   insert above would otherwise break every pragma in the
     *                   file, and a suppression that breaks on unrelated edits
     *                   gets deleted rather than re-derived. A `dist/agent-src/`
     *                   path folds to its `src/` original first, because the
     *                   projection is byte-exact by contract (ADR-201) and
     *                   carries the pragma verbatim — without the fold, every
     *                   migrated pragma would suppress the source and leave its
     *                   own copy flagged, which is a gate that reds on a file
     *                   nobody may edit.
     *   matched line, — the evidence. ASCII whitespace runs collapse so a reflow
     *   normalized      does not invalidate the binding, `sha256:<hex>` tokens are
     *                   removed, and NOTHING else is stripped: the zero-width
     *                   characters this suite hunts are exactly what a wider
     *                   normalizer would erase.
     *
     * WHY THE HASH TOKENS COME OUT. A pragma's own reason string can be the
     * matched evidence — two in this tree are, because they quote the very
     * phrases their check detects in order to explain themselves. Without this
     * the fingerprint would have to be computed over a line that already
     * contains it, which has no fixed point: writing the hash changes the line,
     * which changes the hash. Stripping the tokens makes the fingerprint stable
     * under the act of recording it, and costs nothing elsewhere — a `sha256:`
     * token in ordinary prose is not evidence of anything a linter here checks.
     *
     * Deliberately NOT the whole file: incidental content elsewhere would make
     * every unrelated edit re-fire the pragma, which is the noise that produces
     * blanket suppressions.
     */
    evidence_fingerprint(finding: Finding): string {
        const text = finding.line > 0 ? (this.lines[finding.line - 1] ?? '') : '';
        const normalized = text
            .replace(/\s*sha256:[0-9a-f]{64}/g, '')
            .replace(/[ \t]+/g, ' ')
            .trim();
        return createHash('sha256')
            .update(`${finding.check}\n${source_identity(this.rel)}\n${normalized}`, 'utf-8')
            .digest('hex');
    }

    /** Drop the findings this file's BOUND pragma for `check` accepts. */
    filter_bound_pragma(check: string, findings: readonly Finding[]): Finding[] {
        const accepted = new Set(this.pragma_hashes[check] ?? []);
        if (accepted.size === 0) return [...findings];
        return findings.filter((f) => !accepted.has(this.evidence_fingerprint(f)));
    }

    /** Yield [lineno, text] honouring the fence masks (mirrors iter_lines). */
    *iter_lines(
        opts: { skip_example_fence?: boolean; skip_any_fence?: boolean } = {},
    ): Generator<[number, string]> {
        const skip_example_fence = opts.skip_example_fence ?? true;
        const skip_any_fence = opts.skip_any_fence ?? false;
        for (let i = 1; i <= this.lines.length; i++) {
            if (skip_example_fence && this.in_example_fence[i]) {
                continue;
            }
            if (skip_any_fence && this.in_any_fence[i]) {
                continue;
            }
            yield [i, this.lines[i - 1] as string];
        }
    }
}

/**
 * Mirror Python `str.splitlines()` — boundary set is
 * \n \r \r\n \v(0x0B) \f(0x0C) \x1c \x1d \x1e \x85    .
 * No trailing empty element for a final boundary.
 */
function _splitlines(text: string): string[] {
    const out: string[] = [];
    let buf = '';
    const n = text.length;
    let i = 0;
    while (i < n) {
        const ch = text[i] as string;
        const code = text.charCodeAt(i);
        if (code === 0x0d) {
            // CR or CRLF
            out.push(buf);
            buf = '';
            if (i + 1 < n && text.charCodeAt(i + 1) === 0x0a) {
                i += 2;
            } else {
                i += 1;
            }
            continue;
        }
        if (
            code === 0x0a ||
            code === 0x0b ||
            code === 0x0c ||
            code === 0x1c ||
            code === 0x1d ||
            code === 0x1e ||
            code === 0x85 ||
            code === 0x2028 ||
            code === 0x2029
        ) {
            out.push(buf);
            buf = '';
            i += 1;
            continue;
        }
        buf += ch;
        i += 1;
    }
    if (buf !== '') {
        out.push(buf);
    }
    return out;
}

export function scan_file(filePath: string): ScannedFile {
    let rel: string;
    if (path.isAbsolute(filePath)) {
        const root = path.resolve(ROOT);
        const resolved = path.resolve(filePath);
        if (resolved === root || resolved.startsWith(root + path.sep)) {
            rel = path.relative(root, resolved).split(path.sep).join('/');
        } else {
            rel = path.basename(filePath); // outside the package root
        }
    } else {
        // Path.as_posix() — POSIX separators.
        rel = filePath.split(path.sep).join('/');
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = _splitlines(raw);
    const n = lines.length;
    const in_example: boolean[] = new Array(n + 1).fill(false);
    const in_any: boolean[] = new Array(n + 1).fill(false);

    let fence_open = false;
    let fence_marker = '';
    let fence_is_example = false;
    for (let idx = 1; idx <= n; idx++) {
        const text = lines[idx - 1] as string;
        const m = _FENCE.exec(text);
        if (m && !fence_open) {
            fence_open = true;
            fence_marker = m[2]![0] as string;
            fence_is_example = m[3] === EXAMPLE_FENCE_LANG;
            in_any[idx] = true;
            in_example[idx] = fence_is_example;
            continue;
        }
        if (fence_open) {
            in_any[idx] = true;
            in_example[idx] = fence_is_example;
            // closing fence: same marker char, 3+ long, no info string
            const cm = _FENCE.exec(text);
            if (cm && cm[2]![0] === fence_marker && cm[3] === '') {
                fence_open = false;
                fence_is_example = false;
            }
        }
    }

    // Pragmas are explicit, grep-auditable opt-out markers — honour them
    // anywhere in the file.
    const pragmas: Record<string, string> = {};
    const pragmaHashes: Record<string, readonly string[]> = {};
    for (const text of lines) {
        _PRAGMA.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = _PRAGMA.exec(text)) !== null) {
            const check = m[1] as string;
            pragmas[check] = m[2] as string;
            const hashes = (m[3] ?? '').match(/sha256:([0-9a-f]{64})/g) ?? [];
            // Union across repeated pragmas for one check rather than replace:
            // two lines each accepting one match is a legitimate spelling, and
            // a last-one-wins read would silently drop the first.
            pragmaHashes[check] = [
                ...(pragmaHashes[check] ?? []),
                ...hashes.map((h) => h.slice('sha256:'.length)),
            ];
            if (m.index === _PRAGMA.lastIndex) {
                _PRAGMA.lastIndex += 1;
            }
        }
    }

    return new ScannedFile(
        filePath,
        rel,
        lines,
        in_example,
        in_any,
        pragmas,
        path_weight(rel),
        pragmaHashes,
    );
}

/**
 * scan_file, but compute `rel` relative to an arbitrary `base` root.
 * Used by the consumer-facing audit (P3.1).
 */
export function scan_path(filePath: string, base: string): ScannedFile {
    const sf = scan_file(filePath);
    let rel: string;
    const baseResolved = path.resolve(base);
    const fileResolved = path.resolve(filePath);
    if (fileResolved === baseResolved || fileResolved.startsWith(baseResolved + path.sep)) {
        rel = path.relative(baseResolved, fileResolved).split(path.sep).join('/');
    } else {
        rel = path.basename(filePath);
    }
    return new ScannedFile(
        sf.path,
        rel,
        sf.lines,
        sf.in_example_fence,
        sf.in_any_fence,
        sf.pragmas,
        path_weight(rel),
        sf.pragma_hashes,
    );
}

/** Walk a directory recursively, mirroring `Path.rglob("*")` sorted order. */
function _rglobSorted(base: string): string[] {
    // Path.rglob("*") yields every descendant; `sorted(...)` orders them by
    // the pathlib component-wise comparison, which for same-depth POSIX paths
    // equals a plain string sort on the full path. We collect absolute paths
    // and sort them the way `sorted(base.rglob("*"))` would: lexicographic on
    // the string form of each Path.
    const found: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            found.push(full);
            if (e.isDirectory()) {
                walk(full);
            }
        }
    };
    walk(base);
    // Match Python `sorted(base.rglob("*"))`: pathlib compares the parts
    // tuple. For paths sharing the same prefix this is the component-wise
    // comparison; replicate by sorting on the split components.
    found.sort((a, b) => _pathCmp(a, b));
    return found;
}

/** Component-wise path comparator matching pathlib's `sorted(Path...)`. */
function _pathCmp(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const len = Math.min(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        if (pa[i]! < pb[i]!) return -1;
        if (pa[i]! > pb[i]!) return 1;
    }
    if (pa.length < pb.length) return -1;
    if (pa.length > pb.length) return 1;
    return 0;
}

/** Yield ScannedFile for every matching file under the given roots. */
/**
 * Walk a corpus.
 *
 * `scanBase` exists for the bounded-root mode every child linter now carries
 * (`--root DIR`): the roots stay relative, the base they resolve against moves.
 * Absent, it is the package root and the walk is exactly what it always was —
 * `scan_path(p, ROOT)` computes the same `rel` and the same `path_weight` as the
 * `scan_file(p)` this used to call, so a flagless run reads the identical corpus
 * with identical finding paths.
 */
export function* iter_corpus(
    roots: readonly string[] = DEFAULT_SCAN_ROOTS,
    exts: readonly string[] = ['.md'],
    scanBase: string = ROOT,
): Generator<ScannedFile> {
    for (const root of roots) {
        const base = path.join(scanBase, root);
        if (!fs.existsSync(base)) {
            continue;
        }
        for (const p of _rglobSorted(base)) {
            let st: fs.Stats;
            try {
                st = fs.statSync(p);
            } catch {
                continue;
            }
            if (st.isFile() && exts.includes(path.extname(p))) {
                yield scan_path(p, scanBase);
            }
        }
    }
}

/**
 * The prefix a child linter uses to publish what it inspected, under `--json`.
 *
 * WHY STDERR, AND WHY ONLY UNDER `--json`. Under `--json` a child's STDOUT is a
 * findings array with one consumer — `lint_agent_security`, which parses it.
 * A count printed there would corrupt the payload. Stderr is free on that path
 * and already carries the dead-scope diagnostic, so the umbrella reads the
 * count from the same stream it would read a failure on.
 *
 * The umbrella SUMS these across its five children and publishes the total as
 * its own `scanned:` line. The sum counts artifact INSPECTIONS, not distinct
 * artifacts: a file in more than one child's corpus is counted once per child
 * that read it. That is deliberate and is the stronger collapse detector — a
 * distinct-union count would stay high when one child's corpus moved, as long
 * as another child still covered those paths, which is exactly the failure
 * `gate-coverage.yml` exists to catch.
 */
/** The check id an unbound pragma reports itself under. */
export const LEGACY_PRAGMA_CHECK = 'legacy-pragma';

/**
 * The finding an unbound pragma emits about itself.
 *
 * LOW, so it never blocks: the unbound form is legal and this is a
 * migration signal, not a violation. It is a FINDING rather than a printed
 * aside so it travels every path the linters already have — the human report,
 * the `--json` payload the umbrella aggregates, and the SARIF file — without
 * a second reporting channel that only one of them reads.
 */
export function legacy_pragma_finding(sf: ScannedFile, check: string): Finding {
    return new Finding(
        sf.rel,
        0,
        LEGACY_PRAGMA_CHECK,
        'LOW',
        `unbound \`security-lint: allow ${check}\` pragma suppresses this whole file — ` +
            'it accepts whatever the matched text is later changed to say. Bind it with ' +
            '`sha256:<hex>` per accepted match.',
        sf.weight,
    );
}

export const CHILD_SCANNED_PREFIX = 'scanned: ';

/** Publish a child linter's inspected count on stderr. See {@link CHILD_SCANNED_PREFIX}. */
export function report_child_scanned(count: number): void {
    process.stderr.write(`${CHILD_SCANNED_PREFIX}${String(count)}\n`);
}

/**
 * Print findings grouped by severity; return an exit code.
 *
 * Exit 1 iff at least one finding `is_fail` (HIGH + full weight). WARN-level
 * (weighted-down or < HIGH) findings print but never fail the build.
 */
export function report(
    findings: readonly Finding[],
    opts: { check_label: string; scanned_roots?: readonly string[] },
): number {
    const check_label = opts.check_label;
    if (findings.length === 0) {
        process.stdout.write(`✅  ${check_label}: clean (${_corpus_note(opts.scanned_roots)}).\n`);
        return 0;
    }

    const fails = findings.filter((f) => f.is_fail);
    const warns = findings.filter((f) => !f.is_fail);

    // sorted(findings, key=lambda x: (-SEVERITY_RANK.get(x.severity, 0), x.path, x.line))
    const sorted = [...findings].sort((a, b) => {
        const ra = -(SEVERITY_RANK[a.severity] ?? 0);
        const rb = -(SEVERITY_RANK[b.severity] ?? 0);
        if (ra !== rb) return ra - rb;
        if (a.path < b.path) return -1;
        if (a.path > b.path) return 1;
        return a.line - b.line;
    });

    for (const f of sorted) {
        const glyph = f.is_fail ? '\u{1f534}' : '⚠️';
        const loc = f.line ? `${f.path}:${f.line}` : f.path;
        const wnote = f.weight >= 1.0 ? '' : ` (weight ${_pyG(f.weight)})`;
        process.stdout.write(`  ${glyph} [${f.severity}] ${f.check} — ${loc}${wnote}: ${f.message}\n`);
    }

    process.stdout.write('\n');
    if (fails.length > 0) {
        process.stdout.write(
            `❌  ${check_label}: ${fails.length} blocking finding(s), ` +
                `${warns.length} warning(s). Fix, or mark a true teaching example with a ` +
                '```' +
                `${EXAMPLE_FENCE_LANG} fence or a \`security-lint: allow\` pragma.\n`,
        );
        return 1;
    }
    process.stdout.write(`⚠️  ${check_label}: ${warns.length} warning(s), 0 blocking.\n`);
    return 0;
}

/** Mirror Python `f"{x:g}"` for the weight note (0.25 → "0.25", 1 → "1"). */
function _pyG(n: number): string {
    // %g drops trailing zeros; the only non-1.0 weight here is 0.25.
    let s = n.toPrecision(6);
    if (s.includes('.')) {
        s = s.replace(/0+$/, '').replace(/\.$/, '');
    }
    return s;
}

// The clean-path line names the corpus the caller ACTUALLY walked, not the
// shared default. Two of five callers diverge from `DEFAULT_SCAN_ROOTS`
// (`lint_skill_frontmatter_safety` replaces the set outright,
// `lint_mcp_config_security` appends `src/templates`), so a hardcoded note made
// this gate report a scope in both directions at once: it claimed `src/rules`
// and `dist/agent-src`, which it never reads, and omitted `src/subagents`,
// which is the one root holding the artefact its over-broad-grant check exists
// for. A reader verifying that root by running the gate read the opposite of
// the truth. Same contract as `_lib/scan_scope.reportScanned` — the emitted
// scope is the scope that was walked.
function _corpus_note(scanned_roots?: readonly string[]): string {
    const roots = scanned_roots && scanned_roots.length > 0 ? scanned_roots : DEFAULT_SCAN_ROOTS;
    return 'scanned ' + roots.join(', ');
}

// ---------------------------------------------------------------------
// Python-faithful JSON serialization (json.dumps parity), used by the
// dependent linters' `--json` mode.
// ---------------------------------------------------------------------

/**
 * Marker for a Python `float` so json.dumps renders integer-valued floats as
 * `1.0`, not `1`. The `weight` field is a float in Python.
 */
export class PyFloat {
    constructor(readonly value: number) {}
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof PyFloat);
}

function _pyJsonStr(s: string): string {
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
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    out += ch; // ensure_ascii=False — keep >= 0x20 verbatim
                }
        }
    }
    return out + '"';
}

function _pyJsonFloat(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) return 'NaN';
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return Number.isInteger(n) ? `${n}.0` : String(n);
}

function _pyJsonScalar(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value instanceof PyFloat) return _pyJsonFloat(value.value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            if (Number.isNaN(value)) return 'NaN';
            return value > 0 ? 'Infinity' : '-Infinity';
        }
        return String(value);
    }
    if (typeof value === 'string') return _pyJsonStr(value);
    return null;
}

/** Mirror `json.dumps(obj, indent=2)` (ensure_ascii defaults to True in the .py). */
export function py_json_dumps_indent2(value: unknown, depth = 0): string {
    return _dumpIndent2(value, depth, true);
}

function _dumpIndent2(value: unknown, depth: number, ensureAscii: boolean): string {
    const scalar = ensureAscii ? _pyJsonScalarAscii(value) : _pyJsonScalar(value);
    if (scalar !== null) {
        return scalar;
    }
    const pad = ' '.repeat(2 * (depth + 1));
    const closePad = ' '.repeat(2 * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpIndent2(v, depth + 1, ensureAscii));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (_isPlainObject(value)) {
        const keys = Object.keys(value);
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) =>
                `${pad}${ensureAscii ? _pyJsonStrAscii(k) : _pyJsonStr(k)}: ` +
                `${_dumpIndent2(value[k], depth + 1, ensureAscii)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return ensureAscii ? _pyJsonStrAscii(String(value)) : _pyJsonStr(String(value));
}

/** json.dumps default ensure_ascii=True string rendering (escape >= 0x7F). */
function _pyJsonStrAscii(s: string): string {
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
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else if (code < 0x7f) {
                    out += ch;
                } else if (code <= 0xffff) {
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    // astral → surrogate pair, as CPython emits.
                    const cp = code - 0x10000;
                    const hi = 0xd800 + (cp >> 10);
                    const lo = 0xdc00 + (cp & 0x3ff);
                    out +=
                        `\\u${hi.toString(16).padStart(4, '0')}` +
                        `\\u${lo.toString(16).padStart(4, '0')}`;
                }
        }
    }
    return out + '"';
}

function _pyJsonScalarAscii(value: unknown): string | null {
    if (typeof value === 'string') return _pyJsonStrAscii(value);
    return _pyJsonScalar(value);
}
