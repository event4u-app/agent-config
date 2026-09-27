/**
 * Filesystem primitives shared by the installer and its conflict tracker.
 *
 * These four moved out of `src/scripts/install.ts` when `conflictTracker.ts`
 * needed them. The tracker cannot import the installer — that is a cycle — and
 * re-declaring `pathExists` / `sha256OfFile` beside it would put two
 * definitions of "does this file exist" and "what are its bytes" on the same
 * install path, which is the one place they have to agree. Passing them in as
 * callbacks was the other option and it buys nothing: they are pure, total
 * functions of their arguments carrying no installer state, so a shared module
 * is both the smaller wiring and the more honest unit.
 *
 * The selection rule is exactly that — shared with `conflictTracker.ts`. The
 * installer's other private helpers (`expanduser`, `isDir`, `readText`, …) stay
 * where they are; moving them too would be a restructure this change does not
 * need and cannot justify.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** `Path.resolve()` — absolute, symlink-resolved where possible. */
export function resolvePath(p: string): string {
    try {
        return fs.realpathSync(path.resolve(p));
    } catch {
        return path.resolve(p);
    }
}

export function pathExists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** `path.mkdir(parents=True, exist_ok=True)`. */
export function mkdirp(p: string): void {
    fs.mkdirSync(p, { recursive: true });
}

/** `hashlib.sha256(data).hexdigest()` of a file's bytes, or null when unreadable. */
export function sha256OfFile(p: string): string | null {
    let data: Buffer;
    try {
        data = fs.readFileSync(p);
    } catch {
        return null;
    }
    return crypto.createHash('sha256').update(data).digest('hex');
}
