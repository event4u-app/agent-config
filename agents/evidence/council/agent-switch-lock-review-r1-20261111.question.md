<!-- evidence-type: analysis -->

# Review — the agent-switch record lock, round 1 on its own

You are an independent reviewer for a change in the `event4u/agent-config` repository. The change is the record lock of the agent-switch link in `src/scripts/_lib/switch_relay.ts`, on its own pull request. It is not on the ratification gate's list; this review is commissioned because the lock decides whether two hook processes can publish a run checkpoint out of order.

## Context

The agent-switch link is an opt-in feature (`AGENT_CONFIG_SWITCH_QUESTION=1`). Two hooks of one session touch a per-session record under the user-global quota state, `switch/<hash>.json`: the prompt hook relays a decision and claims each line it shows; the Stop hook builds and writes the run checkpoint while it holds the record lock, so Stops write in order. Every hook is a short-lived, synchronous `node` process; a hook that cannot take the lock within about 250 ms writes nothing and leaves the work to the next hook. Released 20.2.0 locks with a single file `<record>.lock`, created exclusively and broken once its mtime is two seconds old (its loop is reproduced verbatim in `tests/scripts/fixtures/switch_relay_v1_lock.ts`).

A previous review of this lock, bundled with another change, raised these points, quoted from its record:

- "`ticketBreakable` deliberately expires genuinely live holders after 15 minutes" — "remove it (rely on PID checks only), or fence publication (reject writes from expired holders), or prove ... that legitimate Stops never exceed 15 minutes".
- "`takeLegacyLock` still checks one file and then removes whichever file occupies that pathname. Tickets serialize newer contenders, but older processes ignore tickets." — "Require old processes to drain before activation, or establish publication protection that every possible writer honors."
- "Add deterministic tests paused between stale observation and unlink in both version directions, plus a suspended live holder resumed after expiration."
- "Specify precise rollback triggers"; "Operational rollback therefore also needs process draining and verification that record formats remain readable".

## What the change states it does

- Tickets: each contender creates `<record>.lock.<pid>.<time>.<random>`, lists the tickets, removes the breakable ones by their unique names, and holds when none other is left and it also takes `<record>.lock`. A ticket is breakable when its process has ended, when it names no process and is older than two seconds, or when `ps -o etime=` shows the process now under its pid has run for less time than the ticket exists (a reused pid). There is no age after which a live holder's ticket is broken. Where `ps` gives nothing readable (Windows), a running process under the pid counts as the holder.
- `<record>.lock` is taken by the ticket holder as a directory containing one entry named by its token. In 20.2.0, `writeFileSync(path, token, { flag: 'wx' })` fails with `EEXIST` on a directory and `rmSync(path, { force: true })` throws `ERR_FS_EISDIR` (probed on Node 22 / macOS). A `<record>.lock` whose holder is gone is renamed aside, removed if it still names the judged holder, otherwise linked back (`linkSync`, which fails if the path was taken again).
- The prune (records untouched for eight days) keeps tickets whose holder runs and never touches `<record>.lock`.
- The contract states what remains between versions and a rollback procedure with a trigger (section "Install and rollback").
- Byte cost: the `switch_link` lazy chunk measures 30,078 B against its ratified 30,300 B ceiling; the opted-in group 57,206 / 60,100 B.
- Tests: `tests/scripts/switch_relay_lock_interleave.test.ts` (new) pauses each side between its check and its removal by wrapping `renameSync`; on the previous lock five of its six tests fail. `tests/scripts/agent_switch_interprocess.test.ts` runs hook halves as real processes, including a holding Stop suspended with `SIGSTOP` past the stale break. 90 tests pass across the three lock test files.

## Answer each question, by number

1. For each of the four quoted points: is it resolved by this change, partly, or not? Say what still allows the failure it names, if anything.
2. Can two holders — of this version, of 20.2.0, or one of each — run the locked code at once? Give each interleaving you find, with the operations in order.
3. What does the change make worse: liveness (a lock that is never released), cost on the hook path, behaviour on hosts without `ps`, rollback?
4. Do the tests establish what their names claim? Name a test that would pass on a broken lock, if one does.
5. Is the rollback trigger precise enough to act on, and is the rollback procedure complete?
6. Would a smaller change do?

