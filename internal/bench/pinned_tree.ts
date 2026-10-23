/**
 * The tree a bench measures, bound to one commit.
 *
 * A bench whose corpus answers come from the working tree and whose result rows
 * record only `HEAD` pins nothing: an uncommitted file changes the answer and the
 * pin still names a commit that never held it. The tier bench did exactly that —
 * its answer `461` for `count-ts-src/scripts/_lib` was right at no commit it named.
 *
 * So every bench run resolves ONE tree first and derives everything from it:
 *
 *   - a clean working tree is that tree, pinned at `HEAD`;
 *   - a dirty working tree is refused, unless the run is pointed at an archive;
 *   - an archive is `git archive <commit>` extracted to a directory, carrying a
 *     `.bench-pin` marker with the full commit, so the bytes and the pin cannot
 *     come apart afterwards.
 *
 * `git archive` drops `export-ignore` paths (`agents/`, `tests/`, ...). A bench
 * whose corpus reads those paths must name them in `required`, so an archive that
 * silently lacks them is refused rather than measured as empty.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const PIN_MARKER = '.bench-pin';

export interface BenchTree {
    /** Directory the corpus is computed from and the measured legs are pointed at. */
    root: string;
    /** Full commit SHA whose bytes `root` holds. */
    commit: string;
    source: 'working-tree' | 'archive';
}

export class BenchTreeError extends Error {}

function git(cwd: string, args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new BenchTreeError(`git ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
    return r.stdout;
}

function assertRequired(root: string, required: readonly string[]): void {
    const missing = required.filter((p) => !fs.existsSync(path.join(root, p)));
    if (missing.length > 0) throw new BenchTreeError(`tree at ${root} lacks required paths: ${missing.join(', ')}`);
}

/** Extract `git archive <ref>` of `repo` into `dest` (created) and stamp the marker. */
export function archiveCommit(repo: string, ref: string, dest: string): BenchTree {
    const commit = git(repo, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
    fs.mkdirSync(dest, { recursive: true });
    if (fs.readdirSync(dest).length > 0) throw new BenchTreeError(`archive destination ${dest} is not empty`);
    const tar = spawnSync('sh', ['-c', `git -C "$1" archive --format=tar "$2" | tar -x -C "$3"`, 'sh', repo, commit, dest], {
        encoding: 'utf8',
    });
    if (tar.status !== 0) throw new BenchTreeError(`git archive ${commit} failed: ${(tar.stderr || '').trim()}`);
    fs.writeFileSync(path.join(dest, PIN_MARKER), `${commit}\n`);
    return { root: dest, commit, source: 'archive' };
}

/** Read a directory produced by `archiveCommit`; anything without the marker is refused. */
export function openArchive(dir: string): BenchTree {
    const marker = path.join(dir, PIN_MARKER);
    if (!fs.existsSync(marker)) throw new BenchTreeError(`${dir} is not a pinned archive (no ${PIN_MARKER})`);
    const commit = fs.readFileSync(marker, 'utf8').trim();
    if (!/^[0-9a-f]{40}$/.test(commit)) throw new BenchTreeError(`${marker} does not hold a full commit SHA`);
    return { root: dir, commit, source: 'archive' };
}

export interface ResolveOptions {
    /** The repository the bench lives in. */
    repo: string;
    /** A commit to archive into a fresh scratch directory and measure. */
    pin?: string;
    /** A directory already produced by `archiveCommit`. */
    archive?: string;
    /** Paths the corpus reads; an archive without one of them is refused. */
    required?: readonly string[];
}

export function resolveBenchTree(opts: ResolveOptions): BenchTree {
    const required = opts.required ?? [];
    let tree: BenchTree;
    if (opts.archive) {
        tree = openArchive(opts.archive);
    } else if (opts.pin) {
        tree = archiveCommit(opts.repo, opts.pin, fs.mkdtempSync(path.join(os.tmpdir(), 'bench-pin-')));
    } else {
        const dirty = git(opts.repo, ['status', '--porcelain']);
        if (dirty.trim() !== '') {
            throw new BenchTreeError(
                'the working tree is dirty; commit, or point the bench at an archive of a named commit (--pin <commit> or --archive <dir>)',
            );
        }
        tree = { root: opts.repo, commit: git(opts.repo, ['rev-parse', 'HEAD']).trim(), source: 'working-tree' };
    }
    assertRequired(tree.root, required);
    return tree;
}

export interface CorpusEntry {
    id: string;
    answer: string;
}

/**
 * Self-test: the committed corpus must equal the corpus recomputed from the
 * pinned tree, and every result row must name that tree's commit. Returns the
 * disagreements; empty means the evidence is bound to the bytes it pins.
 */
export function benchSelfTest(
    corpus: { commit: string; slices: readonly CorpusEntry[] },
    recomputed: readonly CorpusEntry[],
    rows: readonly { slice_id: string; commit?: string }[],
    tree: BenchTree,
): string[] {
    const problems: string[] = [];
    if (corpus.commit !== tree.commit) problems.push(`corpus pinned at ${corpus.commit}, tree is ${tree.commit}`);
    const want = new Map(recomputed.map((s) => [s.id, s.answer]));
    for (const s of corpus.slices) {
        const truth = want.get(s.id);
        if (truth === undefined) problems.push(`slice ${s.id} does not exist at ${tree.commit}`);
        else if (truth !== s.answer) problems.push(`slice ${s.id}: corpus answer ${s.answer}, ${truth} at ${tree.commit}`);
    }
    for (const r of rows) {
        if (r.commit !== tree.commit) problems.push(`row ${r.slice_id} pinned at ${r.commit ?? '(none)'}, tree is ${tree.commit}`);
    }
    return problems;
}

/**
 * The measured leg's own final answer: the text of the last assistant message in
 * its transcript. Never the dispatching session's reply, which may paraphrase,
 * correct or invent it.
 */
export function lastAssistantText(transcriptJsonl: string): string | null {
    let last: string | null = null;
    for (const line of transcriptJsonl.split('\n')) {
        if (!line.includes('"assistant"')) continue;
        let rec: { type?: string; message?: { content?: unknown } };
        try {
            rec = JSON.parse(line) as typeof rec;
        } catch {
            continue;
        }
        if (rec.type !== 'assistant' || !Array.isArray(rec.message?.content)) continue;
        const text = (rec.message.content as { type?: string; text?: string }[])
            .filter((b) => b.type === 'text' && typeof b.text === 'string')
            .map((b) => b.text)
            .join('');
        if (text.trim() !== '') last = text;
    }
    return last;
}
