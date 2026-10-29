/**
 * Grader self-test: before a grader scores any arm, it must
 * separate its task's planted good reference from the planted bad one.
 *
 * Each reference is an overlay under `oracle-artifact/<id>/{good,bad}/`,
 * applied onto a fresh copy of the fixture — the same starting point an arm
 * gets. `separates` = good passes and bad fails. A grader that cannot tell them
 * apart is `fails` and blocks the run. A grader whose toolchain is absent
 * (no php, no browser) is `skipped(<reason>)`, never counted as separating.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { ArtifactTask } from './bench_artifact_corpus.js';
import { AB_ROOT, grade_primary, type GradeOpts, type GraderResult } from './bench_artifact_graders.js';

export interface SelfTestRow {
    task: string;
    grader: string;
    verdict: 'separates' | 'fails' | 'skipped';
    reason?: string;
    good: { status: GraderResult['status']; score: number | null };
    bad: { status: GraderResult['status']; score: number | null };
}

export const ORACLE_ARTIFACT_ROOT = path.join(AB_ROOT, 'oracle-artifact');

async function grade_overlay(task: ArtifactTask, overlay: string, opts: GradeOpts): Promise<GraderResult> {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), `bench-selftest-${task.id}-`));
    try {
        fs.cpSync(path.join(AB_ROOT, task.fixture), ws, { recursive: true });
        if (fs.existsSync(overlay)) fs.cpSync(overlay, ws, { recursive: true });
        return await grade_primary(ws, task, opts);
    } finally {
        fs.rmSync(ws, { recursive: true, force: true });
    }
}

export async function selftest_task(task: ArtifactTask, opts: GradeOpts & { oracle_root?: string; swap?: boolean } = {}): Promise<SelfTestRow> {
    const root = path.join(opts.oracle_root ?? ORACLE_ARTIFACT_ROOT, task.id);
    const [goodDir, badDir] = opts.swap ? [path.join(root, 'bad'), path.join(root, 'good')] : [path.join(root, 'good'), path.join(root, 'bad')];
    const grader = task.graders.find((g) => g.role === 'primary')?.id ?? '?';
    if (!fs.existsSync(goodDir) || !fs.existsSync(badDir)) {
        const none = { status: 'unknown' as const, score: null };
        return { task: task.id, grader, good: none, bad: none, verdict: 'fails', reason: 'missing planted good/bad reference' };
    }
    const good = await grade_overlay(task, goodDir, opts);
    const bad = await grade_overlay(task, badDir, opts);
    const row = { task: task.id, grader, good: { status: good.status, score: good.score }, bad: { status: bad.status, score: bad.score } };
    if (good.status === 'unknown' || bad.status === 'unknown') {
        return { ...row, verdict: 'skipped', reason: (good.status === 'unknown' ? good.reason : bad.reason) ?? 'unmeasured' };
    }
    if (good.status === 'pass' && bad.status === 'fail') return { ...row, verdict: 'separates' };
    const failing = good.checks.filter((c) => c.status === 'fail').map((c) => c.id);
    return { ...row, verdict: 'fails', reason: `good=${good.status}${failing.length ? ` (${failing.join(',')})` : ''} bad=${bad.status}` };
}

export function render_rows(rows: SelfTestRow[]): string {
    return rows
        .map((r) => {
            const v = r.verdict === 'skipped' ? `skipped(${r.reason})` : r.verdict === 'fails' ? `FAILS — ${r.reason}` : 'separates';
            const s = (x: { status: string; score: number | null }): string => `${x.status}${x.score === null ? '' : `@${x.score.toFixed(2)}`}`;
            return `  ${r.task.padEnd(24)} ${r.grader.padEnd(20)} good=${s(r.good).padEnd(12)} bad=${s(r.bad).padEnd(12)} ${v}\n`;
        })
        .join('');
}
