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
 * Outcome of one `update_json_under_lock` call.
 *
 * A string union rather than an enum so it survives the JSON/CLI boundaries this
 * tree crosses, and so a `switch` over it is exhaustively checked.
 */
export type LockedUpdateResult = "written" | "skipped" | "failed";

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

/**
 * Lock path for ONE state file, used only by `update_json_under_lock`.
 *
 * ## Why this exists, and why it is narrow
 *
 * `_lock_path` above is DIRECTORY-keyed and always was — that part is not new,
 * and `docs/contracts/hook-architecture-v1.md` § Concurrency mandates it with a
 * stated rationale: "serialising state writes across concerns is cheaper than
 * per-file locks, and concerns already run sequentially within one dispatcher
 * invocation." That rationale is about CONCERNS inside one invocation, and it
 * still holds for them.
 *
 * What changed is what the directory holds. Before the per-session split it
 * held one file, so a directory lock WAS a file lock. After it, the directory
 * holds N per-session files — and concurrent SESSIONS are not "concerns within
 * one dispatcher invocation", so the contract's rationale does not reach them.
 * A directory lock there re-serialises exactly the sessions the split exists to
 * decouple.
 *
 * ## Measured, not assumed
 *
 * The prior basis was "probably unmeasurable at millisecond writes", which the
 * roadmap named as a guess and required to be measured before any choice. It
 * was measured (4 and 8 concurrent processes, 60 read-modify-writes each, each
 * to its OWN per-session file, macOS/APFS):
 *
 *   - 4 workers: slowest worker 68 ms with the shared directory lock vs 27 ms
 *     with no shared lock — ~1.1 ms vs ~0.45 ms per write.
 *   - 8 workers: slowest worker 138–267 ms vs 83–95 ms across runs.
 *
 * So the guess was wrong in direction (it IS measurable, and it grows with the
 * number of concurrent sessions) and roughly right in magnitude (sub-millisecond
 * to a few milliseconds per write). The decisive reading is not the absolute
 * number: writes to DISTINCT files under the shared directory lock came out at
 * or above writes to the SAME file, i.e. the directory lock was paying the full
 * cost of mutual exclusion for writes that require none.
 *
 * ## Scope of the change
 *
 * Only `update_json_under_lock` uses this. `_atomic_write_text` — the path the
 * contract describes, the one concerns share — keeps the directory lock
 * untouched. Two sessions writing different per-session files now take
 * different locks and do not block each other; two writers to the SAME file
 * still take the same lock, so the four-process mutual-exclusion test is
 * unaffected.
 *
 * The sentinel and its companion sit next to the state file as
 * `<digest>.json.lock` / `.lock.held`. Neither ends in `.json`, so
 * `prune_stale_session_states` skips both by its existing filter; that pruner
 * now removes them alongside the state file it prunes, so this does not trade a
 * lock for unbounded sentinel growth.
 */
