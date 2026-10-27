/**
 * Provenance: since when a file, a table, a column or a route exists, and for
 * which pull request and ticket it came in — read from the local git history
 * only.
 *
 * Sources, all offline: commit subjects and bodies, first-parent merge commits
 * (`Merge pull request #N from owner/branch`), squash subjects ending in
 * `(#N)`, GitLab's `See merge request group/project!N` trailer, and ticket keys
 * the one ticket grammar finds in a branch name, a subject or a body — the
 * places trackers themselves link from. Ticket and pull-request TEXT is never
 * read here and never stored: the map carries keys, numbers, dates, short
 * commit ids and author names (an author configured as an address is withheld).
 *
 * Honest gaps, each surfaced as `unknown`: a squash keeps only the PR's subject;
 * a rebase or cherry-pick loses the branch; a shallow clone has no history; a
 * history longer than the bound has its oldest commits unread, so an element
 * older than the window shows no introduction rather than a wrong one.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parseTicketKeys, parseTrackerKeys, ticketCandidates } from '../_lib/git_convention_grammar.js';
import { defaultBranch } from '../_lib/branch_parents.js';
import { gitProbe } from '../_lib/spawn_env.js';
import { type FixKind, classifyFix } from './fix_kinds.js';

export interface CommitRef {
    sha: string;
    date: string;
    author: string;
    pr: string | null;
    tickets: string[];
    subject: string;
    /** present on a fix commit: declared, ticket or conventional (H.3) */
    kind?: FixKind;
}

export interface FileProvenance {
    /** index into `commits`; null when the add is older than the window read */
    introduced: number | null;
    last: number;
    changes: number;
}

export interface ProvenanceIndex {
    head: string;
    /** commits referenced by a file, oldest first */
    commits: CommitRef[];
    files: Record<string, FileProvenance>;
    /** ticket key → commit indexes */
    tickets: Record<string, number[]>;
    /** `#N` or `!N` → commit indexes */
    prs: Record<string, number[]>;
    /** commit index → files it touched, current names */
    touched: Record<number, string[]>;
    /** true when the bound stopped the read before the first commit */
    truncated: boolean;
    reason?: string;
}

export const MAX_COMMITS = 20_000;
const SUBJECT_MAX = 120;
const RS = '\x1e';
const US = '\x1f';
const GS = '\x1d';

type Git = (args: readonly string[]) => string;

const defaultGit =
    (root: string): Git =>
    (args) =>
        gitProbe(root, args, { maxBuffer: 1024 * 1024 * 1024, timeout: 60_000 });

const PR_MERGE = /^Merge pull request #(\d+) from [^/\s]+\/(\S+)/;
const PR_SQUASH = /\(#(\d+)\)\s*$/;
const MR_TRAILER = /See merge request [\w./-]+!(\d+)/;
const MR_MERGE = /^Merge branch '([^']+)' into /;

interface Raw {
    sha: string;
    parents: string[];
    date: string;
    author: string;
    subject: string;
    body: string;
}

/**
 * Ticket keys of one commit. With a convention card naming the project's keys,
 * a key counts anywhere in the branch, subject or body. Without one, only where
 * a tracker links from by convention — the branch name and the head of the
 * subject (`ABC-12: …`, `[ABC-12] …`, `feat(ABC-12): …`): prose mentions
 * acceptance criteria and standards in the same shape (`AC-1`, `ISO-8601`).
 */
export function ticketsIn(branch: string | null, subject: string, body: string, keys: readonly string[] | null): string[] {
    const ok = (text: string): string[] => ticketCandidates(text, keys).filter((c) => c.status === 'ticket').map((c) => c.token);
    if (keys) return [...new Set(ok(`${branch ?? ''}\n${subject}\n${body}`))].sort();
    const head = /^\s*(?:\[([^\]]+)\]|[a-z]+\(([^)]+)\)!?:|([A-Z][A-Z0-9]+-\d+)\b)/.exec(subject);
    const lead = head ? (head[1] ?? head[2] ?? head[3] ?? '') : '';
    return [...new Set([...ok(branch ?? ''), ...ok(lead)])].sort();
}

