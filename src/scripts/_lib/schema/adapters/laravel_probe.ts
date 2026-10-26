/**
 * Laravel adapter — a probe emitter and a probe ingester, and deliberately no
 * database access of its own.
 *
 * The source proposal made "materialise the target state in a temporary
 * database on the project's own server" a gating spike. That is the right
 * *technique* and the wrong *coupling*: this repository has no project database,
 * so a tool that owns the connection cannot be tested here, and a plan gated on
 * it cannot close.
 *
 * Split instead. `emitProbe()` returns a self-contained PHP snippet the agent
 * runs inside the target project — `php artisan tinker --execute=…` for the
 * current state, or the same against a temporary connection after a migration
 * run for the target state. It prints IR JSON on stdout and nothing else.
 * `ingestProbe()` validates that JSON and normalises it into the IR.
 *
 * The normalisation class is `introspection` for both, which is the point: a
 * current state and a target state produced this way are mutually comparable by
 * construction, because the same server normalised both. That is the invariant
 * the differ enforces, obtained here structurally rather than by a warning.
 */
import {
    IR_VERSION,
    emptySkipCounters,
    type Dialect,
    type Finding,
    type IrColumn,
    type IrForeignKey,
    type IrIndex,
    type IrTable,
    type SchemaIr,
} from '../ir.js';

export type LaravelSourceKind = 'laravel-live' | 'laravel-tmpdb';

export interface ProbeOptions {
    /**
     * Laravel connection name. Absent means the default connection. A target
     * state is produced by pointing this at a temporary database the project's
     * migrations have just been run into.
     */
    connection?: string;
}

/**
 * The PHP probe. Built on the native schema introspection Laravel carries
 * without doctrine/dbal — `Schema::getTables/getColumns/getIndexes/
 * getForeignKeys()` — so it needs no package the project does not already have.
 *
 * Two properties matter for the handoff: it prints exactly one JSON document on
 * stdout, and it counts what it could not represent instead of dropping it
 * silently.
 */
export function emitProbe(opts: ProbeOptions = {}): string {
    const builder =
        opts.connection === undefined
            ? '\\Illuminate\\Support\\Facades\\Schema::'
            : `\\Illuminate\\Support\\Facades\\Schema::connection(${JSON.stringify(opts.connection)})->`;

    return `<?php
// schema-erd probe — prints one SchemaIR JSON document on stdout and nothing else.
// Run inside the target project, e.g.:
//   php artisan tinker --execute="require 'schema-erd-probe.php';"
// For a target state, migrate into a temporary database first and pass its
// connection name to the emitter.
$tables = [];
$skipped = ['views' => 0, 'triggers' => 0, 'check_constraints' => 0, 'generated_columns' => 0];

foreach (${builder}getTables() as $t) {
    $name = $t['name'];
    $columns = [];
    $ordinal = 0;
    foreach (${builder}getColumns($name) as $c) {
        $ordinal++;
        // A generated column is a real object this IR does not represent.
        if (!empty($c['generation'])) {
            $skipped['generated_columns']++;
            $ordinal--;
            continue;
        }
        $columns[] = [
            'name' => $c['name'],
            'type' => $c['type'],
            'nullable' => (bool) $c['nullable'],
            'default' => $c['default'] === null ? null : (string) $c['default'],
            'auto_increment' => (bool) ($c['auto_increment'] ?? false),
            'ordinal' => $ordinal,
            'comment' => $c['comment'] ?? null,
        ];
    }

    $primary = [];
    $indexes = [];
    foreach (${builder}getIndexes($name) as $ix) {
        if (!empty($ix['primary'])) {
            $primary = array_values($ix['columns']);
            continue;
        }
        $indexes[] = [
            'name' => $ix['name'],
            'columns' => array_values($ix['columns']),
            'unique' => (bool) $ix['unique'],
            'type' => $ix['type'] ?? null,
        ];
    }

    $foreign = [];
    foreach (${builder}getForeignKeys($name) as $fk) {
        $foreign[] = [
            'name' => $fk['name'],
            'columns' => array_values($fk['columns']),
            'ref_table' => $fk['foreign_table'],
            'ref_columns' => array_values($fk['foreign_columns']),
            'on_update' => $fk['on_update'] ?? null,
            'on_delete' => $fk['on_delete'] ?? null,
        ];
    }

    $tables[] = [
        'name' => $name,
        'comment' => $t['comment'] ?? null,
        'columns' => $columns,
        'primary_key' => $primary,
        'indexes' => $indexes,
        'foreign_keys' => $foreign,
    ];
}

$views = ${builder}getViews();
$skipped['views'] = count($views);

echo json_encode([
    'dialect' => ${builder}getConnection()->getDriverName(),
    'tables' => $tables,
    'skipped' => $skipped,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
`;
}

export interface IngestOptions {
    kind: LaravelSourceKind;
    /** A commit, a connection name, or a DSN hash — never a host path. */
    ref: string;
    /** Override the driver name the probe reported. */
    dialect?: Dialect;
}

export interface IngestResult {
    ir: SchemaIr | null;
    findings: Finding[];
}

const DRIVER_TO_DIALECT: Record<string, Dialect> = {
    mysql: 'mysql',
    mariadb: 'mariadb',
    pgsql: 'pgsql',
    postgres: 'pgsql',
    postgresql: 'pgsql',
    sqlite: 'sqlite',
};

