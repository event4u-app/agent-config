/**
 * Source detection + freshness. Answers "what code-graph source should a
 * query use, and is it fresh?" across three sources:
 *
 *   consumer  — a `graph.json`-shaped artifact the consumer repo ships
 *   scip      — an `index.scip` / `*.scip` (presence only; peer tooling
 *               required — an owned SCIP reader is YAGNI-gated until a
 *               consumer actually ships one)
 *   native    — the suite's own gitignored cache
 *
 * Precedence (ADR-124 § 2): a fresh consumer index wins (interop courtesy);
 * the native engine covers stale-or-absent. Freshness: `head_at_build` when
 * the artifact embeds a SHA (→ commits_behind), else artifact mtime vs the
 * repo's last commit time. No guessing.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { EXT_LANG } from './types.js';
import { validateGraph } from './validate.js';

export type SourceKind = 'consumer' | 'scip' | 'native';

export interface SourceVerdict {
    kind: SourceKind;
    path: string;
    present: boolean;
    stale?: boolean;
    commits_behind?: number;
    note?: string;
}

const CONSUMER_CANDIDATES = ['graph.json', 'code-graph.json', '.code-graph/graph.json'];

function gitLastCommitEpoch(root: string): number | null {
    try {
        const out = execFileSync('git', ['-C', root, 'log', '-1', '--format=%ct'], {
            env: hardenedSpawnEnv(),
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        const n = Number(out);
        return Number.isFinite(n) ? n : null;
    } catch {
        return null;
    }
}

function commitsBehind(root: string, sha: string): number | null {
    try {
        const out = execFileSync('git', ['-C', root, 'rev-list', '--count', `${sha}..HEAD`], {
            env: hardenedSpawnEnv(),
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        const n = Number(out);
        return Number.isFinite(n) ? n : null;
    } catch {
        return null;
    }
}

function freshness(root: string, file: string, embeddedSha: string | null): { stale?: boolean; commits_behind?: number } {
    if (embeddedSha) {
        const behind = commitsBehind(root, embeddedSha);
        if (behind !== null) return { stale: behind > 0, commits_behind: behind };
    }
    const last = gitLastCommitEpoch(root);
    if (last === null) return {};
    try {
        const mtime = Math.floor(fs.statSync(file).mtimeMs / 1000);
        return { stale: mtime < last };
    } catch {
        return {};
    }
}

/** Shape-validate a candidate consumer graph.json (native or foreign shape). */
function looksLikeGraph(p: string): { ok: boolean; sha: string | null } {
    try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
        // native shape passes validateGraph; a foreign graph.json just needs
        // nodes[] + edges|links[] with source/target/relation.
        if (validateGraph(raw).ok) return { ok: true, sha: (raw['head_at_build'] as string) ?? null };
        const nodes = raw['nodes'];
        const edges = (raw['edges'] ?? raw['links']) as unknown;
        const okShape =
            Array.isArray(nodes) &&
            Array.isArray(edges) &&
            (edges.length === 0 ||
                (typeof edges[0] === 'object' && edges[0] !== null && 'source' in (edges[0] as object) && 'target' in (edges[0] as object)));
        return { ok: okShape, sha: (raw['head_at_build'] as string) ?? null };
    } catch {
        return { ok: false, sha: null };
    }
}

export function detectSources(root: string, nativeCache: string): SourceVerdict[] {
    const abs = path.resolve(root);
    const out: SourceVerdict[] = [];

    for (const rel of CONSUMER_CANDIDATES) {
        const p = path.join(abs, rel);
        if (fs.existsSync(p)) {
            const { ok, sha } = looksLikeGraph(p);
            if (ok) out.push({ kind: 'consumer', path: p, present: true, ...freshness(abs, p, sha) });
        }
    }

    // SCIP — presence only
    const scipCandidates = [path.join(abs, 'index.scip')];
    try {
        for (const e of fs.readdirSync(abs)) if (e.endsWith('.scip')) scipCandidates.push(path.join(abs, e));
    } catch {
        /* ignore */
    }
    const scip = scipCandidates.find((p) => fs.existsSync(p));
    if (scip) out.push({ kind: 'scip', path: scip, present: true, note: 'SCIP detected — peer tooling required (no owned reader)' });

    // native cache
    if (fs.existsSync(nativeCache)) out.push({ kind: 'native', path: nativeCache, present: true, ...freshness(abs, nativeCache, null) });

    return out;
}

