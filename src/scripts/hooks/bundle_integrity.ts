import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * bundle_integrity — does the dispatcher's own bundle still match what the
 * build produced?
 *
 * Step 3.1 of `road-to-a-kernel-that-guards-its-plumbing`. `dist/hooks/
 * dispatch.js` is a generated file with no legitimate hand edit, and until
 * this landed an edit to it survived until the next build, reached every
 * dispatch meanwhile, and was invisible in a source review.
 * `check_hook_bundle_content` catches that in CI and `block_plumbing_writes`
 * refuses the edit at tool-call time; neither of them is looking at the bundle
 * the process is EXECUTING at the moment it runs a blocking guard.
 *
 * Three verdicts, and the gap between two of them is the whole design:
 *
 * - `ok` — the bundle hashes to the sidecar.
 * - `mismatch` — it does not. The caller refuses on a slot carrying a blocking
 *   concern and warns otherwise.
 * - `unverifiable` — there is no sidecar, or it cannot be read or parsed.
 *
 * `unverifiable` NEVER refuses, and that is a decision rather than an
 * oversight. A consumer install from a package built before the sidecar
 * existed has no sidecar; so does any tree where `dist/` was produced by
 * something other than `npm run build:hooks`. Refusing there would convert a
 * missing optional artifact into a total outage of the agent's tooling, which
 * is the failure `hook-architecture-v1.md` already rules on one level up when
 * it fixes a MISSING dispatcher as a silent allow even for a `fail_closed`
 * concern. An absent control is not a tripped control.
 *
 * This is not a signature. Anyone who can rewrite the bundle can rewrite the
 * sidecar beside it, and saying otherwise would be the coverage inflation this
 * roadmap exists to remove. What it catches is the hand edit and the partial
 * write — the cases where somebody changed one file and not the other.
 */

/** What a verification produced. */
export type IntegrityVerdict =
    | { state: 'ok'; sha: string }
    | { state: 'mismatch'; expected: string; actual: string }
    | { state: 'unverifiable'; reason: string };

/**
 * The cheap identity of a file — what a later dispatch compares instead of
 * re-hashing 1.5 MB.
 *
 * Size AND mtime, never mtime alone: a rebuild that produces a byte-identical
 * bundle bumps mtime and would force a needless re-hash (harmless), while a
 * same-size edit at the same mtime is the one pair this cannot see. That pair
 * needs a deliberate timestamp forge, which is a strictly harder act than the
 * hand edit this defends against, and the honest statement is that the cache
 * trades that case for 0.0009 ms per dispatch against 0.470 ms.
 */
export interface BundleStamp {
    sha: string;
    size: number;
    mtimeMs: number;
}

/** Read the expected digest out of a `shasum -a 256` style sidecar. */
export function parseSidecar(text: string): string | null {
    // `<64 hex>  <filename>` — the two-space form `shasum` emits. Tolerant of
    // any run of whitespace and of a trailing newline, because an operator who
    // regenerates the file by hand should not be punished for one space.
    const m = /^([0-9a-f]{64})\s/u.exec(text.trim());
    return m === null ? null : (m[1] as string);
}

/** Where the sidecar for a given bundle lives. */
export function sidecarPathFor(bundlePath: string): string {
    return bundlePath.replace(/\.js$/u, '') + '.sha256';
}

/** SHA-256 of a file's bytes, or null when it cannot be read. */
export function hashFile(p: string): string | null {
    try {
        return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    } catch {
        return null;
    }
}

/**
 * Compare a bundle against its sidecar.
 *
 * Pure apart from the two reads, so the caller's caching and the verdict logic
 * can be tested without a dispatch.
 */
export function verifyBundle(bundlePath: string): IntegrityVerdict {
    const sidecar = sidecarPathFor(bundlePath);
    let expected: string | null;
    try {
        expected = parseSidecar(fs.readFileSync(sidecar, 'utf-8'));
    } catch {
        return { state: 'unverifiable', reason: `no sidecar at ${path.basename(sidecar)}` };
    }
    if (expected === null) {
        return { state: 'unverifiable', reason: `sidecar at ${path.basename(sidecar)} is malformed` };
    }
    const actual = hashFile(bundlePath);
    if (actual === null) {
        return { state: 'unverifiable', reason: `bundle at ${path.basename(bundlePath)} is unreadable` };
    }
    return actual === expected ? { state: 'ok', sha: actual } : { state: 'mismatch', expected, actual };
}

