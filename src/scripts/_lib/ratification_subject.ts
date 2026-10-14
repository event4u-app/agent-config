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
 * TREE, not Git objects. A reviewer of this mechanism asked for revision-based
 * hashing instead; that remains the stronger shape and is not what ships here,
 * so against a dirty tree the digest describes the dirty bytes. What the same
 * review DID change is the symlink case below — a dereferenced link made the
 * digest depend on content outside the revision entirely, which is a different
 * and worse defect than depending on an uncommitted edit, because no amount of
 * cleanliness in the checkout removes it.
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
 * A council review of this mechanism found the gap: `readFileSync`
 * dereferences, so a gated path committed as a symlink was hashed as its
 * target's bytes — which live outside the reviewed revision and can differ
 * between two clean checkouts of the same commit. Git stores a symlink as a
 * blob containing its target string, and that is what is hashed here, so the
 * digest describes the committed object. A broken link is a link, not a
 * deletion, and is recorded as one.
 */
export const SYMLINK_MARKER = '\u0000symlink\u0000';

/**
 * Raised when a gated path would resolve outside the tree under review.
 *
 * THIS DOC BLOCK USED TO DESCRIBE A DIFFERENT CLASS. It carried
 * {@link GatedFileUnreadable}'s `lstat` / ENOENT argument verbatim, which says
 * nothing about path containment and is now where it belongs. A comment that
 * describes the wrong mechanism is worse than none on a governance surface: it
 * answers a reader's question with another class's reasoning, and the reader
 * has no way to know.
 *
 * The containment itself fails CLOSED rather than dropping the path —
 * see {@link assertContained} for why that direction is the safe one.
 */
export class GatedPathEscapes extends Error {
    constructor(readonly rel: string) {
        super(
            `gated path \`${rel}\` is absolute or contains a \`..\` segment, so joining it to ` +
                'the tree root would read outside the revision under review — the digest refuses ' +
                'rather than describing content that is not in the change',
        );
        this.name = 'GatedPathEscapes';
    }
}

/**
 * Refuse a gated path that would read outside `root`.
 *
 * FOUND BY THE TEST THAT PINS IT, on a 2026-10-13 council question: the gate's
 * `KERNEL_RULE_PATH_RE` is `(?:^|\/)rules\/([a-z0-9-]+)\.md$`, which is NOT
 * anchored at the start, so `../../elsewhere/rules/commit-policy.md` classifies
 * as a kernel rule. That was harmless while the gate only read path NAMES. It
 * stopped being harmless the moment this module began joining those names to a
 * root and reading the bytes, which is what the content binding does — so the
 * containment belongs here, with the read, and it FAILS CLOSED rather than
 * dropping the path: dropping it would make the digest cover less than the gate
 * gated, which is the divergence the same review refused elsewhere.
 *
 * Tightening the gate's own regex is a change to the gate's classification and
 * therefore a separate, gated concern. This bound holds whatever that regex
 * does.
 */
const ESCAPING_SEGMENT = /(?:^|\/)\.\.(?:\/|$)/u;

function assertContained(rel: string): void {
    if (rel.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(rel) || ESCAPING_SEGMENT.test(rel)) {
        throw new GatedPathEscapes(rel);
    }
}

/**
 * Raised when a gated path exists but cannot be read.
 *
 * A 2026-10-13 council review refused the change over the shape this
 * replaces: every `lstat` failure became `null`, and `null` is the DELETION
 * marker — so a permission error, an I/O error or a transient filesystem
 * failure on a gated file produced the digest of a tree in which that file
 * had been removed. Both seats named it, and one named the consequence that
 * makes it more than untidy: anyone who can provoke such an error on a gated
 * path can force its real content out of the digest.
 *
 * Only ENOENT and ENOTDIR mean ABSENT. Everything else is a checkout this
 * code cannot describe, and describing it anyway is the fail-open move a
 * previous round of this same review already refused once.
 *
 * Round 2 of the same review found the other half: this class was raised
 * only from the `lstat`, and the reads AFTER it were unwrapped. Both reads
 * now raise it too, through {@link readGatedFile} and {@link readGatedLink}.
 */
