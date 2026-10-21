#!/usr/bin/env tsx
/**
 * The depth shadow, read as two figures: how many ticked steps carry a receipt,
 * per change class, and what a lowered `review` row would have missed.
 *
 * A REPORT, never a gate. The receipt is written by the run procedure but not
 * enforced, so coverage is reported per class rather than assumed complete — a
 * shadow whose R0/R1 receipts go missing measures only the easy steps, and the
 * per-class split is what shows that.
 *
 * The review half joins each completion-review slug to the merged PR
 * containing its first header `diff:` sha (GitHub search, so `--reviews`
 * needs `gh`), classifies that PR's squash commit, and counts the high/critical
 * rows the class's review row would not have run: all of them for R0, those of
 * round ≥ 2 for R1, none for R2 and R3.
 *
 * Usage:
 *   ./scripts-run src/scripts/probe_depth_shadow [--since YYYY-MM-DD] [--reviews] [--json]
 *
 * Coverage counts only steps whose Done note carries a date on or after
 * `--since` (default: the day receipts were introduced); an undated tick
 * cannot say whether it predates the receipt and is left out, not counted
 * as missing.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { changedPaths, classifyPaths, type RiskClass } from './classify_change_risk.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CLASSES = ['R0', 'R1', 'R2', 'R3'] as const;
const TICKED = /^\s*-\s\[x\]\s/;
const RECEIPT = /<!-- receipt: class=(R[0-3]) /;
const DONE_DATE = /\bDone (\d{4}-\d{2}-\d{2})\b/;
export const RECEIPTS_SINCE = '2026-10-21';

export interface Coverage {
    ticked: number;
    byClass: Record<RiskClass, number>;
    missing: number;
}

export function receiptCoverage(texts: readonly string[], since: string | null = null): Coverage {
    const byClass = { R0: 0, R1: 0, R2: 0, R3: 0 } as Record<RiskClass, number>;
    let ticked = 0;
    let missing = 0;
    for (const text of texts) {
        for (const line of text.split('\n')) {
            if (!TICKED.test(line)) continue;
            if (since !== null) {
                const done = DONE_DATE.exec(line)?.[1];
                if (done === undefined || done < since) continue;
            }
            ticked += 1;
            const m = RECEIPT.exec(line);
            if (m === null) missing += 1;
            else byClass[m[1] as RiskClass] += 1;
        }
    }
    return { ticked, byClass, missing };
}

export interface ReviewRow {
    cls: RiskClass;
    round: number;
    sev: string;
}

export function reviewEscapes(rows: readonly ReviewRow[]): Record<RiskClass, { rows: number; escaped: number; critical: number }> {
    const out = Object.fromEntries(CLASSES.map((c) => [c, { rows: 0, escaped: 0, critical: 0 }])) as Record<
        RiskClass,
        { rows: number; escaped: number; critical: number }
    >;
    for (const r of rows) {
        if (r.sev !== 'high' && r.sev !== 'critical') continue;
        const o = out[r.cls];
        o.rows += 1;
        const escaped = r.cls === 'R0' || (r.cls === 'R1' && r.round >= 2);
        if (escaped) {
            o.escaped += 1;
            if (r.sev === 'critical') o.critical += 1;
        }
    }
    return out;
}

function roadmapTexts(root: string): string[] {
    const out: string[] = [];
    for (const sub of ['', 'archive', 'later']) {
        const dir = path.join(root, 'agents', 'roadmaps', sub);
        if (!fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) if (f.endsWith('.md')) out.push(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
    return out;
}

function readReviewRows(root: string): ReviewRow[] {
    const dir = path.join(root, 'agents', 'evidence', 'reviews');
    const git = (args: string[]): string => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).stdout;
    const squash = new Map<string, string>();
    for (const l of git(['log', '--first-parent', '--format=%H %s', 'origin/main']).split('\n')) {
        const m = /^(\w+) .*\(#(\d+)\)$/.exec(l);
        if (m && !squash.has(m[2]!)) squash.set(m[2]!, m[1]!);
    }
    const files = fs.readdirSync(dir).filter((n) => n.endsWith('.findings.md')).sort();
    const slugOf = (f: string): string => f.replace(/[-.](?:round|r)\d+\.findings\.md$/, '').replace(/\.findings\.md$/, '');
    const classBySlug = new Map<string, RiskClass | null>();
    const rows: ReviewRow[] = [];
    for (const f of files) {
        const slug = slugOf(f);
        const text = fs.readFileSync(path.join(dir, f), 'utf8');
        if (!classBySlug.has(slug)) {
            const sha = /completion-review: v1 \|[^>]*diff: ([0-9a-f]{7,40})/.exec(text)?.[1];
            const pr = sha === undefined ? '' : spawnSync('gh', ['pr', 'list', '--state', 'merged', '--search', sha, '--json', 'number', '-q', '.[0].number'], { encoding: 'utf8' }).stdout.trim();
            const squashSha = squash.get(pr);
            classBySlug.set(slug, squashSha === undefined ? null : classifyPaths(changedPaths(`${squashSha}^..${squashSha}`, root)).cls);
        }
        const cls = classBySlug.get(slug);
        if (cls === null || cls === undefined) continue;
        const round = Number(/[-.](?:round|r)(\d+)\.findings\.md$/.exec(f)?.[1] ?? 1);
        for (const line of text.split('\n')) {
            const c = line.split('|');
            if (!/^\|\s*\d+\s*\|/.test(line) || c.length < 4) continue;
            rows.push({ cls, round, sev: c[2]!.replace(/[\s*`]/g, '').toLowerCase() });
        }
    }
    return rows;
}

export function main(argv: readonly string[]): number {
    const si = argv.indexOf('--since');
    const since = si >= 0 ? (argv[si + 1] ?? RECEIPTS_SINCE) : RECEIPTS_SINCE;
    const coverage = receiptCoverage(roadmapTexts(REPO_ROOT), since);
    const escapes = argv.includes('--reviews') ? reviewEscapes(readReviewRows(REPO_ROOT)) : null;
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ coverage, escapes }, null, 2)}\n`);
        return 0;
    }
    const lines = [
        `probe:depth-shadow · ${String(coverage.ticked)} step(s) ticked since ${since}, ${String(coverage.missing)} without a receipt`,
        `  receipts by class: ${CLASSES.map((c) => `${c} ${String(coverage.byClass[c])}`).join(' · ')}`,
    ];
    if (escapes !== null) {
        lines.push('  review row     high/critical   would have escaped   of them critical');
        for (const c of CLASSES) {
            const e = escapes[c];
            lines.push(`  ${c.padEnd(13)} ${String(e.rows).padStart(13)}   ${String(e.escaped).padStart(18)}   ${String(e.critical).padStart(16)}`);
        }
    }
    process.stdout.write(`${lines.join('\n')}\n`);
    return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    process.exit(main(process.argv.slice(2)));
}
