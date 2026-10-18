/**
 * `/design-system:sync reconcile` — one authority, one store, one UI owner
 * (road-to-a-canvas-the-code-owns steps 5.1, 6.1, 6.2, 8.3).
 *
 * **The resolver sets the posture; the user disposes each row (5.1).**
 * `resolveUiAuthority` is called ONCE per scope: the canvas snapshot is the
 * `reference` with its maturity, the code is the `incumbent`, a registered
 * palette or type lock is a `hard_constraint`, the user's stated intent is
 * `user`. Each `conflict` row is pre-filled with the side that posture points
 * at and carries the posture as provenance; the resolver's own `conflicts[]` are
 * copied verbatim. There is no value ranking beside the resolver — a proposal is
 * a reading of the posture, and every row still needs the user's disposition.
 *
 * **A brief, not a write (6.1).** A remote-only component the user imports
 * becomes a brief — the remote contract as the spec — handed to the run's UI
 * owner, whose own coverage records each mechanic as honoured, translated or
 * flagged (`design-artifact-lifecycle.md`). This module writes no component.
 *
 * **Tiers only as the detector records them (6.2).** A brief carries the tier
 * names `detect_component_taxonomy` recorded for the project; when it recorded
 * none, the brief carries no tier and proposes no vocabulary.
 */

import {
    type ReferenceMaturity,
    type Signals,
    type UiAuthority,
    resolveUiAuthority,
} from './ui_authority.js';
import { DISPOSITIONS, type Disposition, type Ledger, type LedgerRow } from './design_sync_ledger.js';

export interface ReconcileInput {
    referenceMaturity: Exclude<ReferenceMaturity, null>;
    referencePath?: string;
    incumbent: { coherent: boolean; palette?: string[]; type_families?: string[] };
    locks: { palette: boolean; type_family: boolean };
    userIntent?: Signals['user'];
    dispositions: Record<string, Disposition>;
    /** The tiers `detect_component_taxonomy` recorded, or none. */
    tiers: string[];
    owner: 'fe-design' | 'directives/ui';
}

/** Build the resolver's signals — the one place the sync inputs meet `ui_authority`. */
export function authoritySignals(input: ReconcileInput): Signals {
    const hard: NonNullable<Signals['hard_constraints']> = [];
    if (input.locks.palette) hard.push('preserve_palette');
    if (input.locks.type_family) hard.push('preserve_type_family');
    return {
        reference: { maturity: input.referenceMaturity, ...(input.referencePath !== undefined ? { path: input.referencePath } : {}) },
        incumbent: input.incumbent,
        ...(input.userIntent !== undefined ? { user: input.userIntent } : {}),
        ...(hard.length > 0 ? { hard_constraints: hard } : {}),
    };
}

/** Which constraint, if any, binds a row — read off the key, never off the value. */
function bindingConstraint(row: LedgerRow, a: UiAuthority): string | null {
    if (row.key.startsWith('colors.') && a.constraints.preserve_palette) return 'preserve_palette';
    if (row.key.startsWith('typography.families.') && a.constraints.preserve_type_family) return 'preserve_type_family';
    return null;
}

/** The side a posture points at for one conflict row. A proposal, never a disposition. */
export function proposeSide(row: LedgerRow, a: UiAuthority): NonNullable<LedgerRow['proposed']> {
    const constraints = Object.entries(a.constraints)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
        .sort();
    const bound = bindingConstraint(row, a);
    const side = bound !== null || a.primary_source.kind === 'incumbent' ? 'code' : 'remote';
    return { side, primary_source: a.primary_source.kind, constraints };
}

export interface Brief {
    component: string;
    spec: string;
    contract: string | null;
    owner: ReconcileInput['owner'];
    coverage: string;
    tiers?: string[];
}

export function briefFor(row: LedgerRow, input: Pick<ReconcileInput, 'owner' | 'tiers'>): Brief {
    return {
        component: row.key,
        spec: 'the remote snapshot markup and contract for this export — the spec, not a starting point',
        contract: row.remote,
        owner: input.owner,
        coverage: 'the owner records each mechanic as honoured, translated or flagged; this command writes no component',
        ...(input.tiers.length > 0 ? { tiers: [...input.tiers] } : {}),
    };
}

const REMOTE_ONLY = new Set(['remote-only:twin', 'remote-only:collides']);

export function reconcileLedger(ledger: Ledger, input: ReconcileInput): { ledger: Ledger; errors: string[] } {
    const authority = resolveUiAuthority(authoritySignals(input));
    const errors: string[] = [];
    const rows = ledger.rows.map((r) => ({ ...r }));
    for (const row of rows) {
        if (row.class === 'conflict') row.proposed = proposeSide(row, authority);
        const wanted = input.dispositions[row.key];
        if (wanted === undefined) continue;
        if (!DISPOSITIONS.includes(wanted) || wanted === 'pending') {
            errors.push(`${row.key}: "${String(wanted)}" is not a disposition`);
            continue;
        }
        if ((wanted === 'import-as-brief' || wanted === 'keep-as-exploration') && !(row.kind === 'component' && REMOTE_ONLY.has(row.class))) {
            errors.push(`${row.key}: ${wanted} applies only to a remote-only component`);
            continue;
        }
        row.disposition = wanted;
    }
    for (const key of Object.keys(input.dispositions)) {
        if (!rows.some((r) => r.key === key)) errors.push(`${key}: no such row in the ledger`);
    }
    const briefs = rows.filter((r) => r.disposition === 'import-as-brief').map((r) => briefFor(r, input));
    for (const r of rows) if (r.disposition === 'pending') errors.push(`${r.key}: ${r.class} row has no disposition yet`);
    const out: Ledger = {
        ...ledger,
        rows,
        authority: {
            primary_source: authority.primary_source,
            change_intent: authority.change_intent,
            constraints: authority.constraints,
            conflicts: authority.conflicts,
            verification: authority.verification,
            provenance: authority.provenance,
        },
        briefs: briefs as unknown as Array<Record<string, unknown>>,
    };
    return { ledger: out, errors };
}

export interface MatrixRow {
    chapter: string;
    claim: string;
    evidence: 'element-screenshot' | 'not-implemented';
    status: string;
}

/** One `design-review` fidelity-matrix row per reconciled component, evidence kind named (8.3). */
export function matrixRows(ledger: Ledger): MatrixRow[] {
    return ledger.rows
        .filter((r) => r.kind === 'component' && r.disposition !== 'pending')
        .map((r) => {
            const baseline = (ledger.baselines ?? []).find((b) => b.path.includes(r.key));
            return {
                chapter: r.key,
                claim: `contract ${r.remote ?? r.code ?? '(none)'} (${r.class})`,
                evidence: baseline !== undefined ? 'element-screenshot' : 'not-implemented',
                status:
                    baseline !== undefined
                        ? `${r.disposition}; baseline ${baseline.path}`
                        : `${r.disposition}; no baseline recorded for this component in the ledger`,
            };
        });
}
