/**
 * R-A6 migration safety (F6) for Laravel migrations, at parity with the raw-SQL
 * adapter's shapes: drop table or column, a NOT NULL column added without a
 * default, a column change, and an index added on postgres. Each fires only on
 * a table an earlier migration created (or one no scanned migration creates):
 * an operation on a table the same file creates runs against an empty table.
 *
 * Advice tier: spike S0.3 measured raw SQL, not Blueprint reading. Renames and
 * added foreign keys are not checked here — their rules wait on their own
 * spikes (road-to-database-evolution-tactics 4.1).
 */
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';

import { readLaravelSchema } from '../schema/readers/laravel_migrations.js';
import type { DdlOp } from '../schema/replay.js';
import { type Finding, is_ignored_dir, parse_waiver } from './types';

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

function risk(op: DdlOp, engine: string): { cls: MigrationRiskClass; message: string } | null {
    switch (op.op) {
        case 'drop-table':
            return { cls: 'destructive', message: `drop of existing table ${op.table} — irreversible destructive op` };
        case 'drop-column':
            return { cls: 'destructive', message: `dropColumn ${op.table}.${op.column} on an existing table — irreversible destructive op` };
        case 'add-column':
            if (op.column.nullable || op.column.default !== null || op.column.auto_increment) return null;
            return {
                cls: 'data-dependent',
                message: `NOT NULL column ${op.table}.${op.column.name} added to an existing table without a default — fails on non-empty tables`,
            };
        case 'modify-column':
            return { cls: 'blocking', message: `->change() on ${op.table}.${op.column.name} — table rewrite / lossy cast risk` };
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

/** F6 advice findings over every Laravel migration under `dir`. */
export function scan_dir(dir: string): Finding[] {
    const sources = new Map<string, string>();
    let config: string | null = null;
    const files: Array<{ path: string; source: string }> = [];
    for (const f of walk(dir)) {
        const rel = relative(dir, f).split('\\').join('/');
        const text = readFileSync(f, 'utf8');
        if (rel === 'config/database.php') config = text;
        if (!/Schema::(?:connection\([^)]*\)\s*->\s*)?(?:create|table|drop|dropIfExists|rename)\(/.test(text)) continue;
        const key = /(^|\/)migrations\//.test(rel) ? rel : `migrations/${rel}`;
        sources.set(key, text);
        files.push({ path: key, source: text });
    }
    if (files.length === 0) return [];

    const read = readLaravelSchema(files, config);
    const createdIn = new Map<string, string>();
    const findings: Finding[] = [];
    for (const op of read.ops) {
        if (op.op === 'gap') continue;
        const key = `${op.connection}\u0000${op.table}`;
        if (op.op === 'create-table') {
            createdIn.set(key, op.at.file);
            continue;
        }
        if (op.uncertain || createdIn.get(key) === op.at.file) continue;
        const engine = read.engines.get(op.connection) ?? read.engines.get('') ?? 'unknown';
        const hit = risk(op, engine);
        if (!hit) continue;
        const finding: Finding = {
            failure_class: 'F6',
            rule: 'R-A6',
            file: op.at.file,
            line: op.at.line,
            message: `[${hit.cls}] ${hit.message}`,
            tier: 'advice',
        };
        const waiver = parse_waiver((sources.get(op.at.file) ?? '').split('\n'), op.at.line - 1);
        if (waiver && waiver.kind === 'migration-unsafe') {
            finding.waived = true;
            finding.waiver_reason = waiver.reason;
        }
        findings.push(finding);
    }
    return findings;
}
