#!/usr/bin/env tsx
/**
 * Standing R3-rate metric over recently merged changes.
 *
 * Step 3.1 of `road-to-target-project-assurance-readiness`, and it exists because of
 * Risk 2 rather than for its own sake: `classify_change_risk` resolves ties and
 * unknowns **upward**, which is safe per change and corrosive in aggregate — once
 * most changes read R3, the owed gate set is noise and gets worked around rather
 * than met. The roadmap's mitigation is explicit about where the defect would live:
 * **> 40 % of changes classifying R3 is a defect in the override list**, not in the
 * people meeting the gates. This is the instrument that can say so.
 *
 * WHAT IT CANNOT REPORT, and the null is recorded per row rather than omitted.
 * The step asks for `agreement` and `r3_recall` alongside the rate. Both are
 * measured against a **human-labelled** corpus, and step 0.2 recorded that no human
 * labeller is reachable — so those two fields are written as `null` with
 * `null_reason` naming why. Writing them absent would make a later reader unable to
 * distinguish "not measured" from "measured as zero", which on a recall metric is
 * the difference between no data and total failure.
 *
 * NIGHTLY, NOT PER-CHANGE. The classifier runs in-session per change; the
 * *measurement* runs on a schedule. A per-PR trigger would make the metric a gate,
 * and Phase 2 — the phase that gives the class authority — is cancelled on the
 * pre-registered null route precisely because the class is unvalidated.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { type RiskClass, classifyPaths } from './classify_change_risk.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const DRIFT_LEDGER = path.join('agents', 'evidence', 'risk-classifier-drift.jsonl');

/** The rate above which the override list — not the reviewer — is the defect. */
export const R3_RATE_DEFECT_THRESHOLD = 0.4;

export interface DriftRow {
    measured_at: string;
    window_days: number;
    commits: number;
    counts: Record<RiskClass, number>;
    r3_rate: number | null;
    r3_rate_over_threshold: boolean | null;
    agreement: null;
    r3_recall: null;
    null_reason: string;
}

/** One entry per merged commit in the window: its sha and its touched paths. */
export function commitsInWindow(days: number, cwd = REPO_ROOT): { sha: string; paths: string[] }[] {
    const log = spawnSync(
        'git',
        ['log', '--first-parent', `--since=${String(days)} days ago`, '--format=%H'],
        { cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
    );
    if (log.status !== 0) return [];
    const shas = (log.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const out: { sha: string; paths: string[] }[] = [];
    for (const sha of shas) {
        // `-m --first-parent` so a merge commit reports the paths it BROUGHT IN
        // rather than nothing at all — a merge-heavy history would otherwise read
        // as a stream of empty diffs, and an empty diff classifies R3 by the
        // upward rule, which would invent an R3 rate of 1.0 out of bookkeeping.
        const d = spawnSync('git', ['show', '--pretty=', '--name-only', '-m', '--first-parent', sha], {
            cwd,
            encoding: 'utf-8',
            maxBuffer: 64 * 1024 * 1024,
        });
        const paths = (d.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
        if (paths.length > 0) out.push({ sha, paths });
    }
    return out;
}

export function buildRow(
    commits: readonly { sha: string; paths: string[] }[],
    measured_at: string,
    window_days: number,
): DriftRow {
    const counts: Record<RiskClass, number> = { R0: 0, R1: 0, R2: 0, R3: 0 };
    for (const c of commits) counts[classifyPaths(c.paths).cls] += 1;
    const n = commits.length;
    const r3_rate = n === 0 ? null : counts.R3 / n;
    return {
        measured_at,
        window_days,
        commits: n,
        counts,
        r3_rate,
        // `null` rather than `false` on an empty window: no commits is not evidence
        // that the rate is acceptable.
        r3_rate_over_threshold: r3_rate === null ? null : r3_rate > R3_RATE_DEFECT_THRESHOLD,
        agreement: null,
        r3_recall: null,
        null_reason:
            'no human-labelled corpus: step 0.2 recorded no reachable labeller, so ' +
            'agreement and r3_recall have no reference standard to be measured against. ' +
            'Reopens per agents/evidence/risk-classifier-prereg.md § Re-open threshold.',
    };
}

export function main(argv: readonly string[]): number {
    const wIdx = argv.indexOf('--window-days');
    const window_days = wIdx >= 0 ? Number(argv[wIdx + 1] ?? '30') : 30;
    const nowIdx = argv.indexOf('--now');
    // Injected rather than read from the clock so a test can pin the row.
    const measured_at = nowIdx >= 0 ? String(argv[nowIdx + 1]) : new Date().toISOString();
    const dry = argv.includes('--dry-run');

    const commits = commitsInWindow(window_days);
    const row = buildRow(commits, measured_at, window_days);
    const line = JSON.stringify(row);

    if (dry) {
        process.stdout.write(line + '\n');
        return 0;
    }
    const target = path.join(REPO_ROOT, DRIFT_LEDGER);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, line + '\n', 'utf-8');
    process.stdout.write(
        `risk-class drift: ${String(row.commits)} commit(s) over ${String(window_days)}d — ` +
            `R3 ${String(row.counts.R3)} (rate ${row.r3_rate === null ? 'n/a' : row.r3_rate.toFixed(3)})` +
            `${row.r3_rate_over_threshold === true ? ' ⚠️  OVER THRESHOLD — the override list is the defect' : ''}\n`,
    );
    return 0;
}

function _isCliEntry(): boolean {
    const invoked = process.argv[1];
    return invoked !== undefined && path.resolve(invoked) === path.resolve(_HERE);
}

if (_isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
