/**
 * Concurrency-safe state writes for hook concerns.
 *
 * TypeScript twin of `src/scripts/hooks/state_io.py` (ADR-094 —
 * Python→TS migration, Phase 6 / hooks core). Public API mirrors the
 * Python module exactly (snake_case kept deliberately — fidelity over
 * TS idiom).
 *
 * Per `docs/contracts/hook-architecture-v1.md` § Concurrency, every concern
 * that writes under `agents/runtime/state/` MUST:
 *
 * 1. Acquire an exclusive lock on `agents/runtime/state/.dispatcher.lock`.
 * 2. Write to a sibling `<dest>.tmp.<pid>` file in the same directory.
 * 3. Rename(2) (atomic on the same filesystem) tmp → dest.
 * 4. Release the lock.
 *
 * The single shared lock is intentional: serialising state writes across
 * concerns is cheaper than per-file locks, and concerns already run
 * sequentially within one dispatcher invocation. Concurrent dispatcher
 * invocations (e.g. two platforms firing into the same workspace) are the
 * case this lock guards.
 *
 * Cross-platform notes
 * --------------------
 * - Node has no `flock`. We emulate the exclusive lock with an
 *   `O_CREAT | O_EXCL` lockfile (`.dispatcher.lock`) acquired with a
 *   bounded spin, then released by truncating back to empty so the
 *   sentinel file still lives alongside the target (the Python `fcntl`
 *   path leaves the lock file in place too). The atomic publish is the
 *   `renameSync`; torn-write risk is bounded the same way as POSIX.
 * - The lock file lives under `agents/runtime/state/` which is gitignored.
 * - The lock is process-scoped, not session-scoped: each call opens,
 *   locks, writes, releases, closes. No long-lived file handles.
 */

import fs from "node:fs";
import path from "node:path";

export const LOCK_BASENAME = ".dispatcher.lock";

export const REPLAY_ENV_VAR = "AGENT_CONFIG_REPLAY";

export const FEEDBACK_DIRNAME = ".dispatcher";

/**
 * True when the caller signalled read-only fixture replay.
 *
 * Concerns and the dispatcher honour the flag by skipping side
 * effects under `agents/runtime/state/` (and any other concern-owned state
 * surface). See `docs/contracts/hook-architecture-v1.md` § Replay mode.
 */
export function is_replay_mode(): boolean {
  return (process.env[REPLAY_ENV_VAR] ?? "").trim() === "1";
}

function _lock_path(state_dir: string): string {
  return path.join(state_dir, LOCK_BASENAME);
}

// Python json.dumps(payload, indent=2) byte-for-byte: indent of 2 spaces,
// ", " collapses to ",\n<indent>" with separators (",", ": "), and
// ensure_ascii=True (default) escapes every non-ASCII codepoint as \uXXXX.
function _py_json_dumps(value: unknown, indent: number): string {
  const pad = " ".repeat(indent);

  const escapeString = (s: string): string => {
    let out = '"';
    for (const ch of s) {
      const code = ch.codePointAt(0) as number;
      switch (ch) {
        case '"':
          out += '\\"';
          break;
        case "\\":
          out += "\\\\";
          break;
        case "\n":
          out += "\\n";
          break;
        case "\r":
          out += "\\r";
          break;
        case "\t":
          out += "\\t";
          break;
        case "\b":
          out += "\\b";
          break;
        case "\f":
          out += "\\f";
          break;
        default:
          if (code < 0x20 || code > 0x7e) {
            // ensure_ascii: escape control chars AND all non-ASCII.
            if (code > 0xffff) {
              // Surrogate pair (matches Python's UTF-16 \uXXXX\uXXXX).
              const c = code - 0x10000;
              const hi = 0xd800 + (c >> 10);
              const lo = 0xdc00 + (c & 0x3ff);
              out +=
                "\\u" +
                hi.toString(16).padStart(4, "0") +
                "\\u" +
                lo.toString(16).padStart(4, "0");
            } else {
              out += "\\u" + code.toString(16).padStart(4, "0");
            }
          } else {
            out += ch;
          }
      }
    }
    return out + '"';
  };

  const render = (v: unknown, depth: number): string => {
    if (v === null || v === undefined) {
      return "null";
    }
    if (typeof v === "boolean") {
      return v ? "true" : "false";
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v)) {
        // Python json.dumps emits Infinity/NaN bare; not expected for
        // state payloads, but mirror it rather than throw.
        if (Number.isNaN(v)) return "NaN";
        return v > 0 ? "Infinity" : "-Infinity";
      }
      return String(v);
    }
    if (typeof v === "string") {
      return escapeString(v);
    }
    const curPad = pad.repeat(depth + 1);
    const closePad = pad.repeat(depth);
    if (Array.isArray(v)) {
      if (v.length === 0) {
        return "[]";
      }
      const items = v.map((item) => curPad + render(item, depth + 1));
      return "[\n" + items.join(",\n") + "\n" + closePad + "]";
    }
    if (typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        return "{}";
      }
      const items = keys.map(
        (k) => curPad + escapeString(k) + ": " + render(obj[k], depth + 1),
      );
      return "{\n" + items.join(",\n") + "\n" + closePad + "}";
    }
    // Fallback for unsupported types (mirrors Python TypeError loosely).
    throw new TypeError(`Object of type ${typeof v} is not JSON serializable`);
  };

  return render(value, 0);
}