/** The cheap identity of the bundle right now, or null when it is not there. */
export function stampOf(bundlePath: string, sha: string): BundleStamp | null {
    try {
        const st = fs.statSync(bundlePath);
        return { sha, size: st.size, mtimeMs: Math.floor(st.mtimeMs) };
    } catch {
        return null;
    }
}

/**
 * Is a cached stamp still describing the file on disk?
 *
 * Returns false whenever the answer is not a confident yes — an unreadable
 * file re-verifies rather than reusing a stamp that may describe something
 * else.
 */
export function stampMatches(bundlePath: string, cached: BundleStamp | null | undefined): boolean {
    if (cached === null || cached === undefined) return false;
    try {
        const st = fs.statSync(bundlePath);
        return st.size === cached.size && Math.floor(st.mtimeMs) === cached.mtimeMs;
    } catch {
        return false;
    }
}

/**
 * Where the once-per-bundle stamp is cached.
 *
 * The step wrote "caches `{sha, size, mtime}` in session state"; this uses the
 * OS temp dir instead, and the deviation is deliberate. Session state under
 * `agents/runtime/state/` is not written in replay mode — which is the mode
 * `bench_hook_latency` runs in — so a session-state cache would be skipped in
 * exactly the harness that has to measure the cached path, and the step's own
 * verify line asks for `bench_hook_latency --gate` green with a per-dispatch
 * cost of a stat call. It also means a host that never emits `session_start`
 * would get no cache and no check at all.
 *
 * A temp-dir cache is content-addressed by the bundle's own path, so it needs
 * no session identity, self-heals on the first dispatch of any session, works
 * in a consumer install, and degrades to "verify every time" when the temp dir
 * is unwritable — slower, never wrong.
 */
export function stampCachePath(bundlePath: string, tmpDir: string): string {
    const key = createHash('sha256').update(bundlePath).digest('hex').slice(0, 16);
    return path.join(tmpDir, `agent-config-bundle-integrity-${key}.json`);
}

/** Read a cached stamp, or null when there is not a usable one. */
export function readStamp(cachePath: string): BundleStamp | null {
    try {
        const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as Partial<BundleStamp>;
        if (
            typeof raw.sha === 'string' &&
            typeof raw.size === 'number' &&
            typeof raw.mtimeMs === 'number'
        ) {
            return { sha: raw.sha, size: raw.size, mtimeMs: raw.mtimeMs };
        }
    } catch {
        // Absent, unreadable or malformed — all three mean "no cache", which
        // costs a re-verification and never a wrong answer.
    }
    return null;
}

/** Persist a stamp. Failure is silent: a cache that cannot be written is a cache miss. */
export function writeStamp(cachePath: string, stamp: BundleStamp): void {
    try {
        fs.writeFileSync(cachePath, JSON.stringify(stamp), 'utf-8');
    } catch {
        /* a cache is an optimisation, never a control */
    }
}

/**
 * The whole check, cache included — hash once per bundle identity, stat after.
 *
 * Returns the verdict plus whether this call had to do the expensive part, so
 * a caller (and a test) can assert the cache actually caches rather than
 * trusting that it does.
 */
export function verifyBundleCached(
    bundlePath: string,
    tmpDir: string,
): { verdict: IntegrityVerdict; hashed: boolean } {
    const cachePath = stampCachePath(bundlePath, tmpDir);
    const cached = readStamp(cachePath);
    if (stampMatches(bundlePath, cached) && cached !== null) {
        return { verdict: { state: 'ok', sha: cached.sha }, hashed: false };
    }
    const verdict = verifyBundle(bundlePath);
    if (verdict.state === 'ok') {
        const stamp = stampOf(bundlePath, verdict.sha);
        if (stamp !== null) writeStamp(cachePath, stamp);
    }
    // A `mismatch` is deliberately NOT cached. Caching it would be caching a
    // refusal, and the next legitimate rebuild has to be able to clear it
    // without anyone knowing a cache existed.
    return { verdict, hashed: true };
}
