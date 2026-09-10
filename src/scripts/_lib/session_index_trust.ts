/**
 * The trust contract for the session-start memory index.
 *
 * WHY THIS EXISTS, AND WHOSE RULING IT IMPLEMENTS.
 *
 * The `memory.session_index` block injects curated memory at `session_start`.
 * Restored memory is UNTRUSTED CONTEXT arriving on an injection surface, and an
 * AI council (2026-09-07, ruling D3, recorded in
 * `road-to-continuity-writer-activation` step 3.1) required six properties —
 * repository and worktree identity, path canonicalization, freshness, ordering,
 * duplicate invocation and size limits — each with a test, BEFORE the restore
 * moves off the `hot-context` concern. Five of the six did not exist: measured
 * at HEAD, `session_memory_index.ts` implemented size limits only. This module
 * is those six in one place, so the relocation has something to move.
 *
 * THE THREAT, STATED CONCRETELY RATHER THAN AS A CATEGORY.
 *
 * `MEMORY_ROOT` in `memory_lookup.ts` is the RELATIVE path `agents/memory`, so
 * it resolves against the process cwd. The hook therefore chdirs to a workspace
 * root it received from a host payload and reads memory from wherever that
 * landed. Nothing checked that the root was the workspace the session belongs
 * to, nothing resolved symlinks before trusting it, and nothing stopped a second
 * `session_start` in one session from injecting the block twice. So the
 * attacker this module answers is not an intruder: it is a wrong or stale root —
 * a sibling checkout, a worktree pointed at another tree, a leftover directory,
 * a symlink out of the workspace — serving another repository's curated memory
 * into this session as though it were this repository's.
 *
 * WHAT IT DOES NOT CLAIM.
 *
 * It does not authenticate the memory's CONTENT. A curated entry that is wrong,
 * or hostile, and sits at the correct path inside the correct workspace passes
 * every property here — that is the review boundary of `agents/memory/`, not a
 * check's. Nor does it make the index trustworthy in the sense that a model may
 * act on it: the block stays spotlighted as DATA, per `untrusted-input-defense`,
 * and this module bounds only WHICH bytes reach that block.
 *
 * loss_class: recoverable-lossy
 * loss_recovery: agents/memory/ — every row the P6 cap drops is a projection of
 * a curated entry that stays on disk untouched and stays addressable by id
 * through `agent-config memory:lookup` / `memory:get`.
 *
 * The cap bounds what the index ADVERTISES, never what the corpus holds, which
 * is why this is not `ephemeral-lossy`: nothing is destroyed, and the drop is a
 * cost bound rather than a privacy one. The retired `hot_context_hook` went the
 * other way for exactly that reason — storing a recovery for a line dropped for
 * privacy would have defeated the reason it was dropped. Nothing here is
 * dropped for privacy.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** P6 — the row cap. Owned here so all six properties read from one place. */
export const SESSION_INDEX_ROW_CAP = 30;

/**
 * P3 — the abandonment bound, in days.
 *
 * A STATED DEFAULT, NOT A MEASURED OPTIMUM, said plainly because a number that
 * looks derived and is not is worse than an admitted guess. Curated memory is
 * deliberately long-lived — a stable `product-rules.yml` is not stale at 90
 * days — so the bound is set well beyond any legitimate quiet period and exists
 * to catch an ABANDONED root, not an inactive one. The two conditions that
 * would falsify it are recorded in `road-to-continuity-writer-activation`
 * step 3.1 rather than here.
 */
export const MAX_ROOT_AGE_DAYS = 400;