/**
 * Write `payload` as JSON to `target` atomically and concurrency-safely.
 *
 * `target` MUST sit under an `agents/runtime/state/` directory (or any other
 * directory the caller treats as the lock scope). The lock file is
 * `<target.parent>/.dispatcher.lock`. Caller does not need to create
 * the directory in advance — this function ensures it.
 *
 * Under `AGENT_CONFIG_REPLAY=1` the call is a no-op so fixture
 * replay never mutates real session state.
 */
export function atomic_write_json(
  target: string,
  payload: unknown,
  options: { indent?: number } = {},
): void {
  if (is_replay_mode()) {
    return;
  }
  const indent = options.indent ?? 2;
  const targetPath = path.resolve(target);
  const state_dir = path.dirname(targetPath);
  fs.mkdirSync(state_dir, { recursive: true });
  const body = _py_json_dumps(payload, indent) + "\n";
  _atomic_write_text(targetPath, body);
}

/**
 * Write text to `target` atomically and concurrency-safely. Same
 * locking discipline as `atomic_write_json` — useful for non-JSON
 * state payloads (chat-history transcript, status text).
 *
 * Under `AGENT_CONFIG_REPLAY=1` the call is a no-op.
 */
export function atomic_write_text(target: string, text: string): void {
  if (is_replay_mode()) {
    return;
  }
  const targetPath = path.resolve(target);
  const state_dir = path.dirname(targetPath);
  fs.mkdirSync(state_dir, { recursive: true });
  _atomic_write_text(targetPath, text);
}

function _acquire_lock(lock_path: string): number {
  // Open (and keep) the sentinel lock file with O_CREAT | O_RDWR — never
  // truncated, just an fd, exactly like the Python fcntl path. The file
  // stays on disk alongside the target after release.
  const fd = fs.openSync(lock_path, "a", 0o644);
  // Cross-process mutual exclusion: Node has no flock, so we spin on an
  // O_EXCL companion (`.held`) with a bounded deadline. The companion is
  // removed on release; the visible `.dispatcher.lock` sentinel is kept.
  const held = lock_path + ".held";
  const deadlineMs = 5000;
  const start = Date.now();
  for (;;) {
    try {
      const heldFd = fs.openSync(held, "wx", 0o644);
      fs.closeSync(heldFd);
      return fd;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        // Unexpected error — proceed without the companion guard rather
        // than wedge the never-block hook contract.
        return fd;
      }
      if (Date.now() - start > deadlineMs) {
        // Stale companion — reclaim it. Never block the agent loop.
        try {
          fs.rmSync(held, { force: true });
        } catch {
          /* ignore */
        }
        continue;
      }
      // Busy-wait briefly (Atomics gives a real sleep without async).
      const sab = new Int32Array(new SharedArrayBuffer(4));
      Atomics.wait(sab, 0, 0, 2);
    }
  }
}

function _release_lock(fd: number, lock_path: string): void {
  try {
    fs.closeSync(fd);
  } catch {
    /* ignore */
  }
  // Drop the O_EXCL companion so the next writer can re-acquire; the
  // visible `.dispatcher.lock` sentinel is left in place (the fcntl path
  // keeps its lock file alongside the target too).
  try {
    fs.rmSync(lock_path + ".held", { force: true });
  } catch {
    /* ignore */
  }
}

function _atomic_write_text(target: string, text: string): void {
  const tmp = target + `.tmp.${process.pid}`;
  const lock_path = _lock_path(path.dirname(target));
  const fd = _acquire_lock(lock_path);
  try {
    fs.writeFileSync(tmp, text, { encoding: "utf-8" });
    fs.renameSync(tmp, target);
  } finally {
    _release_lock(fd, lock_path);
  }
}

/**
 * Return the per-session feedback directory under state_root.
 *
 * Layout:
 *     <state_root>/.dispatcher/<session_id>/
 *         <concern>.json     — one per concern that ran
 *         summary.json       — rollup written by the dispatcher
 *
 * Per Council Round 2 (2026-05-04): exit-code reduction collapses
 * multiple concern signals into a single platform-native code; the
 * feedback dir surfaces the per-concern detail to humans and
 * `task hooks-status` without re-routing control flow.
 */
export function feedback_dir(state_root: string, session_id: string): string {
  let safe_session = session_id || "unknown-session";
  // Defence-in-depth: refuse path traversal in session_id.
  safe_session = safe_session
    .replace(/\//g, "_")
    .replace(/\\/g, "_")
    .replace(/\.\./g, "_");
  return path.join(state_root, FEEDBACK_DIRNAME, safe_session);
}
