/**
 * ratification_subject — the digest a ratification record carries over the
 * gated content it reviewed.
 *
 * The record says WHO reviewed; without a digest it does not say WHAT, so a
 * gated file edited after its review would still ship under a record that
 * approved something else.
 *
 * WHY IT RE-ASSEMBLES THE LIST RATHER THAN RE-DECIDING IT. The gate's
 * `classifyPaths` returns the kernel rules, hooks and plumbing by name but
 * reports the self surface as a BOOLEAN, so that part of the gated list cannot
 * be read back out of it. This module therefore imports the gate's own path
 * constants and re-assembles — it never restates the membership rule, because
 * a second definition of "gated" is a second thing to keep in step, and the
 * first time the two diverged a file would be reviewed by one and digested by
 * the other.
 *
 * WHAT IT READS: GIT OBJECTS AT A NAMED REVISION, NEVER THE WORKING TREE. The
 * revision is resolved to a commit, each gated path is looked up in that
 * commit's tree, and a blob's bytes come from the object store. The filesystem
 * is not consulted for gated content at all, so a dirty working tree, a
 * symbolic link at the path or at any ancestor directory, a FIFO, a device and
 * a file swapped between two system calls are outside what the digest can
 * observe — not defended against one by one, but unreachable by construction.
 * The digest therefore describes what a commit contains, which is what a push
 * or a merge would land.
 *
 * WHAT A TREE ENTRY MAY BE. Absent, or a blob with a regular-file mode
 * (`100644`, `100755`). A blob with mode `120000` — a symbolic link — is
 * REFUSED: its effective content lives at whatever path it names, which the
 * gate's classifier does not see, so neither hashing the target string nor
 * following it would describe what a reviewer approves. A tree (directory) or
 * a gitlink (submodule) at a gated path is refused for the same reason: it is
 * not a file whose bytes a review could have read.
 *
 * WHAT IT DOES NOT COVER. Which paths are gated is still decided by code and
 * by an import closure read from the running checkout — in CI that code is the
 * base revision's, locally it is the checkout's own, and a local edit to the
 * judging code is outside what any digest can answer.
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { createHash } from 'node:crypto';

import {
    ANCHOR_PATHS,
    CLOSURE_READER_PATH,
    POLICY_PATH,
    READER_PATH,
    SELF_PATH,
    WORKFLOW_PATH,
    classifyPaths,
} from '../check_kernel_edit_ratified.js';

/** The revision a digest is taken at when the caller names none. */
export const DEFAULT_REVISION = 'HEAD';

/**
 * Stands in for the content of a gated file the change deletes. A deleted file
 * is ENTERED, never skipped: skipping would make "this file was removed"
 * digest-identical to "this file was never gated", and removing a governance
 * hook is exactly the change the record most needs to be bound to.
 */
export const DELETED_MARKER = '\u0000deleted\u0000';

/**
 * The mode slot of a deleted entry — Git's own null mode, which no tree entry
 * carries, so a deletion cannot collide with a file whose bytes happen to be
 * {@link DELETED_MARKER}.
 */
export const DELETED_MODE = '000000';

/** The tree-entry modes this digest describes: a regular file, plain or executable. */
const REGULAR_MODES: ReadonlySet<string> = new Set(['100644', '100755']);

/**
 * Upper bound on one blob read. A gated file is a rule, a hook or a config;
 * one larger than this is not something a review read either, and exceeding it
 * is a refusal rather than a silent truncation.
 */
const MAX_BLOB_BYTES = 32 * 1024 * 1024;

/**
 * Every way the subject computation declines to describe a revision.
 *
 * The callers — the gate's `evaluate()` and the CLI — catch THIS class and
 * nothing broader, so a new refusal is one subclass rather than an edit to
 * every catch, and an error that is not a refusal (a defect in this code)
 * still escapes as a crash instead of being reported as a property of the
 * repository.
 */
