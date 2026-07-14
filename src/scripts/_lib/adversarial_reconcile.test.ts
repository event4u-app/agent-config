/**
 * Adversarial reconciliation core — deterministic coverage (Phase 1).
 *
 * Covers: dedup across skeptics, severity aggregation (strict-er wins),
 * quorum-confidence math, false-positive suppression (demote, never drop),
 * empty panel, single-finding, unanimous vs split, malformed-input rejection,
 * and hand-rolled validation of every output against
 * adversarial-findings.json (no jsonschema runtime dep — mirrors
 * test_subagent_status_schema.py's approach).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    type AdversarialFindings,
    type RawFinding,
    type SkepticReturn,
    assertValidRawFinding,
    findingKey,
    isSuppressedFalsePositive,
    reconcileFindings,
    severityQuorum,
} from './adversarial_reconcile.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(
    HERE,
    '../../skills/subagent-orchestration/schemas/adversarial-findings.json',
);

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const CONFIDENCES = new Set(['high', 'medium', 'low']);

/** Minimal hand-rolled validator matching the schema's required keys + enums. */
function validateEnvelope(env: AdversarialFindings): void {
    expect(env).toHaveProperty('panel');
    expect(env.panel.models.length).toBeGreaterThanOrEqual(1);
    expect(env.panel.skeptic_count).toBe(env.panel.models.length);
    for (const bucket of [env.findings, env.false_positives_suppressed]) {
        for (const f of bucket) {
            for (const val of [f.id, f.severity, f.category, f.location, f.description, f.confidence]) {
                expect(typeof val).toBe('string');
                expect(val.length).toBeGreaterThan(0);
            }
            expect(SEVERITIES.has(f.severity)).toBe(true);
            expect(CONFIDENCES.has(f.confidence)).toBe(true);
            expect(Array.isArray(f.raised_by)).toBe(true);
            expect(f.raised_by.length).toBeGreaterThanOrEqual(1);
            expect(Array.isArray(f.refuted_by)).toBe(true);
        }
    }
}

function raw(over: Partial<RawFinding> = {}): RawFinding {
    return {
        severity: 'high',
        category: 'correctness',
        location: 'src/a.ts:42',
        description: 'off-by-one in loop bound',
        ...over,
    };
}

describe('adversarial-findings.json schema', () => {
    it('parses and declares the finding contract', () => {
        const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
        expect(schema.required).toEqual(['panel', 'findings', 'false_positives_suppressed']);
        expect(schema.additionalProperties).toBe(false);
        expect(schema.definitions.finding.required).toContain('raised_by');
        expect(schema.definitions.finding.required).toContain('confidence');
        expect(schema.definitions.finding.properties.severity.enum).toEqual([
            'critical',
            'high',
            'medium',
            'low',
        ]);
    });
});

describe('findingKey', () => {
    it('is location + normalized category', () => {
        expect(findingKey({ location: 'src/a.ts:42 ', category: 'Security' })).toBe(
            'src/a.ts:42::security',
        );
    });
});

describe('assertValidRawFinding', () => {
    it('rejects a bad severity', () => {
        expect(() => assertValidRawFinding(raw({ severity: 'blocker' as never }))).toThrow(/severity/);
    });
    it('rejects an empty location', () => {
        expect(() => assertValidRawFinding(raw({ location: '  ' }))).toThrow(/location/);
    });
    it('accepts a well-formed finding', () => {
        expect(() => assertValidRawFinding(raw())).not.toThrow();
    });
});

describe('severityQuorum', () => {
    it('high when corroborated by a panel quorum', () => {
        expect(severityQuorum(2, 0, 2)).toBe('high');
        expect(severityQuorum(2, 0, 3)).toBe('high');
    });
    it('medium when corroborated below quorum', () => {
        expect(severityQuorum(2, 0, 5)).toBe('medium');
    });
    it('medium for a lone raiser on a solo panel', () => {
        expect(severityQuorum(1, 0, 1)).toBe('medium');
    });
    it('low for a single raiser on a multi-skeptic panel', () => {
        expect(severityQuorum(1, 0, 3)).toBe('low');
    });
});

