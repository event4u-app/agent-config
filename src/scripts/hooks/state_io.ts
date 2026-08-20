/**
 * Concurrency-safe state writes for hook concerns.
 *
 * Ported from the retired Python `src/scripts/hooks/state_io.py` (ADR-200 —
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

import { createHash } from "node:crypto";
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

/**
 * Publish `text` at `target` atomically. CALLER MUST HOLD THE LOCK.
 *
 * Split out of `_atomic_write_text` so a read-modify-write can hold ONE lock
 * across all three steps. The `O_EXCL` companion in `_acquire_lock` is not
 * reentrant: nesting an acquire inside a held lock spins to the 5-second
 * deadline, reclaims its own companion as stale, and proceeds — so it would
 * "work" while costing five seconds per call and silently dropping the mutual
 * exclusion it was there for. That is why this is a separate function rather
 * than a nested call.
 */
function _publish_text_locked(target: string, text: string): void {
  const tmp = target + `.tmp.${process.pid}`;
  fs.writeFileSync(tmp, text, { encoding: "utf-8" });
  fs.renameSync(tmp, target);
}

function _atomic_write_text(target: string, text: string): void {
  const lock_path = _lock_path(path.dirname(target));
  const fd = _acquire_lock(lock_path);
  try {
    _publish_text_locked(target, text);
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

/**
 * ── Per-session concern state ────────────────────────────────────────────────
 *
 * WHY THIS LIVES HERE, and why it is shared rather than copied.
 *
 * A concern that keeps ONE state file per project root shares that file with
 * every concurrent session — and in this repo's worktree workflow
 * `CLAUDE_PROJECT_DIR` resolves to the PARENT checkout, so "one per project
 * root" means one across every worktree at once. Two failures follow, and they
 * are opposites, which is why neither is obviously a bug from inside one
 * session:
 *
 *   - A WRONG READ. Session B reads a fact session A recorded. Measured
 *     2026-08-20 (session 15b9ac52): a terse German "1" read a neighbouring
 *     English session's language pin and injected
 *     `Reply language for this turn: English.` into a German conversation.
 *
 *   - A LOST WRITE. Both sessions write through `atomic_write_json`
 *     (write + rename), so the later rename discards the earlier state
 *     entirely.
 *
 * A "session boundary reset" — noticing a foreign `session_id` INSIDE the file
 * and clearing the counters — is the guard that looks like a fix and is not.
 * It is written for SEQUENTIAL sessions (A ends, B starts). Under CONCURRENT
 * sessions it becomes the damage: each read sees the other's id, resets, and
 * writes, so the two sessions erase each other's evidence in a loop. The AI
 * council said the same thing about `_ownsPin` in the language hook (round 2,
 * BLOCKER 1): a guard catches the collision only AFTER the fact, and cannot
 * stop the other session's file from being replaced.
 *
 * The property that actually holds comes from the DIGEST, not from the
 * directory layout — stating it the other way round is how that defect survived
 * a round of review. Two distinct ids cannot address one file because
 * sha256 does not collide in practice, and a sanitiser DOES: the first cut of
 * this keyed on a character replacement, under which `a/b` and `a_b` were one
 * file.
 *
 * Deliberately NOT retrofitted onto `feedback_dir` above, which carries the
 * same sanitiser shape (`a/b` and `a_b` → one directory, `''` →
 * `unknown-session`). That is a real instance of this class and it is left
 * alone here on scope grounds: its per-concern files collide into a merged
 * feedback view rather than destroying a pin, and changing the on-disk layout
 * of the dispatcher feedback surface needs its own change and its own
 * `task hooks-status` verification.
 */

/**
 * Is there a stable identity to key state on at all?
 *
 * An empty or whitespace id is NOT a bucket to share. Sanitising it into a
 * literal like `unknown-session` puts every id-less invocation in one file with
 * no secondary defense left, which is the original defect restored in the one
 * case that had no guard (language hook, council round 2, BLOCKER 2). There is
 * no sound local way to tell two id-less sessions apart — a fresh UUID per
 * invocation would give one session a new file per hook call, destroying
 * continuity rather than providing it — so the honest answer is for callers to
 * run stateless: derive what this turn needs from this turn's input, persist
 * nothing.
 */
export function has_stable_session_id(session_id: unknown): boolean {
  return typeof session_id === "string" && session_id.trim() !== "";
}

/**
 * Path of one session's state file inside `dir`, keyed on a digest of the FULL id.
 *
 * The digest also removes the filename-length failure mode for unusually long
 * ids. Callers keep an in-file `session_id` as a cheap integrity check — it now
 * guards against a stale or hand-copied file rather than against a collision.
 */
export function session_state_file(dir: string, session_id: string): string {
  const digest = createHash("sha256").update(session_id, "utf8").digest("hex").slice(0, 32);
  return path.join(dir, `${digest}.json`);
}

/**
 * Put a claimed state file back at its live path, without ever overwriting.
 *
 * THE CRITICAL SECTION of the pruner. Council round 3, both seats independently:
 * the previous `existsSync(full)` then `renameSync(tomb, full)` was a TOCTOU
 * window — the owner could create `full` between the two calls, and POSIX
 * `rename` then replaced that fresh file with the pruner's older copy. Losing a
 * live pin to the component whose whole job is to protect it.
 *
 * `link` closes it because it is atomic and refuses to clobber: it either
 * creates the live name (nothing was there — restoring is right) or fails
 * `EEXIST` (the owner won the race — its file is newer than ours by
 * construction, and dropping our copy is right). There is no third outcome and
 * no window between deciding and acting, which is the difference from the code
 * this replaces.
 *
 * `rm` afterwards removes only the tombstone NAME; on the success path the
 * content stays reachable through the live path it is now also linked to.
 *
 * Exported for its own tests. What those tests can and cannot establish is
 * stated at them: the difference from the code this replaces is visible ONLY
 * under real concurrency, so they pin the post-condition (a restore never
 * changes an existing live file) rather than claiming to stage the race.
 *
 * FILESYSTEMS WITHOUT HARD LINKS fall back to the racy sequence, deliberately.
 * The peer-review round asked for this before accepting `link` as the fix, and
 * it was the one condition of the three not already met: `linkSync` is the
 * tree's first, `engines` only pins Node >= 20.11, and `installation.md` names
 * Windows — so a share, a FUSE mount, or a restricted container can answer
 * `EPERM` / `ENOSYS` / `EXDEV` / `EOPNOTSUPP` / `EMLINK`. Throwing there would
 * be caught by the pruner's outer handler and leave the tombstone behind, which
 * loses a FRESH pin outright. The fallback narrows the window to the same one
 * this fix removes elsewhere — strictly better than a guaranteed loss, and the
 * only honest option where the atomic primitive is unavailable.
 */
export function restore_claimed_state(
  tomb: string,
  live: string,
  /** Injectable so the no-hard-link fallback is reachable without one. */
  link: (from: string, to: string) => void = fs.linkSync,
): void {
  try {
    link(tomb, live);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // EEXIST → the owner wrote a newer file; ENOENT → a peer pruner already
    // resolved this tombstone. Both mean the live path is already correct.
    if (code !== "EEXIST" && code !== "ENOENT") {
      if (!NO_HARD_LINK_CODES.has(code ?? "")) throw err;
      // Degraded path: check-then-act, the race this fix closes where `link`
      // works. Kept narrow — nothing else is available here.
      if (!fs.existsSync(live)) {
        fs.renameSync(tomb, live);
        return;
      }
    }
  }
  fs.rmSync(tomb, { force: true });
}

/** Errors that mean "this filesystem cannot hard-link", not "the link failed". */
const NO_HARD_LINK_CODES = new Set(["EPERM", "ENOSYS", "EXDEV", "EOPNOTSUPP", "EMLINK"]);

/**
 * Drop session states in `dir` untouched for longer than `retention_days`.
 *
 * One file per session is unbounded growth otherwise. Call this on a
 * once-per-turn path (a prompt or session event), never per tool call.
 *
 * `mtime_of` is injectable for the same reason the language hook injects it:
 * the claim-then-revalidate branch below only runs when the candidate check and
 * the post-claim check DISAGREE, and that disagreement is a race no
 * cutoff-only test can stage. A test that cannot enter the branch would pass
 * against an implementation that does not have it.
 */
export function prune_stale_session_states(
  dir: string,
  now_ms: number,
  retention_days: number,
  mtime_of: (target: string) => number = (target) => fs.statSync(target).mtimeMs,
): number {
  if (is_replay_mode()) return 0;
  const cutoff = now_ms - retention_days * 24 * 60 * 60 * 1000;
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return 0; // no directory yet
  }
  let removed = 0;
  let claim = 0;

  // Tombstones a crashed pruner left behind. Council round 3, both seats: a
  // crash between the claim rename and the restore stranded the file under a
  // name nothing reads (it no longer ends in `.json`) and nothing prunes — and
  // when the candidate had been refreshed under the pruner, that tombstone held
  // the CURRENT state while the live path was gone for good.
  //
  // No grace period, deliberately: `rename` preserves mtime, so a tombstone
  // carries the age of its CONTENT, not of the claim. That is the property this
  // needs. A tombstone another pruner is holding right now is judged on exactly
  // the same evidence its holder will use, and both orders end at the same
  // place — the loser's `link` hits EEXIST or its `rm` is a no-op.
  for (const name of entries) {
    const orphan = /^(.+\.json)\.\d+\.\d+\.tomb$/.exec(name);
    const live_name = orphan?.[1];
    if (live_name === undefined) continue;
    const tomb = path.join(dir, name);
    const live = path.join(dir, live_name);
    try {
      if (mtime_of(tomb) >= cutoff) {
        restore_claimed_state(tomb, live);
        continue;
      }
      fs.rmSync(tomb, { force: true });
      removed += 1;
    } catch {
      // Vanished under us, or a peer pruner got there first. Costs disk, never
      // state.
    }
  }

  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const full = path.join(dir, name);
    try {
      if (mtime_of(full) >= cutoff) continue;

      // `stat` then `rm` is a race that can delete a FRESH file: the pruner
      // observes a stale mtime, the owning session resumes and atomically
      // replaces that pathname, and the delete then removes the NEW state —
      // losing the pin of an actively resumed session (language hook, council
      // round 2, BLOCKER 3). Writing before pruning only stops the current
      // invocation from eating its own file; it does nothing about a
      // concurrent one.
      //
      // Claim-then-revalidate instead: rename the candidate OUT of the live
      // path first, so any writer arriving afterwards simply creates the path
      // anew and is unaffected. Then re-stat what was actually claimed — a
      // writer that landed between the stat and the rename means the claimed
      // file is fresh, and it goes back (or is dropped, if the writer has since
      // written a newer file at the live path).
      claim += 1;
      const tomb = `${full}.${process.pid}.${claim}.tomb`;
      fs.renameSync(full, tomb);
      if (mtime_of(tomb) >= cutoff) {
        restore_claimed_state(tomb, full);
        continue;
      }
      fs.rmSync(tomb, { force: true });
      removed += 1;
    } catch {
      // A file that vanished under us, an unreadable stat, or a rename another
      // pruner won — skip it. A failed prune costs disk, never a turn, and
      // never another session's state.
    }
  }
  return removed;
}

