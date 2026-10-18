/**
 * The machine half of the layer-form evidence, and the declaration `doctor`
 * prints from it.
 *
 * {@link gatherShippedEvidence} reads the two shipped tables; this adds what
 * only the machine knows: the last arrival record, the carrier probe and
 * demotion state under `<machine root>/runtime/`, and the `install --full` pin.
 * The arrival record and carrier state describe the claude layer only, so they
 * feed `claude-code` alone; the pin covers every host, because it is a brake on
 * the machine.
 *
 * The current host version is read from the environment the host exposes to
 * its hooks. A `doctor` run from a plain terminal has none, so there the
 * decision reads a version mismatch and stays full — a terminal is not the
 * launch context the record was taken in, which is the point of comparing them.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { readCarrierState, runtimeRootFor, type CarrierState } from '../../install/stagedRuntime.js';
import { readUserPin } from '../../install/userPin.js';
import { arrivalEvidence, arrivalsFileUnder, latestArrivalRecord, readObserverLines, type ArrivalRecord } from './arrival_record.js';
import { hostVersionFromEnv } from './instructions_loaded_event.js';
import { THINNABLE_HOSTS } from './lean_projection_mode.js';
import { decideLayerForm, gatherShippedEvidence, type LayerFormDecision, type LayerFormInput } from './layer_form_decision.js';
import { readConsequenceClass } from './rule_consequence_class.js';

export interface MachineEvidence {
    readonly arrival: ArrivalRecord | null;
    readonly carrier: CarrierState;
    readonly userPin: boolean;
    readonly hostVersion: string | null;
    readonly standingLaws: ReadonlySet<string>;
}

export function readMachineEvidence(packageRoot: string, env: NodeJS.ProcessEnv = process.env): MachineEvidence {
    const runtimeRoot = runtimeRootFor(env);
    let standingLaws: ReadonlySet<string> = new Set();
    try {
        standingLaws = new Set(Object.keys(readConsequenceClass(packageRoot).members));
    } catch {
        // A sentinel no rule file can be named, so an unreadable class can never read as "every law loaded".
        standingLaws = new Set(['<consequence-class unreadable>']);
    }
    return {
        arrival: latestArrivalRecord(readObserverLines(arrivalsFileUnder(runtimeRoot))),
        carrier: readCarrierState(runtimeRoot),
        userPin: readUserPin(runtimeRoot) !== null,
        hostVersion: hostVersionFromEnv(env),
        standingLaws,
    };
}

/** Overlay the machine evidence onto one host's shipped input. */
export function withMachineEvidence(shipped: LayerFormInput, m: MachineEvidence): LayerFormInput {
    const base = { ...shipped, userPin: m.userPin };
    if (shipped.host !== 'claude-code') return base;
    const probe = m.carrier.probe;
    return {
        ...base,
        hostVersion: m.hostVersion,
        arrival: arrivalEvidence(m.arrival, m.standingLaws),
        carrierProbe: probe === null ? 'unknown' : probe.outcome === 'reached' ? 'pass' : 'fail',
        demoted: m.carrier.layer === 'demoted',
    };
}

export interface HostDeclaration {
    readonly host: string;
    readonly decision: LayerFormDecision;
}

/**
 * The step-3.7 declaration: per host the shadow form and its reason code, then
 * the last arrival record and the claude layer's state on disk.
 */
export function declareLayerForm(decisions: readonly HostDeclaration[], m: MachineEvidence): string[] {
    const lines = decisions.map((d) => `${d.host} would-be: ${d.decision.form} (${d.decision.reason})`);
    const a = m.arrival;
    lines.push(
        a === null
            ? 'last arrival record: none — the InstructionsLoaded observer has not seen a session on this machine'
            : `last arrival record: session ${a.session}, host version ${a.host_version ?? 'unknown'}, ${a.status}${a.unknown_reason ? ` (${a.unknown_reason})` : ''}`,
    );
    lines.push(`claude layer on disk: ${m.carrier.layer}${m.userPin ? ' · pinned full by install --full' : ''}`);
    return lines;
}

/** The doctor entry point: shipped tables plus machine evidence, at the installed package's version. */
export function layerFormDoctorCheck(packageRoot: string, env: NodeJS.ProcessEnv = process.env): {
    id: string;
    status: 'ok';
    message: string;
    remedy: string;
} {
    let version = 'unknown';
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8')) as { version?: unknown };
        if (typeof raw.version === 'string' && raw.version.trim()) version = raw.version.trim();
    } catch {
        // An unreadable package.json leaves the version unknown; no package-version brake row can match it.
    }
    const shipped = gatherShippedEvidence(packageRoot, version);
    const m = readMachineEvidence(packageRoot, env);
    const decisions = THINNABLE_HOSTS.map((host) => ({ host, decision: decideLayerForm(withMachineEvidence(shipped(host), m)) }));
    return {
        id: 'layer-form',
        status: 'ok',
        message: `shadow decision, nothing on disk changed — ${declareLayerForm(decisions, m).join(' · ')}`,
        remedy: '',
    };
}
