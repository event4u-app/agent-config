/**
 * Which form a rule layer takes on one host and machine — `full` or `thinned` —
 * computed from evidence, never read from a settings key
 * (road-to-a-setup-that-decides-itself step 3.1).
 *
 * FULL IS THE ANSWER TO EVERY QUESTION THAT IS NOT ANSWERED. `thinned` is
 * returned only when every condition holds; the first condition that fails
 * names the reason code, so `doctor` can say why a machine stayed full without a
 * second reader re-deriving it. The order of the checks is the order of the
 * reasons below and is part of the contract: a test pins that each condition
 * failing ALONE yields `full` with its own code.
 *
 * NO SETTINGS KEY IS READ HERE, AND NONE MAY BE. The `lean_projection.mode`
 * module records the failure this exists to remove: a concern read a settings
 * file that does not exist on a normal install and closed its own gate while
 * thin stubs were on disk. The caller gathers the evidence; this function only
 * weighs it, and holds no I/O of its own beyond the brake-table loader.
 *
 * TWO INPUTS DO NOT EXIST YET, AND THEIR ABSENCE IS `full`. The arrival record
 * (step 2.1) and the carrier probe (road-to-a-hook-carrier-that-is-never-silent
 * step 2.2) are typed here as the minimum this function needs from them. Until a
 * producer exists the caller passes `null` / `'unknown'`, which is the shipped
 * behaviour: every machine stays on today's full form.
 *
 * `deliveryObserved` IS STRICTER THAN THE STEP'S WORDING, DELIBERATELY. The step
 * asks for "delivery mechanics observed" in `host-injection-effect.json`, but
 * that record carries one axis, the behavioural effect; it has no mechanics
 * field. {@link deliveryObservedFor} therefore requires `observed-true`, which
 * no host carries today. A stricter reading can only keep a machine full, never
 * thin one that should not be.
 *
 * PER RULE, TWO CLASSES ARE NEVER THINNED under any input: the consequence class
 * (`src/config/rule-consequence-class.json`) and the `safety-floor` tier.
 * {@link ruleForm} applies that after the layer decision, so a `thinned` layer
 * still carries those rules in full.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { THINNABLE_HOSTS } from './lean_projection_mode.js';
import { loadRecord, stateFor, type InjectionRecord } from './injection_effect.js';

export type LayerForm = 'full' | 'thinned';

/** Reason codes, in check order. `all-conditions-hold` is the only `thinned` one. */
export const FORM_REASONS = [
    'user-pin',
    'release-brake',
    'host-not-thinnable',
    'delivery-unobserved',
    'no-arrival-record',
    'arrival-host-version-mismatch',
    'arrival-stubs-missing',
    'arrival-standing-law-missing',
    'carrier-probe-not-passing',
    'demoted',
    'version-skew',
    'all-conditions-hold',
] as const;
export type FormReason = (typeof FORM_REASONS)[number];

/** The minimum the step-2.1 arrival record must supply. Names and booleans only. */
export interface ArrivalEvidence {
    readonly hostVersion: string;
    readonly stubsLoaded: boolean;
    readonly standingLawsLoaded: boolean;
}

/** One release-brake row (step 3.4): forces `full`, maintainer-owned, never a consumer surface. */
export interface ReleaseBrakeRow {
    readonly host: string;
    /** Matches this host version exactly. At least one of the two versions is set. */
    readonly host_version?: string;
    /** Matches this package version exactly. */
    readonly package_version?: string;
    readonly reason: string;
}

export interface LayerFormInput {
    /** Package host id, as in {@link THINNABLE_HOSTS}. */
    readonly host: string;
    readonly hostVersion: string | null;
    readonly packageVersion: string;
    readonly deliveryObserved: boolean;
    readonly arrival: ArrivalEvidence | null;
    readonly carrierProbe: 'pass' | 'fail' | 'unknown';
    readonly demoted: boolean;
    /** Version of the staged payload and of the layer on disk; both must be known and equal. */
    readonly payloadVersion: string | null;
    readonly layerVersion: string | null;
    readonly brakes: readonly ReleaseBrakeRow[];
    /** The step-3.5 receipt field written by `install --full`. */
    readonly userPin: boolean;
}

export interface LayerFormDecision {
    readonly form: LayerForm;
    readonly reason: FormReason;
}

function full(reason: FormReason): LayerFormDecision {
    return { form: 'full', reason };
}

/** True when a brake row covers this host and either its host or its package version. */
export function brakeApplies(
    row: ReleaseBrakeRow,
    host: string,
    hostVersion: string | null,
    packageVersion: string,
): boolean {
    if (row.host !== host) return false;
    const byHost = row.host_version !== undefined && hostVersion !== null && row.host_version === hostVersion;
    const byPackage = row.package_version !== undefined && row.package_version === packageVersion;
    return byHost || byPackage;
}

