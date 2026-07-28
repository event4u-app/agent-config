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
