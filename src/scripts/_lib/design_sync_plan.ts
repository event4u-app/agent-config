/**
 * `/design-system:sync plan` — classify every token and component across base,
 * code and remote (road-to-a-canvas-the-code-owns steps 3.3, 4.3, 4.5).
 *
 * **The base is a commit, not the anchor (3.3).** With a projection commit in
 * the ledger, the base is the code-side `design-system.json` as it stood at that
 * commit, read with `git show <commit>:<path>`. Without one the comparison is
 * two-way and a value difference is `unknown` — never a guessed three-way. Rows
 * are keyed by token path or component export name; two rows with equal values
 * and different keys are two rows.
 *
 * **Unknown is not empty (4.3).** An unreachable remote makes every row
 * `unknown` and withholds the handover recommendation, because "nothing on the
 * canvas collides" and "the canvas could not be read" must never print the same
 * count. A missing `projectId` pin blocks the handover outright.
 *
 * **No upload route (4.4).** Nothing here writes to the canvas, calls the host's
 * sync, or touches the network; `plan` writes the ledger and no other file.
 */

import { execFileSync } from 'node:child_process';

import type { DesignSystem } from './design_system_import.js';
import {
    LEDGER_SCHEMA,
    type Ledger,
    type LedgerRow,
    type Projection,
    type RowClass,
    defaultDisposition,
} from './design_sync_ledger.js';

interface Entry {
    kind: 'token' | 'component';
    value: string;
    path?: string;
}

/** One entry per token path and per component export name. */
export function flatten(ds: DesignSystem | null): Map<string, Entry> {
    const out = new Map<string, Entry>();
    if (ds === null) return out;
    const put = (prefix: string, rec: Record<string, string> | undefined): void => {
        for (const [k, v] of Object.entries(rec ?? {})) out.set(`${prefix}.${k}`, { kind: 'token', value: v });
    };
    put('colors.light', ds.colors?.light);
    put('colors.dark', ds.colors?.dark);
    put('radius', ds.radius);
    put('shadow', ds.shadow);
    put('motion.durations', ds.motion?.durations);
    put('motion.easings', ds.motion?.easings);
    for (const f of ds.typography?.families ?? []) out.set(`typography.families.${f.role}`, { kind: 'token', value: f.name });
    for (const s of ds.typography?.scale ?? []) out.set(`typography.scale.${s.step}`, { kind: 'token', value: s.size });
    if (ds.spacing?.scale?.length) out.set('spacing.scale', { kind: 'token', value: JSON.stringify(ds.spacing.scale) });
    const paths = (ds._meta?.['component_paths'] as Record<string, string> | undefined) ?? {};
    for (const c of ds.components ?? []) {
        const value = JSON.stringify({ classes: [...(c.observed.classes ?? [])].sort(), props: [...(c.observed.props ?? [])].sort() });
        out.set(c.name, { kind: 'component', value, ...(paths[c.name] !== undefined ? { path: paths[c.name] } : {}) });
    }
    return out;
}

export function classify(
    base: Entry | undefined,
    code: Entry | undefined,
    remote: Entry | undefined,
    ctx: { baseKnown: boolean; remoteReachable: boolean; codePaths: ReadonlySet<string> },
): RowClass {
    if (!ctx.remoteReachable) return 'unknown';
    if (code !== undefined && remote !== undefined) {
        if (code.value === remote.value) return 'in-sync';
        if (!ctx.baseKnown) return 'unknown';
        return base !== undefined && remote.value === base.value ? 'remote-generated' : 'conflict';
    }
    if (code !== undefined) return 'code-only';
    if (remote === undefined) return 'unknown';
    if (ctx.baseKnown && base !== undefined) return 'orphan';
    return remote.path !== undefined && ctx.codePaths.has(remote.path) ? 'remote-only:collides' : 'remote-only:twin';
}

export interface PlanInput {
    scopeRoot: string;
    config: string;
    code: DesignSystem;
    remote: DesignSystem | null;
    base: DesignSystem | null;
    projection: Omit<Projection, 'state'> & { state?: Projection['state'] };
    previous?: Ledger | null;
}

