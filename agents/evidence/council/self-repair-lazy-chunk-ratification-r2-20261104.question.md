<!-- evidence-type: analysis -->

# Ratification review — moving the `self-repair` hook concern into a lazy chunk — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list as a hook-plumbing source, so the change needs a provider-diverse verdict under ADR-268 § 4: an agent may change such a file but may not ratify its own change.

subject: 7546d4896c636b714d3a30b481ad3d587c3522b12a1c2983f678285ecce3f785

(The digest covers the gated file at commit `3503b4bfa5`, computed with `./scripts-run src/scripts/ratification_subject`.)

## The change under review

The `self-repair` hook concern (bound on `user_prompt_submit` and `stop`, `fail_closed: false`) is removed from the statically inlined dispatch bundle and built as a lazy chunk instead: its registry row moves from `concern_registry.ts` to `LAZY_CONCERNS` in `lazy_concern.ts`, `hook_chunks.mjs` gains its chunk entry (`yaml` external), and `hook-bundle-budget.json` gains one chunk ceiling of 64,000 B over a measured 58,114 B. `max_bytes` (the dispatch ceiling) is unchanged. Measured by `check_hook_bundle_composition`: dispatch bundle 1,581,986 B before (ceiling 1,582,000 B) and 1,557,293 B after. When a lazy chunk is missing or fails its digest, the dispatcher spawns the concern's script instead.

The full diff of that change was reviewed in round 1 (prompt committed as `agents/evidence/council/self-repair-lazy-chunk-ratification-20261104.question.md`).

## Round 1 and what changed since

Round 1: both seats answered `confirmed-non-expanding`, confidence medium, no dealbreaker. Their findings on the gated file:

- The derivation's sentence "a missing chunk falls back to the spawn path and costs latency, never a record" claims more than the generic fallback tests establish.
- The derivation did not say where the external `yaml` resolves from.
- The 10 % margin was stated as arithmetic without saying whether growth is expected.
- One seat read the opening parenthetical as garbled.

Commit `3503b4bfa5` changes only the `derivation` string of the new chunk row. No code, no number. The diff:

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 21a000c878..1e71349c24 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -260,7 +260,7 @@
             "entry": "src/scripts/self_repair_hook.ts",
             "max_bytes": 64000,
             "registered_at": "2026-11-04",
-            "derivation": "Measured 58,114 bytes on 2026-11-04 (road-to-a-noted-that-is-a-write: the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, the read-only host-memory reader and the Class-A telemetry shadow), `yaml` external. The ceiling is that reading plus about 10 %, rounded. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing chunk falls back to the spawn path and costs latency, never a record."
+            "derivation": "Measured 58,114 bytes on 2026-11-04 for road-to-a-noted-that-is-a-write. The chunk holds the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, the read-only host-memory reader and the Class-A telemetry shadow; `yaml` is external, resolved from the installed package as for the chat_history, update_notice and star_ask chunks. The ceiling is that reading plus about 10 %, rounded, the same margin as the quota_notice and intake_pass rows; no further growth is queued. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing or mis-digested chunk falls back to spawning the same script, which is slower; the generic fallback tests cover the routing, not a concern-specific equivalence of the records, and the concern never blocks either way (`fail_closed: false`)."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
```

Not changed, with reason: no concern-specific fallback-equivalence test was added — the derivation now states that the generic tests cover routing only, rather than adding a test outside this roadmap's scope.

## The question

Does the change as it now stands land, and is it authority-expanding? Give your findings, then end with exactly one line in this form, choosing the verdict from `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`:

STANCE: <verdict> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>
