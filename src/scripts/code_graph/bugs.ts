/**
 * Bug records: local, normalised, allowlisted (roadmap H.1, ADR-124).
 *
 * Bug data enters in two ways only: a user-run offline snapshot import of
 * tracker JSON, or a fetcher the user's own connection supplies at query time.
 * Nothing here opens a network connection, and nothing is written outside the
 * graph's gitignored `.build/bugs/`.
 *
 * Stored fields are an allowlist built field by field from the input — never a
 * copy with fields removed — so a breadcrumb, a request payload, a user id, a
 * cookie or a title the tracker added later cannot reach the store. Provider
 * text is untrusted: every string kept is sanitised and length-capped.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { sanitizeLabel } from './sanitize.js';

export type BugStatus = 'unresolved' | 'resolved' | 'ignored' | 'regressed' | 'unknown';

export interface BugFrame {
    file: string;
    line: number | null;
    function: string | null;
}

export interface BugEpisode {
    /** when this episode started: first seen, or the regression date */
    opened: string;
    /** when it was resolved, or null while open */
    closed: string | null;
    resolved_in_commit: string | null;
    resolved_in_release: string | null;
}

export interface BugRecord {
    /** `<provider>:<org>/<project>/<issue id>` — unique across trackers and projects */
    id: string;
    provider: string;
    org: string;
    project: string;
    issue: string;
    status: BugStatus;
    first_seen: string | null;
    last_seen: string | null;
    count: number | null;
    first_release: string | null;
    environments: string[];
    episodes: BugEpisode[];
    /** in-app frames of the latest event, innermost first */
    frames: BugFrame[];
    /** a commit the tracker itself suspects; a signal separate from local inducers */
    suspect_commit: string | null;
}

export interface BugStore {
    retrieved_at: string;
    ttl_days: number;
    source: 'snapshot-import' | 'query-time';
    bugs: BugRecord[];
    /** resolving commit → bug ids: one fix closing several issues */
    fixes: Record<string, string[]>;
}

export const BUGS_DIR = 'bugs';
export const BUGS_FILE = 'bugs.json';
export const DEFAULT_TTL_DAYS = 14;
const MAX_FRAMES = 30;
const TEXT_CAP = 200;

type Json = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? sanitizeLabel(v, TEXT_CAP) : typeof v === 'number' ? String(v) : null);
const obj = (v: unknown): Json => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const SHA = /^[0-9a-f]{7,40}$/i;
const sha = (v: unknown): string | null => {
    const s = str(v);
    return s !== null && SHA.test(s) ? s.toLowerCase() : null;
};

function status(v: unknown): BugStatus {
    const s = typeof v === 'string' ? v.toLowerCase() : '';
    if (s === 'unresolved' || s === 'resolved' || s === 'ignored' || s === 'regressed') return s;
    return 'unknown';
}

/** In-app frames of one event, innermost first; a frame without a file is dropped. */
function framesOf(event: Json): BugFrame[] {
    const out: BugFrame[] = [];
    const stacks: unknown[] = [];
    for (const entry of arr(event.entries)) {
        const e = obj(entry);
        if (e.type !== 'exception') continue;
        for (const value of arr(obj(e.data).values)) stacks.push(obj(obj(value).stacktrace).frames);
    }
    for (const value of arr(obj(event.exception).values)) stacks.push(obj(obj(value).stacktrace).frames);
    for (const frames of stacks) {
        // Sentry lists the outermost frame first.
        for (const f of [...arr(frames)].reverse()) {
            const fr = obj(f);
            if (fr.inApp !== true && fr.in_app !== true) continue;
            const file = str(fr.filename ?? fr.absPath ?? fr.abs_path);
            if (file === null) continue;
            const line = typeof fr.lineNo === 'number' ? fr.lineNo : typeof fr.lineno === 'number' ? fr.lineno : null;
            out.push({ file, line, function: str(fr.function) });
            if (out.length >= MAX_FRAMES) return out;
        }
    }
    return out;
}

/**
 * Episodes from the tracker's activity: an issue opens at first seen, closes at
 * a resolution and reopens at each regression. Without activity there is one
 * episode, closed when the status says resolved.
 */
function episodesOf(issue: Json, firstSeen: string | null, st: BugStatus): BugEpisode[] {
    const details = obj(issue.statusDetails);
    const inCommit = obj(details.inCommit);
    const commit = sha(inCommit.commit ?? inCommit.id ?? details.inCommit);
    const release = str(details.inRelease);
    const acts = arr(issue.activity)
        .map(obj)
        .filter((a) => typeof a.dateCreated === 'string')
        .sort((a, b) => ((a.dateCreated as string) < (b.dateCreated as string) ? -1 : 1));
    const episodes: BugEpisode[] = [{ opened: firstSeen ?? '', closed: null, resolved_in_commit: null, resolved_in_release: null }];
    for (const a of acts) {
        const cur = episodes[episodes.length - 1] as BugEpisode;
        const type = String(a.type ?? '');
        const data = obj(a.data);
        if (type.startsWith('set_resolved') && cur.closed === null) {
            cur.closed = a.dateCreated as string;
            cur.resolved_in_commit = sha(obj(data.commit).id ?? data.commit);
            cur.resolved_in_release = str(data.version);
        } else if (type === 'set_regression' && cur.closed !== null) {
            episodes.push({ opened: a.dateCreated as string, closed: null, resolved_in_commit: null, resolved_in_release: null });
        }
    }
    const last = episodes[episodes.length - 1] as BugEpisode;
    if (st === 'resolved' && last.closed === null) last.closed = str(issue.lastSeen) ?? '';
    if (st === 'resolved' || last.closed !== null) {
        last.resolved_in_commit ??= commit;
        last.resolved_in_release ??= release;
    }
    return episodes;
}

