/**
 * The drift rules the engine evaluates by default. Pure data: a new class of
 * drift is a new entry here (or in a rule file passed to the engine), never a
 * change to `drift.ts`. Every rule is advice until its precision on the planted
 * fixtures is recorded.
 *
 * Data rules read the schema facts the migrations replay into (T1), committed
 * dumps (T2), and — for DR-11 — the actual schema from a user-produced
 * snapshot (T3) or a framework oracle's output file (T4). Attributes named
 * `data:*` are written by the data lane reader onto existing facts; each names
 * what it derived and from where. Fixes are proposals the user runs: the
 * engine never connects to a database.
 */
import type { DriftRule } from './drift.js';
import { DELIVERY_RULES } from './lanes/delivery/drift_rules.js';
import { INTERFACE_DRIFT_RULES } from './lanes/interfaces/drift_rules.js';
import { RUNTIME_RULES } from './lanes/runtime/drift_rules.js';

const FK_COLUMNS = { edge: 'references', kind: 'column', to_kind: 'column' } as const;

/** Orphan pre-check first; on PostgreSQL the key is added `NOT VALID` and validated online. */
const ADD_FK = {
    pgsql:
        '-- 1. orphan pre-check (read-only; run it yourself, it must return 0):\n' +
        'SELECT count(*) FROM {target.attr.data:table} c LEFT JOIN {target.attr.data:ref_table} p ON p.{target.attr.data:ref_column} = c.{target.attr.data:column} WHERE c.{target.attr.data:column} IS NOT NULL AND p.{target.attr.data:ref_column} IS NULL;\n' +
        '-- 2. add the key without a long lock, then validate it online:\n' +
        'ALTER TABLE {target.attr.data:table} ADD CONSTRAINT {target.attr.data:table}_{target.attr.data:column}_foreign FOREIGN KEY ({target.attr.data:column}) REFERENCES {target.attr.data:ref_table} ({target.attr.data:ref_column}) NOT VALID;\n' +
        'ALTER TABLE {target.attr.data:table} VALIDATE CONSTRAINT {target.attr.data:table}_{target.attr.data:column}_foreign;',
    default:
        '-- 1. orphan pre-check (read-only; run it yourself, it must return 0):\n' +
        'SELECT count(*) FROM {target.attr.data:table} c LEFT JOIN {target.attr.data:ref_table} p ON p.{target.attr.data:ref_column} = c.{target.attr.data:column} WHERE c.{target.attr.data:column} IS NOT NULL AND p.{target.attr.data:ref_column} IS NULL;\n' +
        '-- 2. add the key in a migration (the table is rebuilt or locked while it is checked):\n' +
        'ALTER TABLE {target.attr.data:table} ADD CONSTRAINT {target.attr.data:table}_{target.attr.data:column}_foreign FOREIGN KEY ({target.attr.data:column}) REFERENCES {target.attr.data:ref_table} ({target.attr.data:ref_column});',
};

