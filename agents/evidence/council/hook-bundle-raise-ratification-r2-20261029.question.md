<!-- evidence-type: analysis -->

# Ratification review — hook-bundle ceiling raise (branch worktree-inbox-2026-10-bi) — round 2

`check_kernel_edit_ratified` gates one hook-plumbing file in this branch:
`src/config/hook-bundle-budget.json`. The change raises the dispatch bundle's
`max_bytes` from 1,556,670 to 1,557,800 and adds a `raise_log` entry. The growth
comes from `src/scripts/_lib/self_repair.ts` (inlined into the dispatch bundle
via the `self-repair` concern on `user_prompt_submit`): additional recurrence
patterns in the user-report detector and an optional local-only `subject`
field. Measured by `check_hook_bundle_composition`: 1,556,556 B with the base
`self_repair.ts`, 1,557,684 B with this branch's version.

Scope: the diff below is the full change to the gated file plus the source
change that causes the growth. Not included: tests, docs and roadmap files of
the same branch (they do not touch a gated surface).

Questions:
1. Does this change expand any agent's authority, permissions or the reach of a
   safety floor, or is it a size-budget adjustment only?
2. Is the raise_log entry's account of what was added and why it could not be
   avoided accurate against the diff?
3. Does the new `subject` field create a path for user prompt text to leave the
   machine (upstream issue body, fingerprint, release payload)?

Answer each with findings and evidence from the diff, then a verdict:
`ratified`, `confirmed-non-expanding`, or `refused` with reasons.

Round 1 (same day, same seats) returned confirmed-non-expanding with three
conditions: correct the headroom wording, say the subject enables counting
rather than counting, and prove the subject never leaves the machine. The
raise_log entry now carries the first two; for the third, a sabotage probe that
rendered `subject` into the upstream body turned both
`payload-has-only-closed-fields` tests in
`tests/scripts/self_repair_release.test.ts` red (that test seeds
`subject: 'SUBJECT-LINE'` and asserts it is absent from the pull-request body
and the fallback issue body); restored, they pass.

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f93d681efa..933c2294b3 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1556670,
+    "max_bytes": 1557800,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -100,6 +100,14 @@
             "what_was_added": "The owner's 2026-10-22 quota directive on the dispatch path: one LAZY_CONCERNS row shared by `quota-notice` and `metered-spawn-ask` (both bodies live in their own chunk), `permission_gate` emitting a concern's `ask` vote as the host's native ask with its reason, and `_lib/pressure_state` — a ten-line reader of the plan-window verdict the status-line tap leaves behind — used by `delegation-nudge` (no fan-out push into a hot window) and `spawn-guard-shadow` (`plan_window: would_wait`). Measured 1,556,562 B with the change on a base of 1,554,827 B, after ratification rounds 1 and 2 restricted the host ask to `effect: confirmation` concerns, passed that effect from the dispatcher and bounded the reasons. The ceiling, 1,556,670 B, was set at the round-1 reading (1,556,520 B) plus the 150 B of headroom the base had; 108 B remain.",
             "why_it_could_not_be_avoided": "Room was made first and measured: compacting the LAZY_CONCERNS table and dropping `path.join` from its rows freed 202 B, which carried the shared row and the ask passthrough with 16 B to spare. The two dispatch-path consumers could not follow: reading the ledger and the pressure model there cost 4,984 B, so the model moved to the tap (a CLI process, outside this bundle) and the consumers read its verdict file instead. What remains is the verdict reader and two call sites, which no chunk can carry because both concerns are in-bundle.",
             "what_would_have_caught_it": "Nothing earlier: the base sat 150 bytes under the ceiling, so any in-bundle consumer of a new state file would have tripped it."
