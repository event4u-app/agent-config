/**
 * The offline routing-training row schema — step 11.1.
 *
 * The verify clause is *"the row schema has no field capable of holding prompt
 * text"*, so the assertions are an ABSENCE assertion in two layers: the runtime
 * manifest walk, and a source-level grep of the interface the manifest cannot
 * see into.
 *
 * The step stays UNCHECKED: this discharges the verify clause, not the step —
 * no rows have been collected and the benchmark half of 11.1's evidence does
 * not exist.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { COUNCIL_TOPOLOGIES } from '../../../src/scripts/ai_council/topology_vocabulary.js';
import {
    EVIDENCE_SOURCES,
    IMPACT_CLASSES,
    MAGNITUDE_BUCKETS,
    MAX_ENUM_VALUE_LENGTH,
    ROW_FIELDS,
    ROW_OUTCOMES,
    auditRowSchema,
    serialiseRow,
} from '../../../src/scripts/ai_council/routing_training_row.js';
import type { RoutingTrainingRow } from '../../../src/scripts/ai_council/routing_training_row.js';

const MODULE_REL = 'src/scripts/ai_council/routing_training_row.ts';
const MODULE_SRC = fs.readFileSync(path.resolve(__dirname, '../../..', MODULE_REL), 'utf8');

const ROW: RoutingTrainingRow = {
    evidenceSource: 'benchmark',
    topology: 'peer_review',
    impactClass: 'medium_impact',
    artifactSizeBucket: 'm',
    initialDisagreementBucket: 'l',
    latencyBucket: 's',
    outcome: 'verdict-changed',
    memberCount: 2,
    providerFamilyCount: 2,
    roundsConfigured: 3,
    roundsCompleted: 2,
    priorRunFreshnessDays: 12,
    estimatedCalls: 6,
    observedCalls: 4,
    estimatedCostCents: 41,
    observedCostCents: 28,
    stoppedEarly: true,
    minorityRetained: false,
};

/** The interface body, comments stripped — what a field declaration lives in. */
function interfaceBody(): string {
    const src = MODULE_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const start = src.indexOf('export interface RoutingTrainingRow');
    expect(start).toBeGreaterThan(-1);
    return src.slice(start, src.indexOf('}', start) + 1);
}

describe('11.1 — no field is capable of holding prompt text', () => {
    it('every declared field is an integer, a boolean, or a closed enum', () => {
        expect(ROW_FIELDS.length).toBeGreaterThanOrEqual(18);
        for (const f of ROW_FIELDS) {
            expect(['integer', 'boolean', 'enum']).toContain(f.kind);
            if (f.kind === 'enum') expect((f.values ?? []).length).toBeGreaterThan(0);
            else expect(f.values).toBeUndefined();
        }
        expect(auditRowSchema(ROW as unknown as Record<string, unknown>)).toEqual([]);
    });

    it('SOURCE GATE — the interface declares no string, any, unknown or open record field', () => {
        // The manifest cannot see a field somebody adds to the interface and
        // forgets to declare; this can.
        const body = interfaceBody();
        expect(body).not.toMatch(/:\s*string\s*;/);
        expect(body).not.toMatch(/:\s*(any|unknown)\s*;/);
        expect(body).not.toMatch(/Record<\s*string\s*,/);
        expect(body).not.toMatch(/\[\s*key\s*:\s*string\s*\]/);
    });

    it('SOURCE GATE — no field is named like a free-text carrier', () => {
        const body = interfaceBody().toLowerCase();
        for (const bad of ['prompt', 'payload', 'notes', 'extra', 'context', 'body', 'text', 'raw', 'message']) {
            expect(body).not.toContain(bad);
        }
    });

    it('every enum value is short enough that the set cannot be a text field in disguise', () => {
        for (const f of ROW_FIELDS) {
            for (const v of f.values ?? []) expect(v.length).toBeLessThanOrEqual(MAX_ENUM_VALUE_LENGTH);
        }
        expect(MAX_ENUM_VALUE_LENGTH).toBe(40);
    });

    it('the enums are the closed sets the tree already owns, not forked copies', () => {
        expect(ROW_FIELDS.find((f) => f.name === 'topology')?.values).toBe(COUNCIL_TOPOLOGIES);
        expect(IMPACT_CLASSES).toEqual(['trivial', 'low_impact', 'medium_impact', 'high_impact', 'user_required']);
        expect(EVIDENCE_SOURCES).toEqual(['benchmark', 'dogfood']);
        expect(MAGNITUDE_BUCKETS).toEqual(['xs', 's', 'm', 'l', 'xl']);
        expect(ROW_OUTCOMES).toEqual(['verdict-changed', 'verdict-unchanged', 'no-verdict']);
    });
});

describe('DENIAL — the validator rejects a real prompt-text carrier', () => {
    it('rejects an undeclared field, whatever it is called', () => {
        const problems = auditRowSchema({ ...ROW, promptText: 'the user asked about tenant scoping' });
        expect(problems.some((p) => p.includes('promptText'))).toBe(true);
        expect(problems.some((p) => p.includes('undeclared fields are rejected'))).toBe(true);
    });

    it('rejects an arbitrary string smuggled into a declared enum field', () => {
        const problems = auditRowSchema({ ...ROW, outcome: 'the council decided to keep host synthesis because…' });
        expect(problems.some((p) => p.includes('prompt-text carrier'))).toBe(true);
    });

    it('rejects a non-integer in a numeric field', () => {
        expect(auditRowSchema({ ...ROW, memberCount: 'two' })).toContainEqual(
            expect.stringContaining('must be an integer'),
        );
    });

    it('rejects a missing field rather than emitting a partial row', () => {
        const { topology: _dropped, ...partial } = ROW as unknown as Record<string, unknown>;
        expect(auditRowSchema(partial)).toContainEqual(expect.stringContaining('missing declared field `topology`'));
    });

    it('the source gate fires on a constructed violation, so a clean pass means "absent"', () => {
        const violating = 'export interface X {\n    readonly promptText: string;\n}';
        expect(violating).toMatch(/:\s*string\s*;/);
        expect(violating.toLowerCase()).toContain('prompt');
        // …and does not fire on the real interface.
        expect(interfaceBody()).not.toMatch(/:\s*string\s*;/);
    });
});

describe('serialisation refuses to emit an unaudited row', () => {
    it('emits declared fields in manifest order', () => {
        const parsed = JSON.parse(serialiseRow(ROW)) as Record<string, unknown>;
        expect(Object.keys(parsed)).toEqual(ROW_FIELDS.map((f) => f.name));
    });

    it('throws rather than serialising a row carrying free text', () => {
        expect(() => serialiseRow({ ...ROW, promptText: 'secret' } as unknown as RoutingTrainingRow)).toThrow(
            /promptText/,
        );
    });

    it('admits exactly two evidence sources — benchmark and dogfood, no third', () => {
        expect(auditRowSchema({ ...ROW, evidenceSource: 'production-transcript' })).toContainEqual(
            expect.stringContaining('benchmark | dogfood'),
        );
    });
});