export class GatedSubjectRefusal extends Error {
    constructor(
        readonly rel: string,
        message: string,
    ) {
        super(message);
        this.name = 'GatedSubjectRefusal';
    }
}

/**
 * Raised when a gated path is not a path inside a tree.
 *
 * Fails CLOSED rather than dropping the path — see {@link assertContained}
 * for why that direction is the safe one.
 */
export class GatedPathEscapes extends GatedSubjectRefusal {
    constructor(rel: string) {
        super(
            rel,
            `gated path \`${rel}\` is absolute or contains a \`..\` segment, so it names nothing ` +
                'inside the revision under review — the digest refuses rather than describing ' +
                'content that is not in the change',
        );
        this.name = 'GatedPathEscapes';
    }
}

/**
 * Raised when a gated path's tree entry is not absent and not a regular file.
 */
export class GatedPathUnsupported extends GatedSubjectRefusal {
    constructor(
        rel: string,
        readonly kind: string,
        why: string,
    ) {
        super(rel, `gated path \`${rel}\` ${why} — the digest refuses rather than describing it`);
        this.name = 'GatedPathUnsupported';
    }
}

/**
 * Raised when the revision does not resolve to a commit in the repository at
 * the root — an unknown name, a root that is not a repository, or a string that
 * would be read as an option.
 */
export class GatedRevisionUnresolved extends GatedSubjectRefusal {
    constructor(
        readonly revision: string,
        detail: string,
    ) {
        super(
            '',
            `revision \`${revision}\` does not resolve to a commit (${detail}) — the digest is ` +
                'taken over a commit and refuses rather than guessing which one',
        );
        this.name = 'GatedRevisionUnresolved';
    }
}

/** Raised when no `git` executable can be started. */
export class GitUnavailable extends GatedSubjectRefusal {
    constructor(detail: string) {
        super(
            '',
            `git could not be started (${detail}) — the digest is read from Git objects and ` +
                'refuses rather than falling back to the working tree',
        );
        this.name = 'GitUnavailable';
    }
}

/** Raised when a git command over a resolved revision fails. */
export class GitReadFailed extends GatedSubjectRefusal {
    constructor(rel: string, what: string, detail: string) {
        super(
            rel,
            `git ${what} failed (${detail}) — the digest refuses to describe a revision it ` +
                'could not read',
        );
        this.name = 'GitReadFailed';
    }
}

/**
 * `..` as a whole segment, under either separator. The CLI and the gate
 * normalise `\` to `/` before classifying, but this bound is checked on the
 * string it is given so that it holds for any caller.
 */
const ESCAPING_SEGMENT = /(?:^|[\\/])\.\.(?:[\\/]|$)/u;

/**
 * POSIX-absolute, UNC (`\\server\share`, `//server/share`), rooted (`\x`) and
 * drive-qualified (`C:\x`, `C:x`) paths.
 */
const ABSOLUTE_SHAPE = /^(?:[\\/]|[A-Za-z]:)/u;

/**
 * Refuse a gated path that is not a path inside a tree.
 *
 * The gate's `KERNEL_RULE_PATH_RE` is not anchored at the start, so a path
 * such as `../../elsewhere/rules/commit-policy.md` classifies as a kernel rule.
 * No tree entry can carry that name, so looking it up would report it ABSENT
 * and enter it as a deletion — a gated path silently described as something
 * it is not. It FAILS CLOSED rather than dropping the path: dropping it would
 * make the digest cover less than the gate gated.
 */
export function assertContained(rel: string): void {
    if (ABSOLUTE_SHAPE.test(rel) || ESCAPING_SEGMENT.test(rel)) {
        throw new GatedPathEscapes(rel);
    }
}

/**
 * Environment variables that tell git which repository to use. Inherited from
 * a calling hook they would point every command below at that repository
 * instead of `root`, so they are dropped and `-C root` alone decides.
 */
const LOCATING_ENV = [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_NAMESPACE',
];

