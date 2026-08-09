/**
 * Tests for the CHECKPOINT capsule (road-to-worker-generation-recycling, Phase 0).
 *
 * The load-bearing test is `rejects a transcript-shaped payload`: the roadmap's
 * acceptance criterion is that a raw transcript is invalid BY CONSTRUCTION, not
 * by convention. If that test can be made to pass with a transcript in any
 * field, the capsule stopped being a handoff and became a context dump.
 *
 * The last describe block pins Phase 0.4 — emission is schema-additive and off:
 * nothing reads a capsule yet, and the completed-result synthesis path has no
 * CHECKPOINT branch. Phase 2 is the diff that flips it, visibly.
 */

import { describe, expect, it } from 'vitest';

import {
    EPISTEMIC_STATES,
    MAX_ENTRIES,
    MAX_LINE_CHARS,
    MAX_REF_CHARS,
    validateAssumption,
    validateCapsule,
    type WorkerCapsule,
} from '../../src/scripts/_lib/subagent_capsule.js';
import { synthesisGaps, validateResponse } from '../../src/scripts/_lib/subagent_response.js';

function _capsule(over: Partial<WorkerCapsule> = {}): Record<string, unknown> {
    const base: WorkerCapsule = {
        summary: 'Mapped three of five call sites; the two Livewire ones are unread.',
        generation: 1,
        done: ['src/scripts/_lib/subagent_spawn.ts:72', 'docs/contracts/audit-log-v1.md'],
        remaining: ['read the two Livewire call sites', 'confirm the tier default'],
        decisions: ['kept the existing envelope; added no new status to the response body'],
        open_risks: ['the tier default may be inherited rather than static'],
        touched_files: ['src/scripts/_lib/subagent_capsule.ts'],
        assumptions: [
            { statement: 'lite tier is the lookup-class default', basis: 'src/scripts/_lib/worker_budget.ts:26', epistemic_state: 'verified' },
            { statement: 'no consumer reads the capsule yet', basis: 'grep over src/', epistemic_state: 'assumed' },
        ],
    };
    return { ...base, ...over } as Record<string, unknown>;
}

describe('CHECKPOINT capsule — shape', () => {
    it('accepts a well-formed capsule', () => {
        expect(validateCapsule(_capsule())).toEqual([]);
    });

    it('requires done, remaining, and a generation index', () => {
        for (const field of ['done', 'remaining', 'generation'] as const) {
            const c = _capsule();
            delete c[field];
            expect(validateCapsule(c).length, `${field} must be required`).toBeGreaterThan(0);
        }
    });

    it('rejects a non-object payload', () => {
        expect(validateCapsule(null)).toEqual(['not an object']);
        expect(validateCapsule(['done'])).toEqual(['not an object']);
    });

    it('numbers generations from 1, integers only', () => {
        expect(validateCapsule(_capsule({ generation: 0 })).length).toBeGreaterThan(0);
        expect(validateCapsule(_capsule({ generation: 1.5 })).length).toBeGreaterThan(0);
        expect(validateCapsule(_capsule({ generation: 3 }))).toEqual([]);
    });
});

describe('CHECKPOINT capsule — transcript-exclusion by construction', () => {
    const TRANSCRIPT = [
        'user: please map the call sites',
        'assistant: reading src/scripts/_lib/subagent_spawn.ts',
        'tool_result: 72:export function composeSpawnBrief(sel: SpawnSelection): SpawnBrief {',
    ].join('\n');

    it('rejects a transcript-shaped payload in every list field', () => {
        for (const field of ['done', 'remaining', 'decisions', 'open_risks', 'touched_files'] as const) {
            const errors = validateCapsule(_capsule({ [field]: [TRANSCRIPT] } as Partial<WorkerCapsule>));
            expect(errors.join(' '), `${field} accepted a transcript`).toContain(field);
        }
    });

    it('rejects a transcript in the summary', () => {
        expect(validateCapsule(_capsule({ summary: TRANSCRIPT })).join(' ')).toContain('summary');
    });

    it('rejects a transcript smuggled as one very long single line', () => {
        const oneLiner = 'x'.repeat(MAX_LINE_CHARS + 1);
        expect(validateCapsule(_capsule({ remaining: [oneLiner] })).length).toBeGreaterThan(0);
        expect(validateCapsule(_capsule({ done: ['y'.repeat(MAX_REF_CHARS + 1)] })).length).toBeGreaterThan(0);
    });

    it('rejects a transcript reached by accumulation of legal short lines', () => {
        const many = Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => `step ${i}`);
        expect(validateCapsule(_capsule({ remaining: many })).join(' ')).toContain(`max ${MAX_ENTRIES}`);
    });
});

describe('CHECKPOINT capsule — assumptions and the epistemic vocabulary', () => {
    it('pins the vocabulary to the Evidence-Report buckets, unforked', () => {
        expect([...EPISTEMIC_STATES]).toEqual(['verified', 'assumed', 'gap']);
    });

    it('rejects a grade outside that vocabulary', () => {
        const errors = validateAssumption({ statement: 's', basis: 'file.ts:1', epistemic_state: 'probably' });
        expect(errors.join(' ')).toContain('epistemic_state');
    });

    it('requires a basis ref — an ungrounded premise is not a recorded assumption', () => {
        expect(validateAssumption({ statement: 's', epistemic_state: 'assumed' }).join(' ')).toContain('basis');
    });

    it('rejects a body pasted into an assumption', () => {
        const errors = validateAssumption({
            statement: 'line one\nline two',
            basis: 'file.ts:1',
            epistemic_state: 'assumed',
        });
        expect(errors.join(' ')).toContain('statement');
    });

    it('carries the same shape on the completed worker result envelope', () => {
        const response = {
            summary: 'done',
            findings: [{ title: 'f', evidence_refs: ['a.ts:1'] }],
            risks: [],
            confidence: 'high' as const,
            handoff: '',
            assumptions: [{ statement: 's', basis: 'a.ts:1', epistemic_state: 'verified' as const }],
        };
        expect(validateResponse(response).valid).toBe(true);
        expect(validateResponse({ ...response, assumptions: [{ statement: 's', basis: 'a.ts:1', epistemic_state: 'hunch' }] }).valid).toBe(false);
    });
});

describe('Phase 0.4 — additive and off: nothing reads a capsule yet', () => {
    it('leaves the four legacy statuses untouched — a capsule is not a response body', () => {
        // The synthesis path validates the RESULT envelope. A capsule is a
        // different shape and is not silently adopted as one; when Phase 2
        // teaches the orchestrator to read capsules, this expectation is the
        // line that has to change.
        expect(validateResponse(_capsule()).valid).toBe(false);
    });

    it('adds no CHECKPOINT branch to the synthesis duties', () => {
        const response = {
            summary: 'done',
            findings: [{ title: 'unbacked claim' }],
            risks: [],
            confidence: 'medium' as const,
            handoff: '',
        };
        // Unchanged behaviour: an evidence-free finding is still the only gap
        // reported, with or without the capsule surface existing.
        expect(synthesisGaps(response)).toHaveLength(1);
    });
});
