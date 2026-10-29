<!-- evidence-type: analysis -->

# Ratification review — hook-bundle ceiling raise (branch worktree-inbox-2026-10-bi) — round 5

subject: e084c3763db8f932d37891ca5d2e43e38ad0ce0fa2702a47ab299b6a83a6a2a6

The line above is the `ratification_subject` digest of the gated content at
revision `7476c9da8e` — `src/config/hook-bundle-budget.json`, the only gated
file in the branch. This round reviews that final content.

Round 3 (both seats `confirmed-non-expanding`, scoped to the tested paths)
asked for two raise_log wording fixes and flagged, as non-blocking, that the
broadened patterns fire on ordinary questions. Since round 3:

- `how many times` and `wie oft noch` now fire only with a first person after
  them (`how many times (do|must|should|have|will) (i|we)`,
  `wie oft (noch|muss|soll) ich`). Probed before the fix: "how many times does
  it retry?" and "wie oft noch soll die Schleife laufen?" both fired; both are
  now `must-not-fire` rows in `tests/fixtures/self-repair-detector-corpus.yml`
  and stay silent. The two trigger phrases are allowlisted in the drift test
  with that reason, so 6 of the rule's 10 trigger phrases fire bare and 4 are
  allowlisted. Detector tests: 162/162 pass.
- The raise_log now reports the re-measured bundle (1,557,734 B against the
  1,557,800 B ceiling, 66 B left), scopes the subject claim to the tested
  outgoing paths, and records round 3's actual outcome.

Round 4 (same content, same digest) returned `confirmed-non-expanding` from
both seats but without the machine-readable stance line the record needs, and
one seat noted that the raise_log's "cut the growth from 1,274 B to 1,128 B"
is an intermediate reading: the final growth is 1,178 B (1,557,734 − 1,556,556)
after the precision fix added 50 B. That gap is recorded in the ratification
artifact's body rather than by editing the gated file again.

Questions: (1) does the final change expand any authority, permission or
safety-floor reach? (2) is the raise_log accurate against the diff? (3) are
round 3's conditions met? Answer with findings, then end your reply with exactly one line in this form:

`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## Delta since round 3

```diff
diff --git a/src/scripts/_lib/self_repair.ts b/src/scripts/_lib/self_repair.ts
index 2a1943b105..3c610c3064 100644
--- a/src/scripts/_lib/self_repair.ts
+++ b/src/scripts/_lib/self_repair.ts
@@ -515,7 +515,7 @@ const COMPLAINT_PATTERNS: readonly RegExp[] = [
     /\b(told|said) (you )?(this|that|it)? ?(\w+|\d+) times?\b/i,
     // An ordinal restates only when punctuation follows it ("Zum dritten Mal: Tabs!",
     // not "zum dritten Mal gewonnen"); "schon wieder" needs an addressee nearby.
-    /\b(zum (zweiten|dritten|vierten|fünften) mal|for the (second|third|fourth|fifth) time)\s*[:!,—–-]|\bwie oft noch\b|\bhow many times\b|\bas i (mentioned|said) (before|earlier)\b|\btold you (this|that)\b|\bimmer noch nicht\b|\bschon wieder\b[^.!?]{0,40}\b(du|you|ihr)\b|\b(du|you|ihr)\b[^.!?]{0,40}\bschon wieder\b/i,
+    /\b(zum (zweiten|dritten|vierten|fünften) mal|for the (second|third|fourth|fifth) time)\s*[:!,—–-]|\bwie oft (noch|muss|soll) ich\b|\bhow many times (do|must|should|have|will) (i|we)\b|\bas i (mentioned|said) (before|earlier)\b|\btold you (this|that)\b|\bimmer noch nicht\b|\bschon wieder\b[^.!?]{0,40}\b(du|you|ihr)\b|\b(du|you|ihr)\b[^.!?]{0,40}\bschon wieder\b/i,
 ];
 
 // Phrasings that MATCH a complaint pattern but are not complaints — a curious
