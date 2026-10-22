/**
 * `classifyUpdate` — what an update from `installed` to `candidate` should do on
 * this machine: install it (`auto`), ask first (`ask`), tell the user (`notify`),
 * nothing (`none`), or `action` — this machine cannot run the candidate until the
 * user changes it (its `engines.node`), so it is never installed, not even on an
 * approval. Every verdict carries the reasons that produced it.
 *
 * Pure by contract: no filesystem, no network, no process state. The caller
 * gathers the inputs — the cached registry document, the running Node version, the
 * install origin `classify_install_origin` already detects — and this only
 * decides. `doctor --json` reports the verdict read-only (`update_verdict`), the surface it is
 * meant to be reported on.
 *
 * The one invariant everything else serves: uncertainty of any kind never
 * resolves to `auto`.
 */
import { CONSUMER_IMPACT_VALUES, type ConsumerImpact } from './consumer_impact';
import type { InstallOrigin as RunningOrigin } from './update_check';
import { compare_versions, node_engine_satisfied, parse_version } from './version_order';

export type UpdateAction = 'auto' | 'ask' | 'notify' | 'none' | 'action';
/** The running install as `classify_install_origin` reports it, plus a source checkout. */
export type InstallOrigin = RunningOrigin | 'source-checkout';
export type UpdateMode = 'off' | 'notify' | 'ask' | 'auto';

export interface ClassifyUpdateInput {
    readonly installed: string;
    readonly candidate: string;
    readonly origin: InstallOrigin;
    readonly env: {
        readonly ci: boolean;
        readonly interactive: boolean;
        readonly noUpdateCheck: boolean;
        /** The Node version of the machine the update would run on, `v`-prefixed. */
        readonly nodeVersion: string;
        /** ISO-8601 instant the decision is made at. */
        readonly now: string;
    };
    /** The `agentConfig.impact` block of the candidate's registry document — untrusted. */
    readonly impactMap: unknown;
    /** The candidate's `engines` block — untrusted. */
    readonly engines: unknown;
    readonly publishedAt: string | null;
    readonly deprecated: unknown;
    /** True only when the registry document carried a provenance attestation. */
    readonly provenance: boolean | null;
    readonly settings: {
        readonly mode?: UpdateMode | undefined;
        readonly projectPin?: string | null;
        readonly minReleaseAgeHours?: number;
    };
}

export interface UpdateVerdict {
    readonly action: UpdateAction;
    readonly reasons: readonly string[];
}

interface RangeImpact {
    readonly forged: string | null;
    readonly worst: ConsumerImpact | null;
    readonly security: boolean;
}

function read_impact_range(map: unknown, installed: string, candidate: string): RangeImpact | null {
    if (map === null || map === undefined) return null;
    if (typeof map !== 'object' || Array.isArray(map)) {
        return { forged: 'impact map is not an object', worst: null, security: false };
    }
    const rank = (i: ConsumerImpact): number => CONSUMER_IMPACT_VALUES.indexOf(i);
    let worst: ConsumerImpact | null = null;
    let security = false;
    for (const [version, entry] of Object.entries(map as Record<string, unknown>)) {
        if (parse_version(version) === null) return { forged: `impact map key '${version}' is not a version`, worst, security };
        if (entry === null || typeof entry !== 'object') {
            return { forged: `impact map entry ${version} is not an object`, worst, security };
        }
        const impact = (entry as Record<string, unknown>)['impact'];
        if (!(CONSUMER_IMPACT_VALUES as readonly unknown[]).includes(impact)) {
            return { forged: `impact map entry ${version} has impact '${String(impact)}'`, worst, security };
        }
        if (compare_versions(version, installed) !== 1 || compare_versions(version, candidate) === 1) continue;
        if (worst === null || rank(impact as ConsumerImpact) > rank(worst)) worst = impact as ConsumerImpact;
        security = security || (entry as Record<string, unknown>)['security'] === true;
    }
    return { forged: null, worst, security };
}

/**
 * The local machine overrides the published map: a candidate whose
 * `engines.node` this runtime does not satisfy — or that cannot be checked —
 * is `action` here whatever the map says. No `engines.node` at all, or a
 * prerelease runtime, is an unknown, not an override.
 */
