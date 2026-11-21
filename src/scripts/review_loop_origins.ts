#!/usr/bin/env tsx
/**
 * Merge two independent readers' origin classes for the longest review loops,
 * settle their disagreements with a third reader, join the census's
 * deterministic classes, and compute which origin drives rounds whose new
 * findings rise.
 *
 * Inputs live in one directory beside the output: `reader-a-<slug>.json`,
 * `reader-b-<slug>.json` and, for every subject the two disagree on,
 * `adjudicator-<slug>.json`. Each holds the JSON object the reader prompt asks
 * for. The prompts are committed in the same directory.
 *
 * Agreement is measured on class counts per round, not per finding: the two
 * readers enumerate findings themselves, so their ids do not align, and a
 * count overlap is the comparison both outputs support.
 *
 * Usage: ./scripts-run src/scripts/review_loop_origins [--write]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildCensus } from './review_loop_census.js';

export const READER_CLASSES = ['fix-introduced', 're-raised', 'single-seat', 'other'] as const;
export const MERGED_CLASSES = ['fix-introduced', 're-raised', 'single-seat', 'scope-widened', 'rebind-non-code', 'other'] as const;
export type MergedClass = (typeof MERGED_CLASSES)[number];

export interface ReaderFinding {
    id: string;
    summary: string;
    severity: string;
    class: string;
}

export interface ReaderRound {
    round: number;
    visible: boolean;
    findings: ReaderFinding[];
}

export interface ReaderOutput {
    subject: string;
    round1_findings: number | null;
    rounds: ReaderRound[];
}

export const INPUT_REL = 'agents/evidence/analysis/review-loop-origins';
export const OUT_REL = 'agents/evidence/analysis/review-loop-origins-2026-11.md';
export const COMMAND = './scripts-run src/scripts/review_loop_origins --write';
export const LEVER_THRESHOLD = 40;

function classCounts(r: ReaderRound | undefined): Map<string, number> {
    const m = new Map<string, number>();
    for (const x of r?.findings ?? []) m.set(x.class, (m.get(x.class) ?? 0) + 1);
    return m;
}

export interface Agreement {
    roundsCompared: number;
    roundsExact: number;
    /** Sum over rounds and classes of min(a, b) divided by the sum of max(a, b). */
    overlap: number;
    disputed: number[];
}

export function agreement(a: ReaderOutput, b: ReaderOutput): Agreement {
    const rounds = [...new Set([...a.rounds, ...b.rounds].map((r) => r.round))].sort((x, y) => x - y);
    let minSum = 0;
    let maxSum = 0;
    let exact = 0;
    const disputed: number[] = [];
    for (const n of rounds) {
        const ra = a.rounds.find((r) => r.round === n);
        const rb = b.rounds.find((r) => r.round === n);
        const ca = classCounts(ra);
        const cb = classCounts(rb);
        let same = (ra?.visible ?? false) === (rb?.visible ?? false);
        for (const k of new Set([...ca.keys(), ...cb.keys()])) {
            const x = ca.get(k) ?? 0;
            const y = cb.get(k) ?? 0;
            minSum += Math.min(x, y);
            maxSum += Math.max(x, y);
            if (x !== y) same = false;
        }
        if (same) exact++;
        else disputed.push(n);
    }
    return { roundsCompared: rounds.length, roundsExact: exact, overlap: maxSum === 0 ? 1 : minSum / maxSum, disputed };
}

export function mergeReaders(a: ReaderOutput, b: ReaderOutput, adj: ReaderOutput | null): ReaderOutput {
    const { disputed } = agreement(a, b);
    const rounds: ReaderRound[] = [];
    const all = [...new Set([...a.rounds, ...b.rounds].map((r) => r.round))].sort((x, y) => x - y);
    for (const n of all) {
        if (!disputed.includes(n)) {
            rounds.push(a.rounds.find((r) => r.round === n) ?? b.rounds.find((r) => r.round === n)!);
            continue;
        }
        const settled = adj?.rounds.find((r) => r.round === n);
        if (settled === undefined) throw new Error(`${a.subject}: round ${n} is disputed and the adjudicator did not settle it`);
        rounds.push(settled);
    }
    const r1 = a.round1_findings === b.round1_findings ? a.round1_findings : (adj?.round1_findings ?? null);
    return { subject: a.subject, round1_findings: r1, rounds };
}

