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

import { statePathFor } from '../before_complete_hook.js';
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


/**
 * The last verification THIS SESSION recorded, as one line.
 *
 * **What this is not:** an exit code. The roadmap step asked for "last verify
 * exit", and nothing in the tree records one — `before_complete_hook` stores
 * `{command, tool, at, …}` and no status. Emitting a fabricated exit would be
 * worse than emitting less, so the field carries the command and its
 * timestamp and says so, rather than implying a pass/fail the source never
 * held.
 *
 * **Why the session id is a required parameter, not an optional one.** This
 * function resolved `agents/runtime/state/verify-before-complete.json` for its
 * whole life and returned `null` every time: the producer never wrote that
 * path — pre-split it wrote `agents/state/verify-before-complete.json`, and
 * after the per-session split it writes
 * `agents/state/verify-before-complete/<digest>.json`. The `runtime/` segment
 * was never a directory this state used, so the reader was dead on arrival
 * rather than made dead by the split.
 *
 * The producer's state is now per-session, so a reader without a session id
 * cannot address it — and there is no defensible fallback. Reading "whatever
 * file is newest in the directory" would attribute a NEIGHBOURING session's
 * verification to this envelope, which is the exact cross-session read the
 * split exists to stop, and it would do it on the field a successor session
 * uses to decide whether work was verified. So an absent id yields `null`, and
 * the parameter is required so no caller can reach the dead behaviour by
 * omission.
 *
 * The path comes from the producer's own builder (`statePathFor`), never from
 * a literal repeated here: a copied path constant is what went stale, and
 * copying it again with the correct value would only reset the clock on the
 * same failure.
 */
export function readLastVerify(root: string, session_id: string | null): string | null {
    if (typeof session_id !== 'string' || session_id.trim() === '') return null;
    try {
        const raw = fs.readFileSync(path.join(root, statePathFor(session_id)), 'utf-8');
        const state = JSON.parse(raw) as Record<string, unknown>;
        const lv = state['last_verification'];
        if (typeof lv !== 'object' || lv === null || Array.isArray(lv)) return null;
        const rec = lv as Record<string, unknown>;
        const command = typeof rec['command'] === 'string' ? rec['command'] : null;
        if (!command) return null;
        const at = typeof rec['at'] === 'string' ? rec['at'] : 'unknown time';
        // Collapse whitespace BEFORE slicing. A recorded command is whatever
        // the operator ran, and a heredoc (`git commit -F - <<'MSG'`) records a
        // multi-line string — so slicing to 200 chars kept the newlines, and
        // `validateRecycleEnvelope`'s `isShortLine` rejects any value containing
        // one. The result was that `session:recycle` refused its OWN
        // machine-collected field: composing a valid envelope was impossible
        // whenever the previous verification command spanned more than one line,
        // and the error named `last_verify` without hinting that the composer
        // had not supplied it. Reproduced 2026-08-21 on a 512-char heredoc.
        const flat = `${command} @ ${at} (no exit status is recorded anywhere)`.replace(/\s+/g, ' ').trim();
        return flat.slice(0, MAX_FIELD_CHARS);
    } catch {
        return null;
    }
}

/**
 * Collect every scripted field. Never throws — an unreadable fact is `null`.
 *
 * `session_id` is required and forwarded to `readLastVerify` — see the reason
 * stated there. A caller with no id in hand passes `null` and gets a `null`
 * `last_verify`, which is the honest answer rather than a neighbour's.
 */
export function collectGrounding(root: string, session_id: string | null): Grounding {
    const anchor = collectRepoAnchor(root);
    const porcelain = git(root, ['status', '--porcelain']);
    if (porcelain === null) {
        // A FAILED read is not a clean tree. Collapsing the two would make
        // this the one field in the module that asserts something it never
        // read — and it would assert it exactly when every sibling field is
        // null, so `describeDrift` is silent and nothing challenges it.
        return { ...anchor, uncommitted_paths: [], status_summary: null, last_verify: readLastVerify(root, session_id) };
    }
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
        last_verify: readLastVerify(root, session_id),
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
