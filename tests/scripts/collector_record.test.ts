/**
 * Tests for the supervised collector's data contract
 * (`road-to-supervised-telemetry-collector` Phase 2.1 + 2.2).
 *
 * Phase 2.2 asks for "named serialization fixtures for the leak classes in 2.1,
 * each asserting the record cannot carry it", and requires each fixture to FAIL
 * when the corresponding constraint is removed — "a constraint never seen
 * enforced has unknown sensitivity". The `LEAK_FIXTURES` table below is that
 * set: one named entry per class the council enumerated, and the sensitivity
 * block at the bottom names, per class, the exact edit that reds it.
 */

import { describe, expect, it } from 'vitest';
import {
    ALLOWED_FIELDS,
    COLLECTOR_EVENTS,
    COLLECTOR_OUTCOMES,
    COLLECTOR_PLATFORMS,
    COLLECTOR_SCHEMA_VERSION,
    FIELD_PURPOSE,
    type CollectorRecord,
    dedupKey,
    validateRecord,
} from '../../src/scripts/_lib/collector_record.js';

function validRecord(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
    return {
        schema_version: COLLECTOR_SCHEMA_VERSION,
        machine_id: '3f2504e0-4f89-4d3a-9a0c-0305e82c3301',
        episode_id: 'a1b2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d',
        event: 'pre_tool_use',
        sequence: 0,
        outcome: 'captured',
        platform: 'claude',
        occurred_on: '2026-08-29',
        collector_version: '12.4.0',
        ...over,
    };
}

describe('collector_record — the field contract is complete', () => {
    it('accepts a well-formed record', () => {
        const r = validateRecord(validRecord());
        expect(r.errors).toEqual([]);
        expect(r.ok).toBe(true);
    });

    it('every declared field carries a purpose, a cardinality limit and a why-not-coarser line', () => {
        for (const [field, contract] of Object.entries(FIELD_PURPOSE)) {
            expect(contract.purpose.length, `${field}.purpose`).toBeGreaterThan(20);
            expect(contract.cardinality.length, `${field}.cardinality`).toBeGreaterThan(10);
            expect(contract.why_not_coarser.length, `${field}.why_not_coarser`).toBeGreaterThan(20);
        }
    });

    it('the allowlist is exactly the contract keys — a field cannot exist without a purpose', () => {
        const keys = Object.keys(validRecord()).sort();
        expect([...ALLOWED_FIELDS].sort()).toEqual(keys);
    });

    it('a missing field is an error, so a partial record cannot masquerade as complete', () => {
        const rec = validRecord();
        delete rec.platform;
        const r = validateRecord(rec);
        expect(r.ok).toBe(false);
        expect(r.errors.join(' ')).toContain("missing required field 'platform'");
    });
});

/**
 * Phase 2.2 — one named fixture per leak class the council enumerated.
 *
 * Each carries the field a naive producer would have added, and asserts the
 * record REFUSES it. `removing_this_constraint_reds_it` names the exact edit to
 * `collector_record.ts` that turns the fixture green — the sensitivity claim,
 * written down per class rather than asserted once for the suite.
 */
const LEAK_FIXTURES: ReadonlyArray<{
    readonly name: string;
    readonly field: string;
    readonly value: unknown;
    readonly removing_this_constraint_reds_it: string;
}> = [
    {
        name: 'repository / worktree identifier',
        field: 'repo_path',
        value: '/Users/someone/projects/acme/private-repo',
        removing_this_constraint_reds_it: 'adding repo_path to FIELD_PURPOSE',
    },
    {
        name: 'branch name (a worktree identifier by another name)',
        field: 'branch',
        value: 'feat/acquisition-of-competitor',
        removing_this_constraint_reds_it: 'adding branch to FIELD_PURPOSE',
    },
    {
        name: 'command name and arguments',
        field: 'command',
        value: 'psql --host prod-db.internal --user root',
        removing_this_constraint_reds_it: 'adding command to FIELD_PURPOSE',
    },
    {
        name: 'error enum with an interpolated value',
        field: 'error_detail',
        value: "ENOENT: no such file '/Users/someone/.ssh/id_rsa'",
        removing_this_constraint_reds_it: 'adding error_detail to FIELD_PURPOSE',
    },
    {
        name: 'a hash stable enough to identify a user or repo',
        field: 'repo_fingerprint',
        value: 'sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        removing_this_constraint_reds_it: 'adding repo_fingerprint to FIELD_PURPOSE',
    },
    {
        name: 'free-form escape hatch',
        field: 'extra',
        value: { anything: 'at all' },
        removing_this_constraint_reds_it: 'adding extra to FIELD_PURPOSE',
    },
];

