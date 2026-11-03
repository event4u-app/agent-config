#!/usr/bin/env node
/**
 * lint_design_consistency — does a control match the project's own controls?
 *
 * Two findings, both RELATIVE TO THE PROJECT, which is why they live here and not
 * in the slop registry: a slop rule is a `backed` catalog claim about an AI tell
 * (`lint_design_antipattern_parity` check C), and these are neither tells nor
 * measured on a near-miss corpus yet (road-to-tells-a-near-miss-can-refute
 * Phase 1 gates that).
 *
 *   consistency-raw-control      a native element of a role whose canonical
 *                                implementation in this project is a component
 *                                (a raw <select> beside the project's Select)
 *   consistency-sibling-metrics  a control whose Tailwind height, x-padding or
 *                                radius differs from its role's canonical box
 *                                metrics by more than the tolerance
 *   consistency-sibling-gap      three or more same-signature siblings on one
 *                                axis whose gaps are uneven, read off `ui:render`
 *                                style rows (`--render`), shadow only
 *                                (road-to-design-inputs-and-pages-read-as-they-are 4.4)
 *
 * The project facts come from the `ui:audit` artefact (`control_roles`). No
 * artefact → no finding, and the run says so: absence of the map is not
 * evidence of consistency.
 *
 * REPORT-ONLY. Exit 0 whatever it finds; 1 on an internal error. It runs in
 * shadow (road-to-a-control-that-matches-its-neighbours 3.3) until the
 * activation policy's four conditions hold.
 *
 * Usage:
 *   npx tsx lint_design_consistency.ts --dir <ui src> [--audit <artefact>] [--tolerance <px>] [--json]
 *   npx tsx lint_design_consistency.ts --dir <ui src> --shadow   (records, prints nothing)
 *   npx tsx lint_design_consistency.ts --render <viewport.styles.json> [--json] [--tolerance <px>] [--shadow]
 */
import fs from 'node:fs';
import path from 'node:path';
import { asOf } from './_lib/as_of.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

import {
    boxMetricsFromClasses,
    definedComponents,
    occurrences,
    type BoxMetrics,
    type ControlRole,
    type RoleEntry,
} from './_lib/control_roles.js';

export const AUDIT_ARTEFACT_REL = path.join('agents', 'runtime', 'state', 'ui-audit.json');
export const SHADOW_REL = path.join('agents', 'runtime', 'state', 'design-consistency-shadow.jsonl');

/**
 * The candidate tolerances the shadow window records at once, so the threshold
 * can be read off a curve (P99 + 1 of the legitimate distribution) rather than
 * picked and then measured — `docs/contracts/concern-activation-policy.md`.
 */
export const SHADOW_TOLERANCES_PX = [0, 2, 4] as const;

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
}

/** One shadow row for a file: counts per tolerance, never a finding shown to anyone. */
export function shadowRecord(content: string, relPath: string, roles: ControlRoleMap, now = asOf()): ShadowRecord {
    const all = consistencyFindings(content, relPath, roles, 0);
    const would_fire: Record<string, number> = {};
    for (const t of SHADOW_TOLERANCES_PX) {
        would_fire[`tolerance_${t}px`] = consistencyFindings(content, relPath, roles, t).length;
    }
    return {
        at: now.toISOString(),
        file: relPath,
        would_fire,
        raw_control: all.filter((f) => f.rule === 'consistency-raw-control').length,
        deviations_px: all.flatMap((f) => (f.deviation_px === undefined ? [] : [f.deviation_px])),
    };
}

export type ControlRoleMap = Partial<Record<ControlRole, RoleEntry>>;

export interface ConsistencyFinding {
    rule: 'consistency-raw-control' | 'consistency-sibling-metrics';
    severity: 'P1';
    file: string;
    line: number;
    role: ControlRole;
    message: string;
    /** For sibling-metrics: the largest deviation in px across the compared metrics. */
    deviation_px?: number;
}

const COMPARED: ReadonlyArray<keyof Pick<BoxMetrics, 'height_px' | 'padding_x_px' | 'radius_px'>> = [
    'height_px',
    'padding_x_px',
    'radius_px',
];

