#!/usr/bin/env tsx
/**
 * Deterministic core of the /worktree cleanup + verify gates
 * (road-to-fable-feedback-5 Phase 5; extracted from the prose in
 * src/domains/engineering-base/worktree/cleanup/command.md so the refusal
 * semantics are testable — the command doc calls this instead of ad-hoc
 * shell).
 *
 * Modes:
 *   check <worktree-path>   Cleanup gates for ONE worktree, in order:
 *                             1. detached HEAD            → refuse
 *                             2. dirty (incl. untracked)  → refuse
 *                             3. commits unique to branch → refuse
 *                           Refusal is the SUCCESS path of the safety gate;
 *                           this tool never removes anything.
 *   scope-overlap           Scan every worktree's .worktree-scope.md and
 *                           report pairwise `owns:` overlaps (the hazard
 *                           /worktree status + verify must surface).
 *   inventory               Classify EVERY worktree safe / review / live and
 *                           report the counts, the review reasons, and a
 *                           prepared removal plan for the safe set. Reports
 *                           only.
 *   apply                   Remove the safe set: `git worktree remove` without
 *                           `--force`, then `git worktree prune`, one journal
 *                           line per removal. `safe` here is the scoped set the
 *                           owner made housekeeping on 2026-10-21
 *                           (road-to-worktrees-that-leave-after-the-merge D1):
 *                           proven merged, clean, no local-only ignored file,
 *                           not live. Every other removal stays a decision.
 *                           Branches are never deleted by this tool.
 *   register <path>         Record a worktree this package created, so a
 *                           sibling outside the standard roots is eligible.
 *
 * Reachability counts ALL other refs — local branches, remotes, AND tags
 * (a branch whose only other ref is a tag is still reachable elsewhere).
 * Exit codes: 0 = allowed / no overlap / inventory reported, 1 = refused /
 * overlap found, 2 = usage error, 3 = internal error.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load_agent_settings, settings_layer_states } from './_lib/agent_settings.js';
import { read_live_records, register_dir } from './_lib/session_register.js';

export interface CheckResult {
    allowed: boolean;
    reasons: string[];
}

export interface ScopeOverlap {
    a: { worktree: string; own: string };
    b: { worktree: string; own: string };
}

/**
 * An absolute deadline for every git and gh subprocess while a budgeted pass
 * runs. A budget checked only between candidates is not a budget: one slow
 * `git status` would run past it. With a deadline set, each call gets only the
 * time left, and a call that would start after it throws — so the pass fails
 * closed instead of finishing late.
 */
let subprocessDeadline: number | null = null;

export function withDeadline<T>(deadlineAt: number, fn: () => T): T {
    const prev = subprocessDeadline;
    subprocessDeadline = deadlineAt;
    try {
        return fn();
    } finally {
        subprocessDeadline = prev;
    }
}

function timeLeftMs(): number | undefined {
    if (subprocessDeadline === null) return undefined;
    const left = subprocessDeadline - Date.now();
    if (left <= 0) throw new Error('budget spent');
    return left;
}

function git(cwd: string, args: string[], input?: string): string {
    const timeout = timeLeftMs();
    return execFileSync('git', ['-C', cwd, ...args], {
        encoding: 'utf-8',
        stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        ...(input === undefined ? {} : { input }),
        ...(timeout === undefined ? {} : { timeout }),
        // No git call made here may refresh an index: the inventory reads index
        // mtimes as a liveness fallback, so a refresh would fake activity.
        env: gitEnv(),
    });
}

function tryGit(cwd: string, args: string[], input?: string): string | null {
    try {
        return git(cwd, args, input);
    } catch {
        return null;
    }
}

/**
 * The caller's environment minus the variables that redirect `git -C`: a hook
 * process inherits `GIT_DIR` / `GIT_WORK_TREE` / `GIT_INDEX_FILE`, and with any
 * of them set every per-worktree call would read the wrong repository.
 */
function gitEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
    delete env.GIT_DIR;
    delete env.GIT_WORK_TREE;
    delete env.GIT_INDEX_FILE;
    return env;
}

/**
 * `git status` with the index left alone. Plain `git status` refreshes the
 * on-disk index, which bumps its mtime — and the inventory mode reads that
 * mtime as the "another session is working here" signal. Without
 * `--no-optional-locks` the check corrupts the very signal it is measured
 * against: two consecutive inventory runs moved 10 worktrees from safe to live.
 */
function statusPorcelain(cwd: string): string {
    return git(cwd, ['--no-optional-locks', 'status', '--porcelain']);
}

/** Refs (heads + remotes + tags) EXCLUDING the given branch's own head ref. */
function otherRefs(cwd: string, branch: string): string[] {
    const out = git(cwd, ['for-each-ref', '--format=%(refname)']);
    return out
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && l !== `refs/heads/${branch}`);
}

export function checkWorktree(worktreePath: string): CheckResult {
    const reasons: string[] = [];
    if (!fs.existsSync(worktreePath)) {
        return { allowed: false, reasons: [`worktree path does not exist: ${worktreePath}`] };
    }

    const headRef = tryGit(worktreePath, ['symbolic-ref', '-q', 'HEAD']);
    if (headRef === null) {
        reasons.push(
            'detached HEAD — no branch to judge reachability for; resolve the state manually before cleanup',
        );
        return { allowed: false, reasons };
    }
    const branch = headRef.trim().replace(/^refs\/heads\//, '');

    const status = statusPorcelain(worktreePath);
    if (status.trim().length > 0) {
        const files = status
            .trimEnd()
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n');
        reasons.push(`unsaved work (dirty or untracked files count as work):\n${files}`);
    }

    const others = otherRefs(worktreePath, branch);
    const revListArgs = ['rev-list', '--oneline', branch, '--not', ...others];
    const unique = git(worktreePath, revListArgs).trimEnd();
    if (unique.length > 0) {
        const commits = unique
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n');
        reasons.push(
            `commits on '${branch}' reachable from NO other ref (branch, remote, or tag):\n${commits}`,
        );
    }

    return { allowed: reasons.length === 0, reasons };
}

export interface WorktreeEntry {
    path: string;
    /** Short branch name (`refs/heads/` stripped), or `null` when detached. */
    branch: string | null;
}

export function listWorktrees(repoPath: string): WorktreeEntry[] {
    const out = git(repoPath, ['worktree', 'list', '--porcelain']);
    const entries: WorktreeEntry[] = [];
    let current: Partial<WorktreeEntry> = {};
    for (const line of out.split('\n')) {
        if (line.startsWith('worktree ')) {
            if (current.path !== undefined) {
                entries.push({ path: current.path, branch: current.branch ?? null });
            }
            current = { path: line.slice('worktree '.length) };
        } else if (line.startsWith('branch ')) {
            current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
        } else if (line === 'detached') {
            current.branch = null;
        }
    }
    if (current.path !== undefined) {
        entries.push({ path: current.path, branch: current.branch ?? null });
    }
    return entries;
}

/** Non-glob prefix of an `owns:` entry (`src/middleware/**` → `src/middleware/`). */
function globPrefix(own: string): string {
    const starIdx = own.indexOf('*');
    const prefix = starIdx === -1 ? own : own.slice(0, starIdx);
    return prefix.replace(/\/+$/, '') + '/';
}

/** Two owns entries overlap when one's non-glob prefix contains the other's. */
export function ownsOverlap(a: string, b: string): boolean {
    const pa = globPrefix(a);
    const pb = globPrefix(b);
    return pa.startsWith(pb) || pb.startsWith(pa);
}

function readOwns(worktreePath: string): string[] {
    const p = path.join(worktreePath, '.worktree-scope.md');
    if (!fs.existsSync(p)) return [];
    const text = fs.readFileSync(p, 'utf-8');
    // owns: entries are a YAML list under an `owns:` key (see
    // worktree-lifecycle § Scope lock). Tolerant line parser — the scope
    // note is hand-written, often inside a fenced block.
    const owns: string[] = [];
    let inOwns = false;
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (/^-?\s*owns:\s*$/.test(line)) {
            inOwns = true;
            continue;
        }
        if (inOwns) {
            const m = line.match(/^-\s+(.+)$/);
            if (m) {
                owns.push(m[1]!.trim());
            } else if (line.length > 0 && !line.startsWith('#')) {
                inOwns = false;
            }
        }
    }
    return owns;
}

