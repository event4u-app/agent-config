#!/usr/bin/env tsx
/**
 * rdp_candidates_delta.ts — step 3.2's two numbers, computed from the two
 * stored runs rather than asserted.
 *
 * Reads a baseline results file and a treatment results file in the envelope
 * `rdp_quality_eval` writes, joins them on slot plus variant name, and prints:
 *
 *   - the dim-5 delta, INTENTION-TO-TREAT: every treatment transcript against
 *     every baseline transcript on the same 16 slots. This is the primary
 *     reading, and it is primary on the 2026-09-08 council's instruction:
 *     conditioning on whether the model complied selects treatment outputs on
 *     post-treatment behaviour and biases the estimate. The compliance-
 *     conditioned figure is printed too, labelled exploratory.
 *   - the dim-1 reading on both arms. Dim 1 is the notes-first tripwire: dim 5
 *     rising while dim 1 falls means the line is being emitted into the reply
 *     instead of the notes, which is the third outcome step 3.3 must name
 *     rather than round away.
 *   - the output-token delta on the single-step (`ss`) slots, which are this
 *     corpus's trivial-task proxy and therefore where the published ~5 %
 *     L10 cost guard (`tests/reasoning-layer-eval/README.md` § Fail
 *     conditions) applies.
 *
 * A NOTE ON WHICH OVERHEAD THIS IS, because the corpus carries two and they
 * are not the same number. `output_token_overhead_pct` stored in each run is
 * arm-versus-arm WITHIN that run (orchestrated vs distributed). What step 3.2
 * asks for is treatment-versus-baseline, which no stored field holds, so it is
 * computed here from raw `output_tokens` on both sides.
 *
 * Exit: 0 printed · 1 usage/IO error · 2 a join hole (a slot or variant present
 * on one side and not the other — a delta over a partial join is not a delta).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkReport } from './check_candidate_lines.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

interface Variant {
    text?: string;
    output_tokens?: number;
    score?: Record<string, unknown>;
}

interface Record_ {
    slot: string;
    slug?: string;
    mechanism?: string;
    variants?: Record<string, Variant>;
}

interface Run {
    date?: string;
    mode?: string;
    scorer_model?: string | null;
    actual_cost_usd?: number;
    results?: Record_[];
}

export interface Cell {
    slot: string;
    slug: string;
    family: 'ms' | 'ss';
    variant: string;
    dim1: number | null;
    dim5: number | null;
    outputTokens: number | null;
    /** Treatment side only: did the transcript actually carry a clean line? */
    complied: boolean;
}

function familyOf(r: Record_): 'ms' | 'ss' {
    if (r.mechanism === 'stateless') return 'ss';
    if (r.mechanism === 'multi-stage') return 'ms';
    return (r.slug ?? '').startsWith('ss-') ? 'ss' : 'ms';
}

function num(v: unknown): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export function flatten(run: Run, measureCompliance: boolean): Cell[] {
    const out: Cell[] = [];
    for (const r of run.results ?? []) {
        for (const [variant, v] of Object.entries(r.variants ?? {})) {
            let complied = false;
            if (measureCompliance && typeof v.text === 'string' && v.text !== '') {
                const verdict = checkReport(v.text);
                complied = verdict.lines.length > 0 && verdict.findings.length === 0;
            }
            out.push({
                slot: r.slot,
                slug: r.slug ?? '',
                family: familyOf(r),
                variant,
                dim1: num(v.score?.dim1),
                dim5: num(v.score?.dim5),
                outputTokens: num(v.output_tokens),
                complied,
            });
        }
    }
    return out;
}

const mean = (xs: number[]): number | null =>
    xs.length === 0 ? null : Math.round((xs.reduce((p, c) => p + c, 0) / xs.length) * 1000) / 1000;

const fmt = (x: number | null, digits = 3): string => (x === null ? 'n/a' : x.toFixed(digits));

export interface Report {
    lines: string[];
    joinHoles: string[];
}