+        },
+        {
+            "date": "2026-10-29",
+            "from": 1556670,
+            "to": 1557800,
+            "by": "agent, worktree-inbox-2026-10-bi (road-to-a-correction-that-is-heard 1.1, 1.3)",
+            "what_was_added": "The self-repair user-report detector on the dispatch path: one combined recurrence pattern (ordinal + punctuation, `wie oft noch`, `how many times`, `as I mentioned before`, `told you this`, `immer noch nicht`, an addressed `schon wieder`) that makes 8 of the 10 trigger phrases `recurring-criticism` names fire, plus a local-only `subject` capture (`tabs`) that makes counting repeats by subject possible; the counter itself is not built here (later/road-to-a-noted-that-is-a-write 1.2). Measured 1,557,684 B on a base of 1,556,556 B (self_repair.ts at the base, same gate run); the ceiling is that reading plus 116 B, close to the 114 B the base had. The subject never leaves the machine: a sabotage probe that rendered it into the upstream body turned both `payload-has-only-closed-fields` tests in tests/scripts/self_repair_release.test.ts red. AI council 2026-10-29, 2/2: confirmed-non-expanding.",
+            "why_it_could_not_be_avoided": "Room was made first and measured: the six new patterns were merged into one alternation and the narrower `how many times (do|must|should) i` pattern, now subsumed, was removed, which cut the growth from 1,274 B to 1,128 B. The detector runs in the `self-repair` concern on `user_prompt_submit`, which is inlined, not a lazy chunk; moving it into a chunk is a dispatcher change larger than this raise."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/self_repair.ts b/src/scripts/_lib/self_repair.ts
index c3ab1a1d10..2a1943b105 100644
--- a/src/scripts/_lib/self_repair.ts
+++ b/src/scripts/_lib/self_repair.ts
@@ -130,6 +130,12 @@ export interface DefectFinding {
     principle?: string;
     /** One bounded line naming how the defect happens. No producer field yet. Free text, so it never leaves. */
     mechanism?: string;
+    /**
+     * What a user report is about (`tabs`), so repeats phrased differently can be
+     * read side by side. Local-only like `mechanism`: outside the fingerprint and
+     * never rendered upstream.
+     */
+    subject?: string;
     /** One bounded line naming what would refute the claim; a retro's `Candidate.falsifier`. Never leaves. */
     falsifier?: string;
     /**
@@ -267,7 +273,7 @@ export function egressBlockedReason(record: DefectRecord, repoRoot?: string | nu
     // Every free value the record carries, not only the two a report renders
     // today — a field the floor never saw must not become sendable later by a
     // renderer change alone.
-    const text = [record.suggested_surface, record.evidence, record.principle, record.mechanism, record.falsifier]
+    const text = [record.suggested_surface, record.evidence, record.principle, record.mechanism, record.falsifier, record.subject]
         .filter((v): v is string => typeof v === 'string' && v.length > 0)
         .join('\n');
     const result = redact_low_impact_entry(text, {
@@ -507,7 +513,9 @@ const COMPLAINT_PATTERNS: readonly RegExp[] = [
     // carries, and matching only the ASCII one is a dead branch on live input.
     /\bi ?(have|['’]ve)? ?already (told|said)\b/i,
     /\b(told|said) (you )?(this|that|it)? ?(\w+|\d+) times?\b/i,
-    /\bhow many times (do|must|should) i\b/i,
+    // An ordinal restates only when punctuation follows it ("Zum dritten Mal: Tabs!",
+    // not "zum dritten Mal gewonnen"); "schon wieder" needs an addressee nearby.
+    /\b(zum (zweiten|dritten|vierten|fünften) mal|for the (second|third|fourth|fifth) time)\s*[:!,—–-]|\bwie oft noch\b|\bhow many times\b|\bas i (mentioned|said) (before|earlier)\b|\btold you (this|that)\b|\bimmer noch nicht\b|\bschon wieder\b[^.!?]{0,40}\b(du|you|ihr)\b|\b(du|you|ihr)\b[^.!?]{0,40}\bschon wieder\b/i,
 ];
 
 // Phrasings that MATCH a complaint pattern but are not complaints — a curious
@@ -552,11 +560,35 @@ function spanExonerated(prompt: string, start: number, end: number): boolean {
     return false;
 }
 
+export const MAX_SUBJECT = 40;
+
+/**
+ * A backticked token anywhere in the prompt, else the clause after a colon that
+ * closes the matched marker. Undefined when neither names anything.
+ */
+function reportSubject(prompt: string, matchEnd: number): string | undefined {
+    let raw = /`([^`\n]+)`/.exec(prompt)?.[1];
+    if (raw === undefined) {
+        const colon = /^[^.!?\n:]{0,3}:\s*([^.!?\n]+)/.exec(prompt.slice(matchEnd - 1));
+        raw = colon?.[1];
+    }
+    if (raw === undefined) {
+        return undefined;
+    }
+    const subject = sanitizeEvidence(raw)
+        .toLowerCase()
+        .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '')
+        .slice(0, MAX_SUBJECT)
+        .trim();
+    return subject === '' ? undefined : subject;
+}
+
 /** Intake path 1 — the user says the agent worked wrongly. */
 export function detectUserReport(prompt: string): DefectFinding | null {
     for (const re of COMPLAINT_PATTERNS) {
         const m = re.exec(prompt);
         if (m !== null && !spanExonerated(prompt, m.index, m.index + m[0].length)) {
+            const subject = reportSubject(prompt, m.index + m[0].length);
             return {
                 defect_class: 'user-reported',
                 source: 'user-reported',
@@ -564,6 +596,7 @@ export function detectUserReport(prompt: string): DefectFinding | null {
                 suggested_surface:
                     'Analyse the turn the user is objecting to and name the rule, skill, or ' +
                     'gate whose absence allowed it.',
+                ...(subject !== undefined ? { subject } : {}),
             };
         }
     }
@@ -844,6 +877,7 @@ export function mergeRecord(
             ...(target.length > 0 ? { target } : {}),
             ...(proposes.length > 0 ? { proposes } : {}),
             ...(unitKeys.length > 0 ? { unit_keys: unitKeys } : {}),
+            ...(existing.subject ?? finding.subject ? { subject: existing.subject ?? finding.subject } : {}),
             // A detector-opened record that a retro later names keeps the name.
             ...claimFields(existing, finding),
         };
```
