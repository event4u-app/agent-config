/**
 * The long-run continuity record — `road-to-adversarial-verification-and-long-runs`
 * 9.1.
 *
 * `continuity_writer` already writes a session record. This is the MISSION
 * record: the state a twelve-hour run must survive a restart with, and the two
 * rules about reading it back — never re-ask a closed question, and never resume
 * on an authority snapshot that has since been revoked.
 *
 * **Risk 5 is the reason `restore` is not just a deserialise.** The record
 * carries the grant including `expires` and `revoked_by`. A restore that trusted
 * the snapshot would resume with authority the owner withdrew after it was
 * written — so the snapshot is revalidated against the LEDGER, which is the
 * surface a revocation actually writes to. A record and a ledger that disagree
 * are resolved in favour of the ledger, always.
 *
 * Pure. Reading the ledger and the forge belongs to the caller.
 */

/** A decision the mission already settled. Re-asking one is the failure. */
export interface DecisionRef {
    readonly id: string;
    /** Where the reasoning lives, so a restore can read rather than redo it. */
    readonly where: string;
}

/** The authority the mission is running under. */
export interface AuthoritySnapshot {
    readonly grant: string;
    /** ISO instant, or `null` for a grant with no expiry. */
    readonly expires: string | null;
    /** Who revoked it, or `null` while it stands. */
    readonly revoked_by: string | null;
}

export interface MissionRecord {
    readonly mission_id: string;
    readonly roadmap: string;
    readonly phase: string;
    readonly completed_steps: readonly string[];
    readonly decisions: readonly DecisionRef[];
    readonly authority: AuthoritySnapshot;
    readonly target_branch: string;
    readonly pr: number | null;
    readonly head_sha: string;
    /** The last CI verdict observed, and the head it was about. */
    readonly last_ci: { readonly verdict: string; readonly head: string } | null;
    readonly recovery_epoch: number;
    readonly attempt_count: number;
    readonly pending_reviews: readonly string[];
    readonly owner_owned_residue: readonly string[];
}

/** Every field a record must carry. Absent means the record is not one. */
export const REQUIRED_FIELDS: readonly (keyof MissionRecord)[] = [
    'mission_id',
    'roadmap',
    'phase',
    'completed_steps',
    'decisions',
    'authority',
    'target_branch',
    'pr',
    'head_sha',
    'last_ci',
    'recovery_epoch',
    'attempt_count',
    'pending_reviews',
    'owner_owned_residue',
];

/** When the record is written. A side task is NOT one of these. */
export const WRITE_BOUNDARIES = [
    'phase-boundary',
    'stop',
    'pre-compact',
    'session-end',
] as const;
export type WriteBoundary = (typeof WRITE_BOUNDARIES)[number];

/** Field names missing from a candidate record. Empty means complete. */
export function missingFields(candidate: Partial<MissionRecord>): string[] {
    return REQUIRED_FIELDS.filter((f) => candidate[f] === undefined).map(String);
}

/** What the LEDGER says about a grant right now. `null` = no ledger entry. */
export interface LedgerState {
    readonly grant: string;
    readonly revoked_by: string | null;
}

export type RestoreState = 'resume' | 'authority-withdrawn' | 'authority-expired';

export interface RestoreVerdict {
    readonly state: RestoreState;
    readonly reason: string;
    /** Questions this record already answers. A restore re-asks none of them. */
    readonly closed: readonly string[];
}

/**
 * Decide whether a restored mission may continue.
 *
 * The LEDGER wins over the snapshot, in one direction only: it can revoke a
 * grant the record still shows as live, and it cannot revive one the record
 * shows as revoked. A ledger that could un-revoke would make the record the
 * weaker of two authorities and the revocation advisory.
 */
export function restore(
    record: MissionRecord,
    ledger: LedgerState | null,
    now: Date,
): RestoreVerdict {
    const closed = record.decisions.map((d) => d.id);

    if (record.authority.revoked_by !== null) {
        return {
            state: 'authority-withdrawn',
            reason: `the record's own snapshot is revoked by ${record.authority.revoked_by}`,
            closed,
        };
    }
    if (ledger !== null && ledger.revoked_by !== null) {
        return {
            state: 'authority-withdrawn',
            reason: `the ledger reports the grant revoked by ${ledger.revoked_by} after the snapshot was written`,
            closed,
        };
    }
    if (record.authority.expires !== null) {
        const at = Date.parse(record.authority.expires);
        // An UNPARSEABLE expiry is treated as expired. A grant whose lifetime
        // cannot be read is not a grant with no lifetime.
        if (!Number.isFinite(at) || at <= now.getTime()) {
            return {
                state: 'authority-expired',
                reason: `the grant's expiry (${record.authority.expires}) is not a future instant`,
                closed,
            };
        }
    }
    return { state: 'resume', reason: 'the grant stands in both the record and the ledger', closed };
}

/**
 * Has this question already been settled by the mission?
 *
 * The whole point of the record: a restore that re-asks a closed question has
 * spent the owner's attention on something the mission already decided, which is
 * the loop this roadmap exists to end.
 */
export function alreadyAnswered(record: MissionRecord, questionId: string): boolean {
    return record.decisions.some((d) => d.id === questionId);
}

/** A side task does not clear the record. */
export function clearedBy(boundary: string): boolean {
    return boundary === 'mission-complete';
}
