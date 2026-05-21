/**
 * Trust-escalation detection (Phase 5.1 / ADR-018 § 4).
 *
 * The lockfile records the trust mix each pack carried at install/sync
 * acceptance time (`accepted_trust`, `accepted_human_review_required`).
 * On a later `sync` the manifest may carry a higher count in any tier
 * (e.g. an artefact was reclassified from `professional` to `advisory`,
 * or a new `restricted` artefact joined the pack). When that happens
 * the installer must re-prompt — silent acceptance of an escalation
 * is a Trust-Floor violation.
 *
 * Pure data layer: no I/O, no prompting. Sync orchestrator decides
 * how to surface the result (interactive confirm, --accept-advisory,
 * agent-mode JSON question).
 */

import type {
    DiscoveryManifest,
    Lockfile,
    LockfilePack,
    ManifestPack,
    ManifestTrustSummary,
} from './types.js';

export type TrustTier = keyof ManifestTrustSummary;

export const TRUST_TIERS: readonly TrustTier[] = [
    'core',
    'professional',
    'experimental',
    'advisory',
    'restricted',
];

export interface TierDelta {
    readonly tier: TrustTier;
    readonly accepted: number;
    readonly current: number;
}

export interface TrustEscalation {
    readonly packId: string;
    readonly packLabel: string;
    readonly tierDeltas: readonly TierDelta[];
    readonly hrrDelta?: { accepted: number; current: number };
}

/** Zero-filled trust summary used when a lockfile predates the trust schema. */
export function emptyTrustSummary(): ManifestTrustSummary {
    return { core: 0, professional: 0, experimental: 0, advisory: 0, restricted: 0 };
}

/**
 * Compare per-pack trust counts in the manifest vs. the values the
 * lockfile recorded as accepted. Returns one entry per pack whose
 * tier or HRR count has grown — packs whose counts shrank or held
 * steady are omitted (those don't need a re-prompt).
 */
export function detectTrustEscalations(
    manifest: DiscoveryManifest,
    lockfile: Lockfile,
): readonly TrustEscalation[] {
    const out: TrustEscalation[] = [];
    const manifestById = new Map<string, ManifestPack>();
    for (const p of manifest.packs) manifestById.set(p.id, p);

    for (const lp of lockfile.packs) {
        const mp = manifestById.get(lp.id);
        if (mp === undefined) continue;
        const accepted = lp.accepted_trust ?? emptyTrustSummary();
        const acceptedHrr = lp.accepted_human_review_required ?? 0;
        const tierDeltas: TierDelta[] = [];
        for (const tier of TRUST_TIERS) {
            const a = accepted[tier];
            const c = mp.trust_summary[tier];
            if (c > a) tierDeltas.push({ tier, accepted: a, current: c });
        }
        const hrrGrew = mp.human_review_required > acceptedHrr;
        if (tierDeltas.length === 0 && !hrrGrew) continue;
        out.push({
            packId: lp.id,
            packLabel: mp.label,
            tierDeltas,
            ...(hrrGrew
                ? { hrrDelta: { accepted: acceptedHrr, current: mp.human_review_required } }
                : {}),
        });
    }
    return out;
}

/** Single-line human-readable summary of one escalation. */
export function formatEscalation(esc: TrustEscalation): string {
    const tierBits = esc.tierDeltas.map(
        (d) => `${d.tier} ${d.accepted}→${d.current}`,
    );
    const parts = [...tierBits];
    if (esc.hrrDelta !== undefined) {
        parts.push(`human-review ${esc.hrrDelta.accepted}→${esc.hrrDelta.current}`);
    }
    return `${esc.packId} (${esc.packLabel}): ${parts.join(' · ')}`;
}

/** True if any tier or HRR count grew vs. accepted snapshot. */
export function packHasEscalation(
    lockfilePack: LockfilePack,
    manifestPack: ManifestPack,
): boolean {
    const accepted = lockfilePack.accepted_trust ?? emptyTrustSummary();
    const acceptedHrr = lockfilePack.accepted_human_review_required ?? 0;
    for (const tier of TRUST_TIERS) {
        if (manifestPack.trust_summary[tier] > accepted[tier]) return true;
    }
    return manifestPack.human_review_required > acceptedHrr;
}
