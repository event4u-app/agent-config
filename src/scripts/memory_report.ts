#!/usr/bin/env tsx
/**
 * One-shot memory observability report.
 *
 * TypeScript twin of `src/scripts/memory_report.py` (ADR-089, Phase 7 /
 * dev-side memory). The public API and CLI contract mirror the Python
 * original EXACTLY — same exported names (snake_case kept deliberately),
 * same exit codes, stdout/stderr split, byte-identical messages, and
 * byte-identical generated output (text report + `--format json`,
 * matching json.dumps(indent=2, default=str)). No behaviour changes —
 * latent Python bugs are replicated and flagged as divergence candidates.
 *
 * Shows:
 *   - Backend status (via `memory_status.status()`)
 *   - Intake counts per entry type and per month
 *   - Curated file staleness (files with `last_validated` older than
 *     `review_after_days` for any entry)
 *   - Supersede-chain totals
 *
 * Exit code: 0 = report printed (green or otherwise); 2 = PyYAML missing.
 * `task memory:status` is the expected entry point, but the script is
 * usable standalone.
 *
 * Usage:
 *     memory_report
 *     memory_report --format json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import YAML, { parseDocument } from 'yaml';

import * as memory_status from './memory_status.js';

// Mutable so tests can repoint them at a tmp tree (monkeypatch parity).
export let MEMORY_ROOT = path.join('agents', 'memory');
export let INTAKE_ROOT = path.join(MEMORY_ROOT, 'intake');

/** Test-only setters mirroring pytest monkeypatch on the module constants. */
export function _setMemoryRoot(p: string): void {
    MEMORY_ROOT = p;
}
export function _setIntakeRoot(p: string): void {
    INTAKE_ROOT = p;
}

const CURATED_TYPES: readonly string[] = [
    'ownership',
    'historical-patterns',
    'domain-invariants',
    'architecture-decisions',
    'incident-learnings',
    'product-rules',
];

// Role-mode marker grepped from session captures / reports / handoffs.
// Matches `<!-- role-mode: <slug> | contract: ... -->` on any single line.
const _MODE_MARKER_PATTERN = /<!--\s*role-mode:\s*([a-z0-9][a-z0-9-]*)\s*\|\s*contract:[^>]*-->/g;
const _MODE_SCAN_DIRS: readonly string[] = [
    path.join('agents', 'sessions'),
    path.join('agents', 'runtime', 'reports'),
    path.join('agents', 'handoffs'),
    path.join('agents', 'learnings'),
];
const _KNOWN_MODES: ReadonlySet<string> = new Set([
    'developer',
    'reviewer',
    'tester',
    'po',
    'incident',
    'planner',
]);

// --- PyYAML date/timestamp parity (mirrors memory_lookup.ts) ----------------

const PYYAML_DATE_ONLY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const PYYAML_TIMESTAMP_RE =
    /^(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}(?:[Tt]|[ \t]+)[0-9]{1,2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9]{1,2}(?::[0-9]{2})?))?)$/;

/** Marker carrying PyYAML's `str(datetime.*)` form (for JSON default=str). */
class PyTimestamp {
    constructor(readonly pyStr: string) {}
    toString(): string {
        return this.pyStr;
    }
}

/**
 * Marker for a Python `float` so json.dumps renders integer-valued floats as
 * `0.0`, not `0`. JS has no int/float distinction; this preserves the
 * `staleness_rate` (always a float via round()) byte-for-byte.
 */
