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
    ACCEPTED_CAPSULE_VERSIONS,
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
        successful_approaches: ['none'],
        predecessor: 'none',
    };
}

/** Baseline sanity: if this ever fails, every mutation below is meaningless. */
describe('recycle envelope — the fixture itself', () => {
    it('validates clean, so each mutation isolates exactly one defect', () => {
        expect(validateRecycleEnvelope(validEnvelope())).toEqual([]);
    });
});

describe('recycle envelope — one mutation, one rejection', () => {
    const versionError = `capsule_version must be one of ${ACCEPTED_CAPSULE_VERSIONS.join(' | ')}`;

    it('rejects a version outside the accepted set', () => {
        const e = { ...validEnvelope(), capsule_version: 2 };
        expect(validateRecycleEnvelope(e)).toContain(versionError);
    });

    it('rejects a missing capsule_version — absent is not a pass', () => {
        const e = validEnvelope();
        delete e['capsule_version'];
        expect(validateRecycleEnvelope(e)).toContain(versionError);
    });

    // The v4 compatibility contract, pinned in both directions. v4 is the first
    // ADDITIVE bump, so a v3 record must keep validating — and it must keep
    // validating WITHOUT the fields v4 added, because demanding them of an
    // already-written record is the retroactive requirement the schema lock
    // forbids. A test that only checked "v3 is accepted" would pass against a
    // validator that had quietly made the new fields mandatory at every version.
    it('accepts a v3 record that carries none of the v4 fields', () => {
        const e = validEnvelope();
        e['capsule_version'] = 3;
        delete e['successful_approaches'];
        delete e['predecessor'];
        expect(validateRecycleEnvelope(e)).toEqual([]);
    });

    it('requires the v4 fields OF A v4 RECORD — the additive rule is version-conditional', () => {
        const e = validEnvelope();
        delete e['successful_approaches'];
        delete e['predecessor'];
        const errors = validateRecycleEnvelope(e);
        expect(errors.some((v) => v.includes('successful_approaches'))).toBe(true);
        expect(errors.some((v) => v.includes('predecessor'))).toBe(true);
    });

    it('rejects an EMPTY successful_approaches — "none" is written, never implied', () => {
        const e = { ...validEnvelope(), successful_approaches: [] };
        expect(validateRecycleEnvelope(e).some((v) => v.includes('successful_approaches'))).toBe(
            true,
        );
    });

    it('rejects an EMPTY-STRING predecessor — a stated absence is the word "none"', () => {
        const e = { ...validEnvelope(), predecessor: '' };
        expect(validateRecycleEnvelope(e).some((v) => v.includes('predecessor'))).toBe(true);
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
