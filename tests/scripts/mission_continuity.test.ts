/**
 * `T6`, `T10`, `G15` — Phases 9.1, 10.1 and 11.1 of
 * `road-to-adversarial-verification-and-long-runs`.
 *
 * Each block asserts the direction its mechanism could plausibly have gone
 * wrong: a restore that trusts a stale grant (Risk 5), a pause that drifts into
 * an ask, and a ratification an author can perform on their own change.
 */

import { describe, expect, it } from 'vitest';

import {
    REQUIRED_PASSES,
    authorityState,
    isRatified,
    type RatificationArtefact,
} from '../../src/scripts/_lib/authority_path.js';
import {
    REPORT_FIELDS,
    renderReport,
    routeCouncil,
    type PauseContext,
} from '../../src/scripts/_lib/council_transport.js';
import {
    REQUIRED_FIELDS,
    WRITE_BOUNDARIES,
    alreadyAnswered,
    clearedBy,
    missingFields,
    restore,
    type MissionRecord,
} from '../../src/scripts/_lib/mission_record.js';

const NOW = new Date('2026-09-14T00:00:00Z');

const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
    mission_id: 'm-1',
    roadmap: 'road-to-x',
    phase: 'Phase 4',
    completed_steps: ['4.1'],
    decisions: [{ id: 'q-branch-base', where: 'agents/evidence/decisions/m-1.md' }],
    authority: { grant: 'process-full', expires: '2026-09-15T00:00:00Z', revoked_by: null },
    target_branch: 'main',
    pr: 2032,
    head_sha: 'abc123',
    last_ci: { verdict: 'green', head: 'abc123' },
    recovery_epoch: 1,
    attempt_count: 2,
    pending_reviews: [],
    owner_owned_residue: [],
    ...over,
});

describe('T6 — the continuity record', () => {
    it('carries all fourteen fields the step names', () => {
        expect(REQUIRED_FIELDS).toHaveLength(14);
        expect(missingFields(record())).toEqual([]);
    });

    it('an incomplete record names every missing field', () => {
        const partial = { mission_id: 'm-1', roadmap: 'r' };
        expect(missingFields(partial).length).toBe(12);
    });

    it('is written at each of the four boundaries', () => {
        expect(WRITE_BOUNDARIES).toEqual(['phase-boundary', 'stop', 'pre-compact', 'session-end']);
    });

    it('a side task does NOT clear it — only mission completion does', () => {
        expect(clearedBy('side-task')).toBe(false);
        expect(clearedBy('stop')).toBe(false);
        expect(clearedBy('mission-complete')).toBe(true);
    });

    it('a live grant resumes, and the closed questions come back with it', () => {
        const v = restore(record(), { grant: 'process-full', revoked_by: null }, NOW);
        expect(v.state).toBe('resume');
        expect(v.closed).toEqual(['q-branch-base']);
    });

    it('never re-asks a closed question', () => {
        expect(alreadyAnswered(record(), 'q-branch-base')).toBe(true);
        expect(alreadyAnswered(record(), 'q-never-asked')).toBe(false);
    });

    it('Risk 5 — the LEDGER revokes a grant the snapshot still shows as live', () => {
        // The snapshot was written before the revocation. A restore that trusted
        // it would resume with authority the owner withdrew.
        const v = restore(record(), { grant: 'process-full', revoked_by: 'owner' }, NOW);
        expect(v.state).toBe('authority-withdrawn');
        expect(v.reason).toMatch(/after the snapshot was written/);
    });

    it('the ledger cannot REVIVE a grant the record shows revoked', () => {
        // One direction only — a ledger that could un-revoke would make the
        // revocation advisory.
        const revoked = record({
            authority: { grant: 'process-full', expires: null, revoked_by: 'owner' },
        });
        expect(restore(revoked, { grant: 'process-full', revoked_by: null }, NOW).state).toBe(
            'authority-withdrawn',
        );
    });

    it('an expired grant does not resume', () => {
        const past = record({
            authority: { grant: 'process-full', expires: '2026-01-01T00:00:00Z', revoked_by: null },
        });
        expect(restore(past, null, NOW).state).toBe('authority-expired');
    });

    it('an UNPARSEABLE expiry is expired, not unlimited', () => {
        const bad = record({
            authority: { grant: 'process-full', expires: 'soon', revoked_by: null },
        });
        expect(restore(bad, null, NOW).state).toBe('authority-expired');
    });

    it('a grant with no expiry resumes', () => {
        const forever = record({
            authority: { grant: 'process-full', expires: null, revoked_by: null },
        });
        expect(restore(forever, null, NOW).state).toBe('resume');
    });

    it('a ledger describing a DIFFERENT grant does not resume', () => {
        // `restore` used to read `revoked_by` and never compare the grant names,
        // so a record under grant A resumed on grant B's silence — using the
        // ledger as an oracle for a question it was never asked. Red before the
        // fix, which returned `resume`.
        const v = restore(record(), { grant: 'some-other-grant', revoked_by: null }, NOW);
        expect(v.state).toBe('grant-mismatch');
        expect(v.reason).toMatch(/not about the same grant/);
    });

    it('a record naming NO grant does not resume, whatever the ledger says', () => {
        // A mission running under an unnamed grant is not running under a grant,
        // and two empty strings comparing equal is not agreement.
        const unnamed = record({ authority: { grant: '', expires: null, revoked_by: null } });
        expect(restore(unnamed, { grant: '', revoked_by: null }, NOW).state).toBe('grant-mismatch');
        expect(restore(unnamed, null, NOW).state).toBe('grant-mismatch');
    });

    it('the identity check does not weaken the one-way revoke precedence', () => {
        // Identity runs first, so it must not swallow either revoke path when the
        // two sides DO agree. Both directions re-asserted at the new ordering.
        const sameGrant = { grant: 'process-full', revoked_by: 'owner' } as const;
        expect(restore(record(), sameGrant, NOW).state).toBe('authority-withdrawn');
        const revoked = record({
            authority: { grant: 'process-full', expires: null, revoked_by: 'owner' },
        });
        expect(restore(revoked, { grant: 'process-full', revoked_by: null }, NOW).state).toBe(
            'authority-withdrawn',
        );
    });
});