class PyFloat {
    constructor(readonly value: number) {}
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return (
        typeof v === 'object' &&
        v !== null &&
        !Array.isArray(v) &&
        !(v instanceof PyTimestamp) &&
        !(v instanceof PyFloat)
    );
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Mirror Python `_load_yaml`: PyYAML missing → print + exit(2). */
function _load_yaml(p: string): Record<string, unknown> {
    // The `yaml` npm dependency is always present in this package; the
    // ImportError branch (exit 2) is unreachable in the TS twin. Kept as a
    // documented divergence candidate — Python exits 2 if PyYAML is absent.
    const text = fs.readFileSync(p, 'utf-8');
    const doc = parseDocument(text, { version: '1.1', prettyErrors: false });
    if (doc.errors.length > 0) {
        const err = doc.errors[0];
        throw new Error(err ? err.message : 'YAML parse error');
    }
    YAML.visit(doc, {
        Scalar(_key, node) {
            if (!node.range) {
                return;
            }
            const raw = text.slice(node.range[0], node.range[1]);
            if (node.value instanceof Date) {
                if (PYYAML_DATE_ONLY_RE.test(raw)) {
                    (node as { value: unknown }).value = new PyTimestamp(raw);
                } else if (PYYAML_TIMESTAMP_RE.test(raw)) {
                    (node as { value: unknown }).value = new PyTimestamp(_pyYamlDatetimeStr(raw));
                }
                return;
            }
            if (typeof node.value === 'boolean' && node.type === 'PLAIN' && /^[ynYN]$/.test(raw)) {
                (node as { value: unknown }).value = raw;
            }
        },
    });
    const data = doc.toJS({ mapAsMap: false });
    return data == null ? {} : (data as Record<string, unknown>);
}

function _pad2(v: string): string {
    return v.padStart(2, '0');
}

function _pyYamlDatetimeStr(raw: string): string {
    const m =
        /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt]|[ \t]+)(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d*))?(?:[ \t]*(Z|[-+]\d{1,2}(?::\d{2})?))?$/.exec(
            raw,
        );
    if (!m) {
        return raw;
    }
    const [, y, mo, d, h, mi, s, frac, tz] = m;
    const date = `${y}-${_pad2(mo as string)}-${_pad2(d as string)}`;
    let time = `${_pad2(h as string)}:${mi}:${s}`;
    if (frac && /[1-9]/.test(frac)) {
        time += `.${(frac + '000000').slice(0, 6)}`;
    }
    let off = '';
    if (tz) {
        if (tz === 'Z') {
            off = '+00:00';
        } else {
            const tm = /^([-+])(\d{1,2})(?::(\d{2}))?$/.exec(tz);
            if (tm) {
                off = `${tm[1]}${_pad2(tm[2] as string)}:${tm[3] ?? '00'}`;
            }
        }
    }
    return `${date} ${time}${off}`;
}

// --- curated/intake iteration -----------------------------------------------

type CuratedTuple = [string, string, Record<string, unknown>];

/** Yield [file, type, entry] across both curated layouts. */
function _iter_curated_entries(): CuratedTuple[] {
    const out: CuratedTuple[] = [];
    for (const mtype of CURATED_TYPES) {
        const single = path.join(MEMORY_ROOT, `${mtype}.yml`);
        if (_isFile(single)) {
            const data = _load_yaml(single);
            const entries = data['entries'];
            if (Array.isArray(entries)) {
                for (const e of entries) {
                    if (_isPlainObject(e)) {
                        out.push([single, mtype, e]);
                    }
                }
            }
        }
        const type_dir = path.join(MEMORY_ROOT, mtype);
        if (_isDir(type_dir)) {
            for (const yml of _rglobYml(type_dir)) {
                const data = _load_yaml(yml) ?? {};
                const entries = (data as Record<string, unknown>)['entries'];
                if (Array.isArray(entries)) {
                    for (const e of entries) {
                        if (_isPlainObject(e)) {
                            out.push([yml, mtype, e]);
                        }
                    }
                } else if (_isPlainObject(data) && data['id']) {
                    out.push([yml, mtype, data]);
                }
            }
        }
    }
    return out;
}

