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
 */
import fs from 'node:fs';
import path from 'node:path';

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
    would_fire: Record<string, number>;
    raw_control: number;
    deviations_px: number[];
}

/** One shadow row for a file: counts per tolerance, never a finding shown to anyone. */
export function shadowRecord(content: string, relPath: string, roles: ControlRoleMap, now = new Date()): ShadowRecord {
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
        for (const fp of walk(dir)) {
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
