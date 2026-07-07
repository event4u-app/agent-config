#!/usr/bin/env tsx
/**
 * Per-pinned-section renderer for the curated composite `docs/benchmark.md`
 * (road-to-flow-learnings Phase 3).
 *
 * The composite is DELIBERATELY not a single-latest-report render (a
 * single-report render would bury one host's finding — the in-file rationale
 * stands). This script keeps that decision and removes only the manual
 * table-editing step: each `<!-- pinned:<id> -->` … `<!-- /pinned:<id> -->`
 * marker region in the doc is regenerated INDEPENDENTLY from ITS pinned
 * report (`docs/benchmark.pinned.yml`); every line outside the markers —
 * curated headings, verdict framing, findings prose, the history section —
 * is preserved byte-for-byte.
 *
 * Section modes:
 *   - `honesty-labels`  — the generated "Honesty labels" block.
 *   - `stats-body`      — the full generated stats body (verdict bullets +
 *                         interpretation + tables + methodology).
 *   - `compact-table`   — one 3-row capability/discipline/tokens table for
 *                         `package` vs `vanilla`.
 *   - `arm-cost-table`  — the per-arm cost-factor table (lift per arm vs
 *                         vanilla; labels curated in the manifest).
 *
 * Deterministic: same pinned inputs → byte-identical output. Pinned reports
 * are operator-local (untracked); when a report is missing the script exits
 * 0 with a skip notice so CI stays green — it can only verify where the
 * pinned inputs exist.
 *
 * Exit: 0 ok/skip · 1 `--check` drift · 2 config error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { analyse, compare, gate_verdict, mean_tokens_by_arm, to_markdown } from './bench_ab_v2_stats.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'benchmark.md');
const MANIFEST_PATH = path.join(REPO_ROOT, 'docs', 'benchmark.pinned.yml');

type Dict = Record<string, unknown>;

export class CompositeConfigError extends Error {}

export interface PinnedSection {
    readonly id: string;
    readonly report: string;
    readonly mode: 'honesty-labels' | 'stats-body' | 'compact-table' | 'arm-cost-table';
    /** arm-cost-table only: ordered arm list with curated labels. */
    readonly arms?: ReadonlyArray<{ id: string; label: string }>;
}

export function parseManifest(text: string): PinnedSection[] {
    const raw = parseYaml(text) as Dict | null;
    const sections = raw?.['sections'];
    if (!Array.isArray(sections) || sections.length === 0) {
        throw new CompositeConfigError('`sections:` must be a non-empty list');
    }
    const modes = new Set(['honesty-labels', 'stats-body', 'compact-table', 'arm-cost-table']);
    return sections.map((s, i) => {
        const e = s as Dict;
        const id = String(e['id'] ?? '');
        const report = String(e['report'] ?? '');
        const mode = String(e['mode'] ?? '');
        if (!id || !report || !modes.has(mode)) {
            throw new CompositeConfigError(`sections[${i}] needs id, report, and a valid mode`);
        }
        const armsRaw = e['arms'];
        let arms: Array<{ id: string; label: string }> | undefined;
        if (armsRaw !== undefined) {
            if (!Array.isArray(armsRaw)) {
                throw new CompositeConfigError(`sections[${i}].arms must be a list`);
            }
            arms = armsRaw.map((a) => {
                const ar = a as Dict;
                return { id: String(ar['id'] ?? ''), label: String(ar['label'] ?? '') };
            });
        }
        return { id, report, mode: mode as PinnedSection['mode'], ...(arms ? { arms } : {}) };
    });
}

// ---------------------------------------------------------------------------
// Section renderers — every value comes from the section's OWN pinned report.
// ---------------------------------------------------------------------------

function loadReport(reportPath: string): { analysis: Dict; payload: Dict } {
    const payload = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as Dict;
    const analysis = analyse(payload);
    // Mirror the stats CLI: the gate verdict is merged before rendering.
    analysis['gate'] = gate_verdict(analysis);
    return { analysis, payload };
}

/** Unwrap the stats module's PyFloat wrapper (duck-typed — the class is private). */
function num(v: unknown): number {
    if (v !== null && typeof v === 'object' && 'value' in (v as Dict)) {
        return Number((v as { value: unknown }).value);
    }
    return Number(v);
}

/** Python float repr for p-values / effect sizes: `1` → `1.0`, `0.81` → `0.81`. */
function pyf(v: unknown): string {
    const n = num(v);
    if (!Number.isFinite(n)) return String(n);
    return Number.isInteger(n) ? `${n}.0` : String(n);
}

/** Slice a generated full render between two headings (end exclusive of next `## `). */
function sliceFrom(md: string, startHeadingPrefix: string, includeHeading: boolean): string {
    const lines = md.split('\n');
    const start = lines.findIndex((l) => l.startsWith(startHeadingPrefix));
    if (start < 0) {
        throw new CompositeConfigError(`generated render lacks heading ${startHeadingPrefix}`);
    }
    return lines.slice(includeHeading ? start : start + 1).join('\n').trimEnd();
}

