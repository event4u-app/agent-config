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

/** Curated YAML files a memory root is expected to carry, for P3's reading. */
const CURATED_GLOB_SUFFIX = '.yml';

export type TrustRefusalCode =
    | 'workspace-root-unresolvable'
    | 'memory-root-absent'
    | 'memory-root-escapes-workspace'
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

/**
 * P3's reading — the newest mtime among the curated YAML files at the root.
 *
 * Per-entry timestamps do not exist: a curated entry is `{id, key, body}`, so
 * freshness is a property of the SOURCE FILES and is read from them rather than
 * invented per row. Returns 0 for a root with no curated file, which P3 treats
 * as "nothing to be stale about" rather than as abandonment — an empty root
 * already produces no block.
 */
export function newestCuratedMtimeMs(memoryRoot: string): number {
    let newest = 0;
    let names: string[];
    try {
        names = fs.readdirSync(memoryRoot);
    } catch {
        return 0;
    }
    for (const name of names) {
        if (!name.endsWith(CURATED_GLOB_SUFFIX)) continue;
        try {
            const st = fs.statSync(path.join(memoryRoot, name));
            if (st.mtimeMs > newest) newest = st.mtimeMs;
        } catch {
            // an unreadable member cannot make the root fresher
        }
    }
    return newest;
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

    // P3 — freshness, in the two directions it can fail.
    const newestSourceMs = newestCuratedMtimeMs(memoryRoot);
    if (newestSourceMs > now.getTime() + 60_000) {
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