/** The `control_roles` of a `ui:audit` artefact, or null when none is readable. */
export function loadControlRoles(artefactPath: string): ControlRoleMap | null {
    try {
        const parsed = JSON.parse(fs.readFileSync(artefactPath, 'utf8')) as { control_roles?: ControlRoleMap };
        return parsed.control_roles ?? null;
    } catch {
        return null;
    }
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
        if (!entry || entry.canonical === null) continue;

        if (o.impl.startsWith('native:') && !entry.canonical.startsWith('native:')) {
            out.push({
                rule: 'consistency-raw-control',
                severity: 'P1',
                file: relPath,
                line: o.line,
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

/** The rules a shadow row records — an old row without `rule` is the two original ones. */
export function shadowRulesOf(row: Pick<ShadowRecord, 'rule'>): string[] {
    return row.rule === undefined ? ['consistency-raw-control', 'consistency-sibling-metrics'] : [row.rule];
}

// ---------------------------------------------------------- consistency-sibling-gap

/** One `ui:render` style row: computed properties plus `rect`, `visible`, `parents`, `index`. */
export type RenderRow = Record<string, string>;

export interface GapPair {
    /** The two siblings' row indices, in axis order. */
    between: [number, number];
    gap_px: number;
    /** `child-margin` when the pair's adjoining margins differ from an intended pair's; `other` otherwise. */
    cause: 'child-margin' | 'other';
}

export interface SiblingGapFinding {
    rule: 'consistency-sibling-gap';
    parent: number;
    signature: string;
    axis: 'vertical' | 'horizontal';
    siblings: number;
    gaps_px: number[];
    spread_px: number;
    /** The most frequent gap; null when two values tie for it. */
    intended_gap_px: number | null;
    deviating: GapPair[];
    /** The container's gap along the axis, as computed — beside the margins, so both causes are visible. */
    container_gap: string | null;
    /** `<sampled>/<total>` when the style capture was truncated. */
    partial?: string;
}

/** Siblings on one axis sit within this many px of each other across it. */
const AXIS_ALIGN_PX = 2;
export const SIBLING_GAP_TOLERANCE_PX = 2;

function rectOf(row: RenderRow): [number, number, number, number] | null {
    const parts = (row['rect'] ?? '').split(',').map(Number);
    return parts.length === 4 && parts.every((n) => Number.isFinite(n)) ? (parts as [number, number, number, number]) : null;
}

const px = (v: string | undefined): number => {
    const n = Number.parseFloat(v ?? '');
    return Number.isFinite(n) ? n : 0;
};

/**
 * Pure core of `consistency-sibling-gap`. Groups visible, in-flow rows by
 * direct parent and tag + class signature; a group of three or more on one
 * axis (all left edges, or all top edges, within {@link AXIS_ALIGN_PX}) fires
 * when the spread of its gaps exceeds `tolerancePx`. A wrapped row, a grid and
 * a mixed-tag rhythm are never one group, so they never fire.
 */
export function siblingGapFindings(
    rows: readonly RenderRow[],
    opts: { tolerancePx?: number; partial?: string } = {},
): SiblingGapFinding[] {
    const tolerance = opts.tolerancePx ?? SIBLING_GAP_TOLERANCE_PX;
    const byIndex = new Map(rows.map((r) => [r['index'] ?? '', r]));
    const groups = new Map<string, Array<{ row: RenderRow; rect: [number, number, number, number] }>>();
    for (const row of rows) {
        if (row['visible'] !== '1') continue;
        if (row['position'] === 'absolute' || row['position'] === 'fixed') continue;
        const parent = (row['parents'] ?? '').split(',')[0] ?? '';
        if (parent === '') continue;
        const rect = rectOf(row);
        if (rect === null) continue;
        const key = `${parent}\0${row['selector'] ?? ''}.${row['class'] ?? ''}`;
        const g = groups.get(key) ?? [];
        g.push({ row, rect });
        groups.set(key, g);
    }
    const out: SiblingGapFinding[] = [];
    for (const [key, members] of groups) {
        if (members.length < 3) continue;
        const [parent, signature] = key.split('\0') as [string, string];
        const aligned = (i: 0 | 1): boolean => members.every((m) => Math.abs(m.rect[i] - members[0]!.rect[i]) <= AXIS_ALIGN_PX);
        const axis = aligned(0) ? 'vertical' : aligned(1) ? 'horizontal' : null;
        if (axis === null) continue;
        const start = axis === 'vertical' ? 1 : 0;
        const size = axis === 'vertical' ? 3 : 2;
        const sorted = [...members].sort((a, b) => a.rect[start] - b.rect[start]);
        const gaps = sorted.slice(1).map((m, i) => m.rect[start] - (sorted[i]!.rect[start] + sorted[i]!.rect[size]));
        if (gaps.some((g) => g < 0)) continue;
        const spread = Math.max(...gaps) - Math.min(...gaps);
        if (spread <= tolerance) continue;
        const counts = new Map<number, number>();
        for (const g of gaps) counts.set(g, (counts.get(g) ?? 0) + 1);
        const top = Math.max(...counts.values());
        const modes = [...counts.entries()].filter(([, n]) => n === top).map(([g]) => g);
        const intended = modes.length === 1 ? modes[0]! : null;
        const [endMargin, startMargin] = axis === 'vertical' ? ['margin-bottom', 'margin-top'] : ['margin-right', 'margin-left'];
        const marginsAt = (i: number): number => px(sorted[i]!.row[endMargin]) + px(sorted[i + 1]!.row[startMargin]);
        const intendedMargins = intended === null ? null : marginsAt(gaps.findIndex((g) => g === intended));
        const deviating: GapPair[] = [];
        gaps.forEach((g, i) => {
            if (intended !== null && Math.abs(g - intended) <= tolerance) return;
            deviating.push({
                between: [Number(sorted[i]!.row['index']), Number(sorted[i + 1]!.row['index'])],
                gap_px: g,
                cause: intendedMargins !== null && marginsAt(i) !== intendedMargins ? 'child-margin' : 'other',
            });
        });
        const parentRow = byIndex.get(parent);
        const axisGap = parentRow?.[axis === 'vertical' ? 'row-gap' : 'column-gap'];
        out.push({
            rule: 'consistency-sibling-gap',
            parent: Number(parent),
            signature,
            axis,
            siblings: members.length,
            gaps_px: gaps,
            spread_px: spread,
            intended_gap_px: intended,
            deviating,
            container_gap: axisGap === undefined ? null : axisGap,
            ...(opts.partial !== undefined ? { partial: opts.partial } : {}),
        });
    }
    return out;
}

/** One shadow row for a render's style file: would-fire counts per candidate tolerance, never shown to anyone. */
export function siblingGapShadowRecord(
    rows: readonly RenderRow[],
    relPath: string,
    opts: { partial?: string } = {},
    now = asOf(),
): ShadowRecord {
    const would_fire: Record<string, number> = {};
    for (const t of SHADOW_TOLERANCES_PX) {
        would_fire[`tolerance_${t}px`] = siblingGapFindings(rows, { tolerancePx: t, ...opts }).length;
    }
    return {
        at: now.toISOString(),
        file: relPath,
        rule: 'consistency-sibling-gap',
        would_fire,
        raw_control: 0,
        deviations_px: siblingGapFindings(rows, { tolerancePx: 0, ...opts }).map((f) => f.spread_px),
    };
}

/** The `partial` marker the render manifest beside a style file records for it, if any. */
function partialFor(stylesPath: string): string | undefined {
    try {
        const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(stylesPath), 'manifest.json'), 'utf8')) as {
            captures?: Array<{ styles?: string; partial?: string }>;
        };
        const base = path.basename(stylesPath);
        return manifest.captures?.find((c) => c.styles !== undefined && path.basename(c.styles) === base)?.partial;
    } catch {
        return undefined;
    }
}

function renderMode(args: string[], stylesPath: string): number {
    let rows: RenderRow[];
    try {
        rows = JSON.parse(fs.readFileSync(stylesPath, 'utf8')) as RenderRow[];
        if (!Array.isArray(rows)) throw new Error('not an array of style rows');
    } catch (exc) {
        process.stderr.write(`[lint_design_consistency] --render ${stylesPath} is unreadable (${(exc as Error).message})\n`);
        return 1;
    }
    const partial = partialFor(stylesPath);
    const opts = partial === undefined ? {} : { partial };
    if (args.includes('--shadow')) {
        const out = path.resolve(SHADOW_REL);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.appendFileSync(out, `${JSON.stringify(siblingGapShadowRecord(rows, path.relative(process.cwd(), stylesPath), opts))}\n`);
        return 0;
    }
    const tolerance = Number(arg(args, '--tolerance') ?? String(SIBLING_GAP_TOLERANCE_PX));
    const findings = siblingGapFindings(rows, { tolerancePx: tolerance, ...opts });
    if (args.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ findings, tolerance_px: tolerance, shadow: true }, null, 2)}\n`);
        return 0;
    }
    for (const f of findings) {
        process.stdout.write(
            `• (${f.rule}) parent #${f.parent} ${f.signature} — ${f.axis} gaps ${f.gaps_px.join('/')}px, intended ` +
                `${f.intended_gap_px === null ? 'none (tie)' : `${f.intended_gap_px}px`}; ` +
                f.deviating.map((d) => `#${d.between[0]}→#${d.between[1]} ${d.gap_px}px (${d.cause})`).join(', ') +
                `; container gap ${f.container_gap ?? 'not captured'}${f.partial ? ` [partial ${f.partial}]` : ''}\n`,
        );
    }
    process.stdout.write(`lint_design_consistency: ${findings.length} sibling-gap finding(s), shadow — never an exit code.\n`);
    return 0;
}

