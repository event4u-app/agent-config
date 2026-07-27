/**
 * SPIKE S0.3 — raw-SQL migration safety adapter (Phase-1 wedge of
 * agents/roadmaps/archive/road-to-scale-and-history-discipline.md).
 *
 * Covers:
 *   R-A6 (F6, unsafe migrations):
 *     (a) irreversible destructive op — DROP TABLE / DROP COLUMN / TRUNCATE
 *         without a `migration-unsafe` waiver;
 *     (b) ADD COLUMN ... NOT NULL without DEFAULT on ALTER of an existing table;
 *     (c) CREATE INDEX without CONCURRENTLY — gate tier on postgres-dialect
 *         files (heuristic), advice tier otherwise;
 *     (d) column type change (ALTER COLUMN ... [SET DATA] TYPE) without waiver.
 *   R-A7 (F7, unbounded table growth):
 *     CREATE TABLE for append-only-shaped names (*_logs, *_log, *_history,
 *     *_events, *_audits, audit_*, *_jobs, *_queue, sessions, notifications)
 *     without a `-- retention: <policy>` comment in the file or a
 *     `-- no-retention: <reason>` waiver.
 *
 * Robustness contract: `scan_sql_files` must NEVER throw on arbitrary SQL.
 * Every file is scanned inside a try/catch; failures land in
 * `crashed_files`, never as an exception.
 *
 * Waived patterns are still emitted as findings with `waived: true`
 * (auditable), and the waiver is recorded in `waivers`. Callers that gate
 * should filter on `!finding.waived`.
 */

import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import {
    type Finding,
    type FindingTier,
    type ScanResult,
    type WaiverRecord,
    parse_waiver,
} from './types.js';

export interface SqlScanResult extends ScanResult {
    /** Files whose scan threw — the crash counter for the harvest test. */
    crashed_files: string[];
}

// --- SQL masking + statement splitting -------------------------------

interface Statement {
    /** Masked statement text (comments blanked, string contents blanked). */
    text: string;
    /** 1-indexed line of the first non-blank char of the statement. */
    line: number;
}

/**
 * Return a same-length copy of `text` with comment bodies and string
 * contents replaced by spaces (newlines preserved), and semicolons inside
 * quoted identifiers neutralized. Statement keywords survive; anything an
 * author wrote in prose or data does not.
 *
 * Handles: `--` line comments, nested block comments, 'strings' with ''
 * and backslash escapes, "quoted identifiers", `backtick identifiers`,
 * $tag$ dollar-quoted strings.
 */
export function mask_sql(text: string): string {
    const out: string[] = [];
    const n = text.length;
    let i = 0;
    type State =
        | 'normal'
        | 'line_comment'
        | 'block_comment'
        | 'squote'
        | 'dquote'
        | 'backtick'
        | 'dollar';
    let state: State = 'normal';
    let block_depth = 0;
    let dollar_tag = '';

    const blank = (c: string): string => (c === '\n' ? '\n' : ' ');

    while (i < n) {
        const c = text[i]!;
        const c2 = text[i + 1];
        switch (state) {
            case 'normal': {
                if (c === '-' && c2 === '-') {
                    state = 'line_comment';
                    out.push('  ');
                    i += 2;
                } else if (c === '/' && c2 === '*') {
                    state = 'block_comment';
                    block_depth = 1;
                    out.push('  ');
                    i += 2;
                } else if (c === "'") {
                    state = 'squote';
                    out.push("'");
                    i += 1;
                } else if (c === '"') {
                    state = 'dquote';
                    out.push('"');
                    i += 1;
                } else if (c === '`') {
                    state = 'backtick';
                    out.push('`');
                    i += 1;
                } else if (c === '$') {
                    const m = text.slice(i).match(/^\$[A-Za-z_]*\$/);
                    if (m) {
                        state = 'dollar';
                        dollar_tag = m[0];
                        out.push(' '.repeat(m[0].length));
                        i += m[0].length;
                    } else {
                        out.push(c);
                        i += 1;
                    }
                } else {
                    out.push(c);
                    i += 1;
                }
                break;
            }
            case 'line_comment': {
                if (c === '\n') {
                    state = 'normal';
                    out.push('\n');
                } else {
                    out.push(' ');
                }
                i += 1;
                break;
            }
            case 'block_comment': {
                if (c === '/' && c2 === '*') {
                    block_depth += 1;
                    out.push('  ');
                    i += 2;
                } else if (c === '*' && c2 === '/') {
                    block_depth -= 1;
                    out.push('  ');
                    i += 2;
                    if (block_depth <= 0) state = 'normal';
                } else {
                    out.push(blank(c));
                    i += 1;
                }
                break;
            }
            case 'squote': {
                if (c === "'" && c2 === "'") {
                    out.push('  ');
                    i += 2;
                } else if (c === '\\' && c2 !== undefined) {
                    out.push('  ');
                    i += 2;
                } else if (c === "'") {
                    state = 'normal';
                    out.push("'");
                    i += 1;
                } else {
                    out.push(blank(c));
                    i += 1;
                }
                break;
            }
            case 'dquote':
            case 'backtick': {
                const closer = state === 'dquote' ? '"' : '`';
                if (c === closer) {
                    state = 'normal';
                    out.push(closer);
                } else if (c === ';') {
                    // Keep identifier text (needed for table names) but make
                    // sure a pathological ';' inside it never splits.
                    out.push(' ');
                } else {
                    out.push(c);
                }
                i += 1;
                break;
            }
            case 'dollar': {
                if (text.startsWith(dollar_tag, i)) {
                    state = 'normal';
                    out.push(' '.repeat(dollar_tag.length));
                    i += dollar_tag.length;
                } else {
                    out.push(blank(c));
                    i += 1;
                }
                break;
            }
        }
    }
    return out.join('');
}