export function findScopeOverlaps(repoPath: string): ScopeOverlap[] {
    const entries = listWorktrees(repoPath).filter((e) => fs.existsSync(e.path));
    const scoped = entries
        .map((e) => ({ worktree: e.path, owns: readOwns(e.path) }))
        .filter((e) => e.owns.length > 0);
    const overlaps: ScopeOverlap[] = [];
    for (let i = 0; i < scoped.length; i++) {
        for (let j = i + 1; j < scoped.length; j++) {
            for (const a of scoped[i]!.owns) {
                for (const b of scoped[j]!.owns) {
                    if (ownsOverlap(a, b)) {
                        overlaps.push({
                            a: { worktree: scoped[i]!.worktree, own: a },
                            b: { worktree: scoped[j]!.worktree, own: b },
                        });
                    }
                }
            }
        }
    }
    return overlaps;
}

/**
 * A worktree is "live" when another session may be working in it. Git touches
 * the per-worktree index on almost every command, so its mtime is the cheapest
 * available activity signal.
 */
export const LIVE_WINDOW_HOURS = 48;

/**
 * The two conventional worktree roots, relative to the repo. Anything else is
 * a non-standard location: it is not wrong, but it is excluded from the safe
 * set on purpose — worktrees that sit beside the repo can be mistaken for
 * sibling packages, so their removal is a judgement the maintainer makes.
 */
export const STANDARD_WORKTREE_DIRS = ['.claude/worktrees', '.worktrees'] as const;

/**
 * Symlink-resolved absolute path, falling back to a plain resolve when the
 * path is gone. Git reports worktree paths as realpaths, so a repo reached
 * through a symlinked parent (`/tmp` → `/private/tmp` on macOS, or any
 * symlinked checkout root) would otherwise fail every path comparison and
 * mis-report conventional worktrees as non-standard.
 */
function canonical(p: string): string {
    const abs = path.resolve(p);
    const tail: string[] = [];
    let head = abs;
    for (;;) {
        try {
            // Resolve the longest existing ancestor, then re-append the rest —
            // a registration pointing at an already-deleted directory still has
            // to classify its location correctly.
            const real = fs.realpathSync(head);
            return tail.length === 0 ? real : path.join(real, ...tail);
        } catch {
            const parent = path.dirname(head);
            if (parent === head) return abs;
            tail.unshift(path.basename(head));
            head = parent;
        }
    }
}

export type Classification = 'safe' | 'review' | 'live';

export interface InventoryRow {
    path: string;
    branch: string | null;
    classification: Classification;
    /** Why it is not safe. Empty exactly when `classification === 'safe'`. */
    reasons: string[];
    /** The branch is an ancestor of the trunk, so `git branch -d` is safe. */
    mergedIntoTrunk: boolean;
    /** Strongest available proof the branch's work is on the trunk, or `null`. */
    mergeEvidence: MergeEvidence | null;
    /** Branch tip at inventory time — what a removal journals. */
    tip: string | null;
    standardLocation: boolean;
    /** A registration this package wrote names this worktree. */
    registered: boolean;
    /** Main worktree — never removable, and never counted as residue. */
    isMain: boolean;
}

export interface Inventory {
    trunk: string;
    rows: InventoryRow[];
    /** What classified these rows — reused to re-check a row right before removal. */
    context: ClassifyContext;
    counts: {
        total: number;
        safe: number;
        review: number;
        live: number;
        /** Review rows grouped by reason, highest first. */
        reviewReasons: Record<string, number>;
    };
}

/** First existing trunk ref, preferring the remote (the merge authority). */
export function resolveTrunk(repoPath: string): string {
    for (const ref of [
        'refs/remotes/origin/main',
        'refs/remotes/origin/master',
        'refs/heads/main',
        'refs/heads/master',
    ]) {
        if (tryGit(repoPath, ['rev-parse', '--verify', '--quiet', ref]) !== null) return ref;
    }
    return 'HEAD';
}

function isAncestor(repoPath: string, branch: string, trunk: string): boolean {
    try {
        git(repoPath, ['merge-base', '--is-ancestor', branch, trunk]);
        return true;
    } catch {
        return false;
    }
}

/**
 * How a branch's work is known to be on the trunk, strongest first.
 *
 * `merged-ancestor` is the graph proof. It never holds for a squash merge,
 * which is how most PRs on a squash-merging trunk land — so on its own it
 * classed every one of them as unmerged work forever. `merged-pr` is the forge
 * proof: the host reports the branch's PR MERGED **and** the branch tip still
 * equals that PR's head, so no commit was made after the merge. `merged-
 * equivalent` is the offline proof, used only when the forge cannot be read:
 * merging the branch into the trunk produces the trunk's own tree, so nothing
 * on the branch is missing from it. `closed-unmerged` is never removed.
 */
export type MergeEvidence = 'merged-ancestor' | 'merged-pr' | 'merged-equivalent' | 'closed-unmerged';

export interface PrRecord {
    state: 'MERGED' | 'CLOSED' | 'OPEN';
    headOid: string;
    mergedAt: string | null;
}