/**
 * Remove a pre-split single state file once the per-session layout owns the tree.
 *
 * NOT a migration: a new session has no state to inherit anyway, so there is
 * nothing in the old file worth carrying across — and carrying it across would
 * reintroduce exactly the cross-session read the split closed, since that file
 * is the shared one. Leaving it in place leaves dead state that looks live to
 * anyone reading the directory.
 *
 * MIXED-VERSION EXPOSURE, measured rather than assumed. A cross-model review
 * (2026-08-20) flagged this as destroying the live state of an older bundle that
 * is still writing the single file — and the callers' own comments claimed
 * exactly that scenario, which is what made the finding land. Both were written
 * without checking, so here is the check: the shipped hook command resolves the
 * dispatcher as `$CLAUDE_PROJECT_DIR/node_modules/@event4u/agent-config/dist/hooks/dispatch.js`,
 * falling back to `$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js`. `CLAUDE_PROJECT_DIR`
 * is the PARENT checkout even in a worktree session, so every concurrent session
 * under one project — worktrees included — executes ONE bundle and writes ONE
 * state tree. There is no steady state in which two versions run side by side,
 * which is why the deletion is safe in the case the review had in mind.
 *
 * What DOES remain is a narrow window, and it is real: a hook process that
 * already loaded the previous bundle and is still running when the file is
 * replaced. It writes by the old layout, a concurrent new-bundle session deletes
 * that file, and one turn's evidence is lost. Bounded to a turn, self-healing on
 * the next write, and confined to the moment of a rebuild or `npm install`. It is
 * NOT bounded by anything in this function — that is a property of the deployment
 * shape, so if the shape changes (a per-worktree `node_modules`, a long-lived
 * hook daemon) this deletion needs a version marker or a grace period.
 */
