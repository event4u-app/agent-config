import { describe, expect, it } from 'vitest';

import { buildArrivalRecord } from '../../src/scripts/_lib/arrival_record.js';
import { classifyInstructionsLoaded } from '../../src/scripts/_lib/instructions_loaded_event.js';
import { FORM_REASONS, decideLayerForm, type FormReason, type LayerFormInput } from '../../src/scripts/_lib/layer_form_decision.js';
import { declareLayerForm, withMachineEvidence, type MachineEvidence } from '../../src/scripts/_lib/layer_form_evidence.js';

const HOME = '/home/dev';
const ENV = { AI_AGENT: 'claude-code_2-1-299_agent' } as NodeJS.ProcessEnv;
const load = (id: string, ts: string) =>
    classifyInstructionsLoaded(
        { session_id: 's1', file_path: `${HOME}/.claude/rules/${id}.md`, load_reason: 'session_start' },
        { ts, home: HOME, env: ENV },
    );
const RECORD = buildArrivalRecord([load('law-a', '2026-10-18T00:00:01Z'), load('other', '2026-10-18T00:00:02Z')], 's1');

const SHIPPED: LayerFormInput = {
    host: 'claude-code',
    hostVersion: null,
    packageVersion: '1.0.0',
    deliveryObserved: true,
    arrival: null,
    carrierProbe: 'unknown',
    demoted: false,
    payloadVersion: 'v1',
    layerVersion: 'v1',
    brakes: [],
    userPin: false,
};

const MACHINE: MachineEvidence = {
    arrival: RECORD,
    carrier: { layer: 'full', probe: { host: 'claude', outcome: 'reached', date: '2026-10-18', version: '1.0.0' } },
    userPin: false,
    hostVersion: '2.1.299',
    standingLaws: new Set(['law-a']),
};

describe('withMachineEvidence', () => {
    it('feeds the claude layer the arrival record, the carrier probe and demotion', () => {
        const input = withMachineEvidence(SHIPPED, MACHINE);
        expect(input.arrival).toEqual({ hostVersion: '2.1.299', stubsLoaded: true, standingLawsLoaded: true });
        expect(input.carrierProbe).toBe('pass');
        expect(decideLayerForm(input)).toEqual({ form: 'thinned', reason: 'all-conditions-hold' });
    });

    it('a dead carrier, a demotion, a missing law or a terminal launch each keep the layer full', () => {
        const dead = { ...MACHINE, carrier: { layer: 'full' as const, probe: { ...MACHINE.carrier.probe!, outcome: 'not-reached' as const } } };
        expect(decideLayerForm(withMachineEvidence(SHIPPED, dead)).reason).toBe('carrier-probe-not-passing');
        const demoted = { ...MACHINE, carrier: { ...MACHINE.carrier, layer: 'demoted' as const } };
        expect(decideLayerForm(withMachineEvidence(SHIPPED, demoted)).reason).toBe('demoted');
        const lawMissing = { ...MACHINE, standingLaws: new Set(['law-a', 'law-b']) };
        expect(decideLayerForm(withMachineEvidence(SHIPPED, lawMissing)).reason).toBe('arrival-standing-law-missing');
        expect(decideLayerForm(withMachineEvidence(SHIPPED, { ...MACHINE, hostVersion: null })).reason).toBe(
            'arrival-host-version-mismatch',
        );
    });

    it('the install --full pin covers every host', () => {
        for (const host of ['claude-code', 'cursor', 'cline']) {
            expect(decideLayerForm(withMachineEvidence({ ...SHIPPED, host }, { ...MACHINE, userPin: true })).reason).toBe('user-pin');
        }
    });

    it('the claude record never becomes evidence for another host', () => {
        expect(withMachineEvidence({ ...SHIPPED, host: 'cursor' }, MACHINE).arrival).toBeNull();
    });
});

describe('the declaration doctor prints (step 3.7)', () => {
    const inputFor: Record<FormReason, LayerFormInput> = {
        'user-pin': { ...SHIPPED, userPin: true },
        'release-brake': { ...SHIPPED, brakes: [{ host: 'claude-code', package_version: '1.0.0', reason: 'x' }] },
        'host-not-thinnable': { ...SHIPPED, host: 'copilot' },
        'delivery-unobserved': { ...SHIPPED, deliveryObserved: false },
        'no-arrival-record': SHIPPED,
        'arrival-host-version-mismatch': { ...SHIPPED, hostVersion: '9', arrival: { hostVersion: '8', stubsLoaded: true, standingLawsLoaded: true } },
        'arrival-stubs-missing': { ...SHIPPED, hostVersion: '8', arrival: { hostVersion: '8', stubsLoaded: false, standingLawsLoaded: true } },
        'arrival-standing-law-missing': { ...SHIPPED, hostVersion: '8', arrival: { hostVersion: '8', stubsLoaded: true, standingLawsLoaded: false } },
        'carrier-probe-not-passing': { ...SHIPPED, hostVersion: '8', arrival: { hostVersion: '8', stubsLoaded: true, standingLawsLoaded: true } },
        demoted: { ...SHIPPED, hostVersion: '8', arrival: { hostVersion: '8', stubsLoaded: true, standingLawsLoaded: true }, carrierProbe: 'pass', demoted: true },
        'version-skew': { ...SHIPPED, hostVersion: '8', arrival: { hostVersion: '8', stubsLoaded: true, standingLawsLoaded: true }, carrierProbe: 'pass', layerVersion: null },
        'all-conditions-hold': { ...SHIPPED, hostVersion: '8', arrival: { hostVersion: '8', stubsLoaded: true, standingLawsLoaded: true }, carrierProbe: 'pass' },
    };

    for (const reason of FORM_REASONS) {
        it(`names ${reason}`, () => {
            const decision = decideLayerForm(inputFor[reason]);
            expect(decision.reason).toBe(reason);
            const lines = declareLayerForm([{ host: inputFor[reason].host, decision }], MACHINE);
            expect(lines[0]).toBe(`${inputFor[reason].host} would-be: ${decision.form} (${reason})`);
        });
    }

    it('states the last arrival record and the layer on disk, or that there is none', () => {
        const lines = declareLayerForm([], { ...MACHINE, userPin: true });
        expect(lines).toEqual([
            'last arrival record: session s1, host version 2.1.299, visible',
            'claude layer on disk: full · pinned full by install --full',
        ]);
        expect(declareLayerForm([], { ...MACHINE, arrival: null })[0]).toContain('has not seen a session');
    });
});