describe('collector_record — Phase 2.2 leak-class fixtures', () => {
    for (const fx of LEAK_FIXTURES) {
        it(`refuses: ${fx.name} (via '${fx.field}')`, () => {
            const r = validateRecord(validRecord({ [fx.field]: fx.value }));
            expect(r.ok, `${fx.field} was accepted — the allowlist has a hole`).toBe(false);
            expect(r.errors.join(' ')).toContain(`unknown field '${fx.field}'`);
        });

        it(`REJECTS rather than DROPS: ${fx.name}`, () => {
            // Dropping would tell the producer the field is fine and move the
            // leak upstream where this schema cannot see it.
            const r = validateRecord(validRecord({ [fx.field]: fx.value }));
            expect(r.errors.join(' ')).toContain('REJECTED, not dropped');
        });
    }

    // A review called the previous version of this test documentary: it asserted
    // a string contains 'FIELD_PURPOSE', which proves nothing about the code.
    // The probative version checks the property the table exists for — that
    // every fixture field is genuinely absent from the allowlist, so no entry
    // has quietly become a declared field while its test still reads as a leak.
    it('no leak-fixture field is in the allowlist — the table cannot go stale silently', () => {
        for (const fx of LEAK_FIXTURES) {
            expect(ALLOWED_FIELDS.has(fx.field), `${fx.field} became a declared field`).toBe(false);
        }
        expect(LEAK_FIXTURES.length).toBeGreaterThanOrEqual(6);
    });
});

describe('collector_record — the timestamp leak class is a VALUE constraint, not a field ban', () => {
    // This class is different in kind from the six above: the field is legitimate
    // and required; it is its RESOLUTION that leaks. So it gets its own block.
    it('accepts a UTC calendar date', () => {
        expect(validateRecord(validRecord({ occurred_on: '2026-01-01' })).ok).toBe(true);
    });

    it('refuses a precise timestamp — a per-second time beside a stable machine_id is a fingerprint', () => {
        const r = validateRecord(validRecord({ occurred_on: '2026-08-29T14:23:51.412Z' }));
        expect(r.ok).toBe(false);
        expect(r.errors.join(' ')).toContain('behavioural fingerprint');
    });

    it('refuses a unix epoch time smuggled in as a number', () => {
        expect(validateRecord(validRecord({ occurred_on: 1756483431 })).ok).toBe(false);
    });
});

