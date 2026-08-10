/**
 * Deterministic environment grounding for the handoff envelope
 * (road-to-cost-parity-3 Phase 3.2–3.3).
 *
 * The factual half of an envelope — where the work was, on what branch, at
 * which commit, what was uncommitted, what was last verified — is collected
 * by THIS module, not composed by a model. Scripted facts are free and
 * verifiable; deriving them through a model is the right idea at the wrong
 * price, and a model-composed "branch" is a claim rather than a reading.
 *
 * Every git read goes through `gitEnv()`. An inherited `GIT_DIR` (which any
 * hook exports) silently redirects `git` at the wrong repository, which would
 * make the drift anchor confidently wrong — the one failure mode worse than
 * having no anchor.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { git_common_dir } from './git_common_dir.js';
import { gitEnv } from './git_env.js';

/** Longest ref/line this module will emit — mirrors the envelope's own caps. */
const MAX_FIELD_CHARS = 200;
/** Uncommitted paths are a pointer list, not a diff. */
const MAX_PATHS = 40;

function git(root: string, args: string[]): string | null {
    try {
        return execFileSync('git', args, {
            cwd: root,
            env: gitEnv(),
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return null;
    }
}

/**
 * Canonical form of a repo identity, so the SAME repository never reads as
 * two different ones. Committed rules, in order:
 *
 *   1. scheme stripped (`https://`, `ssh://`, `git://`)
 *   2. credentials stripped (`user:pass@`, `git@`)
 *   3. scp-style `host:org/repo` → `host/org/repo`
 *   4. host segment lower-cased
 *   5. trailing `.git` and trailing `/` removed
 *
 * Without these, one checkout's `git@github.com:Org/Repo.git` and another's
 * `https://github.com/org/repo` compare as drift while being the same repo —
 * a false alarm every time, which trains the reader to ignore the real one.
 */
export function canonicalizeRepoIdentity(raw: string): string {
    let s = raw.trim();
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ''); // scheme
    s = s.replace(/^[^/@]+@/, ''); // credentials / ssh user
    s = s.replace(/^([^/:]+):(?!\/)/, '$1/'); // scp-style separator
    s = s.replace(/\/+$/, '');
    s = s.replace(/\.git$/i, '');
    const slash = s.indexOf('/');
    if (slash > 0) {
        s = s.slice(0, slash).toLowerCase() + s.slice(slash);
    } else {
        s = s.toLowerCase();
    }
    return s;
}

/** The three fields that together identify a working tree at a point in time. */
export interface RepoAnchor {
    repo_identity: string | null;
    branch: string | null;
    head: string | null;
}

/**
 * Read the anchor for `root`.
 *
 * Identity is the canonicalized `origin` remote, or — when the repo has no
 * remote — the realpath of the common git dir. Branch and HEAD alone are NOT
 * an anchor: this repo routinely runs many worktrees, a branch name is unique
 * in neither, and two checkouts sitting at the same commit on a same-named
 * branch would compare as "no drift" while being different working trees.
 */
export function collectRepoAnchor(root: string): RepoAnchor {
    const remote = git(root, ['config', '--get', 'remote.origin.url']);
    let identity: string | null = null;
    if (remote) {
        identity = canonicalizeRepoIdentity(remote);
    } else {
        const common = git_common_dir(root);
        if (common !== null) {
            try {
                identity = fs.realpathSync(common);
            } catch {
                identity = common;
            }
        }
    }
    return {
        repo_identity: identity ? identity.slice(0, MAX_FIELD_CHARS) : null,
        branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
        head: git(root, ['rev-parse', 'HEAD']),
    };
}

/** The scripted fields the model never composes. */
export interface Grounding extends RepoAnchor {
    uncommitted_paths: string[];
    status_summary: string | null;
    last_verify: string | null;
}

const VERIFY_STATE_REL = path.join('agents', 'runtime', 'state', 'verify-before-complete.json');

/**
 * The last verification this workspace recorded, as one line.
 *
 * **What this is not:** an exit code. The roadmap step asked for "last verify
 * exit", and nothing in the tree records one — `before_complete_hook` stores
 * `{command, tool, at, …}` and no status. Emitting a fabricated exit would be
 * worse than emitting less, so the field carries the command and its
 * timestamp and says so, rather than implying a pass/fail the source never
 * held.
 */
export function readLastVerify(root: string): string | null {
    try {
        const raw = fs.readFileSync(path.join(root, VERIFY_STATE_REL), 'utf-8');
        const state = JSON.parse(raw) as Record<string, unknown>;
        const lv = state['last_verification'];
        if (typeof lv !== 'object' || lv === null || Array.isArray(lv)) return null;
        const rec = lv as Record<string, unknown>;
        const command = typeof rec['command'] === 'string' ? rec['command'] : null;
        if (!command) return null;
        const at = typeof rec['at'] === 'string' ? rec['at'] : 'unknown time';
        return `${command} @ ${at} (no exit status is recorded anywhere)`.slice(0, MAX_FIELD_CHARS);
    } catch {
        return null;
    }
}

/** Collect every scripted field. Never throws — an unreadable fact is `null`. */
export function collectGrounding(root: string): Grounding {
    const anchor = collectRepoAnchor(root);
    const porcelain = git(root, ['status', '--porcelain']) ?? '';
    const lines = porcelain.split('\n').filter((l) => l.trim().length > 0);
    const paths = lines
        .map((l) => l.slice(3).trim())
        .filter((p) => p.length > 0 && p.length <= MAX_FIELD_CHARS)
        .slice(0, MAX_PATHS);
    return {
        ...anchor,
        uncommitted_paths: paths,
        status_summary:
            lines.length === 0
                ? 'clean working tree'
                : `${lines.length} uncommitted path(s)${lines.length > MAX_PATHS ? `, first ${MAX_PATHS} listed` : ''}`,
        last_verify: readLastVerify(root),
    };
}

/**
 * Compare an envelope's recorded anchor against the tree it is being injected
 * into. Returns one line per mismatch — the consumer LEADS the injected block
 * with them, so a stale resume can never be silent.
 *
 * A field the envelope never recorded produces no line: an absent anchor is
 * an older envelope, not evidence of drift.
 */
export function describeDrift(envelope: unknown, actual: RepoAnchor): string[] {
    if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope)) return [];
    const e = envelope as Record<string, unknown>;
    const drift: string[] = [];
    const recordedIdentity = typeof e['repo_identity'] === 'string' ? e['repo_identity'] : null;
    if (recordedIdentity && actual.repo_identity && recordedIdentity !== actual.repo_identity) {
        drift.push(
            `IDENTITY DRIFT: this envelope was written in "${recordedIdentity}", you are in ` +
                `"${actual.repo_identity}". Re-verify every path before acting — same branch name ` +
                `does not mean same working tree.`,
        );
    }
    const recordedBranch = typeof e['branch'] === 'string' ? e['branch'] : null;
    if (recordedBranch && actual.branch && recordedBranch !== actual.branch) {
        drift.push(
            `BRANCH DRIFT: envelope written on "${recordedBranch}", checkout is on "${actual.branch}".`,
        );
    }
    const recordedHead = typeof e['head'] === 'string' ? e['head'] : null;
    if (recordedHead && actual.head && recordedHead !== actual.head) {
        drift.push(
            `COMMIT DRIFT: envelope written at ${recordedHead.slice(0, 12)}, HEAD is now ` +
                `${actual.head.slice(0, 12)} — re-read anything the envelope quotes.`,
        );
    }
    return drift;
}