/** One Sentry issue (API or MCP output shape) to a record; null when it has no issue id. */
export function normalizeSentryIssue(raw: unknown, org: string, fallbackProject = 'unknown'): BugRecord | null {
    const issue = obj(raw);
    const id = str(issue.id);
    if (id === null || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
    const project = str(obj(issue.project).slug ?? issue.project) ?? fallbackProject;
    const st = status(issue.status);
    const firstSeen = str(issue.firstSeen);
    const events = arr(issue.events).map(obj);
    const latest = events[events.length - 1] ?? obj(issue.latestEvent);
    const envs = new Set<string>();
    for (const t of arr(issue.tags).map(obj)) {
        if (t.key !== 'environment') continue;
        for (const v of arr(t.topValues).map(obj)) {
            const e = str(v.value);
            if (e !== null) envs.add(e);
        }
    }
    for (const ev of events) {
        const e = str(ev.environment);
        if (e !== null) envs.add(e);
    }
    const count = typeof issue.count === 'number' ? issue.count : typeof issue.count === 'string' && /^\d+$/.test(issue.count) ? Number(issue.count) : null;
    const o = sanitizeLabel(org, 80) || 'unknown';
    return {
        id: `sentry:${o}/${project}/${id}`,
        provider: 'sentry',
        org: o,
        project,
        issue: id,
        status: st,
        first_seen: firstSeen,
        last_seen: str(issue.lastSeen),
        count,
        first_release: str(obj(issue.firstRelease).version ?? issue.firstRelease),
        environments: [...envs].sort(),
        episodes: episodesOf(issue, firstSeen, st),
        frames: framesOf(latest),
        suspect_commit: sha(obj(issue.suspectCommit).id ?? issue.suspectCommit),
    };
}

/** Records plus the commit → bug index; one commit may close several issues. */
export function buildStore(bugs: BugRecord[], source: BugStore['source'], now: Date, ttlDays = DEFAULT_TTL_DAYS): BugStore {
    const fixes: Record<string, string[]> = {};
    for (const b of bugs) {
        for (const e of b.episodes) {
            if (e.resolved_in_commit === null) continue;
            const list = (fixes[e.resolved_in_commit] ??= []);
            if (!list.includes(b.id)) list.push(b.id);
        }
    }
    for (const list of Object.values(fixes)) list.sort();
    return { retrieved_at: now.toISOString(), ttl_days: ttlDays, source, bugs: [...bugs].sort((a, b) => (a.id < b.id ? -1 : 1)), fixes };
}

/** Parse a snapshot: `{provider, org, issues: [...]}`, `{org, data: [...]}` or a bare array (org from the option). */
export function parseSnapshot(text: string, opts: { org?: string } = {}): BugRecord[] {
    const doc = JSON.parse(text) as unknown;
    const root = obj(doc);
    const provider = str(root.provider) ?? 'sentry';
    if (provider !== 'sentry') throw new Error(`provider ${provider} has no mapping yet (Sentry first; others are mapping files later)`);
    const org = opts.org ?? str(root.org) ?? 'unknown';
    const list = Array.isArray(doc) ? doc : arr(root.issues ?? root.data);
    const out: BugRecord[] = [];
    for (const item of list) {
        const r = normalizeSentryIssue(item, org);
        if (r !== null) out.push(r);
    }
    return out;
}

export function bugsPath(buildDir: string): string {
    return path.join(buildDir, BUGS_DIR, BUGS_FILE);
}

/** Write the store owner-only: the directory 0700, the file 0600. */
export function writeStore(buildDir: string, store: BugStore): string {
    const dir = path.join(buildDir, BUGS_DIR);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.chmodSync(dir, 0o700);
    const file = bugsPath(buildDir);
    fs.writeFileSync(file, `${JSON.stringify(store, null, 1)}\n`, { mode: 0o600 });
    fs.chmodSync(file, 0o600);
    return file;
}

/** The store, or null when absent, unreadable or past its TTL. */
export function readStore(buildDir: string, now: Date = new Date()): BugStore | null {
    try {
        const store = JSON.parse(fs.readFileSync(bugsPath(buildDir), 'utf-8')) as BugStore;
        const age = (now.getTime() - Date.parse(store.retrieved_at)) / 86_400_000;
        return Number.isFinite(age) && age <= store.ttl_days ? store : null;
    } catch {
        return null;
    }
}

export function importSnapshot(file: string, buildDir: string, opts: { org?: string; now?: Date; ttlDays?: number } = {}): BugStore {
    const bugs = parseSnapshot(fs.readFileSync(file, 'utf-8'), opts);
    const store = buildStore(bugs, 'snapshot-import', opts.now ?? new Date(), opts.ttlDays);
    writeStore(buildDir, store);
    return store;
}

/**
 * The query-time path: the caller's fetcher runs over the user's own tracker
 * connection; this function only normalises what it returns. Nothing is
 * persisted unless `buildDir` is given.
 */
export async function fromQueryTime(fetcher: () => Promise<unknown[]>, org: string, opts: { buildDir?: string; now?: Date } = {}): Promise<BugStore> {
    const raws = await fetcher();
    const bugs = raws.map((r) => normalizeSentryIssue(r, org)).filter((r): r is BugRecord => r !== null);
    const store = buildStore(bugs, 'query-time', opts.now ?? new Date());
    if (opts.buildDir) writeStore(opts.buildDir, store);
    return store;
}