export function renderHonestyLabels(reportPath: string): string {
    const { analysis, payload } = loadReport(reportPath);
    const md = to_markdown(analysis, payload);
    const lines = md.split('\n');
    const start = lines.findIndex((l) => l.startsWith('## Honesty labels'));
    const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
    if (start < 0 || end < 0) {
        throw new CompositeConfigError('generated render lacks the honesty-labels block');
    }
    // Body only — the curated doc owns the section heading.
    return lines.slice(start + 1, end).join('\n').trim();
}

export function renderStatsBody(reportPath: string): string {
    const { analysis, payload } = loadReport(reportPath);
    const md = to_markdown(analysis, payload);
    // Everything from the verdict bullets (line after `## Gate verdict`) to EOF:
    // verdict bullets + interpretation + per-arm tables + status buckets +
    // methodology. The curated doc supplies its own retitled section heading.
    return sliceFrom(md, '## Gate verdict:', false).trim();
}

const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-US');

function armRuns(rec: Dict, arm: string): Dict[] {
    const runs = (rec['arms'] as Dict | undefined)?.[arm];
    return Array.isArray(runs) ? (runs as Dict[]) : [];
}

function disciplineMean(records: Dict[], arm: string): number {
    let sum = 0;
    let n = 0;
    for (const rec of records) {
        for (const r of armRuns(rec, arm)) {
            if (r['errored']) continue;
            const d = Number(r['discipline_score'] ?? NaN);
            if (Number.isFinite(d)) {
                sum += d;
                n += 1;
            }
        }
    }
    return n > 0 ? sum / n : 0;
}

function meanTokens(records: Dict[], arm: string): number {
    const per = mean_tokens_by_arm(records, [arm]) as Dict;
    return Number((per[arm] as Dict | undefined)?.['mean_tokens'] ?? 0);
}

export function renderCompactTable(reportPath: string): string {
    const { payload } = loadReport(reportPath);
    const records = (payload['records'] as Dict[] | undefined) ?? [];
    const host = String(payload['model'] ?? 'unknown');
    const cmp = compare(records, 'package', 'vanilla') as Dict;
    const nPairs = Number(cmp['n_pairs'] ?? 0);
    const cap = cmp['capability'] as Dict;
    const disc = cmp['discipline'] as Dict;
    const tv = meanTokens(records, 'vanilla');
    const tp = meanTokens(records, 'package');
    const capB = num(cap['rate_baseline']);
    const capT = num(cap['rate_treatment']);
    const discB = num(disc['mean_baseline']);
    const discT = num(disc['mean_treatment']);
    const dPP = Math.round((capT - capB) * 100);
    const ratio = tv > 0 ? ` (~${Math.round(tp / tv)}×)` : '';
    const sign = (v: number, f: (x: number) => string): string =>
        v < 0 ? `−${f(Math.abs(v))}` : `+${f(v)}`;
    return [
        `| axis | vanilla | package | Δ | test |`,
        `|---|---|---|---|---|`,
        `| capability (pass-rate) | ${Math.round(capB * 100)}% | ${Math.round(capT * 100)}% | ` +
            `${sign(dPP, (x) => String(x))}pp | McNemar p=${pyf(cap['mcnemar_p'])}, h=${pyf(cap['cohens_h'])} |`,
        `| discipline (0–1) | ${discB.toFixed(3)} | ${discT.toFixed(3)} | ` +
            `${sign(discT - discB, (x) => x.toFixed(3))} | Wilcoxon p=${pyf(disc['wilcoxon_p'])}, ` +
            `rb=${pyf(disc['rank_biserial'])} (n≠0=${disc['n_nonzero']}) |`,
        `| mean tokens/run | ${fmtInt(tv)} | ${fmtInt(tp)} | ${sign(tp - tv, fmtInt)}${ratio} | — |`,
        ``,
        `(host \`${host}\`, n=${nPairs} pairs — generated from the pinned report)`,
    ].join('\n');
}

