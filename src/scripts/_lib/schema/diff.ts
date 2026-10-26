/**
 * The differ — two IR documents in, one annotated structural difference out.
 *
 * Purely descriptive by design. It computes what changed and says so; it never
 * decides whether the change is safe, and it never carries an opinion in its
 * exit code. Destructiveness judgement lives in `schema-review`, and two policy
 * locations for one question diverge — so this side has none.
 *
 * Three rules are load-bearing, and each of them prevents a specific way for a
 * diff to lie:
 *
 *   - **One normalisation class per diff.** Live introspection and a parsed file
 *     describe the same column differently — type aliases, implicit indexes,
 *     default representation. Diffing across the boundary yellows elements that
 *     never changed, and a diff full of false yellow is worse than none. Mixed
 *     classes are a gate finding unless the caller explicitly overrides.
 *   - **A moved column is not a changed column.** Only the normalised
 *     fingerprint decides `modified`; `ordinal` is carried for the current-state
 *     view and ignored here. Position drift is review noise.
 *   - **A rename needs proof.** Without a rename map the pair stays
 *     `removed` + `added` and the differ attaches an advisory naming the
 *     suspicion. A similarity heuristic that guesses wrong silently rewires
 *     foreign-key edges, which is a worse failure than a noisy one.
 */
import type {
    Finding,
    IrColumn,
    IrForeignKey,
    IrIndex,
    IrSource,
    IrTable,
    SchemaIr,
    SkipCounters,
} from './ir.js';

export const DIFF_VERSION = 1;

export type ChangeStatus = 'added' | 'removed' | 'modified' | 'unchanged' | 'renamed';

/** Marker glyphs are the primary channel; colour is a secondary decoration. */
export const STATUS_MARKER: Record<ChangeStatus, string> = {
    added: '[+]',
    removed: '[-]',
    modified: '[~]',
    unchanged: '',
    renamed: '[>]',
};

export interface FieldDelta {
    field: string;
    from: string | null;
    to: string | null;
}

export interface ColumnDiff {
    name: string;
    status: ChangeStatus;
    renamed_from: string | null;
    /** Short codes for the diagram; the full delta lives in `deltas`. */
    codes: string[];
    deltas: FieldDelta[];
    /** Representative column — the target side when it exists, else the source. */
    column: IrColumn;
}

export interface IndexDiff {
    name: string;
    status: ChangeStatus;
    codes: string[];
    deltas: FieldDelta[];
    index: IrIndex;
}

export interface ForeignKeyDiff {
    name: string;
    status: ChangeStatus;
    codes: string[];
    deltas: FieldDelta[];
    foreign_key: IrForeignKey;
}

export interface PrimaryKeyDiff {
    status: ChangeStatus;
    from: string[];
    to: string[];
}

export interface TableDiff {
    name: string;
    status: ChangeStatus;
    renamed_from: string | null;
    codes: string[];
    deltas: FieldDelta[];
    primary_key: PrimaryKeyDiff;
    columns: ColumnDiff[];
    indexes: IndexDiff[];
    foreign_keys: ForeignKeyDiff[];
}

export interface SchemaDiff {
    diff_version: number;
    from: IrSource;
    to: IrSource;
    /** True only when the caller overrode the normalisation-class invariant. */
    cross_source: boolean;
    skipped: { from: SkipCounters; to: SkipCounters };
    tables: TableDiff[];
    counts: Record<ChangeStatus, number>;
}

/** Proven renames. Column renames are keyed by the table's *source* name. */
export interface RenameMap {
    tables?: Record<string, string>;
    columns?: Record<string, Record<string, string>>;
}

export interface DiffOptions {
    renameMap?: RenameMap;
    /** Override the one-class invariant. Every artefact then carries a banner. */
    allowCrossSource?: boolean;
}

export interface DiffResult {
    diff: SchemaDiff | null;
    findings: Finding[];
}

const byName = (a: { name: string }, b: { name: string }): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

function compare(
    fields: { field: string; from: string | null; to: string | null; code: string }[],
): { codes: string[]; deltas: FieldDelta[] } {
    const codes: string[] = [];
    const deltas: FieldDelta[] = [];
    for (const f of fields) {
        if (f.from === f.to) continue;
        deltas.push({ field: f.field, from: f.from, to: f.to });
        if (!codes.includes(f.code)) codes.push(f.code);
    }
    return { codes, deltas };
}

const boolText = (v: boolean): string => (v ? 'true' : 'false');