export function ticketKeysOf(root: string): string[] | null {
    for (const f of ['.git-convention.yml', '.git-convention.yaml']) {
        try {
            const keys = parseTicketKeys(fs.readFileSync(path.join(root, f), 'utf-8'));
            if (keys.length) return keys;
        } catch {
            /* no card: the grammar and its denylist decide */
        }
    }
    return null;
}

/** The card's `tracker_keys`: bug-tracker keys that extend the ticket grammar. */
export function trackerKeysOf(root: string): string[] {
    for (const f of ['.git-convention.yml', '.git-convention.yaml']) {
        try {
            return parseTrackerKeys(fs.readFileSync(path.join(root, f), 'utf-8'));
        } catch {
            /* no card */
        }
    }
    return [];
}

export function readProvenance(root: string, opts: { git?: Git; maxCommits?: number } = {}): ProvenanceIndex | null {
    const git = opts.git ?? defaultGit(root);
    const max = opts.maxCommits ?? MAX_COMMITS;
    let head: string;
    try {
        head = git(['rev-parse', 'HEAD']).trim();
        if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
            return { head, commits: [], files: {}, tickets: {}, prs: {}, touched: {}, truncated: true, reason: 'shallow clone: no history to read' };
        }
    } catch {
        return null;
    }
    const keys = ticketKeysOf(root);
    const trackerKeys = trackerKeysOf(root);
    let metaOut: string;
    let filesOut: string;
    let current: Set<string>;
    try {
        metaOut = git(['log', `-n${max}`, `--format=${RS}%H${US}%P${US}%cs${US}%aN${US}%s${US}%b${GS}`]);
        filesOut = git(['-c', 'core.quotePath=false', 'log', `-n${max}`, '--no-merges', '-M', '--relative', '--name-status', `--format=${RS}%H`, '--', '.']);
        current = new Set(git(['-c', 'core.quotePath=false', 'ls-files', '-z', '--', '.']).split('\0').filter(Boolean));
    } catch {
        return { head, commits: [], files: {}, tickets: {}, prs: {}, touched: {}, truncated: true, reason: 'git log failed' };
    }

    const raws: Raw[] = [];
    for (const rec of metaOut.split(RS)) {
        if (!rec.trim()) continue;
        const body = rec.slice(0, rec.lastIndexOf(GS) >= 0 ? rec.lastIndexOf(GS) : rec.length);
        const [sha = '', parents = '', date = '', author = '', subject = '', ...rest] = body.split(US);
        if (!sha) continue;
        raws.push({ sha, parents: parents.split(' ').filter(Boolean), date, author, subject, body: rest.join(US) });
    }
    const truncated = raws.length >= max;
    const bySha = new Map(raws.map((r) => [r.sha, r] as const));

    // Pull requests: a first-parent merge owns the commits its second parent brings in.
    const prOf = new Map<string, { pr: string; branch: string | null }>();
    // The first-parent line of HEAD and of the default branch: on a branch that merged its parent in,
    // the parent's own PR merges sit behind a second parent, and they still own their commits.
    const mainline = new Set<string>();
    const tips = [raws[0]?.sha, ...['refs/heads/' + defaultBranch(root), 'refs/remotes/origin/HEAD'].map((r) => {
        try {
            return git(['rev-parse', '--verify', '--quiet', `${r}^{commit}`]).trim();
        } catch {
            return '';
        }
    })].filter((x): x is string => !!x);
    for (const tip of tips) for (let x: Raw | undefined = bySha.get(tip); x && !mainline.has(x.sha); x = bySha.get(x.parents[0] ?? '')) mainline.add(x.sha);
    const age = new Map(raws.map((r, i) => [r.sha, i] as const));
    const firstParentMerges = raws.filter((r) => mainline.has(r.sha) && r.parents.length > 1).sort((a, b) => (age.get(b.sha) as number) - (age.get(a.sha) as number));
    for (const m of firstParentMerges) {
        const gh = PR_MERGE.exec(m.subject);
        const mr = MR_TRAILER.exec(m.body);
        const pr = gh ? `#${gh[1]}` : mr ? `!${mr[1]}` : null;
        if (!pr) continue;
        const branch = gh ? (gh[2] as string) : (MR_MERGE.exec(m.subject)?.[1] ?? null);
        prOf.set(m.sha, { pr, branch });
        const stack = [m.parents[1] as string];
        while (stack.length) {
            const s = stack.pop() as string;
            if (!s || mainline.has(s) || prOf.has(s)) continue;
            prOf.set(s, { pr, branch });
            const r = bySha.get(s);
            if (r) stack.push(...r.parents);
        }
    }
    for (const r of raws) {
        if (prOf.has(r.sha)) continue;
        const sq = PR_SQUASH.exec(r.subject);
        const mr = MR_TRAILER.exec(r.body);
        if (sq) prOf.set(r.sha, { pr: `#${sq[1]}`, branch: null });
        else if (mr) prOf.set(r.sha, { pr: `!${mr[1]}`, branch: null });
    }

    const refOf = (r: Raw): CommitRef => {
        const p = prOf.get(r.sha);
        const tickets = ticketsIn(p?.branch ?? null, r.subject, r.body, keys);
        const kind = classifyFix(r.subject, r.body, { ticketKeys: keys, trackerKeys }).kind;
        return {
            sha: r.sha.slice(0, 12),
            date: r.date,
            author: r.author.includes('@') ? '(name withheld)' : r.author,
            pr: p?.pr ?? null,
            tickets,
            subject: r.subject.length > SUBJECT_MAX ? `${r.subject.slice(0, SUBJECT_MAX - 1)}…` : r.subject,
            ...(kind ? { kind } : {}),
        };
    };

    // Files: newest first; a rename maps every older mention to today's name.
    const alias = new Map<string, string>();
    const canonical = (p: string): string => alias.get(p) ?? p;
    const perFile = new Map<string, { newest: string; oldest: string; added: string | null; changes: number }>();
    const touchedBy = new Map<string, Set<string>>();
    for (const rec of filesOut.split(RS)) {
        if (!rec.trim()) continue;
        const [sha = '', ...lines] = rec.split('\n');
        const s = sha.trim();
        if (!s) continue;
        for (const line of lines) {
            if (!line.trim()) continue;
            const cols = line.split('\t');
            const status = cols[0] ?? '';
            let file: string;
            if ((status.startsWith('R') || status.startsWith('C')) && cols.length >= 3) {
                file = canonical(cols[2] as string);
                if (status.startsWith('R')) alias.set(cols[1] as string, file);
            } else file = canonical(cols[1] ?? '');
            if (!file || !current.has(file)) continue;
            const f = perFile.get(file) ?? { newest: s, oldest: s, added: null, changes: 0 };
            f.oldest = s;
            f.changes++;
            if (status === 'A') f.added = s;
            perFile.set(file, f);
            const t = touchedBy.get(s) ?? new Set<string>();
            t.add(file);
            touchedBy.set(s, t);
        }
    }

    const commits: CommitRef[] = [];
    const indexOf = new Map<string, number>();
    const idx = (sha: string): number => {
        const known = indexOf.get(sha);
        if (known !== undefined) return known;
        const r = bySha.get(sha);
        if (!r) return -1;
        indexOf.set(sha, commits.length);
        commits.push(refOf(r));
        return commits.length - 1;
    };
    const files: ProvenanceIndex['files'] = {};
    for (const [file, f] of [...perFile.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
        // An add inside the window is the introduction; without one the file is older than what was read.
        const introducedSha = f.added ?? (truncated ? null : f.oldest);
        const introduced = introducedSha ? idx(introducedSha) : null;
        files[file] = { introduced: introduced !== null && introduced >= 0 ? introduced : null, last: idx(f.newest), changes: f.changes };
    }
    // Every commit carrying a ticket or a PR is indexed, so the reverse search finds it even when no file still names it as first or last.
    const tickets: ProvenanceIndex['tickets'] = {};
    const prs: ProvenanceIndex['prs'] = {};
    const touched: ProvenanceIndex['touched'] = {};
    for (const r of raws) {
        if (r.parents.length > 1) continue;
        const ref = refOf(r);
        if (!ref.pr && ref.tickets.length === 0) continue;
        const i = idx(r.sha);
        for (const t of ref.tickets) (tickets[t] ??= []).push(i);
        if (ref.pr) (prs[ref.pr] ??= []).push(i);
        const tf = touchedBy.get(r.sha);
        if (tf) touched[i] = [...tf].sort();
    }
    // Oldest first, so an index reads in history order; remap every reference.
    // Oldest first by date; one day's commits in history order (git log lists newest first).
    const rank = new Map(raws.map((r, i) => [r.sha.slice(0, 12), i] as const));
    const order = commits
        .map((c, i) => [c, i] as const)
        .sort(([a], [b]) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (rank.get(b.sha) ?? 0) - (rank.get(a.sha) ?? 0)));
    const remap = new Map(order.map(([, old], nu) => [old, nu] as const));
    const re = (i: number): number => remap.get(i) as number;
    for (const f of Object.values(files)) {
        f.last = re(f.last);
        if (f.introduced !== null) f.introduced = re(f.introduced);
    }
    const remapList = (rec: Record<string, number[]>): Record<string, number[]> =>
        Object.fromEntries(Object.entries(rec).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, [...new Set(v.map(re))].sort((a, b) => a - b)]));
    const touchedOut: ProvenanceIndex['touched'] = {};
    for (const [k, v] of Object.entries(touched)) touchedOut[re(Number(k))] = v;
    return {
        head: head.slice(0, 12),
        commits: order.map(([c]) => c),
        files,
        tickets: remapList(tickets),
        prs: remapList(prs),
        touched: touchedOut,
        truncated,
        ...(truncated ? { reason: `history longer than ${max} commits: older introductions are unknown` } : {}),
    };
}