export function machine_override(
    engines: unknown,
    nodeVersion: string,
): { impact: 'action'; reason: string } | { impact: null; reason: string | null } {
    const range = engines !== null && typeof engines === 'object' ? (engines as Record<string, unknown>)['node'] : undefined;
    if (range === undefined) return { impact: null, reason: 'candidate declares no engines.node' };
    if ((parse_version(nodeVersion)?.pre.length ?? 0) > 0) return { impact: null, reason: `running Node ${nodeVersion} is a prerelease` };
    const ok = node_engine_satisfied(range, nodeVersion);
    if (ok === true) return { impact: null, reason: null };
    const why = ok === false ? 'is not satisfied by' : 'cannot be checked against';
    return { impact: 'action', reason: `engines.node '${String(range)}' ${why} ${nodeVersion}` };
}

function suppression(input: ClassifyUpdateInput): string | null {
    if (input.env.ci) return 'suppressed: CI';
    if (!input.env.interactive) return 'suppressed: non-interactive';
    if (input.origin === 'source-checkout') return 'suppressed: source checkout';
    if (input.origin === 'ephemeral') return 'suppressed: ephemeral npx run has nothing to update';
    if (input.env.noUpdateCheck) return 'suppressed: AGENT_CONFIG_NO_UPDATE_CHECK=1';
    if (input.settings.mode === 'off') return 'suppressed: mode off';
    return null;
}

export function classifyUpdate(input: ClassifyUpdateInput): UpdateVerdict {
    const suppressed = suppression(input);
    if (suppressed !== null) return { action: 'none', reasons: [suppressed] };

    const order = compare_versions(input.candidate, input.installed);
    if (order === null) return { action: 'none', reasons: ['unparseable version: no action'] };
    if (order !== 1) return { action: 'none', reasons: [`candidate ${input.candidate} is not newer than ${input.installed}`] };

    const ask: string[] = [];
    const uncertain: string[] = [];

    const local = machine_override(input.engines, input.env.nodeVersion);
    if (local.impact === 'action') return { action: 'action', reasons: [local.reason] };
    if (local.reason !== null) uncertain.push(local.reason);

    const range = read_impact_range(input.impactMap, input.installed, input.candidate);
    const security = range?.security === true;
    const waits: string[] = [];
    if (input.deprecated === true || (typeof input.deprecated === 'string' && input.deprecated !== '')) {
        waits.push('wait: candidate is deprecated');
    }
    const gateHours = input.settings.minReleaseAgeHours ?? 0;
    // `NaN > 0` is false, so an unreadable gate would otherwise read as no gate.
    if (!Number.isFinite(gateHours)) uncertain.push('release-age gate is not a number');
    else if (gateHours > 0) {
        const published = input.publishedAt === null ? NaN : Date.parse(input.publishedAt);
        const now = Date.parse(input.env.now);
        if (Number.isNaN(published) || Number.isNaN(now)) uncertain.push('publish time unknown under a release-age gate');
        else if (now - published < gateHours * 3_600_000) waits.push(`wait: published less than ${gateHours} h ago`);
    }
    if (waits.length > 0) {
        return security ? { action: 'notify', reasons: [...waits, 'security fix in range'] } : { action: 'none', reasons: waits };
    }

    if (range === null) uncertain.push('impact map unavailable');
    else if (range.forged !== null) ask.push(`untrusted impact map: ${range.forged}`);
    else if (range.worst === 'action') ask.push('a release in range needs consumer action');
    if (ask.length > 0) return { action: 'ask', reasons: ask };

    const notify: string[] = [];
    if (range?.worst === 'notice') notify.push('a release in range carries a notice');
    if (security) notify.push('security fix in range');
    if (input.provenance !== true) uncertain.push('provenance attestation missing');
    if (input.settings.projectPin) uncertain.push(`project pins ${input.settings.projectPin}`);
    else if (input.origin === 'project-pin') uncertain.push('install is pinned by the project');
    if (input.origin === 'unknown') uncertain.push('install origin unknown');
    if (parse_version(input.candidate)!.pre.length > 0) uncertain.push('candidate is a prerelease');
    if (input.settings.mode === undefined) uncertain.push('update mode not set');

    const blocking = [...uncertain, ...(range?.worst === 'notice' ? notify : [])];
    if (blocking.length > 0) return { action: 'notify', reasons: [...uncertain, ...notify] };
    if (input.settings.mode !== 'auto') return { action: 'notify', reasons: [`mode ${input.settings.mode} does not install`, ...notify] };
    return { action: 'auto', reasons: ['every input known and no release in range needs a hand', ...notify] };
}