/** Split masked SQL into statements with 1-indexed start lines. */
export function split_statements(masked: string): Statement[] {
    const statements: Statement[] = [];
    let start = 0;
    const flush = (end: number): void => {
        const raw = masked.slice(start, end);
        const first_visible = raw.search(/\S/);
        if (first_visible >= 0) {
            const line =
                1 +
                (masked.slice(0, start + first_visible).match(/\n/g)?.length ?? 0);
            statements.push({ text: raw, line });
        }
        start = end + 1;
    };
    for (let i = 0; i < masked.length; i++) {
        if (masked[i] === ';') flush(i);
    }
    flush(masked.length);
    return statements;
}

// --- Heuristics -------------------------------------------------------

const PG_DIALECT_RE =
    /\bJSONB\b|\bBIGSERIAL\b|\bSERIAL\b|::\w|\bUSING\s+(GIN|GIST|BRIN|SPGIST)\b|\bCONCURRENTLY\b|\bpg_\w|postgres|gen_random_uuid|uuid_generate|\$\$/i;

/** Table-name shapes treated as append-only (growth-budget candidates). */
export function is_append_only_name(table: string): boolean {
    const t = table.toLowerCase().replace(/^.*\./, '');
    return (
        /_logs?$/.test(t) ||
        /_history$/.test(t) ||
        /_events$/.test(t) ||
        /_audits$/.test(t) ||
        /^audit_/.test(t) ||
        /_jobs$/.test(t) ||
        /_queue$/.test(t) ||
        t === 'sessions' ||
        t === 'notifications'
    );
}