describe('collector_record — identifiers must be random, not derived', () => {
    it('refuses a machine_id that is a hash of a host fact', () => {
        const r = validateRecord(
            validRecord({ machine_id: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' }),
        );
        expect(r.ok).toBe(false);
        expect(r.errors.join(' ')).toContain('pseudonym');
    });

    it('refuses a hostname in machine_id', () => {
        expect(validateRecord(validRecord({ machine_id: 'macbook-pro-of-someone.local' })).ok).toBe(false);
    });
});

describe('collector_record — closed enums carry no payload', () => {
    it('refuses an event outside the vocabulary', () => {
        expect(validateRecord(validRecord({ event: 'custom_event' })).ok).toBe(false);
    });

    it('refuses an outcome carrying an interpolated message', () => {
        expect(validateRecord(validRecord({ outcome: 'write_failure: disk full at /Users/x' })).ok).toBe(false);
    });

    it('refuses an undeclared platform', () => {
        expect(validateRecord(validRecord({ platform: 'some-fork' })).ok).toBe(false);
    });

    it('the three enums are non-empty and closed', () => {
        expect(COLLECTOR_EVENTS.length).toBe(10);
        expect(COLLECTOR_OUTCOMES.length).toBe(3);
        expect(COLLECTOR_PLATFORMS.length).toBeGreaterThan(0);
    });

    it('outcome keeps startup_failure separate from write_failure, per metric item 5', () => {
        // A boolean would collapse exactly the distinction the metric definition
        // requires, because the two call for different fixes.
        expect(COLLECTOR_OUTCOMES).toContain('startup_failure');
        expect(COLLECTOR_OUTCOMES).toContain('write_failure');
    });
});

describe('collector_record — deduplication key of metric item 4', () => {
    it('is exactly (machine_id, episode_id, event, sequence)', () => {
        const rec = validRecord() as unknown as CollectorRecord;
        expect(dedupKey(rec)).toBe(
            '3f2504e0-4f89-4d3a-9a0c-0305e82c3301|a1b2c3d4-5e6f-4a8b-9c0d-1e2f3a4b5c6d|pre_tool_use|0',
        );
    });

    it('a retried write collapses to one key, so the numerator cannot inflate', () => {
        const a = validRecord() as unknown as CollectorRecord;
        const b = validRecord() as unknown as CollectorRecord;
        expect(dedupKey(a)).toBe(dedupKey(b));
    });

    it('a genuinely later dispatch in the same episode does NOT collapse', () => {
        const a = validRecord() as unknown as CollectorRecord;
        const b = validRecord({ sequence: 1 }) as unknown as CollectorRecord;
        expect(dedupKey(a)).not.toBe(dedupKey(b));
    });
});

describe('collector_record — regressions found by adversarial probe, not by the happy path', () => {
    // Both were found by probing the validator directly AFTER the first 35 tests
    // were green. The suite passed and the validator was wrong, which is the
    // reason a passing suite is not evidence on its own.

    it.each(['platform', 'event', 'outcome', 'machine_id'])(
        'a required field present with an explicit `undefined` is MISSING, not valid (%s)',
        (field) => {
            // `key in rec` is true here, and every type guard is
            // `!== undefined`-gated — so presence-only checking applied NO
            // constraint at all and the record validated clean.
            const r = validateRecord(validRecord({ [field]: undefined }));
            expect(r.ok, `${field}: undefined was accepted`).toBe(false);
            expect(r.errors.join(' ')).toContain(`missing required field '${field}'`);
        },
    );

    it.each(['2026-99-99', '2026-02-30', '2026-13-01', '2026-00-10'])(
        'occurred_on must be a REAL date, not merely date-shaped (%s)',
        (value) => {
            expect(validateRecord(validRecord({ occurred_on: value })).ok).toBe(false);
        },
    );

    it.each(['2026-02-28', '2024-02-29', '2026-12-31'])('accepts the real date %s', (value) => {
        expect(validateRecord(validRecord({ occurred_on: value })).ok).toBe(true);
    });
});

describe('collector_record — findings from the neutral cross-model review', () => {
    it('refuses an object whose PROTOTYPE carries a leak field', () => {
        // Object.keys sees own keys only, while `in` and property reads see
        // inherited ones — so a prototype-borne repo_path passed the unknown-key
        // sweep and was still readable downstream.
        const carrier = Object.create({ repo_path: '/Users/someone/private-repo' }) as Record<
            string,
            unknown
        >;
        Object.assign(carrier, validRecord());
        const r = validateRecord(carrier);
        expect(r.ok).toBe(false);
        expect(r.errors.join(' ')).toContain('plain object');
    });

    it('refuses an inherited required field masquerading as present', () => {
        const partial = validRecord();
        delete partial.platform;
        const carrier = Object.create({ platform: 'claude' }) as Record<string, unknown>;
        Object.assign(carrier, partial);
        expect(validateRecord(carrier).ok).toBe(false);
    });

    it.each([-50, 0, 2, 999999])('refuses schema_version %s — only the shipped one', (v) => {
        expect(validateRecord(validRecord({ schema_version: v })).ok).toBe(false);
    });

    it.each([
        '/Users/alice/repo',
        'psql --host prod-db.internal',
        'a whole sentence of prose that should never be in a telemetry record',
        '',
    ])('refuses collector_version %j — an unbounded string is a free-form field', (v) => {
        expect(validateRecord(validRecord({ collector_version: v })).ok).toBe(false);
    });

    it.each(['12.4.0', '1.0.0', '12.4.0-rc.1'])('accepts the version-shaped %s', (v) => {
        expect(validateRecord(validRecord({ collector_version: v })).ok).toBe(true);
    });

    it('refuses a UUIDv1 machine_id — it embeds a MAC address and a timestamp', () => {
        expect(
            validateRecord(validRecord({ machine_id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' })).ok,
        ).toBe(false);
    });

    it('refuses a UUIDv5 machine_id — it is a hash of a name in a namespace', () => {
        expect(
            validateRecord(validRecord({ machine_id: '886313e1-3b8a-5372-9b90-0c9aee199e5d' })).ok,
        ).toBe(false);
    });
});

describe('collector_record — malformed input', () => {
    it.each([
        ['null', null],
        ['an array', []],
        ['a string', 'not a record'],
        ['a number', 7],
    ])('refuses %s', (_label, value) => {
        expect(validateRecord(value).ok).toBe(false);
    });

    it('reports every problem at once rather than stopping at the first', () => {
        const r = validateRecord({ event: 'nope', repo_path: '/x', extra: 1 });
        expect(r.errors.length).toBeGreaterThan(3);
    });
});
