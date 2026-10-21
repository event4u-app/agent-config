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
 *   ./scripts-run src/scripts/probe_depth_shadow --rounds   (severity by round, and per exact round)
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

export interface CorpusRow {
    slug: string;
    round: number;
    sev: string;
    /** The first `diff:` sha the slug's artefacts recorded, for joining a review to its PR. */
    diff?: string;
}

const NOT_A_FINDING = new Set(['example', 'rejected', 'invalid']);
const ARCHIVED = /^(.*)\.round(\d+)-review\.md$/;
const SUFFIXED = /^(.*?)[-.](?:round|r)(\d+)\.findings\.md$/;

/**
 * Every finding row in the review corpus, with the review (slug) and round it
 * belongs to.
 *
 * Three sources of a round, in order of authority: the `round:` header field; a
 * `# Completion review round N` heading inside a file that holds several rounds;
 * the file name — a § 2.7 archived `<slug>.roundN-review.md`, or a `-roundN` /
 * `.roundN` / `-rN` suffix. A suffix names a round only when another file shares
 * the slug: a lone `conformance-round7.findings.md` is a subject name, round 1.
 * Rows whose status says they are not findings (`example`, `rejected`, `invalid`)
 * are left out.
 */
export function parseReviewCorpus(dir: string): CorpusRow[] {
    const names = fs
        .readdirSync(dir)
        .filter((n) => n.endsWith('.findings.md') || ARCHIVED.test(n))
        .sort();
    const candidate = (n: string): { slug: string; round: number | null } => {
        const a = ARCHIVED.exec(n);
        if (a) return { slug: a[1]!, round: Number(a[2]) };
        const s = SUFFIXED.exec(n);
        if (s) return { slug: s[1]!, round: Number(s[2]) };
        return { slug: n.replace(/\.findings\.md$/, ''), round: null };
    };
    const perSlug = new Map<string, number>();
    for (const n of names) perSlug.set(candidate(n).slug, (perSlug.get(candidate(n).slug) ?? 0) + 1);
    const rows: CorpusRow[] = [];
    const diffOf = new Map<string, string>();
    for (const n of names) {
        const c = candidate(n);
        const lone = c.round !== null && !ARCHIVED.test(n) && (perSlug.get(c.slug) ?? 0) < 2;
        const slug = lone ? n.replace(/\.findings\.md$/, '') : c.slug;
        const text = fs.readFileSync(path.join(dir, n), 'utf8');
        const headerRound = /completion-review: v1 \|[^>]*\| round: ([1-9]\d*) -->/.exec(text)?.[1];
        const diff = /completion-review: v1 \|[^>]*diff: ([0-9a-f]{7,40})/.exec(text)?.[1];
        if (diff !== undefined && !diffOf.has(slug)) diffOf.set(slug, diff);
        let round = headerRound !== undefined ? Number(headerRound) : lone ? 1 : (c.round ?? 1);
        for (const line of text.split('\n')) {
            const h = /^# Completion review round (\d+)\b/.exec(line);
            if (h && headerRound === undefined) round = Number(h[1]);
            const cells = line.split('|');
            if (!/^\|\s*\d+\s*\|/.test(line) || cells.length < 6) continue;
            const status = cells[5]!.replace(/[\s*`\\]/g, '').toLowerCase();
            if (NOT_A_FINDING.has(status)) continue;
            rows.push({ slug, round, sev: cells[2]!.replace(/[\s*`]/g, '').toLowerCase() });
        }
    }
    for (const r of rows) {
        const d = diffOf.get(r.slug);
        if (d !== undefined) r.diff = d;
    }
    return rows;
}

export interface RoundBand {
    band: string;
    artefacts: number;
    findings: number;
    hc: number;
    /** Reviews whose last round falls in this band. */
    ending: number;
}

const bandOf = (r: number): string => (r <= 5 ? String(r) : r <= 10 ? '6-10' : '11+');

