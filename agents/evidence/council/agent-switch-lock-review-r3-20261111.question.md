<!-- evidence-type: analysis -->

# Review — the agent-switch record lock, round 3

You are an independent reviewer for a change in the `event4u/agent-config` repository: the record lock of the agent-switch link in `src/scripts/_lib/switch_relay.ts`, on its own pull request. It is not on the ratification gate's list; this review is commissioned because the lock decides whether two hook processes can publish a run checkpoint out of order.

## Context

The agent-switch link is opt-in (`AGENT_CONFIG_SWITCH_QUESTION=1`; `AGENT_CONFIG_NO_SWITCH_QUESTION=1` or the unset opt-in turns both hook halves off, in this version and in 20.2.0). Two hooks of one session touch a per-session record under the user-global quota state, `switch/<hash>.json`: the prompt hook relays a decision and claims each line it shows; the Stop hook builds and writes the run checkpoint while it holds the record lock, so Stops write in order. Every hook is a short-lived, synchronous `node` process; a hook that cannot take the lock within about 250 ms of retries writes nothing and leaves the work to the next hook. Released 20.2.0 locks with a single file `<record>.lock`, created exclusively and broken once its mtime is two seconds old (its loop is in `tests/scripts/fixtures/switch_relay_v1_lock.ts`).

Rounds 1 and 2 of this review refused. Round 2 refused an inferred drain (a `ps` snapshot authorising removal of 20.2.0 lock files). Its two seats wrote, quoted from the record:

- "The drain treats a process-table snapshot as authorization to delete lock files without preventing legacy writers from starting afterward."
- "After a correctly completed drain, with no further cleanup: Mixed holders appear excluded. Current code leaves legacy files alone, and legacy code cannot remove current directories."
- "A smaller defensible change is to retain tickets and conservative PID protection, remove automatic inferred cleanup, and require an explicit launch-blocked migration. ... If coordinated migration is unavailable, retaining legacy files and failing closed sacrifices liveness but avoids deleting a possibly live holder's lock."
- "The ticket mechanism is sound. The boundary crossing is not."
- On rollback: no launch barrier, "across Stops" is not a count, no executable check that 20.2.0 reads the retained formats.
- On tests: "a hook of the older version, paused between its stale check and its removal, cannot remove this version's lock" exercises legacy filesystem operations against one holder, not exclusion between two holders of this version.

## What the change states it does since round 2

- The drain is gone: no `ps`, no marker, no cleanup. This version never removes a regular file at `<record>.lock`, whatever its holder; it stays out and writes nothing (fails closed).
- Unchanged from round 2: unique tickets, removed only by name and only when the process named has ended (or the ticket names none and is older than two seconds); a running process under a ticket's pid is its holder, however old the ticket. The ticket holder also takes `<record>.lock` as a directory with one entry named by its token, and removes such a directory only when that holder is gone (or it is empty and older than two seconds). The eight-day prune keeps tickets of running holders and never touches `<record>.lock`.
- Contract § "Install and rollback": what holds across versions without any step; the liveness cost; a cutover that uses the opt-in as the launch barrier (unset it everywhere, confirm with `ps` that no earlier hook process remains, remove regular `*.lock` files under `switch/`, install, set it again); a rollback trigger with a count; the rollback cleanup.
- Tests: `switch_relay_lock_interleave.test.ts` (six tests; five fail on `main`'s lock, two on round 1's), including one that reads a record this version writes with 20.2.0's reader kept verbatim (`tests/scripts/fixtures/switch_relay_v1_record.ts`, shown in full). The interprocess lock tests run hook halves as real processes, including two and three Stops at once and a holding Stop suspended with `SIGSTOP`.
- Bytes: the `switch_link` chunk is 28,981 B against its ratified 30,300 B ceiling.

## Answer each question, by number

1. For each quoted round 2 point: resolved, partly, or not? Say what still allows the failure it names, if anything.
2. Can two holders — of this version, of 20.2.0, or one of each — run the locked code at once? Give each interleaving you find, with the operations in order, and say which of them this change introduces and which exist without it.
3. What does the change make worse than `main`: liveness, cost on the hook path, rollback?
4. Do the tests establish what their names claim? Name a test that would pass on a broken lock, if one does.
5. Are the cutover, the rollback trigger and the rollback procedure precise and complete enough to act on?
6. Would a smaller change do?