function diffColumn(from: IrColumn, to: IrColumn): { codes: string[]; deltas: FieldDelta[] } {
    // `ordinal` is deliberately absent: a moved column is not a changed column.
    return compare([
        { field: 'type', from: from.type, to: to.type, code: 'type' },
        { field: 'nullable', from: boolText(from.nullable), to: boolText(to.nullable), code: 'null' },
        { field: 'default', from: from.default, to: to.default, code: 'default' },
        {
            field: 'auto_increment',
            from: boolText(from.auto_increment),
            to: boolText(to.auto_increment),
            code: 'auto',
        },
        { field: 'comment', from: from.comment, to: to.comment, code: 'comment' },
    ]);
}

function diffIndex(from: IrIndex, to: IrIndex): { codes: string[]; deltas: FieldDelta[] } {
    return compare([
        { field: 'columns', from: from.columns.join(', '), to: to.columns.join(', '), code: 'cols' },
        { field: 'unique', from: boolText(from.unique), to: boolText(to.unique), code: 'unique' },
        { field: 'type', from: from.type, to: to.type, code: 'type' },
    ]);
}

function diffForeignKey(from: IrForeignKey, to: IrForeignKey): { codes: string[]; deltas: FieldDelta[] } {
    return compare([
        { field: 'columns', from: from.columns.join(', '), to: to.columns.join(', '), code: 'cols' },
        { field: 'ref_table', from: from.ref_table, to: to.ref_table, code: 'ref' },
        { field: 'ref_columns', from: from.ref_columns.join(', '), to: to.ref_columns.join(', '), code: 'ref' },
        { field: 'on_update', from: from.on_update, to: to.on_update, code: 'on_update' },
        { field: 'on_delete', from: from.on_delete, to: to.on_delete, code: 'on_delete' },
    ]);
}

/** Levenshtein-free suspicion: a removed and an added element of equal shape. */
function columnShape(c: IrColumn): string {
    return `${c.type}|${c.nullable ? 'null' : 'notnull'}|${c.default ?? ''}`;
}

