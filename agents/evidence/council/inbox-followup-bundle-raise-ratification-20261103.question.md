<!-- evidence-type: original-review -->

# Ratification prompt — hook-bundle ceiling raise on feat/inbox-2026-11-t-followup (verbatim, as sent 2026-11-03)

~~~text
Ratification review of one change touching src/config/hook-bundle-budget.json, a file on this repository's ratification watched set.

subject: 6e0773f50e944cf980c6775053ee91466f906b83e5e1ffc0e387864a42a04ffc

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Measurements, taken by the gate (check_hook_bundle_composition) with the same node_modules:
- e4dc5cfa2a (merge of #2817, which raised the ceiling to 1,581,000): 1,580,385 B.
- 1ac7eebe04 (merge of #2816 on top): 1,581,318 B — origin/main fails this gate today.
- This branch: 1,581,318 B; its own diff touches no bundled source.

Questions:
1. Does any hunk expand authority, lower a floor, make an enforcing surface non-enforcing, or stop a gate?
2. Is the raise correct and justified as recorded, or should it not land?

Answer with one verdict from the closed set, the reason, and any finding.

Full diff of the gated file against origin/main:
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 2fce0c228f..7f975ad30b 100644
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
+            "by": "agent, feat/inbox-2026-11-t-followup (follow-up to #2819), on the trunk's behalf",
+            "what_was_added": "Nothing in this branch. #2816 (web-launch write-time carrier) merged after #2817 had raised the ceiling to 1,581,000: hooks/web_launch_rows.ts and hooks/web_launch_rows_loader.ts, plus the design-pass hook and web_launch_third_party edits, add +933 B. The gate measured 1,580,385 B at e4dc5cfa2a (merge of #2817) and 1,581,318 B at 1ac7eebe04 (merge of #2816), so main itself is 318 B over and every open PR inherits the red.",
+            "why_it_could_not_be_avoided": "The bytes are merged capability on the trunk, the same shape as the first raise_log entry: each PR was green on its own pre-merge tree and the two together are not. Shrinking means moving a merged feature into a chunk on a branch that does not own it; reverting it to fit a number derived before it landed would discard working code.",
+            "what_would_have_caught_it": "Measuring on the merge result (merge queue) rather than on each PR's tree, as the first entry already says. Sized to the measurement plus about 580 bytes of rebuild jitter, the doctrine of the previous entry."
         }
     ],
     "chunks": [
~~~
