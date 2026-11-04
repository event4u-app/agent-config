<!-- evidence-type: analysis -->

# Ratification review — moving the `self-repair` hook concern into a lazy chunk

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list as a hook-plumbing source, so the change needs a provider-diverse verdict under ADR-268 § 4: an agent may change such a file but may not ratify its own change.

subject: 3ae98743646d9665ddfc48bb36574a1ecdc8d395bc83a39b28954d91b803d000

(The digest covers the gated file at commit `586a1d4e68`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Context

Every hook concern registered in `concern_registry.ts` is statically imported and inlined into one bundle, `dist/hooks/dispatch.js`, that every hook event parses. `hook-bundle-budget.json` puts a byte ceiling on that bundle (`max_bytes`, shrink-only: a raise needs a `raise_log` entry) and a separate ceiling on each conditional chunk. `LAZY_CONCERNS` in `lazy_concern.ts` lists concerns built into their own chunk by `hook_chunks.mjs` and loaded with `require` only when the dispatcher runs them; when the chunk is missing or fails its digest, the dispatcher falls back to spawning the concern's script.

The `self-repair` concern is bound on `user_prompt_submit` and `stop`. Its detector set grew on this branch (a fourth detector, a subject index, a read-only reader of the host's memory directory). Measured by the gate on the base commit `b53718de2`, the dispatch bundle was 1,581,986 B against a ceiling of 1,582,000 B.

## The change

- `concern_registry.ts`: the static import and registry row for `self_repair_hook.ts` are removed.
- `lazy_concern.ts`: one `LAZY_CONCERNS` row for it, chunk `self_repair.chunk.cjs`.
- `hook_chunks.mjs`: one chunk entry, `yaml` external (its telemetry shadow reads the settings layers).
- `hook-bundle-budget.json`: one chunk ceiling of 64,000 B over a measured 58,114 B, with its derivation. `max_bytes` is not changed.

Measured after the change by `check_hook_bundle_composition`: dispatch bundle 1,557,293 B (−24,693 B), chunk 58,114 B. The tests that cover lazy-concern resolution, the spawn fallback, registry parity and the manifest pass (19 files, 587 tests).

## The diff

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index de35900651..21a000c878 100644
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
+            "derivation": "Measured 58,114 bytes on 2026-11-04 (road-to-a-noted-that-is-a-write: the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, the read-only host-memory reader and the Class-A telemetry shadow), `yaml` external. The ceiling is that reading plus about 10 %, rounded. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing chunk falls back to the spawn path and costs latency, never a record."
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

## The question

Is this change authority-expanding, and should it land? Consider at least: whether moving a concern out of the bundle changes what it can do or when it runs; whether the fallback path keeps its effect; whether the chunk ceiling and its derivation are sound; anything in the diff that is wrong or missing.

Give your findings, then end with exactly one line in this form, choosing the verdict from `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`:

STANCE: <verdict> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>
