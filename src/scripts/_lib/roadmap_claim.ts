/**
 * Roadmap claims — where a session's claim is written and read.
 *
 * Kept free of the session-register hook's runtime dependencies so a concern
 * that only needs "which roadmap did this session claim" can load it without
 * pulling the register's probes, cleanup and lint code with it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { git_common_dir } from './git_common_dir.js';
import { safe_stem } from './session_register.js';

/**
 * Where `/roadmap:next` deposits the slug it picked, for the next heartbeat to
 * lift into the register (Phase 4 bridge).
 *
 * The roadmap is chosen **mid-session** by a command the model runs, and a hook
 * is a script: it cannot know what the model picked. Routing the claim through a
 * state file rather than having the command write the register directly means
 * the claim lands at most one turn later and the model never needs to know the
 * register's path or format.
 */
const _STATE_REL = path.join('agents', 'runtime', 'state');

export const ROADMAP_CLAIM_REL = path.join(_STATE_REL, 'roadmap-claim.json');

/**
 * Per-SESSION claim path. The legacy single file above is a claim on the
 * WORKTREE, not on the session, and that was a measured defect rather than a
 * theoretical one: four live records once carried one identical slug — naming a
 * roadmap that was already archived — because every session in the same checkout
 * read the last claim written there. A session inheriting a peer's claim reports
 * work it is not doing, and a session whose claim was overwritten reports none.
 *
 * `session_id` is available on both paths: the hook gets it from the envelope,
 * and `sessions:claim` resolves it from the host environment. When it is not
 * resolvable the legacy path is still written and still read, so an older claim
 * keeps working — the fallback degrades to the previous behaviour instead of
 * losing the claim.
 */
export function roadmap_claim_rel(session_id: string | null | undefined): string {
    const id = String(session_id ?? '').trim();
    if (id === '') {
        return ROADMAP_CLAIM_REL;
    }
    // `safe_stem` collapses `..` and both separators, so the stem cannot traverse.
    // The containment assertion below is nonetheless real rather than ceremonial:
    // the adversarial gate's finding was "the defense relies on caller honesty",
    // and it is right that a guarantee living in another module's implementation is
    // one refactor away from being untrue here. This one is local and mechanical —
    // if the joined path ever leaves the state directory, fall back to the shared
    // file rather than write outside it.
    const rel = path.join(_STATE_REL, `roadmap-claim-${safe_stem(id)}.json`);
    const norm = path.normalize(rel);
    if (!norm.startsWith(`${_STATE_REL}${path.sep}`) || norm.includes('..')) {
        return ROADMAP_CLAIM_REL;
    }
    return norm;
}

/** Claim directory name, beside the session register in the git common dir. */
export const CLAIM_DIRNAME = 'agent-claims';

/**
 * Where a roadmap claim lives: the git COMMON dir, which every worktree shares.
 *
 * The defect this fixes, measured 2026-08-19:
 *
 * The run contract had two halves that resolved DIFFERENT roots.
 * `sessions_cli.cmd_claim` joined the relative path below against
 * `process.cwd()` — the worktree the operator stands in. The stop-slot concern
 * joined it against `envelope.workspace_root`, which the dispatcher sets from
 * `--project-dir`, i.e. the host's `CLAUDE_PROJECT_DIR` — the parent checkout.
 * In a worktree those are different trees, so the concern found no contract,
 * took its `contract absent -> no-op` rung, and wrote NO event.
 *
 * That last part is why it went unnoticed for a release: the ledger built to
 * make `run-continuation` auditable is empty exactly when it never ran, and
 * empty is also what a healthy idle run looks like. The dispatch integration
 * test could not see it either — it passes the same root to writer and reader,
 * the one arrangement in which the two agree. Two independent symptoms pointed
 * at it: `run-continuation.jsonl` never appeared, and `run:supervise` listed a
 * session as `roadmap=-` minutes after that session had claimed.
 *
 * Why the common dir, and not "make the hook resolve the worktree":
 *
 * A roadmap claim is repo-global BY INTENT — `sessions:claim` tells the
 * operator it "becomes visible to other sessions", and the whole point is that
 * a peer in another worktree sees it. `register_dir` already puts the session
 * register in the common dir for exactly that reason, and the claim is the
 * register's other half. The alternative — teaching every concern to distrust
 * `--project-dir` — is a change to every concern rather than to one path.
 *
 * `null` when git cannot be read at all; the caller then falls back to the
 * per-tree path, which is the pre-fix behaviour rather than a new failure.
 */
export function claim_dir(workspace_root: string): string | null {
    const common = git_common_dir(workspace_root);
    return common === null ? null : path.join(common, CLAIM_DIRNAME);
}

/**
 * Absolute path this session's claim is WRITTEN to.
 *
 * Shared-dir when git resolves, per-tree otherwise. One function for both
 * halves of the contract — the writer and the reader call this, so they cannot
 * disagree about the tree again.
 */
export function claim_file(workspace_root: string, session_id: string | null | undefined): string {
    const dir = claim_dir(workspace_root);
    const rel = roadmap_claim_rel(session_id);
    if (dir === null) return path.join(workspace_root, rel);
    return path.join(dir, path.basename(rel));
}

/**
 * Every path a claim may be READ from, newest convention first.
 *
 * The per-tree paths stay readable so a claim written before this change is
 * not lost — measured at 17 such files in the main checkout on the day of the
 * fix. A read-only fallback, never a write target: writing both would recreate
 * the two-trees problem with extra steps.
 */
