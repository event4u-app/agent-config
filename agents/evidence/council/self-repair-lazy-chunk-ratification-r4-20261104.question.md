<!-- evidence-type: analysis -->

# Ratification review — moving the `self-repair` hook concern into a lazy chunk — round 4

Output contract, read first: your answer MUST end with exactly one line `STANCE: <verdict> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>`, verdict one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`. The verdict is read mechanically from that line; an answer without it is recorded as no verdict.

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list as a hook-plumbing source, so the change needs a provider-diverse verdict under ADR-268 § 4: an agent may change such a file but may not ratify its own change.

subject: 5a7474292f0a2bdbc97e677ee0fdbd58e43013a2c27d8333a70765697a92038f

(The digest covers the gated file at commit `eb3ca4ffa2`, computed with `./scripts-run src/scripts/ratification_subject`; the gated file is unchanged since round 3.)

## What round 3 asked for

Round 3: one seat `confirmed-non-expanding` (high). The other asked for the exact cumulative diff, and for regression coverage showing self-repair runs through both the lazy loader and the spawn fallback. Both follow.

## The cumulative diff against `origin/main` (the four files of the move)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index de35900651..1d2a0ba2da 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -255,6 +255,12 @@
             "max_bytes": 14000,
             "registered_at": "2026-11-02",
             "derivation": "Measured 13,287 bytes on 2026-11-02: rows 2.1 and 2.2, already in the hook Finding shape, of check_web_launch_readiness (third-party load on first paint, superseded statute on a legal page), the 12-row provider register and the one-row supersession table. Loaded by design_pass_hook only for an .html/.css write. The ceiling is the next thousand above that reading; the 713-byte (5.4 %) margin is what that rounding leaves, not a growth estimate. A register row serialises to 150-223 bytes (mean 181), so the margin admits about three more rows before the chunk must be re-measured and this row re-derived."
+        },
+        {
+            "entry": "src/scripts/self_repair_hook.ts",
+            "max_bytes": 64000,
+            "registered_at": "2026-11-04",
+            "derivation": "Measured 58,114 bytes on 2026-11-04 for road-to-a-noted-that-is-a-write. The chunk holds the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, the read-only host-memory reader and the Class-A telemetry shadow; `yaml` is external, resolved from the installed package as for the chat_history, update_notice and star_ask chunks. The ceiling is that reading plus about 10 %, rounded, the same margin as the quota_notice and intake_pass rows; no further growth is queued. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing or mis-digested chunk falls back to spawning the same script, which is slower; the generic fallback tests cover the routing, not a concern-specific equivalence of the records, and on either path a failure of the concern does not reject the hook event (`fail_closed: false`)."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 30a67229c1..43680dfa55 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -93,6 +93,14 @@ export const HOOK_CHUNKS = Object.freeze([
         entry: 'src/scripts/hooks/web_launch_rows.ts',
         outfile: 'dist/hooks/web_launch_rows.chunk.cjs',
     }),
+    // `self-repair` on `user_prompt_submit` and `stop`; the detectors, the
+    // record store and the Class-A shadow stay off every other dispatch's
+    // parse. `yaml` external: the telemetry shadow reads the settings layers.
+    Object.freeze({
+        entry: 'src/scripts/self_repair_hook.ts',
+        outfile: 'dist/hooks/self_repair.chunk.cjs',
+        external: Object.freeze(['yaml']),
+    }),
 ]);
 
 /**
diff --git a/src/scripts/hooks/concern_registry.ts b/src/scripts/hooks/concern_registry.ts
index c9a06f7fa2..cec48c5575 100644
--- a/src/scripts/hooks/concern_registry.ts
+++ b/src/scripts/hooks/concern_registry.ts
@@ -44,7 +44,6 @@ import { main as pushSettleMain } from './push_settle_hook.js';
 import { main as sessionCanaryMain } from '../session_canary_hook.js';
 import { main as councilAvailabilityMain } from '../council_availability_hook.js';
 import { main as telemetryDisclosureMain } from '../telemetry_disclosure_hook.js';
-import { main as selfRepairMain } from '../self_repair_hook.js';
 import { main as sessionRegisterMain } from '../session_register_hook.js';
 import { main as languageMirrorMain } from '../language_mirror_hook.js';
 import { main as gitAuthorizationMain } from '../git_authorization_hook.js';
@@ -114,7 +113,6 @@ export const CONCERN_REGISTRY: Readonly<Record<string, ConcernMain>> = {
     'src/scripts/session_canary_hook.ts': sessionCanaryMain as ConcernMain,
     'src/scripts/council_availability_hook.ts': councilAvailabilityMain as ConcernMain,
     'src/scripts/telemetry_disclosure_hook.ts': telemetryDisclosureMain as ConcernMain,
-    'src/scripts/self_repair_hook.ts': selfRepairMain as ConcernMain,
     'src/scripts/session_register_hook.ts': sessionRegisterMain as ConcernMain,
     'src/scripts/language_mirror_hook.ts': languageMirrorMain as ConcernMain,
     'src/scripts/git_authorization_hook.ts': gitAuthorizationMain as ConcernMain,
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index 3d87ff7d0c..6389440949 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -74,6 +74,7 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
     'src/scripts/quota_notice_hook.ts': lazy('quota_notice.chunk.cjs', '../quota_notice_hook'),
     'src/scripts/hooks/layer_promotion_hook.ts': lazy('layer_promotion.chunk.cjs', 'layer_promotion_hook'),
     'src/scripts/hooks/intake_pass_hook.ts': lazy('intake_pass.chunk.cjs', 'intake_pass_hook'),
+    'src/scripts/self_repair_hook.ts': lazy('self_repair.chunk.cjs', '../self_repair_hook'),
 });
 
 declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
```

## The new test, `tests/hooks/self_repair_lazy_paths.test.ts` (commit `eb3ca4ffa2`)

1. Asserts `src/scripts/self_repair_hook.ts` is in `LAZY_CONCERNS` and not in `CONCERN_REGISTRY`.
2. Resolves the concern with `resolveConcernMain` (the dispatcher's own resolver), feeds a `user_prompt_submit` payload carrying a user complaint through the in-process stdin override, and runs it against a temp workspace. Then spawns the same script as its own process (`node --import tsx src/scripts/self_repair_hook.ts`), which is what the dispatcher's fallback runs, with the same payload against a second temp workspace. It asserts exit 0 on both, the queue line on the spawned stdout, exactly one record in each store, the two records equal apart from their timestamps, and the derived subject index written. Both pass.

What the test does not cover: a built-and-digested chunk loaded from `dist/hooks/`, which needs a full `build:hooks`; the generic `tests/scripts/hooks/lazy_concern.test.ts` covers loading a built chunk when one is present, and `tests/hooks/lazy_concern_fallback.test.ts` covers the missing, malformed, incompatible, throwing and undigested chunk cases for the loader.

## The question

Does the change as it now stands land, and is it authority-expanding? Give your findings briefly, then the STANCE line.
