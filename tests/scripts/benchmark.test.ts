/**
 * Benchmark report (road-to-retrieval-substrate-hardening B7a).
 */
import { describe, expect, it } from 'vitest';

import { computeReport } from '../../src/scripts/benchmark.js';

describe('computeReport', () => {
    const metrics = {
        eager_rule_load: 78513,
        thin_rule_load: 13881,
        skill_descriptions: 11184,
        command_descriptions: 5138,
        mcp_schemas: 3694,
    };

    it('measures against the FULL always-loaded projection (council Q4)', () => {
        const r = computeReport(metrics);
        // baseline = eager + shared surfaces (NOT a synthetic strawman)
        expect(r.baseline_full_projection).toBe(78513 + 11184 + 5138 + 3694);
        expect(r.reduced_projection).toBe(13881 + 11184 + 5138 + 3694);
        expect(r.saved).toBe(78513 - 13881);
        expect(r.reduction_ratio).toBeGreaterThan(0);
        expect(r.reduction_ratio).toBeLessThan(1);
        expect(r.method).toMatch(/full always-loaded projection/i);
        expect(r.method).toMatch(/not a synthetic strawman/i);
    });

    it('is deterministic', () => {
        expect(JSON.stringify(computeReport(metrics))).toBe(JSON.stringify(computeReport(metrics)));
    });

    it('handles a zero baseline without dividing by zero', () => {
        const r = computeReport({ eager_rule_load: 0, thin_rule_load: 0, skill_descriptions: 0, command_descriptions: 0, mcp_schemas: 0 });
        expect(r.reduction_ratio).toBe(0);
    });
});
