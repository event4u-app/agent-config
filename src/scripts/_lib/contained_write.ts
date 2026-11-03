/**
 * Writes that cannot be redirected outside a repository by a symlink it ships.
 *
 * A repository can commit `agents/map` (or any folder under it) as a symlink;
 * a write that follows it lands wherever the link points. Every component from
 * the repository root down to the target's folder must be a real directory
 * (lstat, never followed), and the final component is opened with O_NOFOLLOW,
 * so a symlink there fails the open instead of being followed.
 *
 * What this does NOT close: a concurrent process replacing a checked folder
 * with a symlink between the check and the write. Node has no openat-style
 * descriptor walk, so the window is narrowed (checked before and after the
 * folder is created), not removed.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** True for a directory that is not a symlink. */
export function isRealDir(p: string): boolean {
    try {
        const st = fs.lstatSync(p);
        return st.isDirectory() && !st.isSymbolicLink();
    } catch {
        return false;
    }
}

/**
 * Whether every component from `root` down to `dir` that exists is a real
 * directory. Components that do not exist yet pass: the caller creates them.
 */
export function containedPath(root: string, dir: string): boolean {
    const rel = path.relative(root, dir);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
    let at = root;
    for (const part of rel.split(path.sep)) {
        at = path.join(at, part);
        try {
            fs.lstatSync(at);
        } catch {
            return true;
        }
        if (!isRealDir(at)) return false;
    }
    return true;
}

/**
 * Writes `content` to `file` inside `root`, creating its folder; false when any
 * component is not a real directory, the target is a symlink, or the write fails.
 */
export function writeContained(root: string, file: string, content: string): boolean {
    const dir = path.dirname(file);
    if (!containedPath(root, dir)) return false;
    try {
        fs.mkdirSync(dir, { recursive: true });
        if (!containedPath(root, dir)) return false;
        const { O_WRONLY, O_CREAT, O_TRUNC, O_NOFOLLOW } = fs.constants;
        const fd = fs.openSync(file, O_WRONLY | O_CREAT | O_TRUNC | (O_NOFOLLOW ?? 0), 0o644);
        try {
            fs.writeFileSync(fd, content);
        } finally {
            fs.closeSync(fd);
        }
        return true;
    } catch {
        return false;
    }
}