export function renderArmCostTable(
    reportPath: string,
    arms: ReadonlyArray<{ id: string; label: string }>,
): string {
    const { payload } = loadReport(reportPath);
    const records = (payload['records'] as Dict[] | undefined) ?? [];
    const baseTokens = meanTokens(records, 'vanilla');
    const rows: string[] = [
        `| arm | loaded content | injected chars | mean tokens/run | cost factor | mean discipline | lift vs vanilla |`,
        `|---|---|---|---|---|---|---|`,
    ];
    for (const arm of arms) {
        const t = meanTokens(records, arm.id);
        const factor = baseTokens > 0 ? (t / baseTokens).toFixed(1) : '?';
        const disc = disciplineMean(records, arm.id);
        let injected = 0;
        for (const rec of records) {
            for (const r of armRuns(rec, arm.id)) {
                injected = Math.max(injected, Number(r['injected_chars'] ?? 0));
            }
        }
        if (arm.id === 'vanilla') {
            rows.push(
                `| \`vanilla\` | ${arm.label} | 0 | ${fmtInt(t)} | 1.0× | ${disc.toFixed(3)} | — |`,
            );
            continue;
        }
        const cmp = compare(records, arm.id, 'vanilla') as Dict;
        const d = cmp['discipline'] as Dict;
        const delta = num(d['mean_delta']);
        const p = num(d['wilcoxon_p']);
        const deltaStr = `${delta < 0 ? '−' : '+'}${Math.abs(delta).toFixed(3)}`;
        const lift =
            p < 0.05
                ? `**${deltaStr} (p=${pyf(d['wilcoxon_p'])}, significant)**`
                : `${deltaStr} (p=${pyf(d['wilcoxon_p'])}, **NULL**)`;
        rows.push(
            `| \`${arm.id}\` | ${arm.label} | ${fmtInt(injected)} | ${fmtInt(t)} | ` +
                `**${factor}×** | ${disc.toFixed(3)} | ${lift} |`,
        );
    }
    rows.push('');
    rows.push('(generated from the pinned report — curated labels from `docs/benchmark.pinned.yml`)');
    return rows.join('\n');
}

export function renderSection(section: PinnedSection, repoRoot: string = REPO_ROOT): string {
    const reportPath = path.isAbsolute(section.report)
        ? section.report
        : path.join(repoRoot, section.report);
    switch (section.mode) {
        case 'honesty-labels':
            return renderHonestyLabels(reportPath);
        case 'stats-body':
            return renderStatsBody(reportPath);
        case 'compact-table':
            return renderCompactTable(reportPath);
        case 'arm-cost-table':
            if (!section.arms || section.arms.length === 0) {
                throw new CompositeConfigError(`section '${section.id}' (arm-cost-table) needs arms`);
            }
            return renderArmCostTable(reportPath, section.arms);
    }
}

// ---------------------------------------------------------------------------
// Marker splice — pure, unit-tested.
// ---------------------------------------------------------------------------

export function markerBounds(id: string): [string, string] {
    return [`<!-- pinned:${id} -->`, `<!-- /pinned:${id} -->`];
}

/**
 * Replace every marker region with its rendered content; everything outside
 * the markers is preserved byte-for-byte. Throws on a missing or unbalanced
 * marker so drift never passes silently.
 */
export function spliceMarkers(doc: string, contentById: ReadonlyMap<string, string>): string {
    let out = doc;
    for (const [id, content] of contentById) {
        const [begin, end] = markerBounds(id);
        const b = out.indexOf(begin);
        const e = out.indexOf(end);
        if (b < 0 || e < 0 || e < b) {
            throw new CompositeConfigError(`marker pair for '${id}' missing or unbalanced in the doc`);
        }
        out = `${out.slice(0, b + begin.length)}\n${content}\n${out.slice(e)}`;
    }
    return out;
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

const USAGE = 'usage: render_benchmark_composite [-h] [--check]\n';

export function main(argv: string[] | null = null): number {
    const args = argv !== null ? Array.from(argv) : process.argv.slice(2);
    let check = false;
    for (const a of args) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            return 0;
        }
        if (a === '--check') {
            check = true;
        } else {
            process.stderr.write(USAGE);
            return 2;
        }
    }
    let sections: PinnedSection[];
    try {
        sections = parseManifest(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    } catch (exc) {
        process.stderr.write(`render_benchmark_composite: error: ${(exc as Error).message}\n`);
        return 2;
    }
    const missing = sections.filter(
        (s) => !fs.existsSync(path.isAbsolute(s.report) ? s.report : path.join(REPO_ROOT, s.report)),
    );
    if (missing.length > 0) {
        process.stdout.write(
            `render_benchmark_composite: SKIP — pinned report(s) not present locally ` +
                `(${missing.map((m) => m.id).join(', ')}); nothing rendered.\n`,
        );
        return 0;
    }
    const contentById = new Map<string, string>();
    try {
        for (const s of sections) {
            contentById.set(s.id, renderSection(s));
        }
        const doc = fs.readFileSync(DOC_PATH, 'utf-8');
        const next = spliceMarkers(doc, contentById);
        if (check) {
            if (next !== doc) {
                process.stderr.write(
                    'render_benchmark_composite: DRIFT — docs/benchmark.md pinned sections ' +
                        'do not match their pinned reports; re-run without --check.\n',
                );
                return 1;
            }
            process.stdout.write('render_benchmark_composite: clean — pinned sections match.\n');
            return 0;
        }
        if (next !== doc) {
            fs.writeFileSync(DOC_PATH, next);
            process.stdout.write(`render_benchmark_composite: wrote docs/benchmark.md (${contentById.size} section(s)).\n`);
        } else {
            process.stdout.write('render_benchmark_composite: no changes.\n');
        }
        return 0;
    } catch (exc) {
        if (exc instanceof CompositeConfigError) {
            process.stderr.write(`render_benchmark_composite: error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main(process.argv.slice(2));
}