/** The cached index for HEAD, read once per HEAD under the graph's `.build`. */
export function cachedProvenance(root: string, buildDir: string, opts: { git?: Git } = {}): ProvenanceIndex | null {
    const git = opts.git ?? defaultGit(root);
    let head: string;
    try {
        head = git(['rev-parse', 'HEAD']).trim().slice(0, 12);
    } catch {
        return null;
    }
    const file = path.join(buildDir, 'provenance.json');
    try {
        const cached = JSON.parse(fs.readFileSync(file, 'utf-8')) as ProvenanceIndex;
        if (cached.head === head) return cached;
    } catch {
        /* no cache yet */
    }
    const fresh = readProvenance(root, { git });
    if (fresh) {
        try {
            fs.mkdirSync(buildDir, { recursive: true });
            fs.writeFileSync(file, `${JSON.stringify(fresh)}\n`);
        } catch {
            /* a cache that cannot be written is rebuilt next time */
        }
    }
    return fresh;
}

export interface SpanHistory {
    commits: CommitRef[];
    /** true when the depth bound stopped the walk: the oldest shown is not necessarily the introduction */
    bounded: boolean;
}

export const SPAN_DEPTH = 50;

/**
 * The commits that changed lines `start..end` of `file`, newest first, bounded
 * by `depth`. Cached by the file's blob hash and the span, so an unchanged file
 * never walks its history twice.
 */