function diffTableBody(
    source: IrTable | null,
    target: IrTable | null,
    columnRenames: Record<string, string>,
    advice: Finding[],
    tableLabel: string,
): Pick<TableDiff, 'columns' | 'indexes' | 'foreign_keys' | 'primary_key'> {
    const columns: ColumnDiff[] = [];
    const sourceColumns = new Map((source?.columns ?? []).map((c) => [c.name, c]));
    const targetColumns = new Map((target?.columns ?? []).map((c) => [c.name, c]));
    const consumedTargets = new Set<string>();

    for (const [name, sourceColumn] of sourceColumns) {
        const renamedTo = columnRenames[name];
        if (renamedTo !== undefined && targetColumns.has(renamedTo)) {
            const targetColumn = targetColumns.get(renamedTo) as IrColumn;
            consumedTargets.add(renamedTo);
            const { codes, deltas } = diffColumn(sourceColumn, targetColumn);
            columns.push({
                name: renamedTo,
                status: 'renamed',
                renamed_from: name,
                codes: ['rename', ...codes],
                deltas: [{ field: 'name', from: name, to: renamedTo }, ...deltas],
                column: targetColumn,
            });
            continue;
        }
        const targetColumn = targetColumns.get(name);
        if (targetColumn === undefined) {
            columns.push({
                name,
                status: 'removed',
                renamed_from: null,
                codes: [],
                deltas: [],
                column: sourceColumn,
            });
            continue;
        }
        consumedTargets.add(name);
        const { codes, deltas } = diffColumn(sourceColumn, targetColumn);
        columns.push({
            name,
            status: deltas.length === 0 ? 'unchanged' : 'modified',
            renamed_from: null,
            codes,
            deltas,
            column: targetColumn,
        });
    }

    for (const [name, targetColumn] of targetColumns) {
        if (consumedTargets.has(name)) continue;
        columns.push({ name, status: 'added', renamed_from: null, codes: [], deltas: [], column: targetColumn });
    }

    // A removed column and an added column of identical shape is exactly what a
    // rename looks like without proof. Say so once, and change nothing.
    const removedColumns = columns.filter((c) => c.status === 'removed');
    const addedColumns = columns.filter((c) => c.status === 'added');
    for (const r of removedColumns) {
        for (const a of addedColumns) {
            if (columnShape(r.column) === columnShape(a.column)) {
                advice.push({
                    tier: 'advice',
                    code: 'rename-suspected',
                    message:
                        `${tableLabel}: "${r.name}" disappeared and "${a.name}" appeared with an identical shape ` +
                        '(same type, nullability and default). If that is a rename, supply it via --rename-map; ' +
                        'without proof it stays removed + added, because a wrong rename silently rewires foreign keys.',
                    at: `${tableLabel}.${r.name}`,
                });
            }
        }
    }

    const indexes: IndexDiff[] = [];
    const sourceIndexes = new Map((source?.indexes ?? []).map((x) => [x.name, x]));
    const targetIndexes = new Map((target?.indexes ?? []).map((x) => [x.name, x]));
    for (const [name, sourceIndex] of sourceIndexes) {
        const targetIndex = targetIndexes.get(name);
        if (targetIndex === undefined) {
            indexes.push({ name, status: 'removed', codes: [], deltas: [], index: sourceIndex });
            continue;
        }
        const { codes, deltas } = diffIndex(sourceIndex, targetIndex);
        indexes.push({
            name,
            status: deltas.length === 0 ? 'unchanged' : 'modified',
            codes,
            deltas,
            index: targetIndex,
        });
    }
    for (const [name, targetIndex] of targetIndexes) {
        if (sourceIndexes.has(name)) continue;
        indexes.push({ name, status: 'added', codes: [], deltas: [], index: targetIndex });
    }

    const foreignKeys: ForeignKeyDiff[] = [];
    const sourceFks = new Map((source?.foreign_keys ?? []).map((fk) => [fk.name, fk]));
    const targetFks = new Map((target?.foreign_keys ?? []).map((fk) => [fk.name, fk]));
    for (const [name, sourceFk] of sourceFks) {
        const targetFk = targetFks.get(name);
        if (targetFk === undefined) {
            foreignKeys.push({ name, status: 'removed', codes: [], deltas: [], foreign_key: sourceFk });
            continue;
        }
        const { codes, deltas } = diffForeignKey(sourceFk, targetFk);
        foreignKeys.push({
            name,
            status: deltas.length === 0 ? 'unchanged' : 'modified',
            codes,
            deltas,
            foreign_key: targetFk,
        });
    }
    for (const [name, targetFk] of targetFks) {
        if (sourceFks.has(name)) continue;
        foreignKeys.push({ name, status: 'added', codes: [], deltas: [], foreign_key: targetFk });
    }

    const fromPk = source?.primary_key ?? [];
    const toPk = target?.primary_key ?? [];
    const pkStatus: ChangeStatus =
        source === null
            ? 'added'
            : target === null
              ? 'removed'
              : fromPk.join(',') === toPk.join(',')
                ? 'unchanged'
                : 'modified';

    return {
        columns: columns.sort(byName),
        indexes: indexes.sort(byName),
        foreign_keys: foreignKeys.sort(byName),
        primary_key: { status: pkStatus, from: fromPk, to: toPk },
    };
}

function tableCodes(body: Pick<TableDiff, 'columns' | 'indexes' | 'foreign_keys' | 'primary_key'>): string[] {
    const codes: string[] = [];
    const push = (c: string): void => {
        if (!codes.includes(c)) codes.push(c);
    };
    if (body.columns.some((c) => c.status !== 'unchanged')) push('cols');
    if (body.indexes.some((x) => x.status !== 'unchanged')) push('idx');
    if (body.foreign_keys.some((f) => f.status !== 'unchanged')) push('fk');
    if (body.primary_key.status === 'modified') push('pk');
    return codes;
}

/**
 * Diff two IR documents.
 *
 * Returns `diff: null` when a gate finding fired — a caller must never render a
 * diagram from a refused diff, and returning a partial one invites exactly that.
 */