function gitEnv(): NodeJS.ProcessEnv {
    // Literal pathspecs: a gated path is a name, and a `*` in it must not
    // match a sibling.
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_LITERAL_PATHSPECS: '1' };
    for (const k of LOCATING_ENV) delete env[k];
    return env;
}

/**
 * Run git in `root`. A spawn that could not start is a typed refusal; a
 * non-zero exit is left to the caller, which knows what it means.
 *
 * Invalid arguments make `spawnSync` THROW rather than return an error, so a
 * programming defect here is never mistaken for a property of the repository.
 */
function runGit(root: string, args: readonly string[], rel: string): SpawnSyncReturns<Buffer> {
    const res = spawnSync('git', ['-C', root, ...args], {
        env: gitEnv(),
        maxBuffer: MAX_BLOB_BYTES,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (res.error !== undefined) {
        const code = (res.error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            throw new GitUnavailable(code);
        }
        throw new GitReadFailed(rel, args[0] ?? '', res.error.message);
    }
    return res;
}

function stderrOf(res: SpawnSyncReturns<Buffer>): string {
    const text = res.stderr.toString('utf8').trim().split('\n')[0] ?? '';
    return text === '' ? `exit ${String(res.status)}` : text;
}

/**
 * Resolve `revision` to a commit id in the repository whose top level is
 * `root`.
 *
 * A revision beginning with `-` is refused before git sees it, so it can never
 * be read as an option. A `root` that is a SUBDIRECTORY of a repository is
 * refused too: git would discover the enclosing repository and the gated
 * paths, which are relative to `root`, would be looked up at its top level.
 */
export function resolveRevision(root: string, revision: string): string {
    if (revision === '' || revision.startsWith('-')) {
        throw new GatedRevisionUnresolved(revision, 'empty, or shaped like an option');
    }
    const prefix = runGit(root, ['rev-parse', '--show-prefix'], '');
    if (prefix.status !== 0) {
        throw new GatedRevisionUnresolved(revision, stderrOf(prefix));
    }
    if (prefix.stdout.toString('utf8').trim() !== '') {
        throw new GatedRevisionUnresolved(
            revision,
            `\`${root}\` is inside a repository but is not its top level`,
        );
    }
    const res = runGit(root, ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`], '');
    const oid = res.stdout.toString('utf8').trim();
    if (res.status !== 0 || !/^[0-9a-f]{40,64}$/u.test(oid)) {
        throw new GatedRevisionUnresolved(revision, stderrOf(res));
    }
    return oid;
}

/**
 * Whether `ref` names a commit in the repository at `root`, through the
 * scrubbed runner — the gate's default-base probe, which must look in the same
 * repository the diff and the digest read.
 */
export function refExists(root: string, ref: string): boolean {
    return runGit(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], '').status === 0;
}

/**
 * The paths changed between `base` and `commit`, through the same scrubbed
 * runner as the subject, so an inherited `GIT_DIR` cannot point the list at a
 * different repository from the one the digest reads.
 *
 * `commit` must already be a commit id from {@link resolveRevision}: the list,
 * the digest and the record are only one reading of one commit if the name was
 * resolved once, before any of them.
 */
export function changedFilesBetween(root: string, base: string, commit: string): string[] {
    if (base === '' || base.startsWith('-')) {
        throw new GitReadFailed(
            '',
            'diff',
            `base ref \`${base}\` is empty or shaped like an option`,
        );
    }
    const res = runGit(root, ['diff', '--name-only', '-z', `${base}...${commit}`], '');
    if (res.status !== 0) {
        throw new GitReadFailed('', 'diff', stderrOf(res));
    }
    return res.stdout
        .toString('utf8')
        .split('\u0000')
        .filter((l) => l.trim() !== '');
}

/**
 * The value following option `argv[i]`, or `null` when there is none — the end
 * of the arguments, or another `--option` in its place.
 *
 * Shared by the gate and the subject CLI so the two refuse the same shapes: a
 * `--rev` with no value used to fall back to `HEAD` in the gate while the CLI
 * refused it.
 */
export function optionValue(argv: readonly string[], i: number): string | null {
    const value = argv[i + 1];
    return value === undefined || value.startsWith('--') ? null : value;
}

/** One entry of a commit's tree, as `git ls-tree` reports it. */
interface TreeEntry {
    readonly mode: string;
    readonly type: string;
    readonly oid: string;
}

/**
 * The tree entries of `paths` in `commit`, keyed by exact path. A path with no
 * entry is absent from the map — including one reached through an ancestor
 * that is not a directory in that commit, which is the same statement.
 */
function treeEntriesAt(
    root: string,
    commit: string,
    paths: readonly string[],
): ReadonlyMap<string, TreeEntry> {
    const out = new Map<string, TreeEntry>();
    if (paths.length === 0) {
        return out;
    }
    const res = runGit(root, ['ls-tree', '-z', '--full-tree', commit, '--', ...paths], '');
    if (res.status !== 0) {
        throw new GitReadFailed('', 'ls-tree', stderrOf(res));
    }
    const wanted = new Set(paths);
    for (const record of res.stdout.toString('utf8').split('\u0000')) {
        const tab = record.indexOf('\t');
        if (tab < 0) continue;
        const name = record.slice(tab + 1);
        if (!wanted.has(name)) continue;
        const [mode, type, oid] = record.slice(0, tab).split(' ');
        if (mode === undefined || type === undefined || oid === undefined) {
            throw new GitReadFailed(name, 'ls-tree', `unparseable entry \`${record}\``);
        }
        out.set(name, { mode, type, oid });
    }
    return out;
}

/** The bytes of blob `oid`. */
function blobBytes(root: string, oid: string, rel: string): Buffer {
    const res = runGit(root, ['cat-file', 'blob', oid], rel);
    if (res.status !== 0) {
        throw new GitReadFailed(rel, 'cat-file', stderrOf(res));
    }
    return res.stdout;
}

/**
 * The content of `rel` in `commit`: `null` when absent, the bytes and mode when
 * a regular file, and a refusal for every other kind of entry.
 */
function regularFileAt(
    entry: TreeEntry | undefined,
    root: string,
    rel: string,
): { readonly mode: string; readonly bytes: Buffer } | null {
    if (entry === undefined) {
        return null;
    }
    if (entry.type === 'blob' && REGULAR_MODES.has(entry.mode)) {
        return { mode: entry.mode, bytes: blobBytes(root, entry.oid, rel) };
    }
    const kind =
        entry.mode === '120000'
            ? 'symbolic link'
            : entry.type === 'tree'
              ? 'directory'
              : entry.type === 'commit'
                ? 'submodule'
                : `${entry.type} with mode ${entry.mode}`;
    throw new GatedPathUnsupported(
        rel,
        kind,
        `is a ${kind} in the revision (mode ${entry.mode}), not an absent path or a regular file`,
    );
}

/**
 * The bytes of `rel` in `commit` when it is a regular file there, or `null`
 * when it is absent — read from the object store, never from the working tree.
 * Any other kind of entry is a {@link GatedPathUnsupported} refusal.
 */
export function fileAtRevision(root: string, commit: string, rel: string): Buffer | null {
    assertContained(rel);
    return regularFileAt(treeEntriesAt(root, commit, [rel]).get(rel), root, rel)?.bytes ?? null;
}

/**
 * The self surface, by the gate's own constants rather than a copy of them.
 *
 * READ ON FIRST CALL, NOT AT MODULE SCOPE, because of the import cycle: the
 * gate imports {@link subjectOf} and this module imports the gate's path
 * constants, so whichever of the two Node evaluates second sees the other
 * half-evaluated, and a module-scope `new Set([SELF_PATH, …])` would throw on
 * the temporal dead zone.
 */
let selfSetCache: ReadonlySet<string> | null = null;

function selfSet(): ReadonlySet<string> {
    if (selfSetCache === null) {
        selfSetCache = new Set<string>([
            SELF_PATH,
            READER_PATH,
            CLOSURE_READER_PATH,
            POLICY_PATH,
            WORKFLOW_PATH,
            ...ANCHOR_PATHS,
        ]);
    }
    return selfSetCache;
}

/**
 * The gated subset of a changed-file list: sorted, deduplicated, and stable
 * against the order the caller happened to collect the paths in.
 */
export function gatedFilesOf(
    files: readonly string[],
    derived?: readonly string[],
): readonly string[] {
    const normalized = files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => f !== '');
    const g = derived === undefined ? classifyPaths(normalized) : classifyPaths(normalized, derived);
    const out = new Set<string>([...g.kernelRules, ...g.governanceHooks, ...g.plumbing]);
    const self = selfSet();
    for (const f of normalized) {
        if (self.has(f)) out.add(f);
    }
    const sorted = [...out].sort();
    for (const rel of sorted) {
        assertContained(rel);
    }
    return sorted;
}

