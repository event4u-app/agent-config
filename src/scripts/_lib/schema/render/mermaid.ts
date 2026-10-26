/**
 * Mermaid renderer — the map half of the output.
 *
 * The design inversion this file implements: **markers are the primary channel
 * and colour is secondary.** Neither Mermaid nor D2 can style an individual
 * column row, so a column-level diff cannot be carried by colour at all. And
 * `classDef` for `erDiagram` arrived only with the v11 unified renderer — an
 * older pin does not degrade to a colourless diagram, it fails to parse the
 * whole thing. So `[+]`, `[-]`, `[~]` and `[>]` carry the meaning exactly as
 * `+` and `-` do in a textual git diff, `classDef` decorates tables on top, and
 * `--compat legacy` drops every styling statement for an older renderer.
 *
 * The second inversion: **the diagram is a map, not the evidence.** A full field
 * delta in an attribute comment makes the table unreadably wide, so the diagram
 * carries a short code and the change table carries the delta.
 */
import type { ChangeStatus, SchemaDiff, TableDiff } from '../diff.js';
import { STATUS_MARKER } from '../diff.js';
import type { SchemaIr } from '../ir.js';

export type View = 'current' | 'target' | 'diff';
export type Scope = 'all' | 'changed+1hop';

export interface MermaidOptions {
    view: View;
    /** `legacy` emits no classDef, class or style statement at all. */
    compat?: 'default' | 'legacy';
    scope?: Scope;
    /** Above this table count, `changed+1hop` becomes the default in diff view. */
    scopeThreshold?: number;
}

export const DEFAULT_SCOPE_THRESHOLD = 40;

/** Mermaid identifiers are conservative; a table name may not be. */
function ident(name: string): string {
    const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
    return /^[A-Za-z_]/.test(cleaned) ? cleaned : `t_${cleaned}`;
}

/**
 * An attribute type must be a single token. A composite type (`enum('a','b')`,
 * `decimal(10, 2)`) is reduced to its base name here and its full text lives in
 * the change table — the alternative is an escaped blob that widens the row and
 * carries no more meaning at map altitude.
 */
function attrType(type: string): string {
    const base = /[,'"]/.test(type) ? (/^([A-Za-z_][A-Za-z0-9_]*)/.exec(type)?.[1] ?? 'unknown') : type;
    const token = base.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_()[\]-]/g, '_');
    return token.length === 0 ? 'unknown' : token;
}