export interface Shares {
    risingRounds: number;
    total: number;
    counts: Record<MergedClass, number>;
    shares: Record<MergedClass, number>;
}

/**
 * A round rises when it and its predecessor are both visible and it raised
 * more new findings. A finding the readers classed `other` takes the round's
 * deterministic class when it carries one, so every finding has exactly one
 * merged class and the shares sum to 100 %.
 */
export function risingShares(finals: ReaderOutput[], deterministic: Map<string, Map<number, string[]>>): Shares {
    const counts = Object.fromEntries(MERGED_CLASSES.map((k) => [k, 0])) as Record<MergedClass, number>;
    let rising = 0;
    for (const s of finals) {
        for (const r of s.rounds) {
            if (!r.visible) continue;
            let prev: number | null;
            if (r.round === 2) prev = s.round1_findings;
            else {
                const p = s.rounds.find((x) => x.round === r.round - 1);
                prev = p !== undefined && p.visible ? p.findings.length : null;
            }
            if (prev === null || r.findings.length <= prev) continue;
            rising++;
            const det = deterministic.get(s.subject)?.get(r.round) ?? [];
            for (const x of r.findings) {
                let k = (MERGED_CLASSES as readonly string[]).includes(x.class) ? (x.class as MergedClass) : 'other';
                if (k === 'other' && det.length > 0) k = det[0] as MergedClass;
                counts[k]++;
            }
        }
    }
    const total = Object.values(counts).reduce((x, y) => x + y, 0);
    const shares = Object.fromEntries(
        MERGED_CLASSES.map((k) => [k, total === 0 ? 0 : (100 * counts[k]) / total]),
    ) as Record<MergedClass, number>;
    return { risingRounds: rising, total, counts, shares };
}

export type Lever = 'generated-packet' | 'seat-novelty' | 'fix-size' | 'criterion-only';

/** The pre-registered table: the first class above the threshold names the lever. */
export function leverFor(shares: Partial<Record<string, number>>): Lever {
    if ((shares['scope-widened'] ?? 0) > LEVER_THRESHOLD) return 'generated-packet';
    if ((shares['single-seat'] ?? 0) > LEVER_THRESHOLD) return 'seat-novelty';
    if ((shares['fix-introduced'] ?? 0) > LEVER_THRESHOLD) return 'fix-size';
    return 'criterion-only';
}

// --- I/O -------------------------------------------------------------------

/** First JSON object in a reader's reply; readers sometimes wrap it in a fence. */
export function parseReaderReply(text: string): ReaderOutput {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('no JSON object in reader reply');
    return JSON.parse(text.slice(start, end + 1)) as ReaderOutput;
}

function readReader(dir: string, name: string): ReaderOutput | null {
    const abs = path.join(dir, name);
    return fs.existsSync(abs) ? parseReaderReply(fs.readFileSync(abs, 'utf-8')) : null;
}

