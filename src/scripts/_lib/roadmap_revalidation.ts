/**
 * Roadmap revalidation — the one primitive of `docs/contracts/roadmap-revalidation-v1.md`.
 *
 * Reads a roadmap's pin, every path it cites, and its `## Decisions` table, and
 * reports what moved since the pin. It reports; it never rewrites a claim. The
 * agent re-verifies what drifted, and `advancePin` only moves the pin once that
 * is done.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { anchorResolves, diffSince, driftedPaths, existedAt, headSha } from './git_drift.js';

export type PinForm = 'tree_pin' | 'drafted-against' | 'read-at';
export type PathState = 'unchanged' | 'drifted' | 'missing' | 'beyond-end';
export type RoadmapVerdict = 'fresh' | 'drifted' | 'broken' | 'unpinned';
export type RevisitState = 'fired' | 'unmet' | 'unverifiable' | 'not-evaluated';

export const DECISION_ANSWERS = ['holds', 'holds-changed', 'falls'] as const;

export interface Pin {
    sha: string;
    form: PinForm;
}

export interface Citation {
    path: string;
    /** Highest line number the citation names, when it names one. */
    maxLine: number | null;
}

export interface CitationReport extends Citation {
    state: PathState;
}

export interface DecisionReport {
    id: string;
    line: number;
    row: string;
    drifted: string[];
    revisit: RevisitState;
    /** Rendered council question; present only when the row's evidence moved. */
    question?: string;
}

export interface RevalidationReport {
    pin: Pin | null;
    head: string | null;
    verdict: RoadmapVerdict;
    /** True when the cheap path answered and no line range was read. */
    cheap: boolean;
    citations: CitationReport[];
    decisions: DecisionReport[];
    reason?: string;
}

const SHA = '([0-9a-f]{7,40})';
const PIN_PATTERNS: ReadonlyArray<[PinForm, RegExp]> = [
    ['tree_pin', new RegExp(`^tree_pin:\\s*(?:main@)?${SHA}\\b`, 'm')],
    ['drafted-against', new RegExp(`^(?:>\\s*)?drafted-against:\\s*(?:main@)?${SHA}\\b`, 'm')],
    ['read-at', new RegExp(`read at \`(?:origin/)?main@${SHA}\``, 'i')],
];

/** The roadmap's pin, in precedence order of the three accepted forms. */
export function readPin(text: string): Pin | null {
    for (const [form, re] of PIN_PATTERNS) {
        const m = re.exec(text);
        if (m !== null) return { sha: m[1] as string, form };
    }
    return null;
}

const CITATION_RE = /`([A-Za-z0-9_][A-Za-z0-9_./-]*\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)(?::(\d[\d,/-]*))?`/g;

/** Every repository path the text cites in backticks, with the highest line it names. */
export function parseCitations(text: string): Citation[] {
    const out = new Map<string, number | null>();
    CITATION_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CITATION_RE.exec(text)) !== null) {
        const p = m[1] as string;
        if (p.includes('..') || p.startsWith('/')) continue;
        const nums = (m[2] ?? '').split(/[,/-]/).map(Number).filter((n) => Number.isFinite(n) && n > 0);
        const max = nums.length > 0 ? Math.max(...nums) : null;
        const prev = out.get(p);
        out.set(p, prev === undefined ? max : max === null ? prev : prev === null ? max : Math.max(prev, max));
    }
    return [...out.entries()].map(([p, maxLine]) => ({ path: p, maxLine })).sort((a, b) => a.path.localeCompare(b.path));
}

interface TableRow {
    line: number;
    cells: string[];
    raw: string;
}

