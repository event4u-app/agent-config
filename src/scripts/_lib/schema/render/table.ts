/**
 * Change-table renderer — the evidence half of the output.
 *
 * The diagram omits the full field delta on purpose (it makes the rows
 * unreadably wide), so this is where the delta lives. Shape follows the
 * `gap-table` convention already used by the persistence review surface:
 * object · status · delta · review relevance.
 *
 * "Review relevance" is a **pointer, never a verdict.** It says what a reviewer
 * should look at and why the change class makes it worth looking at; it does not
 * say whether the change is safe. Safety judgement belongs to `schema-review`,
 * and two locations answering one question diverge. So the column reads
 * "confirm X" and "check Y", never "unsafe" or "blocked".
 */
import type { ChangeStatus, SchemaDiff, TableDiff } from '../diff.js';
import { STATUS_MARKER } from '../diff.js';

export interface ChangeRow {
    object: string;
    kind: 'table' | 'column' | 'index' | 'foreign key' | 'primary key';
    status: ChangeStatus;
    delta: string;
    relevance: string;
}

function escapeCell(text: string): string {
    return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

const deltaText = (deltas: { field: string; from: string | null; to: string | null }[]): string =>
    deltas.map((d) => `${d.field}: ${d.from ?? '∅'} → ${d.to ?? '∅'}`).join('; ');

function tableRelevance(status: ChangeStatus): string {
    switch (status) {
        case 'added':
            return 'New table — confirm ownership, retention and the indexes its read paths need.';
        case 'removed':
            return 'Table disappears — confirm no reader remains and the data is either migrated or intentionally dropped.';
        case 'renamed':
            return 'Rename is proven by source, not guessed — confirm every reader and every foreign key follows.';
        case 'modified':
            return 'Structure changed — see the per-element rows below.';
        default:
            return '';
    }
}

function columnRelevance(
    status: ChangeStatus,
    codes: string[],
    column: { nullable: boolean; default: string | null; auto_increment: boolean },
    parentIsNew: boolean,
): string {
    if (status === 'added') {
        // A column of a brand-new table has no existing rows behind it, so a
        // backfill pointer there would be a false lead.
        if (parentIsNew) return 'Part of a new table — no existing rows to populate.';
        if (column.auto_increment) return 'Additive — the value is generated, so existing rows are covered.';
        return column.nullable || column.default !== null
            ? 'Additive — nullable or defaulted, so existing rows are covered.'
            : 'New column is NOT NULL with no default — confirm the backfill that populates existing rows.';
    }
    if (status === 'removed') {
        return 'Column disappears — confirm no reader remains and the values are not needed.';
    }
    if (status === 'renamed') {
        return 'Rename is proven by source — confirm every query and every index follows the new name.';
    }
    const notes: string[] = [];
    if (codes.includes('type')) notes.push('type changed — compare the value ranges each type admits');
    if (codes.includes('null')) notes.push('nullability changed — confirm the direction and what fills existing rows');
    if (codes.includes('default')) notes.push('default changed — existing rows keep the old value');
    if (codes.includes('auto')) notes.push('auto-increment changed — confirm the identity source');
    if (codes.includes('comment')) notes.push('comment only');
    return notes.length > 0 ? `${notes.join('; ')}.` : '';
}

function indexRelevance(status: ChangeStatus, codes: string[]): string {
    if (status === 'added') return 'New index — confirm it matches a real query shape and its write cost is acceptable.';
    if (status === 'removed') return 'Index disappears — confirm no query depended on it.';
    if (codes.includes('unique')) return 'Uniqueness changed — confirm the data satisfies the stricter direction.';
    if (codes.includes('cols')) return 'Index column set changed — confirm the query shapes it now covers.';
    return 'Index definition changed — confirm the query shapes it covers.';
}

function foreignKeyRelevance(status: ChangeStatus, codes: string[]): string {
    if (status === 'added') return 'New relationship — confirm the referenced rows exist for every current row.';
    if (status === 'removed') return 'Relationship disappears — referential integrity is no longer enforced here.';
    if (codes.includes('on_delete') || codes.includes('on_update'))
        return 'Referential action changed — this changes what happens to child rows on a parent write.';
    if (codes.includes('ref')) return 'Reference target changed — confirm the new target holds the expected rows.';
    return 'Relationship definition changed.';
}

export function changeRows(diff: SchemaDiff, includeUnchanged = false): ChangeRow[] {
    const rows: ChangeRow[] = [];

    const push = (row: ChangeRow): void => {
        if (row.status === 'unchanged' && !includeUnchanged) return;
        rows.push(row);
    };

    for (const table of diff.tables as TableDiff[]) {
        push({
            object: table.name,
            kind: 'table',
            status: table.status,
            delta:
                table.status === 'renamed'
                    ? `name: ${table.renamed_from ?? '∅'} → ${table.name}`
                    : table.codes.length > 0
                      ? table.codes.join(' ')
                      : '',
            relevance: tableRelevance(table.status),
        });

        if (table.primary_key.status === 'modified') {
            push({
                object: `${table.name}.PRIMARY`,
                kind: 'primary key',
                status: 'modified',
                delta: `columns: ${table.primary_key.from.join(', ') || '∅'} → ${table.primary_key.to.join(', ') || '∅'}`,
                relevance: 'Primary key changed — confirm uniqueness holds and every foreign key referencing it follows.',
            });
        }

        for (const column of table.columns) {
            push({
                object: `${table.name}.${column.name}`,
                kind: 'column',
                status: column.status,
                delta:
                    column.status === 'added'
                        ? `${column.column.type}${column.column.nullable ? ' NULL' : ' NOT NULL'}${
                              column.column.default !== null ? ` DEFAULT ${column.column.default}` : ''
                          }`
                        : column.status === 'removed'
                          ? `was ${column.column.type}`
                          : deltaText(column.deltas),
                relevance: columnRelevance(column.status, column.codes, column.column, table.status === 'added'),
            });
        }

        for (const index of table.indexes) {
            push({
                object: `${table.name}.${index.name}`,
                kind: 'index',
                status: index.status,
                delta:
                    index.status === 'added' || index.status === 'removed'
                        ? `${index.index.unique ? 'unique ' : ''}(${index.index.columns.join(', ')})`
                        : deltaText(index.deltas),
                relevance: indexRelevance(index.status, index.codes),
            });
        }

        for (const fk of table.foreign_keys) {
            push({
                object: `${table.name}.${fk.name}`,
                kind: 'foreign key',
                status: fk.status,
                delta:
                    fk.status === 'added' || fk.status === 'removed'
                        ? `(${fk.foreign_key.columns.join(', ')}) → ${fk.foreign_key.ref_table}(${fk.foreign_key.ref_columns.join(', ')})`
                        : deltaText(fk.deltas),
                relevance: foreignKeyRelevance(fk.status, fk.codes),
            });
        }
    }

    return rows;
}

export interface ChangeTableOptions {
    includeUnchanged?: boolean;
    /** Tables a scoped diagram omitted, so the table can state the gap. */
    omittedFromDiagram?: string[];
}

export function renderChangeTable(diff: SchemaDiff, opts: ChangeTableOptions = {}): string {
    const rows = changeRows(diff, opts.includeUnchanged === true);
    const out: string[] = [];

    out.push('| Object | Kind | Status | Delta | Review relevance |');
    out.push('|--------|------|--------|-------|------------------|');
    if (rows.length === 0) {
        out.push('| — | — | unchanged | — | No structural difference between the two states. |');
    }
    for (const r of rows) {
        const marker = STATUS_MARKER[r.status];
        const status = marker.length > 0 ? `${marker} ${r.status}` : r.status;
        out.push(
            `| \`${escapeCell(r.object)}\` | ${r.kind} | ${status} | ${escapeCell(r.delta) || '—'} | ${
                escapeCell(r.relevance) || '—'
            } |`,
        );
    }

    out.push('');
    out.push(
        `Totals: ${diff.counts.added} added · ${diff.counts.removed} removed · ${diff.counts.modified} modified · ` +
            `${diff.counts.renamed} renamed · ${diff.counts.unchanged} unchanged.`,
    );
    out.push(
        `States: ${diff.from.kind} (${diff.from.normalization_class}, ${diff.from.ref}) → ` +
            `${diff.to.kind} (${diff.to.normalization_class}, ${diff.to.ref}).`,
    );

    // The scope line is computed from the skip counters, never asserted.
    for (const [side, counters] of [
        ['current', diff.skipped.from],
        ['target', diff.skipped.to],
    ] as const) {
        const dropped = Object.entries(counters)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`);
        if (dropped.length > 0) out.push(`Not represented in the ${side} state: ${dropped.join(', ')}.`);
    }

    if (diff.cross_source) {
        out.push(
            'WARNING: the two states came from different normalisation classes. Every "modified" row may be a ' +
                'normalisation artefact rather than a real change.',
        );
    }

    if (opts.omittedFromDiagram !== undefined && opts.omittedFromDiagram.length > 0) {
        out.push(
            `Diagram scoped to changed tables plus one foreign-key hop; ${opts.omittedFromDiagram.length} unchanged ` +
                `table(s) omitted from the picture and absent from the rows above: ${opts.omittedFromDiagram.join(', ')}.`,
        );
    }

    return `${out.join('\n')}\n`;
}
