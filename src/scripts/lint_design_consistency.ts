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
 * REPORT-ONLY. Exit 0 whatever it finds; 1 on an internal error, and for
 * --shadow-report also when the evidence is missing, empty or incomplete. It runs in
 * shadow (road-to-a-control-that-matches-its-neighbours 3.3) until the
 * activation policy's four conditions hold.
 *
 * Usage:
 *   npx tsx lint_design_consistency.ts --dir <ui src> [--audit <artefact>] [--tolerance <px>] [--json]
 *   npx tsx lint_design_consistency.ts --dir <ui src> --shadow   (records, prints nothing)
 *   npx tsx lint_design_consistency.ts --shadow-report [--days 14] [--json]   (the reverse trigger's reading)
 *   npx tsx lint_design_consistency.ts --render <viewport.styles.json> [--json] [--tolerance <px>] [--shadow]
 */
import fs from 'node:fs';
import path from 'node:path';
import { asOf } from './_lib/as_of.js';
import {
    consistencyFindings,
    SHADOW_REL,
    SHADOW_TOLERANCES_PX,
    shadowRecord,
    type ConsistencyFinding,
    type ControlRoleMap,
    type ShadowFinding,
    type ShadowRecord,
} from './_lib/design_consistency_rules.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

// The rules live in `_lib/design_consistency_rules.ts`, so the hook chunk does not
// carry this CLI; re-exported for every caller that imports them from here.
export {
    canRender,
    consistencyFindings,
    SHADOW_REL,
    SHADOW_TOLERANCES_PX,
    shadowRecord,
    type ConsistencyFinding,
    type ControlRoleMap,
    type ShadowFinding,
    type ShadowRecord,
} from './_lib/design_consistency_rules.js';

export const AUDIT_ARTEFACT_REL = path.join('agents', 'runtime', 'state', 'ui-audit.json');

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

/** Why a parsed row cannot be read as evidence, or null when it can. */
const SHADOW_RULES: ReadonlySet<string> = new Set<ConsistencyFinding['rule']>(['consistency-raw-control', 'consistency-sibling-metrics']);

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
            return typeof x === 'object' && x !== null && SHADOW_RULES.has(x.rule as string) && Number.isInteger(x.line) && (x.line as number) > 0 && typeof x.message === 'string' && typeof x.context === 'string';
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
    // No write in the window proves the parser, not the recording: never a clean window.
    const empty = w.writes === 0;
    const code = rejected.length > 0 || empty ? 1 : 0;
    if (json) {
        const evidence = rejected.length > 0 ? 'incomplete' : empty ? 'empty' : 'complete';
        return { out: `${JSON.stringify({ ...w, evidence, rejected_lines: rejected.map((x) => x.line), rejected }, null, 2)}\n`, code };
    }
    let out = `design-consistency shadow, ${w.days} days since ${w.since}: ${w.writes} UI write(s), ${w.firing} firing.\n`;
    if (empty) out += 'no UI write recorded in the window: no observations, which is not a clean window; check the recording is on.\n';
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

/** The `control_roles` of a `ui:audit` artefact, or null when none is readable. */
export function loadControlRoles(artefactPath: string): ControlRoleMap | null {
    try {
        const parsed = JSON.parse(fs.readFileSync(artefactPath, 'utf8')) as { control_roles?: ControlRoleMap };
        return parsed.control_roles ?? null;
    } catch {
        return null;
    }
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