export class GatedFileUnreadable extends Error {
    constructor(
        readonly rel: string,
        readonly errno: NodeJS.ErrnoException,
    ) {
        super(
            `gated path \`${rel}\` exists but could not be read ` +
                `(${errno.code ?? errno.message}) — the digest refuses to describe a tree it ` +
                'could not read, because an unreadable file is not a deleted one',
        );
        this.name = 'GatedFileUnreadable';
    }
}

/**
 * An errno failure, or `null` for anything else.
 *
 * THE TRANSLATION IS NARROW ON PURPOSE. The blind peer-review stage of the
 * 2026-10-13 round named the opposite shape as its own defect: a blanket
 * `catch` around the read would "conceal programming defects as ordinary
 * refusals", so a `TypeError` from a future edit of this loop would surface as
 * "the tree could not be read" and nobody would look for the bug.
 *
 * A STRING `code` IS NOT THAT EVIDENCE, and round 3 of the same review refused
 * the change for treating it as such: Node's own programming errors —
 * `ERR_INVALID_ARG_TYPE` and the rest of the `ERR_*` family — are `TypeError`s
 * with a string `code`, so the first version of this check translated exactly
 * the defects it claimed to rethrow. An OS failure is told apart by what only
 * the system-call path attaches: a numeric `errno` AND a string `syscall`, and
 * a `code` outside the `ERR_` namespace. Anything missing one of the three is
 * rethrown unchanged and stays a crash.
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
 * the read, the close and the readlink cannot drift into five readings of
 * "is this a filesystem fact".
 */
function refuseOrRethrow(rel: string, err: unknown): never {
    const errno = asErrno(err);
    if (errno === null) {
        throw err;
    }
    throw new GatedFileUnreadable(rel, errno);
}

/**
 * `O_NOFOLLOW`, or 0 where the platform has no such flag.
 *
 * Defined on Linux and macOS, which is where this gate runs — `consistency.yml`
 * is `ubuntu-latest` and the suites are ubuntu plus macOS. The `0` fallback is
 * honest rather than silent: on a platform without the flag the open below
 * degrades to an ordinary one and {@link readGatedFile} loses the containment
 * property its own case asserts. That is stated here because a reader
 * otherwise has to infer it from a bitmask.
 */
const O_NOFOLLOW: number =
    typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;

/**
 * Read a gated path that {@link fs.lstatSync} has just called a regular file,
 * WITHOUT following a symbolic link at its final component.
 *
 * THE SYMLINK-SWAP QUESTION, ANSWERED RATHER THAN ASSUMED. One seat of the
 * 2026-10-13 round named a path-substitution race between the stat and the
 * read and asked whether resisting it is inside this gate's threat model. It
 * is, for exactly one direction and for a reason that is cheap to state: a
 * path that is a regular file at `lstat` and a SYMLINK at the read is the only
 * ordering in which out-of-revision CONTENT can enter the digest, because a
 * plain `readFileSync` dereferences. `O_NOFOLLOW` makes that open fail with
 * `ELOOP`, which becomes a refusal — so the race reds the gate instead of
 * digesting a stranger's bytes.
 *
 * WHAT IS NOT CLOSED, SAID PLAINLY. Intermediate directory components are
 * still resolved, so a symlinked parent directory committed into the tree
 * redirects the read; that is a property of the checkout rather than a race,
 * and it is visible in the revision. And an adversary with concurrent write
 * access to the checkout during a gate run can edit the gated bytes BEFORE the
 * stat, forge the record, or patch this file — no ordering of stat and read
 * answers that, and claiming otherwise would be the false assurance this
 * module exists to prevent.
 *
 * Exported because a comment claiming a containment property is not a control.
 * Its case opens a symlink directly and expects the refusal; neutralising the
 * flag turns that case red.
 */