function repoRoot(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

const pct = (x: number): string => `${x.toFixed(1)} %`;

export function render(root: string): string {
    const dir = path.join(root, INPUT_REL);
    const slugs = fs
        .readdirSync(dir)
        .filter((n) => /^reader-a-.+\.json$/.test(n))
        .map((n) => n.replace(/^reader-a-/, '').replace(/\.json$/, ''))
        .sort();
    const census = buildCensus(root, { origins: true });
    const deterministic = new Map<string, Map<number, string[]>>();
    for (const s of census.subjects) {
        if (!slugs.includes(s.subject)) continue;
        deterministic.set(s.subject, new Map(s.roundList.map((r) => [r.round, r.classes ?? []])));
    }
    const out: string[] = [];
    out.push('# Review-loop origins — the ten longest loops');
    out.push('');
    out.push('<!-- evidence-type: analysis -->');
    out.push('');
    out.push(`Generated by \`${COMMAND}\` from the reader replies under \`${INPUT_REL}/\`. Do not edit by hand.`);
    out.push('');
    out.push('Readers: reader A is Claude (`claude --print --tools ""`, opus, low effort), reader B is');
    out.push('Codex (`codex exec --sandbox read-only`, medium effort), and the adjudicator is Gemini');
    out.push('(`gemini`, plan mode), each in a fresh process with no tools that write. Each read the');
    out.push('same question: the committed `prompt-head.md` followed by');
    out.push('`./scripts-run src/scripts/review_loop_census --reader-input 10` for that subject. The');
    out.push('adjudicator saw both replies and the same history, for the disputed rounds only');
    out.push('(`adjudicator-prompt.md`).');
    out.push('');
    out.push('## Agreement before adjudication');
    out.push('');
    out.push('| Subject | Rounds compared | Rounds identical | Class-count overlap | Disputed rounds |');
    out.push('|---|---:|---:|---:|---|');
    let minAll = 0;
    let cmpAll = 0;
    let exactAll = 0;
    let overlapNum = 0;
    let overlapDen = 0;
    const finals: ReaderOutput[] = [];
    for (const slug of slugs) {
        const a = readReader(dir, `reader-a-${slug}.json`)!;
        const b = readReader(dir, `reader-b-${slug}.json`);
        if (b === null) throw new Error(`${slug}: reader B reply missing`);
        const g = agreement(a, b);
        cmpAll += g.roundsCompared;
        exactAll += g.roundsExact;
        const n = a.rounds.reduce((s, r) => s + r.findings.length, 0) + b.rounds.reduce((s, r) => s + r.findings.length, 0);
        overlapNum += g.overlap * n;
        overlapDen += n;
        out.push(
            `| \`${slug}\` | ${g.roundsCompared} | ${g.roundsExact} | ${pct(100 * g.overlap)} | ${g.disputed.join(', ') || '—'} |`,
        );
        finals.push(mergeReaders(a, b, readReader(dir, `adjudicator-${slug}.json`)));
        minAll += g.disputed.length;
    }
    out.push(
        `| **pooled** | **${cmpAll}** | **${exactAll}** (${pct((100 * exactAll) / Math.max(cmpAll, 1))}) | **${pct(overlapDen === 0 ? 100 : (100 * overlapNum) / overlapDen)}** (finding-weighted) | ${minAll} rounds |`,
    );
    out.push('');
    out.push('## Per-round classes after adjudication');
    out.push('');
    out.push('Reader classes per round, joined with the census\'s deterministic classes for the same round.');
    out.push('');
    out.push('| Subject | Round | New findings | fix-introduced | re-raised | single-seat | other | deterministic |');
    out.push('|---|---:|---:|---:|---:|---:|---:|---|');
    for (const s of finals) {
        out.push(`| \`${s.subject}\` | 1 | ${s.round1_findings ?? 'not shown'} | | | | | |`);
        for (const r of s.rounds) {
            const c = classCounts(r);
            const det = (deterministic.get(s.subject)?.get(r.round) ?? []).join(', ') || '—';
            if (!r.visible) {
                out.push(`| \`${s.subject}\` | ${r.round} | not shown | | | | | ${det} |`);
                continue;
            }
            out.push(
                `| \`${s.subject}\` | ${r.round} | ${r.findings.length} | ${READER_CLASSES.map((k) => c.get(k) ?? 0).join(' | ')} | ${det} |`,
            );
        }
    }
    out.push('');
    const sh = risingShares(finals, deterministic);
    out.push('## The driver of rising rounds');
    out.push('');
    out.push(`Rising rounds (more new findings than the visible round before): **${sh.risingRounds}**, carrying **${sh.total}** findings.`);
    out.push('');
    out.push('| Merged class | Findings | Share |');
    out.push('|---|---:|---:|');
    for (const k of MERGED_CLASSES) out.push(`| ${k} | ${sh.counts[k]} | ${pct(sh.shares[k])} |`);
    out.push('');
    out.push(`Lever by the pre-registered table (first class above ${LEVER_THRESHOLD} %): **${leverFor(sh.shares)}**.`);
    out.push('');
    return out.join('\n');
}

function main(argv: string[]): number {
    const root = repoRoot();
    const text = render(root);
    if (argv.includes('--write')) {
        fs.writeFileSync(path.join(root, OUT_REL), text, 'utf-8');
        process.stdout.write(`wrote ${OUT_REL}\n`);
    } else {
        process.stdout.write(text);
    }
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