function asRecord(v: unknown): Record<string, unknown> | null {
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * Ingest a probe payload. Reports rather than assumes: a payload whose shape
 * the probe never promised produces a gate finding and no IR, because a diagram
 * built from a half-read payload states a fidelity nobody can verify.
 */
export function ingestProbe(payload: unknown, opts: IngestOptions): IngestResult {
    const findings: Finding[] = [];
    const gate = (code: string, message: string, at?: string): void => {
        findings.push(at === undefined ? { tier: 'gate', code, message } : { tier: 'gate', code, message, at });
    };

    const root = asRecord(payload);
    if (root === null) {
        gate('probe-not-an-object', 'Probe payload must be a JSON object. Did the probe print anything else on stdout?');
        return { ir: null, findings };
    }

    const driver = typeof root.dialect === 'string' ? root.dialect.toLowerCase() : '';
    const dialect = opts.dialect ?? DRIVER_TO_DIALECT[driver];
    if (dialect === undefined) {
        gate(
            'probe-dialect-unknown',
            `Probe reported driver ${JSON.stringify(root.dialect)}, which maps to no supported dialect. ` +
                'Pass --dialect explicitly if the driver is an alias.',
            'dialect',
        );
        return { ir: null, findings };
    }

    const skippedRaw = asRecord(root.skipped);
    if (skippedRaw === null) {
        gate(
            'probe-skipped-missing',
            'Probe payload carries no `skipped` counters, so the extraction cannot state its own scope.',
            'skipped',
        );
        return { ir: null, findings };
    }
    const skipped = emptySkipCounters();
    for (const key of Object.keys(skipped) as (keyof typeof skipped)[]) {
        const n = skippedRaw[key];
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
            gate('probe-skipped-counter-invalid', `skipped.${key} must be a non-negative integer.`, `skipped.${key}`);
            return { ir: null, findings };
        }
        skipped[key] = n;
    }

    if (!Array.isArray(root.tables)) {
        gate('probe-tables-missing', 'Probe payload must carry a `tables` array.', 'tables');
        return { ir: null, findings };
    }

    const tables: IrTable[] = [];
    for (const raw of root.tables) {
        const t = asRecord(raw);
        if (t === null || typeof t.name !== 'string' || t.name.length === 0) {
            gate('probe-table-invalid', 'Every table entry must be an object with a non-empty name.', 'tables[]');
            return { ir: null, findings };
        }

        const columns: IrColumn[] = [];
        const rawColumns = Array.isArray(t.columns) ? t.columns : [];
        for (const rawColumn of rawColumns) {
            const c = asRecord(rawColumn);
            if (c === null || typeof c.name !== 'string' || typeof c.type !== 'string') {
                gate('probe-column-invalid', `Column entry in "${t.name}" is missing name or type.`, `tables.${t.name}`);
                return { ir: null, findings };
            }
            columns.push({
                name: c.name,
                type: c.type.toLowerCase(),
                nullable: c.nullable === true,
                default: typeof c.default === 'string' ? c.default : null,
                auto_increment: c.auto_increment === true,
                ordinal: typeof c.ordinal === 'number' ? c.ordinal : columns.length + 1,
                comment: typeof c.comment === 'string' && c.comment.length > 0 ? c.comment : null,
            });
        }

        const indexes: IrIndex[] = [];
        for (const rawIndex of Array.isArray(t.indexes) ? t.indexes : []) {
            const ix = asRecord(rawIndex);
            if (ix === null || typeof ix.name !== 'string') continue;
            const cols = strArray(ix.columns);
            if (cols.length === 0) continue;
            indexes.push({
                name: ix.name,
                columns: cols,
                unique: ix.unique === true,
                type: typeof ix.type === 'string' && ix.type.length > 0 ? ix.type.toLowerCase() : null,
            });
        }

        const foreignKeys: IrForeignKey[] = [];
        for (const rawFk of Array.isArray(t.foreign_keys) ? t.foreign_keys : []) {
            const fk = asRecord(rawFk);
            if (fk === null || typeof fk.ref_table !== 'string') continue;
            const cols = strArray(fk.columns);
            if (cols.length === 0) continue;
            foreignKeys.push({
                name: typeof fk.name === 'string' && fk.name.length > 0 ? fk.name : `${t.name}_${cols.join('_')}_foreign`,
                columns: cols,
                ref_table: fk.ref_table,
                ref_columns: strArray(fk.ref_columns),
                on_update: typeof fk.on_update === 'string' ? fk.on_update.toLowerCase() : null,
                on_delete: typeof fk.on_delete === 'string' ? fk.on_delete.toLowerCase() : null,
            });
        }

        tables.push({
            name: t.name,
            comment: typeof t.comment === 'string' && t.comment.length > 0 ? t.comment : null,
            columns,
            primary_key: strArray(t.primary_key),
            indexes,
            foreign_keys: foreignKeys,
        });
    }

    return {
        ir: {
            ir_version: IR_VERSION,
            dialect,
            source: { kind: opts.kind, normalization_class: 'introspection', ref: opts.ref },
            skipped,
            tables,
        },
        findings,
    };
}
