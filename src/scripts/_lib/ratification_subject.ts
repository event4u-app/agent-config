/**
 * ratification_subject — the digest a ratification record carries over the
 * gated content it reviewed.
 *
 * `road-to-self-modification-that-a-council-must-pass` step 2.1, the half that
 * does not touch the gate. The record says WHO reviewed; without a digest it
 * does not say WHAT, so a gated file edited after its review still ships under
 * a record that approved something else.
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
 * NO BASE DIFF. The digest is over the tree as it stands, so it is the same on
 * a branch and on the merged checkout CI judges — unless the base changed a
 * gated file the change also touches, and then the content that would land is
 * not the content that was reviewed, which is precisely what should move it.
 *
 * WHAT IT READS, AND WHAT IT THEREFORE DOES NOT PROVE. It reads the WORKING
 * TREE, not Git objects, so against a dirty tree the digest describes the
 * dirty bytes; revision-based hashing is the stronger shape and is not what
 * ships here. What it never does is follow a symbolic link: a dereferenced
 * link would make the digest depend on content outside the revision entirely,
 * which no amount of cleanliness in the checkout removes.
 *
 * WHAT IT READS AT ALL. A gated path is absent, a symbolic link, or a regular
 * file — the three object kinds Git can store and this digest can describe.
 * Anything else is refused before it is opened. The history of how each of
 * these properties was arrived at is in the ratification record
 * `drain-self-modification-narrowed-20261013.md`, not here.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    ANCHOR_PATHS,
    CLOSURE_READER_PATH,
    POLICY_PATH,
    READER_PATH,
    SELF_PATH,
    WORKFLOW_PATH,
    classifyPaths,
} from '../check_kernel_edit_ratified.js';

/**
 * Stands in for the content of a gated file the change deletes. A deleted file
 * is ENTERED, never skipped: skipping would make "this file was removed"
 * digest-identical to "this file was never gated", and removing a governance
 * hook is exactly the change the record most needs to be bound to.
 */
export const DELETED_MARKER = '\u0000deleted\u0000';

/**
 * Prefixes the target of a gated path that is a SYMLINK, so the digest records
 * the link rather than whatever it currently points at.
 *
 * Git stores a symlink as a blob containing its target string, and that is
 * what is hashed here, so the digest describes the committed object rather
 * than bytes that live outside the revision and can differ between two clean
 * checkouts of the same commit. A broken link is a link, not a deletion, and is
 * recorded as one.
 */
export const SYMLINK_MARKER = '\u0000symlink\u0000';

/**
 * Every way the subject computation declines to describe a tree.
 *
 * The callers — the gate's `evaluate()` and the CLI — catch THIS class and
 * nothing broader, so a new refusal is one subclass rather than an edit to
 * every catch, and an error that is not a refusal (a defect in this code)
 * still escapes as a crash instead of being reported as a property of the
 * checkout.
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
 * Raised when a gated path would resolve outside the tree under review.
 *
 * Fails CLOSED rather than dropping the path — see {@link assertContained}
 * for why that direction is the safe one.
 */
export class GatedPathEscapes extends GatedSubjectRefusal {
    constructor(rel: string) {
        super(
            rel,
            `gated path \`${rel}\` is absolute or contains a \`..\` segment, so joining it to ` +
                'the tree root would read outside the revision under review — the digest refuses ' +
                'rather than describing content that is not in the change',
        );
        this.name = 'GatedPathEscapes';
    }
}

/**
 * Raised when a gated path exists but cannot be read.
 *
 * Only ENOENT and ENOTDIR mean ABSENT. Every other failure says the file may
 * well be there and this process could not look, and representing that with
 * the deletion marker would let anyone who can provoke such an error on a
 * gated path force its real content out of the digest.
 */
export class GatedFileUnreadable extends GatedSubjectRefusal {
    constructor(
        rel: string,
        readonly errno: NodeJS.ErrnoException,
    ) {
        super(
            rel,
            `gated path \`${rel}\` exists but could not be read ` +
                `(${errno.code ?? errno.message}) — the digest refuses to describe a tree it ` +
                'could not read, because an unreadable file is not a deleted one',
        );
        this.name = 'GatedFileUnreadable';
    }
}

/**
 * Raised when a gated path is an object the digest does not describe, or when
 * this platform cannot read it without following a link.
 *
 * Refused BEFORE any `open`: opening a FIFO read-only blocks until a writer
 * appears, so a gate that opened first and checked second could hang instead
 * of answering. Git cannot commit a FIFO, socket, device or directory at a
 * file path, so meeting one means the checkout is not a revision this digest
 * can stand for.
 */
