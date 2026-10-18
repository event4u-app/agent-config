/**
 * The refusal gates of `agent-config upgrade --unattended`.
 *
 * Pure: the caller fetches the registry document and gathers the machine facts,
 * this only decides. A candidate is installed unattended only when the result
 * is `{ install: true }`; every other outcome carries the reasons it refused.
 *
 * The verdict itself is `classifyUpdate`'s — the 72 h release age, the
 * `deprecated` field, the `engines.node` comparison, the provenance attestation
 * and the impact map are all decided there, and this module adds nothing to
 * them. What it adds is only what an unattended run knows that the classifier
 * cannot: the explicit flag is the consent (`mode: auto`, interactivity not
 * required), and a version the user skipped is never installed.
 */
import { classifyUpdate, type InstallOrigin } from './classify_update';

export const UNATTENDED_MIN_RELEASE_AGE_HOURS = 72;

export interface RegistryCandidate {
    readonly version: string;
    readonly publishedAt: string | null;
    readonly deprecated: unknown;
    readonly engines: unknown;
    readonly provenance: boolean | null;
    readonly impactMap: unknown;
}

function asRecord(v: unknown): Record<string, unknown> | null {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Read the `latest` candidate out of a full registry packument; `null` when the document does not carry one. */
export function read_candidate(packument: unknown): RegistryCandidate | null {
    const doc = asRecord(packument);
    const version = asRecord(doc?.['dist-tags'])?.['latest'];
    if (typeof version !== 'string' || version === '') return null;
    const manifest = asRecord(asRecord(doc?.['versions'])?.[version]);
    if (manifest === null) return null;
    const published = asRecord(doc?.['time'])?.[version];
    const attestations = asRecord(asRecord(manifest['dist'])?.['attestations']);
    return {
        version,
        publishedAt: typeof published === 'string' ? published : null,
        deprecated: manifest['deprecated'],
        engines: manifest['engines'],
        provenance: attestations === null ? false : asRecord(attestations['provenance']) !== null,
        impactMap: asRecord(manifest['agentConfig'])?.['impact'] ?? null,
    };
}

export interface UnattendedInput {
    readonly installed: string;
    readonly candidate: RegistryCandidate;
    readonly origin: InstallOrigin;
    readonly skipped: readonly string[];
    readonly env: {
        readonly ci: boolean;
        readonly noUpdateCheck: boolean;
        readonly nodeVersion: string;
        readonly now: string;
    };
}

export type UnattendedDecision =
    | { readonly install: true; readonly reasons: readonly string[] }
    | { readonly install: false; readonly reasons: readonly string[] };

export function unattended_decision(input: UnattendedInput): UnattendedDecision {
    if (input.skipped.includes(input.candidate.version)) {
        return { install: false, reasons: [`${input.candidate.version} is on the skip list`] };
    }
    const verdict = classifyUpdate({
        installed: input.installed,
        candidate: input.candidate.version,
        origin: input.origin,
        env: { ...input.env, interactive: true },
        impactMap: input.candidate.impactMap,
        engines: input.candidate.engines,
        publishedAt: input.candidate.publishedAt,
        deprecated: input.candidate.deprecated,
        provenance: input.candidate.provenance,
        settings: { mode: 'auto', projectPin: null, minReleaseAgeHours: UNATTENDED_MIN_RELEASE_AGE_HOURS },
    });
    return verdict.action === 'auto'
        ? { install: true, reasons: verdict.reasons }
        : { install: false, reasons: verdict.reasons };
}
