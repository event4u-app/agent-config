/**
 * The two consistency rules and the shadow row, without the CLI of
 * `lint_design_consistency`, so the `design_consistency_pass` chunk loads only these.
 */
import path from 'node:path';

import { asOf } from './as_of.js';
import {
    boxMetricsFromClasses,
    definedComponents,
    fileFamily,
    occurrences,
    type BoxMetrics,
    type ControlRole,
    type RoleEntry,
} from './control_roles.js';
import { isHandoverShape } from './ui_surface.js';

export const SHADOW_REL = path.join('agents', 'runtime', 'state', 'design-consistency-shadow.jsonl');

/**
 * The candidate tolerances the shadow window records at once, so the threshold
 * can be read off a curve (P99 + 1 of the legitimate distribution) rather than
 * picked and then measured — `docs/contracts/concern-activation-policy.md`.
 */
export const SHADOW_TOLERANCES_PX = [0, 2, 4] as const;

/** What fired on a write, kept so it can be classified after the file has moved on. */
export interface ShadowFinding {
    rule: ConsistencyFinding['rule'];
    line: number;
    message: string;
    /** The source line, trimmed, at most 200 characters around the control. */
    context: string;
}

export interface ShadowRecord {
    at: string;
    file: string;
    /**
     * Absent on every row written before the sibling-gap rule: such a row is
     * the raw-control + sibling-metrics row, and reads as those two rules.
     */
    rule?: 'consistency-sibling-gap';
    would_fire: Record<string, number>;
    raw_control: number;
    deviations_px: number[];
    findings?: ShadowFinding[];
    /** The git HEAD the write was made on, when the caller knows it. */
    head?: string | null;
}

/** One shadow row for a file: counts per tolerance, never a finding shown to anyone. */
export function shadowRecord(content: string, relPath: string, roles: ControlRoleMap, now = asOf()): ShadowRecord {
    const all = consistencyFindings(content, relPath, roles, 0);
    const would_fire: Record<string, number> = {};
    for (const t of SHADOW_TOLERANCES_PX) {
        would_fire[`tolerance_${t}px`] = consistencyFindings(content, relPath, roles, t).length;
    }
    const lines = content.split('\n');
    const raw = all.filter((f) => f.rule === 'consistency-raw-control');
    return {
        at: now.toISOString(),
        file: relPath,
        would_fire,
        raw_control: raw.length,
        deviations_px: all.flatMap((f) => (f.deviation_px === undefined ? [] : [f.deviation_px])),
        findings: raw.map((f) => ({
            rule: f.rule,
            line: f.line,
            message: f.message,
            context: around(lines[f.line - 1] ?? '', f.column),
        })),
    };
}

/** At most 200 characters of the line, around this finding's own control. */
function around(line: string, column: number | undefined): string {
    if (line.trim().length <= 200) return line.trim();
    const at = column ?? line.length - line.trimStart().length;
    const start = Math.max(0, Math.min(at - 60, line.length - 200));
    return line.slice(start, start + 200).trim();
}

export type ControlRoleMap = Partial<Record<ControlRole, RoleEntry>>;

export interface ConsistencyFinding {
    rule: 'consistency-raw-control' | 'consistency-sibling-metrics';
    severity: 'P1';
    file: string;
    line: number;
    role: ControlRole;
    message: string;
    /** Offset of the control's `<` within its line. */
    column?: number;
    /** For sibling-metrics: the largest deviation in px across the compared metrics. */
    deviation_px?: number;
}

const COMPARED: ReadonlyArray<keyof Pick<BoxMetrics, 'height_px' | 'padding_x_px' | 'radius_px'>> = [
    'height_px',
    'padding_x_px',
    'radius_px',
];

/**
 * Whether a file of this kind can render the canonical at all: its family must
 * be one the project defines the canonical in. A server template cannot use a JSX
 * `Select`, nor a `.vue` file a React one; a map that does not say is not trusted.
 */
export function canRender(relPath: string, canonical: string, families: readonly string[] | undefined): boolean {
    if (canonical.startsWith('native:')) return true;
    const family = fileFamily(relPath);
    return family !== null && families !== undefined && families.includes(family);
}

/** A design handover or an agent's reference copy is not the product's UI. */
function isProductUi(relPath: string): boolean {
    return !isHandoverShape(relPath) && !/(^|\/)agents\//.test(relPath.replace(/\\/g, '/'));
}

/**
 * Pure core. `tolerancePx` applies to sibling metrics only; the raw-control
 * check has no tolerance — an element either is the project's control or not.
 */
export function consistencyFindings(
    content: string,
    relPath: string,
    roles: ControlRoleMap,
    tolerancePx = 0,
): ConsistencyFinding[] {
    if (!isProductUi(relPath)) return [];
    const definesRole = new Set(
        definedComponents(relPath, content)
            .map((t) => occurrences(`<${t}>`)[0]?.role)
            .filter((r): r is ControlRole => r !== undefined),
    );
    const out: ConsistencyFinding[] = [];
    const all = occurrences(content);
    const metricsOf = all.map((o) => (o.classes ? boxMetricsFromClasses(o.classes) : null));
    for (const [i, o] of all.entries()) {
        // The file that implements a role's primitive is the primitive.
        if (definesRole.has(o.role)) continue;
        const entry = roles[o.role];
        if (!entry || entry.canonical === null || !canRender(relPath, entry.canonical, entry.families)) continue;

        if (o.impl.startsWith('native:') && !entry.canonical.startsWith('native:')) {
            out.push({
                rule: 'consistency-raw-control',
                severity: 'P1',
                file: relPath,
                line: o.line,
                column: o.column,
                role: o.role,
                message: `raw ${o.impl.slice(7)} — this project's ${o.role} is ${entry.canonical}`,
            });
            continue;
        }

        const have = metricsOf[i] ?? null;
        if (!have) continue;
        // Local siblings outrank the project canonical: two or more controls of
        // the same role in this file that agree on a metric set its value here,
        // so a deliberately dense table is judged against its own density.
        const siblings = all
            .map((s, j) => (j !== i && s.role === o.role ? metricsOf[j] : null))
            .filter((m): m is BoxMetrics => m !== null);
        const want = (k: (typeof COMPARED)[number]): number | null => {
            const vals = siblings.map((m) => m[k]).filter((v): v is number => v !== null);
            if (vals.length >= 2 && vals.every((v) => v === vals[0])) return vals[0]!;
            return entry.box_metrics?.[k] ?? null;
        };
        let worst = 0;
        const diffs: string[] = [];
        for (const k of COMPARED) {
            const a = have[k];
            const b = want(k);
            if (a === null || b === null) continue;
            const d = Math.abs(a - b);
            if (d > tolerancePx) diffs.push(`${k.replace('_px', '')} ${a}px vs ${b}px`);
            worst = Math.max(worst, d);
        }
        if (diffs.length > 0) {
            out.push({
                rule: 'consistency-sibling-metrics',
                severity: 'P1',
                file: relPath,
                line: o.line,
                role: o.role,
                message: `${o.role} differs from the project's ${entry.canonical}: ${diffs.join(', ')}`,
                deviation_px: worst,
            });
        }
    }
    return out;
}
