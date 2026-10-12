/**
 * ratification_subject — the digest a ratification record carries over the
 * gated content it reviewed.
 *
 * `road-to-self-modification-that-a-council-must-pass` step 2.1, the half that
 * does not touch the gate. The record says WHO reviewed; without a digest it
 * does not say WHAT, so a gated file edited after its review still ships under
 * a record that approved something else.
 *
 * WHY IT READS THE GATE'S LIST RATHER THAN RE-DECIDING IT. The gate's
 * `classifyPaths` returns the kernel rules, the high-consequence rules, the
 * hooks and the plumbing by name but reports the self surface as a BOOLEAN, so
 * that part of the gated list cannot be read back out of it. This module
 * therefore imports the gate's own `SELF_SURFACE` — it never restates the
 * membership rule, because a second definition of "gated" is a second thing to
 * keep in step, and the first time the two diverged a file would be reviewed by
 * one and digested by the other. Step 4.1 is what made that concrete: the list
 * grew by five paths, and a copy here would have left all five digest-invisible.
 *
 * NO BASE DIFF. The digest is over the tree as it stands, so it is the same on
 * a branch and on the merged checkout CI judges — unless the base changed a
 * gated file the change also touches, and then the content that would land is
 * not the content that was reviewed, which is precisely what should move it.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SELF_SURFACE, classifyPaths } from '../check_kernel_edit_ratified.js';

/**
 * Stands in for the content of a gated file the change deletes. A deleted file
 * is ENTERED, never skipped: skipping would make "this file was removed"
 * digest-identical to "this file was never gated", and removing a governance
 * hook is exactly the change the record most needs to be bound to.
 */
export const DELETED_MARKER = '\u0000deleted\u0000';

/**
 * The self surface, as the GATE's one exported list rather than a copy of it.
 *
 * READ ON FIRST CALL, NOT AT MODULE SCOPE, and the reason is the import cycle
 * this module deliberately has. The gate imports {@link subjectDigest} and this
 * module imports the gate's path list, so whichever of the two Node evaluates
 * second sees the other half-evaluated; a module-scope `new Set(SELF_SURFACE)`
 * reads that `const` binding inside the window and throws on the temporal dead
 * zone. Deferring to call time moves the read past both modules' evaluation,
 * where the live binding is initialised.
 */
let selfSetCache: ReadonlySet<string> | null = null;

function selfSet(): ReadonlySet<string> {
    if (selfSetCache === null) {
        selfSetCache = new Set<string>(SELF_SURFACE);
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
    const out = new Set<string>([
        ...g.kernelRules,
        ...g.consequenceRules,
        ...g.governanceHooks,
        ...g.plumbing,
    ]);
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
        const content = fs.existsSync(abs) ? fs.readFileSync(abs) : Buffer.from(DELETED_MARKER);
        h.update(rel);
        h.update('\u0000');
        h.update(createHash('sha256').update(content).digest('hex'));
        h.update('\n');
    }
    return h.digest('hex');
}