export function prune_legacy_state_file(target: string): void {
  if (is_replay_mode()) return;
  try {
    if (fs.statSync(target).isFile()) {
      fs.rmSync(target, { force: true });
    }
  } catch {
    // Absent or unreadable — nothing to prune.
  }
}

/**
 * Does a loaded session-state object belong to `session_id`?
 *
 * THE DIGEST PATH IS NOT THE WHOLE GUARANTEE, which is the correction this
 * function exists to carry. `session_state_file` says callers "keep an in-file
 * `session_id` as a cheap integrity check" — and a cross-model review
 * (2026-08-20, both seats, blocking) found the two `turn-end-gate` readers
 * consuming state without ever making that check, so the sentence described a
 * discipline no consumer followed. A file that arrives at the wrong digest path
 * by a copy, a restore, a hand-edit, or a buggy writer was accepted whole; the
 * sharp case is a foreign `ci_last: {settled: true}`, which vouches for a CI run
 * this session never made and lets a premature completion claim through a
 * BLOCKING gate.
 *
 * EXACT match, and an absent owner is foreign. There is no compatibility window
 * to honour: the digest layout has never shipped for either concern, so no
 * deployed version ever wrote an ownerless hashed file — a permissive branch
 * would be dead code that weakens the guarantee its own doc comment states.
 * (The language hook's `_ownsPin` learned this in its round 3 and now delegates
 * here.)
 */