/** PR records keyed by head branch name. `null` means the forge was not read. */
export type PrIndex = Map<string, PrRecord[]>;

export type GhRunner = (args: string[], timeoutMs: number) => string;

const defaultGh =
    (cwd: string): GhRunner =>
    (args, timeoutMs) =>
        execFileSync('gh', args, {
            cwd,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: timeoutMs,
            env: gitEnv(),
        });

/**
 * ONE forge read for the whole estate. The retro reads PR state per PR, which
 * scales with the number of worktrees; an estate of dozens needs one list call.
 * Any failure — no `gh`, no login, no network, a timeout — returns `null`, and
 * the caller falls back to the offline proof rather than guessing.
 */
export function readPrIndex(repoPath: string, opts: { run?: GhRunner; timeoutMs?: number } = {}): PrIndex | null {
    const run = opts.run ?? defaultGh(repoPath);
    try {
        const raw = run(
            ['pr', 'list', '--state', 'all', '--limit', '1000', '--json', 'headRefName,headRefOid,state,mergedAt'],
            Math.min(opts.timeoutMs ?? 5000, timeLeftMs() ?? Number.POSITIVE_INFINITY),
        );
        const rows = JSON.parse(raw) as Array<{
            headRefName?: string;
            headRefOid?: string;
            state?: string;
            mergedAt?: string | null;
        }>;
        if (!Array.isArray(rows)) return null;
        const index: PrIndex = new Map();
        for (const r of rows) {
            if (typeof r.headRefName !== 'string' || typeof r.headRefOid !== 'string') continue;
            if (r.state !== 'MERGED' && r.state !== 'CLOSED' && r.state !== 'OPEN') continue;
            const list = index.get(r.headRefName) ?? [];
            list.push({ state: r.state, headOid: r.headRefOid, mergedAt: r.mergedAt ?? null });
            index.set(r.headRefName, list);
        }
        return index;
    } catch {
        return null;
    }
}

