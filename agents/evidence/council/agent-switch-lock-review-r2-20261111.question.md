<!-- evidence-type: analysis -->

# Review — the agent-switch record lock, round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository: the record lock of the agent-switch link in `src/scripts/_lib/switch_relay.ts`, on its own pull request. It is not on the ratification gate's list; this review is commissioned because the lock decides whether two hook processes can publish a run checkpoint out of order.

## Context

The agent-switch link is opt-in (`AGENT_CONFIG_SWITCH_QUESTION=1`). Two hooks of one session touch a per-session record under the user-global quota state, `switch/<hash>.json`: the prompt hook relays a decision and claims each line it shows; the Stop hook builds and writes the run checkpoint while it holds the record lock, so Stops write in order. Every hook is a short-lived, synchronous `node` process running `dist/hooks/dispatch.js` (from the staged runtime `~/.event4u/agent-config/runtime/current`, a symlink swapped by rename on install, or from an npm-installed package); a hook that cannot take the lock within about 250 ms writes nothing and leaves the work to the next hook. Released 20.2.0 locks with a single file `<record>.lock`, created exclusively and broken once its mtime is two seconds old (its loop is in `tests/scripts/fixtures/switch_relay_v1_lock.ts`).

Round 1 of this review refused, both seats with high confidence. Its points, quoted from the record:

- "`reapOuter` temporarily removes a live legacy holder's lock from its public pathname. Restoring it afterward cannot preserve exclusion during that gap, particularly if the reaper crashes."
- "`Date.now() - mtimeMs` and process elapsed time do not necessarily advance together. A forward clock correction can satisfy the PID-reuse comparison incorrectly."
- "Require draining before activation, then remove the rename-and-restore compatibility machinery. Retain unique tickets and conservative live-holder protection."
- "Each `spawnSync` has a one-second timeout; unreadable results are not cached and can be retried across 50 attempts."
- "Define a qualifying Stop and a concrete failure threshold. Specify how operators identify writers, prevent further launches, terminate or drain existing writers, and verify exit before cleanup." "Add a compatibility check showing that 20.2.0 reads the retained record/checkpoint formats."
- On the tests: the restoration-gap acquisition, the reaper crash, clock-induced false reuse, and "whatever the listing order" exercising one order.

## What the change states it does since round 1

- The drain: a hook takes no lock, and so writes nothing, until `ps -A -o pid=,etime=,args=` shows no other process whose command line names `hooks/dispatch.js` and that started before the change time of the file this process was started from (`realpath(process.argv[1])`), with one second of slack counted as earlier. Then it removes every regular file `*.lock` in `switch/` and writes a marker `.drained.<ctime>`; later hooks of that install see the marker and skip `ps`. The marker is pruned after eight days like other state files. Without readable `ps` (Windows) the drain ends fifteen minutes after the install. A suspended pre-install hook stays visible to `ps` and keeps the drain open.
- The rename-and-restore reaping is removed. After the drain this version never removes a single lock *file*; a file found at `<record>.lock` makes this version stay out. It removes a `<record>.lock` *directory* (its own form) only as the ticket holder and only when the entry in it names an ended process, or it has no entry and is older than two seconds.
- The reused-pid inference from `ps` elapsed time is removed: a running process under a ticket's pid is its holder, however old the ticket. No `ps` call on the lock's retry path.
- Tests: the drain's four cases with `ps` replaced; after the drain, 20.2.0's check-then-remove paused against a holder of this version, a 20.2.0 lock file left alone with its holder ended, the directory reap, a day-old ticket of a running process kept; a holding Stop suspended with `SIGSTOP` past the stale break in real processes. Five of the nine tests in the interleave file fail on the round 1 lock. The listing-order test is renamed to what it checks.
- Bytes: the `switch_link` chunk is 30,293 B against its ratified 30,300 B ceiling.
- Rollback: the contract's "Install and rollback" section and criterion 9.

## Answer each question, by number

