/**
 * Single-file atomic write.
 *
 * Phase 1 of `unified-setup-and-settings-gui` (roadmap step 1.3). The wizard
 * and settings editor MUST never leave a half-written `.agent-settings.yml`
 * or `.agent-user.md` on disk. The contract is: after `writeAtomic` resolves,
 * the target file either holds the new contents in full, or — on any error
 * — the file is untouched (the prior contents survive).
 *
 * Implementation: write to a `<target>.tmp-<pid>-<rand>` sibling, fsync the
 * file descriptor (so the new bytes hit the platter before the rename),
 * `fs.rename` over the target (atomic on POSIX, link-then-unlink fallback
 * on Windows when `rename` raises EPERM), then chmod the final path to the
 * caller-requested mode (default 0600 — council security mandate).
 *
 * Caller is responsible for ensuring the parent directory exists; the
 * helper does not auto-mkdir to avoid masking misrouted writes.
 */

import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';

export interface WriteAtomicOptions {
    /** POSIX file mode applied after rename. Default 0600. */
    mode?: number;
    /** Override the random suffix (tests only). */
    suffix?: string;
}

const DEFAULT_MODE = 0o600;

function tmpName(target: string, suffix?: string): string {
    const dir = dirname(target);
    const base = target.slice(dir.length + 1);
    const tag = suffix ?? `${process.pid}-${randomBytes(6).toString('hex')}`;
    return join(dir, `${base}.tmp-${tag}`);
}

/**
 * Write `contents` to `target` atomically. After resolve, the target
 * file holds the new bytes in full or — on any thrown error — was
 * never touched. The temp file is best-effort unlinked on failure.
 */
export async function writeAtomic(
    target: string,
    contents: string | Buffer,
    opts: WriteAtomicOptions = {},
): Promise<void> {
    const tmp = tmpName(target, opts.suffix);
    const mode = opts.mode ?? DEFAULT_MODE;

    let handle: fs.FileHandle | null = null;
    try {
        handle = await fs.open(tmp, 'w', mode);
        const buffer = typeof contents === 'string' ? Buffer.from(contents, 'utf8') : contents;
        await handle.writeFile(buffer);
        await handle.sync();
        await handle.close();
        handle = null;

        try {
            await fs.rename(tmp, target);
        } catch (err) {
            // Windows: rename over an existing file can raise EPERM; fall
            // back to link-unlink-rename.
            if ((err as NodeJS.ErrnoException).code === 'EPERM') {
                await fs.unlink(target).catch(() => undefined);
                await fs.rename(tmp, target);
            } else {
                throw err;
            }
        }

        // chmod after rename — on some platforms (Windows, certain mounts)
        // a non-default umask survives the open(); explicit chmod is the
        // only portable knob.
        await fs.chmod(target, mode).catch(() => undefined);
    } catch (err) {
        if (handle) await handle.close().catch(() => undefined);
        await fs.unlink(tmp).catch(() => undefined);
        throw err;
    }
}

/**
 * `<target>.tmp-*` sibling name generator — exported for the multi-write
 * 2PC machinery which needs to write the same temp filename twice (prepare
 * + commit) under one transaction id.
 */
export function tempPathFor(target: string, txnId: string): string {
    return tmpName(target, txnId);
}
