#!/usr/bin/env tsx
/**
 * Census of every review loop the tree records — council ratification packets
 * and completion-review rounds — generated from file names and headers alone.
 *
 * Two loop kinds, read from two directories:
 *
 *   - `ratification` — council `*.question.md` packets. Two namings
 *     coexist: `<slug>.question.md` (round 1) plus `<slug>.roundN.question.md`,
 *     and `<slug>-rN-<YYYYMMDD>.question.md`. The final verdict comes from the
 *     ratification record whose name reduces to the same stem; no match reads
 *     `unrecorded`.
 *   - `completion-review` — `<slug>[.-]roundN*` round files with a findings
 *     table. The verdict is the last round's: no rows `honest-null`,
 *     an open high/critical row `open-high`, otherwise `resolved`.
 *
 * Round count is the highest round number, not the number of files: a packet
 * missing from the middle of a loop does not shorten it.
 *
 * On demand only — no CI gate reads this.
 *
 * Usage: ./scripts-run src/scripts/review_loop_census [--json] [--write] [--root <dir>]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type LoopKind = 'ratification' | 'completion-review';

export interface Finding {
    severity: string;
    status: string;
    text: string;
}

export interface CensusRound {
    round: number;
    file: string;
    date: string | null;
    /** Findings table rows — completion reviews only; `null` for packets. */
    findings: Finding[] | null;
}

export interface CensusSubject {
    kind: LoopKind;
    subject: string;
    rounds: number;
    firstDate: string | null;
    lastDate: string | null;
    verdict: string;
    roundList: CensusRound[];
}

export interface Census {
    root: string;
    subjects: CensusSubject[];
}

export const LONG_LOOP = 5;
export const COMMAND = './scripts-run src/scripts/review_loop_census --write';
export const OUT_REL = 'agents/evidence/analysis/review-loop-census.md';
const COUNCIL_REL = 'agents/evidence/council';
const RATIFICATIONS_REL = 'agents/evidence/ratifications';
const REVIEWS_REL = 'agents/evidence/reviews';

const ymd = (s: string): string => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

function listDir(abs: string): string[] {
    try {
        return fs.readdirSync(abs).sort();
    } catch {
        return [];
    }
}

function readOrEmpty(abs: string): string {
    try {
        return fs.readFileSync(abs, 'utf-8');
    } catch {
        return '';
    }
}

/** Reduce a subject or record name to the stem both share. */
export function stem(name: string): string {
    let s = name.replace(/\.md$/, '');
    for (;;) {
        const next = s.replace(/-\d{8}$/, '').replace(/-20\d\d-\d\d-\d\d$/, '').replace(/-(ratification|review)$/, '');
        if (next === s) return s;
        s = next;
    }
}

function firstIsoDate(text: string): string | null {
    const head = text.split('\n').slice(0, 12).join('\n');
    const m = /\b(20\d\d-\d\d-\d\d)\b/.exec(head);
    return m ? m[1] : null;
}

function frontmatterVerdict(text: string): string | null {
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (!fm) return null;
    const m = /^verdict:\s*(\S+)/m.exec(fm[1]);
    return m ? m[1] : null;
}

interface PacketRef {
    subject: string;
    round: number;
    date: string | null;
    file: string;
}

function parsePacketName(name: string): Omit<PacketRef, 'file'> | null {
    let m = /^(.+)\.round(\d+)\.question\.md$/.exec(name);
    if (m) return { subject: m[1], round: Number(m[2]), date: dateFromSlug(m[1]) };
    m = /^(.+)-r(\d+)-(\d{8})\.question\.md$/.exec(name);
    if (m) return { subject: m[1], round: Number(m[2]), date: ymd(m[3]) };
    m = /^(.+)\.question\.md$/.exec(name);
    if (m) return { subject: m[1], round: 1, date: dateFromSlug(m[1]) };
    return null;
}