1. For each quoted round 1 point: resolved, partly, or not? Say what still allows the failure it names, if anything.
2. Can two holders — of this version, of 20.2.0, or one of each — run the locked code at once, after the drain, before it, or across a rollback? Give each interleaving you find, with the operations in order.
3. Is the drain criterion sound: can it say yes while a 20.2.0 hook still runs, or never say yes on a healthy machine? Consider the start-time reading, the slack, the marker, carriers other than the staged runtime, and processes that are not hooks.
4. What does the change make worse: liveness, cost on the hook path, behaviour without `ps`, rollback?
5. Do the tests establish what their names claim? Name a test that would pass on a broken lock, if one does.
6. Is the rollback trigger and procedure precise and complete enough to act on?
7. Would a smaller change do?

End with exactly one line in this form:
`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## The diff

Against the merge base with `main`, `417e7b56df`. `switch_relay.ts` with three context lines; the contract, the rollback criteria, `agent_switch_ask.test.ts`, the interleave test and the 20.2.0 fixture without context. The lock tests of `agent_switch_interprocess.test.ts` follow as a listing; left out of it are its setup (a fake `agent-switch` on `PATH`, `raised()` creating a record through the prompt hook, `hook()` spawning `tests/scripts/fixtures/switch_relay_driver.ts`, which runs one hook half and logs `<label>:start` / `<label>:written` around its checkpoint write, `LONG_RUNNING = 1`) and its block of two- and three-process relay, back-off and checkpoint tests.

````diff
diff --git a/src/scripts/_lib/switch_relay.ts b/src/scripts/_lib/switch_relay.ts
index 5dc832331b..51863508f6 100644
--- a/src/scripts/_lib/switch_relay.ts
+++ b/src/scripts/_lib/switch_relay.ts
@@ -13,6 +13,7 @@
  * each shown once, and a request is no longer read once it reached a terminal state.
  */
 
+import { spawnSync } from 'node:child_process';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 
@@ -32,7 +33,10 @@ const RECORD_GRACE_MS = 24 * HOUR_MS;
 const BACKOFF_AFTER = 3;
 /** How long it rests when the next reset is not known; agent-switch's own default request lifetime. */
 const BACKOFF_FALLBACK_MS = 5 * HOUR_MS;
+/** Age after which a lock whose holder cannot be identified counts as abandoned. */
 const LOCK_STALE_MS = 2000;
+/** Where `ps` cannot be read, how long after an install its earlier hooks are taken to have ended. */
+const DRAIN_UNSEEN_MS = 15 * 60_000;
 const LOCK_TRIES = 50;
 const LOCK_WAIT_MS = 5;
 const ID_RE = /^[0-9a-f]{16}$/;
@@ -255,38 +259,167 @@ function pause(ms: number): void {
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
+/**
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
 /**
- * Run `fn` holding `<file>.lock`, or return `null` when the lock could not be
- * had. The lock file carries a token of this holder, and only a holder whose
- * token is still in it removes it: a holder older than LOCK_STALE_MS is taken
- * to have died and its lock is broken, and if it was only slow, its release
- * must not delete the lock its successor now holds.
+ * Whether no hook process started before this hook's own install still runs,
+ * in which case the version before tickets (20.2.0) is gone from this machine
+ * and its single lock files are abandoned. Until then this version takes no
+ * lock, so it writes nothing and leaves the work to a later hook: that version
+ * breaks its lock file with a check followed by a removal, which no protocol of
+ * this one can make safe while it runs. The install is the change time of the
+ * file this process was started from; a hook is a process running
+ * `hooks/dispatch.js`. The answer is kept in a marker named by the install's
+ * change time, so `ps` runs only until it is yes. Where `ps` cannot be read, as on Windows, the install
+ * counts as drained `DRAIN_UNSEEN_MS` after it, which a hook that is suspended
+ * for longer than that outlasts.
+ */
+function drained(dir: string): boolean {
+    let at: number;
+    try {
+        at = fs.statSync(fs.realpathSync(process.argv[1] ?? '')).ctimeMs;
+    } catch {
+        return false;
+    }
+    const marker = path.join(dir, `.drained.${Math.trunc(at)}`);
+    if (fs.existsSync(marker)) return true;
+    const ps = spawnSync('ps', ['-A', '-o', 'pid=,etime=,args='], { encoding: 'utf-8', timeout: 2000 });
+    if (ps.status !== 0) {
+        if (Date.now() - at < DRAIN_UNSEEN_MS) return false;
+    } else {
+        for (const line of ps.stdout.split('\n')) {
+            const m = /^\s*(\d+)\s+([\d:-]+)\s.*hooks\/dispatch\.js/.exec(line);
+            if (m === null || Number(m[1]) === process.pid) continue;
+            // `[[dd-]hh:]mm:ss` it has run, whole seconds: started up to a second before this reading.
+            const [s = 0, mi = 0, h = 0, d = 0] = (m[2] ?? '').split(/[-:]/).reverse().map(Number);
+            if (Date.now() - (((d * 24 + h) * 60 + mi) * 60 + s) * 1000 < at + 1000) return false;
+        }
+    }
+    try {
+        fs.mkdirSync(dir, { recursive: true });
+        for (const n of fs.readdirSync(dir)) {
+            const p = path.join(dir, n);
+            if (n.endsWith('.lock') && fs.statSync(p).isFile()) fs.rmSync(p, { force: true });
+        }
+        fs.writeFileSync(marker, '');
+        return true;
+    } catch {
+        return false;
+    }
+}
+
+/** `drained` for the switch state directory; the hooks reach it through `locked`. */
+export function drainSwitchLock(stateEnv?: EnvMap | null): boolean {
+    return drained(path.dirname(switchRecordPath('x', stateEnv)));
+}
+
+/**
+ * Take `<file>.lock` as a directory holding one entry named by this holder's
+ * token. 20.2.0 used that path as its single lock file: it creates the file
+ * exclusively, which fails while the directory is there, and breaks a stale one
+ * with a plain removal, which fails on a directory, so a hook of that version
+ * started after the drain, by a rollback, can never take the lock from a holder
+ * of this one. A file found there is that version's lock and is left alone:
+ * this version stays out and writes nothing. A directory whose holder is gone
+ * is removed; only the ticket holder gets here, and 20.2.0 cannot touch a
+ * directory, so nothing replaces it in between.
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
+ * had. Nothing is taken before `drainSwitchLock` says yes. Each contender
+ * creates its own ticket `<file>.lock.<token>`, then lists the tickets, removes
+ * every breakable one, and holds the lock when no other ticket is left and it
+ * could also take `<file>.lock`; otherwise it removes its own ticket and
+ * retries after a random pause. A ticket is only ever removed by its unique
+ * name, so breaking an abandoned one can never remove a successor's, and two
+ * contenders cannot both hold: each lists after creating, so the later lister
+ * sees the earlier ticket. A live holder's ticket is never broken, so a holder
+ * that is slow or suspended keeps the lock and every waiter writes nothing.
  */
 function locked<T>(file: string, fn: () => T): { value: T } | null {
-    const held = `${file}.lock`;
+    const dir = path.dirname(file);
+    if (!drained(dir)) return null;
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
@@ -322,9 +455,10 @@ export function updateSwitchRecord(
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
@@ -332,7 +466,13 @@ export function pruneSwitchState(stateEnv?: EnvMap | null, now: number = Date.no
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
index 98fd42a808..c1c675fbc2 100644
--- a/agents/evidence/metrics/agent-switch-link-latency-20261108.md
+++ b/agents/evidence/metrics/agent-switch-link-latency-20261108.md
@@ -116,0 +117,7 @@ the documentation or revert the change when any of these is observed:
+9. Around an install or a rollback, a resumed run's checkpoint is older than
+   one already written for it, or an owed checkpoint stays unwritten while
+   `<record>.lock` or a ticket under `switch/` names a process that is not a
+   hook of this package; or the link writes nothing for longer than fifteen
+   minutes after an install because the drain does not end. Procedure,
+   including the lock cleanup a rollback to 20.2.0 needs:
+   `docs/contracts/agent-switch-link.md` § Install and rollback.
diff --git a/docs/contracts/agent-switch-link.md b/docs/contracts/agent-switch-link.md
index aee66bd142..b6aa39fbb4 100644
--- a/docs/contracts/agent-switch-link.md
+++ b/docs/contracts/agent-switch-link.md
@@ -279,2 +279 @@ the link over the CLI verbs below, never the MCP client.
-  prompt that dies after its claim loses that line, and the lock's stale break
-  below can let two prompts claim it. A raise never replaces a record that is
+  prompt that dies after its claim loses that line. A raise never replaces a record that is
@@ -286,7 +285,73 @@ the link over the CLI verbs below, never the MCP client.
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
+  file found there is that version's and is never removed by a hook of this
+  version after the drain: the hook stays out and writes nothing (see Install
+  and rollback). Process liveness is read in the caller's process-id
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
+20.2.0 breaks its lock file with a check of its age followed by a removal, so
+no protocol of a later version is safe while a hook of 20.2.0 still runs:
+whatever that hook checked may be replaced before it removes it. This version
+therefore drains before it locks.
+
+- **The drain.** A hook of this version takes no lock, and so writes nothing,
+  until no hook process started before its own install still runs. The
+  install is the change time of the file the hook process was started from; a
+  hook is a process whose command line names `hooks/dispatch.js`, read from
+  `ps -A -o pid=,etime=,args=`. A hook started less than a second after the
+  install counts as an earlier one. Once none runs, the hook removes every
+  single lock file under the quota state directory's `switch/` (none has a
+  holder left) and writes a marker named by the install's change time, so
+  `ps` runs only until the answer is yes; the marker is pruned after eight
+  days like any state file, and the check then runs once more. A hook that is
+  suspended keeps the drain open for as long as it is. Where `ps` cannot be
+  read, as on Windows, the install counts as drained fifteen minutes after
+  it, which a hook suspended for longer than that outlasts. A wall-clock step
+  between the install and the check shifts both readings it compares and can
+  misjudge by the size of the step.
+- **Rollback trigger.** Roll back when one of these is seen, and the
+  maintainer who sees it acts on it: a resumed run whose checkpoint is older
+  than one already written for it (its `written_at` goes back), or a record
+  whose owed checkpoint stays unwritten across Stops while `<record>.lock` or
+  a ticket names a process that is not a hook of this package. Either is
+  read from the files under `switch/`; there is no automatic detector.
+- **Rollback to 20.2.0.** Install 20.2.0. A hook of this version still running
+  then stays out of every record where a hook of 20.2.0 holds the lock file,
+  and keeps 20.2.0 out of one it holds itself. Once `ps` shows no hook started
+  before the rollback, remove every `*.lock` directory and every `*.lock.*`
+  ticket under `switch/`: 20.2.0 cannot remove a directory at `<record>.lock`,
+  so a holder of this version that crashed would otherwise keep that record
+  locked for 20.2.0, which then writes nothing for it. 20.2.0 reads the
+  record and checkpoint files this version writes; their format is unchanged
+  by the lock.
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
index 0000000000..b967857c32
--- /dev/null
+++ b/tests/scripts/switch_relay_lock_interleave.test.ts
@@ -0,0 +1,199 @@
+/**
+ * road-to-a-link-with-agent-switch 8.1 — the record lock against the version
+ * before tickets (20.2.0), whose steps are those of
+ * fixtures/switch_relay_v1_lock.ts: an exclusive create of `<record>.lock`,
+ * and on failure a stale check of its mtime followed by a plain removal.
+ * This version takes no lock until no hook started before its install runs
+ * (the drain), and after it never removes that version's lock file.
+ * Its own file, because it replaces `ps` (through `spawnSync`) for the module.
+ */
+import * as cp from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+const seam = vi.hoisted(() => ({ ps: null as string | null | undefined }));
+
+vi.mock('node:child_process', async (importOriginal) => {
+    const real = await importOriginal<typeof cp>();
+    return {
+        ...real,
+        spawnSync: (...args: Parameters<typeof cp.spawnSync>) => {
+            if (args[0] !== 'ps' || seam.ps === undefined) return real.spawnSync(...args);
+            // `null`: no `ps` on this host.
+            if (seam.ps === null) return { pid: 0, output: [], stdout: '', stderr: '', status: null, signal: null, error: new Error('ENOENT') };
+            return { pid: 0, output: [], stdout: seam.ps, stderr: '', status: 0, signal: null };
+        },
+    };
+});
+
+const { drainSwitchLock, updateSwitchRecord } = await import('../../src/scripts/_lib/switch_relay.js');
+const { switchRecordPath } = await import('../../src/scripts/_lib/switch_record_path.js');
+
+const SESSION = 'a'.repeat(16);
+let home: string;
+let stateEnv: Record<string, string>;
+let record: string;
+let outer: string;
+let argv1: string | undefined;
+
+beforeEach(() => {
+    home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-interleave-'));
+    stateEnv = { EVENT4U_CONFIG_HOME: home };
+    record = switchRecordPath(SESSION, stateEnv);
+    outer = `${record}.lock`;
+    fs.mkdirSync(path.dirname(record), { recursive: true });
+    argv1 = process.argv[1];
+    seam.ps = '';
+});
+afterEach(() => {
+    seam.ps = undefined;
+    process.argv[1] = argv1 ?? '';
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
+/** This process as if just installed: the file it was started from was created now. */
+function freshInstall(): void {
+    const self = path.join(home, 'dispatch.js');
+    fs.writeFileSync(self, '');
+    process.argv[1] = self;
+}
+
+describe('the drain', () => {
+    it('while a hook started before this install runs, no lock is taken and the older lock file stays', () => {
+        freshInstall();
+        fs.writeFileSync(outer, `${deadPid()}.1.old`);
+        seam.ps = `  4242 01:00 node /home/u/.event4u/agent-config/runtime/current/dist/hooks/dispatch.js --event stop\n`;
+        expect(lockedRun()).toBe(false);
+        expect(drainSwitchLock(stateEnv)).toBe(false);
+        expect(fs.readFileSync(outer, 'utf-8')).toMatch(/\.old$/);
+    });
+
+    it('once none runs, the older lock files are removed and the lock is taken; the answer is kept', () => {
+        freshInstall();
+        fs.writeFileSync(outer, `${deadPid()}.1.old`);
+        const backoffLock = record.replace(/\.json$/, '.backoff.json.lock');
+        fs.writeFileSync(backoffLock, `${deadPid()}.1.old`);
+        // A hook started after the install (which the second's slack needs to have passed), and a process that is no hook.
+        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
+        seam.ps = `  4242 00:00 node /x/dist/hooks/dispatch.js\n  4343 40-00:00:00 /usr/sbin/sshd\n`;
+        expect(lockedRun()).toBe(true);
+        expect(fs.existsSync(outer)).toBe(false);
+        expect(fs.existsSync(backoffLock)).toBe(false);
+        seam.ps = `  4242 999-00:00:00 node /x/dist/hooks/dispatch.js\n`;
+        expect(drainSwitchLock(stateEnv)).toBe(true);
+    });
+
+    it('a hook started a moment before the install counts as one of the earlier install', () => {
+        freshInstall();
+        seam.ps = `  4242 00:01 node /x/dist/hooks/dispatch.js\n`;
+        expect(drainSwitchLock(stateEnv)).toBe(false);
+    });
+
+    it('without `ps`, an install counts as drained fifteen minutes after it, not before', () => {
+        seam.ps = null;
+        freshInstall();
+        expect(drainSwitchLock(stateEnv)).toBe(false);
+        expect(lockedRun()).toBe(false);
+        // A file created long before: the system shell.
+        process.argv[1] = '/bin/sh';
+        expect(Date.now() - fs.statSync(fs.realpathSync('/bin/sh')).ctimeMs).toBeGreaterThan(15 * 60_000);
+        expect(drainSwitchLock(stateEnv)).toBe(true);
+    });
+});
+
+describe('after the drain', () => {
+    beforeEach(() => {
+        expect(drainSwitchLock(stateEnv)).toBe(true);
+    });
+
+    it('a hook of the older version, paused between its stale check and its removal, cannot remove this version’s lock', () => {
+        // A rolled-back hook holds the older file and has run for ten seconds: stale to that version.
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

describe('the lock across an install, after the drain: the older single lock file', () => {
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

````