/**
 * P3's other direction — how far ahead of now a source mtime may sit.
 *
 * A STATED DEFAULT, on the same terms as `MAX_ROOT_AGE_DAYS` above, and written
 * down because a 14.23.0 self-review finding named it as the one threshold in
 * this module carrying no threat model while its neighbour carried one. That
 * asymmetry was the real defect; the number was not.
 *
 * What the grace is FOR: ordinary clock disagreement. An NTP correction, a
 * resumed VM snapshot, or a filesystem whose mtime comes from a host with a
 * slightly different clock can date a file a few seconds ahead of this process
 * without anything being wrong. Zero grace would refuse those, and a refusal
 * there costs the session its memory index for a reason the operator cannot act
 * on.
 *
 * What it is NOT for, stated because the finding read it as an attack window:
 * it buys an attacker nothing. Writing a curated source requires write access
 * INSIDE the workspace, and an attacker holding that can date the file at `now`
 * and pass P3 outright — a future date is strictly worse for them. Freshness
 * here bounds an ABANDONED root, not a hostile one; the module's own docblock
 * says content authenticity is out of scope and that boundary is unchanged.
 *
 * The grace is only harmless while that reading holds. If this check is ever
 * repurposed as a content-integrity control, or a measured population of
 * legitimate skew exceeds the value, the number has to be derived rather than
 * stated.
 */
export const MAX_FUTURE_SKEW_MS = 60_000;

/**
 * Curated sources, matching the layouts `memory_lookup._iter_curated_entries`
 * actually reads: `<root>/<type>.yml` AND `<root>/<type>/**\/*.yml`, plus the
 * agent-written `intake/*.jsonl`. Reading only the first of those is what made
 * P3 silently no-op on two of the three layouts — R2 finding 4.
 */
const CURATED_SUFFIXES = ['.yml', '.yaml', '.jsonl'] as const;

/** Depth bound on the walk. A memory root is shallow; a cycle is not. */
const MAX_WALK_DEPTH = 8;

export type TrustRefusalCode =
    | 'workspace-root-unresolvable'
    | 'memory-root-absent'
    | 'memory-root-escapes-workspace'
    | 'curated-source-escapes-workspace'
    | 'source-mtime-in-future'
    | 'memory-root-abandoned'
    | 'already-injected-this-session';

export interface TrustRefusal {
    readonly ok: false;
    readonly code: TrustRefusalCode;
    readonly detail: string;
}

export interface TrustGrant {
    readonly ok: true;
    /** Canonical, containment-checked absolute path to the memory root. */
    readonly memoryRoot: string;
    /** Canonical absolute path to the workspace the root was checked against. */
    readonly workspaceRoot: string;
    /** P3 — mtime of the newest curated source read, epoch ms; 0 when none. */
    readonly newestSourceMs: number;
}

export type TrustVerdict = TrustGrant | TrustRefusal;

function refuse(code: TrustRefusalCode, detail: string): TrustRefusal {
    return { ok: false, code, detail };
}

/**
 * P2 — canonicalize, then compare by SEGMENTS.
 *
 * A string prefix test says `/a/bc` is inside `/a/b`, which is how a
 * containment check passes something it should refuse. Splitting on the
 * separator makes the comparison mean what it says.
 */
export function isContained(child: string, parent: string): boolean {
    const rel = path.relative(parent, child);
    if (rel === '') return true;
    if (path.isAbsolute(rel)) return false;
    return !rel.split(path.sep).includes('..');
}

/** Canonicalize a path, following symlinks. `null` when it does not resolve. */
export function canonical(p: string): string | null {
    try {
        return fs.realpathSync(p);
    } catch {
        return null;
    }
}

export interface SourceWalk {
    /** Newest mtime across every curated source read, epoch ms; 0 when none. */
    readonly newestMs: number;
    /** Sources whose canonical path lies outside the workspace. P1's other half. */
    readonly escaped: readonly string[];
    /** How many sources the walk actually read — 0 means "nothing to judge". */
    readonly count: number;
}

/**
 * One recursive walk serving P1's file half and P3's reading, because R2 found
 * both defects in the same omission: the previous version read only `*.yml`
 * directly at the root, which is one of the three layouts
 * `memory_lookup._iter_curated_entries` supports. So freshness silently
 * no-opped on a type-directory corpus (a 3-year-old one was served past the
 * 400-day bound), and containment was never checked below the root at all.
 *
 * The containment half is the sharper of the two. Canonicalizing the ROOT does
 * not stop a symlinked FILE inside it from resolving into another tree, and
 * that is the exact threat this module's docblock names — proven by the
 * reviewer, who read a donor workspace's entry out of a victim session.
 *
 * Per-entry timestamps do not exist (a curated entry is `{id, key, body}`), so
 * freshness stays a property of the source files rather than something invented
 * per row.
 */