/** A digest and, from the SAME classification, exactly what it covers and where. */
export interface SubjectReading {
    /** The `subject` a record must carry to answer for this change. */
    readonly digest: string;
    /** The gated files that digest is taken over, sorted. */
    readonly gatedFiles: readonly string[];
    /**
     * The commit the digest was read from, or `null` when nothing is gated —
     * a digest over no files reads nothing, so it resolves nothing either.
     */
    readonly revision: string | null;
}

/**
 * One digest over the sorted paths, modes and contents of the gated files as
 * they are in the commit `revision` resolves to, together with the list it
 * covers and that commit.
 *
 * Each entry is serialised as `path NUL mode NUL sha256hex(content) LF`. NUL
 * cannot occur in a Git path, the mode is six octal digits and the content
 * slot is a fixed 64 hex characters, so the serialisation is unambiguous and
 * no crafted path can reproduce another entry's framing. The path is hashed
 * alongside its content, so two files with identical bytes do not collide and
 * a rename moves the digest; the mode is hashed so that a change of the
 * executable bit is a change.
 *
 * `derived` is the plumbing closure the caller already computed, passed through
 * to {@link gatedFilesOf} unchanged: a digest that classified without it would
 * cover fewer files than the gate gated.
 *
 * THROWS a {@link GatedSubjectRefusal} for every revision it declines to
 * describe.
 */
