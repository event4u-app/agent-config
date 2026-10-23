/**
 * Seeded citation-audit tasks for the worker-resume bench
 * (road-to-a-cold-start-paid-once 6.2, manufactured window per owner O6).
 *
 * Each task asks a worker for the text of one `path:line` a roadmap cites. The
 * expected answer is read from the tree, so scoring needs no judge, and every
 * citation that no longer resolves is a useful byproduct: a stale citation.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const ROADMAPS = [
    'road-to-a-cold-start-paid-once',
    'road-to-a-tier-the-dispatch-carries',
    'road-to-free-hands-a-paid-head-checks',
    'road-to-one-detector-and-the-senders-we-own',
] as const;

export interface Citation {
    path: string;
    line: number;
}

export interface CitationTask extends Citation {
    id: string;
    expected: string;
}

export interface StaleCitation extends Citation {
    roadmap: string;
    /** `ambiguous_basename`: a bare name that matches several tracked files — unresolvable, not proven stale. */
    reason: 'missing_file' | 'file_shorter_than_line' | 'ambiguous_basename';
    /** The tracked path the citation resolved to, when it was not repo-relative. */
    resolved?: string;
    /** Line count when the file exists. */
    lines?: number;
}

const CITATION = /`([A-Za-z0-9_.\/-]+\.[A-Za-z0-9]+):(\d+)(?:-\d+)?`/g;

export function extractCitations(text: string): Citation[] {
    return [...text.matchAll(CITATION)].map((m) => ({ path: m[1]!, line: Number(m[2]) }));
}

export interface Pool {
    tasks: CitationTask[];
    stale: StaleCitation[];
    /** Citations that resolve to an empty line: not a task, not stale. */
    blank: Citation[];
}

/** Generated projections hold copies of `src/`; a citation resolves to the source. */
const PROJECTION = /^(dist|\.augment|\.claude|\.cursor|\.clinerules|\.agent-src\.uncondensed)\//;

/**
 * A citation path as the tree knows it: repo-relative if that exists, else the
 * unique tracked, non-projection file it is a path suffix of.
 */
export function resolveCitationPath(repo: string, cited: string, tracked: readonly string[]): { path: string } | { reason: 'missing_file' | 'ambiguous_basename' } {
    if (fs.existsSync(path.join(repo, cited)) && fs.statSync(path.join(repo, cited)).isFile()) return { path: cited };
    const hits = tracked.filter((t) => !PROJECTION.test(t) && (t === cited || t.endsWith(`/${cited}`)));
    if (hits.length === 1) return { path: hits[0]! };
    return { reason: hits.length === 0 ? 'missing_file' : 'ambiguous_basename' };
}

function trackedFiles(repo: string): string[] {
    try {
        return execFileSync('git', ['-C', repo, 'ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

export function buildPool(repo: string, roadmapsDir: string = path.join(repo, 'agents', 'roadmaps')): Pool {
    const tracked = trackedFiles(repo);
    const tasks = new Map<string, CitationTask>();
    const stale: StaleCitation[] = [];
    const blank: Citation[] = [];
    for (const name of ROADMAPS) {
        const file = path.join(roadmapsDir, `${name}.md`);
        if (!fs.existsSync(file)) continue;
        for (const c of extractCitations(fs.readFileSync(file, 'utf8'))) {
            const r = resolveCitationPath(repo, c.path, tracked);
            if ('reason' in r) {
                stale.push({ ...c, roadmap: name, reason: r.reason });
                continue;
            }
            const resolved = r.path === c.path ? {} : { resolved: r.path };
            const lines = fs.readFileSync(path.join(repo, r.path), 'utf8').split('\n');
            if (lines.length < c.line) {
                stale.push({ ...c, ...resolved, roadmap: name, reason: 'file_shorter_than_line', lines: lines.length });
                continue;
            }
            const id = `${r.path}:${c.line}`;
            const expected = lines[c.line - 1]!.trim();
            if (expected === '') blank.push({ path: r.path, line: c.line });
            else tasks.set(id, { id, path: r.path, line: c.line, expected });
        }
    }
    return { tasks: [...tasks.values()].sort((a, b) => (a.id < b.id ? -1 : 1)), stale, blank };
}

/** mulberry32 — a fixed, dependency-free PRNG so a seed names one task list. */
function prng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function sampleTasks(pool: readonly CitationTask[], seed: number, n: number): CitationTask[] {
    const rnd = prng(seed);
    const copy = [...pool];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy.slice(0, n);
}

export function taskPrompt(repo: string, t: Citation): string {
    return `Read ${path.join(repo, t.path)} line ${t.line}; reply with that line's text only — no quotes, no citation, no other words.`;
}