export function spanHistory(root: string, file: string, start: number, end: number, opts: { git?: Git; depth?: number; cacheDir?: string; index?: ProvenanceIndex | null; keys?: string[] | null } = {}): SpanHistory | null {
    const git = opts.git ?? defaultGit(root);
    const depth = opts.depth ?? SPAN_DEPTH;
    let blob: string;
    try {
        blob = git(['hash-object', '--', file]).trim();
    } catch {
        return null;
    }
    const key = createHash('sha256').update(`${blob}\0${file}\0${start}\0${end}\0${depth}`).digest('hex').slice(0, 24);
    const cacheFile = opts.cacheDir ? path.join(opts.cacheDir, 'spans', `${key}.json`) : null;
    if (cacheFile) {
        try {
            return JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as SpanHistory;
        } catch {
            /* not cached */
        }
    }
    let out: string;
    try {
        out = git(['log', `-n${depth}`, '-s', `-L${start},${end}:${file}`, `--format=${RS}%H${US}%P${US}%cs${US}%aN${US}%s${US}%b${GS}`]);
    } catch {
        return null;
    }
    const byShort = new Map((opts.index?.commits ?? []).map((c) => [c.sha, c] as const));
    const commits: CommitRef[] = [];
    for (const rec of out.split(RS)) {
        if (!rec.trim()) continue;
        const body = rec.slice(0, rec.lastIndexOf(GS) >= 0 ? rec.lastIndexOf(GS) : rec.length);
        const [sha = '', , date = '', author = '', subject = '', ...rest] = body.split(US);
        if (!sha) continue;
        const known = byShort.get(sha.slice(0, 12));
        if (known) {
            commits.push(known);
            continue;
        }
        const sq = PR_SQUASH.exec(subject);
        const mr = MR_TRAILER.exec(rest.join(US));
        commits.push({
            sha: sha.slice(0, 12),
            date,
            author: author.includes('@') ? '(name withheld)' : author,
            pr: sq ? `#${sq[1]}` : mr ? `!${mr[1]}` : null,
            tickets: ticketsIn(null, subject, rest.join(US), opts.keys ?? null),
            subject: subject.length > SUBJECT_MAX ? `${subject.slice(0, SUBJECT_MAX - 1)}…` : subject,
        });
    }
    const result: SpanHistory = { commits, bounded: commits.length >= depth };
    if (cacheFile) {
        try {
            fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
            fs.writeFileSync(cacheFile, `${JSON.stringify(result)}\n`);
        } catch {
            /* recomputed next time */
        }
    }
    return result;
}