export function subjectOf(
    root: string,
    files: readonly string[],
    derived?: readonly string[],
    revision: string = DEFAULT_REVISION,
): SubjectReading {
    const gatedFiles = gatedFilesOf(files, derived);
    const h = createHash('sha256');
    if (gatedFiles.length === 0) {
        return { digest: h.digest('hex'), gatedFiles, revision: null };
    }
    const commit = resolveRevision(root, revision);
    const entries = treeEntriesAt(root, commit, gatedFiles);
    for (const rel of gatedFiles) {
        const file = regularFileAt(entries.get(rel), root, rel);
        const mode = file === null ? DELETED_MODE : file.mode;
        const content = file === null ? Buffer.from(DELETED_MARKER) : file.bytes;
        h.update(rel);
        h.update('\u0000');
        h.update(mode);
        h.update('\u0000');
        h.update(createHash('sha256').update(content).digest('hex'));
        h.update('\n');
    }
    return { digest: h.digest('hex'), gatedFiles, revision: commit };
}

/**
 * The digest alone, for a caller that has no use for the covered list.
 *
 * Delegates rather than re-implementing: there is ONE classification and ONE
 * hashing loop, and this is a projection of its result.
 */
export function subjectDigest(
    root: string,
    files: readonly string[],
    derived?: readonly string[],
    revision: string = DEFAULT_REVISION,
): string {
    return subjectOf(root, files, derived, revision).digest;
}
