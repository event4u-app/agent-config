/**
 * Showcase replay (road-to-a-baseline-that-has-to-catch-up step 5.1): re-grade
 * the artifacts a committed bundle kept, at 0 USD — no host, no network.
 *
 * Every bundle is loaded through `loadBundle`, so integrity (sha256 of every
 * kept file) and the derived fields (median, infra-error count, k runs) are
 * re-checked first. Then each run whose kept artifact IS the deliverable is
 * graded again by the task's primary grader and compared with what the bundle
 * recorded. Today that is the SVG render gate: an SVG task keeps its SVG. A
 * task whose bundle keeps only a screenshot cannot be re-graded from it; those
 * runs are reported `not-regradable`, never counted as reproduced.
 *
 * Verdict: `mismatch` when any re-grade disagrees, `reproduced` when at least
 * one run was re-graded and all agree, `INDETERMINATE` when nothing could be
 * re-graded (including: no bundles at all) — never green on no data.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { load_artifact_corpus, type ArtifactTask } from './bench_artifact_corpus.js';
import { fold } from './bench_artifact_graders.js';
import { svg_render_gate } from './bench_artifact_svg_gate.js';
import { loadBundle } from './showcase_bundle.js';

export type ReplayRunStatus = 'reproduced' | 'mismatch' | 'not-regradable' | 'infra-error';
export type ReplayVerdict = 'reproduced' | 'mismatch' | 'INDETERMINATE';

export interface ReplayRun {
    arm: string;
    run: number;
    status: ReplayRunStatus;
    recorded: { score: number | null; passed: boolean | null };
    regraded: { score: number | null; passed: boolean | null } | null;
    detail?: string;
}

export interface ReplayBundle {
    name: string;
    task: string;
    grader: string;
    runs: ReplayRun[];
}

export interface ReplayReport {
    bundles: ReplayBundle[];
    problems: string[];
    regraded: number;
    mismatches: number;
    verdict: ReplayVerdict;
}

export interface ReplayOptions {
    bundles: string;
    corpus: string;
    allowFixture: boolean;
}

const BUNDLE_DIR_RE = /^[0-9]{8}T[0-9]{6}Z-art-[a-z0-9-]+$/;
const SCORE_EPS = 1e-9;

function regrade(dir: string, thumbnail: string, task: ArtifactTask | undefined, grader: string, bar: number): ReplayRun['regraded'] | string {
    if (grader !== 'svg-render-gate' || !thumbnail.endsWith('.svg')) return `${grader} cannot be re-graded from a kept ${path.extname(thumbnail) || 'file'}`;
    const args = (task?.graders.find((g) => g.role === 'primary')?.args ?? {}) as { palette?: string[]; palette_min?: number };
    const r = fold(grader, 'primary', svg_render_gate(fs.readFileSync(path.join(dir, thumbnail), 'utf-8'), args));
    return { score: r.score, passed: r.score === null ? null : r.score >= bar };
}

export function replayBundles(opts: ReplayOptions): ReplayReport {
    const problems: string[] = [];
    const tasks = new Map<string, ArtifactTask>();
    try {
        for (const t of load_artifact_corpus(opts.corpus)) tasks.set(t.id, t);
    } catch (e) {
        problems.push(`corpus: ${(e as Error).message}`);
    }
    const dirs = fs.existsSync(opts.bundles)
        ? fs.readdirSync(opts.bundles, { withFileTypes: true }).filter((d) => d.isDirectory() && BUNDLE_DIR_RE.test(d.name)).map((d) => d.name).sort()
        : [];
    const bundles: ReplayBundle[] = [];
    for (const name of dirs) {
        const dir = path.join(opts.bundles, name);
        const { bundle, problems: p } = loadBundle(dir);
        problems.push(...p);
        if (bundle === null) continue;
        const s = bundle.summary;
        if (s.fixture && !opts.allowFixture) {
            problems.push(`${name}: fixture bundle in the evidence tree — pass --allow-fixture only for a fixture root`);
            continue;
        }
        const out: ReplayBundle = { name, task: s.task.id, grader: s.task.primary_grader, runs: [] };
        for (const arm of s.arms) {
            for (const run of arm.runs) {
                const recorded = { score: run.score, passed: run.passed };
                if (run.infra_error !== null) {
                    out.runs.push({ arm: arm.id, run: run.run, status: 'infra-error', recorded, regraded: null, detail: run.infra_error });
                    continue;
                }
                if (run.thumbnail === null) {
                    out.runs.push({ arm: arm.id, run: run.run, status: 'not-regradable', recorded, regraded: null, detail: 'no artifact kept' });
                    continue;
                }
                const g = regrade(dir, run.thumbnail, tasks.get(s.task.id), s.task.primary_grader, s.task.parity_bar.value);
                if (typeof g === 'string') {
                    out.runs.push({ arm: arm.id, run: run.run, status: 'not-regradable', recorded, regraded: null, detail: g });
                    continue;
                }
                const same =
                    g?.passed === recorded.passed &&
                    (g?.score === null ? recorded.score === null : recorded.score !== null && Math.abs((g?.score as number) - recorded.score) < SCORE_EPS);
                out.runs.push({ arm: arm.id, run: run.run, status: same ? 'reproduced' : 'mismatch', recorded, regraded: g });
            }
        }
        bundles.push(out);
    }
    const all = bundles.flatMap((b) => b.runs);
    const mismatches = all.filter((r) => r.status === 'mismatch').length;
    const regraded = all.filter((r) => r.status === 'reproduced' || r.status === 'mismatch').length;
    const verdict: ReplayVerdict = mismatches > 0 ? 'mismatch' : regraded > 0 ? 'reproduced' : 'INDETERMINATE';
    return { bundles, problems, regraded, mismatches, verdict };
}

const num = (n: number | null): string => (n === null ? 'unknown' : String(Number(n.toFixed(4))));

export function renderReplay(r: ReplayReport): string {
    const L: string[] = [];
    if (r.bundles.length === 0) L.push('showcase replay: no bundles — INDETERMINATE (nothing was re-graded; this is not a pass)');
    for (const b of r.bundles) {
        L.push(`${b.name} (${b.grader})`);
        for (const run of b.runs) {
            const re = run.regraded ? ` → re-graded ${num(run.regraded.score)}` : '';
            L.push(`  ${run.arm.padEnd(10)} run ${run.run}: ${run.status.padEnd(15)} recorded ${num(run.recorded.score)}${re}${run.detail ? ` — ${run.detail}` : ''}`);
        }
    }
    for (const p of r.problems) L.push(`problem: ${p}`);
    L.push(`verdict: ${r.verdict} — ${r.regraded} run(s) re-graded, ${r.mismatches} mismatch(es), 0 USD`);
    L.push(`scanned: ${r.regraded}`);
    return L.join('\n') + '\n';
}
