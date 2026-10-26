/**
 * Tests for src/scripts/_lib/schema/ir.ts — SchemaIR v1, its validator and its
 * canonicalisation.
 *
 * Both directions per rule: a valid document passes clean, and each structural
 * requirement fails on its own when violated. The three requirements that exist
 * because of a named failure mode — the normalization class, the skip counters,
 * and byte-stable canonicalisation — each carry a dedicated case.
 */
import { describe, expect, it } from 'vitest';

import {
    IR_VERSION,
    SKIP_KEYS,
    canonicalizeIr,
    emptySkipCounters,
    scopeHonestyLine,
    serializeIr,
    validateIr,
    type SchemaIr,
} from '../../src/scripts/_lib/schema/ir.js';

function validIr(): SchemaIr {
    return {
        ir_version: IR_VERSION,
        dialect: 'mysql',
        source: { kind: 'sql', normalization_class: 'static', ref: 'fixtures/current.sql' },
        skipped: emptySkipCounters(),
        tables: [
            {
                name: 'users',
                comment: null,
                columns: [
                    {
                        name: 'id',
                        type: 'bigint unsigned',
                        nullable: false,
                        default: null,
                        auto_increment: true,
                        ordinal: 1,
                        comment: null,
                    },
                    {
                        name: 'email',
                        type: 'varchar(255)',
                        nullable: false,
                        default: null,
                        auto_increment: false,
                        ordinal: 2,
                        comment: null,
                    },
                ],
                primary_key: ['id'],
                indexes: [{ name: 'users_email_unique', columns: ['email'], unique: true, type: null }],
                foreign_keys: [],
            },
            {
                name: 'orders',
                comment: null,
                columns: [
                    {
                        name: 'id',
                        type: 'bigint unsigned',
                        nullable: false,
                        default: null,
                        auto_increment: true,
                        ordinal: 1,
                        comment: null,
                    },
                    {
                        name: 'user_id',
                        type: 'bigint unsigned',
                        nullable: false,
                        default: null,
                        auto_increment: false,
                        ordinal: 2,
                        comment: null,
                    },
                ],
                primary_key: ['id'],
                indexes: [{ name: 'orders_user_id_index', columns: ['user_id'], unique: false, type: null }],
                foreign_keys: [
                    {
                        name: 'orders_user_id_foreign',
                        columns: ['user_id'],
                        ref_table: 'users',
                        ref_columns: ['id'],
                        on_update: null,
                        on_delete: 'restrict',
                    },
                ],
            },
        ],
    };
}

/**
 * Indexed access into a hand-built fixture. `noUncheckedIndexedAccess` is right
 * in general and wrong here — the fixture is defined three lines up — so this
 * asserts presence rather than casting the check away, and fails loudly if the
 * fixture is ever edited out from under a test.
 */
function nth<T>(xs: T[], i: number): T {
    const v = xs[i];
    if (v === undefined) throw new Error(`fixture carries no element at index ${i}`);
    return v;
}

const codes = (doc: unknown): string[] => validateIr(doc).map((f) => f.code);