function* walk(dir: string): Generator<string> {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) yield* walk(p);
        else if (/\.(html?|vue|svelte|astro|jsx|tsx|php)$/i.test(e.name)) yield p;
    }
}

function arg(args: string[], name: string): string | undefined {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
}

export function main(args: string[]): number {
    const render = arg(args, '--render');
    if (render !== undefined) return renderMode(args, path.resolve(render));
    const json = args.includes('--json');
    const dir = path.resolve(arg(args, '--dir') ?? 'src');
    const audit = path.resolve(arg(args, '--audit') ?? AUDIT_ARTEFACT_REL);
    const tolerance = Number(arg(args, '--tolerance') ?? '0');
    if (!fs.existsSync(dir)) {
        process.stderr.write(`[lint_design_consistency] scan directory not found: ${dir}\n`);
        return 1;
    }
    const roles = loadControlRoles(audit);
    if (args.includes('--shadow')) {
        // Shadow posture: append one row per file, print nothing.
        if (roles === null) return 0;
        const out = path.resolve(SHADOW_REL);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        for (const fp of walk(dir)) {
            const row = shadowRecord(fs.readFileSync(fp, 'utf8'), path.relative(process.cwd(), fp), roles);
            fs.appendFileSync(out, `${JSON.stringify(row)}\n`);
        }
        return 0;
    }
    const findings: ConsistencyFinding[] = [];
    if (roles !== null) {
        const files = [...walk(dir)];
        // An existing root that yields no UI file is a moved tree, not a clean scan.
        try {
            assertScanned({ gate: 'lint_design_consistency', scanned: files.length, units: 'UI source file(s)', roots: [dir] });
        } catch (exc) {
            if (exc instanceof DeadScopeError) {
                process.stderr.write(`❌  ${exc.message}\n`);
                return 1;
            }
            throw exc;
        }
        for (const fp of files) {
            findings.push(...consistencyFindings(fs.readFileSync(fp, 'utf8'), path.relative(process.cwd(), fp), roles, tolerance));
        }
    }
    if (json) {
        process.stdout.write(`${JSON.stringify({ findings, control_roles: roles !== null, tolerance_px: tolerance }, null, 2)}\n`);
        return 0;
    }
    if (roles === null) {
        process.stdout.write(`ℹ️  lint_design_consistency: no ui:audit artefact at ${path.relative(process.cwd(), audit)} — run \`agent-config ui:audit\` first; nothing was checked.\n`);
        return 0;
    }
    for (const f of findings) process.stdout.write(`• [${f.severity}] ${f.file}:${f.line} (${f.rule}) — ${f.message}\n`);
    process.stdout.write(`lint_design_consistency: ${findings.length} finding(s), report-only.\n`);
    return 0;
}

if (process.argv[1] !== undefined && /lint_design_consistency\.ts$/.test(process.argv[1])) {
    process.exitCode = main(process.argv.slice(2));
}