const RETENTION_RE = /(?:--|\/\/|#)\s*retention\s*:\s*\S/;

// --- Per-file scan ----------------------------------------------------

interface FileFindings {
    findings: Finding[];
    waivers: WaiverRecord[];
}

function make_finding(
    rule: 'R-A6' | 'R-A7',
    file: string,
    line: number,
    message: string,
    tier: FindingTier,
    raw_lines: string[],
): { finding: Finding; waiver: WaiverRecord | null } {
    const finding: Finding = {
        failure_class: rule === 'R-A6' ? 'F6' : 'F7',
        rule,
        file,
        line,
        message,
        tier,
    };
    const waiver = parse_waiver(raw_lines, line - 1);
    const expected_kind = rule === 'R-A6' ? 'migration-unsafe' : 'no-retention';
    if (waiver && waiver.kind === expected_kind) {
        waiver.file = file;
        finding.waived = true;
        finding.waiver_reason = waiver.reason;
        return { finding, waiver };
    }
    return { finding, waiver: null };
}

function scan_one_file(file: string, text: string): FileFindings {
    const findings: Finding[] = [];
    const waivers: WaiverRecord[] = [];
    const raw_lines = text.split('\n');
    const masked = mask_sql(text);
    const statements = split_statements(masked);
    // Dialect detection runs on the MASKED text — comments must not carry
    // dialect signals (a fixture header mentioning "postgres" is prose, not SQL).
    const is_pg = PG_DIALECT_RE.test(masked);
    const file_declares_retention = raw_lines.some((l) => RETENTION_RE.test(l));

    const push = (
        rule: 'R-A6' | 'R-A7',
        line: number,
        message: string,
        tier: FindingTier = 'gate',
    ): void => {
        const { finding, waiver } = make_finding(
            rule,
            file,
            line,
            message,
            tier,
            raw_lines,
        );
        findings.push(finding);
        if (waiver) waivers.push(waiver);
    };

    for (const stmt of statements) {
        const norm = stmt.text.replace(/\s+/g, ' ').trim().toUpperCase();
        if (norm === '') continue;

        // R-A6(a) — irreversible destructive ops.
        if (/^DROP TABLE\b/.test(norm)) {
            push('R-A6', stmt.line, 'DROP TABLE without migration-unsafe waiver — irreversible destructive op');
        }
        if (/^TRUNCATE\b/.test(norm)) {
            push('R-A6', stmt.line, 'TRUNCATE without migration-unsafe waiver — irreversible destructive op');
        }
        if (/^ALTER TABLE\b/.test(norm) && /\bDROP COLUMN\b/.test(norm)) {
            push('R-A6', stmt.line, 'DROP COLUMN without migration-unsafe waiver — irreversible destructive op');
        }

        // R-A6(b) — ADD COLUMN ... NOT NULL without DEFAULT.
        if (/^ALTER TABLE\b/.test(norm)) {
            for (const clause of split_top_level_clauses(norm)) {
                if (
                    /\bADD (COLUMN )?[^,]*\bNOT NULL\b/.test(clause) &&
                    /\bADD\b/.test(clause) &&
                    !/\bDEFAULT\b/.test(clause)
                ) {
                    push('R-A6', stmt.line, 'ADD COLUMN ... NOT NULL without DEFAULT on existing table — fails on non-empty tables');
                }
            }
        }

        // R-A6(c) — CREATE INDEX without CONCURRENTLY.
        if (/^CREATE (UNIQUE )?INDEX\b/.test(norm) && !/\bCONCURRENTLY\b/.test(norm)) {
            push(
                'R-A6',
                stmt.line,
                is_pg
                    ? 'CREATE INDEX without CONCURRENTLY on postgres — locks writes during build'
                    : 'CREATE INDEX without CONCURRENTLY (dialect unknown) — verify lock behaviour',
                is_pg ? 'gate' : 'advice',
            );
        }

        // R-A6(d) — column type change.
        if (
            /^ALTER TABLE\b/.test(norm) &&
            /\bALTER (COLUMN )?["`]?\w+["`]? (SET DATA )?TYPE\b/.test(norm)
        ) {
            push('R-A6', stmt.line, 'ALTER COLUMN ... TYPE without migration-unsafe waiver — table rewrite / lossy cast risk');
        }

        // R-A7 — append-only table without retention declaration.
        const ct = norm.match(
            /^CREATE (?:UNLOGGED |TEMPORARY |TEMP )?TABLE (?:IF NOT EXISTS )?["`]?([\w.]+)["`]?/,
        );
        if (ct && ct[1] && is_append_only_name(ct[1]) && !file_declares_retention) {
            push(
                'R-A7',
                stmt.line,
                `CREATE TABLE ${ct[1]!.toLowerCase()} looks append-only but declares no retention policy (add "-- retention: <policy>" or a no-retention waiver)`,
            );
        }
    }

    return { findings, waivers };
}

/** Split an ALTER TABLE body into comma-separated clauses at paren depth 0. */
function split_top_level_clauses(norm: string): string[] {
    const clauses: string[] = [];
    let depth = 0;
    let cur = '';
    for (const c of norm) {
        if (c === '(') depth += 1;
        else if (c === ')') depth -= 1;
        if (c === ',' && depth === 0) {
            clauses.push(cur);
            cur = '';
        } else {
            cur += c;
        }
    }
    clauses.push(cur);
    return clauses;
}

// --- Public API -------------------------------------------------------

/** Scan the given .sql files. Never throws; crashes are counted per file. */
export function scan_sql_files(files: string[]): SqlScanResult {
    const result: SqlScanResult = {
        findings: [],
        scanned_files: [],
        waivers: [],
        crashed_files: [],
    };
    for (const file of files) {
        try {
            const text = readFileSync(file, 'utf8');
            const { findings, waivers } = scan_one_file(file, text);
            result.findings.push(...findings);
            result.waivers.push(...waivers);
            result.scanned_files.push(file);
        } catch {
            result.crashed_files.push(file);
        }
    }
    return result;
}

/** Recursively collect *.sql under `dir` and scan them. */
export function scan_dir(dir: string): SqlScanResult {
    return scan_sql_files(collect_sql_files(dir));
}

export function collect_sql_files(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        let entries: string[];
        try {
            entries = readdirSync(d);
        } catch {
            return;
        }
        for (const e of entries) {
            if (e === 'node_modules' || e === '.git') continue;
            const p = join(d, e);
            let st;
            try {
                st = lstatSync(p); // never follow symlinks (council PR-review finding)
            } catch {
                continue;
            }
            if (st.isSymbolicLink()) continue;
            if (st.isDirectory()) walk(p);
            else if (e.toLowerCase().endsWith('.sql')) out.push(p);
        }
    };
    walk(dir);
    return out;
}