/** sorted(dir.rglob("*.yml")) — recursive, lexically sorted absolute paths. */
function _rglobYml(root: string): string[] {
    const found: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.isFile() && ent.name.endsWith('.yml')) {
                found.push(full);
            }
        }
    };
    walk(root);
    // Python rglob ordering is unspecified but the script wraps it in
    // sorted(); reproduce that determinism.
    found.sort();
    return found;
}

/** sorted(INTAKE_ROOT.glob("*.jsonl")). */
function _globJsonl(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    return names
        .filter((n) => n.endsWith('.jsonl'))
        .sort()
        .map((n) => path.join(root, n));
}

interface IntakeStats {
    total_active: number;
    superseded: number;
    by_type: Record<string, number>;
    by_month: Record<string, number>;
}

function _intake_stats(): IntakeStats {
    let total = 0;
    const by_type = new Map<string, number>();
    const by_month = new Map<string, number>();
    let superseded = 0;
    if (_isDir(INTAKE_ROOT)) {
        for (const jsonl of _globJsonl(INTAKE_ROOT)) {
            const stem = path.basename(jsonl).replace(/\.jsonl$/, '');
            const month = stem.replace('signals-', '');
            for (const obj of _readJsonl(jsonl)) {
                if (obj['type'] === 'supersede') {
                    superseded += 1;
                    continue;
                }
                total += 1;
                const t = obj['entry_type'];
                if (typeof t === 'string') {
                    by_type.set(t, (by_type.get(t) ?? 0) + 1);
                }
                by_month.set(month, (by_month.get(month) ?? 0) + 1);
            }
        }
    }
    return {
        total_active: total,
        superseded,
        by_type: _mapToObj(by_type),
        by_month: _mapToObj(by_month),
    };
}

/** Read a JSONL file, yielding parsed objects (skips blank / malformed lines). */
function _readJsonl(p: string): Record<string, unknown>[] {
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return [];
    }
    const out: Record<string, unknown>[] = [];
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        let obj: unknown;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        if (_isPlainObject(obj)) {
            out.push(obj);
        }
    }
    return out;
}

/** Counter insertion-order → plain object (Python dict(Counter) keeps insert order). */
function _mapToObj(m: Map<string, number>): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const [k, v] of m) {
        obj[k] = v;
    }
    return obj;
}

interface StaleRow {
    file: string;
    type: string;
    id: string;
    overdue_days: number;
}

/** Mirror dt.date.today() as a UTC-naive "local" date — uses host local date. */
function _todayDate(): { y: number; m: number; d: number } {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/** Days between two y/m/d dates (a - b). */
function _dateDiffDays(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }): number {
    const am = Date.UTC(a.y, a.m - 1, a.d);
    const bm = Date.UTC(b.y, b.m - 1, b.d);
    return Math.round((am - bm) / (24 * 60 * 60 * 1000));
}

/** Parse a YYYY-MM-DD date string into y/m/d, or null (mirrors date.fromisoformat). */
function _parseIsoDate(s: string): { y: number; m: number; d: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) {
        return null;
    }
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) {
        return null;
    }
    return { y, m: mo, d };
}

