/**
 * Hardened parser for `agents/decisions/low-impact-decisions.md` (step-9 P4).
 *
 * TypeScript twin of `src/scripts/ai_council/low_impact_corpus.py`
 * (ADR-200 — Python→TS migration, Phase 1).
 *
 * Replaces the silent-skip behaviour of the inline regex in
 * `necessity.load_validated_phrases` with a typed-error contract.
 *
 * Contract: `docs/contracts/low-impact-corpus-format.md`.
 *
 * Two entry points:
 *
 * - {@link load_validated_phrases} — back-compat shim used by
 *   `scripts.ai_council.necessity` routing. Silently returns the
 *   successfully-parsed validated phrases (degrades to `()` on malformed
 *   sections so a broken corpus never blocks routing).
 * - {@link parse_corpus_strict} — raises {@link CorpusParseError} on the
 *   first structural anomaly. Used by CI lint
 *   (`task lint-low-impact-corpus`) and the strict-mode test suite.
 *
 * Structural failures (raised in strict mode, dropped silently in lenient
 * mode):
 *
 * - `curly_quotes` — phrase wrapped in U+201C / U+201D.
 * - `single_quotes` — phrase wrapped in `'…'` instead of `"…"`.
 * - `non_dash_bullet` — `*`, `+` or numbered list marker under a section
 *   that expects `- "…"` bullets.
 * - `unclosed_quote` — opening `"` with no matching closing `"`.
 * - `empty_phrase` — phrase normalises to empty (whitespace / punctuation
 *   only).
 * - `heading_drift` — heading with the section name but the wrong level
 *   (e.g. `### Validated`) or trailing punctuation (e.g. `## Validated:`).
 * - `missing_anchor` — the `<!-- intake-anchor: validated -->` marker is
 *   absent (the intake module relies on it to splice new probation entries).
 */

import * as fs from 'node:fs';

import { parse as parseYaml } from 'yaml';

export type Section = 'validated' | 'probation' | 'anti_examples';

const _SECTION_TITLES: Record<Section, string> = {
    validated: 'Validated',
    probation: 'On Probation',
    anti_examples: 'Anti-Examples (Always Ask User)',
};

/** Ordered section keys, mirroring Python dict insertion order. */
const _SECTION_KEYS: readonly Section[] = ['validated', 'probation', 'anti_examples'];

// Heading-detection regex. `^##\s+<title>\s*$` accepts the canonical form;
// anything else with the title text triggers `heading_drift`.
// (Defined in Python but unused by the runtime path; kept for parity.)
 
const _HEADING_OK = /^##\s+(.+?)\s*$/u;

// Canonical bullet form: `- "phrase"` followed by optional metadata.
const _BULLET_OK = /^\s*-\s*"([^"]+)"\s*(.*)$/u;