export interface Handover {
    recommended: boolean | null;
    reason: string;
}

export function planLedger(input: PlanInput): Ledger & { handover: Handover } {
    const code = flatten(input.code);
    const remote = flatten(input.remote);
    const base = flatten(input.base);
    const remoteReachable = input.remote !== null;
    const codePaths = new Set([...code.values()].map((e) => e.path).filter((p): p is string => p !== undefined));
    const ctx = { baseKnown: input.base !== null, remoteReachable, codePaths };
    const prior = new Map((input.previous?.rows ?? []).map((r) => [`${r.kind}:${r.key}`, r]));

    const keys = [...new Set([...code.keys(), ...remote.keys(), ...(remoteReachable ? base.keys() : [])])].sort();
    const rows: LedgerRow[] = [];
    for (const key of keys) {
        const b = base.get(key);
        const c = code.get(key);
        const r = remote.get(key);
        const kind = (c ?? r ?? b)?.kind ?? 'token';
        if (c === undefined && r === undefined) continue; // gone from both sides
        const cls = classify(b, c, r, ctx);
        const row: LedgerRow = {
            key,
            kind,
            class: cls,
            base: b?.value ?? null,
            code: c?.value ?? null,
            remote: r?.value ?? null,
            disposition: defaultDisposition(cls),
        };
        const old = prior.get(`${kind}:${key}`);
        if (old !== undefined && old.class === row.class && old.code === row.code && old.remote === row.remote) {
            row.disposition = old.disposition;
            if (old.proposed !== undefined) row.proposed = old.proposed;
        }
        rows.push(row);
    }

    const pending = rows.filter((r) => r.disposition === 'pending').length;
    let handover: Handover;
    if (!remoteReachable) handover = { recommended: null, reason: 'the remote could not be read — every row is unknown, so no recommendation is made' };
    else if (input.projection.projectId === null) handover = { recommended: false, reason: 'blocked — .design-sync/config.json pins no projectId' };
    else if (pending > 0) handover = { recommended: false, reason: `${pending} row(s) await a disposition — run reconcile first` };
    else handover = { recommended: true, reason: 'every row is dispositioned; the user may run /design-sync' };

    return {
        schema: LEDGER_SCHEMA,
        scope_root: input.scopeRoot,
        config: input.config,
        projection: {
            projectId: input.projection.projectId,
            commit: input.projection.commit,
            ...(input.projection.anchor_hash !== undefined ? { anchor_hash: input.projection.anchor_hash } : {}),
            state: input.projection.state ?? input.previous?.projection.state ?? 'prepared',
        },
        remote_reachable: remoteReachable,
        rows,
        ...(input.previous?.baselines !== undefined ? { baselines: input.previous.baselines } : {}),
        ...(input.previous?.authority !== undefined ? { authority: input.previous.authority } : {}),
        ...(input.previous?.briefs !== undefined ? { briefs: input.previous.briefs } : {}),
        handover,
    };
}

/** The two counts the user reads before any sync: what it would overwrite, what it would leave twinned. */
export function planCounts(ledger: Pick<Ledger, 'rows'>): { overwrite: number; twin: number; unknown: number; pending: number } {
    const n = (pred: (r: LedgerRow) => boolean): number => ledger.rows.filter(pred).length;
    return {
        overwrite: n((r) => r.class === 'remote-only:collides' || r.class === 'conflict'),
        twin: n((r) => r.class === 'remote-only:twin'),
        unknown: n((r) => r.class === 'unknown'),
        pending: n((r) => r.disposition === 'pending'),
    };
}

/** The base: the code-side file as it stood at the projection commit, or null. */
export function readBaseAtCommit(cwd: string, commit: string, relPath: string): DesignSystem | null {
    if (!/^[0-9a-f]{4,64}$/i.test(commit) || relPath.includes('\0')) return null;
    try {
        const text = execFileSync('git', ['show', `${commit}:${relPath}`], { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
        return JSON.parse(text) as DesignSystem;
    } catch {
        return null;
    }
}
