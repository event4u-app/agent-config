#!/usr/bin/env tsx
/**
 * `agent-config roadmap:context` — the one deterministic situational-awareness
 * probe behind every `/roadmap:*` entry point.
 *
 * ## Why this exists
 *
 * The ingredients of situational awareness were already in the tree and none of
 * them reached a run. The four-command live screen was hand-written inside ONE
 * command file (`/roadmap:next` § 1) and existed for **selection** only; the
 * loop's own screen is claim-triggered — it fires when a message would
 * *describe* a roadmap as in-flight, not before the work starts; file-overlap
 * derivation lived inside the multi-roadmap set contract, which a
 * single-roadmap run never enters. This file is the extraction: one probe, one
 * report, callable from all five entry points.
 *
 * Measured on the population that motivated it: 4 of 24 active roadmaps were
 * already closed in an open PR at `33d7f74af`, and 2 of 22 six days later at
 * `f6703b78a` — the sample halved itself in a week. That decay is the argument
 * for a refresh cadence rather than a better one-shot screen, and it is why
 * every read below is live and none is cached.
 *
 * ## Honesty boundary — the probe is deterministic, the invocation is not
 *
 * ```
 * THE PROBE IS DETERMINISTIC ONCE INVOKED. THE INVOCATION IS MODEL-CARRIED.
 * NOTHING FIRES THIS SCRIPT, AND NOTHING NOTICES WHEN IT IS SKIPPED.
 * ```
 *
 * Same shape as the boundary `/roadmap:next` already states over its own
 * screen, and stated here rather than left as prose that reads like a
 * guarantee. What IS deterministic: what the probe reports once it runs.
 *
 * ## Failure posture
 *
 * Every read degrades rather than throws. No network, no `gh`, no
 * authentication → `network: "unavailable"`, an empty PR set, an explicit
 * `scanned: 0 PRs (network unavailable)` line, and exit 0. A probe that exits
 * non-zero offline would make the call site conditional, which is the one thing
 * this change is trying to remove.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { gitEnv } from './_lib/git_env.js';
import { read_live_records, register_dir } from './_lib/session_register.js';
import { other_worktree_branches_detailed } from './sessions_cli.js';

/** One open pull request, with the file set it changes. */
export interface PullRequestInfo {
    number: number;
    title: string;
    headRefName: string;
    files: string[];
}

/** A roadmap file found in one of the four roadmap directories. */
export interface RoadmapEntry {
    slug: string;
    /** Repo-relative path. */
    path: string;
    title: string;
    dir: RoadmapDir;
}

export type RoadmapDir = 'active' | 'later' | 'stubs' | 'archive';

/** A sibling roadmap whose slug or title shares keywords with the subject. */
export interface KeywordHit {
    slug: string;
    path: string;
    dir: RoadmapDir;
    matched: string[];
}

/** A remote branch whose name carries a roadmap slug. */
export interface RoadmapBranch {
    branch: string;
    slug: string;
}

/** One (roadmap, open PR) pair that touches at least one path in common. */
export interface OverlapPair {
    roadmap: string;
    pr: number;
    paths: string[];
    /** Which owned-path set the roadmap side came from. */
    source: OverlapSource;
}

/**
 * Where the roadmap's owned-path set came from.
 *
 * `pre-scan` is the set `roadmap-process-loop § 3d` already derives and is
 * authoritative. `cited-path` is the fallback heuristic and is labelled as one:
 * backticked paths in roadmap prose include examples and files the roadmap does
 * not own, so it over-reports. The conservative direction is the one the set
 * contract already states — overlap resolves toward serial — so a false pair
 * costs ordering, never a skip.
 */
export type OverlapSource = 'pre-scan' | 'cited-path';

export interface SessionsView {
    records: unknown[];
    other_worktree_branches: unknown[];
}