function branchTip(repoPath: string, branch: string): string | null {
    const out = tryGit(repoPath, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
    return out === null ? null : out.trim();
}

/** Merging `branch` into `trunk` yields the trunk's own tree. */
function mergeEquivalent(repoPath: string, branch: string, trunk: string): boolean {
    const merged = tryGit(repoPath, ['merge-tree', '--write-tree', trunk, branch]);
    const trunkTree = tryGit(repoPath, ['rev-parse', `${trunk}^{tree}`]);
    if (merged === null || trunkTree === null) return false;
    return merged.split('\n')[0]!.trim() === trunkTree.trim();
}

export interface MergeVerdict {
    evidence: MergeEvidence | null;
    /** When the forge recorded the merge; `null` for the graph and offline proofs. */
    mergedAt: string | null;
}

export function mergeEvidence(
    repoPath: string,
    branch: string,
    trunk: string,
    prIndex: PrIndex | null,
): MergeVerdict {
    if (isAncestor(repoPath, branch, trunk)) return { evidence: 'merged-ancestor', mergedAt: null };
    if (prIndex !== null) {
        const tip = branchTip(repoPath, branch);
        const prs = prIndex.get(branch) ?? [];
        const merged = prs.find((p) => p.state === 'MERGED' && p.headOid === tip);
        if (merged !== undefined) return { evidence: 'merged-pr', mergedAt: merged.mergedAt };
        if (prs.length > 0 && prs.every((p) => p.state === 'CLOSED')) {
            return { evidence: 'closed-unmerged', mergedAt: null };
        }
        return { evidence: null, mergedAt: null };
    }
    if (mergeEquivalent(repoPath, branch, trunk)) return { evidence: 'merged-equivalent', mergedAt: null };
    return { evidence: null, mergedAt: null };
}

/**
 * Ignored paths that rebuild themselves. `git worktree remove` without
 * `--force` refuses a dirty tree but deletes ignored files without a word
 * (reproduced 2026-10-21), so a local `.env` would vanish with a merged tree.
 * A pattern counts as regenerable when it is one of these well-known build and
 * dependency outputs, or when the `.gitignore` comment block directly above the
 * matching pattern says the path is generated.
 */
export const REGENERABLE_IGNORED = [
    // Built in only where a path is never hand-edited: dependency trees the
    // package manager rebuilds from the lockfile, interpreter and tool caches,
    // and OS litter. `dist/`, `build/`, `vendor/`, `.venv/` are deliberately NOT
    // here — each can hold a patched dependency or an artefact someone kept
    // (council 2026-10-21, both seats). A repository that knows they are
    // generated says so in its own `.gitignore` comment, which this module reads.
    'node_modules',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    '.ruff_cache',
    '.parcel-cache',
    '.turbo',
    '.cache',
    '.DS_Store',
] as const;

const GENERATED_COMMENT = /generat|build output|rebuilt by|projection|byproduct/i;

function isRegenerablePattern(pattern: string): boolean {
    const bare = pattern.replace(/^!/, '').replace(/^\/+/, '').replace(/\/+$/, '');
    const last = bare.split('/').pop() ?? bare;
    return (REGENERABLE_IGNORED as readonly string[]).includes(last) || /\.tsbuildinfo$|\.pyc$/.test(bare);
}

/** True when the comment block directly above `line` (1-based) reads as "generated". */
function commentSaysGenerated(lines: string[], line: number): boolean {
    for (let i = line - 2; i >= 0; i--) {
        const l = lines[i]!.trim();
        if (l === '') return false;
        if (l.startsWith('#')) {
            if (GENERATED_COMMENT.test(l)) return true;
            continue;
        }
        // Another pattern line in the same block: keep walking up to its comment.
    }
    return false;
}

/**
 * Ignored paths in `worktreePath` that are NOT regenerable. Empty means losing
 * every ignored file with the tree costs nothing a rebuild would not restore.
 */
export function localOnlyIgnored(worktreePath: string): string[] {
    const status = tryGit(worktreePath, ['status', '--ignored', '--porcelain']);
    if (status === null) return ['(ignored files could not be listed)'];
    const ignored = status
        .split('\n')
        .filter((l) => l.startsWith('!! '))
        .map((l) => l.slice(3));
    if (ignored.length === 0) return [];
    const verbose = tryGit(worktreePath, ['check-ignore', '-v', '--no-index', '--stdin'], ignored.join('\n'));
    const sourceOf = new Map<string, { file: string; line: number; pattern: string }>();
    for (const row of (verbose ?? '').split('\n')) {
        const m = /^(.*?):(\d+):(.*)\t(.+)$/.exec(row);
        if (m) sourceOf.set(m[4]!, { file: m[1]!, line: Number(m[2]), pattern: m[3]! });
    }
    const fileCache = new Map<string, string[]>();
    const readLines = (file: string): string[] => {
        const abs = path.isAbsolute(file) ? file : path.join(worktreePath, file);
        if (!fileCache.has(abs)) {
            try {
                fileCache.set(abs, fs.readFileSync(abs, 'utf-8').split('\n'));
            } catch {
                fileCache.set(abs, []);
            }
        }
        return fileCache.get(abs)!;
    };
    return ignored.filter((p) => {
        const src = sourceOf.get(p);
        if (src === undefined) return true;
        if (isRegenerablePattern(src.pattern)) return false;
        return !commentSaysGenerated(readLines(src.file), src.line);
    });
}

/** One line per worktree this package created, in the repository's common git dir. */
export const REGISTRY_FILE = 'agent-config-worktrees.jsonl';
/** One line per worktree this tool removed — the tip SHA recreates the branch. */
export const REMOVAL_JOURNAL = 'agent-config-worktree-removals.jsonl';

function commonDir(repoPath: string): string | null {
    const out = tryGit(repoPath, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
    return out === null ? null : out.trim();
}

export interface RegistryEntry {
    path: string;
    branch: string | null;
    created_by: 'agent-config';
    purpose: string;
    at: string;
}

export function registerWorktree(repoPath: string, worktreePath: string, purpose: string, now = new Date()): RegistryEntry {
    const dir = commonDir(repoPath);
    if (dir === null) throw new Error(`not a git repository: ${repoPath}`);
    const headRef = tryGit(worktreePath, ['symbolic-ref', '-q', '--short', 'HEAD']);
    const entry: RegistryEntry = {
        path: canonical(worktreePath),
        branch: headRef === null ? null : headRef.trim(),
        created_by: 'agent-config',
        purpose,
        at: now.toISOString(),
    };
    fs.appendFileSync(path.join(dir, REGISTRY_FILE), `${JSON.stringify(entry)}\n`);
    return entry;
}

export function readRegistry(repoPath: string): Set<string> {
    const dir = commonDir(repoPath);
    const paths = new Set<string>();
    if (dir === null) return paths;
    let text = '';
    try {
        text = fs.readFileSync(path.join(dir, REGISTRY_FILE), 'utf-8');
    } catch {
        return paths;
    }
    for (const line of text.split('\n')) {
        try {
            const e = JSON.parse(line) as Partial<RegistryEntry>;
            if (e.created_by === 'agent-config' && typeof e.path === 'string') paths.add(canonical(e.path));
        } catch {
            /* a torn or foreign line is not a registration */
        }
    }
    return paths;
}

/** `../<repo>-<suffix>` beside the main checkout: the shape this package's lanes use. */
export function isRepoSibling(mainPath: string, worktreePath: string): boolean {
    const main = canonical(mainPath);
    const wt = canonical(worktreePath);
    return path.dirname(main) === path.dirname(wt) && path.basename(wt).startsWith(`${path.basename(main)}-`);
}

/**
 * `basePath` MUST be the main worktree, never the invoking repo path.
 *
 * Measured 2026-08-13, and the failure is total rather than partial: called with
 * a linked worktree as the base, every sibling worktree resolves to `..` and the
 * safe set collapses to empty. Same binary, same repo, same minute — from inside
 * `.claude/worktrees/<branch>`: 304 registered, safe 0, 278 "non-standard"; from
 * the main checkout: safe 181, 81 non-standard. A maintainer who ran the
 * inventory from a worktree would read "nothing to clean" and conclude the
 * estate was fine, which is the worst shape a cleanup tool can fail in — it
 * fails silently, and toward inaction.
 */
export function isStandardLocation(basePath: string, worktreePath: string): boolean {
    const rel = path.relative(canonical(basePath), canonical(worktreePath));
    if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
    return STANDARD_WORKTREE_DIRS.some(
        (dir) => rel === dir || rel.startsWith(`${dir}${path.sep}`),
    );
}

/**
 * Per-worktree git-dir mtime, or null when it cannot be read. A linked
 * worktree's `.git` is a file holding `gitdir: <path>`; the main worktree's is
 * a directory.
 */
function lastGitActivity(worktreePath: string): Date | null {
    const dotGit = path.join(worktreePath, '.git');
    let gitDir: string;
    try {
        const st = fs.statSync(dotGit);
        if (st.isDirectory()) {
            gitDir = dotGit;
        } else {
            const m = fs.readFileSync(dotGit, 'utf-8').match(/^gitdir:\s*(.+)$/m);
            if (!m) return null;
            gitDir = path.resolve(worktreePath, m[1]!.trim());
        }
    } catch {
        return null;
    }
    let newest: number | null = null;
    for (const name of ['index', 'HEAD']) {
        try {
            const t = fs.statSync(path.join(gitDir, name)).mtimeMs;
            if (newest === null || t > newest) newest = t;
        } catch {
            /* absent is not an error — the other candidate may still exist */
        }
    }
    return newest === null ? null : new Date(newest);
}

/**
 * Classify every worktree. `now` is injectable so the live-window boundary is
 * testable rather than wall-clock dependent.
 */
/**
 * Two conditions the `safe` predicate does NOT carry by default, both off unless
 * asked for. They exist because an approval can be stricter than the tool, and
 * silently removing under the looser predicate is the substitution such an
 * approval is written to prevent.
 *
 * `minAgeDays` is a floor on git inactivity, layered ON TOP of the 48-hour live
 * window rather than replacing it: 48h answers "is someone in it right now", a
 * 60-day floor answers "is this abandoned". Different questions.
 *
 * `excludeLiveSessions` reads the session register — real records with a real
 * `worktree` path and a real TTL — instead of inferring occupancy from file
 * mtime, which this module's own header already rules out as a liveness signal.
 */
export interface InventoryOptions {
    now?: Date;
    minAgeDays?: number | null;
    excludeLiveSessions?: boolean;
    /**
     * Forge PR records for the squash-aware proof. `undefined` and `null` both
     * mean "not read": the inventory then uses the graph and offline proofs only.
     */
    prIndex?: PrIndex | null;
    /**
     * Hours a forge-proven merge must age before removal (D4). `0` on the
     * `/pr:merge` path, where the session that merged has nothing left to do.
     */
    mergeDelayHours?: number;
}

/** D4 — a revert or follow-up can reuse the tree for a day. */
export const MERGE_DELAY_HOURS = 24;

export interface ClassifyContext {
    trunk: string;
    mainPath: string;
    now: Date;
    liveCutoff: number;
    sessionPaths: Set<string>;
    registry: Set<string>;
    ageCutoff: number | null;
    minAgeDays: number | null;
    forge: { prIndex: PrIndex | null; mergeDelayHours: number };
}

/** One worktree, classified. Shared by the inventory and by the re-check run immediately before a removal. */
export function classifyEntry(e: WorktreeEntry, ctx: ClassifyContext): InventoryRow {
    const { trunk, mainPath, now, liveCutoff, sessionPaths, registry, ageCutoff, minAgeDays, forge } = ctx;
    const resolved = canonical(e.path);
    const isMain = resolved === mainPath;
    // `mainPath`, NOT `repoPath` — see isStandardLocation's contract.
    const standardLocation = isMain ? true : isStandardLocation(mainPath, resolved);
    const registered = registry.has(resolved);
    const reasons: string[] = [];
    const base = { path: e.path, branch: e.branch, standardLocation, registered, isMain };

    if (!fs.existsSync(resolved)) {
        return {
            ...base,
            classification: 'review',
            reasons: ['registration points at a missing directory — `git worktree prune` clears it'],
            mergedIntoTrunk: false,
            mergeEvidence: null,
            tip: null,
        };
    }

    const tip = e.branch === null ? null : branchTip(resolved, e.branch);
    // The session register is the primary liveness source; a registered
    // session in the tree makes it live whatever its mtimes say.
    if (sessionPaths.has(resolved)) {
        return {
            ...base,
            classification: 'live',
            reasons: ['a live agent session is registered in this worktree'],
            mergedIntoTrunk: e.branch !== null && isAncestor(resolved, e.branch, trunk),
            mergeEvidence: null,
            tip,
        };
    }
    // Fallback for sessions the register cannot see (another host, a plain
    // terminal): recent git activity in the per-worktree git dir.
    const activity = lastGitActivity(resolved);
    if (activity !== null && activity.getTime() >= liveCutoff) {
        return {
            ...base,
            classification: 'live',
            reasons: [`git activity within the last ${LIVE_WINDOW_HOURS}h — another session may hold it`],
            mergedIntoTrunk: e.branch !== null && isAncestor(resolved, e.branch, trunk),
            mergeEvidence: null,
            tip,
        };
    }

    if (isMain) reasons.push('main worktree — cannot be removed');
    if (e.branch === null) {
        reasons.push('detached HEAD — no branch to judge reachability for');
    }
    if (ageCutoff !== null && (activity === null || activity.getTime() >= ageCutoff)) {
        // `activity === null` disqualifies rather than passes: an unreadable
        // git-dir mtime is absence of evidence, and under an explicit
        // minimum-age floor that has to read as "cannot show it is old
        // enough", never as "old enough".
        reasons.push(
            activity === null
                ? `git activity unreadable — cannot prove ${minAgeDays}+ days of inactivity`
                : `git activity within the last ${minAgeDays} days`,
        );
    }
    const verdict =
        e.branch === null
            ? { evidence: null, mergedAt: null }
            : mergeEvidence(resolved, e.branch, trunk, forge.prIndex);
    const mergedIntoTrunk = verdict.evidence === 'merged-ancestor';
    const proven =
        verdict.evidence === 'merged-ancestor' ||
        verdict.evidence === 'merged-pr' ||
        verdict.evidence === 'merged-equivalent';

    // Outside the standard roots a tree is eligible only by a registration
    // this package wrote, or by the `<repo>-*` sibling shape plus a merge
    // proof (D2). Location alone never qualifies, and never disqualifies a
    // tree this package created.
    if (!standardLocation && !registered && !(proven && isRepoSibling(mainPath, resolved))) {
        reasons.push('non-standard location — outside the conventional worktree roots');
    }

    if (e.branch !== null && verdict.evidence === 'closed-unmerged') {
        reasons.push('PR closed unmerged — the work is not on the trunk');
    } else if (e.branch !== null && !proven) {
        reasons.push(`branch is not an ancestor of ${trunk} — unmerged work`);
        const gate = checkWorktree(resolved);
        if (!gate.allowed) reasons.push(...gate.reasons);
    } else if (e.branch !== null) {
        // A proven merge makes the unique-commit gate moot: an ancestor has
        // every commit on the trunk, and a squash- or tree-proven branch's
        // commits are exactly what the trunk already holds as one commit.
        const status = statusPorcelain(resolved);
        if (status.trim().length > 0) {
            const n = status.trimEnd().split('\n').length;
            reasons.push(`unsaved work — ${n} dirty or untracked path(s)`);
        }
        const local = localOnlyIgnored(resolved);
        if (local.length > 0) {
            const shown = local.slice(0, 5).join(', ');
            reasons.push(`local-only files — ${local.length} ignored path(s) a rebuild would not restore: ${shown}`);
        }
        if (verdict.mergedAt !== null && forge.mergeDelayHours > 0) {
            const age = now.getTime() - Date.parse(verdict.mergedAt);
            if (Number.isFinite(age) && age < forge.mergeDelayHours * 3600 * 1000) {
                reasons.push(`merged less than ${forge.mergeDelayHours}h ago — kept for a follow-up`);
            }
        }
    }

    return {
        ...base,
        classification: reasons.length === 0 ? 'safe' : 'review',
        reasons,
        mergedIntoTrunk,
        mergeEvidence: verdict.evidence,
        tip,
    };
}

export function buildInventory(
    repoPath: string,
    nowOrOptions: Date | InventoryOptions = new Date(),
): Inventory {
    const opts: InventoryOptions =
        nowOrOptions instanceof Date ? { now: nowOrOptions } : nowOrOptions;
    const now = opts.now ?? new Date();
    const minAgeDays = opts.minAgeDays ?? null;
    const ageCutoff = minAgeDays === null ? null : now.getTime() - minAgeDays * 86400 * 1000;
    return buildInventoryInner(repoPath, now, ageCutoff, minAgeDays, opts.excludeLiveSessions === true, {
        prIndex: opts.prIndex ?? null,
        mergeDelayHours: opts.mergeDelayHours ?? MERGE_DELAY_HOURS,
    });
}

function buildInventoryInner(
    repoPath: string,
    nowArg: Date,
    ageCutoff: number | null,
    minAgeDays: number | null,
    excludeLiveSessions: boolean,
    forge: { prIndex: PrIndex | null; mergeDelayHours: number },
): Inventory {
    const now = nowArg;
    const trunk = resolveTrunk(repoPath);
    const entries = listWorktrees(repoPath);
    const mainPath = canonical(entries.length > 0 ? entries[0]!.path : repoPath);
    const liveCutoff = now.getTime() - LIVE_WINDOW_HOURS * 3600 * 1000;

    // Registered session worktrees, canonicalised so the comparison survives a
    // symlinked checkout root the same way every other path here does. Empty set
    // when the option is off, when no register directory exists (the normal
    // state before any session registers), or when every record has expired.
    const sessionPaths = new Set<string>();
    if (excludeLiveSessions) {
        const dir = register_dir(mainPath);
        if (dir !== null) {
            for (const rec of read_live_records(dir, { now })) {
                sessionPaths.add(canonical(rec.worktree));
            }
        }
    }

    const registry = readRegistry(mainPath);

    const ctx: ClassifyContext = {
        trunk, mainPath, now, liveCutoff, sessionPaths, registry, ageCutoff, minAgeDays, forge,
    };
    const rows: InventoryRow[] = entries.map((e) => classifyEntry(e, ctx));

    const reviewReasons: Record<string, number> = {};
    for (const r of rows) {
        if (r.classification !== 'review') continue;
        // Group by the first reason: it is the primary disqualifier, and the
        // per-row reasons stay available in --json for the full picture.
        const key = (r.reasons[0] ?? 'unknown').split('\n')[0]!;
        reviewReasons[key] = (reviewReasons[key] ?? 0) + 1;
    }

    return {
        trunk,
        rows,
        context: ctx,
        counts: {
            total: rows.length,
            safe: rows.filter((r) => r.classification === 'safe').length,
            review: rows.filter((r) => r.classification === 'review').length,
            live: rows.filter((r) => r.classification === 'live').length,
            reviewReasons: Object.fromEntries(
                Object.entries(reviewReasons).sort((a, b) => b[1] - a[1]),
            ),
        },
    };
}

/**
 * The removal commands for the safe set — printed for a human to review and
 * run, never executed here. `git branch -d` (never `-D`) so git itself
 * re-checks the merge before the branch goes.
 */
export function removalPlan(inv: Inventory): string[] {
    return inv.rows
        .filter((r) => r.classification === 'safe')
        .map((r) => {
            const remove = `git worktree remove ${JSON.stringify(r.path)}`;
            return r.branch !== null && r.mergedIntoTrunk
                ? `${remove} && git branch -d ${JSON.stringify(r.branch)}`
                : remove;
        });
}

export interface RemovalOutcome {
    path: string;
    branch: string | null;
    tip: string | null;
    evidence: MergeEvidence | null;
    removed: boolean;
    /** git's own refusal text when it declined, e.g. a tree that turned dirty. */
    error: string | null;
}

/** Per-repository removal lock in the common git dir; stale after this long. */
export const REMOVAL_LOCK = 'agent-config-worktree-removal.lock';
const LOCK_STALE_MS = 10 * 60 * 1000;

/**
 * Take the per-repository removal lock, or `null` when another pass holds it.
 * Two session starts in two worktrees of one repository must not both judge and
 * remove the same tree; the second one simply does nothing this time.
 */
function takeRemovalLock(mainPath: string, now: Date): (() => void) | null {
    const dir = commonDir(mainPath);
    if (dir === null) return null;
    const file = path.join(dir, REMOVAL_LOCK);
    const tryCreate = (): boolean => {
        try {
            fs.writeFileSync(file, `${process.pid} ${now.toISOString()}\n`, { flag: 'wx' });
            return true;
        } catch {
            return false;
        }
    };
    if (!tryCreate()) {
        try {
            if (now.getTime() - fs.statSync(file).mtimeMs < LOCK_STALE_MS) return null;
            fs.unlinkSync(file);
        } catch {
            return null;
        }
        if (!tryCreate()) return null;
    }
    return () => {
        try {
            fs.unlinkSync(file);
        } catch {
            /* already gone — a stale-lock sweep by another pass */
        }
    };
}

/**
 * Remove the safe set. Plain `git worktree remove`, without the force flag, so git
 * re-checks cleanliness itself at the moment of removal. Before that, every
 * candidate is classified AGAIN, immediately before its own removal, under the
 * repository lock: a tree that turned dirty, gained a local-only file, gained a
 * session or moved its tip since the inventory is kept (council 2026-10-21,
 * check-to-remove). The main worktree and every non-safe row are untouchable
 * here by construction. Branches are left alone (D3); the journal carries the
 * tip SHA, which is enough to recreate one.
 */
export function applyRemovals(
    repoPath: string,
    inv: Inventory,
    opts: { onlyBranch?: string | null; now?: Date; recheck?: ClassifyContext } = {},
): RemovalOutcome[] {
    const now = opts.now ?? new Date();
    const mainPath = inv.rows.find((r) => r.isMain)?.path ?? repoPath;
    const rows = inv.rows.filter(
        (r) =>
            r.classification === 'safe' &&
            !r.isMain &&
            (opts.onlyBranch === undefined || opts.onlyBranch === null || r.branch === opts.onlyBranch),
    );
    if (rows.length === 0) return [];
    const release = takeRemovalLock(mainPath, now);
    if (release === null) return [];
    const outcomes: RemovalOutcome[] = [];
    try {
        const ctx = opts.recheck ?? inv.context;
        for (const r of rows) {
            let error: string | null = null;
            const again = classifyEntry({ path: r.path, branch: r.branch }, ctx);
            if (again.classification !== 'safe' || again.tip !== r.tip) {
                error = `changed since the inventory — kept (${again.reasons[0] ?? 'tip moved'})`;
            } else {
                try {
                    git(mainPath, ['worktree', 'remove', r.path]);
                } catch (e) {
                    const stderr = (e as { stderr?: Buffer | string }).stderr;
                    error = (stderr === undefined ? String(e) : String(stderr)).trim().split('\n')[0] ?? 'refused';
                }
            }
            outcomes.push({ path: r.path, branch: r.branch, tip: r.tip, evidence: r.mergeEvidence, removed: error === null, error });
        }
        tryGit(mainPath, ['worktree', 'prune']);
        const dir = commonDir(mainPath);
        if (dir !== null) {
            const at = now.toISOString();
            const lines = outcomes.map((o) =>
                JSON.stringify({ at, path: o.path, branch: o.branch, tip: o.tip, evidence: o.evidence, removed: o.removed, error: o.error }),
            );
            fs.appendFileSync(path.join(dir, REMOVAL_JOURNAL), `${lines.join('\n')}\n`);
        }
    } finally {
        release();
    }
    return outcomes;
}

/** The one line a session start or a merge prints after a removal pass. */
export function removalSummary(inv: Inventory, outcomes: RemovalOutcome[]): string {
    const removed = outcomes.filter((o) => o.removed).length;
    const decide = inv.rows.filter((r) => r.classification === 'review' && !r.isMain).length;
    const branches = outcomes
        .filter((o) => o.removed && o.branch !== null && o.evidence !== 'merged-ancestor')
        .map((o) => o.branch!);
    const hint = branches.length > 0 ? ` · local branches kept: git branch -D ${branches.map((b) => JSON.stringify(b)).join(' ')}` : '';
    return `worktrees: ${removed} removed, ${decide} need a decision (/worktree cleanup)${hint}`;
}

export type CleanupMode = 'auto' | 'notify' | 'off';

/**
 * `worktrees.cleanup`, read through the same settings cascade every surface
 * reads. Absent resolves to `notify` (council 2026-10-21 Q2: installation alone
 * is not consent to delete). Fail-closed: a malformed settings layer reads as
 * `off`, so a file the user broke never lets the shipped default speak for it.
 */
export function cleanupMode(root: string, opts: { userGlobalPath?: string | null } = {}): CleanupMode {
    const ug = opts.userGlobalPath ?? null;
    const scope = { cwd: root, ...(ug !== null ? { user_global_path: ug } : {}) };
    try {
        if (settings_layer_states(scope).some((l) => l.state === 'malformed')) return 'off';
        const section = load_agent_settings(scope)['worktrees'];
        if (section !== null && typeof section === 'object' && !Array.isArray(section)) {
            const v = (section as Record<string, unknown>)['cleanup'];
            if (v === 'auto' || v === 'notify' || v === 'off') return v;
        }
        return 'notify';
    } catch {
        return 'off';
    }
}

/** The daily pass's budget — the retro's, on the same slot (council 2026-10-21 Q1). */
export const DAILY_BUDGET_MS = 3000;
/** Per-candidate record of the last daily pass, in the common git dir. */
export const DAILY_RECORD = 'agent-config-worktree-daily.json';

export interface DailyResult {
    mode: CleanupMode;
    scanned: number;
    total: number;
    removable: number;
    removed: number;
    decide: number;
    line: string | null;
}

/**
 * The once-a-day pass (worktrees roadmap 3.3). Synchronous, bounded by
 * DAILY_BUDGET_MS as a SUBPROCESS deadline, run on the first session of the
 * day by the existing `session_start` handler. Declared as an authority
 * expansion: under `worktrees.cleanup: auto` it deletes worktrees, which is
 * acting, not observing — the user-owned key is what authorises it (ADR-295).
 * Under `notify` it removes nothing and says how many it could.
 *
 * Fair across days: the traversal starts at a different worktree each day, so
 * a repository whose first few candidates are slow still has every candidate
 * reached within a few passes. A pass the budget cut short reports how far it
 * got and is still stamped — tomorrow's start point is different anyway.
 */
export function dailyCleanup(
    root: string,
    deps: {
        now?: Date;
        mode?: CleanupMode;
        run?: GhRunner;
        budgetMs?: number;
        ranToday?: (root: string) => boolean;
        stamp?: (root: string) => void;
    } = {},
): DailyResult | null {
    const now = deps.now ?? new Date();
    const mode = deps.mode ?? cleanupMode(root);
    if (mode === 'off') return null;
    if (deps.ranToday?.(root) === true) return null;
    const deadlineAt = Date.now() + (deps.budgetMs ?? DAILY_BUDGET_MS);
    try {
        const result = withDeadline(deadlineAt, () => {
            const entries = listWorktrees(root);
            const mainPath = canonical(entries.length > 0 ? entries[0]!.path : root);
            const candidates = entries.slice(1);
            const day = Math.floor(now.getTime() / 86400000);
            const start = candidates.length === 0 ? 0 : day % candidates.length;
            const ordered = [...candidates.slice(start), ...candidates.slice(0, start)];

            const sessionPaths = new Set<string>();
            const reg = register_dir(mainPath);
            if (reg !== null) for (const rec of read_live_records(reg, { now })) sessionPaths.add(canonical(rec.worktree));
            const ctx: ClassifyContext = {
                trunk: resolveTrunk(mainPath),
                mainPath,
                now,
                liveCutoff: now.getTime() - LIVE_WINDOW_HOURS * 3600 * 1000,
                sessionPaths,
                registry: readRegistry(mainPath),
                ageCutoff: null,
                minAgeDays: null,
                forge: { prIndex: readPrIndex(mainPath, deps.run === undefined ? {} : { run: deps.run }), mergeDelayHours: MERGE_DELAY_HOURS },
            };
            const rows: InventoryRow[] = [];
            for (const e of ordered) {
                if (Date.now() >= deadlineAt) break;
                try {
                    rows.push(classifyEntry(e, ctx));
                } catch {
                    break; // the deadline cut a git call short: fail closed, keep the rest
                }
            }
            const inv: Inventory = {
                trunk: ctx.trunk,
                rows,
                context: ctx,
                counts: { total: rows.length, safe: 0, review: 0, live: 0, reviewReasons: {} },
            };
            const safe = rows.filter((r) => r.classification === 'safe');
            let outcomes: RemovalOutcome[] = [];
            if (mode === 'auto' && safe.length > 0) {
                try {
                    outcomes = applyRemovals(mainPath, inv, { now });
                } catch {
                    outcomes = [];
                }
            }
            const removed = outcomes.filter((o) => o.removed).length;
            const decide = rows.filter((r) => r.classification === 'review').length;
            const dir = commonDir(mainPath);
            if (dir !== null) {
                const record = {
                    at: now.toISOString(),
                    mode,
                    scanned: rows.length,
                    total: candidates.length,
                    rows: rows.map((r) => ({ path: r.path, branch: r.branch, classification: r.classification, evidence: r.mergeEvidence, reasons: r.reasons })),
                    outcomes,
                };
                fs.writeFileSync(path.join(dir, DAILY_RECORD), `${JSON.stringify(record, null, 2)}\n`);
            }
            const cut = rows.length < candidates.length ? ` (${rows.length}/${candidates.length} checked today)` : '';
            let line: string | null = null;
            if (mode === 'auto' && (removed > 0 || decide > 0)) {
                line = `${removalSummary(inv, outcomes)}${cut}`;
            } else if (mode === 'notify' && safe.length > 0) {
                line =
                    `worktrees: ${safe.length} merged, clean and unused — remove with /worktree cleanup --apply, ` +
                    `or set worktrees.cleanup: auto${cut}`;
            }
            return { mode, scanned: rows.length, total: candidates.length, removable: safe.length, removed, decide, line };
        });
        deps.stamp?.(root);
        return result;
    } catch {
        return null;
    }
}

function usage(): never {
    process.stderr.write(
        'usage: worktree_cleanup_check check <worktree-path> | scope-overlap [repo-path] | ' +
            'inventory [repo-path] [--json|--plan] [--min-age-days=N] [--exclude-live-sessions] [--offline] | ' +
            'apply [repo-path] [--branch=<name>] [--no-delay] [--offline] [--json] | ' +
            'register <worktree-path> [--purpose=<text>]\n',
    );
    process.exit(2);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const mode = argv[0];
    if (mode === 'check') {
        const p = argv[1];
        if (p === undefined) usage();
        const r = checkWorktree(path.resolve(p));
        if (r.allowed) {
            process.stdout.write(`✅  cleanup allowed: ${p}\n`);
            return 0;
        }
        process.stdout.write(`⛔  cleanup refused: ${p}\n`);
        for (const reason of r.reasons) {
            process.stdout.write(`  - ${reason}\n`);
        }
        process.stdout.write(
            '\nRefusal is the safety gate working — commit/stash the work or merge/preserve ' +
                'the unique commits, then re-run. Never bypass with --force or branch -D.\n',
        );
        return 1;
    }
    if (mode === 'scope-overlap') {
        const repo = path.resolve(argv[1] ?? '.');
        const overlaps = findScopeOverlaps(repo);
        if (overlaps.length === 0) {
            process.stdout.write('✅  no scope-lock overlaps across live worktrees.\n');
            return 0;
        }
        process.stdout.write(`⚠️  ${overlaps.length} scope-lock overlap(s):\n`);
        for (const o of overlaps) {
            process.stdout.write(
                `  - ${o.a.worktree} owns '${o.a.own}'  ×  ${o.b.worktree} owns '${o.b.own}'\n`,
            );
        }
        return 1;
    }
    if (mode === 'register') {
        const p = argv[1];
        if (p === undefined || p.startsWith('--')) usage();
        const purposeFlag = argv.slice(2).find((a) => a.startsWith('--purpose='));
        const purpose = purposeFlag === undefined ? 'unspecified' : purposeFlag.slice('--purpose='.length);
        const e = registerWorktree(path.resolve(p), path.resolve(p), purpose);
        process.stdout.write(`registered ${e.path} (${e.branch ?? 'detached'}, ${e.purpose})\n`);
        return 0;
    }
    if (mode === 'apply') {
        const rest = argv.slice(1);
        const flags = rest.filter((a) => a.startsWith('--'));
        const positional = rest.filter((a) => !a.startsWith('--'));
        const KNOWN_APPLY = ['--no-delay', '--offline', '--json'];
        const branchFlag = flags.find((f) => f.startsWith('--branch='));
        if (positional.length > 1 || flags.some((f) => !KNOWN_APPLY.includes(f) && !f.startsWith('--branch='))) {
            usage();
        }
        const repo = path.resolve(positional[0] ?? '.');
        const inv = buildInventory(repo, {
            excludeLiveSessions: true,
            prIndex: flags.includes('--offline') ? null : readPrIndex(repo),
            mergeDelayHours: flags.includes('--no-delay') ? 0 : MERGE_DELAY_HOURS,
        });
        const outcomes = applyRemovals(repo, inv, {
            onlyBranch: branchFlag === undefined ? null : branchFlag.slice('--branch='.length),
        });
        if (flags.includes('--json')) {
            process.stdout.write(`${JSON.stringify({ outcomes, counts: inv.counts }, null, 2)}\n`);
        } else {
            for (const o of outcomes) {
                process.stdout.write(
                    o.removed ? `removed  ${o.path} (${o.evidence ?? 'merged'})\n` : `refused  ${o.path}: ${o.error}\n`,
                );
            }
            process.stdout.write(`${removalSummary(inv, outcomes)}\n`);
        }
        return outcomes.some((o) => !o.removed) ? 1 : 0;
    }
    if (mode === 'inventory') {
        const rest = argv.slice(1);
        const flags = rest.filter((a) => a.startsWith('--'));
        const positional = rest.filter((a) => !a.startsWith('--'));
        const KNOWN = ['--json', '--plan', '--exclude-live-sessions', '--offline'];
        const ageFlag = flags.find((f) => f.startsWith('--min-age-days='));
        if (
            positional.length > 1 ||
            flags.some((f) => !KNOWN.includes(f) && !f.startsWith('--min-age-days='))
        ) {
            usage();
        }
        let minAgeDays: number | null = null;
        if (ageFlag !== undefined) {
            const raw = ageFlag.slice('--min-age-days='.length);
            const n = Number(raw);
            // Refuse rather than silently fall back to null: a typo'd floor that
            // reads as "no floor" would widen the safe set at exactly the moment
            // the caller asked to narrow it.
            if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
                process.stderr.write(`--min-age-days needs a non-negative integer, got '${raw}'\n`);
                return 2;
            }
            minAgeDays = n;
        }
        const repo = path.resolve(positional[0] ?? '.');
        const inv = buildInventory(repo, {
            minAgeDays,
            excludeLiveSessions: flags.includes('--exclude-live-sessions'),
            prIndex: flags.includes('--offline') ? null : readPrIndex(repo),
        });

        if (flags.includes('--json')) {
            const { context: _ctx, ...plain } = inv;
            process.stdout.write(`${JSON.stringify(plain, null, 2)}\n`);
            return 0;
        }
        if (flags.includes('--plan')) {
            const plan = removalPlan(inv);
            if (plan.length === 0) {
                process.stdout.write('# no safe worktrees — nothing to propose.\n');
                return 0;
            }
            process.stdout.write(
                `# Prepared removal plan for ${plan.length} safe worktree(s).\n` +
                    '# NOT executed here. `apply` removes the safe set itself (worktrees only,\n' +
                    '# never --force); the `branch -d` lines stay yours to run.\n',
            );
            process.stdout.write(`${plan.join('\n')}\n`);
            return 0;
        }

        const c = inv.counts;
        process.stdout.write(
            `worktree inventory · ${c.total} registered · trunk ${inv.trunk}\n` +
                `  safe    ${c.safe}\n` +
                `  review  ${c.review}\n` +
                `  live    ${c.live}\n`,
        );
        if (c.review > 0) {
            process.stdout.write('\nreview reasons (primary disqualifier):\n');
            for (const [reason, n] of Object.entries(c.reviewReasons)) {
                process.stdout.write(`  ${String(n).padStart(4)}  ${reason}\n`);
            }
        }
        process.stdout.write(
            '\nThis mode reports only. `--plan` prints the removal commands for the safe set;\n' +
                '`apply` removes that set (proven merged, clean, not live), and nothing else.\n',
        );
        return 0;
    }
    usage();
}

// Bundle-safety: this module is inlined into the hook bundle (the daily pass),
// where every module shares the bundle's `import.meta.url` — so the argv match
// below would be true inside every hook and `main()` would exit the dispatcher.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;

function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    try {
        process.exit(main());
    } catch (e) {
        process.stderr.write(`Internal error: ${e instanceof Error ? e.message : String(e)}\n`);
        process.exit(3);
    }
}
