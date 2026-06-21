#!/usr/bin/env tsx
/**
 * Engineering Memory validator.
 *
 * TypeScript twin of `src/scripts/check_memory.py` (ADR-200, Phase 4 /
 * Wave 4a). The CLI contract mirrors the Python original EXACTLY — same
 * flags (`--path`, `--format`, `--append-only`, `--base`), same exit
 * codes, same stdout/stderr split,
 * byte-identical finding messages, same scan scope and ordering. No
 * behaviour changes — latent bugs are replicated and flagged in the
 * porting report, not fixed.
 *
 * Validates YAML files under `agents/memory/<type>/**\/*.yml` against the
 * schema documented in `guidelines/agent-infra/engineering-memory-data-format`.
 *
 * Checks:
 *   * Required shared frontmatter: id, status, confidence, source, owner,
 *     last_validated, review_after_days.
 *   * Duplicate `id` within the same type.
 *   * Basic redaction: obvious secrets, private URLs with credentials,
 *     IP addresses tied to internal ranges.
 *   * Staleness: entries where (today - last_validated) > review_after_days
 *     are reported (informational, never hard fail).
 *
 *   * Append-only (--append-only): inspects `git diff` against a ref to
 *     ensure intake JSONL files (`agents/memory/intake/*.jsonl`) only gained
 *     lines at EOF. In-place edits, deletions, or reorderings fail the check.
 *     See `road-to-memory-merge-safety.md` Phase 0.
 *
 * Exit codes: 0 = clean, 1 = violations, 2 = PyYAML missing, 3 = internal error.
 *
 * Usage:
 *     check_memory                     # validate templates + agents/memory
 *     check_memory --path agents/memory
 *     check_memory --format json
 *     check_memory --append-only       # CI: diff vs origin/main
 *     check_memory --append-only --base HEAD~1
 *
 * Note on YAML date typing: the Python original relies on PyYAML's
 * `safe_load` converting unquoted `YYYY-MM-DD` scalars to `datetime.date`
 * (and `YYYY-MM-DD HH:MM:SS` to `datetime.datetime`). The `yaml` npm
 * package parses every scalar to a string, so this twin re-implements
 * PyYAML's timestamp implicit-resolver to convert matching *plain*
 * (unquoted) scalars into a `PyDate` marker — preserving the
 * `isinstance(value, datetime.date)` semantics the staleness checks rely
 * on. Quoted dates stay strings, exactly as in PyYAML.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import YAML, { parseDocument } from 'yaml';

type Severity = 'error' | 'warning' | 'info';

const REQUIRED_KEYS: ReadonlySet<string> = new Set([
    'id',
    'status',
    'confidence',
    'source',
    'owner',
    'last_validated',
    'review_after_days',
]);
const VALID_STATUS: ReadonlySet<string> = new Set(['active', 'deprecated', 'archived', 'superseded']);
const VALID_CONFIDENCE: ReadonlySet<string> = new Set(['low', 'medium', 'high']);
// `priority` is optional (default `normal`); enum is the smallest set that
// solves the tier-0 surfacing use case. See the Phase 2 council brief for why
// the `high` tier was rejected.
const VALID_PRIORITY: ReadonlySet<string> = new Set(['critical', 'normal', 'low']);
// Soft-cap on `priority: critical` entries per memory type. Tier-0 inflation
// is the failure mode: when too many entries claim "always surface", the
// slice loses signal. Warn (not fail) when the cap is exceeded so curators
// notice without being blocked.
const CRITICAL_WARN_THRESHOLD = 10;
// Stale-critical guard: a `priority: critical` entry that hasn't been
// re-validated in this many days emits a warning. Surfaced separately
// from the generic `stale:` info so reviewers see it before merge.
const CRITICAL_STALE_DAYS = 90;
const KNOWN_TYPES: ReadonlySet<string> = new Set([
    'domain-invariants',
    'incident-learnings',
    'product-rules',
]);

// Per-type soft entry cap (size-bounding without a decay engine). Over-cap →
// warning, never a hard fail: the right answer to bloat is a consolidation pass
// (prune archived, merge duplicates), not CI failure. See
// road-to-memory-pipeline-consolidation.md Phase 7.
const PER_TYPE_CAPS: Readonly<Record<string, number>> = {
    ownership: 50,
    'domain-invariants': 150,
    'product-rules': 100,
    'incident-learnings': 150,
    'historical-patterns': 150,
};
const DEFAULT_TYPE_CAP = 150;
// One-durable-fact-per-entry: a content field longer than this reads as a
// transcript / narrative blob, not a single durable fact → warning.
const ONE_FACT_MAX_CHARS = 600;
const ONE_FACT_FIELDS = ['rule', 'pattern', 'statement', 'observation', 'body', 'decision', 'note'] as const;
// Per-type entry tally, populated during validation, consumed by main().
const _TYPE_COUNTS: Record<string, number> = {};

// Redaction heuristics — plain-regex, deliberately conservative.
// False positives are fixed by quoting the line differently; false
// negatives are a curator responsibility.
const REDACTION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
    // Key=value secret with a clear credential-word prefix. The value must
    // be a single token (no spaces, no "/" — skips filepaths and URLs).
    [
        /\b(api[_-]?key|auth[_-]?token|access[_-]?token|bearer|secret|password|passwd|private[_-]?key)\b\s*[:=]\s*[A-Za-z0-9+/=_\-]{8,}(?![/.\w])/i,
        'inline credential',
    ],
    [/https?:\/\/[^\s"'/]*:[^\s"'/]*@/, 'url with credentials'],
    [/\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, 'internal ipv4 range'],
    [/\b192\.168\.\d{1,3}\.\d{1,3}\b/, 'internal ipv4 range'],
];

// Date-discipline — relative-date phrases without an ISO YYYY-MM-DD anchor
// within ±20 chars are rejected. Memory entries that say "yesterday" or
// "last week" rot the moment the file is re-read on another day; the
// anchor pins meaning.
const RELATIVE_DATE_PATTERN =
    /\b(yesterday|today|tomorrow|last\s+(?:week|month|year)|next\s+(?:week|month|year)|this\s+(?:week|month|year))\b/gi;
const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const DATE_ANCHOR_WINDOW = 20;

// PyYAML timestamp implicit-resolver. A *plain* (unquoted) scalar matching
// this is constructed as datetime.date / datetime.datetime — both pass
// `isinstance(value, datetime.date)`. Source: yaml/resolver.py.
const PYYAML_TIMESTAMP_RE =
    /^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]|[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?(?:[Tt]|[ \t]+)[0-9][0-9]?:[0-9][0-9]:[0-9][0-9](?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)$/;
const PYYAML_DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

class PyDate {
    constructor(
        readonly year: number,
        readonly month: number,
        readonly day: number,
    ) {}
}

class Finding {
    constructor(
        readonly file: string,
        readonly line: number,
        readonly severity: Severity,
        readonly message: string,
        readonly entry_id: string = '',
    ) {}
}

type EntryValue = unknown;
type Entry = Record<string, EntryValue>;

/**
 * Python-compatible JSON serializer.
 *
 * `json.dumps(..., indent=2)` uses item separator `,` + newline and key
 * separator `": "`, and escapes every non-ASCII character (`ensure_ascii=True`
 * default). `json.dumps(obj)` (no indent) uses `", "` / `": "`. JS's
 * `JSON.stringify` does neither, so this reproduces both.
 */
