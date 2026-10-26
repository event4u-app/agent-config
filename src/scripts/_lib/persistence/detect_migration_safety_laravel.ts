/**
 * R-A6 migration safety (F6) for Laravel migrations, for the shapes the raw-SQL
 * adapter's gate rules (a)–(d) check: drop table or column, a NOT NULL column
 * added without a default, a column change, and an index added on postgres.
 * Each fires only on a table an earlier migration created (or one no scanned
 * migration creates): an operation on a table the same file creates runs
 * against an empty table. A statement under a condition the reader cannot
 * evaluate (`if (Schema::hasColumn(…))`) is reported, marked conditional.
 *
 * Advice tier: spike S0.3 measured raw SQL, not Blueprint reading. Renames and
 * added foreign keys are not checked here — their rules wait on their own
 * spikes (road-to-database-evolution-tactics 4.1).
 */
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';

import { readLaravelSchema } from '../schema/readers/laravel_migrations.js';
import type { DdlOp } from '../schema/replay.js';
import { type Finding, type WaiverRecord, is_ignored_dir, is_laravel_migration_source, parse_waiver } from './types';

export type MigrationRiskClass = 'destructive' | 'data-dependent' | 'blocking';

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        let st;
        try {
            st = lstatSync(p);
        } catch {
            continue;
        }
        if (st.isSymbolicLink()) continue;
        if (st.isDirectory()) {
            if (!is_ignored_dir(entry)) out.push(...walk(p));
        } else if (p.endsWith('.php')) out.push(p);
    }
    return out;
}

/** A column modifier that gives existing rows a value without `->default()`. */
const DB_VALUE_RE = /->\s*(?:useCurrent|useCurrentOnUpdate|storedAs|virtualAs|generatedAs)\s*\(/;

function risk(op: DdlOp, engine: string, line: string): { cls: MigrationRiskClass; message: string } | null {
    switch (op.op) {
        case 'drop-table':
            return { cls: 'destructive', message: `drop of existing table ${op.table} — irreversible destructive op` };
        case 'drop-column':
            return { cls: 'destructive', message: `dropColumn ${op.table}.${op.column} on an existing table — irreversible destructive op` };
        case 'add-column':
            if (op.column.nullable || op.column.auto_increment || DB_VALUE_RE.test(line)) return null;
            if (op.column.default !== null && op.column.default.toLowerCase() !== 'null') return null;
            return {
                cls: 'data-dependent',
                message:
                    engine === 'mysql' || engine === 'mariadb'
                        ? `NOT NULL column ${op.table}.${op.column.name} added to an existing table without a default — existing rows get the type's implicit default`
                        : `NOT NULL column ${op.table}.${op.column.name} added to an existing table without a default — fails on non-empty tables`,
            };
        case 'modify-column':
            return { cls: 'blocking', message: `->change() on ${op.table}.${op.column.name} — may rewrite the table or cast lossily` };
        case 'add-index':
            if (op.primary || engine !== 'pgsql') return null;
            return {
                cls: 'blocking',
                message: `index on existing table ${op.table} on postgres without CONCURRENTLY — locks writes during build; use CREATE INDEX CONCURRENTLY with $withinTransaction = false`,
            };
        default:
            return null;
    }
}

/** F6 advice findings over every Laravel migration under `dir`, plus the waivers met. */
export function scan_dir(dir: string): { findings: Finding[]; waivers: WaiverRecord[] } {
    const sources = new Map<string, string>();
    let config: string | null = null;
    const files: Array<{ path: string; source: string }> = [];
    for (const f of walk(dir)) {
        const rel = relative(dir, f).split('\\').join('/');
        const text = readFileSync(f, 'utf8');
        if (rel === 'config/database.php') config = text;
        if (!is_laravel_migration_source(rel, text)) continue;
        const key = /(^|\/)migrations\//.test(rel) ? rel : `migrations/${rel}`;
        sources.set(key, text);
        files.push({ path: key, source: text });
    }
    if (files.length === 0) return { findings: [], waivers: [] };

    const read = readLaravelSchema(files, config);
    const createdIn = new Map<string, string>();
    const findings: Finding[] = [];
    const waivers: WaiverRecord[] = [];
    for (const op of read.ops) {
        if (op.op === 'gap') continue;
        const key = `${op.connection}\u0000${op.table}`;
        if (op.op === 'create-table') {
            createdIn.set(key, op.at.file);
            continue;
        }
        if (op.op === 'rename-table') {
            const from = createdIn.get(key);
            if (from !== undefined) createdIn.set(`${op.connection}\u0000${op.to}`, from);
        }
        if (createdIn.get(key) === op.at.file) continue;
        const engine = read.engines.get(op.connection) ?? 'unknown';
        const lines = (sources.get(op.at.file) ?? '').split('\n');
        const hit = risk(op, engine, lines[op.at.line - 1] ?? '');
        if (!hit) continue;
        const finding: Finding = {
            failure_class: 'F6',
            rule: 'R-A6',
            file: op.at.file,
            line: op.at.line,
            message: `[${hit.cls}] ${hit.message}${op.uncertain ? ' (conditional — runs when its guard holds)' : ''}`,
            tier: 'advice',
        };
        const waiver = parse_waiver(lines, op.at.line - 1);
        if (waiver && waiver.kind === 'migration-unsafe') {
            waiver.file = op.at.file;
            waivers.push(waiver);
            finding.waived = true;
            finding.waiver_reason = waiver.reason;
        }
        findings.push(finding);
    }
    return { findings, waivers };
}