describe('isSuppressedFalsePositive', () => {
    it('suppresses a lone finding refuted by a strict majority of the rest', () => {
        expect(isSuppressedFalsePositive(1, 1, 2)).toBe(true); // rest=1, refuted=1 > 0.5
        expect(isSuppressedFalsePositive(1, 2, 3)).toBe(true); // rest=2, refuted=2 > 1
    });
    it('does not suppress when refutation is not a strict majority', () => {
        expect(isSuppressedFalsePositive(1, 1, 3)).toBe(false); // rest=2, refuted=1 == 1, not > 1
    });
    it('never suppresses a corroborated finding', () => {
        expect(isSuppressedFalsePositive(2, 5, 7)).toBe(false);
    });
});

describe('reconcileFindings', () => {
    it('handles an empty panel', () => {
        const env = reconcileFindings([]);
        expect(env.panel).toEqual({ models: [], skeptic_count: 0 });
        expect(env.findings).toEqual([]);
        expect(env.false_positives_suppressed).toEqual([]);
    });

    it('dedups the same defect across skeptics and records both as raisers', () => {
        const env = reconcileFindings([
            { model: 'anthropic:x', findings: [raw()] },
            { model: 'openai:y', findings: [raw({ description: 'the loop reads one past the end of the array' })] },
        ]);
        expect(env.findings).toHaveLength(1);
        expect(env.findings[0]!.raised_by.sort()).toEqual(['anthropic:x', 'openai:y']);
        expect(env.findings[0]!.confidence).toBe('high'); // 2/2 = quorum
        // Longest description wins.
        expect(env.findings[0]!.description).toMatch(/one past the end/);
        validateEnvelope(env);
    });

    it('aggregates severity strict-er-wins', () => {
        const env = reconcileFindings([
            { model: 'a', findings: [raw({ severity: 'medium' })] },
            { model: 'b', findings: [raw({ severity: 'critical' })] },
        ]);
        expect(env.findings[0]!.severity).toBe('critical');
    });

    it('takes the union of distinct findings and orders by severity then key', () => {
        const env = reconcileFindings([
            { model: 'a', findings: [raw({ location: 'src/a.ts:1', severity: 'low', category: 'quality' })] },
            { model: 'b', findings: [raw({ location: 'src/b.ts:9', severity: 'critical', category: 'security' })] },
        ]);
        expect(env.findings.map((f) => f.severity)).toEqual(['critical', 'low']);
        expect(env.findings.map((f) => f.id)).toEqual(['avc-001', 'avc-002']);
        validateEnvelope(env);
    });

    it('demotes a lone finding refuted by a majority into false_positives_suppressed', () => {
        const loneKey = findingKey({ location: 'src/c.ts:5', category: 'security' });
        const env = reconcileFindings([
            { model: 'a', findings: [raw({ location: 'src/c.ts:5', category: 'security' })] },
            { model: 'b', findings: [], refutes: [loneKey] },
        ]);
        expect(env.findings).toHaveLength(0);
        expect(env.false_positives_suppressed).toHaveLength(1);
        expect(env.false_positives_suppressed[0]!.refuted_by).toEqual(['b']);
        validateEnvelope(env);
    });

    it('is deterministic across input order', () => {
        const a: SkepticReturn = { model: 'a', findings: [raw({ location: 'src/z.ts:1', severity: 'high' })] };
        const b: SkepticReturn = { model: 'b', findings: [raw({ location: 'src/a.ts:1', severity: 'high', category: 'security' })] };
        const one = reconcileFindings([a, b]);
        const two = reconcileFindings([b, a]);
        expect(one.findings.map((f) => f.location)).toEqual(two.findings.map((f) => f.location));
        expect(one.findings.map((f) => f.id)).toEqual(two.findings.map((f) => f.id));
    });

    it('rejects malformed findings from a skeptic', () => {
        expect(() =>
            reconcileFindings([{ model: 'a', findings: [raw({ severity: 'nope' as never })] }]),
        ).toThrow(/severity/);
    });
});