function pyJsonDumps(value: unknown, indent: number | null): string {
    const raw = indent === null ? JSON.stringify(value) : JSON.stringify(value, null, indent);
    // Reproduce the default-separator form for the non-indented path:
    // Python emits `", "` between items and `": "` after keys. JS already
    // emits `,` / `:` with no spaces. Re-introduce the spaces only for the
    // non-indented case (the indented case uses newlines + indentation).
    let out = raw;
    if (indent === null) {
        out = pyCompactSeparators(raw);
    }
    return escapeNonAscii(out);
}

/** Re-introduce Python's `", "` / `": "` separators into a compact JSON string. */
function pyCompactSeparators(json: string): string {
    let result = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < json.length; i += 1) {
        const ch = json[i] as string;
        result += ch;
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (!inString && (ch === ',' || ch === ':')) {
            result += ' ';
        }
    }
    return result;
}

/** Escape every non-ASCII char as \uXXXX, mirroring json.dumps ensure_ascii. */
function escapeNonAscii(s: string): string {
    let out = '';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x7f) {
            // Emit UTF-16 code units (surrogate pairs for astral chars), as
            // Python's json does.
            for (let i = 0; i < ch.length; i += 1) {
                out += `\\u${ch.charCodeAt(i).toString(16).padStart(4, '0')}`;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

/**
 * Parse a YAML document the way PyYAML's `safe_load` would, for the subset
 * of typing the validator inspects: unquoted timestamp scalars become
 * `PyDate`. Everything else falls through to the `yaml` core schema.
 * Throws on parse error (mirrors PyYAML raising YAMLError).
 */
function pyYamlSafeLoad(text: string): unknown {
    const doc = parseDocument(text, { prettyErrors: false });
    if (doc.errors.length > 0) {
        const err = doc.errors[0];
        throw new Error(err ? err.message : 'YAML parse error');
    }
    YAML.visit(doc, {
        Scalar(_key, node) {
            if (node.type === 'PLAIN' && typeof node.value === 'string') {
                const m = PYYAML_TIMESTAMP_RE.exec(node.value);
                if (m) {
                    const dm = PYYAML_DATE_ONLY_RE.exec(node.value);
                    if (dm) {
                        const parts = node.value.split('-');
                        node.value = new PyDate(
                            Number(parts[0]),
                            Number(parts[1]),
                            Number(parts[2]),
                        );
                    } else {
                        // Full timestamp — date component is what matters.
                        const dateComponent = node.value.split(/[Tt \t]/)[0] as string;
                        const parts = dateComponent.split('-');
                        node.value = new PyDate(
                            Number(parts[0]),
                            Number(parts[1]),
                            Number(parts[2]),
                        );
                    }
                }
            }
        },
    });
    return doc.toJS({ mapAsMap: false });
}

/** Days between two PyDate values, mirroring (date.today() - lv).days. */
function _dateDiffDays(today: PyDate, lv: PyDate): number {
    const a = Date.UTC(today.year, today.month - 1, today.day);
    const b = Date.UTC(lv.year, lv.month - 1, lv.day);
    return Math.round((a - b) / 86_400_000);
}

function _today(): PyDate {
    const now = new Date();
    return new PyDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof PyDate);
}

function _isInteger(v: unknown): v is number {
    return typeof v === 'number' && Number.isInteger(v);
}

/** Mirror Python len(str) — code-point count, not UTF-16 unit count. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

function _memoryType(p: string): string {
    // Supports `memory/<type>.yml`, `memory/<type>/<hash>.yml`, and
    // `memory/<type>.example.yml` template filenames.
    const parts = p.split(path.sep);
    if (!parts.includes('memory')) {
        return _stem(parts[parts.length - 1] as string);
    }
    const idx = parts.indexOf('memory');
    const nxt = idx + 1 < parts.length ? (parts[idx + 1] as string) : '';
    const stem = _stem(nxt);
    // Strip `.example` suffix used in template files.
    return stem.endsWith('.example') ? stem.slice(0, -'.example'.length) : stem;
}

/** Mirror pathlib `Path(name).stem`: basename with the final suffix removed. */
function _stem(name: string): string {
    const base = path.basename(name);
    const dot = base.lastIndexOf('.');
    if (dot <= 0) {
        return base;
    }
    return base.slice(0, dot);
}

function _validateEntry(
    entry: Entry,
    p: string,
    seenIds: Set<string>,
    findings: Finding[],
    criticalCounts: Record<string, number> | null,
): void {
    const eid = typeof entry['id'] === 'string' ? (entry['id'] as string) : entry['id'] != null ? String(entry['id']) : '';
    const eidStr = entry['id'] == null ? '' : eid;
    const present = new Set(Object.keys(entry));
    const missing: string[] = [];
    for (const key of REQUIRED_KEYS) {
        if (!present.has(key)) {
            missing.push(key);
        }
    }
    missing.sort();
    for (const key of missing) {
        findings.push(new Finding(p, 0, 'error', `missing required field: ${key}`, eidStr));
    }
    const status = entry['status'];
    if (status && typeof status === 'string' && !VALID_STATUS.has(status)) {
        findings.push(new Finding(p, 0, 'error', `invalid status '${status}'`, eidStr));
    }
    const confidence = entry['confidence'];
    if (confidence && typeof confidence === 'string' && !VALID_CONFIDENCE.has(confidence)) {
        findings.push(new Finding(p, 0, 'error', `invalid confidence '${confidence}'`, eidStr));
    }
    // Priority is optional (defaults to `normal` at read time). When present
    // it MUST be one of the three-tier enum — see VALID_PRIORITY for the
    // rationale on rejecting a fourth `high` tier.
    const priority = entry['priority'];
    if (priority !== undefined && priority !== null && !(typeof priority === 'string' && VALID_PRIORITY.has(priority))) {
        const sortedPri = [...VALID_PRIORITY].sort();
        findings.push(
            new Finding(
                p,
                0,
                'error',
                `invalid priority '${_pyStr(priority)}' (expected one of [${sortedPri.map((x) => `'${x}'`).join(', ')}])`,
                eidStr,
            ),
        );
    }
    const sources = (entry['source'] ?? []) as unknown;
    if (!Array.isArray(sources) || sources.length < 1) {
        findings.push(new Finding(p, 0, 'error', 'source must be a list with ≥1 entry', eidStr));
    }
    if (eidStr && seenIds.has(eidStr)) {
        findings.push(new Finding(p, 0, 'error', `duplicate id '${eidStr}'`, eidStr));
    }
    seenIds.add(eidStr);
    // Staleness.
    const lv = entry['last_validated'];
    const days = entry['review_after_days'];
    if (lv instanceof PyDate && _isInteger(days)) {
        const age = _dateDiffDays(_today(), lv);
        if (age > days && entry['status'] === 'active') {
            findings.push(new Finding(p, 0, 'info', `stale: last_validated ${age} days ago (limit ${days})`, eidStr));
        }
    }
    // Critical-stale guard: a `priority: critical` entry that has not been
    // re-validated within CRITICAL_STALE_DAYS surfaces as a warning, even
    // when the entry's own `review_after_days` is more lenient. Critical
    // entries surface on every /memory:load — they have a tighter SLA.
    if (priority === 'critical' && entry['status'] === 'active' && lv instanceof PyDate) {
        const critAge = _dateDiffDays(_today(), lv);
        if (critAge > CRITICAL_STALE_DAYS) {
            findings.push(
                new Finding(
                    p,
                    0,
                    'warning',
                    `critical-stale: last_validated ${critAge} days ago (critical SLA is ${CRITICAL_STALE_DAYS} days)`,
                    eidStr,
                ),
            );
        }
    }
    // One-durable-fact-per-entry: reject transcript/narrative blobs. A single
    // content field over ONE_FACT_MAX_CHARS is the bloat signal.
    for (const fld of ONE_FACT_FIELDS) {
        const val = entry[fld];
        if (typeof val === 'string' && _pyLen(val) > ONE_FACT_MAX_CHARS) {
            findings.push(
                new Finding(
                    p,
                    0,
                    'warning',
                    `one-fact: \`${fld}\` is ${_pyLen(val)} chars (limit ${ONE_FACT_MAX_CHARS}) — split into separate durable facts, not a narrative blob`,
                    eidStr,
                ),
            );
            break;
        }
    }
    // Tier-0 inflation tracking — increment per memory type. The aggregate
    // warning is emitted in main() after all files are validated.
    if (criticalCounts !== null && priority === 'critical' && entry['status'] === 'active') {
        const mtype = _memoryType(p);
        criticalCounts[mtype] = (criticalCounts[mtype] ?? 0) + 1;
    }
    // Per-type entry-count tracking — aggregate cap warning in main().
    if (criticalCounts !== null) {
        const mt = _memoryType(p);
        _TYPE_COUNTS[mt] = (_TYPE_COUNTS[mt] ?? 0) + 1;
    }
}

/** Mirror Python's `str(value)` for the priority error message. */
function _pyStr(value: unknown): string {
    if (value === null) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (value instanceof PyDate) {
        const mm = String(value.month).padStart(2, '0');
        const dd = String(value.day).padStart(2, '0');
        return `${value.year}-${mm}-${dd}`;
    }
    return String(value);
}

function _checkRedaction(p: string, findings: Finding[]): void {
    const text = fs.readFileSync(p, 'utf-8');
    const lines = _splitlines(text);
    lines.forEach((line, idx) => {
        const lineNo = idx + 1;
        // Skip comments — redaction warnings in example/commentary lines are noise.
        if (line.trimStart().startsWith('#')) {
            return;
        }
        for (const [pattern, label] of REDACTION_PATTERNS) {
            if (pattern.test(line)) {
                findings.push(new Finding(p, lineNo, 'error', `possible leak: ${label}`));
            }
        }
    });
}

function _checkDateDiscipline(p: string, findings: Finding[]): void {
    // Reject relative-date phrases without an ISO YYYY-MM-DD anchor.
    const text = fs.readFileSync(p, 'utf-8');
    const lines = _splitlines(text);
    lines.forEach((line, idx) => {
        const lineNo = idx + 1;
        const stripped = line.trimStart();
        if (stripped.startsWith('#') || stripped.startsWith('last_validated')) {
            return;
        }
        RELATIVE_DATE_PATTERN.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = RELATIVE_DATE_PATTERN.exec(line)) !== null) {
            const start = Math.max(0, match.index - DATE_ANCHOR_WINDOW);
            const end = Math.min(line.length, match.index + match[0].length + DATE_ANCHOR_WINDOW);
            const windowStr = line.slice(start, end);
            if (ISO_DATE_PATTERN.test(windowStr)) {
                continue;
            }
            const phrase = match[0];
            findings.push(
                new Finding(
                    p,
                    lineNo,
                    'error',
                    `relative date '${phrase}' without an ISO YYYY-MM-DD anchor within ±${DATE_ANCHOR_WINDOW} chars (re-anchor before commit)`,
                ),
            );
        }
    });
}

