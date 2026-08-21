/**
 * Remove empty directories under a root, deepest first.
 *
 * ## Why this exists as a shared helper
 *
 * A generator that stops writing into a tree leaves the tree's DIRECTORIES
 * behind. Measured 2026-08-21 while extending the ADR-236 partition to the
 * colon-form commands: after the generator was gated, `.claude/commands/`
 * held **0 `.md` files and 40 empty cluster directories** — and
 * `check_single_delivery` counts directory NAMES, so it still reported 40
 * overlapping commands against a layer that delivered none. A partition that
 * stops the writes and leaves the shape is invisible to the gate that is
 * supposed to confirm it.
 *
 * `condense.ts` already carried this loop inline for the skills tree. It is
 * lifted here rather than copied because the second caller is what turns an
 * inline block into a shape two producers must agree on — and because
 * `condense.ts` sits above `check_source_size_budget`'s ceiling, where a
 * shrink-only ratchet refuses even a small addition.
 *
 * Best-effort by construction: a race or a permission error on one directory is
 * swallowed, matching the inline original. Pruning is cleanup, never a gate.
 *
 * ## Symlinks: MEASURED, because a neutral review split on it
 *
 * One seat called an unguarded recursion a merge blocker (a directory symlink
 * pointing at an ancestor would loop forever); the other called the finding
 * false, on the grounds that `Dirent.isDirectory()` does not follow the target.
 * A vote cannot settle that, so it was probed — `readdirSync(dir, {withFileTypes:
 * true})` over a real symlink-to-directory on darwin, Node 26:
 *
 *     link  isDirectory=false  isSymbolicLink=true
 *     real  isDirectory=true   isSymbolicLink=false
 *
 * `Dirent` carries `lstat` semantics, so the walk below cannot descend into a
 * symlink at all and no loop is reachable — and no inode set is needed. The
 * second seat was right. Recorded rather than fixed, so the next reader does not
 * re-raise it: a defensive `!e.isSymbolicLink()` here would be dead code
 * asserting something the type already guarantees.
 *
 * The same property is why this is safe on a tree of symlinks: `.claude/commands`
 * holds symlinks into `src/domains/**`, and pruning must not follow one out of
 * the tree it was pointed at.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** @returns the number of directories removed. */
export function pruneEmptyDirs(root: string): number {
    let removed = 0;
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (e.isDirectory()) walk(path.join(dir, e.name));
        }
        try {
            if (fs.readdirSync(dir).length === 0) {
                fs.rmdirSync(dir);
                removed += 1;
            }
        } catch {
            /* race or permission — cleanup is best-effort, mirrors the inline original */
        }
    };
    let top: fs.Dirent[];
    try {
        top = fs.readdirSync(root, { withFileTypes: true });
    } catch {
        return 0;
    }
    for (const e of top) {
        if (e.isDirectory()) walk(path.join(root, e.name));
    }
    return removed;
}
