/**
 * Read a prefix-stable surface set out of a git ref, into a scratch tree.
 *
 * WHY THIS EXISTS
 * ---------------
 * `road-to-delivery-for-every-host` 4.4 replaces a STORED standing-payload
 * ceiling with a MEASURED one: `max(design_ceiling, payload_at_base_ref)`. An
 * AI council (2/2, 2026-09-10) converged on that formula and on the reason — a
 * stored ceiling stays where it was put until a human lowers it, so payload a
 * merge removed can be added straight back into the space it freed. A measured
 * ceiling captures every merged reduction automatically.
 *
 * To measure the base ref, the base tree has to exist somewhere. This module is
 * that step and nothing else: it materialises the declared prefix-stable roots
 * at a ref and hands back a directory. What to measure, and what to do with the
 * number, belong to the caller.
 *
 * WHY NOT `git archive`, WHICH IS THE OBVIOUS TOOL
 * ------------------------------------------------
 * Because it silently drops declared surfaces. `git archive` honours
 * `export-ignore`, and `.gitattributes` in this repository marks `/CLAUDE.md`
 * export-ignore so release tarballs stay clean. `CLAUDE.md` is ALSO a declared
 * prefix-stable surface worth 746 tok. Measured while building this module:
 * `git archive HEAD -- CLAUDE.md | tar -t` emits **zero entries and exits 0**,
 * so an archive-based base reading came back at 137,667 against a direct
 * reading of 138,413 — 746 tok light, on a tree nobody had changed. A light
 * base reading is a TIGHT ceiling, so every pull request would have reddened by
 * 746 tokens it did not add.
 *
 * That is a packaging concern leaking into a measurement, and the two must not
 * share a switch. `git ls-tree` + `git cat-file` read the object graph directly
 * and have no notion of `export-ignore`, so the surface set measured here is
 * the surface set the registry declares — which is the only definition this
 * gate may use.
 *
 * SYMLINKED SURFACES ARE CLOSED OVER
 * -----------------------------------
 * `CLAUDE.md` is a git symlink (mode 120000) to `AGENTS.md`, which is not
 * itself a declared surface. Materialising only the declared roots would leave
 * a dangling link, which the census reads as an absent file — the same silent
 * 746-token shortfall by a second route. Link targets are resolved at the git
 * layer (a 120000 blob's content IS its target) and materialised alongside, to
 * a fixpoint.
 *
 * FAILURE IS A VALUE, NEVER AN EXCEPTION AND NEVER A ZERO
 * -------------------------------------------------------
 * Every failure path returns `tree: null` with a stated reason. A census over a
 * tree that could not be built returns a small number rather than an error, and
 * a small base reading is a tight ceiling — the direction that reds honest
 * work. The caller decides whether an unreadable base skips or refuses; this
 * module refuses to guess on its behalf.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { prefixStableRoots } from './prefix_stable_surfaces.js';

/** Injection seam: run git, capture stdout as a buffer plus the exit status. */
export type GitBufferRunner = (
    args: readonly string[],
    cwd: string,
    stdin?: string,
) => { ok: boolean; stdout: Buffer };

export const realGitBuffer: GitBufferRunner = (args, cwd, stdin) => {
    const r = spawnSync('git', [...args], {
        cwd,
        maxBuffer: 512 * 1024 * 1024,
        ...(stdin === undefined ? {} : { input: stdin }),
    });
    return { ok: r.status === 0, stdout: r.stdout ?? Buffer.alloc(0) };
};

interface TreeEntry {
    mode: string;
    sha: string;
    /** Repo-relative path. */
    rel: string;
}

export interface TreeAtRef {
    /** Absolute path of the scratch tree, or `null` when it could not be built. */
    tree: string | null;
    /** Why it could not be built. `null` on success. */
    note: string | null;
    /** Repo-relative paths materialised. Empty on failure. */
    files: string[];
    /** Call when done. Safe to call on a failed reading. */
    dispose: () => void;
}

