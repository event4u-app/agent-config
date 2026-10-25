<!-- evidence-type: analysis -->

# Ratification review — round 8: the hook-bundle ceiling for the ratified egress change

Branch `feat/inbox-2026-10-al-am` (head `723ca5f6ae`) against `origin/main` (`bead1e828`).
Gated files: `src/scripts/hooks/egress_stage.ts`, `src/config/hook-latency-budget.json`,
`src/config/hook-bundle-budget.json`. Subject digest:
`c39789bf9e046287cef266d2cad7d872b42c3ef43dca264cacdec34083eec6e6`.

## What changed since round 6

Round 6 ratified 2/2 the change to `egress_stage.ts` and the latency row. Since then
`origin/main` was merged into the branch; main's own hook work (a new star-ask
concern) left 55 B of headroom under the 1,554,800 B bundle ceiling, and the
ratified change adds 177 B (1,554,745 B on main alone, 1,554,922 B with it). The
only new gated edit is `src/config/hook-bundle-budget.json`: `max_bytes` 1,554,800 → 1,554,977 (was 1,555,200 in round 7)
with a `raise_log` entry. `egress_stage.ts` and the latency row are
byte-identical to round 6 (`git diff 66aeb91039 HEAD -- src/scripts/hooks/egress_stage.ts`
is empty). Inlining the new function into its only caller was measured: it saves
67 B and stays 55 B over.

## Round 8

Round 7 split: one seat `confirmed-non-expanding`; the other refused because the
first raise (to 1,555,200) left 278 B above the change's own bytes without a
derivation. Since then, commit `723ca5f6ae`: the ceiling is the measured reading
plus exactly the 55 B of headroom `origin/main` had (1,554,922 + 55 = 1,554,977),
and the `raise_log` entry states that derivation.

## Question

Review the diff below. Is any authority expanded, or any enforcing surface made
non-enforcing, by this ceiling raise? Name every defect you find with the line it
sits on.

Answer with exactly one verdict on its own line — `ratified`, `confirmed-non-expanding`
or `refused` — followed by your reasons.

## Diff (`git diff origin/main...HEAD -- src/config/hook-bundle-budget.json`)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index d2b3a30e1c..476a279a7d 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1554800,
+    "max_bytes": 1554977,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -83,6 +83,14 @@
             "what_was_added": "The user's own instruction layer in the subagent-constraints digest: `<config dir>/CLAUDE.md`, the files it imports one level deep, and every rule under `<config dir>/rules/` carried by its Iron Law blocks, with a fixed priority (the first law block of each safety-floor and consequence-class rule first, its later blocks listed as cut, then the project files, the user files and the other rules), a grouped rules inventory, and the shared `_lib/rule_law_section` reader for where a law section ends. Measured 12,194 bytes on the base and 23,843 with the change. The ratification rounds added whole-entry inventories, canonical floor-rule reads, import deduplication by real path, a count-only reservation ahead of the floor laws, and whole-or-nothing placement of each floor rule's first law block with room kept to name any floor rule left out.",
             "why_it_could_not_be_avoided": "The owner kept #2639 open until a skipping worker also receives the user layer, so the code has to ship in this chunk, which is the only carrier on the host's SubagentStart path. Reusing `rule_law_section` instead of a second law-extent parser costs bytes but keeps one definition of a law section across the projector, the lint and this concern. The chunk loads only on claude `subagent_start`; the dispatch bundle is unchanged.",
             "what_would_have_caught_it": "Scoping step 2.4's carrier against the 2026-10-22 probe, which already showed the skip dropping the user rule layer, instead of against the project CLAUDE.md files alone."
+        },
+        {
+            "date": "2026-10-25",
+            "from": 1554800,
+            "to": 1554977,
+            "by": "agent, feat/inbox-2026-10-al-am (road-to-a-cut-the-upgrader-can-take 3.1)",
+            "what_was_added": "`readEgressMode` resolves the egress mode from one read of the settings layers, merged in the cascade's order, instead of reading the layers and then running the full settings cascade, which read them again. Ratified 2/2 in round 6 (agents/evidence/ratifications/inbox-2026-10-al-am-egress.md). Measured with the change: 1,554,922 B; origin/main at bead1e828 alone: 1,554,745 B, so the change adds 177 B against 55 B of headroom that main's own star-ask work left. The new ceiling is that reading plus exactly the 55 B of headroom main had (1,554,922 + 55 = 1,554,977), so the change takes no margin beyond its own bytes.",
+            "why_it_could_not_be_avoided": "Five ratification rounds removed every cheaper design: a block-only reader that parsed less than the whole layer, and a per-layer skip that judged on one read and resolved on another, were both refused, and the read-once-per-path reduction the last refusal asked for is part of these bytes. Inlining the function into its only caller was measured and saves 67 B, still 55 B over, at the cost of a deeper body. The change removes about 16 ms cold and 6.6 ms warm from every hook event on an installed project."
         }
     ],
     "chunks": [
```
