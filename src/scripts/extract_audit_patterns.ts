#!/usr/bin/env node
/**
 * Mine repeated phase patterns from `agents/runtime/state/audit/*.jsonl`.
 *
 * TypeScript twin of `src/scripts/extract_audit_patterns.py` (ADR-092 —
 * Python→TS migration, Phase 8 / Wave 8g). Mirrors the Python CLI contract
 * EXACTLY — the `--audit-dir` / `--month` / `--min-count` / `--json` flags,
 * exit codes (0 ok / 2 min-count below floor), the stdout/stderr split,
 * byte-identical stdout messages, and byte-identical `json.dump(...,
 * indent=2, sort_keys=True)` output.
 *
 * Consumer side of `audit-log-v1` (see `docs/contracts/audit-log-v1.md`).
 * Reads append-only JSONL audit lines and surfaces patterns that repeat
 * across INDEPENDENT runs — distinct `work_id` values — so the human
 * reviewer can promote them via the `learning-to-rule-or-skill` skill.
 *
 * Read-only: never mutates the JSONL, never writes outside stdout.
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/extract_audit_patterns.py → parent.parent.parent == repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const DEFAULT_AUDIT_DIR = path.join(ROOT, 'agents', 'runtime', 'state', 'audit');
export const SCHEMA_VERSION = 1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
type Rec = Record<string, Json>;

/** Mirror of the `Pattern` dataclass. `work_ids` is a Set (Python set). */
class Pattern {
    summary: string;
    phase: string;
    outcome: string;
    rules_applied: string[];
    count = 0;
    line_ids: string[] = [];
    work_ids: Set<string> = new Set<string>();
    first_seen = '';
    last_seen = '';

    constructor(summary: string, phase: string, outcome: string, rules_applied: string[]) {
        this.summary = summary;
        this.phase = phase;
        this.outcome = outcome;
        this.rules_applied = rules_applied;
    }

