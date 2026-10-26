/**
 * Rename proof by static scan of migration sources.
 *
 * The differ refuses to guess a rename, because a wrong guess silently rewires
 * foreign-key edges and the reader has no way to see that it happened. But it
 * accepts proof, and proof turns out to be cheap: a rename is *declared* in the
 * migration that performs it, so grepping the sources finds it without running
 * anything.
 *
 * Recognised declarations:
 *   - Laravel `Schema::rename('old', 'new')`
 *   - Laravel `$table->renameColumn('old', 'new')` inside `Schema::table('t', …)`
 *   - Prisma `@@map` / `@map` deltas between two revisions of a schema file
 *
 * Every entry carries the file and line it came from. A candidate map with no
 * provenance is indistinguishable from a heuristic, which is the thing this
 * module exists to avoid.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { RenameMap } from './diff.js';
import { req } from './_match.js';

export interface RenameEvidence {
    kind: 'table' | 'column';
    /** Present for a column rename; the source-side table name. */
    table?: string;
    from: string;
    to: string;
    file: string;
    line: number;
}

export interface RenameScanResult {
    map: RenameMap;
    evidence: RenameEvidence[];
}

const MIGRATION_EXTENSIONS = new Set(['.php']);

function walk(dir: string, depth: number, out: string[]): void {
    if (depth > 6) return;
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        if (e.name === 'node_modules' || e.name === 'vendor' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            walk(p, depth + 1, out);
            continue;
        }
        if (MIGRATION_EXTENSIONS.has(path.extname(e.name))) out.push(p);
    }
}

/**
 * Which table a `renameColumn` call belongs to.
 *
 * A migration file can carry several `Schema::table('x', …)` blocks, so the
 * owning table is the nearest such call at or above the line. Attributing a
 * column rename to the wrong table would produce a rename map that silently
 * does nothing — the stale-entry advisory in the differ would fire, but the
 * cause would be invisible.
 */
function owningTable(lines: string[], index: number): string | null {
    for (let i = index; i >= 0; i -= 1) {
        const m = /Schema::(?:connection\([^)]*\)->)?table\(\s*['"]([^'"]+)['"]/.exec(lines[i] ?? '');
        if (m !== null) return req(m, 1);
    }
    return null;
}

export function scanRenamesInText(text: string, file: string): RenameEvidence[] {
    const out: RenameEvidence[] = [];
    const lines = text.split(/\r?\n/);

    lines.forEach((line, i) => {
        const tableRename = /Schema::(?:connection\([^)]*\)->)?rename\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/.exec(
            line,
        );
        if (tableRename !== null) {
            out.push({ kind: 'table', from: req(tableRename, 1), to: req(tableRename, 2), file, line: i + 1 });
        }

        const columnRename = /->renameColumn\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/.exec(line);
        if (columnRename !== null) {
            const table = owningTable(lines, i);
            if (table !== null) {
                out.push({
                    kind: 'column',
                    table,
                    from: req(columnRename, 1),
                    to: req(columnRename, 2),
                    file,
                    line: i + 1,
                });
            }
        }
    });

    return out;
}

/** Physical names declared by `@@map` / `@map`, keyed by model and field. */
function prismaPhysicalNames(text: string): { tables: Map<string, string>; columns: Map<string, Map<string, string>> } {
    const tables = new Map<string, string>();
    const columns = new Map<string, Map<string, string>>();
    let model: string | null = null;

    for (const raw of text.split(/\r?\n/)) {
        const line = raw.replace(/\/\/.*$/, '').trim();
        const head = /^model\s+([A-Za-z_]\w*)\s*\{/.exec(line);
        if (head !== null) {
            model = req(head, 1);
            tables.set(model, model);
            columns.set(model, new Map());
            continue;
        }
        if (model === null) continue;
        if (line === '}') {
            model = null;
            continue;
        }
        const tableMap = /^@@map\s*\(\s*"([^"]*)"\s*\)/.exec(line);
        if (tableMap !== null) {
            tables.set(model, req(tableMap, 1));
            continue;
        }
        const field = /^([A-Za-z_]\w*)\s+\S+[\s\S]*?@map\s*\(\s*"([^"]*)"\s*\)/.exec(line);
        if (field !== null) {
            columns.get(model)?.set(req(field, 1), req(field, 2));
            continue;
        }
        const plainField = /^([A-Za-z_]\w*)\s+\S+/.exec(line);
        if (plainField !== null && !line.startsWith('@')) {
            const existing = columns.get(model);
            const plainName = req(plainField, 1);
            if (existing !== undefined && !existing.has(plainName)) existing.set(plainName, plainName);
        }
    }

    return { tables, columns };
}

/**
 * A Prisma rename is a `@map` delta between two revisions of the same schema:
 * the model or field kept its logical name and changed its physical one.
 */
export function scanPrismaMapDelta(beforeText: string, afterText: string, file: string): RenameEvidence[] {
    const before = prismaPhysicalNames(beforeText);
    const after = prismaPhysicalNames(afterText);
    const out: RenameEvidence[] = [];

    for (const [model, beforePhysical] of before.tables) {
        const afterPhysical = after.tables.get(model);
        if (afterPhysical === undefined || afterPhysical === beforePhysical) continue;
        out.push({ kind: 'table', from: beforePhysical, to: afterPhysical, file, line: 0 });
    }

    for (const [model, beforeFields] of before.columns) {
        const afterFields = after.columns.get(model);
        if (afterFields === undefined) continue;
        const sourceTable = before.tables.get(model) ?? model;
        for (const [field, beforePhysical] of beforeFields) {
            const afterPhysical = afterFields.get(field);
            if (afterPhysical === undefined || afterPhysical === beforePhysical) continue;
            out.push({ kind: 'column', table: sourceTable, from: beforePhysical, to: afterPhysical, file, line: 0 });
        }
    }

    return out;
}

export function toRenameMap(evidence: RenameEvidence[]): RenameMap {
    const map: RenameMap = {};
    for (const e of evidence) {
        if (e.kind === 'table') {
            map.tables = map.tables ?? {};
            map.tables[e.from] = e.to;
            continue;
        }
        if (e.table === undefined) continue;
        map.columns = map.columns ?? {};
        const forTable = map.columns[e.table] ?? {};
        forTable[e.from] = e.to;
        map.columns[e.table] = forTable;
    }
    return map;
}

/** Scan a migration directory. Paths in the evidence stay relative to `dir`. */
export function scanRenames(dir: string): RenameScanResult {
    const files: string[] = [];
    walk(dir, 0, files);
    files.sort();

    const evidence: RenameEvidence[] = [];
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        evidence.push(...scanRenamesInText(text, path.relative(dir, file)));
    }

    return { map: toRenameMap(evidence), evidence };
}
