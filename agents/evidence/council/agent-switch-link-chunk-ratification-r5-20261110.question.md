<!-- evidence-type: analysis -->

# Ratification review — the agent-switch link as its own lazy chunk — round 5

You are an independent reviewer for a change in the `event4u/agent-config` repository. Three files in it are hook plumbing on the ratification gate's list (`src/config/hook-bundle-budget.json`, `src/scripts/hooks/bundle_digest.ts`, `src/scripts/hooks/bundle_integrity.ts`), so the change needs a two-provider verdict under ADR-268 § 4: an agent may change hook plumbing but may not ratify its own change.

subject: a466a15741a0bfe2d1a55eb6f2b5cb5dd0ce5b6403411809b69c30be7ed98d56

(The digest covers the gated files at commit `3346576fa8`, computed with `./scripts-run src/scripts/ratification_subject`. The branch merged `main` at `fb889ed919` since round 4; diffs below are against that merge base.)

## What the change does

- Background: the previous change raised the `quota_notice` lazy chunk ceiling from 41,000 to 49,400 bytes to carry the agent-switch link (an opt-in prompt-hook feature, `AGENT_CONFIG_SWITCH_QUESTION=1`, that asks agent-switch to move a session off an account near its plan limit). Two providers refused that raise; the owner merged it with the refusal on record and asked to bring the chunk back under 41,000 bytes or ratify the raise.
- The split: the link's prompt half (`switchTurn`) and Stop half (`checkpointBeforeMove`) move out of `quota_notice_hook.ts` into `src/scripts/switch_link.ts`, built as `switch_link.chunk.cjs`. `quota_notice` loads it only when the switch question is on; the Stop path (in the dispatch bundle) only for a session with a switch record. Both load it through `hooks/lazy_load.ts` (`loadChunkExport`), which, when bundled, refuses a chunk whose `.sha256` sidecar is missing, malformed or does not match. The chunk exports only `linkFor(api)`, which hands out the two functions to a caller compiled with the same `SWITCH_LINK_API` (in `_lib/switch_record_path.ts`; API compatibility, not build identity). A chunk that does not load or answers `null` means no switch question and no checkpoint, as without agent-switch; an owed checkpoint stays owed for the next Stop.
- The digest check (`IntegrityVerdict`, `parseSidecar`, `sidecarPathFor`, `hashFile`, `verifyBundle`) moves verbatim from `bundle_integrity.ts` into `bundle_digest.ts` (now with named `node:` imports), so a chunk that verifies another does not pull the YAML reader in; `bundle_integrity.ts` imports and re-exports them, so its own exit-code decisions are unchanged. `lazy_concern.ts` (the table of lazy concerns) delegates to `lazy_load.ts`; it no longer carries a row for the link, which was never a concern.
- Budget and gate:
  - `quota_notice` ceiling LOWERED from 49,400 to 29,900 B (measured 27,162 B, below the original 41,000 target).
  - New `switch_link` ceiling 32,200 B (measured 29,329 B).
  - New in the gate (`check_hook_bundle_composition.ts`): `chunk_groups`, a ceiling over the summed bytes of chunks one caller loads together. The gate sums and fails over it; a group naming a chunk without its own ceiling, or not fully measured, is a finding; raising a group, removing it, renaming it or dropping a member needs a new `raise_log` entry naming the group. Group `agent-switch-link-opted-in` = 62,100 B (measured 56,491 B). Round 3 and 4 openai seats named 63,500 B acceptable if enforced; this is below it.
  - Dispatch ceiling unchanged at 1,594,900 B (`main`'s); measured 1,594,895 B after merging `main`.
  - The gate now parses its flags with `parseGateArgs` and exits 2 on an unknown one.
  - What a prompt parses: without the opt-in (the default) 27,162 B instead of 47,877 B; with it 56,491 B instead of 47,877 B (+8,614 B, +18 %: the chunk loader and digest check about 2,600 B, helpers both chunks carry about 1,600 B, the lock and call-surface code).
- **Explicitly put to this review:** the opted-in allowance of 62,100 B, enforced as a group, against the 49,400 B single ceiling the previous change asked for.
- Not gated, same change — the record lock in `_lib/switch_relay.ts`. Before: one `<record>.lock`, broken after two seconds by age alone, so a slow Stop lost its lock to a second Stop. Now:
  - Per-holder tickets `<record>.lock.<pid>.<time>.<random>` (exclusive create); a contender lists the directory, removes every breakable ticket (the scan visits all), and holds only when no other ticket is left; a ticket is only ever removed by its own unique name. Breakable: pid ended (at once), no pid (2 s), older than 15 min (taken as a reused pid; a holder genuinely still writing then loses exclusion, stated in the contract). Collisions back off with a random pause; up to 50 tries, then the update is skipped.
  - The holder also takes the previous version's `<record>.lock` by exclusive create and dates it 15 minutes ahead (`utimes`); if dating fails it releases it and counts as not held. The previous version acquires only by exclusive create of that file and breaks it once its mtime is 2 s old, so while a newer holder runs, the older version's create fails and its age check never fires. The newer version judges an older holder's file by its pid.
  - **Residual, stated rather than claimed away:** the previous version's own break is a stat followed by an unlink by name (`d2475e82f8`, kept verbatim in a test fixture). Two hooks of that version, or one of each, can interleave check and unlink; no code in this change can make the older version's unlink conditional. The window exists only while a hook process of the previous version is still running across an install or a rollback, and only when a lock file is being broken (its holder dead or, for the older version, 2 s old). Rollback criterion 8 watches for it.
- Tests (real `node` processes started at one instant where concurrency matters): a Stop held 3.5 s keeps its lock against a second Stop at 2.3 s; three Stops breaking a dead holder's lock write once; a live ticket beside a dead one survives the break; every breakable ticket among six goes whatever the listing order; 10-second-old live ticket kept, 16-minute-old one broken; an older-version holder's lock file (live pid, 10 s old) keeps this version out untouched; while this version holds, the older version's exclusive create fails; the older version's whole acquire loop, run 2.3 s into a newer holder's 3.5 s write, does not enter and takes the lock after release; an undatable lock file is released and not held; one relay line across two prompts; one back-off across three failing prompts; one checkpoint across two Stops; the built chunks load each other beside each other only with matching sidecars and matching call surface; a Stop that cannot load the link leaves the checkpoint owed; the gate's group findings, coverage, malformed groups, raise and removal rules. Mutations that each fail tests: breakable check removed; holding without listing; scan stopped at the first live ticket; older lock file not taken; not dated ahead; undated file kept; digest check removed from the loader; version ignored in `linkFor`; group ceiling below the measured sum.
- Rollback criteria (`agents/evidence/metrics/agent-switch-link-latency-20261108.md`): link stalls beyond the bound; >500 ms p95 with agent-switch answering; an owed checkpoint never written or an older snapshot over a newer one; a line shown twice; a skipped update seen as either; an unkeepable back-off; a chunk or the group outgrowing its ceiling without a reviewed raise; either of those around an install or rollback (the two lock versions together); with the opt-in on and agent-switch answering, no question on a hot window or a checkpoint owed across Stops (the link chunk not loading). The opt-in switches off both halves (tested).
- Revert: `git revert` of the branch's commits after `d2475e82f8` other than the merge of `main`, or the PR's merge commit once merged. The lock, the split, the group gate and the loader move are separate commits.

## Since round 4

Round 4 returned `refused` from both seats (subject `b62a8fa9…`). Its findings and what changed:

- A stale check followed by an unlink by name races, between versions and within the older one (both seats, dealbreaker). Partly addressed: this version's unlinks are all by unique ticket name, and its break of the older file happens only as a ticket holder (no other newer contender can be in that path). The older version's own check-then-unlink cannot be changed by this change; that residual is stated above with its bounds instead of a claim of full exclusion.
- `utimes` failure left an undated lock held (openai). Fixed and tested.
- A group could be weakened by removal, rename or a dropped member (both seats). Fixed and tested.
- The group ceiling and the sum of chunk ceilings disagreed by 100 B (anthropic). They are now equal at 62,100 B after the loader move.
- Two further defects surfaced in this repository's own CI replay and are fixed: `quota_notice` reached every lazy concern through the table's specifiers (now it names only the link chunk), and the gate accepted unknown flags.
- Ship the lock separately (both seats). Not changed; the commits stay separable.

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

`git diff -U0 fb889ed919..3346576fa8` (no context lines, for size) for the budget, `bundle_digest.ts`, `lazy_load.ts`, `lazy_concern.ts`, the Stop hook, `switch_record_path.ts` and the lock; the gate only as changed since round 4 (`git diff -U0 2f703925ce..3346576fa8`; its round 4 diff is in the round 4 prompt). Tests changed since round 4 in full. Left out, summarised above and shown in earlier prompts: `bundle_integrity.ts` (a move), `quota_notice_hook.ts` and `switch_link.ts` (only the loader call and comments changed since round 3), the interprocess tests and driver, the contract and evidence edits, the roadmap.

````diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 89a0df04b4..d801be866c 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -333 +333 @@
-            "max_bytes": 49400,
+            "max_bytes": 29900,
@@ -335 +335,7 @@
-            "derivation": "Measured 20,703 bytes on 2026-10-25 (road-to-a-quota-the-user-sees-coming 3.2-4.3: the quota and metered notices, the metered spawn ask with its per-call pending marker and read-path expiry from ratification rounds 1-5, the quota ledger reader, the pressure model, the billing-class reader and the billing-grant check), no `yaml` (it reads JSON only). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Two manifest concerns share the script (`quota-notice` on claude `user_prompt_submit`, `metered-spawn-ask` on claude `pre_tool_use` for Agent/Task), so the bundle carries one LAZY_CONCERNS row for both; the row fits inside the room the compacted LAZY_CONCERNS table freed, so the dispatch ceiling is not raised. A missing chunk falls back to the spawn path and costs latency, never a notice."
+            "derivation": "Measured 20,703 bytes on 2026-10-25 (road-to-a-quota-the-user-sees-coming 3.2-4.3: the quota and metered notices, the metered spawn ask with its per-call pending marker and read-path expiry from ratification rounds 1-5, the quota ledger reader, the pressure model, the billing-class reader and the billing-grant check), no `yaml` (it reads JSON only). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Two manifest concerns share the script (`quota-notice` on claude `user_prompt_submit`, `metered-spawn-ask` on claude `pre_tool_use` for Agent/Task), so the bundle carries one LAZY_CONCERNS row for both; the row fits inside the room the compacted LAZY_CONCERNS table freed, so the dispatch ceiling is not raised. A missing chunk falls back to the spawn path and costs latency, never a notice. LOWERED to 29,900 on 2026-11-10 (road-to-a-link-with-agent-switch 8.4): the agent-switch link moved into its own chunk, src/scripts/switch_link.ts, which this one loads only while the switch question is on, through `hooks/lazy_load.ts` rather than the lazy-concern table; measured 27,162 bytes after the move against 47,877 before it, and the ceiling is that reading plus about 10 %, rounded."
+        },
+        {
+            "entry": "src/scripts/switch_link.ts",
+            "max_bytes": 32200,
+            "registered_at": "2026-11-10",
+            "derivation": "Measured 29,329 bytes on 2026-11-10 (road-to-a-link-with-agent-switch 8.4). The chunk holds the agent-switch link: the prompt's switch turn (raise, relay, back-off) and the Stop path's checkpoint, with the record and its lock (`_lib/switch_relay.ts`, 15,398 B), the link's spawn (`_lib/agent_switch_link.ts`, `_lib/spawn_env.ts`) and the atomic writer. No `yaml`. The ceiling is that reading plus about 10 %, rounded, the margin of the quota_notice and self_repair rows. WHY IT IS A CHUNK: in the quota_notice chunk the link took that chunk to 47,877 B against a 41,000 B ceiling a ratification never accepted raising (Phase 7, rounds 1-6 refused); the switch question is opt-in (D5), so a prompt without it should not parse the link at all. `quota-notice` loads `switchTurn` from here only when the question is on, and the Stop path loads `checkpointBeforeMove` only for a session with a switch record. A missing or mis-digested chunk means no switch question and no checkpoint before a move, the same as running without agent-switch; a checkpoint already owed stays owed for the next Stop. WHAT IT COSTS: a prompt without the opt-in, the default, parses 27,162 B instead of 47,877 B; a prompt with it parses both chunks, 56,491 B instead of 47,877 B (+8,614 B, +18 %): the loader (`hooks/lazy_load.ts` and `hooks/bundle_digest.ts`, about 2,600 B), helpers both chunks carry (`_lib/user_global_paths.ts`, part of `_lib/quota_ledger.ts`, about 1,600 B), and the lock and call-surface code. The two ceilings add up to 62,100 B, the chunk group `agent-switch-link-opted-in` bounds the two together at the same figure."
@@ -368,0 +375,13 @@
+    "chunk_groups": [
+        {
+            "name": "agent-switch-link-opted-in",
+            "entries": [
+                "src/scripts/quota_notice_hook.ts",
+                "src/scripts/switch_link.ts"
+            ],
+            "max_bytes": 62100,
+            "registered_at": "2026-11-10",
+            "derivation": "What a prompt with the switch question on parses: the quota_notice chunk and the switch_link chunk it loads. Measured 56,491 bytes together on 2026-11-10 (27,162 + 29,329), against 47,877 bytes for quota_notice alone when it carried the link (+8,614 B, +18 %): the chunk loader with its digest check (`hooks/lazy_load.ts`, `hooks/bundle_digest.ts`, about 2,600 B), helpers both chunks carry (about 1,600 B), and the lock and call-surface code the ratification rounds of the split asked for. The ceiling is that reading plus about 10 %, rounded, below the 63,500 B a council seat named as acceptable if the gate enforces it (agents/evidence/council/agent-switch-link-chunk-ratification-r3-20261110.question.md). A prompt without the opt-in parses quota_notice alone, which its own ceiling bounds."
+        }
+    ],
+    "chunk_groups_note": "A chunk group bounds the summed bytes of chunks one caller loads together, so a feature split across chunks cannot grow in total while each part stays under its own ceiling. Each named chunk keeps its own ceiling; a group raise needs a raise_log entry whose `chunk_group` is the group's name, by the chunk rule.",
diff --git a/src/scripts/_lib/switch_record_path.ts b/src/scripts/_lib/switch_record_path.ts
index 406f7dfed3..87460aa782 100644
--- a/src/scripts/_lib/switch_record_path.ts
+++ b/src/scripts/_lib/switch_record_path.ts
@@ -6,0 +7,12 @@ import type { EnvMap } from './user_global_paths.js';
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
+
@@ -10 +22 @@ import type { EnvMap } from './user_global_paths.js';
- * loads the link from the `quota_notice` chunk.
+ * loads the link from the `switch_link` chunk.
diff --git a/src/scripts/_lib/switch_relay.ts b/src/scripts/_lib/switch_relay.ts
index 5dc832331b..193f5beab3 100644
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
@@ -259,5 +274,80 @@ function pause(ms: number): void {
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
+        return true;
+    } catch {
+        // Undated, an older hook would break it after two seconds: give it back.
+        releaseLegacyLock(legacy, token);
+        return false;
+    }
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
@@ -266 +356,3 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
-    const held = `${file}.lock`;
+    const dir = path.dirname(file);
+    const prefix = `${path.basename(file)}.lock.`;
+    const legacy = `${file}.lock`;
@@ -267,0 +360 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
+    const mine = path.join(dir, prefix + token);
@@ -268,0 +362 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
+        let free = false;
@@ -270,7 +364,8 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
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
@@ -278,2 +373,3 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
-            pause(LOCK_WAIT_MS);
-            continue;
+            free = others === 0 && takeLegacyLock(legacy, token);
+        } catch {
+            free = false;
@@ -281,3 +377 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
-        try {
-            return { value: fn() };
-        } finally {
+        if (free) {
@@ -285,3 +379,4 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
-                if (fs.readFileSync(held, 'utf-8') === token) fs.rmSync(held, { force: true });
-            } catch {
-                // already gone
+                return { value: fn() };
+            } finally {
+                releaseLegacyLock(legacy, token);
+                fs.rmSync(mine, { force: true });
@@ -289,0 +385,2 @@ function locked<T>(file: string, fn: () => T): { value: T } | null {
+        fs.rmSync(mine, { force: true });
+        pause(LOCK_WAIT_MS * (0.5 + Math.random()));
diff --git a/src/scripts/hooks/bundle_digest.ts b/src/scripts/hooks/bundle_digest.ts
new file mode 100644
index 0000000000..c21cda8859
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
+import { readFileSync } from 'node:fs';
+import { basename } from 'node:path';
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
+        return createHash('sha256').update(readFileSync(p)).digest('hex');
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
+        expected = parseSidecar(readFileSync(sidecar, 'utf-8'));
+    } catch {
+        return { state: 'unverifiable', reason: `no sidecar at ${basename(sidecar)}` };
+    }
+    if (expected === null) {
+        return { state: 'unverifiable', reason: `sidecar at ${basename(sidecar)} is malformed` };
+    }
+    const actual = hashFile(bundlePath);
+    if (actual === null) {
+        return { state: 'unverifiable', reason: `bundle at ${basename(bundlePath)} is unreadable` };
+    }
+    return actual === expected ? { state: 'ok', sha: actual } : { state: 'mismatch', expected, actual };
+}
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index 8064e1786f..c8a65d131e 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -53,6 +52,0 @@
-import * as fs from 'node:fs';
-import { createRequire } from 'node:module';
-import * as path from 'node:path';
-import { fileURLToPath } from 'node:url';
-
-import { verifyBundle } from './bundle_integrity.js';
@@ -59,0 +54 @@ import type { ConcernMain } from './concern_registry_types.js';
+import { chunkSpecifier, isBundled, loadChunkExport } from './lazy_load.js';
@@ -81,6 +75,0 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
-declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
-
-function isBundled(): boolean {
-    return typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
-}
-
@@ -90,22 +79 @@ export function lazyConcernSpecifier(script: string, selfUrl: string, bundled: b
-    if (entry === undefined) return null;
-    const selfPath = fileURLToPath(selfUrl);
-    const dir = path.dirname(selfPath);
-    if (bundled) return path.join(dir, entry.chunk);
-    const ext = selfPath.endsWith('.ts') ? '.ts' : '.js';
-    return path.join(dir, `${entry.source}${ext}`);
-}
-
-/**
- * From the source tree the concern is TypeScript whose imports name `.js`
- * siblings, which a plain `require` cannot resolve outside a `tsx` process.
- * `tsx`'s own require resolves them; the specifier is computed so esbuild never
- * pulls `tsx` into the bundle, where this branch is not taken.
- */
-function sourceRequire(req: NodeJS.Require): (id: string, from: string) => unknown {
-    try {
-        const api = req(['tsx', 'cjs', 'api'].join('/')) as { require?: (id: string, from: string) => unknown };
-        if (typeof api.require === 'function') return api.require;
-    } catch {
-        // tsx absent: a plain require is the only reader left.
-    }
-    return (id: string) => req(id);
+    return entry === undefined ? null : chunkSpecifier(entry.chunk, entry.source, selfUrl, bundled);
@@ -135,15 +103,2 @@ export function loadLazyExport<T>(
-    try {
-        const specifier = lazyConcernSpecifier(script, selfUrl, bundled);
-        if (specifier === null || !fs.existsSync(specifier)) return null;
-        // No sidecar, a malformed one or a mismatch: the chunk is not the one built.
-        if (bundled && verifyBundle(specifier).state !== 'ok') return null;
-        const req = createRequire(selfUrl);
-        const mod = (bundled ? req(specifier) : sourceRequire(req)(specifier, fileURLToPath(selfUrl))) as Record<
-            string,
-            unknown
-        >;
-        const fn = mod[name];
-        return typeof fn === 'function' ? (fn as T) : null;
-    } catch {
-        return null;
-    }
+    const entry = LAZY_CONCERNS[script];
+    return entry === undefined ? null : loadChunkExport<T>(entry.chunk, entry.source, name, selfUrl, bundled);
diff --git a/src/scripts/hooks/lazy_load.ts b/src/scripts/hooks/lazy_load.ts
new file mode 100644
index 0000000000..2e36609ded
--- /dev/null
+++ b/src/scripts/hooks/lazy_load.ts
@@ -0,0 +1,66 @@
+/**
+ * Loading one export of a chunk beside the running bundle, without the table of
+ * lazy concerns (`lazy_concern.ts`). Its own module so a chunk that loads
+ * another chunk (the agent-switch link from `quota_notice`) names only the
+ * chunk it loads, not every module the table points at.
+ *
+ * WHY `require` AND A COMPUTED SPECIFIER — as in `svg_rules_loader.ts`: the
+ * callers run synchronously, and a literal specifier would be inlined by
+ * esbuild, which is the cost a chunk exists to avoid.
+ */
+import * as fs from 'node:fs';
+import { createRequire } from 'node:module';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { verifyBundle } from './bundle_digest.js';
+
+declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
+
+export function isBundled(): boolean {
+    return typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
+}
+
+/**
+ * From the source tree the module is TypeScript whose imports name `.js`
+ * siblings, which a plain `require` cannot resolve outside a `tsx` process.
+ * `tsx`'s own require resolves them; the specifier is computed so esbuild never
+ * pulls `tsx` into the bundle, where this branch is not taken.
+ */
+function sourceRequire(req: NodeJS.Require): (id: string, from: string) => unknown {
+    try {
+        const api = req(['tsx', 'cjs', 'api'].join('/')) as { require?: (id: string, from: string) => unknown };
+        if (typeof api.require === 'function') return api.require;
+    } catch {
+        // tsx absent: a plain require is the only reader left.
+    }
+    return (id: string) => req(id);
+}
+
+/** Where a chunk loads from: `chunk` beside `selfUrl` when bundled, the `source` module relative to it otherwise. */
+export function chunkSpecifier(chunk: string, source: string, selfUrl: string, bundled: boolean): string {
+    const selfPath = fileURLToPath(selfUrl);
+    const dir = path.dirname(selfPath);
+    if (bundled) return path.join(dir, chunk);
+    return path.join(dir, `${source}${selfPath.endsWith('.ts') ? '.ts' : '.js'}`);
+}
+
+/**
+ * The function `name` the chunk exports, or `null` when the chunk is absent,
+ * does not match its digest sidecar (bundled only), fails to load or exports
+ * no such function. Every failure is a value.
+ */
+export function loadChunkExport<T>(chunk: string, source: string, name: string, selfUrl: string, bundled: boolean = isBundled()): T | null {
+    try {
+        const specifier = chunkSpecifier(chunk, source, selfUrl, bundled);
+        if (!fs.existsSync(specifier)) return null;
+        // No sidecar, a malformed one or a mismatch: the chunk is not the one built.
+        if (bundled && verifyBundle(specifier).state !== 'ok') return null;
+        const req = createRequire(selfUrl);
+        const mod = (bundled ? req(specifier) : sourceRequire(req)(specifier, fileURLToPath(selfUrl))) as Record<string, unknown>;
+        const fn = mod[name];
+        return typeof fn === 'function' ? (fn as T) : null;
+    } catch {
+        return null;
+    }
+}
diff --git a/src/scripts/hooks/session_eol_hook.ts b/src/scripts/hooks/session_eol_hook.ts
index 54e2ba6192..b6d603b70b 100644
--- a/src/scripts/hooks/session_eol_hook.ts
+++ b/src/scripts/hooks/session_eol_hook.ts
@@ -81 +81 @@ import { hashSessionId, readQuotaLedger } from '../_lib/quota_ledger.js';
-import { switchRecordPath } from '../_lib/switch_record_path.js';
+import { SWITCH_LINK_API, switchRecordPath } from '../_lib/switch_record_path.js';
@@ -82,0 +83 @@ import type { checkpointBeforeMove } from '../_lib/switch_relay.js';
+import type { linkFor } from '../switch_link.js';
@@ -84 +85 @@ import type { EnvMap } from '../_lib/user_global_paths.js';
-import { loadLazyExport } from './lazy_concern.js';
+import { loadChunkExport } from './lazy_load.js';
@@ -173,2 +174,3 @@ export function payloadSessionId(payload: JsonObject, envelope: JsonObject): str
- * The link half of the checkpoint lives in the `quota_notice` chunk, not in this
- * bundle; it is loaded only for a session that has a switch record at all.
+ * The link half of the checkpoint lives in the `switch_link` chunk, not in this
+ * bundle; it is loaded only for a session that has a switch record at all,
+ * and used only when it was built against the same call surface.
@@ -176,2 +178,2 @@ export function payloadSessionId(payload: JsonObject, envelope: JsonObject): str
-export function loadMoveCheckpoint(): typeof checkpointBeforeMove | null {
-    return loadLazyExport<typeof checkpointBeforeMove>('src/scripts/quota_notice_hook.ts', 'checkpointBeforeMove');
+export function loadMoveCheckpoint(): typeof checkpointBeforeMove | undefined {
+    return loadChunkExport<typeof linkFor>('switch_link.chunk.cjs', '../switch_link', 'linkFor', import.meta.url)?.(SWITCH_LINK_API)?.checkpointBeforeMove;
@@ -184 +186 @@ export function moveCheckpoint(
-    load: () => typeof checkpointBeforeMove | null = loadMoveCheckpoint,
+    load: () => typeof checkpointBeforeMove | null | undefined = loadMoveCheckpoint,
diff --git a/src/scripts/check_hook_bundle_composition.ts b/src/scripts/check_hook_bundle_composition.ts
index 25543f99f8..7f4ace5818 100644
--- a/src/scripts/check_hook_bundle_composition.ts
+++ b/src/scripts/check_hook_bundle_composition.ts
@@ -71,0 +72 @@ import { buildScript } from './check_hook_bundle_content.js';
+import { parseGateArgs, USAGE_EXIT } from './_lib/gate_args.js';
@@ -365,0 +367,14 @@ export function chunkGroupRaiseFindings(baseRaw: string | null, workingRaw: stri
+    const after = new Map(parseChunkGroupBudgets(working).map((g) => [g.name, g.entries]));
+    // Dropping a group, or a chunk from one, narrows what the sum covers: that needs a recorded reason too.
+    for (const g of parseChunkGroupBudgets(base)) {
+        const now = after.get(g.name);
+        const dropped = now === undefined ? g.entries : g.entries.filter((e) => !now.includes(e));
+        if (dropped.length === 0) continue;
+        if (!gained.some((e) => isRecord(e) && e['chunk_group'] === g.name)) {
+            out.push(
+                now === undefined
+                    ? `chunk group ${g.name} was removed with no new raise_log entry for it`
+                    : `chunk group ${g.name} dropped ${dropped.join(', ')} with no new raise_log entry for it`,
+            );
+        }
+    }
@@ -617 +632,10 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
-    if (argv.includes('--self-test')) {
+    const parsed = parseGateArgs('check_hook_bundle_composition', argv, {
+        'self-test': { type: 'boolean' },
+        metafile: { type: 'string' },
+        'base-ref': { type: 'string' },
+    });
+    if (!parsed.ok) {
+        process.stderr.write(`${parsed.message}\n`);
+        return USAGE_EXIT;
+    }
+    if (parsed.values['self-test'] === true) {
@@ -620,2 +644 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
-    const at = argv.indexOf('--metafile');
-    const fixture = at >= 0 ? argv[at + 1] : undefined;
+    const fixture = parsed.values.metafile;
@@ -665,2 +688 @@ export function main(argv: readonly string[] = process.argv.slice(2), root: stri
-    const baseAt = argv.indexOf('--base-ref');
-    const baseBudget = readBaseBudget(root, baseAt >= 0 ? argv[baseAt + 1] : undefined);
+    const baseBudget = readBaseBudget(root, parsed.values['base-ref']);
diff --git a/tests/scripts/agent_switch_ask.test.ts b/tests/scripts/agent_switch_ask.test.ts
index 81c4f2ad11..05bdc91cff 100644
--- a/tests/scripts/agent_switch_ask.test.ts
+++ b/tests/scripts/agent_switch_ask.test.ts
@@ -31,2 +31,2 @@ import { sidecarPathFor } from '../../src/scripts/hooks/bundle_digest.js';
-import { loadLazyExport } from '../../src/scripts/hooks/lazy_concern.js';
-import { SWITCH_LINK_API } from '../../src/scripts/_lib/switch_link_api.js';
+import { loadChunkExport } from '../../src/scripts/hooks/lazy_load.js';
+import { SWITCH_LINK_API } from '../../src/scripts/_lib/switch_record_path.js';
@@ -1003 +1003 @@ describe('8.4 the link in its own chunk', () => {
-            loadLazyExport<typeof linkFor>('src/scripts/switch_link.ts', 'linkFor', self, true)?.(SWITCH_LINK_API)?.checkpointBeforeMove;
+            loadChunkExport<typeof linkFor>('switch_link.chunk.cjs', '../switch_link', 'linkFor', self, true)?.(SWITCH_LINK_API)?.checkpointBeforeMove;
@@ -1030 +1030 @@ describe('8.4 the link in its own chunk', () => {
-        const linkForOther = loadLazyExport<typeof linkFor>('src/scripts/switch_link.ts', 'linkFor', self, true);
+        const linkForOther = loadChunkExport<typeof linkFor>('switch_link.chunk.cjs', '../switch_link', 'linkFor', self, true);
diff --git a/tests/scripts/hook_bundle_raise_log.test.ts b/tests/scripts/hook_bundle_raise_log.test.ts
index 0249e2da89..c886a2e849 100644
--- a/tests/scripts/hook_bundle_raise_log.test.ts
+++ b/tests/scripts/hook_bundle_raise_log.test.ts
@@ -181,0 +182,13 @@ describe('chunk group ceilings', () => {
+    it('removing a group, or a chunk from one, needs a new entry naming the group', () => {
+        const without = JSON.stringify({ max_bytes: 1550000, max_yaml_packages: 1, chunks: [], raise_log: [] });
+        expect(chunkGroupRaiseFindings(grouped(150, []), without)).toEqual(['chunk group link was removed with no new raise_log entry for it']);
+        const C = 'src/scripts/_lib/egress_engine.ts';
+        const three = (log: object[]): string =>
+            JSON.stringify({ max_bytes: 1550000, max_yaml_packages: 1, chunk_groups: [{ name: 'link', entries: [A, B, C], max_bytes: 150 }], raise_log: log });
+        expect(chunkGroupRaiseFindings(three([]), grouped(150, []))).toEqual([`chunk group link dropped ${C} with no new raise_log entry for it`]);
+        expect(chunkGroupRaiseFindings(three([]), grouped(150, [groupEntry(150, 150)]))).toEqual([]);
+        // A renamed group is the old one removed.
+        const renamed = JSON.stringify({ max_bytes: 1550000, max_yaml_packages: 1, chunk_groups: [{ name: 'other', entries: [A, B], max_bytes: 150 }], raise_log: [] });
+        expect(chunkGroupRaiseFindings(grouped(150, []), renamed)).toHaveLength(1);
+    });
+
diff --git a/tests/scripts/switch_relay_lock_undated.test.ts b/tests/scripts/switch_relay_lock_undated.test.ts
new file mode 100644
index 0000000000..0c389316f2
--- /dev/null
+++ b/tests/scripts/switch_relay_lock_undated.test.ts
@@ -0,0 +1,51 @@
+/**
+ * A holder that cannot date the older single lock file ahead gives it back:
+ * undated, a hook of the version before tickets would break it after two
+ * seconds. Its own file, because it replaces `utimesSync` for the module.
+ */
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, expect, it, vi } from 'vitest';
+
+vi.mock('node:fs', async (importOriginal) => {
+    const real = await importOriginal<typeof fs>();
+    return {
+        ...real,
+        utimesSync: (p: fs.PathLike, a: fs.TimeLike, m: fs.TimeLike): void => {
+            if (String(p).endsWith('.json.lock')) throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
+            real.utimesSync(p, a, m);
+        },
+    };
+});
+
+const { updateSwitchRecord } = await import('../../src/scripts/_lib/switch_relay.js');
+const { switchRecordPath } = await import('../../src/scripts/_lib/switch_record_path.js');
+
+let home: string;
+beforeEach(() => {
+    home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-undated-'));
+});
+afterEach(() => {
+    fs.rmSync(home, { recursive: true, force: true });
+});
+
+it('a lock whose older file cannot be dated ahead is not held, and leaves no file behind', () => {
+    const stateEnv = { EVENT4U_CONFIG_HOME: home };
+    let entered = false;
+    expect(
+        updateSwitchRecord(
+            'a'.repeat(16),
+            (cur) => {
+                entered = true;
+                return cur;
+            },
+            stateEnv,
+        ),
+    ).toBe(false);
+    expect(entered).toBe(false);
+    const file = switchRecordPath('a'.repeat(16), stateEnv);
+    expect(fs.existsSync(`${file}.lock`)).toBe(false);
+    expect(fs.readdirSync(path.dirname(file)).filter((n) => n.includes('.lock'))).toEqual([]);
+});
````