export function claim_read_paths(
    workspace_root: string,
    session_id: string | null | undefined,
): string[] {
    const rel = roadmap_claim_rel(session_id);
    const dir = claim_dir(workspace_root);
    const out: string[] = [];
    if (dir !== null) {
        out.push(path.join(dir, path.basename(rel)));
        if (rel !== ROADMAP_CLAIM_REL) {
            out.push(path.join(dir, path.basename(ROADMAP_CLAIM_REL)));
        }
    }
    out.push(path.join(workspace_root, rel));
    if (rel !== ROADMAP_CLAIM_REL) {
        out.push(path.join(workspace_root, ROADMAP_CLAIM_REL));
    }
    return out;
}

/** The shape `sessions:claim` writes. `session_id` is absent on legacy files. */
export interface RoadmapClaim {
    slug: string;
    written_at?: string;
    session_id?: string | null;
    /** Repo-relative paths the claiming session declared it owns. */
    paths?: string[];
}

function _read_claim_file(file: string): RoadmapClaim | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        const rec = parsed as Record<string, unknown>;
        const slug = rec['slug'];
        if (typeof slug !== 'string' || slug.trim().length === 0) {
            return null;
        }
        const sid = rec['session_id'];
        const raw_paths = rec['paths'];
        const paths = Array.isArray(raw_paths)
            ? raw_paths.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
            : [];
        return {
            slug: slug.trim(),
            ...(typeof sid === 'string' && sid.trim() !== '' ? { session_id: sid.trim() } : {}),
            ...(paths.length > 0 ? { paths } : {}),
        };
    } catch {
        return null;
    }
}

/**
 * A resolved claim plus the file it was actually read from.
 *
 * The path is not decoration. The defect this whole surface exists to prevent
 * was a WRITER and a READER resolving different trees, and the only fact that
 * falsifies it is the concrete pair of roots — a boolean asserting "worktree
 * started" is another claim by the system under observation, not a check on it
 * (AI council 2026-08-19, 2/2, on the run-continuation observation).
 */
export interface ResolvedClaim {
    slug: string;
    /** Absolute path of the claim file this read came from. */
    path: string;
    /** Repo-relative paths the claim declared, or absent when it declared none. */
    paths?: string[];
}

/**
 * The roadmap slug THIS session has claimed, and the file it came from — or
 * `null`. Never throws.
 *
 * Two reads, in order, and the second one is why a peer's claim can no longer be
 * inherited: the per-session file first, then the legacy per-worktree file —
 * and the legacy file counts only when it carries no `session_id`, or one that
 * matches. A legacy claim written by a DIFFERENT session in the same checkout is
 * that session's claim, and reading it as this session's is exactly the defect
 * that put one archived slug on four live records.
 */
export function resolve_claim(
    workspace_root: string,
    // REQUIRED, on the reviewer's point: an optional id means a caller that forgets
    // it silently gets legacy semantics instead of a type error, and there is
    // exactly one call site that matters (`build_record`). `null` stays a legal
    // value — it is the host-exports-nothing case — but it has to be passed.
    session_id: string | null,
): ResolvedClaim | null {
    const own = roadmap_claim_rel(session_id);
    if (own !== ROADMAP_CLAIM_REL) {
        // Per-session, shared dir first, then the pre-fix per-tree path. The
        // ORDER carries the migration: a session that has re-claimed since the
        // fix wins over its own stale per-tree file.
        for (const p of claim_read_paths(workspace_root, session_id)) {
            if (path.basename(p) === path.basename(ROADMAP_CLAIM_REL)) continue;
            const mine = _read_claim_file(p);
            if (mine !== null) {
                return {
                    slug: mine.slug,
                    path: p,
                    ...(mine.paths !== undefined ? { paths: mine.paths } : {}),
                };
            }
        }
    }
    // The legacy per-WORKTREE file, in the same two locations. Unchanged in
    // meaning: it is a claim on the checkout, not on a session.
    let legacy: RoadmapClaim | null = null;
    let legacy_path = '';
    for (const p of claim_read_paths(workspace_root, session_id)) {
        if (path.basename(p) !== path.basename(ROADMAP_CLAIM_REL)) continue;
        legacy = _read_claim_file(p);
        if (legacy !== null) {
            legacy_path = p;
            break;
        }
    }
    if (legacy === null) {
        return null;
    }
    const id = String(session_id ?? '').trim();
    // A session that CAN identify itself never writes the legacy path, so a legacy
    // file it did not write is either a peer's (a host with no id, in this same
    // checkout) or a claim from before this file was keyed on the session. Those
    // two are indistinguishable to a reader, and only one of them can win:
    // inheriting a peer's claim is the measured defect, while losing a
    // pre-upgrade claim costs one re-run of `sessions:claim`. So the identified
    // session declines it.
    //
    // The previous shape compared `legacy.session_id` and was unreachable —
    // `cmd_claim` serialises `session_id: null` on that path and `_read_claim_file`
    // drops a null, so the comparison never ran and every legacy claim was read as
    // "mine". R2 finding 6; the test that covered it hand-wrote a record
    // production cannot produce.
    if (id !== '') {
        return null;
    }
    return {
        slug: legacy.slug,
        path: legacy_path,
        ...(legacy.paths !== undefined ? { paths: legacy.paths } : {}),
    };
}

/**
 * The roadmap slug THIS session has claimed, or `null`. Never throws.
 *
 * Thin projection of `resolve_claim` — kept because every existing caller wants
 * the slug alone, and widening their return type to carry a path none of them
 * reads would be a signature change for no consumer.
 */
export function read_claimed_slug(
    workspace_root: string,
    session_id: string | null,
): string | null {
    return resolve_claim(workspace_root, session_id)?.slug ?? null;
}