End with exactly one line in this form:
`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## The diff

Against the merge base with `main`, `417e7b56df`. `switch_relay.ts` with three context lines; the contract, the rollback criteria, `agent_switch_ask.test.ts`, the interleave test and both 20.2.0 fixtures without context. Then the lock tests and the multi-process tests of `agent_switch_interprocess.test.ts` as a listing; its setup is left out (a fake `agent-switch` on `PATH`, `raised()` creating a record through the prompt hook, `hook()` spawning `tests/scripts/fixtures/switch_relay_driver.ts`, which runs one hook half and logs `<label>:start` / `<label>:written` around its checkpoint write, `together()` a common start instant, `LONG_RUNNING = 1`).

````diff
diff --git a/src/scripts/_lib/switch_relay.ts b/src/scripts/_lib/switch_relay.ts
index 5dc832331b..8c77f64484 100644
--- a/src/scripts/_lib/switch_relay.ts
+++ b/src/scripts/_lib/switch_relay.ts
@@ -32,6 +32,7 @@ const RECORD_GRACE_MS = 24 * HOUR_MS;
 const BACKOFF_AFTER = 3;
 /** How long it rests when the next reset is not known; agent-switch's own default request lifetime. */
 const BACKOFF_FALLBACK_MS = 5 * HOUR_MS;
+/** Age after which a lock whose holder cannot be identified counts as abandoned. */
 const LOCK_STALE_MS = 2000;
 const LOCK_TRIES = 50;
 const LOCK_WAIT_MS = 5;
@@ -255,38 +256,116 @@ function pause(ms: number): void {
     Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
 }
 
+/** Whether the process named by a lock token has ended; `null` when the token names none. */
+function holderGone(token: string): boolean | null {
+    const pid = Number(token.split('.')[0]);
+    if (!(pid > 0)) return null;
+    try {
+        process.kill(pid, 0);
+        return false;
+    } catch (e) {
+        return (e as NodeJS.ErrnoException).code !== 'EPERM';
+    }
+}
+
 /**
- * Run `fn` holding `<file>.lock`, or return `null` when the lock could not be
- * had. The lock file carries a token of this holder, and only a holder whose
- * token is still in it removes it: a holder older than LOCK_STALE_MS is taken
- * to have died and its lock is broken, and if it was only slow, its release
- * must not delete the lock its successor now holds.
+ * Whether a lock entry may be removed: its holder's process has ended, or it
+ * names none and is older than `LOCK_STALE_MS`. A running process under the
+ * holder's pid is taken to be the holder, however old the entry: a lock taken
+ * from a live holder would let it publish an older snapshot after its
+ * successor's. A crashed holder whose pid was reused therefore keeps the lock
+ * until that other process ends, and the link writes nothing for that record
+ * meanwhile.
+ */
+function breakable(entry: string, token: string | null): boolean {
+    let age: number;
+    try {
+        age = Date.now() - fs.statSync(entry).mtimeMs;
+    } catch {
+        return false;
+    }
+    return holderGone(token ?? '') ?? age > LOCK_STALE_MS;
+}
+
+/**
+ * Take `<file>.lock` as a directory holding one entry named by this holder's
+ * token. 20.2.0 used that path as its single lock file: it creates the file
+ * exclusively, which fails while the directory is there, and breaks a stale one
+ * with a plain removal, which fails on a directory, so a hook of that version
+ * running across an install or a rollback can never take the lock from a
+ * holder of this one. A file found there is that version's lock and is never
+ * removed by this one, whether its holder runs or not: 20.2.0 may have checked
+ * it and be about to remove it, and any removal by this version could hit a
+ * file a hook of 20.2.0 took in between. This version stays out and writes
+ * nothing; the lock fails closed. A directory whose holder is gone is removed;
+ * only the ticket holder gets here, and 20.2.0 cannot touch a directory, so
+ * nothing replaces it in between.
+ */
+function takeOuter(outer: string, token: string): boolean {
+    try {
+        fs.mkdirSync(outer);
+    } catch {
+        try {
+            // Throws on a file: the older version's lock.
+            if (!breakable(outer, fs.readdirSync(outer)[0] ?? null)) return false;
+        } catch {
+            return false;
+        }
+        fs.rmSync(outer, { recursive: true, force: true });
+        return takeOuter(outer, token);
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
+ * had. Each contender creates its own ticket `<file>.lock.<token>`, then
+ * lists the tickets, removes every breakable one, and holds the lock when no
+ * other ticket is left and it could also take `<file>.lock`; otherwise it
+ * removes its own ticket and retries after a random pause. A ticket is only ever removed by its unique
+ * name, so breaking an abandoned one can never remove a successor's, and two
+ * contenders cannot both hold: each lists after creating, so the later lister
+ * sees the earlier ticket. A live holder's ticket is never broken, so a holder
+ * that is slow or suspended keeps the lock and every waiter writes nothing.
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
@@ -322,9 +401,10 @@ export function updateSwitchRecord(
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
@@ -332,7 +412,13 @@ export function pruneSwitchState(stateEnv?: EnvMap | null, now: number = Date.no
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
index 98fd42a808..c11b1705f1 100644
--- a/agents/evidence/metrics/agent-switch-link-latency-20261108.md
+++ b/agents/evidence/metrics/agent-switch-link-latency-20261108.md
@@ -116,0 +117,6 @@ the documentation or revert the change when any of these is observed:
+9. A resumed run reads a checkpoint older than one already read for that run
+   (its `written_at` goes back with no clock change in between), or three
+   Stops in a row of one session owe a checkpoint and write none while
+   `<record>.lock` or a ticket under `switch/` names a process that is not a
+   hook of this package. Procedure, cutover and the lock cleanup a rollback to
+   20.2.0 needs: `docs/contracts/agent-switch-link.md` § Install and rollback.
diff --git a/docs/contracts/agent-switch-link.md b/docs/contracts/agent-switch-link.md
index aee66bd142..67b20c0a7e 100644
--- a/docs/contracts/agent-switch-link.md
+++ b/docs/contracts/agent-switch-link.md
@@ -279,2 +279 @@ the link over the CLI verbs below, never the MCP client.
-  prompt that dies after its claim loses that line, and the lock's stale break
-  below can let two prompts claim it. A raise never replaces a record that is
+  prompt that dies after its claim loses that line. A raise never replaces a record that is
@@ -286,7 +285,72 @@ the link over the CLI verbs below, never the MCP client.
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
+  ended, or when it names no process and is older than two seconds. A running
+  process under a ticket's pid is taken to be its holder, however old the
+  ticket is, so a slow or suspended holder never loses its exclusion and
+  cannot publish an older snapshot after a successor's; a waiter gives up after
+  about a quarter of a second and leaves the work to the next hook. The cost is
+  liveness: a holder that crashed and whose pid was reused keeps the lock until
+  that other process ends, and the link writes nothing for that record
+  meanwhile. Two contenders that collide both back off, so under contention an
+  update can be skipped; it never runs under two holders at once.
+  `<record>.lock` is the path the version before tickets (20.2.0) used as its
+  single lock file. This version holds it as a directory with one entry named
+  by the holder's token; that version creates the file exclusively, which fails
+  while the directory is there, and breaks a stale one with a plain removal,
+  which fails on a directory. Only the ticket holder takes or removes the
+  directory, and it removes one only when its holder is gone. A single lock
+  file found there is 20.2.0's and is never removed by this version, whether
+  its holder runs or not: 20.2.0 may have checked it and be about to remove
+  it, and a removal by this version could hit a file another hook of 20.2.0
+  took in between. The hook stays out and writes nothing; the lock fails
+  closed (see Install and rollback). Process liveness is read in the caller's process-id
+  namespace, so hooks of one state directory running in different namespaces
+  (a container sharing the host's home) are not covered. The lock is advisory:
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
+Across an install or a rollback a hook of 20.2.0 and one of this version can
+run at once. Neither can take the lock the other holds: this version stays out
+of a single lock file, and 20.2.0 can neither create nor remove the directory.
+What this version cannot change is 20.2.0's own lock: two of its hooks can
+still both hold when one is slower than two seconds, as they can with no hook
+of this version on the machine. That ends when the last hook of 20.2.0 has
+exited, without any step by the user.
+
+- **Liveness cost.** A single lock file whose 20.2.0 holder crashed is never
+  removed by this version, so the link writes nothing for that record until
+  the file is removed by the cutover below. A record belongs to one session,
+  so it is that session's link; a new session has a new record.
+- **Cutover, to clear such files.** The opt-in is the launch barrier: unset
+  `AGENT_CONFIG_SWITCH_QUESTION` (or set `AGENT_CONFIG_NO_SWITCH_QUESTION=1`)
+  for every host, so no hook of either version enters the link; confirm with
+  `ps -A -o pid,args` that no process running `hooks/dispatch.js` remains
+  from before; remove every regular file `*.lock` under the quota state
+  directory's `switch/`; install; set the opt-in again.
+- **Rollback trigger.** The maintainer who sees either of these rolls back:
+  a resumed run reads a checkpoint older than one already read for that run
+  in an earlier session (its `written_at` goes back with no clock change on
+  the machine in between); or three Stops in a row of one session owe a
+  checkpoint (an approved or done request whose record is not `checkpointed`)
+  and write none while `<record>.lock` or a ticket names a process that is
+  not a hook of this package. Both are read from the files under `switch/` and
+  the run's checkpoints; there is no automatic detector.
+- **Rollback to 20.2.0.** Run the cutover above, installing 20.2.0, and also
+  remove every `*.lock` directory and every `*.lock.*` ticket under `switch/`:
+  20.2.0 cannot remove a directory at `<record>.lock`, so one left by a holder
+  of this version that crashed would keep that record locked for 20.2.0.
+  20.2.0 reads the records this version writes (a test reads them with its
+  reader, kept verbatim); the record and checkpoint formats are unchanged.
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
diff --git a/tests/scripts/fixtures/switch_relay_v1_record.ts b/tests/scripts/fixtures/switch_relay_v1_record.ts
new file mode 100644
index 0000000000..9bd389774d
--- /dev/null
+++ b/tests/scripts/fixtures/switch_relay_v1_record.ts
@@ -0,0 +1,43 @@
+// The record reader of 20.2.0, kept verbatim from src/scripts/_lib/switch_relay.ts
+// at tag 20.2.0 (lines 26, 28, 38, 67-69, 71-73, 82-84, 188-197, 205-218), so a
+// test can read with that version what this one writes. Do not edit it to match
+// the current reader; only the `export` keyword is added to `parseRecord`.
+const HOUR_MS = 3_600_000;
+const RECORD_MAX_MS = 7 * 24 * HOUR_MS;
+const ID_RE = /^[0-9a-f]{16}$/;
+
+function obj(x: unknown): Record<string, unknown> | null {
+    return x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
+}
+function str(x: unknown): string | null {
+    return typeof x === 'string' && x !== '' ? x : null;
+}
+function num(x: unknown): number | null {
+    return typeof x === 'number' && Number.isFinite(x) ? x : null;
+}
+
+export interface SwitchRecord {
+    readonly id: string;
+    readonly decision_told: boolean;
+    /** Set by the Stop path once the run checkpoint for an approved move was written. */
+    readonly checkpointed: boolean;
+    /** Set once a terminal outcome was shown; a `done` record outlives that until the Stop path checkpointed it. */
+    readonly outcome_told: boolean;
+    /** Epoch ms after which the record is dropped unread, so an orphaned one stops polling. */
+    readonly expires_at: number;
+}
+
+export function parseRecord(raw: string, mtimeMs: number): SwitchRecord | null {
+    const o = obj(JSON.parse(raw));
+    const id = str(o?.['id']);
+    if (o === null || id === null || !ID_RE.test(id)) return null;
+    // A record written before records carried an expiry lasts as long as the ceiling from its last write.
+    const expires = num(o['expires_at']) ?? mtimeMs + RECORD_MAX_MS;
+    return {
+        id,
+        decision_told: o['decision_told'] === true,
+        checkpointed: o['checkpointed'] === true,
+        outcome_told: o['outcome_told'] === true,
+        expires_at: expires,
+    };
+}
diff --git a/tests/scripts/switch_relay_lock_interleave.test.ts b/tests/scripts/switch_relay_lock_interleave.test.ts
new file mode 100644
index 0000000000..19eb39b530
--- /dev/null
+++ b/tests/scripts/switch_relay_lock_interleave.test.ts
@@ -0,0 +1,131 @@
+/**
+ * road-to-a-link-with-agent-switch 8.1 — the record lock against the version
+ * before tickets (20.2.0), whose steps are those of
+ * fixtures/switch_relay_v1_lock.ts: an exclusive create of `<record>.lock`,
+ * and on failure a stale check of its mtime followed by a plain removal.
+ * This version holds that path as a directory and never removes a file there.
+ */
+import * as cp from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+const { readSwitchRecord, updateSwitchRecord, writeSwitchRecord } = await import('../../src/scripts/_lib/switch_relay.js');
+const { parseRecord: parseRecordBeforeTickets } = await import('./fixtures/switch_relay_v1_record.js');
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
+const entries = (): string[] => fs.readdirSync(path.dirname(record)).filter((n) => n.includes('.lock'));
+describe('one lock across 20.2.0 and this version', () => {
+    it('a hook of 20.2.0, paused between its stale check and its removal, can neither remove nor take the lock of a holder of this version', () => {
+        // A hook of 20.2.0 holds the older file and has run for ten seconds: stale to that version.
+        fs.writeFileSync(outer, '1.1.old');
+        backdate(outer, 10_000);
+        expect(Date.now() - fs.statSync(outer).mtimeMs > 2000).toBe(true); // the paused hook's stale check
+        fs.rmSync(outer); // its holder releases meanwhile
+        let removed = true;
+        let created = true;
+        expect(
+            lockedRun(() => {
+                try {
+                    fs.rmSync(outer, { force: true });
+                } catch {
+                    removed = false;
+                }
+                try {
+                    fs.writeFileSync(outer, 'old', { flag: 'wx' });
+                } catch {
+                    created = false;
+                }
+                expect(fs.statSync(outer).isDirectory()).toBe(true);
+            }),
+        ).toBe(true);
+        expect(removed).toBe(false);
+        expect(created).toBe(false);
+        expect(entries()).toEqual([]);
+    });
+
+    it('the older version’s lock file is left alone, even with its holder ended, and this version writes nothing', () => {
+        fs.writeFileSync(outer, `${deadPid()}.1.old`);
+        backdate(outer, 3_600_000);
+        expect(lockedRun()).toBe(false);
+        expect(fs.readFileSync(outer, 'utf-8')).toMatch(/\.old$/);
+        expect(entries()).toEqual([path.basename(outer)]);
+    });
+
+    it('this version’s lock left by a holder that ended is removed; one whose holder runs is kept', () => {
+        fs.mkdirSync(outer);
+        fs.writeFileSync(path.join(outer, `${deadPid()}.1.x`), '');
+        expect(lockedRun()).toBe(true);
+        fs.mkdirSync(outer);
+        fs.writeFileSync(path.join(outer, '1.1.x'), '');
+        backdate(outer, 3_600_000);
+        expect(lockedRun()).toBe(false);
+        expect(fs.readdirSync(outer)).toEqual(['1.1.x']);
+    });
+
+    it('this version’s lock with no holder in it is kept while fresh and removed once stale', () => {
+        fs.mkdirSync(outer);
+        expect(lockedRun()).toBe(false);
+        backdate(outer, 3000);
+        expect(lockedRun()).toBe(true);
+        expect(entries()).toEqual([]);
+    });
+
+    it('a ticket whose process runs is kept however old, with no expiry', () => {
+        const holder = cp.spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)']);
+        try {
+            const t = `${record}.lock.${String(holder.pid)}.1.x`;
+            fs.writeFileSync(t, '');
+            backdate(t, 24 * 3_600_000);
+            expect(lockedRun()).toBe(false);
+            expect(fs.existsSync(t)).toBe(true);
+        } finally {
+            holder.kill();
+        }
+    });
+});
+
+it('20.2.0 reads the record this version writes, field for field', () => {
+    const rec = { id: '0123456789abcdef', decision_told: true, checkpointed: true, outcome_told: false, expires_at: Date.now() + 60_000 };
+    writeSwitchRecord(SESSION, rec, stateEnv);
+    expect(readSwitchRecord(SESSION, stateEnv)).toEqual(rec);
+    expect(parseRecordBeforeTickets(fs.readFileSync(record, 'utf-8'), fs.statSync(record).mtimeMs)).toEqual(rec);
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

    it('every breakable ticket around a live one is removed, and the live one still keeps the lock', () => {
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

});

describe('8.2 two hook processes at once', () => {
    it('relay: a decision made in agent-switch is told by exactly one of two prompts', async () => {
        raised();
        setRequest(APPROVED);
        const at = together();
        const outs = (await Promise.all([hook({ op: 'prompt', startAt: at }), hook({ op: 'prompt', startAt: at })])) as string[][];
        const told = outs.flat().filter((l) => l.includes('approved in agent-switch'));
        expect(told).toHaveLength(1);
    }, 20_000);

    it('back-off: three prompts failing at once count three, rest the link and say so once', async () => {
        raised();
        fs.rmSync(switchFile);
        const at = together();
        const outs = (await Promise.all([1, 2, 3].map(() => hook({ op: 'prompt', startAt: at })))) as string[][];
        expect(showCalls()).toBe(3);
        expect(outs.flat().filter((l) => l.includes('did not answer'))).toHaveLength(1);
        const later = (await hook({ op: 'prompt' })) as string[];
        expect(showCalls()).toBe(3);
        expect(later.filter((l) => l.includes('did not answer'))).toEqual([]);
    }, 20_000);

    it('checkpoint: two Stops at once write it exactly once', async () => {
        raised();
        setRequest(APPROVED);
        const at = together();
        const wrote = await Promise.all([hook({ op: 'stop', startAt: at, holdMs: 300, label: 'A' }), hook({ op: 'stop', startAt: at, holdMs: 300, label: 'B' })]);
        expect(wrote.filter((w) => w === true)).toHaveLength(1);
        expect(writes()).toHaveLength(2);
        expect(writes()[0]?.split(':')[0]).toBe(writes()[1]?.split(':')[0]);
    }, 20_000);
});
````