/** Decide the form of one layer. Pure; the first failing condition names the reason. */
export function decideLayerForm(input: LayerFormInput): LayerFormDecision {
    if (input.userPin) return full('user-pin');
    if (input.brakes.some((b) => brakeApplies(b, input.host, input.hostVersion, input.packageVersion))) {
        return full('release-brake');
    }
    if (!THINNABLE_HOSTS.includes(input.host)) return full('host-not-thinnable');
    if (!input.deliveryObserved) return full('delivery-unobserved');
    const a = input.arrival;
    if (a === null) return full('no-arrival-record');
    if (input.hostVersion === null || a.hostVersion !== input.hostVersion) {
        return full('arrival-host-version-mismatch');
    }
    if (!a.stubsLoaded) return full('arrival-stubs-missing');
    if (!a.standingLawsLoaded) return full('arrival-standing-law-missing');
    if (input.carrierProbe !== 'pass') return full('carrier-probe-not-passing');
    if (input.demoted) return full('demoted');
    if (input.payloadVersion === null || input.layerVersion === null || input.payloadVersion !== input.layerVersion) {
        return full('version-skew');
    }
    return { form: 'thinned', reason: 'all-conditions-hold' };
}

/** The rules a thinned layer still carries in full, whatever the layer decision. */
export interface NeverThinned {
    readonly consequenceClass: ReadonlySet<string>;
    readonly safetyFloor: ReadonlySet<string>;
}

/** Form of one rule inside a decided layer. */
export function ruleForm(ruleId: string, layer: LayerFormDecision, never: NeverThinned): LayerForm {
    if (never.consequenceClass.has(ruleId) || never.safetyFloor.has(ruleId)) return 'full';
    return layer.form;
}

/**
 * Host-id spelling of the effect record. The record names the first host
 * `claude`; the package names it `claude-code`. A host with no mapping is looked
 * up under its own id and, absent there, reads `unobserved`.
 */
const EFFECT_RECORD_KEY: Readonly<Record<string, string>> = { 'claude-code': 'claude' };

export function deliveryObservedFor(rec: InjectionRecord, host: string): boolean {
    return stateFor(rec, EFFECT_RECORD_KEY[host] ?? host) === 'observed-true';
}

export const BRAKES_REL = path.join('src', 'config', 'layer-form-brakes.json');

/**
 * Load the shipped brake table. An unreadable or malformed file yields a single
 * catch-all row per thinnable host — a brake that cannot be read is a brake that
 * is ON, because the table exists to force `full` and failing open would invert
 * it.
 */
export function loadBrakes(root: string, packageVersion: string): ReleaseBrakeRow[] {
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(root, BRAKES_REL), 'utf-8')) as { rows?: unknown };
        if (!Array.isArray(raw.rows)) throw new Error('rows is not an array');
        return raw.rows.map((r: unknown) => {
            const o = r as Record<string, unknown>;
            const hv = o['host_version'];
            const pv = o['package_version'];
            if (typeof o['host'] !== 'string' || typeof o['reason'] !== 'string') throw new Error('bad row');
            if (typeof hv !== 'string' && typeof pv !== 'string') throw new Error('row names no version');
            return {
                host: o['host'],
                reason: o['reason'],
                ...(typeof hv === 'string' ? { host_version: hv } : {}),
                ...(typeof pv === 'string' ? { package_version: pv } : {}),
            };
        });
    } catch {
        return THINNABLE_HOSTS.map((host) => ({
            host,
            package_version: packageVersion,
            reason: `${BRAKES_REL} unreadable — brake held on`,
        }));
    }
}

/**
 * Evidence the shadow run can gather TODAY (step 3.2): the two shipped tables
 * and the package version. The arrival record, the carrier probe, demotion
 * state and the layer's own version have no producer yet, so they are passed
 * as absent — which is why every host reads `full` until those land.
 */
export function gatherShippedEvidence(
    packageRoot: string,
    packageVersion: string,
): (host: string) => LayerFormInput {
    const rec = loadRecord(packageRoot);
    const brakes = loadBrakes(packageRoot, packageVersion);
    return (host) => ({
        host,
        hostVersion: null,
        packageVersion,
        deliveryObserved: deliveryObservedFor(rec, host),
        arrival: null,
        carrierProbe: 'unknown',
        demoted: false,
        payloadVersion: null,
        layerVersion: null,
        brakes,
        userPin: false,
    });
}

/**
 * The `doctor` record for the shadow decision. SHADOW, NOT ACTION: it computes
 * and prints `would-be: <form> (<reason>)` per thinnable host and touches no
 * file — the layer on disk is whatever install wrote, until step 5.3 enables
 * promotion. Always `ok`: a machine staying full is today's behaviour, not a
 * fault.
 */
export function shadowLayerFormCheck(gather: (host: string) => LayerFormInput): {
    id: string;
    status: 'ok';
    message: string;
    remedy: string;
} {
    const parts = THINNABLE_HOSTS.map((host) => {
        const d = decideLayerForm(gather(host));
        return `${host} would-be: ${d.form} (${d.reason})`;
    });
    return {
        id: 'layer-form',
        status: 'ok',
        message: `shadow decision, nothing on disk changed — ${parts.join(' · ')}`,
        remedy: '',
    };
}