    /** Mirror `to_dict`: asdict(self) with work_ids → sorted list. */
    to_dict(): Rec {
        return {
            summary: this.summary,
            phase: this.phase,
            outcome: this.outcome,
            rules_applied: this.rules_applied,
            count: this.count,
            line_ids: this.line_ids,
            // asdict() preserves the set as-is; the override replaces it with
            // sorted(self.work_ids).
            work_ids: [...this.work_ids].sort(),
            first_seen: this.first_seen,
            last_seen: this.last_seen,
        };
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}
function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Yield parsed JSONL records from the audit directory.
 * Silently skips malformed lines (forward-compat per contract § 86).
 */
function* _iterLines(auditDir: string, month: string | null): Generator<Rec> {
    if (!_isDir(auditDir) && !fs.existsSync(auditDir)) {
        return;
    }
    let files: string[];
    if (month) {
        files = [path.join(auditDir, `${month}.jsonl`)];
    } else {
        // sorted(audit_dir.glob("*.jsonl")) — lexicographic on full path.
        let names: string[];
        try {
            names = fs.readdirSync(auditDir);
        } catch {
            return;
        }
        files = names
            .filter((n) => n.endsWith('.jsonl'))
            .map((n) => path.join(auditDir, n))
            .sort();
    }
    for (const p of files) {
        if (!_isFile(p)) {
            continue;
        }
        const text = fs.readFileSync(p, 'utf-8');
        // Python iterates lines including the trailing-newline split shape;
        // splitting on "\n" and stripping per line reproduces it.
        for (let raw of text.split('\n')) {
            raw = raw.trim();
            if (!raw) {
                continue;
            }
            let rec: Json;
            try {
                rec = JSON.parse(raw);
            } catch {
                continue;
            }
            if (rec === null || typeof rec !== 'object' || Array.isArray(rec)) {
                // Non-dict JSON (e.g. a bare number/string) — `.get` in Python
                // would raise; but only well-formed dict lines are emitted in
                // practice. Treat as malformed-skip to stay safe.
                continue;
            }
            if ((rec as Rec).schema_version !== SCHEMA_VERSION) {
                continue;
            }
            yield rec as Rec;
        }
    }
}

function _patternKey(rec: Rec): string {
    // (phase, outcome, sorted(rules)) — encode as a stable string key.
    const rules = [...((rec.rules_applied as string[] | undefined) ?? [])].sort();
    const phase = (rec.phase as string | undefined) ?? '';
    const outcome = (rec.outcome as string | undefined) ?? '';
    return JSON.stringify([phase, outcome, rules]);
}

/** Apply supersede chains: drop records whose id is superseded. */
function _resolveSupersedes(records: Rec[]): Rec[] {
    const superseded = new Set<string>();
    for (const rec of records) {
        if (rec.type === 'supersede' && rec.supersedes) {
            superseded.add(rec.supersedes as string);
        }
    }
    return records.filter((r) => !superseded.has(r.id as string));
}

/** Group records into patterns; enforce independence floor. */
export function mine(auditDir: string, month: string | null, minCount: number): Rec[] {
    const records = _resolveSupersedes([..._iterLines(auditDir, month)]);
    // Preserve insertion order of first-seen keys (Python dict ordering).
    const groups = new Map<string, Pattern>();
    for (const rec of records) {
        const t = rec.type;
        if (!(t === undefined || t === null || t === 'phase')) {
            continue;
        }
        const key = _patternKey(rec);
        let pat = groups.get(key);
        if (pat === undefined) {
            const [phase, outcome, rules] = JSON.parse(key) as [string, string, string[]];
            const rulesHash = rules.join('+') || '<none>';
            pat = new Pattern(`${phase}:${outcome}:${rulesHash}`, phase, outcome, [...rules]);
            groups.set(key, pat);
        }
        const ts = (rec.ts as string | undefined) ?? '';
        const wid = (rec.work_id as string | undefined) ?? '';
        if (wid) {
            pat.work_ids.add(wid);
        }
        const lineId = (rec.id as string | undefined) ?? '';
        if (lineId) {
            pat.line_ids.push(lineId);
        }
        pat.count = pat.work_ids.size;
        if (!pat.first_seen || ts < pat.first_seen) {
            pat.first_seen = ts;
        }
        if (!pat.last_seen || ts > pat.last_seen) {
            pat.last_seen = ts;
        }
    }
    const out: Rec[] = [];
    for (const p of groups.values()) {
        if (p.count >= minCount) {
            out.push(p.to_dict());
        }
    }
    // sort key: (-count, summary). JS sort is stable, matching Python's
    // stable Timsort for the secondary tie-break.
    out.sort((a, b) => {
        const dc = (b.count as number) - (a.count as number);
        if (dc !== 0) {
            return dc;
        }
        const sa = a.summary as string;
        const sb = b.summary as string;
        return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
    return out;
}

/** Mirror Python str format `{x:>N}` / `{x:<N}` (space pad). */
function _rjust(s: string, width: number): string {
    return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}
function _ljust(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function _renderTable(patterns: Rec[]): string {
    if (patterns.length === 0) {
        return '(no patterns at or above the min-count threshold)';
    }
    const lines: string[] = [
        `${_rjust('count', 5)}  ${_ljust('phase', 10)} ${_ljust('outcome', 8)} ${_ljust('rules', 40)} summary`,
        `${'-'.repeat(5)}  ${'-'.repeat(10)} ${'-'.repeat(8)} ${'-'.repeat(40)} -------`,
    ];
    for (const p of patterns) {
        let rules = (p.rules_applied as string[]).join(',') || '<none>';
        if (rules.length > 38) {
            rules = rules.slice(0, 35) + '...';
        }
        lines.push(
            `${_rjust(String(p.count), 5)}  ${_ljust(p.phase as string, 10)} ${_ljust(p.outcome as string, 8)} ` +
                `${_ljust(rules, 40)} ${p.summary as string}`,
        );
    }
    return lines.join('\n');
}

// --- json.dumps(indent=2, sort_keys=True) emulation (ensure_ascii=True) -----

function _pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

/** json.dumps(indent=2, sort_keys=True) for plain JSON values. */
function _dumps(obj: Json, level = 0): string {
    if (obj === null || obj === undefined) {
        return 'null';
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (typeof obj === 'number') {
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + _dumps(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Rec).sort();
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map((k) => `${pad}${_pyJsonStr(k)}: ${_dumps((obj as Rec)[k], level + 1)}`);
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

interface Args {
    audit_dir: string;
    month: string | null;
    min_count: number;
    json: boolean;
}

export function parseArgs(argv: string[]): Args {
    const args: Args = {
        audit_dir: DEFAULT_AUDIT_DIR,
        month: null,
        min_count: 2,
        json: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--audit-dir') {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write('argument --audit-dir: expected one argument\n');
                process.exit(2);
            }
            args.audit_dir = v;
        } else if (a.startsWith('--audit-dir=')) {
            args.audit_dir = a.slice('--audit-dir='.length);
        } else if (a === '--month') {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write('argument --month: expected one argument\n');
                process.exit(2);
            }
            args.month = v;
        } else if (a.startsWith('--month=')) {
            args.month = a.slice('--month='.length);
        } else if (a === '--min-count') {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write('argument --min-count: expected one argument\n');
                process.exit(2);
            }
            args.min_count = parseInt(v, 10);
        } else if (a.startsWith('--min-count=')) {
            args.min_count = parseInt(a.slice('--min-count='.length), 10);
        } else if (a === '--json') {
            args.json = true;
        } else {
            process.stderr.write(`unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    const args = parseArgs(argv ?? process.argv.slice(2));

    if (args.min_count < 2) {
        process.stderr.write(
            '❌  --min-count must be >= 2 (independence floor per ' +
                'audit-log-v1 § Privacy floor).\n',
        );
        return 2;
    }

    const patterns = mine(args.audit_dir, args.month, args.min_count);
    if (args.json) {
        process.stdout.write(_dumps(patterns));
        process.stdout.write('\n');
    } else {
        process.stdout.write(_renderTable(patterns) + '\n');
    }
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}