export interface RoadmapContext {
    generated_at: string;
    network: 'live' | 'unavailable';
    roadmap: string | null;
    scanned: {
        prs: number;
        roadmaps: number;
        remote_branches: number;
        inbox_files: number;
        sessions: number;
    };
    open_prs: PullRequestInfo[];
    roadmap_branches: RoadmapBranch[];
    sessions: SessionsView;
    /** File NAMES only — never contents. `agents/tmp/` is a private scratch area. */
    inbox_files: string[];
    hits: KeywordHit[];
    overlaps: OverlapPair[];
}

// ---------------------------------------------------------------------------
// Pure helpers — every one of these is exercised without a network.
// ---------------------------------------------------------------------------

/** Roadmap directories the probe walks, in report order. */
export const ROADMAP_DIRS: ReadonlyArray<readonly [RoadmapDir, string]> = [
    ['active', 'agents/roadmaps'],
    ['later', 'agents/roadmaps/later'],
    ['stubs', 'agents/roadmaps/stubs'],
    ['archive', 'agents/roadmaps/archive'],
];

const NON_ROADMAP_NAMES: ReadonlySet<string> = new Set([
    'template.md',
    'README.md',
    'progress.md',
    'roadmaps-progress.md',
]);

/**
 * Parse `gh pr list --json number,title,headRefName,files`.
 *
 * Tolerant on purpose: a `gh` version that omits `files`, or a PR whose file
 * list is truncated, yields an empty set for that PR rather than dropping the
 * PR. Losing the overlap signal for one PR is recoverable; losing the PR from
 * the screen is the failure this whole probe exists to prevent.
 */
export function parsePrList(raw: string): PullRequestInfo[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    const out: PullRequestInfo[] = [];
    for (const item of parsed) {
        if (item === null || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const num = rec['number'];
        if (typeof num !== 'number') continue;
        const files: string[] = [];
        const rawFiles = rec['files'];
        if (Array.isArray(rawFiles)) {
            for (const f of rawFiles) {
                if (typeof f === 'string') files.push(f);
                else if (f !== null && typeof f === 'object') {
                    const p = (f as Record<string, unknown>)['path'];
                    if (typeof p === 'string') files.push(p);
                }
            }
        }
        out.push({
            number: num,
            title: typeof rec['title'] === 'string' ? rec['title'] : '',
            headRefName: typeof rec['headRefName'] === 'string' ? rec['headRefName'] : '',
            files: files.sort(),
        });
    }
    return out.sort((a, b) => a.number - b.number);
}

/**
 * Remote branches whose name carries a roadmap slug — the "roadmap tail".
 *
 * The branch axis needs no claim to have been written: a checkout is on disk
 * from the first minute, and a peer that never claimed is invisible to every
 * other axis.
 */
export function roadmapTailBranches(
    branches: readonly string[],
    slugs: readonly string[],
): RoadmapBranch[] {
    const out: RoadmapBranch[] = [];
    for (const b of branches) {
        const ref = b.trim();
        if (ref === '' || ref.endsWith('/HEAD')) continue;
        for (const slug of slugs) {
            if (slug !== '' && ref.includes(slug)) {
                out.push({ branch: ref, slug });
                break;
            }
        }
    }
    return out;
}

const STOPWORDS: ReadonlySet<string> = new Set([
    'road',
    'to',
    'the',
    'and',
    'for',
    'of',
    'a',
    'an',
    'in',
    'on',
    'with',
    'over',
    'from',
]);

/** Keyword set for a slug: kebab segments minus stopwords and 2-char noise. */
export function slugKeywords(slug: string): string[] {
    const seen = new Set<string>();
    for (const part of slug.toLowerCase().split(/[^a-z0-9]+/)) {
        if (part.length < 3 || STOPWORDS.has(part)) continue;
        seen.add(part);
    }
    return [...seen].sort();
}

/**
 * Sibling roadmaps sharing at least `minMatches` keywords with the subject.
 *
 * This is the axis `/roadmap:create`'s collision check does NOT cover: that
 * check is a recursive `find -iname`, so it already sees `later/`, `stubs/` and
 * `archive/` — lexically. Same topic under a different name passes it.
 */
export function keywordHits(
    entries: readonly RoadmapEntry[],
    keywords: readonly string[],
    subjectSlug: string,
    minMatches = 2,
): KeywordHit[] {
    if (keywords.length === 0) return [];
    const out: KeywordHit[] = [];
    for (const e of entries) {
        if (e.slug === subjectSlug) continue;
        const hay = `${e.slug} ${e.title}`.toLowerCase();
        const matched = keywords.filter((k) => hay.includes(k));
        if (matched.length >= minMatches) {
            out.push({ slug: e.slug, path: e.path, dir: e.dir, matched });
        }
    }
    return out.sort((a, b) => b.matched.length - a.matched.length || a.slug.localeCompare(b.slug));
}

const CITED_PATH_RE = /`([A-Za-z0-9_][A-Za-z0-9_./-]*\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)`/g;

/**
 * Paths a roadmap cites in backticks — the FALLBACK owned-path set.
 *
 * Deliberately labelled everywhere it is used: backticked paths include
 * examples, evidence pointers and files the roadmap merely reads. It
 * over-reports, and over-reporting resolves toward serial execution, which is
 * the direction the set contract already declares safe.
 */
export function citedPaths(text: string): string[] {
    const out = new Set<string>();
    CITED_PATH_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CITED_PATH_RE.exec(text)) !== null) {
        const p = m[1]!;
        if (p.includes('..')) continue;
        out.add(p);
    }
    return [...out].sort();
}