function dateFromSlug(slug: string): string | null {
    const m = /-(\d{8})$/.exec(slug);
    return m ? ymd(m[1]) : null;
}

interface RecordVerdicts {
    byStem: Map<string, string>;
    /** A record that cites a council packet by path binds that packet's subject, whatever its own name. */
    bySubject: Map<string, string>;
}

function ratificationVerdicts(root: string): RecordVerdicts {
    const byStem = new Map<string, string>();
    const bySubject = new Map<string, string>();
    // Sorted ascending, so a later-dated record wins.
    for (const name of listDir(path.join(root, RATIFICATIONS_REL))) {
        if (!name.endsWith('.md')) continue;
        const text = readOrEmpty(path.join(root, RATIFICATIONS_REL, name));
        const verdict = frontmatterVerdict(text);
        if (verdict === null) continue;
        byStem.set(stem(name), verdict);
        for (const m of text.matchAll(/evidence\/council\/([A-Za-z0-9._-]+)/g)) {
            const parsed = parsePacketName(m[1]);
            const subject = parsed !== null ? parsed.subject : m[1].replace(/\.md$/, '').replace(/-r\d*$/, '');
            bySubject.set(subject, verdict);
        }
    }
    return { byStem, bySubject };
}

/** Parse every findings-table row whose header carries Severity and Status. */
export function parseFindingsTable(text: string): Finding[] {
    const lines = text.split('\n');
    const out: Finding[] = [];
    let cols: string[] | null = null;
    for (const line of lines) {
        if (!line.startsWith('|')) {
            cols = null;
            continue;
        }
        const cells = line.split('|').slice(1, -1).map((c) => c.trim());
        if (cols === null) {
            const lower = cells.map((c) => c.toLowerCase());
            if (lower.includes('severity') && lower.includes('status')) cols = lower;
            continue;
        }
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
        const at = (k: string): string => cells[cols!.indexOf(k)] ?? '';
        const fi = cols.indexOf('finding');
        out.push({
            severity: at('severity').toLowerCase(),
            status: at('status').toLowerCase(),
            text: fi >= 0 ? cells[fi] ?? '' : '',
        });
    }
    return out;
}

function ratificationSubjects(root: string): CensusSubject[] {
    const groups = new Map<string, PacketRef[]>();
    for (const name of listDir(path.join(root, COUNCIL_REL))) {
        const p = parsePacketName(name);
        if (p === null) continue;
        const file = `${COUNCIL_REL}/${name}`;
        const date = p.date ?? firstIsoDate(readOrEmpty(path.join(root, file)));
        const list = groups.get(p.subject) ?? [];
        list.push({ ...p, date, file });
        groups.set(p.subject, list);
    }
    const verdicts = ratificationVerdicts(root);
    const out: CensusSubject[] = [];
    for (const [subject, refs] of groups) {
        refs.sort((a, b) => a.round - b.round || a.file.localeCompare(b.file));
        const dates = refs.map((r) => r.date).filter((d): d is string => d !== null).sort();
        out.push({
            kind: 'ratification',
            subject,
            rounds: Math.max(...refs.map((r) => r.round)),
            firstDate: dates[0] ?? null,
            lastDate: dates[dates.length - 1] ?? null,
            verdict: verdicts.bySubject.get(subject) ?? verdicts.byStem.get(stem(subject)) ?? 'unrecorded',
            roundList: refs.map((r) => ({ round: r.round, file: r.file, date: r.date, findings: null })),
        });
    }
    return out;
}

const ROUND_FILE = /^(.+?)[.-]round(\d+)(\.findings\.md|\.md|-review\.md)$/;

function completionVerdict(findings: Finding[]): string {
    if (findings.length === 0) return 'honest-null';
    const open = findings.some(
        (f) => (f.severity === 'high' || f.severity === 'critical') && /^open\b/.test(f.status),
    );
    return open ? 'open-high' : 'resolved';
}

