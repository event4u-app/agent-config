/**
 * Delta #9 — a corpus task may name an EXTERNAL repository pinned at a SHA.
 *
 * Until this module, every v2 task resolved to a self-contained fixture tree
 * under `internal/bench/ab/`, so the harness could only measure trap tasks this
 * repository authored. Phase 3 of `road-to-solution-minimalism` asks for the
 * opposite: a public repo nobody chose for the purpose, so a size effect cannot
 * be an artefact of fixtures written by the same hand as the rule.
 *
 * ## Why a SHA and not a ref
 *
 * `sha` is a full 40-hex commit id, and a branch or tag name is REFUSED rather
 * than resolved. A ref moves, so a report pinned to one records which repository
 * answered but not which tree — and F7 of that roadmap forbids exactly that
 * class of unreproducible number. The refusal is loud (a throw) because the
 * quiet alternative, resolving the ref at run time, produces a report that looks
 * pinned and is not.
 *
 * ## Materialisation, and what needs the network
 *
 * `ensure_pinned_tree` warms a cache ONCE per SHA — `git init` + a `--depth 1`
 * fetch of that exact commit + `git archive` into a `.git`-free tree. Every
 * per-trial workspace is then a local copy of that tree, so a sweep touches the
 * network once per pinned task and never on the metered path. `is_materialised`
 * answers the warm/cold question without touching the network, which is what
 * lets `--mode selftest` and the offline complexity re-scorer report an honest
 * "not materialised locally" instead of either hanging or scoring zero.
 *
 * The tree is `.git`-free on purpose. `changed_files` already skips `.git`, so
 * carrying it would not corrupt a diff — it would just copy a repository per
 * trial, and a sweep is 5 arms x 3 seeds per task.
 *
 * ## What this module deliberately does NOT do
 *
 * No sub-directory scoping, no submodules, no LFS, no authenticated remotes:
 * `repo` must be an `https://` URL. Each of those is a real feature and none is
 * needed to pin one task to one commit, which is the whole of delta #9.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** A task's pinned-repo coordinates, already validated. */
export interface PinnedSpec {
    repo: string;
    sha: string;
}

/** A malformed or contradictory pin. Never swallowed into a fixture fallback. */
export class PinnedRepoError extends Error {}

const SHA_RE = /^[0-9a-f]{40}$/;
const REPO_URL_RE = /^https:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$/;
const CACHE_ROOT = path.join(os.tmpdir(), 'agent-config-bench-v2-repos');
/** Written into a warm cache entry so a half-finished fetch never reads as warm. */
const STAMP = '.pinned-repo.json';

type Dict = Record<string, unknown>;

/**
 * The pin declared by `task`, or `null` when it is an ordinary fixture task.
 *
 * Throws rather than returning `null` on a task that is *trying* to be pinned
 * and failing: a half-declared pin silently treated as a fixture task is how a
 * sweep would run the wrong tree and report it as the right one.
 */
export function pinnedSpecFor(task: Dict): PinnedSpec | null {
    const repoRaw = task['repo'];
    const shaRaw = task['sha'];
    const id = task['id'] === undefined ? '<unknown>' : String(task['id']);
    if (repoRaw === undefined && shaRaw === undefined) return null;
    if (repoRaw === undefined || shaRaw === undefined) {
        throw new PinnedRepoError(`task ${id}: \`repo\` and \`sha\` must be declared together`);
    }
    if (task['fixture'] !== undefined) {
        throw new PinnedRepoError(`task ${id}: a pinned task must not also declare \`fixture\``);
    }
    const repo = String(repoRaw);
    const sha = String(shaRaw);
    if (!REPO_URL_RE.test(repo)) {
        throw new PinnedRepoError(`task ${id}: \`repo\` must be an https:// URL, got ${repo}`);
    }
    if (!SHA_RE.test(sha)) {
        throw new PinnedRepoError(
            `task ${id}: \`sha\` must be a full 40-hex commit id, got ${sha} — ` +
                'a branch or tag is refused because it moves and the report would not be reproducible',
        );
    }
    return { repo, sha };
}

/** Cache directory for one pin. Keyed by the SHA — a commit id is content. */
export function pinned_tree_dir(spec: PinnedSpec): string {
    return path.join(CACHE_ROOT, spec.sha, 'tree');
}

/** True when this pin's tree is already on disk and complete. */
export function is_materialised(spec: PinnedSpec): boolean {
    const stampPath = path.join(CACHE_ROOT, spec.sha, STAMP);
    if (!fs.existsSync(stampPath) || !fs.existsSync(pinned_tree_dir(spec))) return false;
    try {
        const stamp = JSON.parse(fs.readFileSync(stampPath, 'utf-8')) as Dict;
        return String(stamp['repo']) === spec.repo && String(stamp['sha']) === spec.sha;
    } catch {
        return false;
    }
}

function _git(cwd: string, args: readonly string[]): void {
    execFileSync('git', [...args], { cwd, stdio: 'pipe' });
}

/**
 * Materialise the pinned tree, fetching over the network only on a cold cache.
 *
 * Returns the tree path. A failed fetch leaves NO stamp, so the next call
 * retries from scratch rather than reading a partial checkout as warm.
 */
export function ensure_pinned_tree(spec: PinnedSpec): string {
    const tree = pinned_tree_dir(spec);
    if (is_materialised(spec)) return tree;
    const base = path.join(CACHE_ROOT, spec.sha);
    fs.rmSync(base, { recursive: true, force: true });
    const gitdir = path.join(base, 'src');
    fs.mkdirSync(gitdir, { recursive: true });
    fs.mkdirSync(tree, { recursive: true });
    _git(gitdir, ['init', '-q', '.']);
    _git(gitdir, ['remote', 'add', 'origin', spec.repo]);
    _git(gitdir, ['fetch', '-q', '--depth', '1', 'origin', spec.sha]);
    const tar = execFileSync('git', ['archive', '--format=tar', 'FETCH_HEAD'], {
        cwd: gitdir,
        maxBuffer: 512 * 1024 * 1024,
    });
    const tarPath = path.join(base, 'tree.tar');
    fs.writeFileSync(tarPath, tar);
    execFileSync('tar', ['-x', '-f', tarPath, '-C', tree], { stdio: 'pipe' });
    fs.rmSync(tarPath, { force: true });
    fs.rmSync(gitdir, { recursive: true, force: true });
    fs.writeFileSync(path.join(base, STAMP), JSON.stringify({ repo: spec.repo, sha: spec.sha }), 'utf-8');
    return tree;
}

/**
 * Absolute path to a task's pristine tree — fixture or pinned repo.
 *
 * `offlineOnly` is for readers that must not reach the network (the offline
 * re-scorer, `--mode selftest`): a cold cache returns `null` there, which every
 * caller reports as "not measured" rather than as a zero.
 */
export function pristine_tree_for(
    task: Dict,
    opts: { fixturesRoot: string; offlineOnly?: boolean },
): string | null {
    const spec = pinnedSpecFor(task);
    if (spec !== null) {
        if (opts.offlineOnly === true) return is_materialised(spec) ? pinned_tree_dir(spec) : null;
        return ensure_pinned_tree(spec);
    }
    if (task['fixture'] === undefined) return null;
    return path.join(opts.fixturesRoot, String(task['fixture']));
}
