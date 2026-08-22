/**
 * Materialise one subtree of a git ref into a scratch directory, so a gate can
 * MEASURE the base side with the same function it measures HEAD with.
 *
 * WHY THIS EXISTS
 * ---------------
 * A ratchet needs a "before" number the change under review cannot rewrite. The
 * cheapest way to get one is to commit it — and that is what
 * `src/config/estate-count-budget.json` did until ADR-243. A committed number is
 * also a file every branch edits, which made it the most-conflicted non-generated
 * path in this repository: 7 of 7 `CONFLICTING` open PRs on 2026-08-21, and 39 of
 * 43 non-merge commits in a 60-day window moving it.
 *
 * The number does not have to be stored. Where the metric is a function of the
 * tree, the base ref's own tree IS the "before" side — it is committed, and the
 * change under review cannot rewrite it either. What is missing is a way to run
 * a filesystem parser over a ref without checking it out.
 *
 * WHY NOT `git archive`
 * ---------------------
 * Measured, not assumed: `git archive origin/main agents/roadmaps | tar -x`
 * produces an EMPTY archive in this repository, because `.gitattributes` carries
 * `/agents export-ignore` (line 15) and `git archive` honours it. That is correct
 * for the npm tarball it was written for and fatal here, and it fails silently —
 * an empty extraction reads as "the estate measured zero", which is the shape of
 * a floor of 0 that passes everything.
 *
 * `git ls-tree` + `git cat-file --batch` reads the object store directly and
 * ignores export-ignore entirely. Cost, measured on 703 files: 0.22 s, two
 * spawns total.
 *
 * WHY NOT `git worktree add`
 * --------------------------
 * It checks out the whole tree — 9177 files here — for a subtree of 703, and it
 * mutates `.git/worktrees`, so a crashed gate leaves administrative state behind.
 *
 * THE EMPTY CASE IS AN ERROR, NEVER A MEASUREMENT
 * -----------------------------------------------
 * `materialiseSubtree` returns the file count and callers MUST treat 0 as "the
 * base side could not be established", never as a measurement. An absent subtree,
 * a typo in the path, a ref that predates the directory and an export-ignore
 * silently eating the content are indistinguishable from each other and all
 * produce zero — and for a shrink-only gate, a floor of zero is a green light for
 * unbounded growth. This is stated here because the caller cannot see which of
 * those happened either, and the safe reading of all four is the same.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** Ceiling on the blob stream. The roadmap corpus is ~2 MB; this is headroom. */
const BATCH_MAX_BUFFER = 256 * 1024 * 1024;

export interface MaterialisedTree {
    /** Absolute path to a directory that now holds `<subtree>/...` from `ref`. */
    root: string;
    /** How many blobs were written. `0` means the base side is UNAVAILABLE. */
    files: number;
    /** Set when the read failed outright; `files` is then 0. */
    error: string | null;
}

/** One entry of `git ls-tree -r -z`: `<mode> SP <type> SP <sha> TAB <path>`. */
interface TreeEntry {
    sha: string;
    rel: string;
}

/**
 * Parse `git ls-tree -r -z` output.
 *
 * The `-z` form is used rather than `--format`, which needs git ≥ 2.36: this runs
 * on contributor machines and on runners, and a gate that fails on an older git
 * is a gate that gets turned off.
 */
function parseLsTree(stdout: string): TreeEntry[] {
    const out: TreeEntry[] = [];
    for (const record of stdout.split('\0')) {
        if (record === '') continue;
        const tab = record.indexOf('\t');
        if (tab === -1) continue;
        const meta = record.slice(0, tab).split(' ');
        const sha = meta[2];
        const type = meta[1];
        const rel = record.slice(tab + 1);
        // Blobs only. A submodule entry is a `commit` and has no content here;
        // writing its sha as a file would be a silent corruption of the measured
        // tree rather than a missing file the caller could notice.
        if (type !== 'blob' || sha === undefined || sha === '' || rel === '') continue;
        out.push({ sha, rel });
    }
    return out;
}

/**
 * Walk a `git cat-file --batch` stream, invoking `sink` per object.
 *
 * Wire format per object: `<sha> SP <type> SP <size> LF`, then exactly `size`
 * bytes, then one LF. Sizes are read from the header rather than inferred from
 * the next header, so a blob containing a line that looks like a header cannot
 * desynchronise the parse — the failure mode that makes a line-oriented reading
 * of this stream wrong.
 */
function walkBatch(buf: Buffer, sink: (sha: string, body: Buffer) => void): void {
    let pos = 0;
    while (pos < buf.length) {
        const nl = buf.indexOf('\n', pos);
        if (nl === -1) return;
        const header = buf.subarray(pos, nl).toString('utf-8');
        const parts = header.split(' ');
        if (parts.length < 3) return; // `<sha> missing` — a bad ref; stop cleanly.
        const size = Number.parseInt(parts[2] ?? '', 10);
        if (!Number.isFinite(size) || size < 0) return;
        const start = nl + 1;
        sink(parts[0] ?? '', buf.subarray(start, start + size));
        pos = start + size + 1;
    }
}

/**
 * Write `<subtree>` as it exists at `ref` into a fresh temp directory.
 *
 * The returned `root` is the caller's to remove — callers hold it in a `finally`.
 * `subtree` is a repo-relative POSIX path (`agents/roadmaps`), because that is
 * what git pathspecs take; a `path.sep`-joined value works on POSIX and silently
 * matches nothing on Windows, so callers pass the POSIX form explicitly.
 */
export function materialiseSubtree(repoRoot: string, ref: string, subtree: string): MaterialisedTree {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'base-tree-'));
    const list = spawnSync('git', ['ls-tree', '-r', '-z', ref, '--', subtree], {
        cwd: repoRoot,
        encoding: 'utf-8',
        maxBuffer: BATCH_MAX_BUFFER,
    });
    if (list.status !== 0) {
        return { root, files: 0, error: `git ls-tree ${ref} -- ${subtree} failed: ${(list.stderr ?? '').trim()}` };
    }
    const entries = parseLsTree(list.stdout ?? '');
    if (entries.length === 0) {
        return { root, files: 0, error: `${subtree} holds no blobs at ${ref}` };
    }

    const batch = spawnSync('git', ['cat-file', '--batch'], {
        cwd: repoRoot,
        input: `${entries.map((e) => e.sha).join('\n')}\n`,
        maxBuffer: BATCH_MAX_BUFFER,
    });
    if (batch.status !== 0 || batch.stdout === null) {
        return { root, files: 0, error: `git cat-file --batch failed: ${String(batch.stderr ?? '').trim()}` };
    }

    // One sha may appear under several paths (identical file content), so the
    // stream is keyed by sha and every path carrying that sha is written. Keying
    // by position would break on exactly that case, and it is not hypothetical:
    // roadmap stubs share boilerplate.
    const bySha = new Map<string, Buffer>();
    walkBatch(batch.stdout, (sha, body) => {
        if (!bySha.has(sha)) bySha.set(sha, body);
    });

    let files = 0;
    for (const entry of entries) {
        const body = bySha.get(entry.sha);
        if (body === undefined) continue;
        const dest = path.join(root, ...entry.rel.split('/'));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, body);
        files += 1;
    }
    if (files !== entries.length) {
        return { root, files: 0, error: `wrote ${String(files)} of ${String(entries.length)} blobs from ${ref}` };
    }
    return { root, files, error: null };
}