function _addDays(date: { y: number; m: number; d: number }, days: number): { y: number; m: number; d: number } {
    const ms = Date.UTC(date.y, date.m - 1, date.d) + days * 24 * 60 * 60 * 1000;
    const dt = new Date(ms);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function _staleness_report(): StaleRow[] {
    const today = _todayDate();
    const stale: StaleRow[] = [];
    for (const [p, mtype, entry] of _iter_curated_entries()) {
        const lv = entry['last_validated'];
        const review_after = entry['review_after_days'];
        // Python: isinstance(lv, (str, dt.date)) — a PyTimestamp marks a parsed
        // YAML date; a string is a string. review_after must be an int (not bool).
        const lvIsDateLike = typeof lv === 'string' || lv instanceof PyTimestamp;
        const reviewIsInt = typeof review_after === 'number' && Number.isInteger(review_after) && typeof review_after !== 'boolean';
        if (!lvIsDateLike || !reviewIsInt) {
            continue;
        }
        // Python: last = date.fromisoformat(str(lv)). str(lv) is "YYYY-MM-DD"
        // for a date (parses) or "YYYY-MM-DD HH:MM:SS..." for a datetime/full
        // timestamp string (fromisoformat raises ValueError → skip).
        const lvStr = lv instanceof PyTimestamp ? lv.pyStr : (lv as string);
        const parsed = _parseIsoDate(lvStr);
        if (parsed === null) {
            continue;
        }
        const due = _addDays(parsed, review_after as number);
        if (_dateDiffDays(due, today) < 0) {
            stale.push({
                file: p,
                type: mtype,
                id: (entry['id'] as unknown as string) ?? '?',
                overdue_days: _dateDiffDays(today, due),
            });
        }
    }
    // sort by overdue_days descending, stable (mirrors Python list.sort).
    stale.sort((a, b) => b.overdue_days - a.overdue_days);
    return stale;
}

function _quarter_of(d: unknown): string {
    let parsed: { y: number; m: number } | null = null;
    if (typeof d === 'string') {
        const pd = _parseIsoDate(d.slice(0, 10));
        if (pd === null) {
            return 'unknown';
        }
        parsed = pd;
    } else if (d instanceof PyTimestamp) {
        const pd = _parseIsoDate(d.pyStr.slice(0, 10));
        if (pd === null) {
            return 'unknown';
        }
        parsed = pd;
    } else {
        return 'unknown';
    }
    return `${parsed.y}Q${Math.floor((parsed.m - 1) / 3) + 1}`;
}

interface QuarterlyStats {
    accepted_by_quarter: Record<string, number>;
    retired_by_quarter: Record<string, number>;
    // Python `float` — preserved via PyFloat so JSON renders `0.0` not `0`.
    staleness_rate: PyFloat;
    curated_total: number;
    curated_overdue: number;
}

function _quarterly_stats(): QuarterlyStats {
    const accepted = new Map<string, number>();
    for (const [, , entry] of _iter_curated_entries()) {
        const created = entry['created'] ?? entry['last_validated'];
        if (created !== undefined && created !== null) {
            const q = _quarter_of(created);
            accepted.set(q, (accepted.get(q) ?? 0) + 1);
        }
    }
    const retired = new Map<string, number>();
    if (_isDir(INTAKE_ROOT)) {
        for (const jsonl of _globJsonl(INTAKE_ROOT)) {
            for (const obj of _readJsonl(jsonl)) {
                if (obj['type'] !== 'supersede') {
                    continue;
                }
                const ts = obj['ts'];
                if (typeof ts === 'string') {
                    const q = _quarter_of(ts);
                    retired.set(q, (retired.get(q) ?? 0) + 1);
                }
            }
        }
    }
    const total = _iter_curated_entries().length;
    const overdue = _staleness_report().length;
    const rate = total ? overdue / total : 0.0;
    return {
        accepted_by_quarter: _mapToObj(accepted),
        retired_by_quarter: _mapToObj(retired),
        staleness_rate: new PyFloat(_pyRound3(rate)),
        curated_total: total,
        curated_overdue: overdue,
    };
}

/** Mirror Python round(x, 3) — banker's rounding to 3 decimals. */
function _pyRound3(x: number): number {
    const factor = 1000;
    const scaled = x * factor;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    if (Math.abs(diff - 0.5) < 1e-9) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    return rounded / factor;
}

interface OperationalStore {
    enabled: boolean;
    counts: { entries: null; recent_writes: null };
    note: string;
}

function _operational_store_stats(backend_status: string): OperationalStore | null {
    if (backend_status !== 'present') {
        return null;
    }
    return {
        enabled: true,
        counts: { entries: null, recent_writes: null },
        note:
            'full operational-store probing is owned by the ' +
            'agent-memory CLI adapter; stats stubbed here',
    };
}

interface RoleModeStats {
    total_markers: number;
    files_scanned: number;
    by_mode: Record<string, number>;
    unknown_modes: string[];
}

export function _role_mode_stats(): RoleModeStats {
    const counts = new Map<string, number>();
    let files_scanned = 0;
    const unknown_modes = new Set<string>();
    for (const root of _MODE_SCAN_DIRS) {
        if (!_exists(root)) {
            continue;
        }
        for (const md of _rglobMd(root)) {
            let text: string;
            try {
                text = fs.readFileSync(md, 'utf-8');
            } catch {
                continue;
            }
            files_scanned += 1;
            _MODE_MARKER_PATTERN.lastIndex = 0;
            let m: RegExpExecArray | null;
            // eslint-disable-next-line no-cond-assign
            while ((m = _MODE_MARKER_PATTERN.exec(text)) !== null) {
                const slug = (m[1] as string).toLowerCase();
                counts.set(slug, (counts.get(slug) ?? 0) + 1);
                if (!_KNOWN_MODES.has(slug)) {
                    unknown_modes.add(slug);
                }
            }
        }
    }
    let total = 0;
    for (const v of counts.values()) {
        total += v;
    }
    return {
        total_markers: total,
        files_scanned,
        by_mode: _mapToObj(counts),
        unknown_modes: [...unknown_modes].sort(),
    };
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _rglobMd(root: string): string[] {
    const found: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                walk(full);
            } else if (ent.isFile() && ent.name.endsWith('.md')) {
                found.push(full);
            }
        }
    };
    walk(root);
    found.sort();
    return found;
}