export function compare(base: Run, treat: Run): Report {
    const b = flatten(base, false);
    const t = flatten(treat, true);
    const key = (c: Cell): string => `${c.slot}/${c.variant}`;
    const bMap = new Map(b.map((c) => [key(c), c]));
    const tMap = new Map(t.map((c) => [key(c), c]));

    const joinHoles: string[] = [];
    for (const k of bMap.keys()) if (!tMap.has(k)) joinHoles.push(`treatment missing ${k}`);
    for (const k of tMap.keys()) if (!bMap.has(k)) joinHoles.push(`baseline missing ${k}`);

    const paired = [...bMap.keys()].filter((k) => tMap.has(k)).sort();
    const L: string[] = [];

    L.push(`baseline:  ${base.mode ?? '?'} · ${String((base.results ?? []).length)} slot(s) · rater ${base.scorer_model ?? '?'}`);
    L.push(`treatment: ${treat.mode ?? '?'} · ${String((treat.results ?? []).length)} slot(s) · rater ${treat.scorer_model ?? '?'}`);
    L.push(`paired transcripts: ${String(paired.length)}`);
    L.push('');

    // ---- dim5, intention-to-treat (primary) ---------------------------------
    const bDim5 = paired.map((k) => (bMap.get(k) as Cell).dim5).filter((x): x is number => x !== null);
    const tDim5 = paired.map((k) => (tMap.get(k) as Cell).dim5).filter((x): x is number => x !== null);
    const bM = mean(bDim5);
    const tM = mean(tDim5);
    L.push('dim5 — form-alternative surfacing (INTENTION-TO-TREAT, primary)');
    L.push(`  baseline  mean ${fmt(bM)} / 3   (${bM === null ? 'n/a' : ((bM / 3) * 100).toFixed(1)} %)  n=${String(bDim5.length)}`);
    L.push(`  treatment mean ${fmt(tM)} / 3   (${tM === null ? 'n/a' : ((tM / 3) * 100).toFixed(1)} %)  n=${String(tDim5.length)}`);
    if (bM !== null && tM !== null) {
        const dPts = Math.round((tM - bM) * 1000) / 1000;
        const dPp = Math.round(((tM - bM) / 3) * 1000) / 10;
        L.push(`  delta          ${dPts > 0 ? '+' : ''}${fmt(dPts)} / 3   (${dPp > 0 ? '+' : ''}${dPp.toFixed(1)} pp of the 0-3 scale)`);
    }
    const bZero = bDim5.filter((x) => x === 0).length;
    const tZero = tDim5.filter((x) => x === 0).length;
    L.push(`  scoring 0 (one form only): baseline ${String(bZero)}/${String(bDim5.length)} → treatment ${String(tZero)}/${String(tDim5.length)}`);
    const bTop = bDim5.filter((x) => x >= 2).length;
    const tTop = tDim5.filter((x) => x >= 2).length;
    L.push(`  scoring >= 2:              baseline ${String(bTop)}/${String(bDim5.length)} → treatment ${String(tTop)}/${String(tDim5.length)}`);
    L.push('');

    // ---- dim1, the tripwire -------------------------------------------------
    const bDim1 = paired.map((k) => (bMap.get(k) as Cell).dim1).filter((x): x is number => x !== null);
    const tDim1 = paired.map((k) => (tMap.get(k) as Cell).dim1).filter((x): x is number => x !== null);
    const b1 = mean(bDim1);
    const t1 = mean(tDim1);
    L.push('dim1 — notes-first adherence (TRIPWIRE: dim5 up while dim1 down = the line is in the reply)');
    L.push(`  baseline  mean ${fmt(b1)} / 3    treatment mean ${fmt(t1)} / 3` +
        (b1 !== null && t1 !== null ? `    delta ${t1 - b1 > 0 ? '+' : ''}${fmt(Math.round((t1 - b1) * 1000) / 1000)}` : ''));
    L.push('');

    // ---- compliance (exploratory) ------------------------------------------
    const complied = paired.filter((k) => (tMap.get(k) as Cell).complied);
    L.push('compliance — a well-formed Candidates line, zero shape findings');
    L.push(`  ${String(complied.length)} / ${String(paired.length)} treatment transcript(s)` +
        ` (${paired.length === 0 ? 'n/a' : ((complied.length / paired.length) * 100).toFixed(1)} %)`);
    const cDim5 = complied.map((k) => (tMap.get(k) as Cell).dim5).filter((x): x is number => x !== null);
    const cM = mean(cDim5);
    L.push(`  dim5 among compliant: ${fmt(cM)} / 3  n=${String(cDim5.length)}   [EXPLORATORY — conditioning on`);
    L.push('    post-treatment behaviour biases the estimate; the ITT figure above is primary]');
    L.push('');

    // ---- per family ---------------------------------------------------------
    L.push('dim5 by family');
    for (const fam of ['ms', 'ss'] as const) {
        const ks = paired.filter((k) => (bMap.get(k) as Cell).family === fam);
        const bf = mean(ks.map((k) => (bMap.get(k) as Cell).dim5).filter((x): x is number => x !== null));
        const tf = mean(ks.map((k) => (tMap.get(k) as Cell).dim5).filter((x): x is number => x !== null));
        L.push(`  ${fam}: baseline ${fmt(bf)} → treatment ${fmt(tf)}` +
            (bf !== null && tf !== null ? `   delta ${tf - bf > 0 ? '+' : ''}${fmt(Math.round((tf - bf) * 1000) / 1000)}` : '') +
            `   n=${String(ks.length)}`);
    }
    L.push('');

    // ---- ss output-token overhead, treatment vs baseline -------------------
    L.push('output-token overhead on the ss (single-step) slots — treatment vs baseline');
    L.push('  the L10 cost guard is ~5 % on the trivial proxy (README.md § Fail conditions)');
    const ssKeys = paired.filter((k) => (bMap.get(k) as Cell).family === 'ss');
    const perSlot: number[] = [];
    for (const k of ssKeys) {
        const bo = (bMap.get(k) as Cell).outputTokens;
        const to = (tMap.get(k) as Cell).outputTokens;
        if (bo === null || to === null || bo === 0) continue;
        const pct = Math.round(((to - bo) / bo) * 1000) / 10;
        perSlot.push(pct);
        L.push(`    ${k.padEnd(18)} ${String(bo).padStart(5)} → ${String(to).padStart(5)}  ${pct > 0 ? '+' : ''}${pct.toFixed(1)} %`);
    }
    const ssMean = mean(perSlot);
    L.push(`  mean per-slot overhead: ${ssMean === null ? 'n/a' : `${ssMean > 0 ? '+' : ''}${ssMean.toFixed(1)} %`}  n=${String(perSlot.length)}`);
    // Aggregate too: a mean of per-slot percentages is dominated by small
    // denominators, so the token-weighted figure is printed beside it rather
    // than instead of it.
    const bTot = ssKeys.reduce((p, k) => p + ((bMap.get(k) as Cell).outputTokens ?? 0), 0);
    const tTot = ssKeys.reduce((p, k) => p + ((tMap.get(k) as Cell).outputTokens ?? 0), 0);
    if (bTot > 0) {
        const agg = Math.round(((tTot - bTot) / bTot) * 1000) / 10;
        L.push(`  token-weighted overhead: ${agg > 0 ? '+' : ''}${agg.toFixed(1)} %  (${String(bTot)} → ${String(tTot)} output tokens)`);
    }

    return { lines: L, joinHoles };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const bIdx = argv.indexOf('--baseline');
    const tIdx = argv.indexOf('--treatment');
    const bPath = bIdx === -1 ? undefined : argv[bIdx + 1];
    const tPath = tIdx === -1 ? undefined : argv[tIdx + 1];
    if (bPath === undefined || tPath === undefined) {
        process.stderr.write('usage: rdp_candidates_delta --baseline <results.json> --treatment <results.json>\n');
        return 1;
    }
    let base: Run;
    let treat: Run;
    try {
        base = JSON.parse(fs.readFileSync(path.resolve(bPath), 'utf-8')) as Run;
        treat = JSON.parse(fs.readFileSync(path.resolve(tPath), 'utf-8')) as Run;
    } catch (e) {
        process.stderr.write(`cannot read inputs: ${String(e)}\n`);
        return 1;
    }

    const rep = compare(base, treat);
    process.stdout.write(`${rep.lines.join('\n')}\n`);

    const paired = rep.lines.find((l) => l.startsWith('paired transcripts:'));
    const n = paired ? Number(paired.split(':')[1]) : 0;
    try {
        assertScanned({
            gate: 'rdp_candidates_delta',
            scanned: n,
            units: 'paired transcript(s)',
            roots: [bPath, tPath],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 1;
        }
        throw e;
    }

    if (rep.joinHoles.length > 0) {
        process.stderr.write(`\n❌  ${String(rep.joinHoles.length)} join hole(s) — a delta over a partial join is not a delta:\n`);
        for (const h of rep.joinHoles) process.stderr.write(`    ${h}\n`);
        return 2;
    }
    process.stdout.write(`\nscanned: ${String(n)}\n`);
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}

export { REPO_ROOT };