export function roundTable(rows: readonly CorpusRow[]): RoundBand[] {
    const artefacts = new Map<string, Set<string>>();
    const out = new Map<string, RoundBand>();
    const last = new Map<string, number>();
    for (const r of rows) {
        const b = bandOf(r.round);
        const o = out.get(b) ?? { band: b, artefacts: 0, findings: 0, hc: 0, ending: 0 };
        o.findings += 1;
        if (r.sev === 'high' || r.sev === 'critical') o.hc += 1;
        out.set(b, o);
        const set = artefacts.get(b) ?? new Set<string>();
        set.add(`${r.slug}#${String(r.round)}`);
        artefacts.set(b, set);
        last.set(r.slug, Math.max(last.get(r.slug) ?? 0, r.round));
    }
    for (const [b, set] of artefacts) (out.get(b) as RoundBand).artefacts = set.size;
    for (const r of last.values()) {
        const o = out.get(bandOf(r));
        if (o) o.ending += 1;
    }
    return ['1', '2', '3', '4', '5', '6-10', '11+'].map((b) => out.get(b)).filter((x): x is RoundBand => x !== undefined);
}

function readReviewRows(root: string): ReviewRow[] {
    const git = (args: string[]): string => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).stdout;
    const squash = new Map<string, string>();
    for (const l of git(['log', '--first-parent', '--format=%H %s', 'origin/main']).split('\n')) {
        const m = /^(\w+) .*\(#(\d+)\)$/.exec(l);
        if (m && !squash.has(m[2]!)) squash.set(m[2]!, m[1]!);
    }
    const classBySlug = new Map<string, RiskClass | null>();
    const rows: ReviewRow[] = [];
    for (const r of parseReviewCorpus(path.join(root, 'agents', 'evidence', 'reviews'))) {
        if (!classBySlug.has(r.slug)) {
            const pr = r.diff === undefined ? '' : spawnSync('gh', ['pr', 'list', '--state', 'merged', '--search', r.diff, '--json', 'number', '-q', '.[0].number'], { encoding: 'utf8' }).stdout.trim();
            const squashSha = squash.get(pr);
            classBySlug.set(r.slug, squashSha === undefined ? null : classifyPaths(changedPaths(`${squashSha}^..${squashSha}`, root)).cls);
        }
        const cls = classBySlug.get(r.slug);
        if (cls === null || cls === undefined) continue;
        rows.push({ cls, round: r.round, sev: r.sev });
    }
    return rows;
}

function renderRounds(rows: readonly CorpusRow[]): string[] {
    const pct = (x: number, n: number): string => `${((100 * x) / n).toFixed(1)} %`;
    const lines = [`reviews: ${String(new Set(rows.map((r) => r.slug)).size)} · finding rows: ${String(rows.length)}`, '', '| round | findings | high+critical | high+critical share | medium | low |', '|---|---|---|---|---|---|'];
    for (const [label, test] of [['1', (r: number) => r === 1], ['2', (r: number) => r === 2], ['3+', (r: number) => r >= 3]] as const) {
        const rs = rows.filter((r) => test(r.round));
        if (rs.length === 0) continue;
        const hc = rs.filter((r) => r.sev === 'high' || r.sev === 'critical').length;
        lines.push(`| ${label} | ${String(rs.length)} | ${String(hc)} | ${pct(hc, rs.length)} | ${pct(rs.filter((r) => r.sev === 'medium').length, rs.length)} | ${pct(rs.filter((r) => r.sev === 'low').length, rs.length)} |`);
    }
    lines.push('', '| round | artefacts | findings | high+critical | high+critical per artefact | reviews ending here |', '|---|---|---|---|---|---|');
    for (const b of roundTable(rows)) {
        lines.push(`| ${b.band} | ${String(b.artefacts)} | ${String(b.findings)} | ${String(b.hc)} | ${(b.hc / b.artefacts).toFixed(2)} | ${String(b.ending)} |`);
    }
    return lines;
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--rounds')) {
        process.stdout.write(`${renderRounds(parseReviewCorpus(path.join(REPO_ROOT, 'agents', 'evidence', 'reviews'))).join('\n')}\n`);
        return 0;
    }
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