export const DRIFT_RULES: readonly DriftRule[] = [
    {
        id: 'DR-1',
        lane: 'data',
        title: 'code relation without a foreign key',
        tier: 'advice',
        select: { edge: 'uses', resolved_via: 'orm-relation', to_kind: 'column' },
        expect: { edge_from: '$target', relation: 'references' },
        // Polymorphic keys cannot carry one; a connection declared without keys, or a
        // relation across connections, never will.
        exempt: [{ kind: 'polymorphic' }, { 'target_ctx.fk_mode': 'none' }, { 'target.data:cross_connection': true }],
        subject: '$target',
        message: 'a relation joins on $target, and no foreign key constrains it',
        fix: ADD_FK,
    },
    {
        id: 'DR-2',
        lane: 'data',
        title: 'foreign key without a code relation',
        tier: 'advice',
        requires: { edge: 'persists' },
        select: FK_COLUMNS,
        expect: { edge_to: '$source', relation: 'uses' },
        subject: '$source',
        message: '$source references $target, and no model relation joins on it',
        fix: 'declare the relation on the model that persists {source.attr.data:table} (belongsTo keyed on {source.attr.data:column}), or record why the code never follows it',
    },
    {
        id: 'DR-3',
        lane: 'data',
        title: 'model without a table',
        tier: 'advice',
        select: { edge: 'relates' },
        expect: { edge_from: '$target', relation: 'persists' },
        subject: '$target',
        message: '$target is a related model, and no migrated table backs it',
    },
    {
        id: 'DR-4',
        lane: 'data',
        title: 'missing pivot table',
        tier: 'advice',
        select: { edge: 'relates', attrs: { kind: 'n:m' } },
        expect: { node: 'table:{attr.pivot}' },
        subject: 'table:{attr.pivot}',
        message: 'a many-to-many relation needs the pivot table {attr.pivot}, and no migration creates it',
        fix: 'create {attr.pivot} in a migration with both foreign keys and a composite primary key over them',
    },
    {
        id: 'DR-5',
        lane: 'data',
        title: 'foreign key type differs from the key type',
        tier: 'advice',
        select: FK_COLUMNS,
        expect: { equal: ['{source.attr.type}', '{target.attr.type}'], aliases: { int8: 'bigint', int4: 'integer', int: 'integer' } },
        subject: '$source',
        message: '$source is {source.attr.type} and references $target, which is {target.attr.type}',
        fix: 'change $source to {target.attr.type} in a migration (on MySQL the signedness must match too)',
    },
    {
        id: 'DR-6',
        lane: 'data',
        title: 'foreign key without a leading index',
        tier: 'advice',
        select: { ...FK_COLUMNS, where: { index: ['missing', 'engine-unknown'] } },
        // InnoDB indexes a key itself; the runtime lane may name the engine the project did not.
        exempt: [{ index: 'engine-unknown', 'ctx.effective_engine': ['mysql', 'mariadb'] }],
        subject: '$source',
        message: 'the foreign key on $source has no index leading with it ({attr.index}); deletes on $target and joins scan the table',
        fix: {
            pgsql: 'CREATE INDEX CONCURRENTLY {source.attr.data:table}_{source.attr.data:column}_index ON {source.attr.data:table} ({source.attr.data:column});',
            default: 'add an index on {source.attr.data:table} ({source.attr.data:column}) in a migration; on MySQL and MariaDB InnoDB creates one for the key, so state the engine first',
        },
    },
    {
        id: 'DR-7',
        lane: 'data',
        title: 'SET NULL on a NOT NULL column',
        tier: 'advice',
        select: { ...FK_COLUMNS, where: { on_delete: 'set null', 'source.nullable': false } },
        subject: '$source',
        message: '$source is NOT NULL, and its key says ON DELETE SET NULL: deleting the $target row fails',
        fix: 'make $source nullable, or change the action to cascade or restrict',
    },
    {
        id: 'DR-8',
        lane: 'data',
        title: 'CASCADE from a soft-deleting parent',
        tier: 'advice',
        select: { ...FK_COLUMNS, where: { on_delete: 'cascade', 'target_ctx.data:soft_deletes': { exists: true } } },
        subject: '$source',
        message: 'the parent of $source soft-deletes ({target_ctx.data:soft_deletes}), so the database cascade never fires on a soft delete and fires without the app on a hard one',
        fix: 'restrict the key and delete the children in the application, or soft-delete them with the parent',
    },
    {
        id: 'DR-9',
        lane: 'data',
        title: 'application delete hooks and a database cascade',
        tier: 'advice',
        select: { ...FK_COLUMNS, where: { on_delete: 'cascade', 'ctx.data:delete_hooks': { exists: true } } },
        subject: '$source',
        message: 'deleting a $target row cascades in the database to $source, and the delete hooks of its model ({ctx.data:delete_hooks}) never run',
        fix: 'delete the children through the model (so the hooks run) and restrict the key, or move the hook work into the database',
    },
    {
        id: 'DR-10',
        lane: 'data',
        title: 'foreign key before its target table',
        tier: 'advice',
        select: { ...FK_COLUMNS, where: { 'source.data:fk_before_target': { exists: true } } },
        subject: '$source',
        message: 'the key on $source is added before $target is created ({source.attr.data:fk_before_target}); a fresh migrate fails',
        fix: 'move the key into a migration that runs after the target table is created',
    },
    {
        id: 'DR-11',
        lane: 'data',
        title: 'intended column missing from the actual schema',
        tier: 'advice',
        match: 'missing',
        select: { kind: 'column', rung: ['T1', 'T2'], where: { 'ctx.data:actual_seen': { exists: true } } },
        key: '$ref',
        counter: 'ctx.data:actual_seen',
        against: { kind: 'column', rung: ['T3', 'T4'], key: '$ref' },
        message: '{name} is in the migrations, and the actual schema read from {other.attr.source} has no such column',
    },
    {
        id: 'DR-11',
        lane: 'data',
        title: 'actual column no migration creates',
        tier: 'advice',
        match: 'missing',
        select: { kind: 'column', rung: ['T3', 'T4'], where: { 'ctx.intended_seen': true } },
        key: '$ref',
        counter: 'ctx.intended',
        against: { kind: 'column', rung: ['T1', 'T2'], key: '$ref' },
        message: '{name} is in the actual schema read from {attr.source}, and no migration creates it',
    },
    {
        id: 'DR-11',
        lane: 'data',
        title: 'actual table no migration creates',
        tier: 'advice',
        match: 'fact',
        select: { kind: 'table', rung: ['T3', 'T4'], where: { intended_seen: false } },
        message: 'table {name} is in the actual schema read from {attr.source}, and no migration creates it',
    },
    {
        id: 'DR-11',
        lane: 'data',
        title: 'intended and actual column differ',
        tier: 'advice',
        match: 'join',
        select: { kind: 'column', rung: ['T1', 'T2'] },
        key: '$ref',
        against: { kind: 'column', rung: ['T3', 'T4'], key: '$ref' },
        compare: ['data:type_family', 'nullable'],
        message: '{name} is {attr.type} (nullable {attr.nullable}) in the migrations and {other.attr.type} (nullable {other.attr.nullable}) in the actual schema',
    },
    {
        id: 'DR-12',
        lane: 'data',
        title: 'redundant index',
        tier: 'advice',
        select: { kind: 'table', where: { 'data:redundant_indexes': { minItems: 1 } } },
        message: '{name}: {attr.data:redundant_indexes}',
        fix: 'drop the shorter index in a migration once no query hint names it',
    },
    {
        id: 'DR-13',
        lane: 'data',
        title: 'implied relation (suggestion)',
        tier: 'advice',
        select: { kind: 'column', where: { 'data:implied_target': { exists: true } } },
        message: 'suggestion: {name} looks like a key into {attr.data:implied_target}, and neither a foreign key nor a code relation says so',
    },
];

/** Every lane's table, in family order. */
export const ALL_DRIFT_RULES: readonly DriftRule[] = [...DRIFT_RULES, ...INTERFACE_DRIFT_RULES, ...RUNTIME_RULES, ...DELIVERY_RULES];