function completionSubjects(root: string): CensusSubject[] {
    const groups = new Map<string, CensusRound[]>();
    for (const name of listDir(path.join(root, REVIEWS_REL))) {
        const m = ROUND_FILE.exec(name);
        if (!m) continue;
        const file = `${REVIEWS_REL}/${name}`;
        const text = readOrEmpty(path.join(root, file));
        const reviewed = /reviewed:\s*(20\d\d-\d\d-\d\d)/.exec(text);
        const list = groups.get(m[1]) ?? [];
        list.push({
            round: Number(m[2]),
            file,
            date: reviewed ? reviewed[1] : firstIsoDate(text),
            findings: parseFindingsTable(text),
        });
        groups.set(m[1], list);
    }
    const out: CensusSubject[] = [];
    for (const [subject, rounds] of groups) {
        rounds.sort((a, b) => a.round - b.round || a.file.localeCompare(b.file));
        const dates = rounds.map((r) => r.date).filter((d): d is string => d !== null).sort();
        const last = rounds[rounds.length - 1];
        out.push({
            kind: 'completion-review',
            subject,
            rounds: last.round,
            firstDate: dates[0] ?? null,
            lastDate: dates[dates.length - 1] ?? null,
            verdict: completionVerdict(last.findings ?? []),
            roundList: rounds,
        });
    }
    return out;
}

export function buildCensus(root: string): Census {
    const subjects = [...ratificationSubjects(root), ...completionSubjects(root)].sort(
        (a, b) => b.rounds - a.rounds || a.subject.localeCompare(b.subject),
    );
    return { root, subjects };
}

// --- rendering -------------------------------------------------------------

export function renderCensusMarkdown(c: Census): string {
    const out: string[] = [];
    const long = c.subjects.filter((s) => s.rounds >= LONG_LOOP);
    const byKind = (k: LoopKind): CensusSubject[] => c.subjects.filter((s) => s.kind === k);
    out.push('# Review-loop census');
    out.push('');
    out.push('<!-- evidence-type: analysis -->');
    out.push('');
    out.push(`Generated by \`${COMMAND}\`. Do not edit by hand — re-run the command.`);
    out.push('');
    out.push('Ratification loops are council packets under `agents/evidence/council/`;');
    out.push('completion-review loops are round findings under `agents/evidence/reviews/`.');
    out.push('Round count is the highest round number recorded.');
    out.push('');
    out.push('| Kind | Subjects | with ≥ 5 rounds | max rounds |');
    out.push('|---|---:|---:|---:|');
    for (const k of ['ratification', 'completion-review'] as LoopKind[]) {
        const g = byKind(k);
        const max = g.length === 0 ? 0 : Math.max(...g.map((s) => s.rounds));
        out.push(`| ${k} | ${g.length} | ${g.filter((s) => s.rounds >= LONG_LOOP).length} | ${max} |`);
    }
    out.push('');
    out.push(`## Loops with ${LONG_LOOP} or more rounds`);
    out.push('');
    out.push('| Subject | Kind | Rounds | First | Last | Verdict |');
    out.push('|---|---|---:|---|---|---|');
    for (const s of long) {
        out.push(`| \`${s.subject}\` | ${s.kind} | ${s.rounds} | ${s.firstDate ?? '—'} | ${s.lastDate ?? '—'} | ${s.verdict} |`);
    }
    out.push('');
    return out.join('\n');
}

function repoRoot(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function main(argv: string[]): number {
    const ri = argv.indexOf('--root');
    const root = ri >= 0 && argv[ri + 1] ? path.resolve(argv[ri + 1]) : repoRoot();
    const census = buildCensus(root);
    if (argv.includes('--write')) {
        const target = path.join(root, OUT_REL);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, renderCensusMarkdown(census), 'utf-8');
        process.stdout.write(`wrote ${OUT_REL}\n`);
    }
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ ...census, root: undefined }, null, 2)}\n`);
    } else if (!argv.includes('--write')) {
        process.stdout.write(renderCensusMarkdown(census));
    }
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
