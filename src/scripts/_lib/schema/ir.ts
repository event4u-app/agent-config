/**
 * SchemaIR v1 — the dialect-neutral intermediate representation every
 * schema-erd adapter emits and both the differ and the renderers consume.
 *
 * Three properties are load-bearing and each exists because of a named failure:
 *
 *   - `source.normalization_class` separates what was read back from a live
 *     server (`introspection`) from what was parsed out of a file (`static`).
 *     The differ refuses to mix them, because comparing the two worlds yellows
 *     elements that never changed — type aliases, implicit indexes and default
 *     representation differ systematically between them, and false yellow
 *     destroys the evaluation value the capability exists to provide.
 *   - `skipped` counts what an adapter dropped. A missing counter is a `gate`
 *     finding rather than a zero default: silent partial extraction is
 *     indistinguishable from a real diff, so fidelity is declared from data
 *     rather than asserted in prose.
 *   - `columns[].ordinal` preserves the physical column order while the diff
 *     view sorts by name. Position drift is review noise, never a change.
 *
 * Canonicalisation is byte-stable by construction: sorted keys, sorted table
 * and index arrays, no timestamps, no host paths. A checked-in diagram that
 * re-renders differently is itself a source of pull-request noise.
 */

export const IR_VERSION = 1;

export type Dialect = 'mysql' | 'mariadb' | 'pgsql' | 'sqlite';

/** Read back from a live server, or parsed from a file. Never mixed in one diff. */
export type NormalizationClass = 'introspection' | 'static';

export type SourceKind =
    | 'laravel-live'
    | 'laravel-tmpdb'
    | 'schema-dump'
    | 'prisma'
    | 'sql'
    | 'tbls-json';

export const SOURCE_KINDS: readonly SourceKind[] = [
    'laravel-live',
    'laravel-tmpdb',
    'schema-dump',
    'prisma',
    'sql',
    'tbls-json',
];

export const DIALECTS: readonly Dialect[] = ['mysql', 'mariadb', 'pgsql', 'sqlite'];

/** Object classes an adapter may be unable to represent. Counted, never guessed. */
export const SKIP_KEYS = [
    'views',
    'triggers',
    'check_constraints',
    'generated_columns',
] as const;

export type SkipKey = (typeof SKIP_KEYS)[number];

export type SkipCounters = Record<SkipKey, number>;

export interface IrSource {
    kind: SourceKind;
    normalization_class: NormalizationClass;
    /** A commit, a DSN hash, or a file path relative to the project. Never absolute. */
    ref: string;
}

export interface IrColumn {
    name: string;
    type: string;
    nullable: boolean;
    default: string | null;
    auto_increment: boolean;
    /** Physical position, 1-based. Preserved by canonicalisation, ignored by the differ. */
    ordinal: number;
    comment: string | null;
}

export interface IrIndex {
    name: string;
    columns: string[];
    unique: boolean;
    type: string | null;
}

export interface IrForeignKey {
    name: string;
    columns: string[];
    ref_table: string;
    ref_columns: string[];
    on_update: string | null;
    on_delete: string | null;
}

export interface IrTable {
    name: string;
    comment: string | null;
    columns: IrColumn[];
    primary_key: string[];
    indexes: IrIndex[];
    foreign_keys: IrForeignKey[];
}

export interface SchemaIr {
    ir_version: number;
    dialect: Dialect;
    source: IrSource;
    skipped: SkipCounters;
    tables: IrTable[];
}

export type FindingTier = 'gate' | 'advice';

export interface Finding {
    tier: FindingTier;
    code: string;
    message: string;
    /** Dotted path into the document the finding is about, when there is one. */
    at?: string;
}