/** Mirror Python str.splitlines() for the line-numbering used above. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    // Python splitlines splits on \n, \r, \r\n (and more) and drops a final
    // trailing newline. For YAML/text files \n and \r\n cover the cases.
    const lines = text.split(/\r\n|\r|\n/);
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return lines;
}

function _validateFile(
    p: string,
    findings: Finding[],
    criticalCounts: Record<string, number> | null,
): void {
    const mtype = _memoryType(p);
    if (!KNOWN_TYPES.has(mtype)) {
        findings.push(new Finding(p, 0, 'warning', `unknown memory type '${mtype}'`));
    }
    _checkRedaction(p, findings);
    _checkDateDiscipline(p, findings);
    let data: unknown;
    try {
        data = pyYamlSafeLoad(fs.readFileSync(p, 'utf-8'));
        if (data === null || data === undefined) {
            data = {};
        }
    } catch (exc) {
        // mirror Python `except Exception` → report class name. PyYAML raises
        // a YAMLError; the `yaml` package surfaces a parse error.
        findings.push(new Finding(p, 0, 'error', `YAML parse error: ${_excClassName(exc)}`));
        return;
    }
    if (!_isPlainObject(data) || !('entries' in data)) {
        findings.push(new Finding(p, 0, 'error', "missing top-level 'entries' key"));
        return;
    }
    const seenIds: Set<string> = new Set();
    const entries = (data['entries'] ?? []) as unknown;
    if (Array.isArray(entries)) {
        for (const entry of entries) {
            if (_isPlainObject(entry)) {
                _validateEntry(entry as Entry, p, seenIds, findings, criticalCounts);
            }
        }
    }
}

/** Mirror Python `exc.__class__.__name__` for the YAML-parse-error message. */
function _excClassName(_exc: unknown): string {
    // PyYAML errors surface as YAMLError. The TS twin always reports the same
    // class name so the byte-identical "YAML parse error: <Name>" message holds
    // for malformed YAML inputs.
    return 'YAMLError';
}