export function owns_session_state(state: unknown, session_id: string): boolean {
  if (typeof state !== "object" || state === null || Array.isArray(state)) return false;
  return (state as Record<string, unknown>)["session_id"] === session_id;
}

/**
 * Read a JSON state file, mutate it, and write it back — the WHOLE sequence
 * under one lock.
 *
 * WHY THIS EXISTS. `atomic_write_json` makes the *publish* atomic; it does not
 * make load → update → publish atomic. A cross-model review (2026-08-20, both
 * seats) named the consequence, and it is not hypothetical on a host that runs
 * tool calls in parallel: two `post_tool_use` invocations for the SAME session
 * both load counter 149, both compute 150, both publish 150, and one event is
 * gone. Per-session filenames fix cross-session reads and do nothing for this —
 * the two failures are independent, and fixing the first made the second easier
 * to mistake for solved.
 *
 * The worse shape is a lost FIELD rather than a lost increment: a snapshot
 * loaded at the start of a hook run, spread into a write at the end
 * (`{...previous, one_field: x}`), silently republishes every OTHER field as it
 * looked at load time — so a newer value written in between is reverted, not
 * merely missed.
 *
 * `mutate` receives the state as loaded INSIDE the lock and returns what to
 * write. Returning `null` writes nothing (and still counts as success), so a
 * caller that decides against the write after seeing fresh state does not have
 * to publish a no-op.
 *
 * Returns whether the write landed. The boolean is load-bearing for any caller
 * with a reset-then-emit pattern: a reset that did not land leaves a counter at
 * its threshold, so emitting anyway re-fires on every subsequent call. Callers
 * are expected to stay silent on `false` rather than assume success.
 *
 * Under `AGENT_CONFIG_REPLAY=1` this reports `false` without touching the tree —
 * the same no-op contract as the writers above, reported as a failed write so
 * fail-closed callers stay silent instead of acting on a write that never
 * happened.
 */
export function update_json_under_lock<T>(
  target: string,
  mutate: (loaded: Partial<T>) => T | null,
  options: { indent?: number } = {},
): boolean {
  if (is_replay_mode()) return false;
  const targetPath = path.resolve(target);
  const state_dir = path.dirname(targetPath);
  try {
    fs.mkdirSync(state_dir, { recursive: true });
  } catch {
    return false;
  }
  const lock_path = _lock_path(state_dir);
  let fd: number;
  try {
    fd = _acquire_lock(lock_path);
  } catch {
    return false;
  }
  try {
    let loaded: Partial<T> = {};
    try {
      const raw = fs.readFileSync(targetPath, "utf-8");
      const decoded: unknown = JSON.parse(raw);
      if (typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)) {
        loaded = decoded as Partial<T>;
      }
    } catch {
      // Absent, unreadable, or malformed — the mutator decides what an empty
      // state means. Never a reason to abandon the write.
    }
    const next = mutate(loaded);
    if (next === null) return true; // deliberate no-write, not a failure
    _publish_text_locked(targetPath, _py_json_dumps(next, options.indent ?? 2) + "\n");
    return true;
  } catch {
    return false;
  } finally {
    _release_lock(fd, lock_path);
  }
}