/** A comment is quoted, so a marker inside it is safe; a quote is not. */
function comment(text: string): string {
    return text.replace(/"/g, "'");
}

function keyToken(table: { primary_key: string[] }, columnName: string, isForeignKey: boolean, unique: boolean): string {
    const tokens: string[] = [];
    if (table.primary_key.includes(columnName)) tokens.push('PK');
    if (isForeignKey) tokens.push('FK');
    if (unique && !table.primary_key.includes(columnName)) tokens.push('UK');
    return tokens.join(', ');
}

const CLASS_DEFS = [
    'classDef added fill:#dcfce7,stroke:#16a34a,color:#14532d',
    'classDef removed fill:#fee2e2,stroke:#dc2626,color:#7f1d1d',
    'classDef modified fill:#fef9c3,stroke:#ca8a04,color:#713f12',
    'classDef renamed fill:#e0e7ff,stroke:#4f46e5,color:#312e81',
];

const STYLED: ReadonlySet<ChangeStatus> = new Set<ChangeStatus>(['added', 'removed', 'modified', 'renamed']);

/** Changed tables plus their direct foreign-key neighbours, in both directions. */
function scopedTables(diff: SchemaDiff): Set<string> {
    const changed = new Set(diff.tables.filter((t) => t.status !== 'unchanged').map((t) => t.name));
    const keep = new Set(changed);
    for (const t of diff.tables) {
        for (const fk of t.foreign_keys) {
            if (changed.has(t.name)) keep.add(fk.foreign_key.ref_table);
            if (changed.has(fk.foreign_key.ref_table)) keep.add(t.name);
        }
    }
    return keep;
}

function resolveScope(diff: SchemaDiff, opts: MermaidOptions): Scope {
    if (opts.scope !== undefined) return opts.scope;
    const threshold = opts.scopeThreshold ?? DEFAULT_SCOPE_THRESHOLD;
    return opts.view === 'diff' && diff.tables.length > threshold ? 'changed+1hop' : 'all';
}

function renderDiffTables(diff: SchemaDiff, opts: MermaidOptions): { lines: string[]; classes: string[] } {
    const lines: string[] = [];
    const classes: string[] = [];
    const scope = resolveScope(diff, opts);
    const visible = scope === 'changed+1hop' ? scopedTables(diff) : null;
    const rendered = new Set<string>();

    for (const table of diff.tables) {
        if (visible !== null && !visible.has(table.name)) continue;
        // A removed element appears only in the diff view: the current and target
        // views each describe one state, and a state has no removals in it.
        if (opts.view === 'target' && table.status === 'removed') continue;
        if (opts.view === 'current' && table.status === 'added') continue;

        rendered.add(table.name);
        const marker = STATUS_MARKER[table.status];
        const label = marker.length > 0 && opts.view === 'diff' ? ` "${marker} ${comment(table.name)}"` : '';
        lines.push(`    ${ident(table.name)}${label} {`);

        const fkColumns = new Set(table.foreign_keys.flatMap((f) => f.foreign_key.columns));
        const uniqueColumns = new Set(
            table.indexes.filter((x) => x.index.unique).flatMap((x) => x.index.columns.length === 1 ? x.index.columns : []),
        );

        for (const column of table.columns) {
            if (opts.view === 'target' && column.status === 'removed') continue;
            if (opts.view === 'current' && column.status === 'added') continue;

            const key = keyToken(
                { primary_key: table.primary_key.to.length > 0 ? table.primary_key.to : table.primary_key.from },
                column.name,
                fkColumns.has(column.name),
                uniqueColumns.has(column.name),
            );
            const notes: string[] = [];
            if (opts.view === 'diff') {
                const columnMarker = STATUS_MARKER[column.status];
                if (columnMarker.length > 0) {
                    notes.push(column.codes.length > 0 ? `${columnMarker} ${column.codes.join(' ')}` : columnMarker);
                }
            }
            const tail = notes.length > 0 ? ` "${comment(notes.join(' '))}"` : '';
            const keyPart = key.length > 0 ? ` ${key}` : '';
            lines.push(`        ${attrType(column.column.type)} ${ident(column.name)}${keyPart}${tail}`);
        }

        lines.push('    }');

        if (opts.compat !== 'legacy' && opts.view === 'diff' && STYLED.has(table.status)) {
            classes.push(`    class ${ident(table.name)} ${table.status}`);
        }
    }

    // Foreign-key edges colour by their own status rather than by their tables':
    // an unchanged table can carry a changed relationship.
    for (const table of diff.tables) {
        if (!rendered.has(table.name)) continue;
        for (const fk of table.foreign_keys) {
            if (!rendered.has(fk.foreign_key.ref_table)) continue;
            if (opts.view === 'target' && fk.status === 'removed') continue;
            if (opts.view === 'current' && fk.status === 'added') continue;
            const marker = opts.view === 'diff' ? STATUS_MARKER[fk.status] : '';
            const codes = fk.codes.length > 0 ? ` ${fk.codes.join(' ')}` : '';
            const label = marker.length > 0 ? `${marker}${codes}` : fk.name;
            lines.push(
                `    ${ident(fk.foreign_key.ref_table)} ||--o{ ${ident(table.name)} : "${comment(label)}"`,
            );
        }
    }

    return { lines, classes };
}

/**
 * Render a diff. The `diff` view carries change status; `current` and `target`
 * project the diff back onto a single state.
 */
export function renderMermaidDiff(diff: SchemaDiff, opts: MermaidOptions): string {
    const out: string[] = ['erDiagram'];
    const { lines, classes } = renderDiffTables(diff, opts);

    if (opts.compat !== 'legacy' && opts.view === 'diff') {
        for (const def of CLASS_DEFS) out.push(`    ${def}`);
    }
    out.push(...lines, ...classes);
    return `${out.join('\n')}\n`;
}

/** Render a single state directly, with no change annotation anywhere. */
export function renderMermaidIr(ir: SchemaIr): string {
    const out: string[] = ['erDiagram'];
    const names = new Set(ir.tables.map((t) => t.name));

    for (const table of ir.tables) {
        out.push(`    ${ident(table.name)} {`);
        const fkColumns = new Set(table.foreign_keys.flatMap((f) => f.columns));
        const uniqueColumns = new Set(
            table.indexes.filter((x) => x.unique && x.columns.length === 1).flatMap((x) => x.columns),
        );
        for (const column of table.columns) {
            const key = keyToken(table, column.name, fkColumns.has(column.name), uniqueColumns.has(column.name));
            const keyPart = key.length > 0 ? ` ${key}` : '';
            out.push(`        ${attrType(column.type)} ${ident(column.name)}${keyPart}`);
        }
        out.push('    }');
    }

    for (const table of ir.tables) {
        for (const fk of table.foreign_keys) {
            if (!names.has(fk.ref_table)) continue;
            out.push(`    ${ident(fk.ref_table)} ||--o{ ${ident(table.name)} : "${comment(fk.name)}"`);
        }
    }

    return `${out.join('\n')}\n`;
}

/** The legend a reader needs when the diagram carries no colour at all. */
export function markerLegend(): string {
    return [
        'Markers: [+] added · [-] removed · [~] modified (with a short code) · [>] renamed.',
        'Codes: type · null · default · auto · comment · cols · unique · ref · on_delete · on_update · pk · idx · fk · rename.',
        'The diagram is the map; the change table carries the full delta.',
    ].join('\n');
}

/** Tables a `changed+1hop` render would drop, so the caller can say so. */
export function omittedTables(diff: SchemaDiff, opts: MermaidOptions): string[] {
    if (resolveScope(diff, opts) === 'all') return [];
    const visible = scopedTables(diff);
    return diff.tables.filter((t: TableDiff) => !visible.has(t.name)).map((t) => t.name);
}