interface Report {
    backend: { status: string; backend: string; reason: string; cli_path: string };
    intake: IntakeStats;
    staleness: StaleRow[];
    quarterly: QuarterlyStats;
    role_modes: RoleModeStats;
    operational_store: OperationalStore | null;
}

export function build_report(): Report {
    const st = memory_status.status();
    return {
        backend: {
            status: st.status,
            backend: st.backend,
            reason: st.reason,
            cli_path: st.cli_path,
        },
        intake: _intake_stats(),
        staleness: _staleness_report(),
        quarterly: _quarterly_stats(),
        role_modes: _role_mode_stats(),
        operational_store: _operational_store_stats(st.status),
    };
}

function _print_text(report: Report): void {
    const out: string[] = [];
    const b = report.backend;
    out.push(`Backend:   ${b.status} (backend=${b.backend})`);
    if (b.reason) {
        out.push(`           reason: ${b.reason}`);
    }
    const intake = report.intake;
    out.push(`Intake:    ${intake.total_active} active, ${intake.superseded} superseded`);
    for (const [t, n] of _sortedEntries(intake.by_type)) {
        out.push(`  - ${t}: ${n}`);
    }
    const stale = report.staleness;
    if (stale.length === 0) {
        out.push('Staleness: no curated entries past review_after_days');
    } else {
        out.push(`Staleness: ${stale.length} entrie(s) overdue`);
        for (const row of stale.slice(0, 5)) {
            out.push(`  - ${row.id} (${row.type})  +${row.overdue_days}d  ${row.file}`);
        }
        if (stale.length > 5) {
            out.push(`  (+${stale.length - 5} more)`);
        }
    }
    const q = report.quarterly;
    out.push(`Quarterly: staleness-rate=${_pyPercent1(q.staleness_rate.value)} (${q.curated_overdue}/${q.curated_total})`);
    if (Object.keys(q.accepted_by_quarter).length > 0) {
        const acc = _sortedEntries(q.accepted_by_quarter)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ');
        out.push(`  accepted: ${acc}`);
    }
    if (Object.keys(q.retired_by_quarter).length > 0) {
        const ret = _sortedEntries(q.retired_by_quarter)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ');
        out.push(`  retired:  ${ret}`);
    }
    const rm = report.role_modes;
    if (rm.files_scanned) {
        out.push(`Role modes: ${rm.total_markers} marker(s) in ${rm.files_scanned} file(s)`);
        if (Object.keys(rm.by_mode).length > 0) {
            const modes = _sortedEntries(rm.by_mode)
                .map(([k, v]) => `${k}:${v}`)
                .join(', ');
            out.push(`  by mode: ${modes}`);
        }
        if (rm.unknown_modes.length > 0) {
            out.push(`  unknown: ${rm.unknown_modes.join(', ')} (not in the six reserved slugs)`);
        }
    }
    if (report.operational_store) {
        out.push('Operational-store: present (stats via agent-memory CLI)');
    }
    process.stdout.write(out.map((line) => `${line}\n`).join(''));
}