/** One line for a commit: date, short id, PR and tickets — never the commit body. */
export function commitLine(c: CommitRef): string {
    return `${c.date} ${c.sha.slice(0, 8)}${c.pr ? ` ${c.pr}` : ''}${c.tickets.length ? ` ${c.tickets.join(',')}` : ''} ${c.author} — ${c.subject}`;
}

/** The cached index when it was written for the current HEAD; never builds one (a verb's path stays cheap). */
export function readCachedProvenance(root: string, buildDir: string): ProvenanceIndex | null {
    try {
        const head = gitProbe(root, ['rev-parse', 'HEAD']).trim().slice(0, 12);
        const cached = JSON.parse(fs.readFileSync(path.join(buildDir, 'provenance.json'), 'utf-8')) as ProvenanceIndex;
        return cached.head === head ? cached : null;
    } catch {
        return null;
    }
}

/** "introduced for ABC-12, PR #7 (2026-10-01)" for a file, or null when its introduction carries no ticket and no PR. */
export function introducedNote(index: ProvenanceIndex, file: string): string | null {
    const f = index.files[file];
    const c = f && f.introduced !== null ? index.commits[f.introduced] : undefined;
    if (!c || (!c.pr && c.tickets.length === 0)) return null;
    return `introduced for ${[...c.tickets, ...(c.pr ? [`PR ${c.pr}`] : [])].join(', ')} (${c.date})`;
}

/** The tickets and PRs whose commits introduced or last changed the files a diff touches. */
export function ticketsTouched(index: ProvenanceIndex, files: readonly string[]): Array<{ key: string; files: string[] }> {
    const by = new Map<string, Set<string>>();
    for (const file of files) {
        const f = index.files[file];
        if (!f) continue;
        for (const i of [f.introduced, f.last]) {
            const c = i !== null ? index.commits[i] : undefined;
            if (!c) continue;
            for (const k of [...c.tickets, ...(c.pr ? [c.pr] : [])]) by.set(k, (by.get(k) ?? new Set()).add(file));
        }
    }
    return [...by.entries()].map(([key, s]) => ({ key, files: [...s].sort() })).sort((a, b) => b.files.length - a.files.length || (a.key < b.key ? -1 : 1));
}
