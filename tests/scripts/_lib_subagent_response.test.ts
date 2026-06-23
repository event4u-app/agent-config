import { describe, expect, it } from 'vitest';

import { forcesJudge, synthesisGaps, validateResponse } from '../../src/scripts/_lib/subagent_response.js';
import type { SubagentResponse } from '../../src/scripts/_lib/subagent_response.js';

const ok: SubagentResponse = {
    summary: 'auth middleware reviewed',
    findings: [{ title: 'missing tenant scope', evidence_refs: ['app/Http/Middleware/Auth.php:42'], mutating: true }],
    risks: ['tenant leak'],
    confidence: 'high',
    handoff: 'add tenant scope guard',
};

describe('validateResponse', () => {
    it('accepts a well-formed envelope', () => {
        expect(validateResponse(ok)).toEqual({ valid: true, errors: [] });
    });

    it('rejects a bad confidence value', () => {
        expect(validateResponse({ ...ok, confidence: 'sure' }).valid).toBe(false);
    });

    it('rejects inline-body evidence (refs only)', () => {
        const bad = { ...ok, findings: [{ title: 't', evidence_refs: ['line one\nline two — a body'] }] };
        const r = validateResponse(bad);
        expect(r.valid).toBe(false);
        expect(r.errors.join()).toMatch(/evidence_refs must be ref tokens/);
    });

    it('rejects a non-object', () => {
        expect(validateResponse(null).valid).toBe(false);
        expect(validateResponse('x').valid).toBe(false);
    });
});

describe('synthesisGaps — unbacked findings', () => {
    it('flags a finding with no evidence', () => {
        const r: SubagentResponse = { ...ok, findings: [{ title: 'hunch', mutating: false }] };
        expect(synthesisGaps(r)[0]).toMatch(/no evidence/);
    });

    it('no gap when every finding has evidence', () => {
        expect(synthesisGaps(ok)).toHaveLength(0);
    });
});

describe('forcesJudge — confidence → verify-budget link', () => {
    it('low-confidence mutating finding forces the full judge', () => {
        expect(forcesJudge({ title: 't', mutating: true }, 'low')).toBe(true);
    });
    it('high-confidence mutating finding does not force judge', () => {
        expect(forcesJudge({ title: 't', mutating: true }, 'high')).toBe(false);
    });
    it('low-confidence read-only finding does not force judge', () => {
        expect(forcesJudge({ title: 't', mutating: false }, 'low')).toBe(false);
    });
});
