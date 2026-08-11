/**
 * Recycle-envelope MUTATION suite.
 *
 * The validator already carried a version check, unknown-key rejection, and a
 * staleness-relevant timestamp field. What it did not carry was proof that each
 * of those rejections actually fires: a validator whose branches are never
 * driven is indistinguishable from one that returns `[]` for everything, and
 * that indistinguishability is the whole reason this file exists.
 *
 * Method: start from ONE envelope that validates clean, mutate exactly one
 * thing, and assert the specific violation appears. Every case is the valid
 * baseline plus one defect, so a passing case cannot be passing for an
 * unrelated reason — and the baseline assertion below fails loudly if the
 * fixture itself rots.
 */
import { describe, expect, it } from 'vitest';

import {
    CAPSULE_SCHEMA_VERSION,
    validateRecycleEnvelope,
} from '../../src/scripts/_lib/subagent_capsule.js';

function validEnvelope(): Record<string, unknown> {
    return {
        capsule_version: CAPSULE_SCHEMA_VERSION,
        variant: 'main_session',
        summary: 'release-surface integrity, phases 1 and 2 closed',
        task: 'close the remaining report flags',
        workspace: '/tmp/workspace',
        written_at: '2026-08-11T00:00:00.000Z',
        acceptance_criteria: ['every open step closed or cancelled with a citation'],
        remaining: ['3.4 surface prune'],
        not_carried_forward: ['the full CI verdict — re-run it'],
        decisions: ['cadence resolved to retro-curation'],
        constraints: ['no new command, flags only'],
        open_worker_envelopes: [],
        artifact_paths: ['agents/settings/contexts/carrier-divergence-109-vs-24.md'],
        assumptions: [],
        next_task: 'close 3.4',
        suggested_skills: ['roadmap-management'],
        failed_approaches: ['none'],
    };
}

/** Baseline sanity: if this ever fails, every mutation below is meaningless. */
describe('recycle envelope — the fixture itself', () => {
    it('validates clean, so each mutation isolates exactly one defect', () => {
        expect(validateRecycleEnvelope(validEnvelope())).toEqual([]);
    });
});

describe('recycle envelope — one mutation, one rejection', () => {
    it('rejects a wrong capsule_version (the version check fires)', () => {
        const e = { ...validEnvelope(), capsule_version: CAPSULE_SCHEMA_VERSION - 1 };
        expect(validateRecycleEnvelope(e)).toContain(
            `capsule_version must be ${CAPSULE_SCHEMA_VERSION}`,
        );
    });

    it('rejects a missing capsule_version — absent is not a pass', () => {
        const e = validEnvelope();
        delete e['capsule_version'];
        expect(validateRecycleEnvelope(e)).toContain(
            `capsule_version must be ${CAPSULE_SCHEMA_VERSION}`,
        );
    });

    it('rejects the wrong variant', () => {
        const e = { ...validEnvelope(), variant: 'worker' };
        expect(validateRecycleEnvelope(e)).toContain("variant must be 'main_session'");
    });

    it('rejects an unknown key — free-form additions are schema-invalid', () => {
        const e = { ...validEnvelope(), prose_summary: 'a paragraph the schema never allowed' };
        const errors = validateRecycleEnvelope(e);
        expect(errors.some((v) => v.includes('unknown field "prose_summary"'))).toBe(true);
    });

    it('rejects an unparseable written_at — the staleness guard needs a real stamp', () => {
        const e = { ...validEnvelope(), written_at: 'yesterday' };
        expect(validateRecycleEnvelope(e)).toContain(
            'written_at must be a parseable ISO-8601 timestamp',
        );
    });

    it('rejects a missing written_at', () => {
        const e = validEnvelope();
        delete e['written_at'];
        expect(validateRecycleEnvelope(e)).toContain(
            'written_at must be a parseable ISO-8601 timestamp',
        );
    });

    it('rejects empty acceptance_criteria — the successor cannot know "done"', () => {
        const e = { ...validEnvelope(), acceptance_criteria: [] };
        const errors = validateRecycleEnvelope(e);
        expect(errors.some((v) => v.includes('acceptance_criteria must carry at least one'))).toBe(
            true,
        );
    });

    it('rejects a non-object payload outright', () => {
        expect(validateRecycleEnvelope(null)).toEqual(['not an object']);
        expect(validateRecycleEnvelope([])).toEqual(['not an object']);
        expect(validateRecycleEnvelope('{}')).toEqual(['not an object']);
    });

    it('reports EVERY violation, not just the first — a partial list hides work', () => {
        const e = { ...validEnvelope(), capsule_version: 0, variant: 'worker', junk: 1 };
        const errors = validateRecycleEnvelope(e);
        expect(errors.length).toBeGreaterThanOrEqual(3);
        expect(errors.some((v) => v.startsWith('capsule_version'))).toBe(true);
        expect(errors.some((v) => v.startsWith('variant'))).toBe(true);
        expect(errors.some((v) => v.includes('unknown field "junk"'))).toBe(true);
    });
});
