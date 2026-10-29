<!-- evidence-type: analysis -->

# Ratification review — hook-bundle ceiling raise (branch worktree-inbox-2026-10-bi) — round 6, re-based

subject: ddcab29f71eb75ba12140514ab9a90234826c38ecd2e5baba2fea6dc49daefa0

The line above is the `ratification_subject` digest of the gated content at
revision `7f4e05b154` — `src/config/hook-bundle-budget.json`, the only gated
file in the branch.

Round 5 (both seats `confirmed-non-expanding`, subject e084c376…) reviewed the
same change against an older base. Since then `main` landed its own raise
(1,556,670 -> 1,556,764 B for one `intake-pass` LAZY_CONCERNS row, owner answer
OQ-25), so this branch merged `main` and re-applied its raise on top:

- ceiling 1,556,764 -> 1,557,900 B (`raise_log` entry `from` 1,556,764);
- measured with `check_hook_bundle_composition` on the merged tree:
  1,557,828 B; with `main`'s own `self_repair.ts` swapped in: 1,556,650 B — so
  the growth is still +1,178 B, 72 B of headroom remain;
- the `self_repair.ts` change and the raise_log reasoning are those round 5
  confirmed; the entry now also records the 1,274 -> 1,128 -> 1,178 B sequence
  that round 5's anthropic seat asked to be labelled.

Questions: (1) does the change expand any authority, permission or
safety-floor reach? (2) is the re-based raise_log accurate against the diff?
Answer with findings, then end your reply with exactly one line in this form:

`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## Diff of the gated file and the growth source against origin/main

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f12e739699..9fa01fce24 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1556764,
+    "max_bytes": 1557900,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -109,6 +109,14 @@
             "what_was_added": "One `LAZY_CONCERNS` row for `intake-pass`, the owner-chosen OQ-25 concern on `user_prompt_submit` (every host that binds the slot): on a task prompt it injects one line naming the intake pass, and its body ships in its own 9,807-byte chunk. Measured by the gate: 1,556,763 B with the row on a base of 1,556,669 B, so +94 B for the row; the ceiling is that reading plus the 1 B of headroom the base had.",
             "why_it_could_not_be_avoided": "The base sat 1 B under the ceiling, so no concern can be added without either a raise or a removal elsewhere. The concern was built in-bundle first and measured at +2,930 B; moving its body into a lazy chunk cut that to the 94-byte row, which is the smallest form the dispatcher can reach a new concern in. Making room by compacting another module would change code this decision does not own.",
             "what_would_have_caught_it": "Nothing earlier: the owner chose a shipped, default-on concern on 2026-10-28, and any shipped concern costs at least its LAZY_CONCERNS row."
+        },
+        {
+            "date": "2026-10-29",
+            "from": 1556764,
+            "to": 1557900,
+            "by": "agent, worktree-inbox-2026-10-bi (road-to-a-correction-that-is-heard 1.1, 1.3)",
+            "what_was_added": "The self-repair user-report detector on the dispatch path: one combined recurrence pattern (ordinal + punctuation, `wie oft noch ich`, `how many times do I`, `as I mentioned before`, `told you this`, `immer noch nicht`, an addressed `schon wieder`) under which 6 of the 10 trigger phrases `recurring-criticism` names fire and the other 4 are allowlisted with a reason (each needs a contextual constraint), plus a `subject` capture kept out of the tested outgoing paths (`tabs`) that makes counting repeats by subject possible; the counter itself is not built here (later/road-to-a-noted-that-is-a-write 1.2). Measured 1,557,828 B on a base of 1,556,650 B (origin/main 965c4db02 with its own self_repair.ts, same gate run): +1,178 B; the ceiling leaves 72 B. Where the subject goes was probed, not asserted: rendering it into the upstream body turned both `payload-has-only-closed-fields` tests (tests/scripts/self_repair_release.test.ts, which check the whole outgoing release payload and the fallback issue body) red, and feeding it into `fingerprint()` turned `is not part of the fingerprint` (tests/scripts/self_repair.test.ts) red; both passed once restored.",
+            "why_it_could_not_be_avoided": "Room was made first and measured: the new patterns were merged into one alternation and the narrower `how many times (do|must|should) i` pattern, now subsumed, was removed (growth 1,274 B -> 1,128 B); the first-person precision fix the council asked for then added 50 B, for 1,178 B final. The detector runs in the `self-repair` concern on `user_prompt_submit`, which is inlined, not a lazy chunk; moving it into a chunk is a dispatcher change larger than this raise. The subject ships now because road-to-a-correction-that-is-heard AC-2 requires the record to name what a repeated correction was about. Re-based onto the 2026-10-28 intake-pass raise; ratified by AI council 2026-10-29 (agents/evidence/ratifications/hook-bundle-raise-20261029.md)."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/self_repair.ts b/src/scripts/_lib/self_repair.ts
index c3ab1a1d10..3c610c3064 100644
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
+    /\b(zum (zweiten|dritten|vierten|fünften) mal|for the (second|third|fourth|fifth) time)\s*[:!,—–-]|\bwie oft (noch|muss|soll) ich\b|\bhow many times (do|must|should|have|will) (i|we)\b|\bas i (mentioned|said) (before|earlier)\b|\btold you (this|that)\b|\bimmer noch nicht\b|\bschon wieder\b[^.!?]{0,40}\b(du|you|ihr)\b|\b(du|you|ihr)\b[^.!?]{0,40}\bschon wieder\b/i,
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
