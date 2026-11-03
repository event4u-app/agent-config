<!-- evidence-type: analysis -->

# Ratification review, round 2 — hook-bundle ceiling raise (branch docs/game-roadmap-owner-answers)

subject: 13060c2caf0f86c1be790c840166be1055fd1b734dc26da42fb8a5f527256f15

The line above is the `ratification_subject` digest of the gated content at
revision `51df0bb0ce` — `src/config/hook-bundle-budget.json`, the only gated
file in the branch.

Round 1 (prompt `hook-bundle-raise-trunk-repair-20261103.question.md`): one
seat ratified; the other asked that `why_it_could_not_be_avoided` be stated as
a scope decision and that the causal claims be qualified and backed by the
CI and merge records. The `raise_log` entry was rewritten; the records are:

- #2817 merged 2026-11-03T10:22:55Z; Consistency on main at `e4dc5cfa2a`:
  success (run 41618804083).
- #2816 merged 2026-11-03T11:11:07Z; Consistency on main at `1ac7eebe04`:
  failure (run 41625436602), log line: `bundle is 1581318 bytes, ceiling is
  1581000 (over by 318)`.
- The same gate on this branch: `hook bundle: 1581318 B / 1581900 B ceiling`.

Questions: (1) does the change expand any authority, permission or
safety-floor reach? (2) is the raise_log entry accurate against the diff and
the records above?
Answer with findings, then end your reply with exactly one line in this form:

`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## Diff of the gated file against origin/main

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 2fce0c228f..cdceb07b0d 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1581000,
+    "max_bytes": 1581900,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -172,6 +172,15 @@
             "what_was_added": "Measured per module against origin/main with the esbuild metafile, +2,192 B: hooks/memory_recall_hook.ts 777 B (reads the host's autoMemoryDirectory before the slug walk, so recall finds a relocated memory store), hooks/skill_route_hook.ts 762 B (unions the installer's own name-only listing record into the known-bare set on claude), handoff_context_hook.ts 393 B (annotates branch and commit drift between a handoff header and the checkout), _lib/skill_listing_record.ts 167 B (a leaf so the hook does not import the whole overrides module), 93 B of small edits. The gate measured 1,580,385 B; main builds to 1,578,148 B. The 45 B between the module sum and the bundle delta is esbuild's per-module wrapper.",
             "why_it_could_not_be_avoided": "Room was looked for first: the memory hook already reads the settings file inline instead of importing the settings reader (that import alone had pushed the bundle over earlier), and the listing record is a leaf module for the same reason. The branch fitted under the ceiling until main grew to 452 B of headroom. The alternative, deferring one of the three features, was put to the council and rejected by both seats.",
             "what_would_have_caught_it": "Nothing earlier: the growth is the features, and main's growth consumed the headroom between this branch's two measurements. Sized to the measurement plus about 600 bytes of rebuild jitter."
+        },
+        {
+            "date": "2026-11-03",
+            "from": 1581000,
+            "to": 1581900,
+            "by": "agent, docs/game-roadmap-owner-answers (trunk repair; this branch changes no bundled source)",
+            "what_was_added": "Nothing on this branch. The trunk at 1ac7eebe04 measures 1,581,318 B with a real npm ci install, 318 over the 1,581,000 ceiling. Recorded facts: the Consistency workflow passed on main at e4dc5cfa2a (run 41618804083, after #2817's raise merged at 10:22:55Z) and failed this gate at 1ac7eebe04 (run 41625436602, after #2816 feat/web-launch-write-time merged at 11:11:07Z) with the same 1,581,318 B. So the overage entered with #2816's merge. 318 B is the overage, not the measured size of #2816's addition; this branch did not measure #2816's own delta, and #2816 carried no raise_log entry.",
+            "why_it_could_not_be_avoided": "A scope decision, not a demonstration that shrinking is impractical: the bytes are already on the trunk, a ceiling below the trunk's own reading fails every branch cut from it, and shrinking #2816's addition would be a feature change on code this branch did not write. Whether #2816's addition can be shrunk is left open.",
+            "what_would_have_caught_it": "A check against the merge result rather than the branch head before merging. Whether #2816's head ran against a base that already carried #2817 is not established here. Sized to the trunk measurement plus about 580 bytes of rebuild jitter."
         }
     ],
     "chunks": [
```