/** How deep a chain of symlinked surfaces is followed before it is left alone. */
const MAX_LINK_DEPTH = 4;

function normalise(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

/**
 * Every blob under the given paths at `ref`.
 *
 * `-z` because a path may contain a character `git` would otherwise quote, and
 * a quoted path silently names a file that does not exist.
 */
function listTree(git: GitBufferRunner, repoRoot: string, ref: string, paths: readonly string[]): TreeEntry[] | null {
    const r = git(['ls-tree', '-r', '-z', '--full-tree', ref, '--', ...paths], repoRoot);
    if (!r.ok) return null;
    const out: TreeEntry[] = [];
    for (const record of r.stdout.toString('utf-8').split('\0')) {
        if (record === '') continue;
        // `<mode> <type> <sha>\t<path>`
        const tab = record.indexOf('\t');
        if (tab === -1) continue;
        const meta = record.slice(0, tab).split(' ');
        const mode = meta[0];
        const sha = meta[2];
        if (mode === undefined || sha === undefined) continue;
        out.push({ mode, sha, rel: normalise(record.slice(tab + 1)) });
    }
    return out;
}

/**
 * Blob contents for a list of entries, in one `git cat-file --batch` call.
 *
 * One request line per ENTRY rather than per distinct sha: two files with
 * identical content share a sha, and de-duplicating would misalign responses
 * against entries for no measurable gain at this size (728 blobs).
 */
function readBlobs(git: GitBufferRunner, repoRoot: string, entries: readonly TreeEntry[]): Buffer[] | null {
    if (entries.length === 0) return [];
    const r = git(['cat-file', '--batch'], repoRoot, entries.map((e) => e.sha).join('\n') + '\n');
    if (!r.ok) return null;
    const buf = r.stdout;
    const out: Buffer[] = [];
    let at = 0;
    for (let i = 0; i < entries.length; i += 1) {
        const nl = buf.indexOf(0x0a, at);
        if (nl === -1) return null;
        // `<sha> <type> <size>` — a missing object answers `<name> missing`.
        const header = buf.subarray(at, nl).toString('utf-8').split(' ');
        const size = Number(header[2]);
        if (!Number.isFinite(size)) return null;
        const start = nl + 1;
        out.push(buf.subarray(start, start + size));
        // Each payload is followed by a single trailing newline.
        at = start + size + 1;
    }
    return out;
}

/**
 * Materialise the declared prefix-stable roots at `ref` into a scratch tree.
 *
 * `roots` defaults to the canonical registry rather than a literal list here:
 * `prefix_stable_surfaces.ts` is the one place that boundary is declared, and a
 * second copy is the drift shape this repository has already paid for.
 */
export function extractSurfacesAtRef(opts: {
    repoRoot: string;
    ref: string;
    roots?: readonly string[];
    git?: GitBufferRunner;
}): TreeAtRef {
    const git = opts.git ?? realGitBuffer;
    const declared = (opts.roots ?? prefixStableRoots()).map(normalise).filter((r) => r !== '');
    const noop = (): void => undefined;
    if (declared.length === 0) {
        return {
            tree: null,
            files: [],
            note: 'no prefix-stable roots are declared, so there is nothing to read at the base ref',
            dispose: noop,
        };
    }

    const entries = listTree(git, opts.repoRoot, ref(opts.ref), declared);
    if (entries === null) {
        return {
            tree: null,
            files: [],
            note: `'${opts.ref}' could not be read as a tree here — the ref is unreachable in this checkout`,
            dispose: noop,
        };
    }
    if (entries.length === 0) {
        return {
            tree: null,
            files: [],
            note:
                `no declared prefix-stable root exists at ${opts.ref} — ` +
                'the surfaces moved, or the ref predates them',
            dispose: noop,
        };
    }

    // Close over symlinked surfaces: a dangling link measures as an absent file.
    const seen = new Set(entries.map((e) => e.rel));
    let frontier = entries.filter((e) => e.mode === '120000');
    for (let depth = 0; depth < MAX_LINK_DEPTH && frontier.length > 0; depth += 1) {
        const blobs = readBlobs(git, opts.repoRoot, frontier);
        if (blobs === null) break;
        const wanted: string[] = [];
        frontier.forEach((e, i) => {
            const target = (blobs[i] ?? Buffer.alloc(0)).toString('utf-8').trim();
            if (target === '' || path.isAbsolute(target)) return;
            const resolved = normalise(path.posix.join(path.posix.dirname(e.rel), target));
            if (resolved.startsWith('..') || seen.has(resolved)) return;
            wanted.push(resolved);
        });
        if (wanted.length === 0) break;
        const extra = listTree(git, opts.repoRoot, ref(opts.ref), wanted);
        if (extra === null || extra.length === 0) break;
        const fresh = extra.filter((e) => !seen.has(e.rel));
        for (const e of fresh) {
            seen.add(e.rel);
            entries.push(e);
        }
        frontier = fresh.filter((e) => e.mode === '120000');
    }

    const blobs = readBlobs(git, opts.repoRoot, entries);
    if (blobs === null) {
        return {
            tree: null,
            files: [],
            note: `the blobs at ${opts.ref} could not be read back — git cat-file returned an unusable stream`,
            dispose: noop,
        };
    }

    let tmp: string;
    try {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-at-ref-'));
    } catch (err) {
        return {
            tree: null,
            files: [],
            note: `a scratch directory could not be created: ${(err as Error).message}`,
            dispose: noop,
        };
    }
    const dispose = (): void => {
        fs.rmSync(tmp, { recursive: true, force: true });
    };

    try {
        entries.forEach((e, i) => {
            const dest = path.join(tmp, e.rel);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            const body = blobs[i] ?? Buffer.alloc(0);
            if (e.mode === '120000') {
                // Written as a real symlink so the census resolves it exactly as
                // it does in the working tree — the target is materialised too.
                fs.symlinkSync(body.toString('utf-8').trim(), dest);
            } else {
                fs.writeFileSync(dest, body);
            }
        });
    } catch (err) {
        dispose();
        return {
            tree: null,
            files: [],
            note: `writing the scratch tree for ${opts.ref} failed: ${(err as Error).message}`,
            dispose: noop,
        };
    }

    return { tree: tmp, files: entries.map((e) => e.rel), note: null, dispose };
}

/** `git ls-tree` needs a tree-ish; `<ref>` alone is one, but guard the empty case. */
function ref(r: string): string {
    return r.trim();
}

export interface PayloadAtRef {
    ref: string;
    /** Total tokens at the ref, or `null` when the tree could not be read. */
    tokens: number | null;
    note: string | null;
}

/**
 * Measure the payload at `ref` with the caller's own census.
 *
 * The census is injected rather than imported so this module carries none of
 * the gate's measurement code, and so a test can prove the materialisation
 * independently of what is counted. The CALLER passing its own census is also
 * what makes base and head the same measurement — the property that keeps a
 * measured ceiling from drifting against the number it bounds.
 */
export function measurePayloadAtRef(opts: {
    repoRoot: string;
    ref: string;
    measure: (treeRoot: string) => number;
    git?: GitBufferRunner;
}): PayloadAtRef {
    if (opts.ref.trim() === '') {
        return { ref: opts.ref, tokens: null, note: 'no base ref was resolved, so there is no tree to measure' };
    }
    const gitOpt = opts.git === undefined ? {} : { git: opts.git };
    const t = extractSurfacesAtRef({ repoRoot: opts.repoRoot, ref: opts.ref, ...gitOpt });
    if (t.tree === null) return { ref: opts.ref, tokens: null, note: t.note };
    try {
        return { ref: opts.ref, tokens: opts.measure(t.tree), note: null };
    } catch (err) {
        return { ref: opts.ref, tokens: null, note: `the census failed on the base tree: ${(err as Error).message}` };
    } finally {
        t.dispose();
    }
}