/** Pick the source a query should use: fresh consumer > native > stale consumer. */
export function pickSource(verdicts: SourceVerdict[]): SourceVerdict | null {
    const consumer = verdicts.find((v) => v.kind === 'consumer' && v.stale !== true);
    if (consumer) return consumer;
    const native = verdicts.find((v) => v.kind === 'native');
    if (native) return native;
    return verdicts.find((v) => v.kind === 'consumer') ?? null;
}

/** A single detected source, JSON-shaped (only defined fields are emitted —
 * key order fixed by construction so `JSON.stringify` output is stable). */
export interface DetectedSourceJSON {
    kind: SourceKind;
    path: string;
    present: boolean;
    stale?: boolean;
    commits_behind?: number;
    note?: string;
}

/** The `code-graph detect --format json` verdict shape (Phase 2). Deterministic:
 * fixed key order, no timestamps, paths relative to `root`. */
export interface VerdictJSON {
    verdict: 'ABSENT' | 'STALE' | 'FRESH';
    /** commits behind, when known from the picked source; else null. */
    behind_commits: number | null;
    /** the source `refresh`/queries would use, or null when ABSENT. */
    source: { kind: SourceKind; path: string } | null;
    /** every detected source (for diagnostics), not just the picked one. */
    sources: DetectedSourceJSON[];
}

/**
 * Three-state freshness verdict for `root`, reusing `detectSources` +
 * `pickSource` (no duplicated precedence logic). ABSENT = no usable source
 * (a bare `scip` presence or nothing at all); STALE = the picked source is
 * stale; FRESH = picked source is fresh, or freshness is unknown (mirrors the
 * nudge hook's `picked.stale ? STALE : FRESH` reading — unknown is not
 * treated as stale).
 */
export function computeVerdict(root: string, nativeCache: string): VerdictJSON {
    const abs = path.resolve(root);
    const verdicts = detectSources(root, nativeCache);
    const picked = pickSource(verdicts);
    const rel = (p: string): string => path.relative(abs, p).split(path.sep).join('/');
    const verdict: VerdictJSON['verdict'] = picked === null ? 'ABSENT' : picked.stale ? 'STALE' : 'FRESH';
    const sources: DetectedSourceJSON[] = verdicts.map((v) => {
        const s: DetectedSourceJSON = { kind: v.kind, path: rel(v.path), present: v.present };
        if (v.stale !== undefined) s.stale = v.stale;
        if (v.commits_behind !== undefined) s.commits_behind = v.commits_behind;
        if (v.note !== undefined) s.note = v.note;
        return s;
    });
    return {
        verdict,
        behind_commits: picked?.commits_behind ?? null,
        source: picked ? { kind: picked.kind, path: rel(picked.path) } : null,
        sources,
    };
}

/** Cache path a repository root's native graph lives at, repo-relative. */
export const NATIVE_CACHE_REL = path.join('agents', 'runtime', 'state', 'code-graph-v1.json');

/**
 * The four-state staleness token every consumer of the graph reports.
 *
 * `edited` is the fourth and newest (`road-to-a-graph-that-feeds-the-gate` 2.3).
 * Without it an uncommitted change to an indexed file read as `fresh` — the one
 * state that says "nothing stands between this answer and the tree" — which is
 * the reading most likely to be wrong while someone is editing.
 *
 * Lives HERE rather than in the PreToolUse hook that first needed it
 * (`hooks/code_graph_context_hook.ts`, step 1.2). Phase 3's verbs must each
 * print the staleness state, and an engine module importing a hook module to
 * learn it would invert the dependency direction D9 measures — the hook imports
 * the engine, never the other way round. The hook re-exports this so its own
 * consumers are unaffected.
 */
export type GraphState = 'absent' | 'fresh' | 'edited' | `behind:${number}`;