// Non-dash list markers that drift away from the contract.
const _BULLET_BAD_MARKER = /^\s*([*+]|\d+\.)\s+["“‘']/u;

// Smart-quote and single-quote drift inside an otherwise dash-bulleted line.
const _BULLET_CURLY = /^\s*-\s*[“‘]/u;
const _BULLET_SINGLE_Q = /^\s*-\s*'/u;

// Phrase-normaliser: drop non-word/space, collapse whitespace, lowercase.
// Python `\w`/`\s` are Unicode by default.
const _NORM_PUNCT = /[^\p{L}\p{N}_\s]/gu;
const _NORM_WS = /\s+/gu;

// Anchor comment per section.
const _ANCHOR = (key: string): string => `<!-- intake-anchor: ${key} -->`;

/**
 * Structural anomaly in the low-impact-decisions corpus.
 *
 * - `reason`: Stable machine-readable failure tag (see module docstring).
 * - `line`: 1-based line number of the offending content, or `null` when
 *   the failure is file-level (missing anchor, etc.).
 * - `section`: Section the anomaly was found in, when known.
 */
export class CorpusParseError extends Error {
    readonly reason: string;
    readonly line: number | null;
    readonly section: Section | null;
    readonly detail: string;

    constructor(
        reason: string,
        opts: { line?: number | null; section?: Section | null; detail?: string } = {},
    ) {
        const line = opts.line ?? null;
        const section = opts.section ?? null;
        const detail = opts.detail ?? '';
        const loc = line !== null ? ` at line ${line}` : '';
        const sec = section ? ` in section '${section}'` : '';
        let msg = `corpus parse failed: ${reason}${loc}${sec}`;
        if (detail) {
            msg += ` — ${detail}`;
        }
        super(msg);
        this.name = 'CorpusParseError';
        this.reason = reason;
        this.line = line;
        this.section = section;
        this.detail = detail;
    }
}

/** One parsed bullet entry from a section. */
export interface CorpusEntry {
    readonly phrase: string;
    readonly normalised: string;
    readonly section: Section;
    readonly line_no: number;
    readonly trailing_metadata: string;
}

function _entry(
    phrase: string,
    normalised: string,
    section: Section,
    line_no: number,
    trailing_metadata = '',
): CorpusEntry {
    return { phrase, normalised, section, line_no, trailing_metadata };
}

/** Outcome of {@link parse_corpus_strict}. */
export class CorpusParseResult {
    readonly validated: readonly CorpusEntry[];
    readonly probation: readonly CorpusEntry[];
    readonly anti_examples: readonly CorpusEntry[];
    readonly warnings: readonly string[];

    constructor(opts: {
        validated?: readonly CorpusEntry[];
        probation?: readonly CorpusEntry[];
        anti_examples?: readonly CorpusEntry[];
        warnings?: readonly string[];
    } = {}) {
        this.validated = opts.validated ?? [];
        this.probation = opts.probation ?? [];
        this.anti_examples = opts.anti_examples ?? [];
        this.warnings = opts.warnings ?? [];
    }

    phrases(section: Section): string[] {
        const entries = this[section] as readonly CorpusEntry[];
        return entries.map((e) => e.normalised);
    }
}

/** Python `str.strip()`. */
function _strip(s: string): string {
    return s.trim();
}

function _normalise(phrase: string): string {
    return _strip(phrase.toLowerCase().replace(_NORM_PUNCT, ' ').replace(_NORM_WS, ' '));
}

/** Return `[body_start, body_end]` for the named section, or `null`. */
function _sectionBounds(
    text: string,
    title: string,
    allTitles: readonly string[],
): [number, number] | null {
    const needle = `## ${title}`;
    let idx = text.indexOf('\n' + needle);
    if (idx < 0 && text.startsWith(needle)) {
        idx = 0;
    } else {
        idx = idx >= 0 ? idx + 1 : -1;
    }
    if (idx < 0) {
        return null;
    }
    const lineEnd = text.indexOf('\n', idx);
    if (lineEnd < 0) {
        return null;
    }
    const bodyStart = lineEnd + 1;
    let end = text.length;
    for (const other of allTitles) {
        if (other === title) {
            continue;
        }
        const j = text.indexOf('\n## ' + other, bodyStart);
        if (j >= 0 && j < end) {
            end = j;
        }
    }
    return [bodyStart, end];
}

function _lineNoAt(text: string, offset: number): number {
    // Python: text.count("\n", 0, offset) + 1
    let count = 0;
    for (let i = 0; i < offset && i < text.length; i += 1) {
        if (text[i] === '\n') {
            count += 1;
        }
    }
    return count + 1;
}

/**
 * Python `str.splitlines()` — split on universal newlines, drop a single
 * trailing newline (no empty final element). `enumerate` over it is
 * 0-based.
 */
function _splitlines(s: string): string[] {
    if (s === '') {
        return [];
    }
    const lines = s.split(/\r\n|\r|\n/u);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}

/** Parse one section body into entries; raise or warn per `strict`. */
function _scanSection(
    text: string,
    section: Section,
    bodyStart: number,
    bodyEnd: number,
    strict: boolean,
): [CorpusEntry[], string[]] {
    const entries: CorpusEntry[] = [];
    const warnings: string[] = [];
    const body = text.slice(bodyStart, bodyEnd);
    const baseLine = _lineNoAt(text, bodyStart);
    const bodyLines = _splitlines(body);
    for (let offset = 0; offset < bodyLines.length; offset += 1) {
        const rawLine = bodyLines[offset] as string;
        const lineNo = baseLine + offset;
        const stripped = _strip(rawLine);
        if (!stripped || stripped.startsWith('<!--') || stripped.startsWith('#')) {
            continue;
        }
        if (!stripped.startsWith('-') && !_BULLET_BAD_MARKER.test(rawLine)) {
            // Free-form paragraph text; ignored by both modes.
            continue;
        }
        if (_BULLET_BAD_MARKER.test(rawLine)) {
            const reason = 'non_dash_bullet';
            if (strict) {
                throw new CorpusParseError(reason, {
                    line: lineNo,
                    section,
                    detail: `expected '- "…"' bullet, got: ${_pyRepr(stripped.slice(0, 40))}`,
                });
            }
            warnings.push(`line ${lineNo}: ${reason} (section=${section})`);
            continue;
        }
        if (_BULLET_CURLY.test(rawLine)) {
            const reason = 'curly_quotes';
            if (strict) {
                throw new CorpusParseError(reason, {
                    line: lineNo,
                    section,
                    detail: 'use ASCII double quotes (")',
                });
            }
            warnings.push(`line ${lineNo}: ${reason} (section=${section})`);
            continue;
        }
        if (_BULLET_SINGLE_Q.test(rawLine)) {
            const reason = 'single_quotes';
            if (strict) {
                throw new CorpusParseError(reason, {
                    line: lineNo,
                    section,
                    detail: 'use ASCII double quotes (")',
                });
            }
            warnings.push(`line ${lineNo}: ${reason} (section=${section})`);
            continue;
        }
        const m = _BULLET_OK.exec(rawLine);
        if (!m) {
            // Dash-bullet but no closed double-quoted phrase → unclosed quote.
            if (stripped.startsWith('- "') || stripped.startsWith('-"')) {
                const reason = 'unclosed_quote';
                if (strict) {
                    throw new CorpusParseError(reason, {
                        line: lineNo,
                        section,
                        detail: 'missing closing quote on bullet',
                    });
                }
                warnings.push(`line ${lineNo}: ${reason} (section=${section})`);
                continue;
            }
            // Dash bullet without any quotes at all → treat as drift.
            const reason = 'non_dash_bullet';
            if (strict) {
                throw new CorpusParseError(reason, {
                    line: lineNo,
                    section,
                    detail: `expected '- "…"' bullet, got: ${_pyRepr(stripped.slice(0, 40))}`,
                });
            }
            warnings.push(`line ${lineNo}: ${reason} (section=${section})`);
            continue;
        }
        const phrase = m[1] as string;
        // Python: m.group(2).strip() if m.lastindex and m.lastindex >= 2 else ""
        const trailing = m[2] !== undefined ? _strip(m[2]) : '';
        const norm = _normalise(phrase);
        if (!norm) {
            const reason = 'empty_phrase';
            if (strict) {
                throw new CorpusParseError(reason, {
                    line: lineNo,
                    section,
                    detail: 'phrase normalises to empty',
                });
            }
            warnings.push(`line ${lineNo}: ${reason} (section=${section})`);
            continue;
        }
        entries.push(_entry(phrase, norm, section, lineNo, trailing));
    }
    return [entries, warnings];
}

/**
 * Return `[line, detail]` if a near-miss heading is found, else
 * `[null, null]`. Detects `### Validated`, `## Validated:`, etc.
 *
 * Only reports drift when no canonical heading is also present.
 */
function _checkHeadingDrift(text: string, title: string): [number | null, string | null] {
    const canonical = `## ${title}`;
    if (text.includes('\n' + canonical + '\n') || text.startsWith(canonical + '\n')) {
        return [null, null];
    }
    // Search for any heading line containing the title text.
    const pattern = new RegExp(`^(#+)\\s+${_reEscape(title)}([^\\n]*)$`, 'mu');
    const m = pattern.exec(text);
    if (!m) {
        return [null, null];
    }
    const lineNo = _lineNoAt(text, m.index);
    const hashes = m[1] as string;
    const tail = m[2] as string;
    if (hashes !== '##' || _strip(tail)) {
        return [lineNo, `got '${_strip(m[0])}', expected '${canonical}'`];
    }
    return [null, null];
}

/**
 * Parse the corpus, raising {@link CorpusParseError} on anomalies.
 *
 * A missing file is **not** an error — it returns an empty result.
 * A present file with structural drift raises.
 */
export function parse_corpus_strict(corpusPath: string): CorpusParseResult {
    const p = corpusPath;
    if (!fs.existsSync(p)) {
        return new CorpusParseResult();
    }
    const text = fs.readFileSync(p, { encoding: 'utf-8' });
    const allTitles = _SECTION_KEYS.map((k) => _SECTION_TITLES[k]);
    const resultSections: Record<Section, readonly CorpusEntry[]> = {
        validated: [],
        probation: [],
        anti_examples: [],
    };
    const allWarnings: string[] = [];
    let foundAny = false;
    for (const section of _SECTION_KEYS) {
        const title = _SECTION_TITLES[section];
        const [driftLine, driftDetail] = _checkHeadingDrift(text, title);
        if (driftLine !== null) {
            throw new CorpusParseError('heading_drift', {
                line: driftLine,
                section,
                detail: driftDetail ?? '',
            });
        }
        const bounds = _sectionBounds(text, title, allTitles);
        if (bounds === null) {
            continue;
        }
        foundAny = true;
        const [bodyStart, bodyEnd] = bounds;
        const [entries, warns] = _scanSection(text, section, bodyStart, bodyEnd, true);
        resultSections[section] = entries;
        allWarnings.push(...warns);
    }
    // Anchor presence is checked once we have at least one section.
    if (foundAny) {
        for (const section of ['validated', 'probation'] as const) {
            const anchor = _ANCHOR(section);
            if (!text.includes(anchor)) {
                throw new CorpusParseError('missing_anchor', {
                    section,
                    detail: `expected marker ${_pyRepr(anchor)}`,
                });
            }
        }
    }
    return new CorpusParseResult({
        validated: resultSections.validated,
        probation: resultSections.probation,
        anti_examples: resultSections.anti_examples,
        warnings: allWarnings,
    });
}

/**
 * Back-compat shim used by routing (lenient mode).
 *
 * Step-10: prefers the YAML lockfile (`<corpus>.lock.yaml` sibling of
 * `corpusPath`) when present. Falls back to lenient Markdown parsing when
 * the lockfile is missing (fresh clone before `task sync`, or callers that
 * haven't run the compiler).
 *
 * Silently drops malformed lines so a broken corpus never blocks
 * classification. Strict-mode contract validation lives in
 * {@link parse_corpus_strict} and the CI lint job.
 */
export function load_validated_phrases(corpusPath: string): string[] {
    const yamlPhrases = _loadSectionFromLock(corpusPath, 'validated');
    if (yamlPhrases !== null) {
        return yamlPhrases;
    }
    return _loadSectionLenient(corpusPath, 'validated');
}

/**
 * Lenient loader for the `Anti-Examples` section (step-9 P5).
 *
 * Step-10: prefers the YAML lockfile (see {@link load_validated_phrases}).
 *
 * Mirrors {@link load_validated_phrases} for the anti-example bucket.
 * Consumed by the fuzzy-match classifier to apply the anti-example-veto:
 * if the query is at least as similar to an anti-example as to a validated
 * phrase, the match is rejected.
 */
export function load_anti_example_phrases(corpusPath: string): string[] {
    const yamlPhrases = _loadSectionFromLock(corpusPath, 'anti_examples');
    if (yamlPhrases !== null) {
        return yamlPhrases;
    }
    return _loadSectionLenient(corpusPath, 'anti_examples');
}

/**
 * Load a step-10 YAML lockfile and re-materialise a
 * {@link CorpusParseResult}.
 *
 * Returns an empty result if the file does not exist (matches the
 * Markdown-source contract). Malformed YAML raises (the underlying parser
 * error); a schema-version mismatch raises {@link CorpusParseError} so
 * consumers see the same typed failure they would from the Markdown
 * parser. Lenient callers ({@link load_validated_phrases},
 * {@link load_anti_example_phrases}) catch these errors and fall back to
 * lenient Markdown parsing.
 */
export function load_corpus_lock(yamlPath: string): CorpusParseResult {
    // Python uses a local `import yaml`; the package is a hard dependency
    // here, so a top-level ESM import is behaviourally equivalent (and
    // `require` is unavailable under `"type": "module"`).
    const p = yamlPath;
    if (!fs.existsSync(p)) {
        return new CorpusParseResult();
    }
    // version '1.1' matches PyYAML safe_load.
    const parsed = parseYaml(fs.readFileSync(p, { encoding: 'utf-8' }), { version: '1.1' });
    const doc: Record<string, unknown> =
        parsed === null || parsed === undefined ? {} : (parsed as Record<string, unknown>);
    const schemaVersion = doc['schema_version'];
    if (schemaVersion !== 1) {
        throw new CorpusParseError('schema_version_mismatch', {
            detail: `expected schema_version=1, got ${_pyRepr2(schemaVersion)}`,
        });
    }

    const entriesFor = (key: Section): CorpusEntry[] => {
        const raw = (doc[key] as unknown[]) ?? [];
        const out: CorpusEntry[] = [];
        for (const itemRaw of raw) {
            const item = (itemRaw ?? {}) as Record<string, unknown>;
            if (!item['normalised']) {
                continue;
            }
            out.push(
                _entry(
                    (item['phrase'] as string) ?? '',
                    (item['normalised'] as string) ?? '',
                    key,
                    _pyInt(item['line_no'] ?? 0),
                    (item['trailing_metadata'] as string) ?? '',
                ),
            );
        }
        return out;
    };

    return new CorpusParseResult({
        validated: entriesFor('validated'),
        probation: entriesFor('probation'),
        anti_examples: entriesFor('anti_examples'),
    });
}

/** Mirror Python `int(x)` for the lockfile `line_no` field. */
function _pyInt(x: unknown): number {
    if (typeof x === 'number') {
        return Math.trunc(x);
    }
    if (typeof x === 'string') {
        return Math.trunc(Number(x));
    }
    if (typeof x === 'boolean') {
        return x ? 1 : 0;
    }
    return 0;
}

/** Return the sibling lockfile path for a given corpus Markdown path. */
function _deriveLockPath(corpusPath: string): string {
    // Mirror Python pathlib semantics on the basename + suffix.
    const dir = _dirname(corpusPath);
    const name = _basename(corpusPath);
    const suffix = _suffix(name);
    if (suffix === '.yaml') {
        return corpusPath;
    }
    if (name.endsWith('.lock.yaml')) {
        return corpusPath;
    }
    const stem = suffix ? name.slice(0, name.length - suffix.length) : name;
    const newName = `${stem}.lock.yaml`;
    return dir === '' ? newName : _joinPath(dir, newName);
}

/**
 * Read `section` phrases from the sibling lockfile.
 *
 * Returns `null` when the lockfile is absent or malformed so the caller
 * can fall back to lenient Markdown parsing.
 */
function _loadSectionFromLock(corpusPath: string, section: Section): string[] | null {
    const lockPath = _deriveLockPath(corpusPath);
    if (!fs.existsSync(lockPath)) {
        return null;
    }
    // Python: except (CorpusParseError, Exception) → catch everything.
    try {
        const result = load_corpus_lock(lockPath);
        return result.phrases(section);
    } catch {
        return null;
    }
}

function _loadSectionLenient(corpusPath: string, section: Section): string[] {
    const p = corpusPath;
    if (!fs.existsSync(p)) {
        return [];
    }
    const text = fs.readFileSync(p, { encoding: 'utf-8' });
    const allTitles = _SECTION_KEYS.map((k) => _SECTION_TITLES[k]);
    const bounds = _sectionBounds(text, _SECTION_TITLES[section], allTitles);
    if (bounds === null) {
        return [];
    }
    const [entries] = _scanSection(text, section, bounds[0], bounds[1], false);
    return entries.map((e) => e.normalised);
}

// ── path helpers (Python pathlib parity for `_derive_lock_path`) ──────────

function _dirname(p: string): string {
    const i = p.lastIndexOf('/');
    if (i < 0) {
        return '';
    }
    if (i === 0) {
        return '/';
    }
    return p.slice(0, i);
}

function _basename(p: string): string {
    const i = p.lastIndexOf('/');
    return i < 0 ? p : p.slice(i + 1);
}

/** Python `Path.suffix` — last `.ext` of the basename, or '' if none / leading-dot only. */
function _suffix(name: string): string {
    // pathlib: a leading dot is not a suffix ('.bashrc' → suffix '').
    const dot = name.lastIndexOf('.');
    if (dot <= 0) {
        return '';
    }
    return name.slice(dot);
}

function _joinPath(dir: string, name: string): string {
    if (dir.endsWith('/')) {
        return dir + name;
    }
    return dir + '/' + name;
}

// ── repr helpers ─────────────────────────────────────────────────────────

/** Python repr() for a string: single-quoted with escapes. */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s.replace(/\\/g, '\\\\');
    body = body.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    if (quote === "'") {
        body = body.replace(/'/g, "\\'");
    } else {
        body = body.replace(/"/g, '\\"');
    }
    return `${quote}${body}${quote}`;
}

/** Python repr() for an arbitrary value (used in the schema-version message). */
function _pyRepr2(v: unknown): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (typeof v === 'string') {
        return _pyRepr(v);
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    return String(v);
}

/**
 * Escape a string for literal use inside a `u`-flagged RegExp.
 *
 * Python `re.escape` escapes every non-word char; under the JS `u` flag
 * an escape like `\-` is illegal, so we escape only the ECMAScript regex
 * metacharacters. Match behaviour is identical (the section titles here
 * contain only ASCII letters / spaces / parens / hyphen anyway).
 */
function _reEscape(s: string): string {
    // `-` and `/` are NOT metacharacters outside a character class in
    // ECMAScript; escaping `-` as `\-` is illegal under the `u` flag.
    return s.replace(/[.*+?^${}()|[\]\\]/gu, (c) => '\\' + c);
}
