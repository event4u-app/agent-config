/**
 * Throughput figures for `probe_turnaround`. Pure classifiers and tallies; the
 * transcript pass that feeds them stays in `probe_turnaround.ts`, so there is
 * one reader, not two.
 *
 * Every table here is EXCLUSIVE and carries an `unknown` row: a row that matches
 * no rule is counted there, never dropped, and `checkSum` refuses a table whose
 * class rows do not add up to its total. A table that double-counts reads as a
 * larger effect than the corpus holds, which is the defect the 2026-10-14
 * analysis carried in three of its tables.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Turn ends — how a run hands control back
// ---------------------------------------------------------------------------

export const TURN_END_CLASSES = ['structured-ask', 'plain-ask', 'other', 'unknown'] as const;
export type TurnEndClass = (typeof TURN_END_CLASSES)[number];

const OPTION_LINE = /^\s*\d+[.)]\s+\S/;
const RECOMMENDATION_LINE = /^\s*(?:>\s*)?(?:\*\*)?(?:Recommendation|Empfehlung)\b/i;

/** Text outside fenced code blocks; a `?` inside a fence asks nobody anything. */
function prose(text: string): string[] {
    const out: string[] = [];
    let fenced = false;
    for (const line of text.split('\n')) {
        if (/^\s*(```|~~~)/.test(line)) {
            fenced = !fenced;
            continue;
        }
        if (!fenced) out.push(line);
    }
    return out;
}

/**
 * A structured ask is the numbered-options shape `user-interaction` prescribes:
 * at least two option lines AND a recommendation line. A plain-text ask is a
 * turn whose last prose line ends in a question mark, read through trailing
 * emphasis, quotes, brackets and a trailing link. Precedence is fixed, so a
 * structured ask that also ends in `?` is counted once.
 */
export function classifyTurnEnd(text: string): TurnEndClass {
    const lines = prose(text);
    const options = lines.filter((l) => OPTION_LINE.test(l)).length;
    if (options >= 2 && lines.some((l) => RECOMMENDATION_LINE.test(l))) return 'structured-ask';
    const last = [...lines].reverse().find((l) => l.trim() !== '');
    if (last !== undefined && /[?？][*_`'"”)\]\s]*(?:\(<?https?:\/\/\S+>?\)|<https?:\/\/\S+>)?[*_)\]\s]*$/.test(last)) return 'plain-ask';
    return 'other';
}

// ---------------------------------------------------------------------------
// Usage-limit pauses
// ---------------------------------------------------------------------------

type Entry = Record<string, unknown>;

function informational(e: Entry): string | null {
    if (e['type'] !== 'system' || e['subtype'] !== 'informational') return null;
    return typeof e['content'] === 'string' ? e['content'] : null;
}

/** The host's own banner when a run is suspended on the account's usage limit. */
export function isUsageLimitPause(e: Entry): boolean {
    return /^Usage limit reached\b/.test(informational(e) ?? '');
}

/** The banner that ends a pause. */
export function isUsageLimitReset(e: Entry): boolean {
    return /^Usage limit reset\b/.test(informational(e) ?? '');
}

// ---------------------------------------------------------------------------
// Nights
// ---------------------------------------------------------------------------

const BERLIN = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
});

/**
 * The night an instant belongs to, as the `YYYY-MM-DD` of the evening it began,
 * or `null` for day time. A night is 22:00–08:00 Europe/Berlin, the window the
 * owner's question was asked about; an instant before 08:00 belongs to the
 * previous evening.
 */
export function nightKey(epochMs: number): string | null {
    const parts = Object.fromEntries(BERLIN.formatToParts(new Date(epochMs)).map((p) => [p.type, p.value]));
    const hour = Number(parts['hour']);
    const date = `${String(parts['year'])}-${String(parts['month'])}-${String(parts['day'])}`;
    if (hour >= 22) return date;
    if (hour >= 8) return null;
    const prev = new Date(`${date}T12:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    return prev.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Git throughput
// ---------------------------------------------------------------------------

export interface CommitFacts {
    epochMs: number;
    parents: number;
    /** Added minus removed checked-step lines in the roadmap tree. */
    ticked: number;
    /** Roadmap files added or renamed into the archive directory. */
    archived: number;
    /** The subject names a pull request — `(#N)` at its end, or a merge of one. */
    pr: boolean;
}

export interface NightTally {
    /** Nights in the window that carry at least one commit. */
    nights: number;
    /** Every night in the window, active or not — the denominator a stalled night stays in. */
    calendarNights: number;
    commits: number;
    /** Commits whose subject names a pull request. */
    prCommits: number;
    trueMerges: number;
    netTicked: number;
    archived: number;
}

/** Every night in `[from, to]`, inclusive. */
export function calendarNights(from: string, to: string): number {
    const a = Date.parse(`${from}T00:00:00Z`);
    const b = Date.parse(`${to}T00:00:00Z`);
    return Number.isNaN(a) || Number.isNaN(b) || b < a ? 0 : Math.round((b - a) / 86_400_000) + 1;
}

/** Totals over the nights in `[from, to]`, with both the active and the calendar night count. */
export function tallyNights(commits: readonly CommitFacts[], from: string, to: string): NightTally {
    const nights = new Set<string>();
    const t: NightTally = {
        nights: 0,
        calendarNights: calendarNights(from, to),
        commits: 0,
        prCommits: 0,
        trueMerges: 0,
        netTicked: 0,
        archived: 0,
    };
    for (const c of commits) {
        const n = nightKey(c.epochMs);
        if (n === null || n < from || n > to) continue;
        nights.add(n);
        t.commits += 1;
        if (c.pr) t.prCommits += 1;
        if (c.parents > 1) t.trueMerges += 1;
        t.netTicked += c.ticked;
        t.archived += c.archived;
    }
    t.nights = nights.size;
    return t;
}

/** A squash subject ending in `(#N)`, or GitHub's merge-commit subject. */
export function isPrSubject(subject: string): boolean {
    return /\(#\d+\)\s*$/.test(subject) || /^Merge pull request #\d+\b/.test(subject);
}

const TICK_ADDED = /^\+\s*- \[x\]/i;
const TICK_REMOVED = /^-\s*- \[x\]/i;

/**
 * First-parent commit facts of `ref` between two dates, read from git. A merge
 * commit is diffed against its first parent, so a squash and a true merge of the
 * same change count the same ticks. A checked step in a file the commit creates
 * is authoring, not work done, and is not counted.
 */
export function readCommitFacts(repoRoot: string, ref: string, from: string, to: string): CommitFacts[] {
    const since = new Date(`${from}T00:00:00Z`);
    since.setUTCDate(since.getUTCDate() - 1);
    const until = new Date(`${to}T00:00:00Z`);
    until.setUTCDate(until.getUTCDate() + 2);
    const range = [`--since=${since.toISOString()}`, `--until=${until.toISOString()}`];
    const git = (args: string[]): string =>
        execFileSync('git', ['-C', repoRoot, ...args], { maxBuffer: 1 << 30, encoding: 'utf8' });

    const facts = new Map<string, CommitFacts>();
    for (const row of git(['log', '--first-parent', ref, ...range, '--format=%H%x09%ct%x09%P%x09%s']).split('\n')) {
        const [sha, ct, parents, subject] = row.split('\t');
        if (sha === undefined || sha === '' || ct === undefined) continue;
        facts.set(sha, {
            epochMs: Number(ct) * 1000,
            parents: (parents ?? '').split(' ').filter((x) => x !== '').length,
            ticked: 0,
            archived: 0,
            pr: isPrSubject(subject ?? ''),
        });
    }
    const patch = git(['log', '--first-parent', '-m', ref, ...range, '--format=%x00%H', '-p', '--no-color', '-U0', '--', 'agents/roadmaps']);
    for (const chunk of patch.split('\0').slice(1)) {
        const [head, ...lines] = chunk.split('\n');
        const f = facts.get((head ?? '').trim());
        if (f === undefined) continue;
        let created = false;
        for (const l of lines) {
            if (l.startsWith('diff --git ')) created = false;
            else if (l.startsWith('new file mode')) created = true;
            else if (created) continue;
            else if (TICK_ADDED.test(l)) f.ticked += 1;
            else if (TICK_REMOVED.test(l)) f.ticked -= 1;
        }
    }
    const status = git(['log', '--first-parent', '-m', ref, ...range, '--format=%x00%H', '--name-status', '-M', '--', 'agents/roadmaps/archive']);
    for (const chunk of status.split('\0').slice(1)) {
        const [head, ...lines] = chunk.split('\n');
        const f = facts.get((head ?? '').trim());
        if (f === undefined) continue;
        for (const l of lines) {
            const cols = l.split('\t');
            const dest = cols[cols.length - 1] ?? '';
            if (/^(A|R\d*)$/.test(cols[0] ?? '') && /^agents\/roadmaps\/archive\/[^/]+\.md$/.test(dest)) f.archived += 1;
        }
    }
    return [...facts.values()];
}

// ---------------------------------------------------------------------------
// Exclusive tallies and the sum check
// ---------------------------------------------------------------------------

export interface Tally {
    total: number;
    rows: Record<string, number>;
}

/**
 * Count `items` into `classes` plus `unknown`. The labeller may return any
 * number of labels; an item with none lands in `unknown`, and an item with two
 * is counted in both, which is exactly what `checkSum` exists to catch.
 */
export function tallyExclusive<T>(items: readonly T[], classes: readonly string[], label: (item: T) => readonly string[]): Tally {
    const rows: Record<string, number> = Object.fromEntries([...classes, 'unknown'].map((c) => [c, 0]));
    for (const item of items) {
        const labels = label(item);
        if (labels.length === 0) rows['unknown'] = (rows['unknown'] ?? 0) + 1;
        for (const l of labels) rows[l] = (rows[l] ?? 0) + 1;
    }
    return { total: items.length, rows };
}

/** `null` when the class rows add up to the total, else the discrepancy. */
export function checkSum(name: string, rows: Readonly<Record<string, number>>, total: number): string | null {
    const sum = Object.values(rows).reduce((a, b) => a + b, 0);
    return sum === total ? null : `${name}: rows sum to ${String(sum)}, total is ${String(total)}`;
}

// ---------------------------------------------------------------------------
// Estate and standing-context figures
// ---------------------------------------------------------------------------

export interface EstateFigures {
    ready: number;
    /** `ready` roadmaps that carry no ticked step. */
    atZero: number;
    /** Open steps across every roadmap with a `status:` line. */
    openSteps: number;
    /** Open steps whose text, up to the next checkbox or heading, names no `blocked-by`. */
    unblocked: number;
}

const ANY_CHECKBOX = /^\s*- \[[ x~-]\]/i;

/** A step marker, not a prose mention: `blocked-by:` or a code-spanned `` `blocked-by``. */
const BLOCKED_BY = /blocked-by\s*:|`blocked-by/;

/** Estate figures over roadmap bodies; `status:` is read from the frontmatter only. */
export function estateOf(bodies: readonly string[]): EstateFigures {
    const out: EstateFigures = { ready: 0, atZero: 0, openSteps: 0, unblocked: 0 };
    for (const body of bodies) {
        const fm = /^---\n([\s\S]*?)\n---/.exec(body)?.[1] ?? null;
        if (fm === null || !/^status:/m.test(fm)) continue;
        if (/^status:\s*ready\s*$/m.test(fm)) {
            out.ready += 1;
            if (!/^\s*- \[x\]/im.test(body)) out.atZero += 1;
        }
        const lines = body.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (!/^\s*- \[ \]/.test(lines[i] as string)) continue;
            let text = lines[i] as string;
            for (let j = i + 1; j < lines.length && !ANY_CHECKBOX.test(lines[j] as string) && !/^#/.test(lines[j] as string); j++) {
                text += `\n${lines[j] as string}`;
            }
            out.openSteps += 1;
            if (!BLOCKED_BY.test(text)) out.unblocked += 1;
        }
    }
    return out;
}

/** Estate figures over the roadmap files directly under `dir`, in the working tree. */
export function readyAtZero(dir: string): EstateFigures {
    let names: string[];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md'));
    } catch {
        return estateOf([]);
    }
    return estateOf(names.map((n) => fs.readFileSync(path.join(dir, n), 'utf8')));
}

/** Estate figures at a git ref, so a run's estate and git figures share one tree. */
export function readEstateAtRef(repoRoot: string, ref: string): EstateFigures {
    const git = (args: string[]): string =>
        execFileSync('git', ['-C', repoRoot, ...args], { maxBuffer: 1 << 28, encoding: 'utf8' });
    const names = git(['ls-tree', '--name-only', ref, 'agents/roadmaps/'])
        .split('\n')
        .filter((n) => /^agents\/roadmaps\/[^/]+\.md$/.test(n));
    return estateOf(names.map((n) => git(['show', `${ref}:${n}`])));
}

/**
 * Rule files in a host rule directory, and how many load unconditionally: the
 * host reads `paths:` as the only activation key, so a file without one in its
 * frontmatter is loaded on every turn.
 */
export function standingRules(dir: string): { files: number; withoutPaths: number } {
    const out = { files: 0, withoutPaths: 0 };
    let names: string[];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md'));
    } catch {
        return out;
    }
    for (const n of names) {
        out.files += 1;
        const fm = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(path.join(dir, n), 'utf8'));
        if (fm === null || !/^paths:/m.test(fm[1] ?? '')) out.withoutPaths += 1;
    }
    return out;
}

/** Median of a list, `null` when empty. */
export function median(xs: readonly number[]): number | null {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/**
 * Wall-clock minutes of successful pull-request runs of one workflow, from the
 * CI API through `gh`. `updatedAt − startedAt` is the duration to within the
 * run's last status write, the finest resolution the listing offers.
 */
export const CI_LIST_LIMIT = 1000;

export function readCiMinutes(repoRoot: string, workflow: string, from: string, to: string): { minutes: number[]; truncated: boolean } {
    const raw = execFileSync(
        'gh',
        [
            'run', 'list', '--workflow', workflow, '--event', 'pull_request', '--status', 'success',
            '--created', `${from}..${to}`, '--limit', String(CI_LIST_LIMIT), '--json', 'startedAt,updatedAt',
        ],
        { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 26 },
    );
    const rows = JSON.parse(raw) as Array<{ startedAt?: string; updatedAt?: string }>;
    const out: number[] = [];
    for (const r of rows) {
        const a = Date.parse(r.startedAt ?? '');
        const b = Date.parse(r.updatedAt ?? '');
        if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) out.push((b - a) / 60_000);
    }
    return { minutes: out, truncated: rows.length >= CI_LIST_LIMIT };
}
