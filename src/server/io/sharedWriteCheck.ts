/**
 * Shared-write collision detector for the settings / user-md write
 * routes (`road-to-reciprocal-ecosystem.md` Phase 2).
 *
 * When AC runs under an agent-switch (AS) profile with `share on`, AS
 * symlinks certain files/dirs (`settings.json`, `keybindings.json`,
 * `CLAUDE.md`, `skills/`, `commands/`, `agents/`) across profiles
 * (`agent-switch/src/share.ts:37-43`). A write AC believes is
 * profile-local can land through such a symlink and change every
 * profile that shares it.
 *
 * Detection is AC-local and topology-free: `lstat`-walk from the write
 * target up to the AS root, looking for a symlink component. AC never
 * needs to understand AS's share manifest to guard against this, and
 * never breaks AS's symlinks itself — `resolveThroughSymlinks` below
 * follows a detected symlink to its real target rather than letting a
 * naive atomic write clobber the symlink in place.
 */
import { lstatSync, realpathSync } from 'node:fs';
import * as path from 'node:path';
import { detectAgentSwitchProfile, resolveAgentSwitchRoot } from '../../install/agentSwitchProfile.js';

const MAX_WALK_DEPTH = 32;

function isSymlink(p: string): boolean {
    try {
        return lstatSync(p).isSymbolicLink();
    } catch {
        // Component doesn't exist yet — not a symlink; the walk keeps
        // climbing to check existing ancestors.
        return false;
    }
}

/** `true` when `p` is `root` itself or lies strictly inside it. */
function isInsideRoot(p: string, root: string): boolean {
    return p === root || p.startsWith(root + path.sep);
}

/**
 * Returns the symlinked path (the write target itself, or the nearest
 * symlinked ancestor between `target` and the AS root) when AC is
 * running under an active AS profile, the write target actually lies
 * inside the AS root, AND a symlink sits somewhere on the path between
 * them. Returns `null` when no AS profile is active, when the target
 * isn't inside the AS tree at all, or when no symlink is found before
 * reaching the AS root.
 *
 * The inside-root check comes BEFORE any filesystem walk, and the walk
 * itself stops at the AS root (inclusive): AS could not have placed a
 * shared symlink outside its own tree, so a target outside it is
 * never a collision candidate — regardless of an unrelated ancestor
 * symlink further up the filesystem (e.g. macOS's `/var` ->
 * `/private/var`, `/tmp` -> `/private/tmp`). Without this bound, an
 * unrouted write target (AC not yet wired to a profile-scoped config
 * root — see Phase 3) would walk all the way to the filesystem root
 * looking for a symlink that could never be AS's.
 */
export function sharedWriteTarget(target: string, env: NodeJS.ProcessEnv = process.env): string | null {
    const profile = detectAgentSwitchProfile(env);
    if (!profile.active) return null;

    const root = resolveAgentSwitchRoot(env);
    const absTarget = path.resolve(target);
    if (root === null || !isInsideRoot(absTarget, root)) return null;

    let current = absTarget;
    for (let depth = 0; depth < MAX_WALK_DEPTH; depth++) {
        if (isSymlink(current)) return current;
        if (current === root) return null;
        const parent = path.dirname(current);
        if (parent === current) return null; // filesystem root reached — should not happen once bounded by root
        current = parent;
    }
    return null;
}

/**
 * Resolve `target` all the way through any symlinks on its path,
 * tolerating a not-yet-existing leaf (or a not-yet-existing chain of
 * ancestors) by resolving the nearest existing ancestor and
 * re-appending the missing segments verbatim. Used by the write
 * routes so a confirmed shared write lands on the real file a
 * detected symlink points at, rather than replacing the symlink
 * itself with a private copy.
 */
export function resolveThroughSymlinks(target: string): string {
    const abs = path.resolve(target);
    try {
        return realpathSync(abs);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        const parent = path.dirname(abs);
        if (parent === abs) return abs; // filesystem root; nothing left to resolve
        const base = path.basename(abs);
        return path.join(resolveThroughSymlinks(parent), base);
    }
}
