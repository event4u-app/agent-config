<!-- evidence-type: analysis -->

# Ratification review — the `self-repair` hook concern as a lazy chunk (round 11: rebased onto current main)

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file, `src/config/hook-bundle-budget.json`, is on the ratification gate's list as a hook-plumbing source, so the change needs a provider-diverse verdict under ADR-268 § 4.

subject: 527a413533947174f39f2ea9d4eeef0e9a7c78aa1bc50e378a5dfdc7d1d77ffc

(The digest covers the gated file at commit `57a328f599`, the branch after merging the current `main`.)

## Why another round

Round 10 (`agents/evidence/council/self-repair-lazy-chunk-ratification-r10-20261104.question.md`, subject `16159a21…`) was answered `confirmed-non-expanding` by both seats. The branch has since merged `main`, which changed other rows of the same file (`max_bytes` raised there by another change to 1,585,000 B). The gate digests the whole file, so the merged content needs its own verdict. The diff below is against the current `main`, so it shows only this branch's contribution, which is the row reviewed in round 10, unchanged.

## The change, against current `main`

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 05edc6de26..c3fb755d33 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -270,6 +270,12 @@
             "max_bytes": 14000,
             "registered_at": "2026-11-02",
             "derivation": "Measured 13,287 bytes on 2026-11-02: rows 2.1 and 2.2, already in the hook Finding shape, of check_web_launch_readiness (third-party load on first paint, superseded statute on a legal page), the 12-row provider register and the one-row supersession table. Loaded by design_pass_hook only for an .html/.css write. The ceiling is the next thousand above that reading; the 713-byte (5.4 %) margin is what that rounding leaves, not a growth estimate. A register row serialises to 150-223 bytes (mean 181), so the margin admits about three more rows before the chunk must be re-measured and this row re-derived."
+        },
+        {
+            "entry": "src/scripts/self_repair_hook.ts",
+            "max_bytes": 61600,
+            "registered_at": "2026-11-04",
+            "derivation": "Measured 55,991 bytes on 2026-11-04 for road-to-a-noted-that-is-a-write. The chunk holds the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, and the Class-A telemetry shadow; `yaml` is external, resolved from the installed package as for the chat_history, update_notice and star_ask chunks. The ceiling is that reading plus about 10 %, rounded, the same margin as the quota_notice and intake_pass rows. Queued growth: the host-memory reader of road-to-a-noted-that-is-a-write-carried (about 2.3 KB as first built), which fits inside it. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing or mis-digested chunk falls back to spawning the same script, which is slower; the generic fallback tests cover the routing, not a concern-specific equivalence of the records, and on either path a failure of the concern does not reject the hook event (`fail_closed: false`)."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
```

Measured on the merged tree by `check_hook_bundle_composition`: dispatch bundle 1,559,769 B / 1,585,000 B; chunk `self_repair_hook.ts` 55,991 B / 61,600 B. The other three files of the move (`concern_registry.ts`, `lazy_concern.ts`, `hook_chunks.mjs`) carry the same rows as in round 10.

## The question

Is this change authority-expanding, and should it land? Findings briefly, then end with exactly one line:

STANCE: <ratified|confirmed-non-expanding|refused|non-convergent> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>