/**
 * `(roadmap, open PR)` pairs with a non-empty file intersection.
 *
 * Pure over two maps so the assertion in the test suite pins a committed
 * fixture and never a live PR number — the property D1b showed to be
 * essential, since the live population halved inside six days.
 */
export function computeOverlaps(
    owned: ReadonlyMap<string, { paths: readonly string[]; source: OverlapSource }>,
    prs: readonly PullRequestInfo[],
): OverlapPair[] {
    const out: OverlapPair[] = [];
    for (const [roadmap, set] of [...owned.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const mine = new Set(set.paths);
        if (mine.size === 0) continue;
        for (const pr of prs) {
            const shared = pr.files.filter((f) => mine.has(f)).sort();
            if (shared.length > 0) {
                out.push({ roadmap, pr: pr.number, paths: shared, source: set.source });
            }
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// I/O — injected so every test above runs offline.
// ---------------------------------------------------------------------------

export interface ExecResult {
    code: number;
    stdout: string;
}

export type Exec = (cmd: string, args: readonly string[]) => ExecResult;

export const realExec: Exec = (cmd, args) => {
    try {
        const stdout = execFileSync(cmd, [...args], {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            env: gitEnv(),
            timeout: 30_000,
            maxBuffer: 32 * 1024 * 1024,
        });
        return { code: 0, stdout };
    } catch (exc) {
        const e = exc as { status?: number; stdout?: string | Buffer };
        return { code: typeof e.status === 'number' ? e.status : 1, stdout: String(e.stdout ?? '') };
    }
};

function readTitle(text: string, slug: string): string {
    const m = /^#[ \t]+(.+)$/m.exec(text);
    return m ? m[1]!.trim() : slug;
}

/** Enumerate the four roadmap directories. Non-recursive per directory. */
export function enumerateRoadmaps(repoRoot: string): RoadmapEntry[] {
    const out: RoadmapEntry[] = [];
    for (const [dir, rel] of ROADMAP_DIRS) {
        const abs = path.join(repoRoot, rel);
        let names: string[];
        try {
            names = fs.readdirSync(abs);
        } catch {
            continue;
        }
        for (const name of names.sort()) {
            if (!name.endsWith('.md') || NON_ROADMAP_NAMES.has(name)) continue;
            const full = path.join(abs, name);
            try {
                if (!fs.statSync(full).isFile()) continue;
            } catch {
                continue;
            }
            const slug = name.slice(0, -3);
            let text = '';
            try {
                text = fs.readFileSync(full, 'utf-8');
            } catch {
                /* unreadable file still counts as present */
            }
            out.push({ slug, path: path.posix.join(rel, name), title: readTitle(text, slug), dir });
        }
    }
    return out;
}

/** `agents/tmp/` file NAMES. Never contents — the directory is private scratch. */
export function inboxNames(repoRoot: string): string[] {
    try {
        return fs
            .readdirSync(path.join(repoRoot, 'agents/tmp'), { withFileTypes: true })
            .filter((d) => d.isFile() && !d.name.startsWith('.'))
            .map((d) => d.name)
            .sort();
    } catch {
        return [];
    }
}

export interface ProbeOptions {
    repoRoot: string;
    roadmap?: string | null;
    exec?: Exec;
    /** Pre-scan owned-path sets, slug → paths. Authoritative where present. */
    ownedPaths?: ReadonlyMap<string, readonly string[]>;
    now?: Date;
}

/** Run the probe. Never throws; degrades to `network: "unavailable"`. */
export function probe(opts: ProbeOptions): RoadmapContext {
    const exec = opts.exec ?? realExec;
    const root = opts.repoRoot;
    const subject = opts.roadmap ?? null;

    // A pruning fetch first: every read below is only as live as the refs.
    const fetched = exec('git', ['-C', root, 'fetch', 'origin', '--prune']);

    const prRun = exec('gh', [
        'pr',
        'list',
        '--state',
        'open',
        '--limit',
        '100',
        '--json',
        'number,title,headRefName,files',
    ]);
    const online = prRun.code === 0 && fetched.code === 0;
    const open_prs = prRun.code === 0 ? parsePrList(prRun.stdout) : [];

    const roadmaps = enumerateRoadmaps(root);
    const activeSlugs = roadmaps.filter((r) => r.dir === 'active').map((r) => r.slug);

    const branchRun = exec('git', [
        '-C',
        root,
        'for-each-ref',
        '--format=%(refname:short)',
        'refs/remotes/origin',
    ]);
    const branches = branchRun.stdout.split('\n').filter((l) => l.trim() !== '');
    const roadmap_branches = roadmapTailBranches(branches, activeSlugs);

    const sessions = readSessions(root);

    const inbox_files = inboxNames(root);

    const hits =
        subject === null ? [] : keywordHits(roadmaps, slugKeywords(subject), subject);

    const owned = new Map<string, { paths: readonly string[]; source: OverlapSource }>();
    const subjects = subject === null ? roadmaps.filter((r) => r.dir === 'active') : roadmaps.filter((r) => r.slug === subject);
    for (const r of subjects) {
        const pre = opts.ownedPaths?.get(r.slug);
        if (pre !== undefined && pre.length > 0) {
            owned.set(r.slug, { paths: pre, source: 'pre-scan' });
            continue;
        }
        let text = '';
        try {
            text = fs.readFileSync(path.join(root, r.path), 'utf-8');
        } catch {
            continue;
        }
        owned.set(r.slug, { paths: citedPaths(text), source: 'cited-path' });
    }
    const overlaps = computeOverlaps(owned, open_prs);

    return {
        generated_at: (opts.now ?? new Date()).toISOString(),
        network: online ? 'live' : 'unavailable',
        roadmap: subject,
        scanned: {
            prs: open_prs.length,
            roadmaps: roadmaps.length,
            remote_branches: branches.length,
            inbox_files: inbox_files.length,
            sessions: sessions.records.length,
        },
        open_prs,
        roadmap_branches,
        sessions,
        inbox_files,
        hits,
        overlaps,
    };
}

/**
 * The session register, read through the same library `sessions:list` uses.
 *
 * Both axes, because the register alone reports the half that can be silent: a
 * peer that never claimed is visible only as a branch checked out in another
 * worktree.
 */
function readSessions(root: string): SessionsView {
    let records: unknown[] = [];
    let other: unknown[] = [];
    try {
        const dir = register_dir(root);
        records = dir === null ? [] : read_live_records(dir, { prune: false });
    } catch {
        /* no register is the normal pre-first-session state, never an error */
    }
    try {
        other = other_worktree_branches_detailed(root).rows;
    } catch {
        /* a git failure costs the branch axis, not the whole report */
    }
    return { records, other_worktree_branches: other };
}

/** The human report. One compact block — a refresh runs at every phase boundary. */
export function renderText(ctx: RoadmapContext): string {
    const L: string[] = [];
    L.push(`roadmap:context — ${ctx.generated_at}${ctx.roadmap ? `  ·  subject: ${ctx.roadmap}` : ''}`);
    L.push('');
    if (ctx.network === 'unavailable') {
        L.push('scanned: 0 PRs (network unavailable)');
    } else {
        L.push(`scanned: ${ctx.scanned.prs} PRs`);
    }
    L.push(`scanned: ${ctx.scanned.roadmaps} roadmap file(s) across active/later/stubs/archive`);
    L.push(`scanned: ${ctx.scanned.remote_branches} remote branch(es)`);
    L.push(`scanned: ${ctx.scanned.sessions} live session record(s)`);
    L.push(`scanned: ${ctx.scanned.inbox_files} inbox file name(s) in agents/tmp/`);
    L.push('');
    L.push('open PRs:');
    if (ctx.open_prs.length === 0) L.push('  (none)');
    for (const pr of ctx.open_prs) {
        L.push(`  #${pr.number}  ${pr.title}`);
        L.push(`      head: ${pr.headRefName}  ·  ${pr.files.length} changed file(s)`);
    }
    L.push('');
    L.push('remote branches carrying a roadmap slug:');
    if (ctx.roadmap_branches.length === 0) L.push('  (none)');
    for (const b of ctx.roadmap_branches) L.push(`  ${b.branch}  →  ${b.slug}`);
    L.push('');
    L.push('roadmap ↔ open-PR file overlap:');
    if (ctx.overlaps.length === 0) L.push('  (none)');
    for (const o of ctx.overlaps) {
        L.push(`  ${o.roadmap}  ×  #${o.pr}  [${o.source}]  ${o.paths.length} path(s)`);
        for (const p of o.paths.slice(0, 5)) L.push(`      ${p}`);
    }
    L.push('');
    L.push('sibling roadmaps on the same topic (slug/title keywords):');
    if (ctx.hits.length === 0) L.push('  (none)');
    for (const h of ctx.hits) L.push(`  ${h.dir.padEnd(7)} ${h.slug}  [${h.matched.join(' ')}]`);
    L.push('');
    L.push('inbox notes (names only, never contents):');
    if (ctx.inbox_files.length === 0) L.push('  (none)');
    for (const n of ctx.inbox_files) L.push(`  agents/tmp/${n}`);
    L.push('');
    L.push('This probe is deterministic once invoked; the invocation is model-carried.');
    return `${L.join('\n')}\n`;
}

function readOwnedPathsFile(p: string): Map<string, string[]> {
    const out = new Map<string, string[]>();
    try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
        for (const [slug, v] of Object.entries(parsed)) {
            if (Array.isArray(v)) out.set(slug, v.filter((x): x is string => typeof x === 'string'));
        }
    } catch {
        /* an unreadable pre-scan file falls back to the cited-path heuristic */
    }
    return out;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(
            'usage: agent-config roadmap:context [--roadmap <slug>] [--owned-paths <file.json>] [--json]\n',
        );
        return 0;
    }
    const at = (flag: string): string | null => {
        const i = argv.indexOf(flag);
        return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1]! : null;
    };
    const root = at('--root') ?? process.cwd();
    const ownedFile = at('--owned-paths');
    const ctx = probe({
        repoRoot: root,
        roadmap: at('--roadmap'),
        ...(ownedFile !== null ? { ownedPaths: readOwnedPathsFile(ownedFile) } : {}),
    });
    process.stdout.write(
        argv.includes('--json') ? `${JSON.stringify(ctx, null, 2)}\n` : renderText(ctx),
    );
    return 0;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see sessions_cli.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main());
}