export function emptySkipCounters(): SkipCounters {
    return { views: 0, triggers: 0, check_constraints: 0, generated_columns: 0 };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/**
 * Structural validation of a parsed IR document.
 *
 * Every finding is `gate`: a malformed IR cannot be diffed or rendered, and a
 * renderer that silently tolerates a missing field produces a diagram whose
 * fidelity nobody can state. `advice` is reserved for the differ, where a
 * suspicion is genuinely actionable without being an error.
 */
export function validateIr(doc: unknown): Finding[] {
    const out: Finding[] = [];
    const gate = (code: string, message: string, at?: string): void => {
        out.push(at === undefined ? { tier: 'gate', code, message } : { tier: 'gate', code, message, at });
    };

    if (!isPlainObject(doc)) {
        gate('ir-not-an-object', 'IR document must be a JSON object.');
        return out;
    }

    if (doc.ir_version !== IR_VERSION) {
        gate(
            'ir-version-unsupported',
            `ir_version must be ${IR_VERSION}, got ${JSON.stringify(doc.ir_version)}.`,
            'ir_version',
        );
    }

    if (typeof doc.dialect !== 'string' || !DIALECTS.includes(doc.dialect as Dialect)) {
        gate(
            'ir-dialect-unknown',
            `dialect must be one of ${DIALECTS.join(', ')}, got ${JSON.stringify(doc.dialect)}.`,
            'dialect',
        );
    }

    const source = doc.source;
    if (!isPlainObject(source)) {
        gate('ir-source-missing', 'source must be an object carrying kind, normalization_class and ref.', 'source');
    } else {
        if (typeof source.kind !== 'string' || !SOURCE_KINDS.includes(source.kind as SourceKind)) {
            gate(
                'ir-source-kind-unknown',
                `source.kind must be one of ${SOURCE_KINDS.join(', ')}, got ${JSON.stringify(source.kind)}.`,
                'source.kind',
            );
        }
        if (source.normalization_class !== 'introspection' && source.normalization_class !== 'static') {
            gate(
                'ir-normalization-class-unknown',
                'source.normalization_class must be "introspection" or "static" — the differ refuses to mix them, ' +
                    'so an absent or unknown class cannot be defaulted.',
                'source.normalization_class',
            );
        }
        if (typeof source.ref !== 'string' || source.ref.length === 0) {
            gate('ir-source-ref-missing', 'source.ref must be a non-empty string.', 'source.ref');
        }
    }

    // A missing skip counter is a gate finding, not a zero: an adapter that does
    // not count what it dropped may not claim fidelity it does not have.
    const skipped = doc.skipped;
    if (!isPlainObject(skipped)) {
        gate(
            'ir-skipped-missing',
            `skipped must be an object counting ${SKIP_KEYS.join(', ')}. An adapter that does not count what it ` +
                'dropped cannot state its own scope.',
            'skipped',
        );
    } else {
        for (const key of SKIP_KEYS) {
            const n = skipped[key];
            if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
                gate(
                    'ir-skipped-counter-invalid',
                    `skipped.${key} must be a non-negative integer, got ${JSON.stringify(n)}.`,
                    `skipped.${key}`,
                );
            }
        }
    }

    if (!Array.isArray(doc.tables)) {
        gate('ir-tables-missing', 'tables must be an array.', 'tables');
        return out;
    }

    const seenTables = new Set<string>();
    doc.tables.forEach((t, i) => {
        const at = `tables[${i}]`;
        if (!isPlainObject(t)) {
            gate('ir-table-not-an-object', 'table entry must be an object.', at);
            return;
        }
        if (typeof t.name !== 'string' || t.name.length === 0) {
            gate('ir-table-name-missing', 'table.name must be a non-empty string.', `${at}.name`);
        } else if (seenTables.has(t.name)) {
            gate('ir-table-duplicate', `table "${t.name}" appears more than once.`, `${at}.name`);
        } else {
            seenTables.add(t.name);
        }

        if (!isStringArray(t.primary_key)) {
            gate('ir-primary-key-invalid', 'table.primary_key must be an array of column names.', `${at}.primary_key`);
        }

        if (!Array.isArray(t.columns)) {
            gate('ir-columns-missing', 'table.columns must be an array.', `${at}.columns`);
        } else {
            const seenColumns = new Set<string>();
            t.columns.forEach((c, j) => {
                const cAt = `${at}.columns[${j}]`;
                if (!isPlainObject(c)) {
                    gate('ir-column-not-an-object', 'column entry must be an object.', cAt);
                    return;
                }
                if (typeof c.name !== 'string' || c.name.length === 0) {
                    gate('ir-column-name-missing', 'column.name must be a non-empty string.', `${cAt}.name`);
                } else if (seenColumns.has(c.name)) {
                    gate('ir-column-duplicate', `column "${String(c.name)}" appears more than once.`, `${cAt}.name`);
                } else {
                    seenColumns.add(c.name);
                }
                if (typeof c.type !== 'string' || c.type.length === 0) {
                    gate('ir-column-type-missing', 'column.type must be a non-empty string.', `${cAt}.type`);
                }
                if (typeof c.nullable !== 'boolean') {
                    gate('ir-column-nullable-invalid', 'column.nullable must be a boolean.', `${cAt}.nullable`);
                }
                if (typeof c.ordinal !== 'number' || !Number.isInteger(c.ordinal) || c.ordinal < 1) {
                    gate('ir-column-ordinal-invalid', 'column.ordinal must be a 1-based integer.', `${cAt}.ordinal`);
                }
            });
        }

        if (!Array.isArray(t.indexes)) {
            gate('ir-indexes-missing', 'table.indexes must be an array.', `${at}.indexes`);
        } else {
            t.indexes.forEach((ix, j) => {
                const ixAt = `${at}.indexes[${j}]`;
                if (!isPlainObject(ix)) {
                    gate('ir-index-not-an-object', 'index entry must be an object.', ixAt);
                    return;
                }
                if (typeof ix.name !== 'string' || ix.name.length === 0) {
                    gate('ir-index-name-missing', 'index.name must be a non-empty string.', `${ixAt}.name`);
                }
                if (!isStringArray(ix.columns) || ix.columns.length === 0) {
                    gate('ir-index-columns-invalid', 'index.columns must be a non-empty array.', `${ixAt}.columns`);
                }
                if (typeof ix.unique !== 'boolean') {
                    gate('ir-index-unique-invalid', 'index.unique must be a boolean.', `${ixAt}.unique`);
                }
            });
        }

        if (!Array.isArray(t.foreign_keys)) {
            gate('ir-foreign-keys-missing', 'table.foreign_keys must be an array.', `${at}.foreign_keys`);
        } else {
            t.foreign_keys.forEach((fk, j) => {
                const fkAt = `${at}.foreign_keys[${j}]`;
                if (!isPlainObject(fk)) {
                    gate('ir-foreign-key-not-an-object', 'foreign key entry must be an object.', fkAt);
                    return;
                }
                if (typeof fk.name !== 'string' || fk.name.length === 0) {
                    gate('ir-foreign-key-name-missing', 'foreign_key.name must be a non-empty string.', `${fkAt}.name`);
                }
                if (!isStringArray(fk.columns) || fk.columns.length === 0) {
                    gate(
                        'ir-foreign-key-columns-invalid',
                        'foreign_key.columns must be a non-empty array.',
                        `${fkAt}.columns`,
                    );
                }
                if (typeof fk.ref_table !== 'string' || fk.ref_table.length === 0) {
                    gate(
                        'ir-foreign-key-ref-table-missing',
                        'foreign_key.ref_table must be a non-empty string.',
                        `${fkAt}.ref_table`,
                    );
                }
                if (!isStringArray(fk.ref_columns) || fk.ref_columns.length === 0) {
                    gate(
                        'ir-foreign-key-ref-columns-invalid',
                        'foreign_key.ref_columns must be a non-empty array.',
                        `${fkAt}.ref_columns`,
                    );
                }
            });
        }
    });

    return out;
}

