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
 * `--origins` adds deterministic origin classes per round for subjects with
 * five or more rounds. On demand only — no CI gate reads this.
 *
 * Usage: ./scripts-run src/scripts/review_loop_census [--json] [--write] [--origins] [--root <dir>]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { classifyReviewPath } from './_lib/review_path_class.js';

export type LoopKind = 'ratification' | 'completion-review';
export type OriginClass = 'scope-widened' | 'rebind-non-code';

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
    /** Repository paths the round's packet or stored diff cites (with `--origins`). */
    paths?: string[];
    /** Deterministic origin classes (with `--origins`). */
    classes?: OriginClass[];
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
export const COMMAND = './scripts-run src/scripts/review_loop_census --write --origins';
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

// --- origins ----------------------------------------------------

const PATH_RE = /(?:^|[\s`'"(\[])((?:src|docs|tests|agents|scripts|taskfiles|templates|\.github|config|dist)\/[A-Za-z0-9_.\-/]+\.[A-Za-z0-9]+)/g;

/** Repository paths a text cites, de-duplicated and sorted. */
export function citedPaths(text: string): string[] {
    const out = new Set<string>();
    for (const m of text.matchAll(PATH_RE)) out.add(m[1].replace(/[.,:;)]+$/, ''));
    return [...out].sort();
}

/** Paths a unified diff touches (`diff --git`, `+++ b/` and `--- a/` lines). */
export function diffPaths(patch: string): string[] {
    const out = new Set<string>();
    for (const m of patch.matchAll(/^(?:\+\+\+ b|--- a|diff --git a)\/(\S+)/gm)) out.add(m[1]);
    return [...out].sort();
}

function reviewInputDiff(root: string, roundFile: string): string | null {
    const base = roundFile.replace(/(\.findings\.md|-review\.md|\.md)$/, '');
    const abs = path.join(root, `${base}.review-input`, 'diff.patch');
    return fs.existsSync(abs) ? readOrEmpty(abs) : null;
}

/**
 * `scope-widened` — a round cites a path that is in neither round 1's packet
 * nor the subject's diff. For packets the diff is every path any packet of the
 * subject carries in an embedded diff header, plus the paths its ratification
 * record cites; for completion reviews it is the stored review-input diffs.
 *
 * `rebind-non-code` (completion reviews) — the round's stored diff differs from
 * the previous round's only in paths `probe_review_binding_drift` classes as
 * non-code (roadmap, docs, other `agents/`), so nothing reviewable moved.
 */
export function addOrigins(root: string, s: CensusSubject): void {
    const diffSet = new Set<string>();
    if (s.kind === 'ratification') {
        for (const name of listDir(path.join(root, RATIFICATIONS_REL))) {
            if (stem(name) === stem(s.subject)) {
                for (const p of citedPaths(readOrEmpty(path.join(root, RATIFICATIONS_REL, name)))) diffSet.add(p);
            }
        }
        for (const r of s.roundList) for (const p of diffPaths(readOrEmpty(path.join(root, r.file)))) diffSet.add(p);
    }
    let prevDiff: Set<string> | null = null;
    let baseline: Set<string> | null = null;
    for (const r of s.roundList) {
        const text = readOrEmpty(path.join(root, r.file));
        const patch = s.kind === 'completion-review' ? reviewInputDiff(root, r.file) : null;
        const own = patch !== null ? diffPaths(patch) : [];
        if (s.kind === 'completion-review') for (const p of own) diffSet.add(p);
        r.paths = [...new Set([...citedPaths(text), ...own])].sort();
        r.classes = [];
        if (baseline === null) {
            baseline = new Set(r.paths);
        } else if (r.paths.some((p) => !baseline!.has(p) && !diffSet.has(p))) {
            r.classes.push('scope-widened');
        }
        if (s.kind === 'completion-review' && patch !== null) {
            const cur = new Set(own);
            if (prevDiff !== null) {
                const changed = [...cur].filter((p) => !prevDiff!.has(p)).concat([...prevDiff].filter((p) => !cur.has(p)));
                if (changed.length > 0 && changed.every((p) => classifyReviewPath(p) !== 'code')) {
                    r.classes.push('rebind-non-code');
                }
            }
            prevDiff = cur;
        }
    }
}

export function buildCensus(root: string, opts: { origins?: boolean } = {}): Census {
    const subjects = [...ratificationSubjects(root), ...completionSubjects(root)].sort(
        (a, b) => b.rounds - a.rounds || a.subject.localeCompare(b.subject),
    );
    if (opts.origins) for (const s of subjects) if (s.rounds >= LONG_LOOP) addOrigins(root, s);
    return { root, subjects };
}

// --- reader input ----------------------------------------------------------

const HISTORY_HEADING = /^(rounds? \d|history\b|what changed)|and what changed|\bchanged since round/i;
const SECTION_CAP = 40;
const SECTION_CHAR_CAP = 2500;
const RESPONSE_CHAR_CAP = 4000;
const PREAMBLE_CAP = 25;

/**
 * The text a reader classes findings from. Packets restate earlier rounds, so
 * a section repeated verbatim across packets is kept once. A packet with no
 * history heading contributes its preamble (title to first `##`), where the
 * single-file packets keep their round history.
 */
export function roundHistory(root: string, s: CensusSubject): string {
    const out: string[] = [`## \`${s.subject}\` (${s.kind}, ${s.rounds} rounds)`, ''];
    if (s.kind === 'completion-review') {
        for (const r of s.roundList) {
            out.push(`### Round ${r.round}`, '');
            const rows = r.findings ?? [];
            if (rows.length === 0) out.push('(no findings)');
            rows.forEach((f, i) => out.push(`R${r.round}.${i + 1} | ${f.severity} | ${f.text.slice(0, 600)}`));
            out.push('');
        }
        return out.join('\n');
    }
    const seen = new Set<string>();
    for (const r of s.roundList) {
        const lines = readOrEmpty(path.join(root, r.file)).split('\n');
        const kept: string[] = [];
        let i = 0;
        let matched = false;
        while (i < lines.length) {
            const h = /^#{2,3} (.+)$/.exec(lines[i]);
            if (h && HISTORY_HEADING.test(h[1])) {
                let j = i + 1;
                while (j < lines.length && !/^#{1,3} /.test(lines[j])) j++;
                const body = lines.slice(i, Math.min(j, i + 1 + SECTION_CAP)).join('\n').trim().slice(0, SECTION_CHAR_CAP);
                if (!seen.has(body)) {
                    seen.add(body);
                    kept.push(body);
                }
                matched = true;
                i = j;
            } else {
                i++;
            }
        }
        if (!matched) {
            const first = lines.findIndex((l, k) => k > 0 && /^## /.test(l));
            const pre = lines.slice(0, first < 0 ? PREAMBLE_CAP : Math.min(first, PREAMBLE_CAP)).join('\n').trim();
            if (/round/i.test(pre) && !seen.has(pre)) {
                seen.add(pre);
                kept.push(pre);
            }
        }
        // The verdict a round produced, where it was committed beside its packet.
        const response = readOrEmpty(path.join(root, r.file.replace(/\.question\.md$/, '.md')));
        if (response !== '') kept.push(`Verdict record of round ${r.round}:\n\n${response.slice(0, RESPONSE_CHAR_CAP).trim()}`);
        if (kept.length > 0) out.push(`### Packet for round ${r.round}`, '', ...kept, '');
    }
    return out.join('\n');
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
    const withOrigins = long.filter((s) => s.roundList.some((r) => r.classes !== undefined));
    if (withOrigins.length > 0) {
        const count = (s: CensusSubject, k: OriginClass): number =>
            s.roundList.filter((r) => r.classes?.includes(k)).length;
        out.push('## Deterministic origin classes per loop');
        out.push('');
        out.push('`scope-widened` — the round cites a repository path that is in neither round 1');
        out.push('nor the subject\'s diff. `rebind-non-code` — a completion re-review whose stored');
        out.push('diff moved only in non-code paths. Rounds recorded = round files present.');
        out.push('');
        out.push('| Subject | Rounds recorded | scope-widened | rebind-non-code |');
        out.push('|---|---:|---:|---:|');
        for (const s of withOrigins) {
            out.push(`| \`${s.subject}\` | ${s.roundList.length} | ${count(s, 'scope-widened')} | ${count(s, 'rebind-non-code')} |`);
        }
        out.push('');
    }
    return out.join('\n');
}

function repoRoot(): string {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function main(argv: string[]): number {
    const ri = argv.indexOf('--root');
    const root = ri >= 0 && argv[ri + 1] ? path.resolve(argv[ri + 1]) : repoRoot();
    const census = buildCensus(root, { origins: argv.includes('--origins') });
    const rn = argv.indexOf('--reader-input');
    if (rn >= 0) {
        const n = Number(argv[rn + 1] ?? '10');
        for (const s of census.subjects.slice(0, n)) process.stdout.write(`${roundHistory(root, s)}\n`);
        return 0;
    }
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