describe('validateIr', () => {
    it('passes a well-formed document with no findings', () => {
        expect(validateIr(validIr())).toEqual([]);
    });

    it('rejects a non-object document', () => {
        expect(codes('nope')).toContain('ir-not-an-object');
        expect(codes([])).toContain('ir-not-an-object');
    });

    it('rejects an unsupported ir_version', () => {
        const ir = { ...validIr(), ir_version: 2 };
        expect(codes(ir)).toContain('ir-version-unsupported');
    });

    it('rejects an unknown dialect', () => {
        const ir = { ...validIr(), dialect: 'oracle' };
        expect(codes(ir)).toContain('ir-dialect-unknown');
    });

    it('rejects an absent normalization_class rather than defaulting it', () => {
        const ir = validIr() as unknown as Record<string, unknown>;
        ir.source = { kind: 'sql', ref: 'x.sql' };
        expect(codes(ir)).toContain('ir-normalization-class-unknown');
    });

    it('rejects an unknown normalization_class', () => {
        const ir = validIr();
        (ir.source as unknown as Record<string, unknown>).normalization_class = 'hybrid';
        expect(codes(ir)).toContain('ir-normalization-class-unknown');
    });

    it('rejects an unknown source kind', () => {
        const ir = validIr();
        (ir.source as unknown as Record<string, unknown>).kind = 'mystery';
        expect(codes(ir)).toContain('ir-source-kind-unknown');
    });

    // The skip counters are the mechanism behind the computed scope line: a
    // missing counter must be a finding, never a silent zero.
    it('rejects a wholly absent skipped block', () => {
        const ir = validIr() as unknown as Record<string, unknown>;
        delete ir.skipped;
        expect(codes(ir)).toContain('ir-skipped-missing');
    });

    it('rejects each individually missing skip counter', () => {
        for (const key of SKIP_KEYS) {
            const ir = validIr();
            delete (ir.skipped as unknown as Record<string, unknown>)[key];
            const found = validateIr(ir);
            expect(found.map((f) => f.code)).toContain('ir-skipped-counter-invalid');
            expect(found.map((f) => f.at)).toContain(`skipped.${key}`);
        }
    });

    it('rejects a negative or fractional skip counter', () => {
        const negative = validIr();
        negative.skipped.views = -1;
        expect(codes(negative)).toContain('ir-skipped-counter-invalid');

        const fractional = validIr();
        fractional.skipped.triggers = 1.5;
        expect(codes(fractional)).toContain('ir-skipped-counter-invalid');
    });

    it('rejects duplicate table and column names', () => {
        const dupTable = validIr();
        dupTable.tables.push({ ...nth(dupTable.tables, 0) });
        expect(codes(dupTable)).toContain('ir-table-duplicate');

        const dupColumn = validIr();
        nth(dupColumn.tables, 0).columns.push({ ...nth(nth(dupColumn.tables, 0).columns, 0), ordinal: 3 });
        expect(codes(dupColumn)).toContain('ir-column-duplicate');
    });

    it('rejects a zero or non-integer ordinal', () => {
        const ir = validIr();
        nth(nth(ir.tables, 0).columns, 0).ordinal = 0;
        expect(codes(ir)).toContain('ir-column-ordinal-invalid');
    });

    it('rejects a foreign key with no referenced table', () => {
        const ir = validIr();
        (nth(nth(ir.tables, 1).foreign_keys, 0) as unknown as Record<string, unknown>).ref_table = '';
        expect(codes(ir)).toContain('ir-foreign-key-ref-table-missing');
    });

    it('reports every finding as a gate — a malformed IR is never advisory', () => {
        const ir = validIr() as unknown as Record<string, unknown>;
        delete ir.skipped;
        ir.dialect = 'oracle';
        expect(validateIr(ir).every((f) => f.tier === 'gate')).toBe(true);
    });
});

describe('canonicalizeIr', () => {
    it('is idempotent and byte-stable across two runs over shuffled input', () => {
        const ir = validIr();
        const shuffled = validIr();
        shuffled.tables.reverse();
        shuffled.tables.forEach((t) => t.indexes.reverse());

        expect(serializeIr(shuffled)).toBe(serializeIr(ir));
        expect(serializeIr(canonicalizeIr(ir))).toBe(serializeIr(ir));
    });

    it('sorts tables and indexes by name', () => {
        const c = canonicalizeIr(validIr());
        expect(c.tables.map((t) => t.name)).toEqual(['orders', 'users']);
    });

    // Column order is data, not presentation: the differ ignores ordinal, but
    // the current-state view must show the physical order.
    it('keeps columns in ordinal order rather than sorting them by name', () => {
        const ir = validIr();
        nth(ir.tables, 0).columns.reverse();
        const c = canonicalizeIr(ir);
        expect(c.tables.find((t) => t.name === 'users')?.columns.map((x) => x.name)).toEqual(['id', 'email']);
    });

    // A composite index on (a, b) is not the index on (b, a) — sorting the
    // column list would erase a real difference.
    it('preserves the declared order of composite index columns', () => {
        const ir = validIr();
        nth(ir.tables, 0).indexes = [{ name: 'ix', columns: ['b', 'a'], unique: false, type: null }];
        const c = canonicalizeIr(ir);
        expect(c.tables.find((t) => t.name === 'users')?.indexes[0]?.columns).toEqual(['b', 'a']);
    });

    it('emits no host path and no timestamp', () => {
        const text = serializeIr(validIr());
        expect(text).not.toMatch(/\/Users\/|\/home\/|[A-Z]:\\\\/);
        expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    });
});

describe('scopeHonestyLine', () => {
    it('states completeness when nothing was skipped', () => {
        expect(scopeHonestyLine(validIr())).toContain('nothing skipped');
    });

    it('names what was dropped and how much', () => {
        const ir = validIr();
        ir.skipped.views = 3;
        ir.skipped.generated_columns = 1;
        const line = scopeHonestyLine(ir);
        expect(line).toContain('partial');
        expect(line).toContain('3 views');
        expect(line).toContain('1 generated columns');
    });
});
