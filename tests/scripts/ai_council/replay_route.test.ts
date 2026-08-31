/**
 * The route half of decision replay — step 10.1.
 *
 * The verify clause is *"a replayed run reproduces the recorded route"*, so the
 * central assertion is a render → parse → compare round trip. Pure; no run is
 * dispatched and no artefact is read.
 *
 * The step stays UNCHECKED: `councilInternalTopology` is structurally
 * unavailable (no selector exists), so 10.1 cannot close whole.
 */
import { describe, expect, it } from 'vitest';

import { DecisionReplayInputs, render_decision_replay } from '../../../src/scripts/ai_council/replay.js';
import {
    ROUTE_FIELDS,
    auditRouteRecord,
    parseRouteSection,
    renderRouteSection,
    replayReproducesRoute,
    withRouteSection,
} from '../../../src/scripts/ai_council/replay_route.js';
import type { CouncilRouteRecord } from '../../../src/scripts/ai_council/replay_route.js';

const RECORD: CouncilRouteRecord = {
    ladderResolution: { rung: 4, verdict: 'council', reason: 'design-decision signal ("architecture decision")' },
    councilInternalTopology: null,
    initialRoute: 'dual_independent (2 members, 1 round)',
    escalation: { escalated: true, from: 'dual_independent', to: 'peer_review', reason: 'stance divergence above threshold' },
    stageOutputs: [
        { stage: 'deliberation', produced: 7, calls: 2 },
        { stage: 'peer-review', produced: 4, calls: 2 },
        { stage: 'synthesis', produced: 1, calls: 1 },
    ],
    stopReason: null,
    synthesisPolicy: 'external_judge',
    costCalls: 5,
    costUsd: 0.1234,
    latencyMs: 41230,
    finalVerdict: 'split — 1 for option A, 1 for option B',
};

const STOPPED: CouncilRouteRecord = {
    ...RECORD,
    escalation: { escalated: false, from: null, to: null, reason: 'no escalation signal' },
    stageOutputs: [],
    stopReason: 'argument exhaustion at round 2 of 3',
    synthesisPolicy: null,
};

describe('10.1 — a replay reproduces the recorded route', () => {
    it('round-trips a fully populated record', () => {
        expect(replayReproducesRoute(RECORD)).toBe(true);
        expect(parseRouteSection(renderRouteSection(RECORD))).toEqual(RECORD);
    });

    it('round-trips the stopped / no-escalation / host-synthesis shape', () => {
        expect(replayReproducesRoute(STOPPED)).toBe(true);
        expect(parseRouteSection(renderRouteSection(STOPPED))).toEqual(STOPPED);
    });

    it('distinguishes "ran to completion" from a stop reason, and null policy from a named one', () => {
        expect(renderRouteSection(RECORD)).toContain('- stop reason: (ran to completion)');
        expect(renderRouteSection(STOPPED)).toContain('- stop reason: argument exhaustion at round 2 of 3');
        expect(renderRouteSection(STOPPED)).toContain('- synthesis policy: (host synthesis)');
        expect(renderRouteSection(RECORD)).toContain('- synthesis policy: external_judge');
    });

    it('renders cost at fixed precision so the comparison is exact, not approximate', () => {
        expect(renderRouteSection(RECORD)).toContain('- cost: 5 call(s), $0.1234');
        expect(replayReproducesRoute({ ...RECORD, costUsd: 0.1 })).toBe(true);
    });

    it('DENIAL — a corrupted section does NOT round-trip, so a pass means something', () => {
        const broken = renderRouteSection(RECORD).replace('- cost: 5 call(s)', '- cost: 9 call(s)');
        expect(parseRouteSection(broken)).not.toEqual(RECORD);
        expect(parseRouteSection('## Route\n- nothing here')).toBeNull();
    });
});

describe('the ten fields 10.1 names, and the one that is unavailable', () => {
    it('carries every field the step enumerates', () => {
        expect(ROUTE_FIELDS).toEqual([
            'ladderResolution',
            'councilInternalTopology',
            'initialRoute',
            'escalation',
            'stageOutputs',
            'stopReason',
            'synthesisPolicy',
            'costCalls',
            'costUsd',
            'latencyMs',
            'finalVerdict',
        ]);
    });

    it('reports councilInternalTopology as structurally-unavailable, never as populated or missing', () => {
        const audit = auditRouteRecord(RECORD);
        expect(audit['councilInternalTopology']).toBe('structurally-unavailable');
        expect(audit['councilInternalTopology']).not.toBe('populated');
        expect(audit['councilInternalTopology']).not.toBe('missing');
    });

    it('every other field is populated on this record', () => {
        const audit = auditRouteRecord(RECORD);
        for (const f of ROUTE_FIELDS) {
            if (f !== 'councilInternalTopology') expect(audit[f]).toBe('populated');
        }
    });

    it('a null stopReason or synthesisPolicy is POPULATED — it is a value, not an absence', () => {
        expect(auditRouteRecord(STOPPED)['synthesisPolicy']).toBe('populated');
        expect(auditRouteRecord(RECORD)['stopReason']).toBe('populated');
    });

    it('reports a genuinely absent field as missing', () => {
        const { latencyMs: _dropped, ...partial } = RECORD as unknown as Record<string, unknown>;
        expect(auditRouteRecord(partial as unknown as CouncilRouteRecord)['latencyMs']).toBe('missing');
    });

    it('names the topology field as not applicable in the rendered section, rather than inventing one', () => {
        expect(renderRouteSection(RECORD)).toContain('no topology selector exists');
    });
});

describe('the existing replay renderer keeps its parity contract', () => {
    it('a body with no route record is byte-identical', () => {
        const body = render_decision_replay(
            new DecisionReplayInputs({
                findings: [],
                scores: [],
                metadata: {},
                deliberation: [],
                original_ask: 'should synthesis stay host-side?',
            }),
        );
        expect(withRouteSection(body, null)).toBe(body);
    });

    it('a route record appends and never rewrites', () => {
        const body = render_decision_replay(
            new DecisionReplayInputs({ findings: [], scores: [], metadata: {}, deliberation: [] }),
        );
        const extended = withRouteSection(body, RECORD);
        expect(extended.startsWith(body)).toBe(true);
        expect(extended.slice(body.length)).toBe(renderRouteSection(RECORD));
    });
});