export function diffIr(from: SchemaIr, to: SchemaIr, opts: DiffOptions = {}): DiffResult {
    const findings: Finding[] = [];

    const crossSource = from.source.normalization_class !== to.source.normalization_class;
    if (crossSource && opts.allowCrossSource !== true) {
        findings.push({
            tier: 'gate',
            code: 'normalization-class-mix',
            message:
                `Refusing to diff a "${from.source.normalization_class}" state (${from.source.kind}) against a ` +
                `"${to.source.normalization_class}" state (${to.source.kind}). The two describe the same column ` +
                'differently — type aliases, implicit indexes, default representation — so the diff would report ' +
                'changes that never happened. Materialise both states through the same adapter, or pass ' +
                '--allow-cross-source to accept a diff whose "modified" rows may be normalisation artefacts.',
            at: 'source.normalization_class',
        });
        return { diff: null, findings };
    }
    if (crossSource) {
        findings.push({
            tier: 'advice',
            code: 'cross-source-accepted',
            message:
                `Diffing across normalisation classes on request (${from.source.normalization_class} → ` +
                `${to.source.normalization_class}). Every "modified" row may be a normalisation artefact rather ` +
                'than a real change; treat the diff as a hint, not as evidence.',
            at: 'source.normalization_class',
        });
    }

    if (from.dialect !== to.dialect) {
        findings.push({
            tier: 'advice',
            code: 'dialect-mismatch',
            message: `Dialects differ (${from.dialect} → ${to.dialect}); type deltas may reflect dialect naming rather than a real change.`,
            at: 'dialect',
        });
    }

    const tableRenames = opts.renameMap?.tables ?? {};
    const columnRenamesByTable = opts.renameMap?.columns ?? {};

    const sourceTables = new Map(from.tables.map((t) => [t.name, t]));
    const targetTables = new Map(to.tables.map((t) => [t.name, t]));
    const consumed = new Set<string>();
    const tables: TableDiff[] = [];

    for (const [name, sourceTable] of sourceTables) {
        const renamedTo = tableRenames[name];
        const columnRenames = columnRenamesByTable[name] ?? {};

        if (renamedTo !== undefined && targetTables.has(renamedTo)) {
            const targetTable = targetTables.get(renamedTo) as IrTable;
            consumed.add(renamedTo);
            const body = diffTableBody(sourceTable, targetTable, columnRenames, findings, renamedTo);
            tables.push({
                name: renamedTo,
                status: 'renamed',
                renamed_from: name,
                codes: ['rename', ...tableCodes(body)],
                deltas: [{ field: 'name', from: name, to: renamedTo }],
                ...body,
            });
            continue;
        }

        const targetTable = targetTables.get(name);
        if (targetTable === undefined) {
            const body = diffTableBody(sourceTable, null, {}, [], name);
            tables.push({
                name,
                status: 'removed',
                renamed_from: null,
                codes: [],
                deltas: [],
                ...body,
                columns: body.columns.map((c) => ({ ...c, status: 'removed' as ChangeStatus })),
            });
            continue;
        }

        consumed.add(name);
        const body = diffTableBody(sourceTable, targetTable, columnRenames, findings, name);
        const codes = tableCodes(body);
        tables.push({
            name,
            status: codes.length === 0 ? 'unchanged' : 'modified',
            renamed_from: null,
            codes,
            deltas: [],
            ...body,
        });
    }

    for (const [name, targetTable] of targetTables) {
        if (consumed.has(name)) continue;
        const body = diffTableBody(null, targetTable, {}, [], name);
        tables.push({
            name,
            status: 'added',
            renamed_from: null,
            codes: [],
            deltas: [],
            ...body,
            columns: body.columns.map((c) => ({ ...c, status: 'added' as ChangeStatus })),
        });
    }

    // A rename map naming a pair that does not exist is a stale map, and a stale
    // map silently produces removed + added — worth saying rather than ignoring.
    for (const [oldName, newName] of Object.entries(tableRenames)) {
        if (!sourceTables.has(oldName) || !targetTables.has(newName)) {
            findings.push({
                tier: 'advice',
                code: 'rename-map-stale',
                message: `Rename map claims "${oldName}" → "${newName}", but that pair is not present in both states. The entry had no effect.`,
                at: `rename_map.tables.${oldName}`,
            });
        }
    }

    tables.sort(byName);

    const counts: Record<ChangeStatus, number> = {
        added: 0,
        removed: 0,
        modified: 0,
        unchanged: 0,
        renamed: 0,
    };
    for (const t of tables) {
        counts[t.status] += 1;
        for (const c of t.columns) counts[c.status] += 1;
        for (const x of t.indexes) counts[x.status] += 1;
        for (const f of t.foreign_keys) counts[f.status] += 1;
    }

    return {
        diff: {
            diff_version: DIFF_VERSION,
            from: from.source,
            to: to.source,
            cross_source: crossSource,
            skipped: { from: from.skipped, to: to.skipped },
            tables,
            counts,
        },
        findings,
    };
}

/** Canonical JSON serialisation. Two runs over equal input produce equal bytes. */
export function serializeDiff(diff: SchemaDiff): string {
    return `${JSON.stringify(diff, null, 2)}\n`;
}
