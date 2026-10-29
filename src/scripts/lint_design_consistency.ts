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
 * REPORT-ONLY. Exit 0 whatever it finds; 1 on an internal error, and for
 * --shadow-report also when the evidence is missing or incomplete. It runs in
 * shadow (road-to-a-control-that-matches-its-neighbours 3.3) until the
 * activation policy's four conditions hold.
 *
 * Usage:
 *   npx tsx lint_design_consistency.ts --dir <ui src> [--audit <artefact>] [--tolerance <px>] [--json]
 *   npx tsx lint_design_consistency.ts --dir <ui src> --shadow   (records, prints nothing)
 *   npx tsx lint_design_consistency.ts --shadow-report [--days 14] [--json]   (the reverse trigger's reading)
 */
import fs from 'node:fs';
import path from 'node:path';
import { asOf } from './_lib/as_of.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { isHandoverShape } from './_lib/ui_surface.js';

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

export interface ShadowWindow {
    since: string;
    days: number;
    writes: number;
    firing: number;
    files: Array<{ file: string; firing_writes: number }>;
    /** Every firing write in the window, one entry each, for classification. */
    firings: Array<{ at: string; file: string; head: string | null; findings: ShadowFinding[] }>;
}

/**
 * The live rows of the last `days`, as the reverse trigger reads them
 * (`internal/bench/corpora/design-consistency-shadow-window.md` § The reverse
 * trigger). Counts only: whether a firing write is a false positive is a
 * human classification, so this never prints a rate.
 */
export function shadowWindow(rows: readonly ShadowRecord[], now: Date, days = 14): ShadowWindow {
    const since = new Date(now.getTime() - days * 86_400_000);
    const files = new Map<string, number>();
    const firings: ShadowWindow['firings'] = [];
    let writes = 0;
    for (const r of rows) {
        const at = Date.parse(r.at);
        if (Number.isNaN(at) || at < since.getTime() || at > now.getTime()) continue;
        writes++;
        if (r.raw_control > 0) {
            files.set(r.file, (files.get(r.file) ?? 0) + 1);
            firings.push({ at: r.at, file: r.file, head: r.head ?? null, findings: r.findings ?? [] });
        }
    }
    return {
        since: since.toISOString(),
        days,
        writes,
        firing: firings.length,
        files: [...files].sort((a, b) => b[1] - a[1]).map(([file, firing_writes]) => ({ file, firing_writes })),
        firings,
    };
}

export type ControlRoleMap = Partial<Record<ControlRole, RoleEntry>>;

/** Why a parsed row cannot be read as evidence, or null when it can. */
function rowDefect(v: unknown): string | null {
    if (typeof v !== 'object' || v === null) return 'not a row';
    const r = v as Partial<ShadowRecord>;
    if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return '`at` is not a date';
    if (typeof r.file !== 'string' || r.file === '') return '`file` is missing';
    if (typeof r.raw_control !== 'number' || !Number.isInteger(r.raw_control) || r.raw_control < 0) return '`raw_control` is not a count';
    if (r.findings !== undefined) {
        if (!Array.isArray(r.findings)) return 'a finding is malformed';
        const ok = (f: unknown) => {
            const x = f as Partial<ShadowFinding> | null;
            return typeof x === 'object' && x !== null && typeof x.rule === 'string' && Number.isInteger(x.line) && typeof x.message === 'string' && typeof x.context === 'string';
        };
        if (!r.findings.every(ok)) return 'a finding is malformed';
    }
    if (r.raw_control > 0 && (r.findings?.length ?? 0) !== r.raw_control) return 'a firing row without its findings';
    return null;
}

/**
 * The reverse trigger's reading of one shadow file. Missing, unreadable or
 * partly malformed evidence exits 1 and says so, so it can never be read as a
 * clean window; valid rows beside a rejected one still count.
 */
export function shadowReport(file: string, now: Date, days: number, json: boolean): { out: string; code: number } {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (exc) {
        const missing = (exc as NodeJS.ErrnoException).code === 'ENOENT';
        const why = missing ? `no shadow file at ${file}: nothing was recorded, so there is no window to read` : `shadow file unreadable at ${file}: ${(exc as Error).message}`;
        return { out: json ? `${JSON.stringify({ evidence: missing ? 'none' : 'unreadable', file, reason: why }, null, 2)}\n` : `${why}\n`, code: 1 };
    }
    const rows: ShadowRecord[] = [];
    const rejected: Array<{ line: number; reason: string }> = [];
    text.split('\n').forEach((l, i) => {
        if (l.trim() === '') return;
        let v: unknown;
        try {
            v = JSON.parse(l);
        } catch {
            rejected.push({ line: i + 1, reason: 'not JSON' });
            return;
        }
        const defect = rowDefect(v);
        if (defect === null) rows.push(v as ShadowRecord);
        else rejected.push({ line: i + 1, reason: defect });
    });
    const w = shadowWindow(rows, now, days);
    const code = rejected.length > 0 ? 1 : 0;
    if (json) {
        const evidence = code === 0 ? 'complete' : 'incomplete';
        return { out: `${JSON.stringify({ ...w, evidence, rejected_lines: rejected.map((x) => x.line), rejected }, null, 2)}\n`, code };
    }
    let out = `design-consistency shadow, ${w.days} days since ${w.since}: ${w.writes} UI write(s), ${w.firing} firing.\n`;
    if (rejected.length > 0) {
        out += `${rejected.length} row(s) rejected — the window is incomplete; read those rows before classifying:\n`;
        for (const x of rejected) out += `  line ${x.line}: ${x.reason}\n`;
    }
    for (const f of w.firings) {
        out += `  ${f.at}  ${f.file}${f.head ? `  @${f.head.slice(0, 10)}` : ''}\n`;
        for (const x of f.findings) out += `      L${x.line}  ${x.message}\n      | ${x.context}\n`;
    }
    out += 'Classify each firing write as real or false; false / writes above 1 % returns the rule to shadow.\n';
    return { out, code };
}

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
 * Whether a file of this kind can render the canonical at all. A server
 * template cannot use a JSX `Select`, nor a `.tsx` file a Blade `x-select`;
 * measuring one against the other is a false alarm on every edit to it.
 */
export function canRender(relPath: string, canonical: string): boolean {
    if (canonical.startsWith('native:')) return true;
    if (canonical.startsWith('x-') || canonical.includes(':')) return /\.blade\.php$/i.test(relPath);
    return /\.(jsx|tsx|vue|svelte|astro|mdx)$/i.test(relPath);
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
        if (!entry || entry.canonical === null || !canRender(relPath, entry.canonical)) continue;

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
    if (args.includes('--shadow-report')) {
        const r = shadowReport(path.resolve(SHADOW_REL), asOf(), Number(arg(args, '--days') ?? '14'), json);
        process.stdout.write(r.out);
        return r.code;
    }
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
