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
    return [...out].sort();
}

/**
 * One digest over the sorted paths AND contents of the gated files, read from
 * `root`.
 *
 * The path is hashed alongside its content, so two files with identical bytes
 * do not collide and a rename moves the digest — a gated file moved to another
 * gated path is a different change, not the same one.
 *
 * `derived` is the plumbing closure the caller already computed, passed through
 * to {@link gatedFilesOf} unchanged. The gate HAS that list and classifies with
 * it; a digest that classified without it would cover fewer files than the gate
 * gated, so a record could be bound to a subset of what was reviewed. One list,
 * handed down, rather than two computed independently.
 */
export function subjectDigest(
    root: string,
    files: readonly string[],
    derived?: readonly string[],
): string {
    const h = createHash('sha256');
    for (const rel of gatedFilesOf(files, derived)) {
        const abs = path.join(root, rel);
        // `lstat` rather than `existsSync`: the latter follows the link and
        // reports a broken symlink as absent, which would digest a link as a
        // deletion. One stat, and the three cases are told apart by it.
        let content: Buffer;
        let stat: fs.Stats | null = null;
        try {
            stat = fs.lstatSync(abs);
        } catch {
            stat = null;
        }
        if (stat === null) {
            content = Buffer.from(DELETED_MARKER);
        } else if (stat.isSymbolicLink()) {
            content = Buffer.from(SYMLINK_MARKER + fs.readlinkSync(abs));
        } else {
            content = fs.readFileSync(abs);
        }
        h.update(rel);
        h.update('\u0000');
        h.update(createHash('sha256').update(content).digest('hex'));
        h.update('\n');
    }
    return h.digest('hex');
}