/** Rows of the `## Decisions` table, with the header's column names. */
export function decisionTable(text: string): { header: string[]; rows: TableRow[] } {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^## Decisions\b/.test(l));
    if (start < 0) return { header: [], rows: [] };
    const split = (l: string): string[] => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    let header: string[] = [];
    const rows: TableRow[] = [];
    for (let i = start + 1; i < lines.length; i++) {
        const l = lines[i] as string;
        if (/^## /.test(l)) break;
        if (!l.trim().startsWith('|')) continue;
        if (/^\|\s*-/.test(l.trim())) continue;
        if (header.length === 0) {
            header = split(l).map((c) => c.toLowerCase());
            continue;
        }
        rows.push({ line: i + 1, cells: split(l), raw: l });
    }
    return { header, rows };
}

const SAFE_REVISIT_RE = /^`?test -[ef] ([A-Za-z0-9_][A-Za-z0-9_./*-]*)`?$/;

/**
 * Only `test -f <path>` and `test -e <path>` are evaluated. Anything else is never
 * executed: a roadmap's text is untrusted input to a script.
 */
export function evaluateRevisitIf(cell: string, root: string, rowDrifted: boolean): RevisitState {
    const c = cell.trim();
    const m = SAFE_REVISIT_RE.exec(c);
    if (m !== null) {
        const target = m[1] as string;
        if (target.includes('..')) return 'unverifiable';
        if (target.includes('*')) {
            const dir = path.join(root, path.dirname(target));
            const re = new RegExp(`^${path.basename(target).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
            try {
                return fs.readdirSync(dir).some((n) => re.test(n)) ? 'fired' : 'unmet';
            } catch {
                return 'unmet';
            }
        }
        return fs.existsSync(path.join(root, target)) ? 'fired' : 'unmet';
    }
    if (/`[^`]+`/.test(c) && /^`/.test(c)) return 'unverifiable';
    return rowDrifted ? 'unverifiable' : 'not-evaluated';
}

function lineCount(abs: string): number {
    const body = fs.readFileSync(abs, 'utf-8');
    return body.endsWith('\n') ? body.split('\n').length - 1 : body.split('\n').length;
}

/** The council question for one decision row whose evidence moved. */
export function renderQuestion(input: { roadmap: string; pin: string; row: string; drifted: readonly string[]; diff: string }): string {
    return [
        `Roadmap \`${input.roadmap}\` recorded this decision against \`${input.pin}\`:`,
        '',
        input.row,
        '',
        `These paths it rests on changed since then: ${input.drifted.map((p) => `\`${p}\``).join(', ')}.`,
        '',
        'Diff since the pin:',
        '',
        '```diff',
        input.diff.trim() === '' ? '(no textual diff — the path was deleted or is outside the tree)' : input.diff.trimEnd(),
        '```',
        '',
        `Does the decision still hold given only this diff? Answer exactly one of ${DECISION_ANSWERS.map((a) => `\`${a}\``).join(' | ')}, then the reason grounded in the diff.`,
    ].join('\n');
}

export interface RevalidateInput {
    root: string;
    /** Repository-relative path of the roadmap; its own path is never a citation. */
    roadmapRel: string;
    text: string;
    /**
     * Which of the given paths are absent from the tree now. `roadmap:context`
     * passes its `staleArtefactVerdict`, so the probe and this primitive share one
     * definition of "absent".
     */
    absentNow?: (paths: readonly string[]) => string[];
}

export function revalidate(input: RevalidateInput): RevalidationReport {
    const { root, text } = input;
    const pin = readPin(text);
    const head = headSha(root);
    const cites = parseCitations(text).filter((c) => c.path !== input.roadmapRel);
    const decisionsRaw = decisionTable(text);
    const base: Omit<RevalidationReport, 'verdict' | 'cheap'> = { pin, head, citations: [], decisions: [] };
    if (pin === null) return { ...base, verdict: 'unpinned', cheap: true, reason: 'no tree_pin, drafted-against or read-at line' };
    if (!anchorResolves(root, pin.sha)) return { ...base, verdict: 'unpinned', cheap: true, reason: `pin ${pin.sha} does not resolve in this repository` };

    const changed = new Set(driftedPaths(root, pin.sha, cites.map((c) => c.path), { workingTree: true }));
    if (changed.size === 0) {
        // Cheap path: nothing cited moved since the pin. Line ranges are not read.
        const citations = cites.map((c) => ({ ...c, state: 'unchanged' as PathState }));
        const decisions = decisionsRaw.rows.map((r) => decisionReport(r, decisionsRaw.header, root, new Map()));
        return { ...base, citations, decisions, verdict: 'fresh', cheap: true };
    }

    const absent = new Set(
        (input.absentNow ?? ((ps) => ps.filter((p) => !fs.existsSync(path.join(root, p)))))(cites.map((c) => c.path)),
    );
    const states = new Map<string, PathState>();
    const citations: CitationReport[] = cites.map((c) => {
        let state: PathState = 'unchanged';
        const abs = path.join(root, c.path);
        const exists = !absent.has(c.path);
        if (changed.has(c.path)) state = exists ? 'drifted' : existedAt(root, pin.sha, c.path) ? 'missing' : 'unchanged';
        if (exists && c.maxLine !== null && fs.statSync(abs).isFile() && c.maxLine > lineCount(abs)) state = 'beyond-end';
        states.set(c.path, state);
        return { ...c, state };
    });
    const decisions = decisionsRaw.rows.map((r) => {
        const rep = decisionReport(r, decisionsRaw.header, root, states);
        if (rep.drifted.length > 0) {
            rep.question = renderQuestion({
                roadmap: input.roadmapRel,
                pin: pin.sha,
                row: r.raw,
                drifted: rep.drifted,
                diff: diffSince(root, pin.sha, rep.drifted),
            });
        }
        return rep;
    });
    const broken = citations.some((c) => c.state === 'missing' || c.state === 'beyond-end');
    const drifted = citations.some((c) => c.state === 'drifted');
    return { ...base, citations, decisions, verdict: broken ? 'broken' : drifted ? 'drifted' : 'fresh', cheap: false };
}

function decisionReport(r: TableRow, header: readonly string[], root: string, states: ReadonlyMap<string, PathState>): DecisionReport {
    const drifted = parseCitations(r.raw)
        .map((c) => c.path)
        .filter((p) => {
            const s = states.get(p);
            return s === 'drifted' || s === 'missing' || s === 'beyond-end';
        });
    const revisitCol = header.findIndex((h) => h === 'revisit if' || h === 'revisit-if');
    const cell = revisitCol >= 0 ? (r.cells[revisitCol] ?? '') : '';
    return {
        id: r.cells[0] ?? '',
        line: r.line,
        row: r.raw,
        drifted,
        revisit: cell === '' || cell === '—' ? 'not-evaluated' : evaluateRevisitIf(cell, root, drifted.length > 0),
    };
}

/**
 * Move the pin to `sha` and record the revalidation. Refuses on `broken`: a
 * missing file is resolved, never advanced past.
 */
export function advancePin(text: string, sha: string, date: string, verdict: RoadmapVerdict): string {
    if (verdict === 'broken') throw new Error('refusing to advance the pin of a broken roadmap — resolve every missing or beyond-end citation first');
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
    if (fm === null) throw new Error('roadmap has no frontmatter to carry tree_pin');
    let body = fm[1] as string;
    const rev = `revalidated: ${sha} ${date}`;
    body = /^tree_pin:.*$/m.test(body) ? body.replace(/^tree_pin:.*$/m, `tree_pin: ${sha}`) : `${body}\ntree_pin: ${sha}`;
    body = /^revalidated:.*$/m.test(body) ? body.replace(/^revalidated:.*$/m, rev) : body.replace(/^tree_pin:.*$/m, (l) => `${l}\n${rev}`);
    return `---\n${body}\n---\n${text.slice(fm[0].length)}`;
}

/** Freshness for the drain queue: the cheap path only, never a line read. */
export function freshness(root: string, roadmapRel: string, text: string): RoadmapVerdict {
    const pin = readPin(text);
    if (pin === null || !anchorResolves(root, pin.sha)) return 'unpinned';
    const cites = parseCitations(text).map((c) => c.path).filter((p) => p !== roadmapRel);
    const changed = driftedPaths(root, pin.sha, cites, { workingTree: true });
    if (changed.length === 0) return 'fresh';
    return changed.some((p) => !fs.existsSync(path.join(root, p)) && existedAt(root, pin.sha, p)) ? 'broken' : 'drifted';
}