const byName = (a: { name: string }, b: { name: string }): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * Byte-stable normalisation of an IR document.
 *
 * Tables, indexes and foreign keys sort by name; columns keep `ordinal` order
 * because that order is data. Index and foreign-key *column lists* keep their
 * declared order — a composite index on `(a, b)` is not the index on `(b, a)`,
 * so sorting them would erase a real difference.
 */
export function canonicalizeIr(ir: SchemaIr): SchemaIr {
    return {
        ir_version: ir.ir_version,
        dialect: ir.dialect,
        source: { kind: ir.source.kind, normalization_class: ir.source.normalization_class, ref: ir.source.ref },
        skipped: {
            views: ir.skipped.views,
            triggers: ir.skipped.triggers,
            check_constraints: ir.skipped.check_constraints,
            generated_columns: ir.skipped.generated_columns,
        },
        tables: [...ir.tables].sort(byName).map((t) => ({
            name: t.name,
            comment: t.comment ?? null,
            columns: [...t.columns]
                .sort((a, b) => a.ordinal - b.ordinal || byName(a, b))
                .map((c) => ({
                    name: c.name,
                    type: c.type,
                    nullable: c.nullable,
                    default: c.default ?? null,
                    auto_increment: c.auto_increment,
                    ordinal: c.ordinal,
                    comment: c.comment ?? null,
                })),
            primary_key: [...t.primary_key],
            indexes: [...t.indexes].sort(byName).map((ix) => ({
                name: ix.name,
                columns: [...ix.columns],
                unique: ix.unique,
                type: ix.type ?? null,
            })),
            foreign_keys: [...t.foreign_keys].sort(byName).map((fk) => ({
                name: fk.name,
                columns: [...fk.columns],
                ref_table: fk.ref_table,
                ref_columns: [...fk.ref_columns],
                on_update: fk.on_update ?? null,
                on_delete: fk.on_delete ?? null,
            })),
        })),
    };
}

/** Canonical JSON serialisation. Two runs over equal input produce equal bytes. */
export function serializeIr(ir: SchemaIr): string {
    return `${JSON.stringify(canonicalizeIr(ir), null, 2)}\n`;
}

/**
 * The scope-honesty line, computed from the `skipped` counters rather than
 * asserted in prose. An adapter that dropped nothing says so; one that dropped
 * something names what and how much.
 */
export function scopeHonestyLine(ir: SchemaIr): string {
    const dropped = SKIP_KEYS.filter((k) => ir.skipped[k] > 0).map((k) => `${ir.skipped[k]} ${k.replace(/_/g, ' ')}`);
    if (dropped.length === 0) {
        return `Scope: complete for ${ir.source.kind} (${ir.source.normalization_class}) — nothing skipped.`;
    }
    return `Scope: partial for ${ir.source.kind} (${ir.source.normalization_class}) — not represented: ${dropped.join(', ')}.`;
}