diff --git a/tests/fixtures/self-repair-detector-corpus.yml b/tests/fixtures/self-repair-detector-corpus.yml
index e028e05601..1b427d6e6f 100644
--- a/tests/fixtures/self-repair-detector-corpus.yml
+++ b/tests/fixtures/self-repair-detector-corpus.yml
@@ -64,6 +64,10 @@ detectors:
         note: an ordinal with no punctuation after it is a count, not a recurrence marker
       - text: "schon wieder Montag"
         note: a bare repetition word with nobody addressed
+      - text: "how many times does it retry?"
+        note: an ordinary question; fired on the first broadened pattern (council round 3, 2026-10-29)
+      - text: "wie oft noch soll die Schleife laufen?"
+        note: an ordinary question; fired on the first broadened pattern (council round 3, 2026-10-29)
 
   council-availability-claim:
     fire:
diff --git a/tests/scripts/recurring_criticism_trigger_drift.test.ts b/tests/scripts/recurring_criticism_trigger_drift.test.ts
index 588eedd639..679d00a1c2 100644
--- a/tests/scripts/recurring_criticism_trigger_drift.test.ts
+++ b/tests/scripts/recurring_criticism_trigger_drift.test.ts
@@ -16,6 +16,10 @@ const RULE = path.join(process.cwd(), 'src', 'rules', 'recurring-criticism.md');
 const ALLOWLIST: Record<string, string> = {
     'schon mehrfach':
         'a bare count fires on ordinary prose ("schon mehrfach erfolgreich gelaufen"); the detector requires a saying-verb next to it',
+    'wie oft noch':
+        'an ordinary question ("wie oft noch soll die Schleife laufen?") uses it too; the detector requires "ich" after it',
+    'how many times':
+        'an ordinary question ("how many times does it retry?") uses it too; the detector requires "I/we" after the verb',
     'schon wieder':
         'a bare repetition word ("schon wieder Montag") is not a complaint; the detector requires a second-person clause nearby',
 };
```

## Full diff of the gated file and the growth source against origin/main

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f93d681efa..edd96d4ad0 100644
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
+            "what_was_added": "The self-repair user-report detector on the dispatch path: one combined recurrence pattern (ordinal + punctuation, `wie oft noch ich`, `how many times do I`, `as I mentioned before`, `told you this`, `immer noch nicht`, an addressed `schon wieder`) under which 6 of the 10 trigger phrases `recurring-criticism` names fire and the other 4 are allowlisted with a reason (each is an ordinary word without an addressee), plus a `subject` capture kept out of the tested outgoing paths (`tabs`) that makes counting repeats by subject possible; the counter itself is not built here (later/road-to-a-noted-that-is-a-write 1.2). Measured 1,557,734 B on a base of 1,556,556 B (self_repair.ts at the base, same gate run); the ceiling leaves 66 B. Where the subject goes was probed, not asserted: rendering it into the upstream body turned both `payload-has-only-closed-fields` tests (tests/scripts/self_repair_release.test.ts, which check the whole outgoing release payload and the fallback issue body) red, and feeding it into `fingerprint()` turned `is not part of the fingerprint` (tests/scripts/self_repair.test.ts) red; both passed once restored. AI council 2026-10-29: round 1 confirmed-non-expanding with conditions, round 2 split on the evidence, round 3 confirmed-non-expanding 2/2 scoped to these tested paths; its precision finding (an ordinary \"how many times does it retry?\" fired) was fixed by requiring a first person and pinned as must-not-fire corpus rows.",
+            "why_it_could_not_be_avoided": "Room was made first and measured: the six new patterns were merged into one alternation and the narrower `how many times (do|must|should) i` pattern, now subsumed, was removed, which cut the growth from 1,274 B to 1,128 B. The detector runs in the `self-repair` concern on `user_prompt_submit`, which is inlined, not a lazy chunk; moving it into a chunk is a dispatcher change larger than this raise. The subject ships now because road-to-a-correction-that-is-heard AC-2 requires the record to name what a repeated correction was about; without it differently worded repeats cannot be told apart."
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
