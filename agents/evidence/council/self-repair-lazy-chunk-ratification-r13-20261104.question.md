<!-- evidence-type: analysis -->

# Ratification review — the `self-repair` hook concern as a lazy chunk (round 13: derivation clarified)

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file, `src/config/hook-bundle-budget.json`, is on the ratification gate's list as a hook-plumbing source, so the change needs a provider-diverse verdict under ADR-268 § 4.

subject: 96ad8e7b07228ee3832db79d967ba5d8148d20414a5df4b27252b60c92b2a58a

(The digest covers the gated content at commit `0ebacec4d1`.)

## Why another round

Round 12 (`agents/evidence/council/self-repair-lazy-chunk-ratification-r12-20261104.question.md`) reviewed the previous text of the same row. One seat refused it, naming three gaps in the `derivation` text: the roadmap reference read as an unexplained slug, "Class-A telemetry shadow" was undefined, and nothing said where a failure of the concern becomes visible given `fail_closed: false`. This round reviews the text with those three points answered. The roadmap is now named by its path; the shadow is defined (the `emitDefectShadow` call in `src/scripts/self_repair_hook.ts`, a structural-fields-only copy of a queued record, inert unless the org telemetry pack activated telemetry); and the row states that `fail_closed: false` is unchanged by the move and that the dispatcher writes each run's exit code to `agents/runtime/state/.dispatcher/<session>/self-repair.json` (`_write_feedback` in `src/scripts/hooks/dispatch_hook.ts`). `max_bytes` and every other field are unchanged.

## The change, against current `main`

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 05edc6de26..c7f03a2ec7 100644
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
+            "derivation": "Measured 55,991 bytes on 2026-11-04 for the roadmap agents/roadmaps/archive/road-to-a-noted-that-is-a-write.md. The chunk holds the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, and the Class-A telemetry shadow (emitDefectShadow: a structural-fields-only copy of a queued record for the org telemetry pack, inert unless that pack activated telemetry); `yaml` is external, resolved from the installed package as for the chat_history, update_notice and star_ask chunks. The ceiling is that reading plus about 10 %, rounded, the same margin as the quota_notice and intake_pass rows. The margin approves no planned code: a later addition to the chunk is measured and reviewed on its own change. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing or mis-digested chunk falls back to spawning the same script, which is slower; tests/hooks/self_repair_lazy_paths.test.ts pins that the loader path and the spawn fallback write the same record, and that the built dispatcher falls back to the spawn exactly once with the chunk missing. On either path a failure of the concern does not reject the hook event (`fail_closed: false`, unchanged by this move); the dispatcher still writes that run's exit code to agents/runtime/state/.dispatcher/<session>/self-repair.json, which is where a failing concern is visible."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
```

Measured by `check_hook_bundle_composition`: chunk `self_repair_hook.ts` 55,991 B / 61,600 B. The other three files of the move (`concern_registry.ts`, `lazy_concern.ts`, `hook_chunks.mjs`) carry the same rows as in rounds 10 to 12.

## The question

Is this change authority-expanding, and should it land? Findings briefly, then end with exactly one line, in this exact form, as the last line of your answer:

STANCE: <ratified|confirmed-non-expanding|refused|non-convergent> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>
