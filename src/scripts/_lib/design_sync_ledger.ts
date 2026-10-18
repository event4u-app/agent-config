/**
 * The design-sync ledger (road-to-a-canvas-the-code-owns step 4.1).
 *
 * One `.claude/design-system/sync-ledger.json` per `.design-sync/config.json`,
 * stating for every token path and component export which side holds what, and
 * what the user decided. The repository is the only store of the design
 * system; the canvas holds a projection of it. The ledger is how the user sees
 * the difference before the host's own `/design-sync` — which only the user
 * starts — overwrites anything.
 *
 * **A row without a disposition fails validation.** `plan` writes `pending` on
 * every row that needs a decision; `reconcile` is not finished while one is
 * left (`stage: 'reconciled'`). The key itself is mandatory at every stage, so
 * a row cannot be written that the user was never shown.
 *
 * The anchor hash is OPTIONAL by design: the base of a three-way comparison is
 * the git commit the projection was made from, never the host's anchor, whose
 * layout is unverified at the current host.
 */

export const LEDGER_SCHEMA = 'design-sync-ledger/v1';
export const LEDGER_RELATIVE = '.claude/design-system/sync-ledger.json';

export const ROW_CLASSES = [
    'in-sync',
    'code-only',
    'remote-generated',
    'remote-only:collides',
    'remote-only:twin',
    'conflict',
    'orphan',
    'unknown',
] as const;
export type RowClass = (typeof ROW_CLASSES)[number];

export const PROJECTION_STATES = ['prepared', 'user-reported-ran', 'host-artifacts-observed', 'picker-confirmed'] as const;
export type ProjectionState = (typeof PROJECTION_STATES)[number];

/** `pending` is a placeholder the user has not answered, never a decision. */
export const DISPOSITIONS = ['pending', 'no-action', 'keep-code', 'take-remote', 'import-as-brief', 'keep-as-exploration'] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export interface LedgerRow {
    key: string;
    kind: 'token' | 'component';
    class: RowClass;
    base: string | null;
    code: string | null;
    remote: string | null;
    disposition: Disposition;
    /** Pre-filled by `reconcile` from the `ui_authority` posture — a proposal, not a decision. */
    proposed?: { side: 'code' | 'remote'; primary_source: string; constraints: string[] };
}

export interface Projection {
    projectId: string | null;
    commit: string | null;
    anchor_hash?: string;
    state: ProjectionState;
}

export interface Baseline {
    path: string;
    projection_commit: string | null;
}

export interface Ledger {
    schema: typeof LEDGER_SCHEMA;
    scope_root: string;
    config: string;
    projection: Projection;
    remote_reachable: boolean;
    rows: LedgerRow[];
    baselines?: Baseline[];
    authority?: Record<string, unknown>;
    briefs?: Array<Record<string, unknown>>;
    /** Render-check counts the user accepted, by dotted field path, with the reason. */
    render_dispositions?: Record<string, string>;
    handover?: { recommended: boolean | null; reason: string };
}

const NEEDS_NO_DECISION: ReadonlySet<RowClass> = new Set(['in-sync', 'remote-generated', 'code-only']);

/** The disposition `plan` writes when nothing has been decided yet. */
export function defaultDisposition(cls: RowClass): Disposition {
    return NEEDS_NO_DECISION.has(cls) ? 'no-action' : 'pending';
}

/**
 * Validate a parsed ledger. `plan` stage accepts `pending`; `reconciled` stage
 * does not, which is what makes "every row has a disposition" checkable.
 */
export function validateLedger(value: unknown, stage: 'plan' | 'reconciled' = 'plan'): string[] {
    const errors: string[] = [];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return ['ledger is not a JSON object'];
    const l = value as Record<string, unknown>;
    if (l['schema'] !== LEDGER_SCHEMA) errors.push(`schema must be "${LEDGER_SCHEMA}"`);
    if (typeof l['scope_root'] !== 'string' || l['scope_root'] === '') errors.push('scope_root must be a non-empty string');
    if (typeof l['config'] !== 'string') errors.push('config must name the .design-sync/config.json it belongs to');
    const p = l['projection'] as Record<string, unknown> | undefined;
    if (typeof p !== 'object' || p === null) errors.push('projection is required');
    else {
        if (p['projectId'] !== null && typeof p['projectId'] !== 'string') errors.push('projection.projectId must be a string or null');
        if (p['commit'] !== null && typeof p['commit'] !== 'string') errors.push('projection.commit must be a string or null');
        if (p['anchor_hash'] !== undefined && typeof p['anchor_hash'] !== 'string') errors.push('projection.anchor_hash, when present, must be a string');
        if (!PROJECTION_STATES.includes(p['state'] as ProjectionState)) {
            errors.push(`projection.state must be one of ${PROJECTION_STATES.join(', ')}`);
        }
    }
    if (typeof l['remote_reachable'] !== 'boolean') errors.push('remote_reachable must be a boolean');
    if (!Array.isArray(l['rows'])) return [...errors, 'rows must be an array'];
    const seen = new Set<string>();
    (l['rows'] as unknown[]).forEach((raw, i) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const at = `rows[${i}]${typeof r['key'] === 'string' ? ` (${r['key']})` : ''}`;
        if (typeof r['key'] !== 'string' || r['key'] === '') errors.push(`${at}: key is required`);
        else if (seen.has(`${String(r['kind'])}:${r['key']}`)) errors.push(`${at}: duplicate key`);
        else seen.add(`${String(r['kind'])}:${r['key']}`);
        if (r['kind'] !== 'token' && r['kind'] !== 'component') errors.push(`${at}: kind must be token or component`);
        if (!ROW_CLASSES.includes(r['class'] as RowClass)) errors.push(`${at}: class must be one of ${ROW_CLASSES.join(', ')}`);
        if (!('disposition' in r)) errors.push(`${at}: has no disposition`);
        else if (!DISPOSITIONS.includes(r['disposition'] as Disposition)) errors.push(`${at}: disposition "${String(r['disposition'])}" is not one of ${DISPOSITIONS.join(', ')}`);
        else if (stage === 'reconciled' && r['disposition'] === 'pending') errors.push(`${at}: disposition is still pending`);
    });
    return errors;
}

/** Deterministic serialisation — the idempotence of `plan` rests on it. */
export function serializeLedger(ledger: Ledger): string {
    const sortDeep = (v: unknown): unknown => {
        if (Array.isArray(v)) return v.map(sortDeep);
        if (typeof v === 'object' && v !== null) {
            return Object.fromEntries(
                Object.keys(v as Record<string, unknown>)
                    .sort()
                    .map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]),
            );
        }
        return v;
    };
    return `${JSON.stringify(sortDeep(ledger), null, 2)}\n`;
}
