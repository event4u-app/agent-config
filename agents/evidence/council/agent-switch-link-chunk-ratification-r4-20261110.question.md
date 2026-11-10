<!-- evidence-type: analysis -->

# Ratification review — the agent-switch link as its own lazy chunk — round 4

You are an independent reviewer for a change in the `event4u/agent-config` repository. Three files in it are hook plumbing on the ratification gate's list (`src/config/hook-bundle-budget.json`, `src/scripts/hooks/bundle_digest.ts`, `src/scripts/hooks/bundle_integrity.ts`), so the change needs a two-provider verdict under ADR-268 § 4: an agent may change hook plumbing but may not ratify its own change.

subject: b62a8fa91e2724f189a7c5c01e60fe9126f91e3a834427d5255bd1487c4b6d66

(The digest covers the gated files at commit `2f703925ce`, computed with `./scripts-run src/scripts/ratification_subject`.)

## What the change does

- Background: the previous change on this path raised the `quota_notice` lazy chunk ceiling from 41,000 to 49,400 bytes to carry the agent-switch link (a prompt-hook feature that asks agent-switch to move a session off an account near its plan limit). That raise was refused by two providers and merged by the owner with the refusal on record; the follow-up roadmap asked to bring the chunk back under 41,000 bytes or ratify the raise.
- This change takes the first path. The link's prompt half (`switchTurn`) and its Stop half (`checkpointBeforeMove`) move out of `quota_notice_hook.ts` into a new entry `src/scripts/switch_link.ts`, built as its own lazy chunk `dist/hooks/switch_link.chunk.cjs`. `switchTurn` is moved verbatim except that the per-cycle claim is passed in as a function instead of imported.
- `quota_notice` loads that chunk only when the switch question is on (`switchQuestionOff(env)` false); the Stop path loads it only for a session that has a switch record (unchanged condition, new chunk name). Loading goes through the existing `loadLazyExport`, which, when running bundled, refuses a chunk whose `.sha256` sidecar is missing, malformed or does not match (unchanged logic). A chunk that does not load means no switch question and today's quota notice.
- To let a lazy chunk call that verifier without pulling the YAML reader in (`bundle_integrity.ts` imports `host_semantics` → `host_lowering` → `yaml`, about 270 KB), `IntegrityVerdict`, `parseSidecar`, `sidecarPathFor`, `hashFile` and `verifyBundle` move verbatim from `bundle_integrity.ts` into a new `bundle_digest.ts`; `bundle_integrity.ts` imports and re-exports them, so its callers and its own exit-code decisions are unchanged.
- Budget (`hook-bundle-budget.json`): the `quota_notice` ceiling is LOWERED from 49,400 to 31,400 bytes (measured 28,588 B, below the original 41,000 target). A new entry registers `switch_link` at 32,200 bytes (measured 29,311 B, about 10 % headroom). A new chunk group `agent-switch-link-opted-in` bounds the two together at 63,500 B (measured 57,899 B), the figure a round 3 seat named as acceptable if the gate enforces it. The dispatch bundle ceiling is unchanged (measured 1,584,388 of 1,585,000 B). What a prompt parses: without the opt-in (the default; on only with `AGENT_CONFIG_SWITCH_QUESTION=1`) 28,588 B instead of 47,877 B; with it both chunks, 57,899 B instead of 47,877 B (+10,022 B, +21 %): the loader (`hooks/lazy_concern.ts`, `hooks/bundle_digest.ts`, about 4,000 B), helpers both chunks carry (about 1,600 B), and the lock and call-surface code below. The budget entry states all of this.
- Gate (`check_hook_bundle_composition.ts`, not on the gated list but part of this change): an optional `chunk_groups` list in the budget, each with a name, two or more distinct chunk entries and `max_bytes`. The gate sums the measured bytes of the named chunks and fails over the ceiling; a group naming a chunk without its own ceiling is a finding; a group whose chunks were not all measured is a finding, never a pass; a group ceiling raised against the base needs a new `raise_log` entry with `chunk_group` and the new `to`, by the existing chunk rule; a newly registered group needs none, as for chunks. Setting the group ceiling below the measured sum makes the gate fail (checked).
- **Explicitly put to this review:** the opted-in allowance of 63,500 B, now enforced as a group, against the 49,400 B single ceiling the previous change asked for. If it is not acceptable, say at what figure.
- Not gated but in the same change: the record lock in `_lib/switch_relay.ts`. Before this change a lock older than two seconds was broken by age alone, so a Stop whose checkpoint write ran longer lost its lock to a second Stop. Now the lock is a set of tickets: each contender creates its own file `<record>.lock.<pid>.<time>.<random>` (exclusive create), lists the directory, removes every other ticket that is breakable (the scan visits all of them), and holds the lock only when no other ticket is left AND it can take the older single lock file `<record>.lock` by exclusive create (breaking it only on the same rules), and then dates that file fifteen minutes ahead with `utimes`; otherwise it removes its own ticket and retries after a random 2.5–7.5 ms pause, up to 50 times, then skips the update. The holder releases `<record>.lock` only while its own token is in it, then its ticket. A ticket or the older file is breakable when its pid has ended (at once), when it names no pid (after two seconds), or when it is older than fifteen minutes (taken as a reused pid; a holder genuinely still writing then loses its exclusion, which the contract states). Mutual exclusion between tickets: each contender lists after creating its ticket, so of two overlapping contenders the later lister sees the earlier ticket, which is not breakable while its holder is alive and younger than fifteen minutes. Across versions: the older version (on `main` since the previous change) acquires only by exclusive create of `<record>.lock` and breaks that file once its mtime is two seconds old; the newer holder holds that file too, dated ahead, so the older version's exclusive create fails and its age check never sees two seconds while the newer holder runs; the newer version judges an older holder's file by its pid (alive: kept for fifteen minutes; dead: broken at once). Exactly one of the two exclusive creates wins, in either direction (upgrade or rollback). A newer holder that crashes leaves the dated file: the newer version breaks it at once (dead pid), an older hook only after fifteen minutes and two seconds. A reused pid holding the older file is waited out for thirty minutes by the newer version, not fifteen. Stated limits: contenders that collide both back off, so an update can be skipped (rollback criterion 5); pid liveness is read in the caller's pid namespace, so hooks sharing one state directory across namespaces are not covered.
- Lock tests in `tests/scripts/agent_switch_interprocess.test.ts` run the prompt and Stop halves as real `node` processes started at one instant: a Stop held 3.5 s keeps its lock against a second Stop at 2.3 s; a dead holder's ticket is removed; a live ticket beside a dead one survives the break and blocks the update; three Stops breaking a dead holder's lock at once write the checkpoint once; a live holder's 10-second-old ticket is kept and a 16-minute-old one is broken; every breakable ticket among six is removed whatever the listing order while a live one keeps the lock; an older-version holder's `<record>.lock` with a live pid, ten seconds old, keeps this version out and is left as it was; the older version's whole acquire loop, kept verbatim from `d2475e82f8` in a test fixture, run 2.3 s into a newer holder's 3.5 s write, does not enter and takes the lock once released; while this version holds, an exclusive create of `<record>.lock` (the older version's acquire) fails, and the file is gone after release; a dead holder's `<record>.lock` is broken; one relay line across two prompts; one back-off line and three agent-switch calls across three failing prompts; one checkpoint write across two Stops. Mutations: removing the breakable check fails 10 tests; holding without listing fails 9–11 tests in three of three runs; not taking `<record>.lock` fails the two cross-version tests; not dating it ahead fails the older-acquire-loop test (the older version enters); stopping the scan at the first live ticket fails the listing-order test in three of three runs.
- Call-surface version (API compatibility, not build identity): `_lib/switch_link_api.ts` holds `SWITCH_LINK_API = 1`, compiled into the chunk and into both callers. The chunk exports `linkFor(api)`, which returns `{ switchTurn, checkpointBeforeMove }` only when `api` equals its own copy; `quota_notice` and the Stop path call it with theirs. A chunk built against another call surface is therefore not called even when its sidecar matches it; two builds with the same number are taken as compatible, which holds only while the number is raised whenever either function's signature or meaning changes (stated at the constant). Asking `linkFor` loads the chunk's module body, which defines functions and does nothing else. The digest check stays as it was: it detects a chunk that is not the bytes its sidecar names; it is not a signature and does not stop someone able to write both files.
- Tests for the chunk (`tests/scripts/agent_switch_ask.test.ts`): the chunk is not loaded without the opt-in and is loaded once with it; a loader that returns nothing gives no raise and today's notice; the built `quota_notice` chunk loads the built `switch_link` chunk beside it with matching sidecars; a mismatched digest means the chunk is not loaded; the Stop path's loader, called in bundled mode beside the built `switch_link` chunk, loads it with a matching sidecar and refuses it with a missing, malformed or mismatched one; a built chunk whose `SWITCH_LINK_API` was changed, with a sidecar re-hashed to match, answers `null` to the callers' version; a Stop that cannot load the link writes nothing and leaves the checkpoint owed, and the next Stop that can writes it; without the opt-in the Stop path writes nothing and does not ask agent-switch (the opt-in is the off switch for both halves). Removing the digest check from the loader fails two of these; ignoring the version in `linkFor` fails the call-surface test.
- Rollback criteria, from `agents/evidence/metrics/agent-switch-link-latency-20261108.md`, withdraw the opt-in or revert on: more than three 5 s link stalls before the link rests; above 500 ms p95 for either hook with a request open and agent-switch answering; a checkpoint owed for an approved or finished move never written while the session runs on, or an older snapshot over a newer one; a relayed line or resting notice shown twice; an update skipped because the lock could not be had in time (seen as one of the two before); a back-off that cannot be kept on a machine that pays stalls; either chunk or the group outgrowing its ceiling without a reviewed raise; a relayed-twice or older-over-newer observation around an install or rollback (the two lock versions entering together); with the opt-in on and agent-switch answering, no question on a hot window or a checkpoint owed across Stops (the link chunk not loading).
- Revert: the ten commits on `feat/agent-switch-link-residuals` after its base `d2475e82f8` (that is, `git revert d2475e82f8..2f703925ce`, which includes `6d1cfd62f3` and `2f703925ce`), or the PR's merge commit once merged; a revert reaches installed hooks with the next package release and install. The lock change and the chunk split are separate commits (`6d1cfd62f3`, `a24cd73827`, `a65f6d5dfd` and `0d9f090cd8` for the lock; `84750636c1`, `362505fbf2` and `2f703925ce` for the split and its call surface; `1e52ebef44` for the group gate) and can be reverted separately.

## Since round 3

Rounds 1–3 returned `refused` from both seats (round 3 subject `05c3f3d7…`). Round 3 findings and what changed:

- The older version still broke `<record>.lock` after two seconds, so a newer holder writing longer was entered (both seats, dealbreaker), and the test ran only the exclusive create, not the older version's loop. Accepted: the newer holder dates the file ahead; the older version's whole acquire loop now runs in a test against a newer holder past two seconds, and fails without the fix.
- The combined allowance was stated but not enforced (both seats; one seat would accept 63,500 B if the gate enforces it). Accepted: the gate has chunk groups, and the group is registered at 63,500 B.
- "Build binding" overstated what the version check does (both seats). Accepted: called API compatibility everywhere, with its condition.
- Rollback criteria for a mixed-version overlap, a group breach and a link chunk that does not load (openai). Added.
- Ship the lock separately (both seats). Not changed, for the reason given in round 3; the commits stay separable.
- An adoption threshold (one seat) is not adopted: the other seat noted it needs evidence and is not a correctness guarantee.

## Answer each question, by number

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

End with exactly one line in this form:
`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## The diff

`git diff -U0 d2475e82f8..2f703925ce` (no context lines, for size) for the budget, the gate, `bundle_digest.ts`, the loader, the chunk list, the Stop hook, the call-surface constant and the lock. `quota_notice_hook.ts` and `switch_link.ts` are left out: since round 3 only their comments changed ("another build" became "another call surface"), and their round 3 diff is in the round 3 prompt beside this file. Tests: only what changed since round 3 (`git diff -U0 362505fbf2..2f703925ce`), the older-lock fixture in full; earlier test diffs are in the round 1–3 prompts beside this file. Left out as a move: `bundle_integrity.ts` (round 1 prompt). Left out for size: the interprocess driver, the contract and evidence edits, the roadmap.

````diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 18043a8cd4..eb157ed809 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -308 +308 @@
-            "max_bytes": 49400,
+            "max_bytes": 31400,
@@ -310 +310,7 @@
-            "derivation": "Measured 20,703 bytes on 2026-10-25 (road-to-a-quota-the-user-sees-coming 3.2-4.3: the quota and metered notices, the metered spawn ask with its per-call pending marker and read-path expiry from ratification rounds 1-5, the quota ledger reader, the pressure model, the billing-class reader and the billing-grant check), no `yaml` (it reads JSON only). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Two manifest concerns share the script (`quota-notice` on claude `user_prompt_submit`, `metered-spawn-ask` on claude `pre_tool_use` for Agent/Task), so the bundle carries one LAZY_CONCERNS row for both; the row fits inside the room the compacted LAZY_CONCERNS table freed, so the dispatch ceiling is not raised. A missing chunk falls back to the spawn path and costs latency, never a notice."
+            "derivation": "Measured 20,703 bytes on 2026-10-25 (road-to-a-quota-the-user-sees-coming 3.2-4.3: the quota and metered notices, the metered spawn ask with its per-call pending marker and read-path expiry from ratification rounds 1-5, the quota ledger reader, the pressure model, the billing-class reader and the billing-grant check), no `yaml` (it reads JSON only). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Two manifest concerns share the script (`quota-notice` on claude `user_prompt_submit`, `metered-spawn-ask` on claude `pre_tool_use` for Agent/Task), so the bundle carries one LAZY_CONCERNS row for both; the row fits inside the room the compacted LAZY_CONCERNS table freed, so the dispatch ceiling is not raised. A missing chunk falls back to the spawn path and costs latency, never a notice. LOWERED to 31,400 on 2026-11-10 (road-to-a-link-with-agent-switch 8.4): the agent-switch link moved into its own chunk, src/scripts/switch_link.ts, which this one loads only while the switch question is on; measured 28,588 bytes after the move against 47,877 before it, and the ceiling is that reading plus about 10 %, rounded."
+        },
+        {
+            "entry": "src/scripts/switch_link.ts",
+            "max_bytes": 32200,
+            "registered_at": "2026-11-10",
+            "derivation": "Measured 29,311 bytes on 2026-11-10 (road-to-a-link-with-agent-switch 8.4). The chunk holds the agent-switch link: the prompt's switch turn (raise, relay, back-off) and the Stop path's checkpoint, with the record and its lock (`_lib/switch_relay.ts`, 15,340 B), the link's spawn (`_lib/agent_switch_link.ts`, `_lib/spawn_env.ts`) and the atomic writer. No `yaml`. The ceiling is that reading plus about 10 %, rounded, the margin of the quota_notice and self_repair rows. WHY IT IS A CHUNK: in the quota_notice chunk the link took that chunk to 47,877 B against a 41,000 B ceiling a ratification never accepted raising (Phase 7, rounds 1-6 refused); the switch question is opt-in (D5), so a prompt without it should not parse the link at all. `quota-notice` loads `switchTurn` from here only when the question is on, and the Stop path loads `checkpointBeforeMove` only for a session with a switch record. A missing or mis-digested chunk means no switch question and no checkpoint before a move, the same as running without agent-switch; a checkpoint already owed stays owed for the next Stop. WHAT IT COSTS: a prompt without the opt-in, the default, parses 28,588 B instead of 47,877 B; a prompt with it parses both chunks, 57,899 B instead of 47,877 B (+10,022 B, +21 %): the loader (`hooks/lazy_concern.ts` and `hooks/bundle_digest.ts`, about 4,000 B) and helpers both chunks carry (`_lib/user_global_paths.ts`, part of `_lib/quota_ledger.ts`, about 1,600 B). The two ceilings add up to 63,600 B; the chunk group `agent-switch-link-opted-in` bounds the two together at 63,500 B."
@@ -343,0 +350,13 @@
+    "chunk_groups": [
+        {
+            "name": "agent-switch-link-opted-in",
+            "entries": [
+                "src/scripts/quota_notice_hook.ts",
+                "src/scripts/switch_link.ts"
+            ],
+            "max_bytes": 63500,
+            "registered_at": "2026-11-10",
+            "derivation": "What a prompt with the switch question on parses: the quota_notice chunk and the switch_link chunk it loads. Measured 57,899 bytes together on 2026-11-10 (28,588 + 29,311), against 47,877 bytes for quota_notice alone when it carried the link (+10,022 B, +21 %): the lazy loader with its digest check (`hooks/lazy_concern.ts`, `hooks/bundle_digest.ts`, about 4,000 B), helpers both chunks carry (about 1,600 B), and the lock and call-surface code the ratification rounds of the split asked for. The ceiling is that reading plus about 10 %, rounded down to the 63,500 B a council seat named as acceptable if the gate enforces it (agents/evidence/council/agent-switch-link-chunk-ratification-r3-20261110.question.md). A prompt without the opt-in parses quota_notice alone, which its own ceiling bounds."
+        }
+    ],
+    "chunk_groups_note": "A chunk group bounds the summed bytes of chunks one caller loads together, so a feature split across chunks cannot grow in total while each part stays under its own ceiling. Each named chunk keeps its own ceiling; a group raise needs a raise_log entry whose `chunk_group` is the group's name, by the chunk rule.",
diff --git a/src/scripts/_lib/switch_link_api.ts b/src/scripts/_lib/switch_link_api.ts
new file mode 100644
index 0000000000..97dbe964f9
--- /dev/null
+++ b/src/scripts/_lib/switch_link_api.ts
@@ -0,0 +1,11 @@
+/**
+ * The version of the call surface between the `switch_link` chunk and the two
+ * bundles that load it (`quota_notice` and the dispatch bundle's Stop path).
+ * Each side compiles its own copy; the chunk answers only a caller whose copy
+ * matches, so a chunk built against another call surface is not called even
+ * when its digest sidecar matches it. This is API compatibility, not build
+ * identity: two builds with the same number are taken as compatible, which
+ * holds only while it is raised whenever the signature or meaning of
+ * `switchTurn` or `checkpointBeforeMove` changes.
+ */
+export const SWITCH_LINK_API = 1;
diff --git a/src/scripts/_lib/switch_relay.ts b/src/scripts/_lib/switch_relay.ts
index 5dc832331b..1d7fa8a1c7 100644
--- a/src/scripts/_lib/switch_relay.ts
+++ b/src/scripts/_lib/switch_relay.ts
@@ -34,0 +35 @@ const BACKOFF_FALLBACK_MS = 5 * HOUR_MS;
+/** Age after which a lock whose holder cannot be identified counts as abandoned. */
@@ -35,0 +37,2 @@ const LOCK_STALE_MS = 2000;
+/** Age after which even a live holder's ticket is removed (see `ticketBreakable`). */
+const LOCK_ABANDONED_MS = 15 * 60_000;
@@ -257,0 +261,12 @@ function pause(ms: number): void {
+/** Whether the process named by a lock token still runs; `null` when the token names none. */
+function holderAlive(token: string): boolean | null {
+    const pid = Number(token.split('.')[0]);
+    if (!Number.isInteger(pid) || pid <= 0) return null;
+    try {
+        process.kill(pid, 0);
+        return true;
+    } catch (e) {
+        return (e as NodeJS.ErrnoException).code === 'EPERM';
+    }
+}
+
@@ -259,5 +274,78 @@ function pause(ms: number): void {
- * Run `fn` holding `<file>.lock`, or return `null` when the lock could not be
- * had. The lock file carries a token of this holder, and only a holder whose
- * token is still in it removes it: a holder older than LOCK_STALE_MS is taken
- * to have died and its lock is broken, and if it was only slow, its release
- * must not delete the lock its successor now holds.
+ * Whether another holder's ticket may be removed. A dead holder's goes at once;
+ * one that names no process after `LOCK_STALE_MS`. A live holder keeps its
+ * ticket for `LOCK_ABANDONED_MS`: a Stop still building its checkpoint would
+ * otherwise publish an older snapshot after its successor's. Past that the
+ * ticket is removed too, because the locked code touches local files only and
+ * a pid still running after fifteen minutes is taken as reused.
+ */
+function ticketBreakable(ticket: string, token: string): boolean {
+    let age: number;
+    try {
+        age = Date.now() - fs.statSync(ticket).mtimeMs;
+    } catch {
+        return false;
+    }
+    const alive = holderAlive(token);
+    if (alive === false) return true;
+    if (alive === null) return age > LOCK_STALE_MS;
+    return age > LOCK_ABANDONED_MS;
+}
+
+/**
+ * Create `<file>.lock` for this holder, dated `LOCK_ABANDONED_MS` ahead. The
+ * version before tickets breaks that file once its mtime is two seconds old,
+ * whoever holds it; dated ahead, it does not look old to that version while
+ * this holder runs. This version judges the file by its holder's pid first.
+ */
+function createLegacyLock(legacy: string, token: string): boolean {
+    try {
+        fs.writeFileSync(legacy, token, { flag: 'wx', mode: 0o600 });
+    } catch {
+        return false;
+    }
+    try {
+        const ahead = new Date(Date.now() + LOCK_ABANDONED_MS);
+        fs.utimesSync(legacy, ahead, ahead);
+    } catch {
+        // still held; only an older hook could then break it after two seconds
+    }
+    return true;
+}
+
+/**
+ * Take `<file>.lock`, the single lock file of the scheme before tickets, as
+ * well. A hook of that version still running across an install or a rollback
+ * creates it exclusively and so waits for this holder, and this holder waits
+ * for it. Only the ticket holder gets here, so a break of this file races an
+ * older hook at most, never another ticket holder.
+ */
+function takeLegacyLock(legacy: string, token: string): boolean {
+    if (createLegacyLock(legacy, token)) return true;
+    let held: string;
+    try {
+        held = fs.readFileSync(legacy, 'utf-8');
+    } catch {
+        return false;
+    }
+    if (!ticketBreakable(legacy, held)) return false;
+    fs.rmSync(legacy, { force: true });
+    return createLegacyLock(legacy, token);
+}
+
+function releaseLegacyLock(legacy: string, token: string): void {
+    try {
+        if (fs.readFileSync(legacy, 'utf-8') === token) fs.rmSync(legacy, { force: true });
+    } catch {
+        // already gone
+    }
+}
+
+/**
+ * Run `fn` holding the lock on `file`, or return `null` when it could not be
+ * had. Each contender creates its own ticket `<file>.lock.<token>`, then lists
+ * the tickets, removes every breakable one, and holds the lock when no other
+ * ticket is left and it could also take the older `<file>.lock`; otherwise it
+ * removes its own ticket and retries after a random pause. A ticket is only
+ * ever removed by its unique name, so breaking an abandoned one can never
+ * remove a successor's, and two contenders cannot both hold: each lists after
+ * creating, so the later lister sees the earlier ticket.
@@ -266 +354,3 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
-    const held = `${file}.lock`;
+    const dir = path.dirname(file);
+    const prefix = `${path.basename(file)}.lock.`;
+    const legacy = `${file}.lock`;
@@ -267,0 +358 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
+    const mine = path.join(dir, prefix + token);
@@ -268,0 +360 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
+        let free = false;
@@ -270,7 +362,8 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
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
+                if (ticketBreakable(other, n.slice(prefix.length))) fs.rmSync(other, { force: true });
+                else others++;
@@ -278,2 +371,3 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
-            pause(LOCK_WAIT_MS);
-            continue;
+            free = others === 0 && takeLegacyLock(legacy, token);
+        } catch {
+            free = false;
@@ -281,3 +375 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
-        try {
-            return { value: fn() };
-        } finally {
+        if (free) {
@@ -285,3 +377,4 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
-                if (fs.readFileSync(held, 'utf-8') === token) fs.rmSync(held, { force: true });
-            } catch {
-                // already gone
+                return { value: fn() };
+            } finally {
+                releaseLegacyLock(legacy, token);
+                fs.rmSync(mine, { force: true });
@@ -289,0 +383,2 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
+        fs.rmSync(mine, { force: true });
+        pause(LOCK_WAIT_MS * (0.5 + Math.random()));
diff --git a/src/scripts/check_hook_bundle_composition.ts b/src/scripts/check_hook_bundle_composition.ts
index fbd521d40f..25543f99f8 100644
--- a/src/scripts/check_hook_bundle_composition.ts
+++ b/src/scripts/check_hook_bundle_composition.ts
@@ -276,0 +277,103 @@ export function chunkRaiseFindings(baseRaw: string | null, workingRaw: string):
+/**
+ * A ceiling over the sum of several chunks: the bytes a caller that loads all
+ * of them parses. Per-chunk ceilings alone let a feature split across chunks
+ * grow in total while each part stays under its own.
+ */
+export interface ChunkGroupBudget {
+    readonly name: string;
+    readonly entries: readonly string[];
+    readonly maxBytes: number;
+}
+
+/** The group ceilings from a budget file's text, from its optional `chunk_groups` list. */
+export function parseChunkGroupBudgets(raw: Record<string, unknown>): ChunkGroupBudget[] {
+    const list = raw['chunk_groups'];
+    if (list === undefined) return [];
+    if (!Array.isArray(list)) throw new Error(`${BUDGET_REL}: chunk_groups must be a list`);
+    const groups = list.map((g, i) => {
+        const name = isRecord(g) ? g['name'] : undefined;
+        const entries = isRecord(g) ? g['entries'] : undefined;
+        const max = isRecord(g) ? g['max_bytes'] : undefined;
+        if (
+            typeof name !== 'string' ||
+            name === '' ||
+            !Array.isArray(entries) ||
+            entries.length < 2 ||
+            !entries.every((e) => typeof e === 'string') ||
+            new Set(entries).size !== entries.length ||
+            typeof max !== 'number' ||
+            !Number.isInteger(max) ||
+            max <= 0
+        ) {
+            throw new Error(
+                `${BUDGET_REL}: chunk_groups[${String(i)}] needs a name, two or more distinct chunk entries and a positive integer max_bytes`,
+            );
+        }
+        return { name, entries: entries as string[], maxBytes: max };
+    });
+    const seen = new Set<string>();
+    for (const g of groups) {
+        if (seen.has(g.name)) throw new Error(`${BUDGET_REL}: chunk_groups lists ${g.name} twice`);
+        seen.add(g.name);
+    }
+    return groups;
+}
+
+export function readChunkGroupBudgets(root: string): ChunkGroupBudget[] {
+    return parseChunkGroupBudgets(JSON.parse(fs.readFileSync(path.join(root, BUDGET_REL), 'utf-8')) as Record<string, unknown>);
+}
+
+/** A group naming a chunk that has no ceiling of its own bounds nothing that is measured. */
+export function chunkGroupCoverageFindings(groups: readonly ChunkGroupBudget[], budgets: readonly ChunkBudget[]): string[] {
+    const budgeted = new Set(budgets.map((b) => b.entry));
+    return groups.flatMap((g) =>
+        g.entries.filter((e) => !budgeted.has(e)).map((e) => `chunk group ${g.name} names ${e}, which has no chunk ceiling in ${BUDGET_REL}`),
+    );
+}
+
+/** Over-ceiling findings for the summed bytes of each group. */
+export function chunkGroupFindings(measured: ReadonlyMap<string, number>, groups: readonly ChunkGroupBudget[]): string[] {
+    const out: string[] = [];
+    for (const g of groups) {
+        const missing = g.entries.filter((e) => !measured.has(e));
+        if (missing.length > 0) {
+            out.push(`chunk group ${g.name} was not measured: ${missing.join(', ')}`);
+            continue;
+        }
+        const bytes = g.entries.reduce((sum, e) => sum + (measured.get(e) ?? 0), 0);
+        if (bytes > g.maxBytes) {
+            out.push(
+                `chunk group ${g.name} is ${String(bytes)} bytes together, ceiling is ${String(g.maxBytes)} ` +
+                    `(over by ${String(bytes - g.maxBytes)}). Shrink a chunk, or raise the group's max_bytes in ${BUDGET_REL} ` +
+                    'WITH a raise_log entry naming the group (`chunk_group`) and what was added.',
+            );
+        }
+    }
+    return out;
+}
+
+/** A group ceiling raised against the base needs a new raise_log entry whose `chunk_group` is the group and whose `to` is the new ceiling. */
+export function chunkGroupRaiseFindings(baseRaw: string | null, workingRaw: string): string[] {
+    if (baseRaw === null) return [];
+    const base = JSON.parse(baseRaw) as Record<string, unknown>;
+    const working = JSON.parse(workingRaw) as Record<string, unknown>;
+    const before = new Map(parseChunkGroupBudgets(base).map((g) => [g.name, g.maxBytes]));
+    const seen = new Set((Array.isArray(base['raise_log']) ? (base['raise_log'] as unknown[]) : []).map((e) => JSON.stringify(e)));
+    const gained = (Array.isArray(working['raise_log']) ? (working['raise_log'] as unknown[]) : []).filter(
+        (e) => !seen.has(JSON.stringify(e)),
+    );
+    const out: string[] = [];
+    for (const g of parseChunkGroupBudgets(working)) {
+        const from = before.get(g.name);
+        if (from === undefined || g.maxBytes <= from) continue;
+        const logged = gained.find((e) => isRecord(e) && e['chunk_group'] === g.name && e['to'] === g.maxBytes);
+        if (logged === undefined) {
+            out.push(`chunk group ${g.name} ceiling raised from ${String(from)} to ${String(g.maxBytes)} with no new raise_log entry for it`);
+        } else {
+            const problems = raiseEntryProblems(logged as Record<string, unknown>, from);
+            if (problems.length > 0) out.push(`the raise_log entry for chunk group ${g.name} is incomplete: ${problems.join('; ')}.`);
+        }
+    }
+    return out;
+}
+
@@ -545,0 +649 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
+    let groups: ChunkGroupBudget[] = [];
@@ -553,0 +658,2 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
+            groups = readChunkGroupBudgets(root);
+            findings.push(...chunkGroupCoverageFindings(groups, budgets), ...chunkGroupFindings(chunkSizes, groups));
@@ -576 +682,5 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
-        findings.push(...raiseFindings(baseBudget, workingBudget), ...chunkRaiseFindings(baseBudget, workingBudget));
+        findings.push(
+            ...raiseFindings(baseBudget, workingBudget),
+            ...chunkRaiseFindings(baseBudget, workingBudget),
+            ...chunkGroupRaiseFindings(baseBudget, workingBudget),
+        );
@@ -593,0 +704,4 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
+        for (const g of groups) {
+            const bytes = g.entries.reduce((sum, e) => sum + (chunkSizes.get(e) ?? 0), 0);
+            process.stdout.write(`✅  chunk group ${g.name}: ${String(bytes)} B / ${String(g.maxBytes)} B\n`);
+        }
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index abc137a56e..105544d0f5 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -90,0 +91,7 @@ export const HOOK_CHUNKS = Object.freeze([
+    // The agent-switch link: loaded by
+    // `quota-notice` only with the switch question on, and by the Stop path only
+    // for a session with a switch record. Reads no YAML.
+    Object.freeze({
+        entry: 'src/scripts/switch_link.ts',
+        outfile: 'dist/hooks/switch_link.chunk.cjs',
+    }),
diff --git a/src/scripts/hooks/bundle_digest.ts b/src/scripts/hooks/bundle_digest.ts
new file mode 100644
index 0000000000..df1ab46ca4
--- /dev/null
+++ b/src/scripts/hooks/bundle_digest.ts
@@ -0,0 +1,62 @@
+/**
+ * The digest check of a built bundle or chunk against its sidecar, apart from
+ * the dispatcher's integrity gate (`bundle_integrity.ts`, which re-exports it).
+ * Split out so a lazily loaded chunk can verify a chunk it loads without
+ * pulling the gate's host tables, and their YAML reader, into its own bytes.
+ */
+import { createHash } from 'node:crypto';
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+/** What a verification produced. */
+export type IntegrityVerdict =
+    | { state: 'ok'; sha: string }
+    | { state: 'mismatch'; expected: string; actual: string }
+    | { state: 'unverifiable'; reason: string };
+
+/** Read the expected digest out of a `shasum -a 256` style sidecar. */
+export function parseSidecar(text: string): string | null {
+    // `<64 hex>  <filename>` — the two-space form `shasum` emits. Tolerant of
+    // any run of whitespace and of a trailing newline, because an operator who
+    // regenerates the file by hand should not be punished for one space.
+    const m = /^([0-9a-f]{64})\s/u.exec(text.trim());
+    return m === null ? null : (m[1] as string);
+}
+
+/** Where the sidecar for a given bundle lives. */
+export function sidecarPathFor(bundlePath: string): string {
+    return bundlePath.replace(/\.js$/u, '') + '.sha256';
+}
+
+/** SHA-256 of a file's bytes, or null when it cannot be read. */
+export function hashFile(p: string): string | null {
+    try {
+        return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
+    } catch {
+        return null;
+    }
+}
+
+/**
+ * Compare a bundle against its sidecar.
+ *
+ * Pure apart from the two reads, so the caller's caching and the verdict logic
+ * can be tested without a dispatch.
+ */
+export function verifyBundle(bundlePath: string): IntegrityVerdict {
+    const sidecar = sidecarPathFor(bundlePath);
+    let expected: string | null;
+    try {
+        expected = parseSidecar(fs.readFileSync(sidecar, 'utf-8'));
+    } catch {
+        return { state: 'unverifiable', reason: `no sidecar at ${path.basename(sidecar)}` };
+    }
+    if (expected === null) {
+        return { state: 'unverifiable', reason: `sidecar at ${path.basename(sidecar)} is malformed` };
+    }
+    const actual = hashFile(bundlePath);
+    if (actual === null) {
+        return { state: 'unverifiable', reason: `bundle at ${path.basename(bundlePath)} is unreadable` };
+    }
+    return actual === expected ? { state: 'ok', sha: actual } : { state: 'mismatch', expected, actual };
+}
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index 8064e1786f..5ea1d42899 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -58 +58 @@ import { fileURLToPath } from 'node:url';
-import { verifyBundle } from './bundle_integrity.js';
+import { verifyBundle } from './bundle_digest.js';
@@ -74,0 +75,2 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
+    // Not a concern: the agent-switch link, loaded by `quota-notice` and the Stop path.
+    'src/scripts/switch_link.ts': lazy('switch_link.chunk.cjs', '../switch_link'),
diff --git a/src/scripts/hooks/session_eol_hook.ts b/src/scripts/hooks/session_eol_hook.ts
index 54e2ba6192..78a55b726a 100644
--- a/src/scripts/hooks/session_eol_hook.ts
+++ b/src/scripts/hooks/session_eol_hook.ts
@@ -80,0 +81 @@ import { hashSessionId, readQuotaLedger } from '../_lib/quota_ledger.js';
+import { SWITCH_LINK_API } from '../_lib/switch_link_api.js';
@@ -82,0 +84 @@ import type { checkpointBeforeMove } from '../_lib/switch_relay.js';
+import type { linkFor } from '../switch_link.js';
@@ -173,2 +175,3 @@ export function payloadSessionId(payload: JsonObject, envelope: JsonObject): str
- * The link half of the checkpoint lives in the `quota_notice` chunk, not in this
- * bundle; it is loaded only for a session that has a switch record at all.
+ * The link half of the checkpoint lives in the `switch_link` chunk, not in this
+ * bundle; it is loaded only for a session that has a switch record at all,
+ * and used only when it was built against the same call surface.
@@ -177 +180 @@ export function loadMoveCheckpoint(): typeof checkpointBeforeMove | null {
-    return loadLazyExport<typeof checkpointBeforeMove>('src/scripts/quota_notice_hook.ts', 'checkpointBeforeMove');
+    return loadLazyExport<typeof linkFor>('src/scripts/switch_link.ts', 'linkFor')?.(SWITCH_LINK_API)?.checkpointBeforeMove ?? null;
diff --git a/tests/scripts/agent_switch_interprocess.test.ts b/tests/scripts/agent_switch_interprocess.test.ts
index 98725e5b64..e387b6350e 100644
--- a/tests/scripts/agent_switch_interprocess.test.ts
+++ b/tests/scripts/agent_switch_interprocess.test.ts
@@ -18,0 +19 @@ import { noticeReply, type QuotaNoticeDeps } from '../../src/scripts/quota_notic
+import { locked as lockedBeforeTickets } from './fixtures/switch_relay_v1_lock.js';
@@ -234,0 +236,3 @@ describe('the lock across an install: the older single lock file', () => {
+            // Older than the two seconds after which that version breaks any lock.
+            const old = new Date(Date.now() - 10_000);
+            fs.utimesSync(legacy(), old, old);
@@ -264,0 +269,17 @@ describe('the lock across an install: the older single lock file', () => {
+    it('a hook of the older version, running its whole acquire loop, does not break a holder of this version past two seconds', async () => {
+        raised();
+        setRequest(APPROVED);
+        const slow = hook({ op: 'stop', holdMs: 3500, label: 'A' });
+        await until(() => writes().includes('A:start'));
+        await new Promise((r) => setTimeout(r, 2300));
+        const older = lockedBeforeTickets(switchRecordPath(hashSessionId(SESSION), stateEnv), () => {
+            fs.appendFileSync(writeLog, 'OLD:entered\n');
+            return true;
+        });
+        expect(await slow).toBe(true);
+        expect(older).toBeNull();
+        expect(writes()).toEqual(['A:start', 'A:written']);
+        // Released: the older version takes it again.
+        expect(lockedBeforeTickets(switchRecordPath(hashSessionId(SESSION), stateEnv), () => true)).toEqual({ value: true });
+    }, 20_000);
+
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
diff --git a/tests/scripts/hook_bundle_raise_log.test.ts b/tests/scripts/hook_bundle_raise_log.test.ts
index 93d5428b96..0249e2da89 100644
--- a/tests/scripts/hook_bundle_raise_log.test.ts
+++ b/tests/scripts/hook_bundle_raise_log.test.ts
@@ -19,0 +20,3 @@ import {
+    chunkGroupCoverageFindings,
+    chunkGroupFindings,
+    chunkGroupRaiseFindings,
@@ -20,0 +24 @@ import {
+    parseChunkGroupBudgets,
@@ -128,0 +133,59 @@ describe('chunk ceilings', () => {
+describe('chunk group ceilings', () => {
+    const A = 'src/scripts/quota_notice_hook.ts';
+    const B = 'src/scripts/switch_link.ts';
+    const grouped = (max: number, log: object[]): string =>
+        JSON.stringify({
+            max_bytes: 1550000,
+            max_yaml_packages: 1,
+            chunks: [
+                { entry: A, max_bytes: 100 },
+                { entry: B, max_bytes: 100 },
+            ],
+            chunk_groups: [{ name: 'link', entries: [A, B], max_bytes: max }],
+            raise_log: log,
+        });
+    const groupEntry = (from: number, to: number): object => ({ ...entry(from, to), chunk_group: 'link' });
+    const group = { name: 'link', entries: [A, B], maxBytes: 150 };
+
+    it('the summed bytes over the group ceiling are a finding, at or under it are not', () => {
+        expect(chunkGroupFindings(new Map([[A, 75], [B, 75]]), [group])).toEqual([]);
+        const over = chunkGroupFindings(new Map([[A, 76], [B, 75]]), [group]);
+        expect(over).toHaveLength(1);
+        expect(over[0]).toContain('151 bytes together');
+    });
+
+    it('a group whose chunks were not all measured is a finding, never a pass', () => {
+        expect(chunkGroupFindings(new Map([[A, 10]]), [group])).toEqual([`chunk group link was not measured: ${B}`]);
+    });
+
+    it('a group naming a chunk without its own ceiling is a finding', () => {
+        expect(chunkGroupCoverageFindings([group], [{ entry: A, maxBytes: 100 }])).toHaveLength(1);
+        expect(chunkGroupCoverageFindings([group], [{ entry: A, maxBytes: 100 }, { entry: B, maxBytes: 100 }])).toEqual([]);
+    });
+
+    it('refuses a malformed group: one entry, a repeated entry, a missing ceiling, a repeated name', () => {
+        const bad = (g: object[]): (() => unknown) => () => parseChunkGroupBudgets({ chunk_groups: g });
+        expect(bad([{ name: 'x', entries: [A], max_bytes: 10 }])).toThrow(/two or more distinct/);
+        expect(bad([{ name: 'x', entries: [A, A], max_bytes: 10 }])).toThrow(/two or more distinct/);
+        expect(bad([{ name: 'x', entries: [A, B] }])).toThrow(/positive integer max_bytes/);
+        expect(bad([group, group].map((g) => ({ name: g.name, entries: g.entries, max_bytes: g.maxBytes })))).toThrow(/twice/);
+    });
+
+    it('a group raise needs a new entry naming the group and the new ceiling; a lowering or a new group does not', () => {
+        expect(chunkGroupRaiseFindings(grouped(150, []), grouped(160, []))).toHaveLength(1);
+        expect(chunkGroupRaiseFindings(grouped(150, []), grouped(160, [entry(150, 160)]))).toHaveLength(1);
+        expect(chunkGroupRaiseFindings(grouped(150, []), grouped(160, [groupEntry(150, 160)]))).toEqual([]);
+        expect(chunkGroupRaiseFindings(grouped(150, []), grouped(140, []))).toEqual([]);
+        expect(chunkGroupRaiseFindings(budget(1550000, []), grouped(150, []))).toEqual([]);
+    });
+
+    it('the shipped budget’s groups name only chunks that carry their own ceiling', () => {
+        const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/config/hook-bundle-budget.json'), 'utf-8')) as Record<string, unknown> & {
+            chunks: Array<{ entry: string; max_bytes: number }>;
+        };
+        const groups = parseChunkGroupBudgets(raw);
+        expect(groups.map((g) => g.name)).toContain('agent-switch-link-opted-in');
+        expect(chunkGroupCoverageFindings(groups, raw.chunks.map((c) => ({ entry: c.entry, maxBytes: c.max_bytes })))).toEqual([]);
+    });
+});
+
````
