/**
 * Atomic file-write primitive shared by lockfile-schema-v2 writers.
 *
 * TypeScript twin of `src/scripts/_lib/fs_atomic.py` (ADR-094 — Python→TS
 * migration, Phase 2 / Wave 1). Public API mirrors the Python module
 * exactly (snake_case kept deliberately — fidelity over TS idiom).
 *
 * Guarantees, in order:
 *
 * 1. Write to `.<name>.tmp.<rand>` in the same directory as the target.
 *    Same-directory keeps the final rename atomic on every POSIX
 *    filesystem we support; cross-fs renames are not atomic.
 * 2. `fsync(tmp_fd)` flushes the file's data + metadata to disk before
 *    we let the temp file become the visible target.
 * 3. `fs.renameSync(tmp, path)` is the atomic rename (POSIX rename(2),
 *    same semantics as Python's `os.replace`). Either the old or the
 *    new content is visible to readers; never a half-written mix.
 * 4. `fsync(parent_dir_fd)` durably commits the directory entry so a
 *    crash immediately after the rename does not resurrect the old file
 *    on next boot. Skipped on platforms where directory fsync is
 *    unsupported (Windows) — the rename is still atomic from the
 *    filesystem's perspective, only durability across power loss is
 *    weaker there.
 *
 * The temp file is always cleaned up on failure, so a throw mid-write
 * never leaves orphaned `.tmp.*` siblings behind.
 */

import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export interface WriteAtomicOptions {
  /** Text encoding used when `data` is a string. Default: "utf-8". */
  encoding?: string;
}

/**
 * Normalise a Python-style codec name to a Node `BufferEncoding`.
 * Accepts e.g. "utf-8", "latin-1", "UTF8". Throws when unsupported —
 * mirroring Python's `LookupError` for unknown codecs.
 */
function _normalize_encoding(encoding: string): BufferEncoding {
  const compact = encoding.toLowerCase().replace(/[-_\s]/g, "");
  const candidates: string[] = [encoding, compact];
  // Common Python aliases → Node names.
  if (compact === "latin1" || compact === "iso88591") candidates.push("latin1");
  if (compact === "utf8") candidates.push("utf8");
  if (compact === "utf16le" || compact === "utf16") candidates.push("utf16le");
  if (compact === "usascii") candidates.push("ascii");
  for (const c of candidates) {
    if (Buffer.isEncoding(c)) return c as BufferEncoding;
  }
  throw new Error(`unknown encoding: ${encoding}`);
}

/**
 * Atomically write `data` to `p`; return the target path.
 *
 * `data` may be a `string` (encoded via `options.encoding`) or binary
 * (`Uint8Array` / `Buffer`, written verbatim, `encoding` ignored). The
 * parent directory is created if missing — callers don't have to
 * `mkdir` beforehand.
 *
 * On failure (any error thrown by the OS during write / fsync /
 * rename), the temporary file is unlinked and the original target —
 * if any — is untouched. The error propagates so callers can
 * distinguish disk-full from permission errors etc.
 */
export function write_atomic(
  p: string,
  data: string | Uint8Array,
  options: WriteAtomicOptions = {},
): string {
  const encoding = options.encoding ?? "utf-8";
  const target = path.normalize(p);
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });

  let payload: Buffer;
  if (typeof data === "string") {
    payload = Buffer.from(data, _normalize_encoding(encoding));
  } else if (data instanceof Uint8Array) {
    payload = Buffer.from(data);
  } else {
    throw new TypeError(
      `write_atomic: data must be str or bytes, got ${typeof data}`,
    );
  }

  // mkstemp equivalent: exclusive-create a random sibling, mode 0600.
  let fd: number | null = null;
  let tmp_path = "";
  for (let attempt = 0; attempt < 32; attempt += 1) {
    tmp_path = path.join(
      parent,
      `.${path.basename(target)}.tmp.${randomBytes(6).toString("hex")}`,
    );
    try {
      fd = fs.openSync(tmp_path, "wx", 0o600);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") continue;
      throw err;
    }
  }
  if (fd === null) {
    throw new Error("write_atomic: could not create a unique temp file");
  }

  let closed = false;
  try {
    let offset = 0;
    while (offset < payload.length) {
      offset += fs.writeSync(fd, payload, offset, payload.length - offset);
    }
    try {
      fs.fsyncSync(fd);
    } catch {
      // File-level fsync unsupported (e.g. some tmpfs).
      // Continue — the rename is still atomic.
    }
    fs.closeSync(fd);
    closed = true;
    fs.renameSync(tmp_path, target);
  } catch (err) {
    if (!closed) {
      try {
        fs.closeSync(fd);
      } catch {
        // Best effort — the unlink below is what matters.
      }
    }
    try {
      fs.unlinkSync(tmp_path);
    } catch {
      // Temp file may never have materialised; ignore.
    }
    throw err;
  }

  _fsync_dir(parent);
  return target;
}

/**
 * Best-effort directory fsync; silent no-op on unsupported platforms.
 *
 * Directory fsync is required on POSIX for the rename's durability
 * across power loss. Windows does not expose `open(dir)` /
 * `fsync(dir_fd)` semantics — the kernel commits the directory entry
 * implicitly. We swallow the error there rather than fail the write.
 */
function _fsync_dir(directory: string): void {
  let dir_fd: number;
  try {
    dir_fd = fs.openSync(directory, fs.constants.O_RDONLY);
  } catch {
    return;
  }
  try {
    try {
      fs.fsyncSync(dir_fd);
    } catch {
      // Some filesystems / mounts reject directory fsync.
      // The rename is still atomic — durability is weaker but
      // the write is not corrupted.
    }
  } finally {
    fs.closeSync(dir_fd);
  }
}