export class GatedPathUnsupported extends GatedSubjectRefusal {
    constructor(
        rel: string,
        readonly kind: string,
        why: string,
    ) {
        super(rel, `gated path \`${rel}\` ${why} — the digest refuses rather than reading it`);
        this.name = 'GatedPathUnsupported';
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
 * drive-qualified (`C:\x`, `C:x`) paths — every shape `path.join` would not
 * keep under the root on one platform or another.
 */
const ABSOLUTE_SHAPE = /^(?:[\\/]|[A-Za-z]:)/u;

/**
 * Refuse a gated path that would read outside `root`.
 *
 * The gate's `KERNEL_RULE_PATH_RE` is not anchored at the start, so a path
 * such as `../../elsewhere/rules/commit-policy.md` classifies as a kernel rule.
 * That was harmless while the gate only read path NAMES; it stops being
 * harmless once those names are joined to a root and read, so the containment
 * belongs here, with the read. It FAILS CLOSED rather than dropping the path:
 * dropping it would make the digest cover less than the gate gated.
 *
 * Tightening the gate's own regex is a change to the gate's classification and
 * therefore a separate, gated concern. This bound holds whatever that regex
 * does.
 */
export function assertContained(rel: string): void {
    if (ABSOLUTE_SHAPE.test(rel) || ESCAPING_SEGMENT.test(rel)) {
        throw new GatedPathEscapes(rel);
    }
}

/**
 * An errno failure, or `null` for anything else.
 *
 * Deliberately narrow: a blanket translation would report a defect in this
 * code as "the tree could not be read" and nobody would look for the bug. A
 * string `code` alone is not OS evidence, because Node's own programming
 * errors (`ERR_INVALID_ARG_TYPE` and the rest of the `ERR_*` family) carry one.
 * An OS failure is told apart by what only the system-call path attaches: a
 * numeric `errno`, a string `syscall`, and a `code` outside `ERR_`. Anything
 * missing one of the three is rethrown unchanged and stays a crash.
 */
export function asErrno(err: unknown): NodeJS.ErrnoException | null {
    if (!(err instanceof Error)) {
        return null;
    }
    const e = err as NodeJS.ErrnoException;
    if (
        typeof e.code === 'string' &&
        !e.code.startsWith('ERR_') &&
        typeof e.errno === 'number' &&
        typeof e.syscall === 'string'
    ) {
        return e;
    }
    return null;
}

/**
 * Translate a filesystem failure on `rel` into a refusal, or rethrow it.
 *
 * The one place the discriminator above is applied, so the `lstat`, the open,
 * the `fstat`, the read, the close and the readlink cannot drift into six
 * readings of "is this a filesystem fact".
 */
function refuseOrRethrow(rel: string, err: unknown): never {
    const errno = asErrno(err);
    if (errno === null) {
        throw err;
    }
    throw new GatedFileUnreadable(rel, errno);
}

/** What a non-regular, non-link `Stats` is, for the refusal message. */
function kindOf(stat: fs.Stats): string {
    if (stat.isDirectory()) return 'directory';
    if (stat.isFIFO()) return 'FIFO';
    if (stat.isSocket()) return 'socket';
    if (stat.isCharacterDevice()) return 'character device';
    if (stat.isBlockDevice()) return 'block device';
    return 'unknown object';
}

function refuseKind(rel: string, stat: fs.Stats): never {
    const kind = kindOf(stat);
    throw new GatedPathUnsupported(
        rel,
        kind,
        `is a ${kind}, not an absent path, a symbolic link or a regular file`,
    );
}

/**
 * The open flags for a gated read, or a refusal where the platform lacks one.
 *
 * `O_NOFOLLOW` is what keeps a path that became a symlink after the `lstat`
 * from pulling out-of-revision content into the digest; without it the open
 * dereferences, so its absence is a refusal rather than a quiet degradation.
 * `O_NONBLOCK` is what keeps a path that became a FIFO after the `lstat` from
 * blocking the open; the `fstat` that follows then refuses it. Read at call
 * time rather than module scope so that both are checked on every read.
 */
function gatedOpenFlags(rel: string): number {
    const { O_NOFOLLOW, O_NONBLOCK, O_RDONLY } = fs.constants;
    if (typeof O_NOFOLLOW !== 'number' || typeof O_NONBLOCK !== 'number') {
        throw new GatedPathUnsupported(
            rel,
            'platform',
            'cannot be read on this platform without following a symbolic link or blocking ' +
                'on a FIFO, because `O_NOFOLLOW` or `O_NONBLOCK` is unavailable',
        );
    }
    return O_RDONLY | O_NOFOLLOW | O_NONBLOCK;
}

function closeQuietly(fd: number): void {
    try {
        fs.closeSync(fd);
    } catch {
        // A refusal is already on its way; that is the failure reported.
    }
}

/**
 * Read a gated path that {@link fs.lstatSync} has just called a regular file,
 * WITHOUT following a symbolic link at its final component and without
 * blocking on an object that was swapped in after the stat.
 *
 * A path that is a regular file at `lstat` and a SYMLINK at the open is the
 * only ordering in which out-of-revision CONTENT can enter the digest, and
 * `O_NOFOLLOW` turns it into `ELOOP`, a refusal. A path swapped to a FIFO,
 * device or directory opens without blocking and is refused by the `fstat`.
 *
 * WHAT IS NOT CLOSED, SAID PLAINLY. Intermediate directory components are
 * still resolved, so a symlinked parent directory committed into the tree
 * redirects the read; that is a property of the checkout rather than a race,
 * and it is visible in the revision. And an adversary with concurrent write
 * access to the checkout during a gate run can edit the gated bytes BEFORE the
 * stat, forge the record, or patch this file — no ordering of stat and read
 * answers that.
 *
 * The close is inside the translation on every path: the read's failure is
 * decided first and wins, a close failure after a failed read is dropped, and
 * a close failure after a successful read is itself a refusal.
 */
export function readGatedFile(rel: string, abs: string): Buffer {
    const flags = gatedOpenFlags(rel);
    let fd: number;
    try {
        fd = fs.openSync(abs, flags);
    } catch (err) {
        refuseOrRethrow(rel, err);
    }
    let stat: fs.Stats;
    try {
        stat = fs.fstatSync(fd);
    } catch (err) {
        closeQuietly(fd);
        refuseOrRethrow(rel, err);
    }
    if (!stat.isFile()) {
        closeQuietly(fd);
        refuseKind(rel, stat);
    }
    let bytes: Buffer;
    try {
        bytes = fs.readFileSync(fd);
    } catch (err) {
        closeQuietly(fd);
        refuseOrRethrow(rel, err);
    }
    try {
        fs.closeSync(fd);
    } catch (err) {
        refuseOrRethrow(rel, err);
    }
    return bytes;
}

/**
 * Read the TARGET STRING of a gated path that `lstat` has just called a
 * symbolic link.
 *
 * A link replaced by a regular file between the stat and this call makes
 * `readlinkSync` fail with `EINVAL`, which becomes a refusal. A swap of the
 * link's TARGET is not a leak at all — the digest records the target STRING
 * and never dereferences it, so the worst a swap can do is move the digest,
 * which reds the gate.
 */
export function readGatedLink(rel: string, abs: string): string {
    try {
        return fs.readlinkSync(abs);
    } catch (err) {
        refuseOrRethrow(rel, err);
    }
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

/** A digest and, from the SAME classification, exactly what it covers. */
export interface SubjectReading {
    /** The `subject` a record must carry to answer for this change. */
    readonly digest: string;
    /** The gated files that digest is taken over, sorted. */
    readonly gatedFiles: readonly string[];
}

/**
 * The `lstat` of a gated path, or `null` when it is ABSENT.
 *
 * ABSENT is two codes and no more. ENOENT is the file not being there; ENOTDIR
 * is a parent component not being a directory, which is the same statement
 * about a path that does not resolve. Everything else says the file may be
 * there and this process could not look.
 */
function lstatGated(rel: string, abs: string): fs.Stats | null {
    try {
        return fs.lstatSync(abs);
    } catch (err) {
        const code = asErrno(err)?.code;
        if (code === 'ENOENT' || code === 'ENOTDIR') {
            return null;
        }
        refuseOrRethrow(rel, err);
    }
}

/**
 * One digest over the sorted paths AND contents of the gated files, read from
 * `root`, together with the list it covers.
 *
 * The path is hashed alongside its content, so two files with identical bytes
 * do not collide and a rename moves the digest — a gated file moved to another
 * gated path is a different change, not the same one. The separator is NUL,
 * which no path on any supported filesystem may contain, and the content slot
 * is a fixed-width 64-character hex digest — so the serialisation is
 * unambiguous and no crafted path can reproduce another file's framing.
 *
 * `derived` is the plumbing closure the caller already computed, passed through
 * to {@link gatedFilesOf} unchanged: a digest that classified without it would
 * cover fewer files than the gate gated. It returns the list with the digest
 * so that no caller re-derives the coverage from a second classification.
 *
 * THROWS a {@link GatedSubjectRefusal} for every tree it declines to describe.
 */
export function subjectOf(
    root: string,
    files: readonly string[],
    derived?: readonly string[],
): SubjectReading {
    const gatedFiles = gatedFilesOf(files, derived);
    const h = createHash('sha256');
    for (const rel of gatedFiles) {
        const abs = path.join(root, rel);
        // `lstat` rather than `existsSync`: the latter follows the link and
        // reports a broken symlink as absent. One stat tells the three
        // describable kinds apart, and everything else is refused here,
        // before any open.
        const stat = lstatGated(rel, abs);
        let content: Buffer;
        if (stat === null) {
            content = Buffer.from(DELETED_MARKER);
        } else if (stat.isSymbolicLink()) {
            content = Buffer.from(SYMLINK_MARKER + readGatedLink(rel, abs));
        } else if (stat.isFile()) {
            content = readGatedFile(rel, abs);
        } else {
            refuseKind(rel, stat);
        }
        h.update(rel);
        h.update('\u0000');
        h.update(createHash('sha256').update(content).digest('hex'));
        h.update('\n');
    }
    return { digest: h.digest('hex'), gatedFiles };
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
): string {
    return subjectOf(root, files, derived).digest;
}