/** sorted(dict.items()) — by key, lexically. */
function _sortedEntries(obj: Record<string, number>): [string, number][] {
    return Object.entries(obj).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** Mirror Python f"{x:.1%}" — percentage with one decimal. */
function _pyPercent1(x: number): string {
    return `${(x * 100).toFixed(1)}%`;
}

// --- JSON output (json.dumps(report, indent=2, default=str)) ----------------

function pyJsonDumps(value: unknown, indent: number): string {
    return _escapeNonAscii(_dumpsIndent(value, indent, 0));
}

function _dumpsIndent(value: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _jsonNum(value);
    }
    if (typeof value === 'string') {
        return _jsonStrAscii(value);
    }
    if (value instanceof PyTimestamp) {
        return _jsonStrAscii(value.pyStr);
    }
    if (value instanceof PyFloat) {
        return _jsonFloat(value.value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpsIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (_isPlainObject(value)) {
        const keys = Object.keys(value);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map((k) => `${pad}${_jsonStrAscii(k)}: ${_dumpsIndent(value[k], indent, depth + 1)}`);
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
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

/** Render a Python float — integer-valued floats keep a `.0` suffix (repr(float)). */
function _jsonFloat(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return Number.isInteger(n) ? `${n}.0` : String(n);
}

function _jsonStrAscii(s: string): string {
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

function _escapeNonAscii(s: string): string {
    let out = '';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x7f) {
            for (let i = 0; i < ch.length; i += 1) {
                out += `\\u${ch.charCodeAt(i).toString(16).padStart(4, '0')}`;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

interface ParsedArgs {
    format: 'text' | 'json';
}

const _PROG = 'memory_report.py';
const _USAGE = 'usage: memory_report.py [-h] [--format {text,json}]\n';

/** Mirror argparse error: print usage + "<prog>: error: <msg>" to stderr, exit 2. */
function _argError(msg: string): never {
    process.stderr.write(_USAGE);
    process.stderr.write(`${_PROG}: error: ${msg}\n`);
    process.exit(2);
}

function _parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = { format: 'text' };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--format') {
            args.format = _checkChoice(argv[++i], ['text', 'json'], '--format') as 'text' | 'json';
        } else if (a.startsWith('--format=')) {
            args.format = _checkChoice(a.slice('--format='.length), ['text', 'json'], '--format') as
                | 'text'
                | 'json';
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(_USAGE);
            process.exit(0);
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return args;
}

function _checkChoice(value: string | undefined, choices: string[], flag: string): string {
    if (value === undefined || !choices.includes(value)) {
        _argError(
            `argument ${flag}: invalid choice: '${value ?? ''}' (choose from ${choices
                .map((c) => `'${c}'`)
                .join(', ')})`,
        );
    }
    return value;
}

export function main(): number {
    const args = _parseArgs(process.argv.slice(2));
    const report = build_report();
    if (args.format === 'json') {
        process.stdout.write(`${pyJsonDumps(report, 2)}\n`);
    } else {
        _print_text(report);
    }
    return 0;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isMain) {
    process.exit(main());
}