describe('T10 — an over-ceiling council requirement reports, never asks', () => {
    const ctx: PauseContext = {
        needed: 'an independent verdict on the authority diff',
        missionState: 'Phase 11, 2 of 3 steps closed',
        canStillProceed: ['Phase 9 continuity work', 'the CI fix loop'],
    };

    it('routes to the CLI when it is available', () => {
        expect(
            routeCouncil(
                { cliAvailable: true, cliUnavailableReason: null, estimateUsd: 99, ceilingUsd: 1 },
                ctx,
            ).route,
        ).toBe('cli');
    });

    it('routes to the API when the CLI is out and the estimate fits', () => {
        const d = routeCouncil(
            { cliAvailable: false, cliUnavailableReason: 'quota exhausted', estimateUsd: 3, ceilingUsd: 25 },
            ctx,
        );
        expect(d.route).toBe('api');
        expect(d.reason).toContain('quota exhausted');
    });

    it('an estimate exactly AT the ceiling is within it', () => {
        // A limit, not an exclusive bound — the other reading pauses a run that
        // budgeted exactly.
        expect(
            routeCouncil(
                { cliAvailable: false, cliUnavailableReason: 'x', estimateUsd: 25, ceilingUsd: 25 },
                ctx,
            ).route,
        ).toBe('api');
    });

    it('T10 — over the ceiling produces a report with all six fields', () => {
        const d = routeCouncil(
            { cliAvailable: false, cliUnavailableReason: 'quota exhausted', estimateUsd: 40, ceilingUsd: 25 },
            ctx,
        );
        expect(d.route).toBe('paused');
        expect(d.report).not.toBeNull();
        for (const f of REPORT_FIELDS) expect(d.report?.[f]).not.toBeUndefined();
    });

    it('the rendered report contains NO question — not one', () => {
        // The failure mode is a report drifting into an ask one helpful sentence
        // at a time, so the absence is asserted rather than trusted.
        const d = routeCouncil(
            { cliAvailable: false, cliUnavailableReason: 'quota exhausted', estimateUsd: 40, ceilingUsd: 25 },
            ctx,
        );
        const text = renderReport(d.report as never);
        expect(text).not.toContain('?');
        expect(text).toContain('Proceeding meanwhile with:');
    });

    it('"nothing can proceed" is a real reportable answer, not an empty section', () => {
        const d = routeCouncil(
            { cliAvailable: false, cliUnavailableReason: 'x', estimateUsd: 40, ceilingUsd: 1 },
            { ...ctx, canStillProceed: [] },
        );
        expect(renderReport(d.report as never)).toMatch(/blocked on this council pass alone/);
    });
});

describe('G15 — new authority is inert until ratified', () => {
    const full = (over: Partial<RatificationArtefact> = {}): RatificationArtefact => ({
        verdict: 'ratified',
        author: 'agent-a',
        passes: [
            { pass: 'independent-test-author', by: 'b', provider: 'p1' },
            { pass: 'independent-governance-reviewer', by: 'c', provider: 'p2' },
            { pass: 'council', by: 'd', provider: 'p1' },
            { pass: 'provider-diverse-reviewer', by: 'e', provider: 'p2' },
        ],
        ...over,
    });

    it('a complete, ratified artefact activates', () => {
        expect(isRatified(full())).toBe(true);
    });

    it('NO artefact is inert', () => {
        const v = authorityState(null);
        expect(v.state).toBe('inert');
        expect(v.blockers).toEqual(['no ratification artefact exists']);
    });

    it.each(REQUIRED_PASSES)('a missing %s leaves it inert', (missing) => {
        const a = full({ passes: full().passes.filter((p) => p.pass !== missing) });
        const v = authorityState(a);
        expect(v.state).toBe('inert');
        expect(v.blockers.join(' ')).toContain(missing);
    });

    it('an unratified verdict leaves it inert however complete the passes', () => {
        expect(authorityState(full({ verdict: 'pending' })).state).toBe('inert');
    });

    it('the AUTHOR may perform none of the four — ADR-268 § 4', () => {
        // The clause a process satisfies on paper while violating in substance.
        const a = full({
            passes: full().passes.map((p) =>
                p.pass === 'council' ? { ...p, by: 'agent-a' } : p,
            ),
        });
        const v = authorityState(a);
        expect(v.state).toBe('inert');
        expect(v.blockers.join(' ')).toMatch(/may not ratify its own increase in power/);
    });

    it('provider diversity is checked over the SET, not trusted from a name', () => {
        const a = full({ passes: full().passes.map((p) => ({ ...p, provider: 'p1' })) });
        const v = authorityState(a);
        expect(v.state).toBe('inert');
        expect(v.blockers.join(' ')).toMatch(/provider-diverse means at least two/);
    });

    it('reports EVERY blocker — an artefact is a checklist, not a round trip', () => {
        const v = authorityState({ verdict: 'draft', author: 'a', passes: [] });
        expect(v.blockers.length).toBeGreaterThanOrEqual(5);
    });
});