export function walkCuratedSources(memoryRoot: string, workspaceRoot: string): SourceWalk {
    let newestMs = 0;
    let count = 0;
    const escaped: string[] = [];

    const visit = (dir: string, depth: number): void => {
        if (depth > MAX_WALK_DEPTH) return;
        let names: fs.Dirent[];
        try {
            names = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of names) {
            const full = path.join(dir, ent.name);
            // `withFileTypes` reports a symlink as a symlink, so a directory
            // reached through one is followed only after it canonicalizes
            // inside the workspace — which is the containment check itself.
            const resolved = canonical(full);
            if (resolved === null) continue;
            if (!isContained(resolved, workspaceRoot)) {
                escaped.push(full);
                continue;
            }
            let st: fs.Stats;
            try {
                st = fs.statSync(resolved);
            } catch {
                continue;
            }
            if (st.isDirectory()) {
                visit(resolved, depth + 1);
                continue;
            }
            if (!CURATED_SUFFIXES.some((sfx) => ent.name.endsWith(sfx))) continue;
            count += 1;
            if (st.mtimeMs > newestMs) newestMs = st.mtimeMs;
        }
    };

    visit(memoryRoot, 0);
    return { newestMs, escaped, count };
}

export interface TrustInput {
    /** The workspace root the session belongs to, as the host reported it. */
    readonly workspaceRoot: string;
    /** Relative memory root, matching `memory_lookup.MEMORY_ROOT`. */
    readonly relativeMemoryRoot?: string;
    /** Injected for tests; defaults to now. */
    readonly now?: Date;
}

/**
 * P1 + P2 + P3 — decide whether a memory root may be read at all.
 *
 * Ordered cheapest-first, and each refusal names itself: a caller that logs the
 * code can tell "this workspace has no memory" from "this root pointed
 * somewhere else", which is the distinction the whole module exists for.
 */
export function verifyMemoryRoot(input: TrustInput): TrustVerdict {
    const now = input.now ?? new Date();
    const rel = input.relativeMemoryRoot ?? path.join('agents', 'memory');

    // P2 — the workspace root is canonicalized FIRST. Everything downstream
    // compares against the resolved form, never the reported one.
    const workspaceRoot = canonical(input.workspaceRoot);
    if (workspaceRoot === null) {
        return refuse('workspace-root-unresolvable', `workspace root does not resolve: ${input.workspaceRoot}`);
    }

    // P1 — identity, checked LEXICALLY first and on the canonical path second.
    // The order is load-bearing and a test found it: a `..` root whose target
    // does not exist would otherwise be reported as merely absent, which reads
    // as "this workspace has no memory" when the truth is "this root pointed
    // outside the tree". The escape is the more important fact, so it is the
    // one reported, whether or not the target happens to exist.
    const lexical = path.resolve(workspaceRoot, rel);
    if (!isContained(lexical, workspaceRoot)) {
        return refuse(
            'memory-root-escapes-workspace',
            `${lexical} is not inside ${workspaceRoot} — refusing to serve another tree's memory`,
        );
    }

    const memoryRoot = canonical(lexical);
    if (memoryRoot === null) {
        return refuse('memory-root-absent', `no memory root at ${path.join(input.workspaceRoot, rel)}`);
    }

    // The second half of P1, and the half a lexical check cannot see: the path
    // is inside the tree and the SYMLINK it resolves through is not.
    if (!isContained(memoryRoot, workspaceRoot)) {
        return refuse(
            'memory-root-escapes-workspace',
            `${memoryRoot} is not inside ${workspaceRoot} — refusing to serve another tree's memory`,
        );
    }

    // P1's file half + P3, from one walk. R2 findings 3 and 4.
    const walk = walkCuratedSources(memoryRoot, workspaceRoot);
    if (walk.escaped.length > 0) {
        return refuse(
            'curated-source-escapes-workspace',
            `${walk.escaped.length} curated source(s) resolve outside ${workspaceRoot}, first ${walk.escaped[0]} — refusing to serve another tree's memory`,
        );
    }

    // P3 — freshness, in the two directions it can fail.
    const newestSourceMs = walk.newestMs;
    if (newestSourceMs > now.getTime() + MAX_FUTURE_SKEW_MS) {
        return refuse(
            'source-mtime-in-future',
            `newest curated source is dated in the future (${new Date(newestSourceMs).toISOString()}) — clock skew or tampering`,
        );
    }
    if (newestSourceMs > 0) {
        const ageDays = (now.getTime() - newestSourceMs) / 86_400_000;
        if (ageDays > MAX_ROOT_AGE_DAYS) {
            return refuse(
                'memory-root-abandoned',
                `newest curated source is ${ageDays.toFixed(0)}d old, past the ${MAX_ROOT_AGE_DAYS}d abandonment bound`,
            );
        }
    }

    return { ok: true, memoryRoot, workspaceRoot, newestSourceMs };
}