function _target_lock_path(target_path: string): string {
  return `${target_path}.lock`;
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

/**
 * ── The guarantee this lock rests on, and where it holds ─────────────────────
 *
 * PRIMITIVE: `fs.openSync(path, "wx")` — `O_CREAT | O_EXCL`. Create-or-fail is
 * the exclusion; the loser gets `EEXIST`.
 *
 * PLATFORM AND VERSION the guarantee is claimed on: **local filesystems on the
 * platforms this package supports** — macOS/APFS and Linux/ext4|btrfs|xfs, on
 * Node >= 20.11.0 (`package.json` `engines`). Native Windows is explicitly not
 * a first-class target (`docs/installation.md` § Windows names WSL2 or Git
 * Bash), so no claim is made for it. Verified locally on Darwin 24.6.0 arm64.
 *
 * ## The NFS claim, and why it is not acted on as it was reported
 *
 * A peer reported `openSync(path, "wx")` as "broken on NFS per `open(2)`" and
 * proposed `mkdirSync` instead. That report is not usable as stated, in both
 * directions:
 *
 *   - The LOCAL BSD `open(2)` says the opposite. Read on Darwin 24.6.0: "If
 *     O_EXCL is set with O_CREAT and the file already exists, open() returns an
 *     error. **This may be used to implement a simple exclusive-access locking
 *     mechanism.**" That is a recommendation of this exact use.
 *   - The warning is real but Linux-specific and VERSION-BOUND, not categorical.
 *     The Linux `open(2)` NOTES scope it to old NFS — NFSv2, which lacks an
 *     atomic create-exclusive operation, so `O_EXCL` there is emulated and
 *     racy. NFSv3 carries an atomic exclusive-create and NFSv4 likewise. So the
 *     honest form of the claim is "unreliable on NFSv2", not "broken on NFS".
 *
 * ## Is NFS even in scope? No — and that is why nothing is rewritten
 *
 * This state tree lives INSIDE the project directory
 * (`<project>/agents/runtime/state/`, gitignored per
 * `docs/contracts/agents-layout.md`). Its filesystem is whatever the developer's
 * checkout sits on. A checkout on an NFSv2 mount is not a configuration this
 * package supports, tests, or has ever observed; NFSv2 has been superseded for
 * roughly three decades.
 *
 * So `mkdirSync` is NOT adopted. Both primitives are atomic create-or-fail on
 * every filesystem in scope, so the swap would buy nothing here while trading a
 * primitive the local manpage recommends for one chosen on a mis-stated premise.
 * Note also that `mkdirSync` would not even be a clean win on the premise as
 * given: the same Linux NOTES that qualify `O_EXCL` are about the absence of an
 * atomic create-exclusive RPC, and directory creation over NFSv2 inherits the
 * same retransmission ambiguity.
 *
 * WHAT WOULD CHANGE THIS: an actual report of this state tree on a network
 * mount, or a supported-platform claim that includes one. At that point the
 * fix is not a primitive swap by reputation — it is a measurement on that
 * mount, because the staleness reclaim above (mtime-based) also depends on
 * clock and attribute-cache behaviour that a network filesystem changes.
 */

/**
 * How long a companion must be untouched before it counts as ABANDONED.
 *
 * Matches `language_mirror_hook.LOCK_STALE_MS` — a convention match, not a
 * measurement, and stated as such. What matters is that it is much larger than
 * any real critical section here (a read, a mutate and a rename), so a live
 * holder is never mistaken for a dead one.
 */
export const LOCK_STALE_MS = 30_000;

/** How long a BLOCKING acquire waits before giving up. Unchanged value. */
export const LOCK_ACQUIRE_DEADLINE_MS = 5_000;

/** One spin's sleep. Small enough that the deadline is a real bound. */
const LOCK_SPIN_SLEEP_MS = 2;

/** Real sleep without async — `Atomics.wait` on a throwaway buffer. */
function _sleep(ms: number): void {
  const sab = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(sab, 0, 0, ms);
}

/**
 * Take the cross-process lock for `lock_path`, or report that it is held.
 *
 * Node has no `flock`, so exclusion comes from an `O_EXCL` companion
 * (`<lock>.held`) removed on release; the visible sentinel is kept.
 *
 * ## What was wrong before, precisely
 *
 * The reclaim branch was commented `// Stale companion — reclaim it` and
 * examined the companion in NO way: no mtime, no age, no owner. It fired on
 * `Date.now() - start > deadlineMs` — a property of how long THIS caller had
 * waited, not of the companion's health. So it was a patience check wearing the
 * name of a staleness check, and a caller that merely waited long enough
 * deleted a perfectly live peer's lock.
 *
 * Two consequences followed, and the second is the worse one:
 *
 *   - `start` was never reset before `continue`, and the deadline test sat
 *     BEFORE the sleep. So the first timeout made the sleep permanently
 *     unreachable: every later iteration took the reclaim branch and looped
 *     with no pause at all. A pauseless spin was the end state of any call that
 *     touched the deadline once.
 *   - Two callers both past their deadline evicted each other's companion
 *     without bound — each one's "reclaim" destroyed the exclusion the other
 *     had just acquired, so neither held a lock while both believed they did.
 *
 * ## What holds now
 *
 * The companion's AGE decides reclamation, and nothing else. A fresh companion
 * is never removed, by any caller, at any wait duration — a blocking caller
 * that reaches its deadline reports failure instead of evicting. Reclamation
 * requires `LOCK_STALE_MS` of inactivity, which only an abandoned lock reaches,
 * so mutual eviction is gone rather than merely rarer.
 *
 * Every retry path either sleeps or has just made real progress (the companion
 * vanished, or a genuinely abandoned one was removed), so no path reaches a
 * sleepless retry loop.
 *
 * ## `blocking: false` — the hot-path acquire
 *
 * `post_tool_use` runs on every tool call and must never wait. A non-blocking
 * caller returns on the first `EEXIST` with no spin at all, so it cannot cross
 * a deadline — which makes the reclaim branch UNREACHABLE for it rather than
 * merely rarer. That is why the roadmap treats the non-blocking acquire as
 * subsuming the reclaim fix rather than complementing it; the reclaim fix is
 * still needed for the blocking callers, which is why both landed.
 *
 * An abandoned companion is still reclaimed on the non-blocking path: skipping
 * that would let one crashed process wedge the hot path for 30 seconds, which
 * is the wedge the never-block contract exists to prevent.
 *
 * Returns the sentinel fd, or `null` when the lock is held by a live peer.
 * `null` is NOT a failure to handle generically — the two callers below take
 * deliberately opposite actions on it, for reasons stated at each.
 */
function _acquire_lock(
  lock_path: string,
  options: { blocking?: boolean } = {},
): number | null {
  const blocking = options.blocking ?? true;
  // Open (and keep) the sentinel lock file with O_CREAT | O_RDWR — never
  // truncated, just an fd, exactly like the Python fcntl path. The file
  // stays on disk alongside the target after release.
  const fd = fs.openSync(lock_path, "a", 0o644);
  const held = lock_path + ".held";
  const give_up = (): null => {
    try {
      fs.closeSync(fd);
    } catch {
      /* ignore */
    }
    return null;
  };
  const start = Date.now();
  for (;;) {
    try {
      const heldFd = fs.openSync(held, "wx", 0o644);
      fs.closeSync(heldFd);
      return fd;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        // Unexpected error (a read-only mount, a vanished parent) — proceed
        // without the companion guard rather than wedge the never-block hook
        // contract. Pre-existing behaviour, deliberately retained: the failure
        // mode here is a lost guard, and the alternative is a lost write.
        return fd;
      }
      // EEXIST: somebody holds it. Decide from the COMPANION, never from how
      // long we have waited.
      let age_ms: number;
      try {
        age_ms = Date.now() - fs.statSync(held).mtimeMs;
      } catch {
        // Vanished between the open and the stat — the holder just released.
        // Retry at once: this is real progress, not a spin.
        continue;
      }
      if (age_ms >= LOCK_STALE_MS) {
        // A genuine staleness check: the companion itself has been untouched
        // for longer than any live critical section here can last. Removing it
        // is progress, so the immediate retry is bounded.
        try {
          fs.rmSync(held, { force: true });
        } catch {
          /* a peer reclaimed it first — the retry below sees the new one */
        }
        continue;
      }
      // A LIVE peer holds it.
      if (!blocking) {
        return give_up();
      }
      if (Date.now() - start > LOCK_ACQUIRE_DEADLINE_MS) {
        // Waited long enough. Report failure — never evict a fresh companion,
        // which is exactly the eviction that made two impatient callers destroy
        // each other's exclusion.
        return give_up();
      }
      _sleep(LOCK_SPIN_SLEEP_MS);
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

/**
 * A BLIND WRITE is the lesser evil here, and only here.
 *
 * `_acquire_lock` can now report that a live peer holds the lock. This writer
 * publishes anyway, because its unit of work is a whole-file replacement: the
 * publish is a `rename`, so the worst case under contention is last-writer-wins
 * on a complete, well-formed file — never a torn one. Refusing instead would
 * turn a contended write into a LOST write, and every caller here
 * (`atomic_write_json`, the dispatcher's feedback files) treats a lost write as
 * the more serious failure.
 *
 * `update_json_under_lock` takes the OPPOSITE decision on the same signal, and
 * the asymmetry is the point: a read-modify-write without exclusion produces
 * the lost UPDATE that function exists to prevent, so there it fails closed.
 * Pairing the two decisions in one place rather than picking one globally is
 * what keeps each caller's real failure mode addressed.
 *
 * This also preserves the pre-existing behaviour exactly. The old code reached
 * the same outcome by DELETING the peer's companion and proceeding, which wrote
 * the file and destroyed the peer's exclusion. This writes the file and leaves
 * the peer's lock intact.
 */
function _atomic_write_text(target: string, text: string): void {
  const lock_path = _lock_path(path.dirname(target));
  const fd = _acquire_lock(lock_path);
  if (fd === null) {
    _publish_text_locked(target, text);
    return;
  }
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
 *         summary.json       — capped list of per-invocation rollups
 *                              (schema 2; see hook-architecture-v1 for why
 *                              a single rollup object lost one per overlap)
 *
 * Per Council Round 2 (2026-05-04): exit-code reduction collapses
 * multiple concern signals into a single platform-native code; the
 * feedback dir surfaces the per-concern detail to humans and
 * `task hooks-status` without re-routing control flow.
 *
 * **Why a composite name and not `session_state_file`'s pure digest.** The two
 * serve different readers. A state file is machine-only, so a bare digest costs
 * nothing. This directory is the HUMAN surface named in the paragraph above,
 * and `hooks_doctor` puts its path in the `last_feedback` column — a bare
 * digest there would replace the one operator-legible token in the output with
 * 12 hex characters. The composite keeps the label for the reader and takes the
 * distinctness from the digest, which is where distinctness actually comes from.
 *
 * **No migration.** Nothing parses the directory name back into a session id
 * and nothing prunes this tree: `hooks_doctor._latest_feedback` enumerates
 * whatever directories exist and picks per concern by mtime. Pre-existing
 * old-scheme directories therefore stay readable and simply stop being written
 * to. Verified against that function rather than assumed.
 *
 * **The id-less bucket is retained, deliberately.** An empty id still maps to
 * one shared `unknown-session.<digest of "">` directory, and
 * `has_stable_session_id` is NOT applied here. That helper exists so a caller
 * can decline to persist; this caller cannot — the dispatcher must put its
 * per-concern detail somewhere or the feedback surface silently empties for any
 * host that exports no id. What merges in that bucket is a per-concern VIEW,
 * recoverable from the next run, not a pin whose loss is unrecoverable. That
 * asymmetry is the whole reason the two functions differ, and it is stated
 * rather than left as an apparent oversight.
 */
export function feedback_dir(state_root: string, session_id: string): string {
  // Defence-in-depth: refuse path traversal in session_id. This half is
  // UNCHANGED — it is what keeps the result a single segment under
  // `.dispatcher`, and `dispatcher_feedback_traversal.test.ts` pins that
  // property directly rather than pinning the literal it produces.
  const label = (session_id || "unknown-session")
    .replace(/\//g, "_")
    .replace(/\\/g, "_")
    .replace(/\.\./g, "_");
  // The DIGEST is what makes two ids two directories. The sanitiser alone
  // could not: it maps `a/b` and `a_b` onto one name, which is the exact shape
  // `session_state_file` replaced for the same reason — see § Per-session
  // concern state, which named this function as a known instance and deferred
  // it on scope grounds. This is that deferral being paid.
  //
  // Keyed on the FULL id, never on `label`, so the sanitiser's collisions
  // cannot survive into the digest.
  const digest = createHash("sha256").update(session_id, "utf8").digest("hex").slice(0, 12);
  return path.join(state_root, FEEDBACK_DIRNAME, `${label}.${digest}`);
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
 * `feedback_dir` above carried the same sanitiser shape (`a/b` and `a_b` → one
 * directory) and this paragraph used to defer it, on the grounds that changing
 * the dispatcher feedback layout needed its own change with its own
 * `hooks-status` verification. That change has now happened: `feedback_dir`
 * takes its distinctness from a digest of the full id and keeps a legible
 * label as a prefix, for the reader-asymmetry reason stated at that function.
 * The deferral text is replaced rather than left standing — a comment that
 * describes a defect the code no longer has reads as a live known-issue, and
 * the next reader spends the same investigation twice.
 *
 * One difference between the two remains, and it is intentional rather than
 * residual: `feedback_dir` still gives every id-less invocation one shared
 * bucket, because its caller cannot decline to write. The reason is at that
 * function; the short version is that a merged VIEW is recoverable and a
 * merged PIN is not.
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
  //
  // WHY THIS IS NOT THE STALE-BREAKER DEFECT that a sibling lock primitive hit
  // in round 4 (two breakers each judge one fixed-name lock stale; the second
  // deletes the first one FRESH lock and both believe they hold it). The
  // question is worth answering here rather than leaving to a reviewer, because
  // the shapes look alike: both delete an object another live process is using.
  //
  // Two properties separate them, and neither is incidental. The tombstone name
  // carries `pid` and a per-run counter, so no peer can ever create the name
  // this run holds — there is no second claimant to confuse, which is exactly
  // what a fixed name provides. And the delete/restore decision reads the
  // CONTENT mtime, which `rename` does not touch, so a peer resolving this
  // tombstone reaches the same verdict its holder would; the holder then finds
  // ENOENT and skips. The lock case has neither: one name, and a decision made
  // on how long THIS caller waited rather than on a property of the object.
  //
  // What this does NOT claim: that a peer never touches a live tombstone. It
  // does, and that is intended — the alternative (waiting out a holder that may
  // have crashed) is the leak this pass exists to close.
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
      // The per-file lock sentinel belongs to the state file, so it is pruned
      // WITH it. Without this, `update_json_under_lock`'s file-keyed lock
      // (see `_target_lock_path`) would leave one sentinel per retired session
      // forever: neither name ends in `.json`, so the filter above skips both
      // and nothing else walks this directory. Trading a serialised write path
      // for an unbounded file count is not a fix.
      //
      // Safe to remove unconditionally at this point: the state file is gone,
      // so no live writer can be holding a lock for it — and a writer that
      // arrives afterwards creates both anew.
      for (const suffix of [".lock", ".lock.held"]) {
        try {
          fs.rmSync(`${full}${suffix}`, { force: true });
        } catch {
          /* never a reason to fail a prune */
        }
      }
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
 * write. Returning `null` writes nothing, so a caller that decides against the
 * write after seeing fresh state does not have to publish a no-op.
 *
 * ## Three states, not two
 *
 * This returned a BOOLEAN and reported `true` for two different outcomes: the
 * write landed, and the mutator deliberately declined. That collapse is exactly
 * what a fail-closed caller must not have. The reset-then-emit pattern is the
 * worked case: a reset that did not land leaves a counter at its threshold, so
 * emitting anyway re-fires on every subsequent call — which is why such callers
 * stay silent unless they know the write landed. Under the boolean they could
 * not distinguish "declined, nothing needed to land" from "landed", and the
 * only way to express a decline was a flag captured in the mutator's closure —
 * state smuggled out of a callback, invisible in the signature, and unenforced.
 *
 *   - `written` — the mutator returned a value and it is on disk.
 *   - `skipped` — the mutator returned `null`. Nothing was written and nothing
 *     went wrong. A caller whose emit depends on a write having landed treats
 *     this as "do not emit"; a caller that only needed the state examined
 *     treats it as success. Both readings are now expressible.
 *   - `failed` — replay mode, or the directory, the lock, the read or the
 *     publish went wrong. Never distinguishable from `skipped` before.
 *
 * `failed` is deliberately NOT split further (no `replay` state, no `busy`
 * state): every caller that has one treats replay, contention and a genuine
 * write failure identically — stay silent — and a state nobody branches on is a
 * state that goes stale. Under `AGENT_CONFIG_REPLAY=1` this reports `failed`
 * without touching the tree, the same no-op contract as the writers above.
 *
 * ## `blocking: false` — for hot paths that must never wait
 *
 * Default `true`, i.e. the pre-existing behaviour. Pass `false` from a caller
 * that runs on every tool call: it declines on the first contended attempt with
 * no spin, returning `failed`. The trade is explicit — a wait becomes a skip,
 * and for a counter that is a missed increment rather than a late one. Take it
 * only where the missed increment is recoverable by construction (a re-emit
 * distance counter is; a verification witness may not be).
 *
 * **Migration hazard, stated because the compiler does not catch it.** The old
 * shape was tested with `if (!result)`. Every value of the new union is a
 * non-empty string and therefore truthy, so a missed call site does not fail to
 * compile — it silently stops detecting failure. There were two production call
 * sites at the time of the change and both were converted; a new caller must
 * compare against a member of the union, never coerce to a boolean.
 */
/**
 * Read a TEXT file, transform it, and write it back — the WHOLE sequence under
 * one lock.
 *
 * The text sibling of {@link update_json_under_lock}, added for P3 of
 * `b-stop-async-split-prerequisites` (council 2026-08-20, option (a),
 * "P3 before anything else"). The concrete case is
 * `agents/runtime/state/dispatch-issues.jsonl`, which had NO lock and NO
 * tmp+rename: `log_dispatch_issue` read the whole capped log, appended a line,
 * and `writeFileSync`'d the target directly.
 *
 * That is corruption-capable rather than merely lossy, and the distinction is
 * why this needed its own primitive instead of a comment. `writeFileSync`
 * truncates and then writes, so a concurrent reader can observe a half-written
 * log and a concurrent writer can interleave into one — and the file is written
 * precisely when something has ALREADY gone wrong, so the evidence destroyed is
 * the evidence of the failure being reported. Two concurrent dispatchers in one
 * workspace is a supported configuration (two platforms installed side by side),
 * and a host that runs tool calls in parallel produces it without any second
 * platform at all.
 *
 * `transform` receives the file's content as read INSIDE the lock — `null` when
 * the file does not exist, so a caller can tell "absent" from "empty" — and
 * returns what to write. Returning `null` writes nothing and still counts as
 * success.
 *
 * Returns `written` / `skipped` / `failed`, the same three-state contract
 * `update_json_under_lock` carries since `bcbb0380b` — a boolean could not tell
 * a deliberate decline from a failure, and every member of the union is a truthy
 * string, so `if (!result)` is a silent no-op rather than a compile error. Under
 * `AGENT_CONFIG_REPLAY=1` this reports `failed` without touching the tree.
 */
export function update_text_under_lock(
  target: string,
  transform: (loaded: string | null) => string | null,
  options: { blocking?: boolean } = {},
): LockedUpdateResult {
  if (is_replay_mode()) return "failed";
  const targetPath = path.resolve(target);
  const state_dir = path.dirname(targetPath);
  try {
    fs.mkdirSync(state_dir, { recursive: true });
  } catch {
    return "failed";
  }
  // FILE-keyed, matching `update_json_under_lock` rather than
  // `_atomic_write_text`. Converged onto the sibling deliberately after
  // `bcbb0380b` landed the measured argument: a read-modify-write needs mutual
  // exclusion against writers of THIS file and nothing else, and the shared
  // directory lock was measured paying the full cost of exclusion for writes
  // that require none (8 workers: slowest 138-267 ms shared vs 83-95 ms
  // unshared). This function was written against the directory-keyed primitive
  // one commit earlier; leaving it there would have made
  // `dispatch-issues.jsonl` serialise against every unrelated
  // `atomic_write_text` in the state dir.
  const lock_path = _target_lock_path(targetPath);
  let fd: number | null;
  try {
    fd = _acquire_lock(lock_path, { blocking: options.blocking ?? true });
  } catch {
    return "failed";
  }
  // FAIL CLOSED, for the same reason the JSON sibling does: an append without
  // exclusion is the truncating write this function exists to prevent.
  if (fd === null) return "failed";
  try {
    let loaded: string | null = null;
    try {
      loaded = fs.readFileSync(targetPath, "utf-8");
    } catch {
      // Absent or unreadable. `null` lets the transform distinguish the two
      // from an empty file, which matters for an append-only log: an
      // unreadable existing log must not be silently replaced by one line.
    }
    const next = transform(loaded);
    if (next === null) return "skipped"; // deliberate no-write, not a failure
    _publish_text_locked(targetPath, next);
    return "written";
  } catch {
    return "failed";
  } finally {
    _release_lock(fd, lock_path);
  }
}

export function update_json_under_lock<T>(
  target: string,
  mutate: (loaded: Partial<T>) => T | null,
  options: { indent?: number; blocking?: boolean } = {},
): LockedUpdateResult {
  if (is_replay_mode()) return "failed";
  const targetPath = path.resolve(target);
  const state_dir = path.dirname(targetPath);
  try {
    fs.mkdirSync(state_dir, { recursive: true });
  } catch {
    return "failed";
  }
  // FILE-keyed, not directory-keyed — see `_target_lock_path` for the measured
  // reason and for why `_atomic_write_text` deliberately keeps the shared one.
  const lock_path = _target_lock_path(targetPath);
  let fd: number | null;
  try {
    fd = _acquire_lock(lock_path, { blocking: options.blocking ?? true });
  } catch {
    return "failed";
  }
  // FAIL CLOSED, unlike `_atomic_write_text`. A read-modify-write without
  // exclusion is the lost-update this function exists to prevent, so a held
  // lock is reported rather than worked around. Reported as `failed` and not as
  // a fourth `busy` state on purpose: every fail-closed caller takes the same
  // action on both (stay silent), and a state nobody branches on goes stale.
  if (fd === null) return "failed";
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
    if (next === null) return "skipped"; // deliberate no-write, not a failure
    _publish_text_locked(targetPath, _py_json_dumps(next, options.indent ?? 2) + "\n");
    return "written";
  } catch {
    return "failed";
  } finally {
    _release_lock(fd, lock_path);
  }
}
