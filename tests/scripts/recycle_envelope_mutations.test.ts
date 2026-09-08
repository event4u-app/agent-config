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

    it('routes a `worker` record away rather than failing it on the wrong required set', () => {
        // Changed with the `continuity_record` variant. The validator now
        // dispatches on variant BEFORE anything else, so a `worker` record —
        // which is a well-formed record of a DIFFERENT variant, not a malformed
        // main-session one — is refused by routing rather than by being
        // measured against a required set that was never its own.
        const e = { ...validEnvelope(), variant: 'worker' };
        const errors = validateRecycleEnvelope(e);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("variant 'worker'");
        expect(errors[0]).toContain('validated by the worker path');
    });

    it('refuses an UNKNOWN variant by name and runs no field checks against it', () => {
        // The council of 2026-09-07 required readers to dispatch on variant
        // before rejecting on version, and probe P2 of the transfer stub
        // recorded this branch as untestable "by construction" because no third
        // variant existed. It exists now, so the branch is reachable and pinned.
        const e = { ...validEnvelope(), variant: 'continuity_v2_speculative' };
        const errors = validateRecycleEnvelope(e);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('unknown variant');
        expect(errors[0]).toContain('no further field checks were run');
    });

    it('refusing an unknown variant does not corrupt a known one', () => {
        // The second half of P2: a reader that met an unknown variant must
        // still validate the next known record normally. Shared mutable state
        // in the validator is the way that breaks, and it is invisible unless
        // the two are exercised in sequence.
        validateRecycleEnvelope({ ...validEnvelope(), variant: 'nonesuch' });
        expect(validateRecycleEnvelope(validEnvelope())).toEqual([]);
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
        // Exhaustiveness holds WITHIN a recognised variant, which is where it
        // was always the useful property. The variant is left valid here on
        // purpose: with an unrecognised one the required set is unknown, and a
        // list of field violations measured against a guess would be noise
        // wearing completeness. That narrowing is the whole content of the
        // variant-first dispatch, so this case now pins the half that survives.
        const e = { ...validEnvelope(), capsule_version: 0, task: '', junk: 1 };
        const errors = validateRecycleEnvelope(e);
        expect(errors.length).toBeGreaterThanOrEqual(3);
        expect(errors.some((v) => v.startsWith('capsule_version'))).toBe(true);
        expect(errors.some((v) => v.startsWith('task'))).toBe(true);
        expect(errors.some((v) => v.includes('unknown field "junk"'))).toBe(true);
    });
});