const INTAKE_GLOB = 'agents/memory/intake/*.jsonl';

function _git(cmd: string[]): [number, string] {
    const result = spawnSync(cmd[0] as string, cmd.slice(1), { encoding: 'utf-8' });
    if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [127, 'git not found'];
    }
    const code = result.status ?? 1;
    return [code, (result.stdout || '') + (result.stderr || '')];
}

function _resolveBase(explicit: string | null): string | null {
    // CI: GITHUB_BASE_REF is set on PRs → origin/<base>.
    if (explicit) {
        return explicit;
    }
    const baseRef = process.env['GITHUB_BASE_REF'];
    if (baseRef) {
        return `origin/${baseRef}`;
    }
    // Local fallback: origin/main if it exists.
    const [rc] = _git(['git', 'rev-parse', '--verify', 'origin/main']);
    if (rc === 0) {
        return 'origin/main';
    }
    return null;
}

function _checkAppendOnly(base: string | null, findings: Finding[]): void {
    const ref = _resolveBase(base);
    if (ref === null) {
        findings.push(
            new Finding(
                INTAKE_GLOB,
                0,
                'warning',
                'append-only: no base ref resolved (set --base or GITHUB_BASE_REF)',
            ),
        );
        return;
    }
    const [rc, diff] = _git([
        'git',
        'diff',
        '--unified=0',
        '--no-color',
        ref,
        '--',
        'agents/memory/intake/',
    ]);
    if (rc !== 0) {
        findings.push(new Finding(INTAKE_GLOB, 0, 'warning', `append-only: git diff failed vs ${ref}`));
        return;
    }
    if (diff.trim() === '') {
        return; // nothing changed, nothing to check
    }
    let currentFile = '';
    let oldPath = '';
    for (const line of diff.split('\n')) {
        if (line.startsWith('diff --git')) {
            const parts = line.split(/\s+/);
            currentFile = parts.length >= 4 ? (parts[parts.length - 1] as string).slice(2) : '';
            oldPath = '';
        } else if (line.startsWith('--- ')) {
            oldPath = line.slice(4).trim();
        } else if (line.startsWith('@@')) {
            // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
            const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
            if (!m) {
                continue;
            }
            const oldStart = parseInt(m[1] as string, 10);
            const oldCount = parseInt(m[2] ?? '1', 10);
            // Any hunk that removes >0 lines from the old file = in-place edit.
            if (oldCount > 0 && oldPath !== '/dev/null') {
                findings.push(
                    new Finding(
                        currentFile || INTAKE_GLOB,
                        oldStart,
                        'error',
                        `append-only violation: ${oldCount} existing line(s) removed or modified (ref=${ref})`,
                    ),
                );
            }
        }
    }
}