End with exactly one line in this form:
`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## The diff

Against the merge base with `main`, `a1c70a5afe`. `switch_relay.ts` with three context lines; the contract, the rollback criteria, `agent_switch_ask.test.ts`, the new interleave test and the 20.2.0 fixture without context. The lock tests of `agent_switch_interprocess.test.ts` follow as a listing; left out of it are its setup (a fake `agent-switch` on `PATH`, `raised()` creating a record, `hook()` spawning `tests/scripts/fixtures/switch_relay_driver.ts`, which runs one hook half and logs `<label>:start` / `<label>:written` around its checkpoint write) and its block of two- and three-process relay, back-off and checkpoint tests, unchanged in substance by this change.

````diff
diff --git a/src/scripts/_lib/switch_relay.ts b/src/scripts/_lib/switch_relay.ts
index 5dc832331b..4fad994964 100644
--- a/src/scripts/_lib/switch_relay.ts
+++ b/src/scripts/_lib/switch_relay.ts
@@ -13,6 +13,7 @@
  * each shown once, and a request is no longer read once it reached a terminal state.
  */
 
+import { spawnSync } from 'node:child_process';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 
@@ -32,6 +33,7 @@ const RECORD_GRACE_MS = 24 * HOUR_MS;
 const BACKOFF_AFTER = 3;
 /** How long it rests when the next reset is not known; agent-switch's own default request lifetime. */
 const BACKOFF_FALLBACK_MS = 5 * HOUR_MS;
+/** Age after which a lock whose holder cannot be identified counts as abandoned. */
 const LOCK_STALE_MS = 2000;
 const LOCK_TRIES = 50;
 const LOCK_WAIT_MS = 5;
@@ -255,38 +257,157 @@ function pause(ms: number): void {
     Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
 }
 
+/** Per token, whether `ps` showed its pid reused; a verdict holds for as long as the token exists. */
+const reusedPid = new Map<string, boolean>();
+
+/**
+ * Whether the holder named by `token`, on a lock entry `age` ms old, is gone:
+ * its process has ended, or the process under that pid has run for less time
+ * than the entry exists, so the pid was reused. `null` when the token names no
+ * process. A live holder is never gone, however old its entry: a lock taken
+ * from it would let it publish an older snapshot after its successor's. When
+ * the start of the process cannot be read (no `ps`, as on Windows) it is taken
+ * to be the holder, so a crashed holder whose pid was reused keeps the lock
+ * until that other process ends.
+ */
+function holderGone(token: string, age: number): boolean | null {
+    const pid = Number(token.split('.')[0]);
+    if (!Number.isInteger(pid) || pid <= 0) return null;
+    try {
+        process.kill(pid, 0);
+    } catch (e) {
+        if ((e as NodeJS.ErrnoException).code !== 'EPERM') return true;
+    }
+    if (age <= LOCK_STALE_MS) return false;
+    if (!reusedPid.has(token)) {
+        // `[[dd-]hh:]mm:ss` the process has run; anything else keeps the holder.
+        const ran = spawnSync('ps', ['-o', 'etime=', '-p', String(pid)], { encoding: 'utf-8', timeout: 1000 }).stdout?.trim() ?? '';
+        if (!/^[\d:-]+$/.test(ran)) return false;
+        const [s = 0, m = 0, h = 0, d = 0] = ran.split(/[-:]/).reverse().map(Number);
+        reusedPid.set(token, (((d * 24 + h) * 60 + m) * 60 + s) * 1000 + LOCK_STALE_MS < age);
+    }
+    return reusedPid.get(token) ?? false;
+}
+
+/** Whether a lock entry may be removed: its holder is gone, or it names none and is older than `LOCK_STALE_MS`. */
+function breakable(entry: string, token: string | null): boolean {
+    let age: number;
+    try {
+        age = Date.now() - fs.statSync(entry).mtimeMs;
+    } catch {
+        return false;
+    }
+    return holderGone(token ?? '', age) ?? age > LOCK_STALE_MS;
+}
+
+/** The holder `<file>.lock` names: the entry inside this version's directory, or the older version's file content. */
+function outerHolder(outer: string): string | null {
+    try {
+        return fs.readdirSync(outer)[0] ?? null;
+    } catch {
+        try {
+            return fs.readFileSync(outer, 'utf-8');
+        } catch {
+            return null;
+        }
+    }
+}
+
+/**
+ * Remove `<file>.lock` when its holder is gone. It is moved aside first and
+ * removed only if it still names the holder judged gone: a hook of the older
+ * version may have broken and retaken it in between, and that file is put back
+ * unless the path was taken again meanwhile, which only a second hook of the
+ * older version can do.
+ */
+function reapOuter(outer: string, token: string): boolean {
+    const held = outerHolder(outer);
+    if (!breakable(outer, held)) return false;
+    const aside = `${outer.slice(0, -5)}.reap.${token}`;
+    try {
+        fs.renameSync(outer, aside);
+    } catch {
+        return false;
+    }
+    const same = outerHolder(aside) === held;
+    try {
+        if (!same) fs.linkSync(aside, outer);
+    } catch {
+        // taken again meanwhile
+    }
+    fs.rmSync(aside, { recursive: true, force: true });
+    return same;
+}
+
 /**
- * Run `fn` holding `<file>.lock`, or return `null` when the lock could not be
- * had. The lock file carries a token of this holder, and only a holder whose
- * token is still in it removes it: a holder older than LOCK_STALE_MS is taken
- * to have died and its lock is broken, and if it was only slow, its release
- * must not delete the lock its successor now holds.
+ * Take `<file>.lock` as a directory holding one entry named by this holder's
+ * token. The version before tickets used `<file>.lock` as its single lock file:
+ * it creates that file exclusively, which fails while the directory is there,
+ * and breaks a stale one with a plain removal, which fails on a directory. So a
+ * hook of that version still running across an install or a rollback can never
+ * take the lock from a holder of this one, however long it holds; it gives up
+ * and leaves the work to the next hook. Only the ticket holder gets here, so no
+ * other hook of this version touches the path meanwhile.
+ */
+function takeOuter(outer: string, token: string): boolean {
+    try {
+        fs.mkdirSync(outer);
+    } catch {
+        return reapOuter(outer, token) && takeOuter(outer, token);
+    }
+    try {
+        fs.writeFileSync(path.join(outer, token), '');
+        return true;
+    } catch {
+        fs.rmSync(outer, { recursive: true, force: true });
+        return false;
+    }
+}
+
+/**
+ * Run `fn` holding the lock on `file`, or return `null` when it could not be
+ * had. Each contender creates its own ticket `<file>.lock.<token>`, then lists
+ * the tickets, removes every breakable one, and holds the lock when no other
+ * ticket is left and it could also take `<file>.lock`; otherwise it removes its
+ * own ticket and retries after a random pause. A ticket is only ever removed by
+ * its unique name, so breaking an abandoned one can never remove a successor's,
+ * and two contenders cannot both hold: each lists after creating, so the later
+ * lister sees the earlier ticket. A live holder's ticket is never broken, so a
+ * holder that is slow or suspended keeps the lock and every waiter writes
+ * nothing; `<file>.lock` is its own directory, so its release removes it whole.
  */
 function locked<T>(file: string, fn: () => T): { value: T } | null {
-    const held = `${file}.lock`;
+    const dir = path.dirname(file);
+    const prefix = `${path.basename(file)}.lock.`;
+    const outer = `${file}.lock`;
     const token = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
+    const mine = path.join(dir, prefix + token);
     for (let i = 0; i < LOCK_TRIES; i++) {
+        let free = false;
         try {
-            fs.mkdirSync(path.dirname(file), { recursive: true });
-            fs.writeFileSync(held, token, { flag: 'wx', mode: 0o600 });
-        } catch {
-            try {
-                if (Date.now() - fs.statSync(held).mtimeMs > LOCK_STALE_MS) fs.rmSync(held, { force: true });
-            } catch {
-                // released meanwhile
+            fs.mkdirSync(dir, { recursive: true });
+            fs.writeFileSync(mine, '', { flag: 'wx', mode: 0o600 });
+            let others = 0;
+            for (const n of fs.readdirSync(dir)) {
+                if (!n.startsWith(prefix) || n === prefix + token) continue;
+                const other = path.join(dir, n);
+                if (breakable(other, n.slice(prefix.length))) fs.rmSync(other, { force: true });
+                else others++;
             }
-            pause(LOCK_WAIT_MS);
-            continue;
+            free = others === 0 && takeOuter(outer, token);
+        } catch {
+            free = false;
         }
-        try {
-            return { value: fn() };
-        } finally {
+        if (free) {
             try {
-                if (fs.readFileSync(held, 'utf-8') === token) fs.rmSync(held, { force: true });
-            } catch {
-                // already gone
+                return { value: fn() };
+            } finally {
+                fs.rmSync(outer, { recursive: true, force: true });
+                fs.rmSync(mine, { force: true });
             }
         }
+        fs.rmSync(mine, { force: true });
+        pause(LOCK_WAIT_MS * (0.5 + Math.random()));
     }
     return null;
 }
@@ -322,9 +443,10 @@ export function updateSwitchRecord(
 const PRUNE_AFTER_MS = 8 * 24 * HOUR_MS;
 
 /**
- * Remove records, back-off files and locks no session has touched for eight
- * days. Expiry on read covers a session that comes back; this covers one that
- * never does. Run on a raise, which happens at most once per window and reset.
+ * Remove records, back-off files and lock tickets no session has touched for
+ * eight days; a ticket whose holder still runs is kept. Expiry on read covers a
+ * session that comes back; this covers one that never does. Run on a raise,
+ * which happens at most once per window and reset.
  */
 export function pruneSwitchState(stateEnv?: EnvMap | null, now: number = Date.now()): void {
     const dir = path.dirname(switchRecordPath('x', stateEnv));
@@ -332,7 +454,13 @@ export function pruneSwitchState(stateEnv?: EnvMap | null, now: number = Date.no
         for (const name of fs.readdirSync(dir)) {
             const p = path.join(dir, name);
             try {
-                if (now - fs.statSync(p).mtimeMs > PRUNE_AFTER_MS) fs.rmSync(p, { force: true });
+                if (now - fs.statSync(p).mtimeMs <= PRUNE_AFTER_MS) continue;
+                // A ticket is kept while its holder runs, however old it is.
+                // `<record>.lock` is left to the next ticket holder, the one
+                // hook that may remove it (see `takeOuter`).
+                const at = name.indexOf('.lock.');
+                if (name.endsWith('.lock') || (at >= 0 && !breakable(p, name.slice(at + 6)))) continue;
+                fs.rmSync(p, { recursive: true, force: true });
             } catch {
                 // removed meanwhile
             }
diff --git a/agents/evidence/metrics/agent-switch-link-latency-20261108.md b/agents/evidence/metrics/agent-switch-link-latency-20261108.md
index 98fd42a808..b40a77e53a 100644
--- a/agents/evidence/metrics/agent-switch-link-latency-20261108.md
+++ b/agents/evidence/metrics/agent-switch-link-latency-20261108.md
@@ -116,0 +117,5 @@ the documentation or revert the change when any of these is observed:
+9. Around an install or a rollback, a resumed run's checkpoint is older than
+   one already written for it, or an owed checkpoint stays unwritten while
+   `<record>.lock` or a ticket under `switch/` names a process that is not a
+   hook of this package. Procedure, including the lock cleanup a rollback to
+   20.2.0 needs: `docs/contracts/agent-switch-link.md` § Install and rollback.
diff --git a/docs/contracts/agent-switch-link.md b/docs/contracts/agent-switch-link.md
index aee66bd142..bf9dd90de7 100644
--- a/docs/contracts/agent-switch-link.md
+++ b/docs/contracts/agent-switch-link.md
@@ -279,2 +279 @@ the link over the CLI verbs below, never the MCP client.
-  prompt that dies after its claim loses that line, and the lock's stale break
-  below can let two prompts claim it. A raise never replaces a record that is
+  prompt that dies after its claim loses that line. A raise never replaces a record that is
@@ -286,7 +285,64 @@ the link over the CLI verbs below, never the MCP client.
-  obligation for the next Stop. A lock is released only by its holder. The lock is
-  advisory and its stale break (older than two seconds) is a check followed by
-  a removal, so two breakers at the same instant can remove a fresh lock. The
-  code holding it reads and writes files only: the record, the back-off count,
-  and the checkpoint build and write; every agent-switch call runs outside it. An unwritable state directory keeps
-  no back-off count, so the link does not rest there. Record, back-off and lock files no
-  session has touched for eight days are removed when a request is raised.
+  obligation for the next Stop. The lock is a set of tickets: each contender
+  creates its own file `<record>.lock.<pid>.<time>.<random>`, then lists the
+  tickets, removes every breakable one, and holds the lock only when no other
+  ticket is left and it can also take `<record>.lock`; otherwise it removes its
+  own and retries after a random pause. A ticket is only ever removed by its
+  own unique name, so breaking an abandoned one cannot remove a successor's,
+  and two contenders cannot both hold: each lists after creating, so the later
+  lister sees the earlier ticket. A ticket is breakable when its process has
+  ended, when it names no process and is older than two seconds, or when the
+  process now under its pid has run for less time than the ticket exists, read
+  from `ps -o etime=`, which means the pid was reused. A live holder's ticket
+  is never broken, however slow or suspended the holder is, so it cannot lose
+  its exclusion and publish an older snapshot after a successor's; a waiter
+  gives up after about a quarter of a second and leaves the work to the next
+  hook. Where `ps` cannot be read, as on Windows, a running process under the
+  ticket's pid counts as its holder, so a crashed holder whose pid was reused
+  keeps the lock until that process ends: the link then writes nothing for
+  that record meanwhile. Two contenders that collide both back off, so under
+  contention an update can be skipped; it never runs under two holders at once.
+  `<record>.lock` is the path the version before tickets (20.2.0) used as its
+  single lock file. This version holds it as a directory with one entry named
+  by the holder's token. That version creates the file exclusively, which
+  fails while the directory is there, and breaks a stale one with a plain
+  removal, which fails on a directory, so a hook of that version still running
+  across an install or a rollback can never take the lock from a holder of
+  this one. Only the ticket holder takes, removes or reaps `<record>.lock`. It
+  reaps one whose holder is gone by moving it aside and removing it only if it
+  still names that holder; a file a hook of the older version took in between
+  is linked back. What remains between versions is the older version's own
+  check-then-remove: two hooks of 20.2.0 can still both hold, as they can with
+  no hook of this version running, and only while they run (see Install and
+  rollback). Process liveness is read in the caller's process-id namespace,
+  so hooks of one state directory running in different namespaces (a
+  container sharing the host's home) are not covered. The lock is advisory:
+  it binds only the hooks that take it. The code holding it reads and writes
+  files only: the record, the back-off count, and the checkpoint build and
+  write; every agent-switch call runs outside it. An unwritable state
+  directory keeps no back-off count, so the link does not rest there. Record
+  and back-off files and tickets of ended holders no session has touched for
+  eight days are removed when a request is raised; `<record>.lock` is left to
+  the next ticket holder.
+
+### Install and rollback
+
+Only a hook process started from 20.2.0 can still use the single lock file.
+Its two hooks of one session can both hold when one is slower than two
+seconds, so around an install or a rollback the link can write an older
+checkpoint over a newer one only while a hook of 20.2.0 runs.
+
+- **Install over 20.2.0.** Nothing to drain: once the last hook started from
+  20.2.0 has exited, no process uses the single lock file.
+- **Rollback trigger.** Roll back when one of these is seen, and the
+  maintainer who sees it acts on it: a resumed run whose checkpoint is older
+  than one already written for it (its `written_at` goes back), or a record
+  whose owed checkpoint stays unwritten across Stops while `<record>.lock` or
+  a ticket names a process that is not a hook of this package. Either is
+  read from the files under the quota state directory's `switch/`; there is
+  no automatic detector.
+- **Rollback to 20.2.0.** Install 20.2.0, wait until the hooks started from
+  this version have exited (a Stop of either version finishes within its
+  host's hook timeout), then remove every `*.lock` directory and every
+  `*.lock.*` ticket under `switch/`. 20.2.0 cannot remove a directory at
+  `<record>.lock`, so a holder of this version that crashed would otherwise
+  keep that record locked for 20.2.0, which then writes nothing for it.
diff --git a/tests/scripts/agent_switch_ask.test.ts b/tests/scripts/agent_switch_ask.test.ts
index 235c193f59..05bdc91cff 100644
--- a/tests/scripts/agent_switch_ask.test.ts
+++ b/tests/scripts/agent_switch_ask.test.ts
@@ -635 +635,2 @@ describe('7.5 record lifetime and interleaving', () => {
-        const held = `${switchRecordPath(sess(), stateEnv)}.lock`;
+        // A ticket that names no process: held while fresh, broken once stale.
+        const held = `${switchRecordPath(sess(), stateEnv)}.lock.x`;
@@ -697,4 +698,6 @@ describe('7.x council round 1 findings', () => {
-        const held = `${switchRecordPath(sess(), stateEnv)}.lock`;
-        let locked = false;
-        expect(checkpointBeforeMove(sess(), () => (locked = fs.existsSync(held)), stateEnv, { env: binEnv })).toBe(true);
-        expect(locked).toBe(true);
+        const file = switchRecordPath(sess(), stateEnv);
+        const tickets = (): string[] => fs.readdirSync(path.dirname(file)).filter((n) => n.startsWith(`${path.basename(file)}.lock.`));
+        let held: string[] = [];
+        expect(checkpointBeforeMove(sess(), () => ((held = tickets()), true), stateEnv, { env: binEnv })).toBe(true);
+        expect(held).toHaveLength(1);
+        expect(tickets()).toEqual([]);
@@ -726 +729 @@ describe('7.x council round 1 findings', () => {
-        const held = `${switchRecordPath(sess(), stateEnv)}.lock`;
+        const held = `${switchRecordPath(sess(), stateEnv)}.lock.someone-else`;
@@ -731 +734 @@ describe('7.x council round 1 findings', () => {
-                // The holder stalls; another process breaks the lock as stale and takes it.
+                // Another process leaves its ticket while this one holds the lock.
diff --git a/tests/scripts/fixtures/switch_relay_v1_lock.ts b/tests/scripts/fixtures/switch_relay_v1_lock.ts
new file mode 100644
index 0000000000..2933a53945
--- /dev/null
+++ b/tests/scripts/fixtures/switch_relay_v1_lock.ts
@@ -0,0 +1,50 @@
+// The record lock of the version before tickets, kept verbatim from
+// src/scripts/_lib/switch_relay.ts at d2475e82f8 (lines 35-37 and 254-292), so
+// a test can run that version's whole acquire loop, stale break included,
+// against a holder of this version. Do not edit it to match the current lock.
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+const LOCK_STALE_MS = 2000;
+const LOCK_TRIES = 50;
+const LOCK_WAIT_MS = 5;
+
+function pause(ms: number): void {
+    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
+}
+
+/**
+ * Run `fn` holding `<file>.lock`, or return `null` when the lock could not be
+ * had. The lock file carries a token of this holder, and only a holder whose
+ * token is still in it removes it: a holder older than LOCK_STALE_MS is taken
+ * to have died and its lock is broken, and if it was only slow, its release
+ * must not delete the lock its successor now holds.
+ */
+export function locked<T>(file: string, fn: () => T): { value: T } | null {
+    const held = `${file}.lock`;
+    const token = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
+    for (let i = 0; i < LOCK_TRIES; i++) {
+        try {
+            fs.mkdirSync(path.dirname(file), { recursive: true });
+            fs.writeFileSync(held, token, { flag: 'wx', mode: 0o600 });
+        } catch {
+            try {
+                if (Date.now() - fs.statSync(held).mtimeMs > LOCK_STALE_MS) fs.rmSync(held, { force: true });
+            } catch {
+                // released meanwhile
+            }
+            pause(LOCK_WAIT_MS);
+            continue;
+        }
+        try {
+            return { value: fn() };
+        } finally {
+            try {
+                if (fs.readFileSync(held, 'utf-8') === token) fs.rmSync(held, { force: true });
+            } catch {
+                // already gone
+            }
+        }
+    }
+    return null;
+}
diff --git a/tests/scripts/switch_relay_lock_interleave.test.ts b/tests/scripts/switch_relay_lock_interleave.test.ts
new file mode 100644
index 0000000000..75870e0996
--- /dev/null
+++ b/tests/scripts/switch_relay_lock_interleave.test.ts
@@ -0,0 +1,168 @@
+/**
+ * road-to-a-link-with-agent-switch 8.1 — the record lock against a hook of the
+ * version before tickets, each one paused at the exact point between its check
+ * and its removal. That version's steps are the ones of
+ * fixtures/switch_relay_v1_lock.ts: an exclusive create of `<record>.lock`,
+ * and on failure a stale check of its mtime followed by a plain removal.
+ * Its own file, because it wraps `renameSync` and `spawnSync` for the module.
+ */
+import * as cp from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, expect, it, vi } from 'vitest';
+
+const seam = vi.hoisted(() => ({
+    beforeRename: null as ((from: string) => void) | null,
+    noPs: false,
+}));
+
+vi.mock('node:fs', async (importOriginal) => {
+    const real = await importOriginal<typeof fs>();
+    return {
+        ...real,
+        renameSync: (from: fs.PathLike, to: fs.PathLike): void => {
+            const hook = seam.beforeRename;
+            seam.beforeRename = null;
+            hook?.(String(from));
+            real.renameSync(from, to);
+        },
+    };
+});
+
+vi.mock('node:child_process', async (importOriginal) => {
+    const real = await importOriginal<typeof cp>();
+    return {
+        ...real,
+        spawnSync: (...args: Parameters<typeof cp.spawnSync>) => {
+            if (seam.noPs && args[0] === 'ps') return { pid: 0, output: [], stdout: '', stderr: '', status: null, signal: null, error: new Error('ENOENT') };
+            return real.spawnSync(...args);
+        },
+    };
+});
+
+const { updateSwitchRecord } = await import('../../src/scripts/_lib/switch_relay.js');
+const { switchRecordPath } = await import('../../src/scripts/_lib/switch_record_path.js');
+
+const SESSION = 'a'.repeat(16);
+let home: string;
+let stateEnv: Record<string, string>;
+let record: string;
+let outer: string;
+
+beforeEach(() => {
+    home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-interleave-'));
+    stateEnv = { EVENT4U_CONFIG_HOME: home };
+    record = switchRecordPath(SESSION, stateEnv);
+    outer = `${record}.lock`;
+    fs.mkdirSync(path.dirname(record), { recursive: true });
+});
+afterEach(() => {
+    seam.beforeRename = null;
+    seam.noPs = false;
+    fs.rmSync(home, { recursive: true, force: true });
+});
+
+const deadPid = (): number => Number(cp.execFileSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' }));
+const backdate = (p: string, ms: number): void => {
+    const t = new Date(Date.now() - ms);
+    fs.utimesSync(p, t, t);
+};
+/** Whether `fn` ran under the lock. */
+function lockedRun(fn: () => void = () => {}): boolean {
+    let ran = false;
+    updateSwitchRecord(
+        SESSION,
+        (cur) => {
+            ran = true;
+            fn();
+            return cur;
+        },
+        stateEnv,
+    );
+    return ran;
+}
+const leftovers = (): string[] => fs.readdirSync(path.dirname(record)).filter((n) => n.includes('.lock') || n.includes('.reap.'));
+
+it('an older hook paused between its stale check and its removal cannot remove the lock this version took meanwhile', () => {
+    // An older holder that has run for ten seconds: stale to the older version.
+    fs.writeFileSync(outer, '1.1.old');
+    backdate(outer, 10_000);
+    expect(Date.now() - fs.statSync(outer).mtimeMs > 2000).toBe(true); // the older hook's stale check
+    fs.rmSync(outer); // the older holder releases while that hook is paused
+    let removed = true;
+    let created = true;
+    expect(
+        lockedRun(() => {
+            // The older hook resumes: its removal and its exclusive create both fail.
+            try {
+                fs.rmSync(outer, { force: true });
+            } catch {
+                removed = false;
+            }
+            try {
+                fs.writeFileSync(outer, 'old', { flag: 'wx' });
+            } catch {
+                created = false;
+            }
+            expect(fs.statSync(outer).isDirectory()).toBe(true);
+        }),
+    ).toBe(true);
+    expect(removed).toBe(false);
+    expect(created).toBe(false);
+    expect(leftovers()).toEqual([]);
+});
+
+it('a contender paused between judging the older lock file abandoned and moving it aside puts back the one an older hook took meanwhile', () => {
+    fs.writeFileSync(outer, `${deadPid()}.1.old`);
+    seam.beforeRename = (from) => {
+        expect(from).toBe(outer);
+        // An older hook breaks the abandoned file and takes the lock itself.
+        fs.rmSync(outer, { force: true });
+        fs.writeFileSync(outer, `${process.pid}.2.old`, { flag: 'wx' });
+    };
+    expect(lockedRun()).toBe(false);
+    expect(fs.readFileSync(outer, 'utf-8')).toBe(`${process.pid}.2.old`);
+    expect(leftovers()).toEqual([`${path.basename(record)}.lock`]);
+});
+
+it('a contender paused there removes an abandoned lock file that nobody took meanwhile', () => {
+    fs.writeFileSync(outer, `${deadPid()}.1.old`);
+    seam.beforeRename = () => {};
+    expect(lockedRun()).toBe(true);
+    expect(leftovers()).toEqual([]);
+});
+
+it('this version’s lock left by a holder that ended is removed; one whose holder runs is kept', () => {
+    fs.mkdirSync(outer);
+    fs.writeFileSync(path.join(outer, `${deadPid()}.1.x`), '');
+    expect(lockedRun()).toBe(true);
+    fs.mkdirSync(outer);
+    fs.writeFileSync(path.join(outer, '1.1.x'), '');
+    backdate(outer, 3_600_000);
+    expect(lockedRun()).toBe(false);
+    expect(fs.readdirSync(outer)).toEqual(['1.1.x']);
+});
+
+it('this version’s lock with no holder in it is kept while fresh and removed once stale', () => {
+    fs.mkdirSync(outer);
+    expect(lockedRun()).toBe(false);
+    backdate(outer, 3000);
+    expect(lockedRun()).toBe(true);
+    expect(leftovers()).toEqual([]);
+});
+
+it('without a way to read when a process started, a ticket naming a running process is kept, however old', () => {
+    seam.noPs = true;
+    const holder = cp.spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
+    try {
+        const t = `${record}.lock.${String(holder.pid)}.1.x`;
+        fs.writeFileSync(t, '');
+        backdate(t, 3_600_000);
+        expect(lockedRun()).toBe(false);
+        expect(fs.existsSync(t)).toBe(true);
+    } finally {
+        holder.kill();
+    }
+});
````

## The lock tests of `tests/scripts/agent_switch_interprocess.test.ts`

````ts
describe('8.1 a writer the lock cannot evict', () => {
    it('a Stop held past the stale break keeps its lock; a second Stop writes nothing after it', async () => {
        raised();
        setRequest(APPROVED);
        const slow = hook({ op: 'stop', holdMs: 3500, label: 'A' });
        await until(() => writes().includes('A:start'));
        // Past the two-second stale break the old lock took for a dead holder.
        await new Promise((r) => setTimeout(r, 2300));
        const second = await hook({ op: 'stop', label: 'B' });
        expect(await slow).toBe(true);
        expect(second).toBe(false);
        expect(writes()).toEqual(['A:start', 'A:written']);
        // The move is approved, not done: the record stays, marked complete.
        expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)?.checkpointed).toBe(true);
    }, 20_000);

    it('a lock whose holder has ended is broken at once', () => {
        raised();
        const gone = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' });
        const held = ticket(Number(gone.stdout));
        fs.writeFileSync(held, '');
        expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(true);
        expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)).toBeNull();
        expect(fs.existsSync(held)).toBe(false);
    });

    it('breaking a dead holder’s lock never removes a live holder’s ticket beside it', () => {
        raised();
        const gone = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' });
        const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
        try {
            fs.writeFileSync(ticket(Number(gone.stdout)), '');
            const live = ticket(holder.pid ?? 0);
            fs.writeFileSync(live, '');
            expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(false);
            expect(fs.existsSync(live)).toBe(true);
            expect(fs.existsSync(ticket(Number(gone.stdout)))).toBe(false);
            expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)?.id).toBe(ID);
        } finally {
            holder.kill();
        }
    });

    it('three Stops breaking a dead holder’s lock at once write the checkpoint once', async () => {
        raised();
        setRequest(APPROVED);
        const gone = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' });
        fs.writeFileSync(ticket(Number(gone.stdout)), '');
        const at = together();
        const wrote = await Promise.all(['A', 'B', 'C'].map((label) => hook({ op: 'stop', startAt: at, holdMs: 300, label })));
        expect(wrote.filter((w) => w === true)).toHaveLength(1);
        expect(writes()).toHaveLength(2);
        expect(writes()[0]?.split(':')[0]).toBe(writes()[1]?.split(':')[0]);
    }, 20_000);

    it('a live holder’s ticket is kept however old it is, with no expiry', () => {
        raised();
        const held = ticket(LONG_RUNNING);
        fs.writeFileSync(held, '');
        const old = new Date(Date.now() - 60 * 60_000);
        fs.utimesSync(held, old, old);
        expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(false);
        expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)?.id).toBe(ID);
        expect(fs.existsSync(held)).toBe(true);
    });

    it('a Stop suspended while it holds keeps its lock; a Stop meanwhile writes nothing; it writes once resumed', async () => {
        raised();
        setRequest(APPROVED);
        const pidFile = path.join(home, 'a.pid');
        const slow = hook({ op: 'stop', holdMs: 500, label: 'A', pidFile });
        await until(() => writes().includes('A:start') && fs.existsSync(pidFile));
        const pid = Number(fs.readFileSync(pidFile, 'utf-8'));
        process.kill(pid, 'SIGSTOP');
        try {
            // Past the two-second stale break, with the holder not running at all.
            await new Promise((r) => setTimeout(r, 2300));
            expect(await hook({ op: 'stop', label: 'B' })).toBe(false);
        } finally {
            process.kill(pid, 'SIGCONT');
        }
        expect(await slow).toBe(true);
        expect(writes()).toEqual(['A:start', 'A:written']);
    }, 20_000);
});

describe('the lock across an install: the older single lock file', () => {
    const legacy = (): string => `${switchRecordPath(hashSessionId(SESSION), stateEnv)}.lock`;
    const deadPid = (): number => Number(spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf-8' }).stdout);

    it('a hook of the older version holding the single lock file keeps this one out', () => {
        raised();
        const token = `${String(LONG_RUNNING)}.${String(Date.now())}.old`;
        fs.writeFileSync(legacy(), token);
        // Older than the two seconds after which that version breaks any lock.
        const old = new Date(Date.now() - 10_000);
        fs.utimesSync(legacy(), old, old);
        expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(false);
        expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)?.id).toBe(ID);
        expect(fs.readFileSync(legacy(), 'utf-8')).toBe(token);
    });

    it('while this version holds, `<record>.lock` is its directory, which the older version can neither create nor remove', () => {
        raised();
        let seen: string[] = [];
        let oldCouldTake = true;
        let oldCouldBreak = true;
        updateSwitchRecord(
            hashSessionId(SESSION),
            (cur) => {
                seen = fs.readdirSync(legacy());
                try {
                    fs.writeFileSync(legacy(), 'old', { flag: 'wx' });
                } catch {
                    oldCouldTake = false;
                }
                try {
                    fs.rmSync(legacy(), { force: true });
                } catch {
                    oldCouldBreak = false;
                }
                return cur;
            },
            stateEnv,
        );
        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatch(new RegExp(`^${String(process.pid)}\\.`));
        expect(oldCouldTake).toBe(false);
        expect(oldCouldBreak).toBe(false);
        expect(fs.existsSync(legacy())).toBe(false);
    });

    it('a hook of the older version, running its whole acquire loop, does not break a holder of this version past two seconds', async () => {
        raised();
        setRequest(APPROVED);
        const slow = hook({ op: 'stop', holdMs: 3500, label: 'A' });
        await until(() => writes().includes('A:start'));
        await new Promise((r) => setTimeout(r, 2300));
        const older = lockedBeforeTickets(switchRecordPath(hashSessionId(SESSION), stateEnv), () => {
            fs.appendFileSync(writeLog, 'OLD:entered\n');
            return true;
        });
        expect(await slow).toBe(true);
        expect(older).toBeNull();
        expect(writes()).toEqual(['A:start', 'A:written']);
        // Released: the older version takes it again.
        expect(lockedBeforeTickets(switchRecordPath(hashSessionId(SESSION), stateEnv), () => true)).toEqual({ value: true });
    }, 20_000);

    it('a dead holder’s single lock file is broken', () => {
        raised();
        fs.writeFileSync(legacy(), `${deadPid()}.1.old`);
        expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(true);
        expect(readSwitchRecord(hashSessionId(SESSION), stateEnv)).toBeNull();
    });

    it('every breakable ticket is removed, whatever the listing order, while a live one still keeps the lock', () => {
        raised();
        const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
        try {
            const base = `${switchRecordPath(hashSessionId(SESSION), stateEnv)}.lock.`;
            const dead = [deadPid(), deadPid(), deadPid()].map((pid) => ticket(pid));
            const unnamed = ['0.old', 'a.old', 'zz.old'].map((t) => base + t);
            const old = new Date(Date.now() - 10_000);
            for (const t of [...dead, ...unnamed]) {
                fs.writeFileSync(t, '');
                fs.utimesSync(t, old, old);
            }
            // With six breakable tickets around a live one, a scan that stops at
            // the first live ticket leaves some behind in most listing orders.
            const live = `${base}${String(holder.pid)}.5.x`;
            fs.writeFileSync(live, '');
            expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(false);
            expect([...dead, ...unnamed].filter((t) => fs.existsSync(t))).toEqual([]);
            expect(fs.existsSync(live)).toBe(true);
        } finally {
            holder.kill();
        }
    });

    it('a ticket older than the process its pid now names is taken as a reused pid and broken', () => {
        raised();
        const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
        try {
            const held = ticket(holder.pid ?? 0);
            fs.writeFileSync(held, '');
            const old = new Date(Date.now() - 60 * 60_000);
            fs.utimesSync(held, old, old);
            expect(updateSwitchRecord(hashSessionId(SESSION), () => null, stateEnv)).toBe(true);
            expect(fs.existsSync(held)).toBe(false);
        } finally {
            holder.kill();
        }
    });
});

````