/**
 * The working tree carries an uncommitted change to a file the extractor would
 * index.
 *
 * WHY POINT-IN-TIME PORCELAIN AND NOT THE ARTIFACT'S MTIME. An mtime comparison
 * looks cheaper and is wrong in the one direction that matters: restoring a
 * stashed or checked-out file rewrites its mtime, so a tree put back exactly as
 * the graph saw it would read stale forever and never return to `fresh`. The
 * porcelain result describes a CONTENT difference, so a revert is visible as a
 * revert.
 *
 * "Indexed paths" is read as *paths of the kind the extractor indexes* —
 * `EXT_LANG`'s extensions — not as the node set of a loaded graph. Loading the
 * graph to answer a freshness question would mean opening the index on every
 * PreToolUse call this now runs on, which is the latency the Risk Register
 * names; the extension filter answers the same question with no read. It can
 * over-report (a `.ts` file the build excluded) and cannot under-report, and
 * over-reporting `edited` only ever makes an answer look worth less than it is.
 *
 * Untracked files count. A source file that exists only in the working tree is
 * precisely something the index cannot know about.
 *
 * `--untracked-files=all` IS LOAD-BEARING, and the default was wrong. Plain
 * porcelain COLLAPSES an untracked directory to one entry — `?? src/` — which
 * carries no extension, so the filter below skipped it and an entire new source
 * tree read as `fresh`. A completion review reproduced exactly that, and it is
 * the one direction the paragraph above promises cannot happen. The cost is
 * enumerating untracked files rather than untracked directories; `.gitignore`
 * still applies, so a vendored tree stays out of it.
 */
function hasUncommittedIndexedEdit(root: string): boolean {
    let out: string;
    try {
        out = execFileSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=all'], {
            env: hardenedSpawnEnv(),
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            // Both bounds are the review's: Node's 1 MB default would throw
            // ENOBUFS on a large working tree, the catch below would return
            // false, and the state would read `fresh` — a second silent
            // under-report on a probe that runs at PreToolUse and at every stop.
            // The timeout bounds the other failure: this probe sits in front of
            // a tool call, so a hung git must not hold one up.
            maxBuffer: 32 * 1024 * 1024,
            timeout: 5_000,
        });
    } catch {
        // Not a repository, or the probe failed: nothing is known, and an
        // unknown is reported as the state the caller already had.
        return false;
    }
    for (const raw of out.split('\n')) {
        if (raw.length < 4) continue;
        // `XY <path>`; a rename or copy is `XY <old> -> <new>`, and the NEW path
        // is the one on disk. Quotes appear under core.quotepath for non-ASCII.
        let p = raw.slice(3);
        const arrow = p.indexOf(' -> ');
        if (arrow !== -1) p = p.slice(arrow + 4);
        p = p.trim().replace(/^"|"$/g, '');
        const dot = p.lastIndexOf('.');
        if (dot === -1) continue;
        if (p.slice(dot).toLowerCase() in EXT_LANG) return true;
    }
    return false;
}

/**
 * Resolve the graph's state for `root`.
 *
 * `absent` means no source at all — the silent case. A picked source whose
 * staleness is UNKNOWN reads as `fresh`, mirroring {@link computeVerdict}'s own
 * `picked.stale ? STALE : FRESH`: unknown is not treated as stale, because
 * inventing a commit count would be worse than reporting none. A source level
 * with HEAD then reads `edited` instead of `fresh` while the working tree
 * carries an uncommitted change to an indexable file — see
 * {@link hasUncommittedIndexedEdit} for why that probe is porcelain, not mtime.
 *
 * `nativeCache` overrides where the native graph is looked for. It exists
 * because a verb invoked with an explicit `--graph <path>` would otherwise
 * report `absent` while answering from that very file — the state of a cache
 * nobody asked about. Passing the graph the verb is actually reading makes the
 * printed staleness a statement about the answer rather than about a
 * convention.
 */
export function graphState(root: string, nativeCache?: string): GraphState {
    const picked = pickSource(detectSources(root, nativeCache ?? path.join(root, NATIVE_CACHE_REL)));
    if (!picked) return 'absent';
    if (picked.stale === true) {
        const behind = picked.commits_behind;
        return `behind:${typeof behind === 'number' ? behind : 0}`;
    }
    // The commit count comes FIRST and wins: `behind:N` already says the index
    // predates committed work, and reporting `edited` instead would hide the
    // larger gap behind the smaller one. Only a graph level with HEAD has an
    // uncommitted edit as its whole remaining distance.
    return hasUncommittedIndexedEdit(root) ? 'edited' : 'fresh';
}