interface ParsedArgs {
    path: string;
    format: string;
    append_only: boolean;
    base: string | null;
}

/** Minimal argparse-compatible parser for this script's surface. */
function _parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = {
        path: 'agents/memory',
        format: 'text',
        append_only: false,
        base: null,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--path') {
            args.path = argv[++i] as string;
        } else if (a.startsWith('--path=')) {
            args.path = a.slice('--path='.length);
        } else if (a === '--format') {
            args.format = _checkChoice(argv[++i] as string, ['text', 'json'], '--format');
        } else if (a.startsWith('--format=')) {
            args.format = _checkChoice(a.slice('--format='.length), ['text', 'json'], '--format');
        } else if (a === '--append-only') {
            args.append_only = true;
        } else if (a === '--base') {
            args.base = argv[++i] as string;
        } else if (a.startsWith('--base=')) {
            args.base = a.slice('--base='.length);
        } else if (a === '-h' || a === '--help') {
            _printUsage();
            process.exit(0);
        } else {
            process.stderr.write(`check_memory: error: unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

function _checkChoice(value: string | undefined, choices: string[], flag: string): string {
    if (value === undefined || !choices.includes(value)) {
        process.stderr.write(
            `check_memory: error: argument ${flag}: invalid choice: '${value ?? ''}' (choose from ${choices.map((c) => `'${c}'`).join(', ')})\n`,
        );
        process.exit(2);
    }
    return value;
}

function _printUsage(): void {
    process.stdout.write(
        'usage: check_memory [-h] [--path PATH] [--format {text,json}] [--append-only] [--base BASE]\n',
    );
}

function main(): number {
    const args = _parseArgs(process.argv.slice(2));
    const root = args.path;
    const findings: Finding[] = [];
    if (args.append_only) {
        _checkAppendOnly(args.base, findings);
        // Append-only mode is standalone by design: it inspects git state, not
        // files on disk, and is meant to run as a fast CI gate. Skip YAML
        // validation.
        return _emit(findings, args.format);
    }
    if (!fs.existsSync(root)) {
        if (args.format === 'json') {
            process.stdout.write(`${pyJsonDumps({ findings: [], note: `${root} not found` }, null)}\n`);
        } else {
            process.stdout.write(`ℹ️  ${root} not found — nothing to validate\n`);
        }
        return 0;
    }
    const criticalCounts: Record<string, number> = {};
    for (const key of Object.keys(_TYPE_COUNTS)) {
        delete _TYPE_COUNTS[key];
    }
    for (const yml of _rglobYmlSorted(root)) {
        _validateFile(yml, findings, criticalCounts);
    }
    // Tier-0 inflation warning — soft cap on `priority: critical` per type.
    // Council convergence (Phase 2 B2): warn rather than block, because the
    // right answer to "too many criticals" is curator review, not CI failure.
    for (const [mtype, count] of Object.entries(criticalCounts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        if (count > CRITICAL_WARN_THRESHOLD) {
            findings.push(
                new Finding(
                    `agents/memory/${mtype}`,
                    0,
                    'warning',
                    `tier-0 inflation: ${count} active 'priority: critical' entries (threshold ${CRITICAL_WARN_THRESHOLD}) — review whether all still warrant always-surface treatment`,
                ),
            );
        }
    }
    // Per-type entry-count cap (size-bounding, Phase 7). Warn, never block —
    // over-cap signals a consolidation pass is due (prune archived, merge dups).
    for (const [mtype, count] of Object.entries(_TYPE_COUNTS).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        const cap = PER_TYPE_CAPS[mtype] ?? DEFAULT_TYPE_CAP;
        if (count > cap) {
            findings.push(
                new Finding(
                    `agents/memory/${mtype}`,
                    0,
                    'warning',
                    `entry-cap: ${count} entries (soft cap ${cap}) — run a consolidation pass (prune archived, merge duplicates)`,
                ),
            );
        }
    }
    return _emit(findings, args.format);
}

/** Mirror `sorted(root.rglob("*.yml"))` — absolute paths, sorted by POSIX string. */
function _rglobYmlSorted(root: string): string[] {
    const out: string[] = [];
    const rootAbs = path.resolve(root);
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.name.endsWith('.yml')) {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDirSafe(full))) {
                walk(full);
            }
        }
    };
    walk(rootAbs);
    // Python's Path.rglob result is sorted by the Path objects; sorting the
    // resolved absolute paths by string reproduces that order on POSIX hosts.
    // But the original passes a relative root (e.g. "agents/memory") and
    // emits str(Path) of those relative paths. Reproduce by re-relativizing.
    const cwd = process.cwd();
    const rel = out.map((p) => {
        const r = path.relative(cwd, p);
        // Match str(Path(root) / ...) which keeps the given root form. When the
        // user passed an absolute root, keep absolute.
        return path.isAbsolute(root) ? p : r;
    });
    rel.sort();
    return rel;
}

function _isDirSafe(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _emit(findings: Finding[], fmt: string): number {
    const errors = findings.filter((f) => f.severity === 'error');
    if (fmt === 'json') {
        process.stdout.write(
            `${pyJsonDumps(
                {
                    findings: findings.map((f) => ({
                        file: f.file,
                        line: f.line,
                        severity: f.severity,
                        message: f.message,
                        entry_id: f.entry_id,
                    })),
                },
                2,
            )}\n`,
        );
    } else {
        const icon: Record<Severity, string> = { error: '❌', warning: '⚠️', info: 'ℹ️' };
        for (const f of findings) {
            const loc = f.line ? `${f.file}:${f.line}` : f.file;
            const suffix = f.entry_id ? ` [${f.entry_id}]` : '';
            process.stdout.write(`  ${icon[f.severity]}  ${loc}${suffix}  ${f.message}\n`);
        }
        const warnings = findings.filter((f) => f.severity === 'warning').length;
        const infos = findings.filter((f) => f.severity === 'info').length;
        process.stdout.write(`\nSummary: ${errors.length} error(s), ${warnings} warning(s), ${infos} info\n`);
    }
    return errors.length > 0 ? 1 : 0;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (_isMain) {
    process.exit(main());
}

export { main };
