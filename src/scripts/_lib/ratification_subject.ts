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
 * reports the self surface as a BOOLEAN, so the gated list cannot be read back
 * out of it. This module therefore imports the gate's own path constants and
 * re-assembles — it never restates the membership rule, because a second
 * definition of "gated" is a second thing to keep in step, and the first time
 * the two diverged a file would be reviewed by one and digested by the other.
 *
 * NO BASE DIFF. The digest is over the tree as it stands, so it is the same on
 * a branch and on the merged checkout CI judges — unless the base changed a
 * gated file the change also touches, and then the content that would land is
 * not the content that was reviewed, which is precisely what should move it.
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

/** The self surface, by the gate's own constants rather than a copy of them. */
const SELF_SET: ReadonlySet<string> = new Set<string>([
    SELF_PATH,
    READER_PATH,
    CLOSURE_READER_PATH,
    POLICY_PATH,
    WORKFLOW_PATH,
    ...ANCHOR_PATHS,
]);

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
    for (const f of normalized) {
        if (SELF_SET.has(f)) out.add(f);
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
 */
export function subjectDigest(root: string, files: readonly string[]): string {
    const h = createHash('sha256');
    for (const rel of gatedFilesOf(files)) {
        const abs = path.join(root, rel);
        const content = fs.existsSync(abs) ? fs.readFileSync(abs) : Buffer.from(DELETED_MARKER);
        h.update(rel);
        h.update('\u0000');
        h.update(createHash('sha256').update(content).digest('hex'));
        h.update('\n');
    }
    return h.digest('hex');
}