export interface OrderableRow {
    readonly id: string;
    readonly title: string;
    readonly tokens_estimate: number;
}

/**
 * P4 — the declared total order.
 *
 * Ordering is a trust property because the CAP truncates: without a declared
 * order, which 30 of 200 entries reach the model is whatever the filesystem
 * happened to yield, and two runs over the same tree can advertise different
 * corpora. Cheapest row first (`tokens_estimate` ascending) so a fixed cap
 * carries the most entries it can, with `id` ascending as the tie-break that
 * makes the order TOTAL rather than merely defined — a comparator with ties is
 * not deterministic under an unstable sort.
 */
export function orderRows<T extends OrderableRow>(rows: readonly T[]): T[] {
    return [...rows].sort((a, b) => {
        if (a.tokens_estimate !== b.tokens_estimate) return a.tokens_estimate - b.tokens_estimate;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/** P6 — apply the cap after ordering, never before. */
export function capRows<T>(rows: readonly T[], cap: number = SESSION_INDEX_ROW_CAP): T[] {
    const limit = Number.isFinite(cap) && cap > 0 ? Math.min(cap, SESSION_INDEX_ROW_CAP) : SESSION_INDEX_ROW_CAP;
    return rows.slice(0, limit);
}

/** Where the P5 latch lives. Gitignored runtime state, one file per session. */
export function latchPath(workspaceRoot: string, sessionId: string): string {
    const safe = sessionId.replace(/[^A-Za-z0-9._-]/gu, '_').slice(0, 128);
    return path.join(workspaceRoot, 'agents', 'runtime', 'state', 'session-index-latch', `${safe}.json`);
}

/**
 * P5 — duplicate invocation.
 *
 * `session_start` can fire more than once for one session (a resume, a
 * host-side reconnect, a compaction boundary on some hosts). Two injections
 * double the fixed cost and can present two different corpora as the same
 * session's memory. The latch is create-exclusive (`wx`), so the FIRST caller
 * wins and every later one refuses — an ordering that matters, because
 * check-then-write would let two concurrent starts both pass.
 *
 * Fails OPEN on an unwritable state directory: a hook that cannot latch must
 * still be able to serve the index once, and refusing there would make a
 * read-only workspace lose the feature entirely. That is a deliberate trade and
 * it is the reason this property is a latch rather than a gate.
 */
export function claimSessionOnce(workspaceRoot: string, sessionId: string): TrustVerdict | { ok: true } {
    if (sessionId.length === 0) {
        // No session id to key on — cannot latch, so do not pretend to.
        return { ok: true };
    }
    const target = latchPath(workspaceRoot, sessionId);
    try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, JSON.stringify({ claimed_at: new Date().toISOString() }), { flag: 'wx' });
        return { ok: true };
    } catch (exc) {
        const code = (exc as { code?: string }).code;
        if (code === 'EEXIST') {
            return refuse('already-injected-this-session', `session ${sessionId} already received the index`);
        }
        // fail-open — see the docblock
        return { ok: true };
    }
}
