/**
 * CHECKPOINT schema — one module, two variants, one validator family
 * (road-to-token-economy-recycling Phase 2.1; verify: `npx vitest run
 * checkpoint_schema`).
 *
 * Anti-fork check (roadmap 5.6 + acceptance): the worker capsule fixture
 * and the main-session recycle envelope fixture BOTH validate through
 * `src/scripts/_lib/subagent_capsule.ts`. The anti-summarisation stance is
 * enforced as a validator rule, fixture-proven twice: a prose-summary
 * FIELD fails the unknown-key sweep, and prose-shaped CONTENT (multi-line,
 * over-length, over-accumulated) fails the shared short-line primitives.
 */
import { describe, expect, it } from 'vitest';

import {
    CAPSULE_SCHEMA_VERSION,
    CAPSULE_VARIANTS,
    validateCapsule,
    validateRecycleEnvelope,
    type MainSessionRecycleEnvelope,
    type WorkerCapsule,
} from '../../src/scripts/_lib/subagent_capsule.js';

/** A canonical worker capsule — the Phase-0 fixture shape, unversioned (implicit v1). */
function workerFixture(): WorkerCapsule {
    return {
        summary: 'migrated the settings reader; two call sites remain',
        generation: 1,
        done: ['src/shared/settings.ts:41', 'tests/settings.test.ts'],
        remaining: ['update the CLI call site', 'run the typecheck'],
        decisions: ['kept the sync read — async would fork the API'],
        open_risks: ['the windows path branch is untested'],
        touched_files: ['src/shared/settings.ts'],
        assumptions: [
            { statement: 'settings file is UTF-8', basis: 'src/shared/settings.ts:12', epistemic_state: 'verified' },
        ],
    };
}

/** A canonical main-session recycle envelope — the Phase-2 variant. */
export function recycleFixture(): MainSessionRecycleEnvelope {
    return {
        capsule_version: CAPSULE_SCHEMA_VERSION,
        variant: 'main_session',
        summary: 'roadmap X phases 1-2 landed; phase 3 threshold work open',
        task: 'process road-to-example.md to full closure and open one PR',
        workspace: '/repo/checkout',
        written_at: '2026-08-10T12:00:00.000Z',
        acceptance_criteria: ['all roadmap boxes flipped', 'remote CI green on the PR'],
        remaining: ['implement phase 3', 'archive the roadmap'],
        not_carried_forward: ['full diff bodies — re-read from the branch'],
        decisions: ['threshold=800k — cites the phase-1 note, not hand-feel'],
        constraints: ['never push to main; PR only'],
        open_worker_envelopes: [],
        artifact_paths: ['agents/evidence/analysis/example-phase1.md'],
        assumptions: [
            { statement: 'CI runs the full gate set', basis: '.github/workflows/tests.yml', epistemic_state: 'verified' },
        ],
    };
}

describe('anti-fork: both variants validate through the one module', () => {
    it('the worker fixture passes the worker validator', () => {
        expect(validateCapsule(workerFixture())).toEqual([]);
    });

    it('the recycle fixture passes the recycle validator', () => {
        expect(validateRecycleEnvelope(recycleFixture())).toEqual([]);
    });

    it('the variant vocabulary is pinned', () => {
        expect([...CAPSULE_VARIANTS]).toEqual(['worker', 'main_session']);
        expect(CAPSULE_SCHEMA_VERSION).toBe(2);
    });

    it('versioning stays additive: the unversioned worker capsule remains valid (implicit v1)', () => {
        const capsule = workerFixture() as unknown as Record<string, unknown>;
        expect('capsule_version' in capsule).toBe(false);
        expect(validateCapsule(capsule)).toEqual([]);
    });
});

describe('anti-summarisation — schema-invalid by construction (acceptance fixture)', () => {
    it('a prose-summary FIELD fails validation', () => {
        const bad = {
            ...recycleFixture(),
            transcript_summary: 'First the user asked about X, then we tried Y, then...',
        };
        const errors = validateRecycleEnvelope(bad);
        expect(errors.some((e) => e.includes('unknown field "transcript_summary"'))).toBe(true);
    });

    it('multi-line prose CONTENT fails the shared short-line rule', () => {
        const bad = {
            ...recycleFixture(),
            decisions: ['line one\nline two — a paragraph does not fit, that is the point'],
        };
        expect(validateRecycleEnvelope(bad).length).toBeGreaterThan(0);
    });

    it('accumulation past the entry cap fails (a transcript cannot be reached by appending)', () => {
        const bad = {
            ...recycleFixture(),
            remaining: Array.from({ length: 41 }, (_, i) => `step ${i}`),
        };
        expect(validateRecycleEnvelope(bad).some((e) => e.includes('remaining'))).toBe(true);
    });
});

describe('main_session required set — successor bootstraps from the envelope alone', () => {
    it.each(['task', 'workspace', 'written_at', 'acceptance_criteria', 'remaining', 'not_carried_forward'] as const)(
        'missing %s is a violation',
        (field) => {
            const bad = { ...recycleFixture() } as Record<string, unknown>;
            delete bad[field];
            expect(validateRecycleEnvelope(bad).length).toBeGreaterThan(0);
        },
    );

    it('empty acceptance_criteria is a violation', () => {
        expect(
            validateRecycleEnvelope({ ...recycleFixture(), acceptance_criteria: [] }).some((e) =>
                e.includes('acceptance_criteria'),
            ),
        ).toBe(true);
    });

    it('wrong variant or version is a violation', () => {
        expect(validateRecycleEnvelope({ ...recycleFixture(), variant: 'worker' })).not.toEqual([]);
        expect(validateRecycleEnvelope({ ...recycleFixture(), capsule_version: 1 })).not.toEqual([]);
    });

    it('an unparseable written_at is a violation', () => {
        expect(validateRecycleEnvelope({ ...recycleFixture(), written_at: 'gestern' })).not.toEqual([]);
    });

    it('assumptions share the worker vocabulary — a private scale is rejected', () => {
        const bad = {
            ...recycleFixture(),
            assumptions: [{ statement: 's', basis: 'b', epistemic_state: 'pretty-sure' }],
        };
        expect(validateRecycleEnvelope(bad).some((e) => e.includes('epistemic_state'))).toBe(true);
    });
});