export function readGatedFile(rel: string, abs: string): Buffer {
    let fd: number;
    try {
        fd = fs.openSync(abs, fs.constants.O_RDONLY | O_NOFOLLOW);
    } catch (err) {
        refuseOrRethrow(rel, err);
    }
    // THE CLOSE IS INSIDE THE TRANSLATION, and on both paths. Round 3 of the
    // 2026-10-13 review found it in a `finally`, outside the catch: a close
    // failure escaped as a raw Node error, and because an exception thrown
    // from `finally` replaces the pending one, it could also overwrite a read
    // failure that had already been translated. So the read's failure is
    // decided first and wins; a close failure after a failed read is dropped
    // because a refusal is already on its way, and a close failure after a
    // successful read is itself a refusal.
    let bytes: Buffer;
    try {
        bytes = fs.readFileSync(fd);
    } catch (err) {
        try {
            fs.closeSync(fd);
        } catch {
            // The primary failure is the one reported; see above.
        }
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
 * The other half of the swap answer, and the measurable one: a link replaced
 * by a regular file between the stat and this call makes `readlinkSync` fail
 * with `EINVAL`, which becomes a refusal rather than a raw Node error escaping
 * `evaluate()`. A swap of the link's TARGET is not a leak at all — the digest
 * records the target STRING and never dereferences it, so the worst a swap can
 * do is move the digest, which reds the gate. Both directions therefore fail
 * closed, and the case below proves the `EINVAL` one rather than asserting it.
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
 * READ ON FIRST CALL, NOT AT MODULE SCOPE, and the reason is the import cycle
 * the binding introduced. The gate now imports {@link subjectDigest} and this
 * module imports the gate's path constants, so whichever of the two Node
 * evaluates second sees the other half-evaluated; a module-scope
 * `new Set([SELF_PATH, …])` reads those `const` bindings inside the window and
 * throws on the temporal dead zone. Deferring to call time moves the read past
 * both modules' evaluation, where the live bindings are initialised.
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
 * to {@link gatedFilesOf} unchanged. The gate HAS that list and classifies with
 * it; a digest that classified without it would cover fewer files than the gate
 * gated, so a record could be bound to a subset of what was reviewed. One list,
 * handed down, rather than two computed independently.
 *
 * RETURNS THE LIST RATHER THAN LETTING A CALLER RE-DERIVE IT. The 2026-10-13
 * review found the CLI printing `gatedFilesOf(files)` while the digest came
 * from `gatedFilesOf(files, derivedFor(root))` — two classifications with
 * different inputs, so the coverage a human copied alongside a digest could
 * disagree with what that digest actually covered. One call, one answer.
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
        // reports a broken symlink as absent, which would digest a link as a
        // deletion. One stat, and the three cases are told apart by it.
        let content: Buffer;
        let stat: fs.Stats | null = null;
        try {
            stat = fs.lstatSync(abs);
        } catch (err) {
            // ABSENT is two codes and no more. ENOENT is the file not being
            // there; ENOTDIR is a parent component not being a directory,
            // which is the same statement about a path that does not resolve.
            // EACCES, EPERM, EIO, ELOOP and everything else say the file may
            // well be there and this process could not look — a different
            // fact, and not one a deletion marker may stand in for. And a
            // value that is not an OS failure at all is a defect here and is
            // rethrown, through the same discriminator as the reads below.
            const code = asErrno(err)?.code;
            if (code === 'ENOENT' || code === 'ENOTDIR') {
                stat = null;
            } else {
                refuseOrRethrow(rel, err);
            }
        }
        if (stat === null) {
            content = Buffer.from(DELETED_MARKER);
        } else if (stat.isSymbolicLink()) {
            // Both reads are wrapped. Before the 2026-10-13 round they were
            // not, and an I/O or permission failure AFTER the stat escaped as
            // a raw Node error — the exact TOCTOU window the fail-closed
            // `lstat` above was added to close, left open one line later.
            content = Buffer.from(SYMLINK_MARKER + readGatedLink(rel, abs));
        } else {
            content = readGatedFile(rel, abs);
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
