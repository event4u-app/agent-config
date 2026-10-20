<!-- evidence-type: analysis -->

# Review: moving a hook concern out of the dispatch bundle into a conditional chunk

You are reviewing a change to this package's hook plumbing. Two gated files are
in it, and the question is whether the change expands the authority of the
agent or of the hook system, and whether the mechanism is sound.

Report a verdict from this closed set: `ratified`,
`confirmed-non-expanding`, `refused`, `non-convergent`. State what you checked
and what would have changed your verdict.

## What the change does

`dist/hooks/dispatch.js` is one bundle every hook event loads, so a module
imported for one concern is paid for on every dispatch. It stood 39 bytes under
its 1,550,000-byte ceiling. `src/scripts/chat_history.ts` is bound on
`session_start` and on no other event, and its exclusive closure measured
121,219 bytes of that bundle.

The change moves it into a conditional chunk, `dist/hooks/chat_history.chunk.cjs`,
loaded on demand. Concretely:

1. `src/scripts/hooks/lazy_concern.ts` (new) declares `LAZY_CONCERNS` and loads
   a chunk on demand: existence check, digest verification against the sidecar
   when bundled, `require`, then a check that the module exports `main`. Every
   failure is a `null` return, never a throw.
2. `src/scripts/hooks/dispatch_hook.ts` (GATED) — `_run_concern` resolves the
   concern through `resolveConcernMain(script)`, which is
   `CONCERN_REGISTRY[script] ?? loadLazyConcern(script)`. When that is `null`
   the pre-existing spawn-per-concern path runs, unchanged.
3. `src/config/hook-bundle-budget.json` (GATED) — a `chunks` entry registering
   `src/scripts/chat_history.ts` at a 232,000-byte ceiling, measured at 209,890.
   `max_bytes` for the dispatch bundle is NOT changed, and no `raise_log` entry
   is added.
4. `src/scripts/hooks/hook_stdin.ts` — the per-concern stdin override moves from
   a module-local binding to `globalThis` under `Symbol.for(...)`, because a
   chunk is a second module graph in the same process and the dispatcher's
   override was invisible to it. Measured: the lazily loaded concern read an
   already-consumed fd 0, wrote nothing, and exited 0.
5. `src/scripts/_lib/session_tag.ts` (new) — five lines extracted from
   `chat_history.ts` so `hooks/interruption_ledger_hook.ts` can import the
   session tag without dragging the 121 KB closure back in.
6. The chunk build (`src/scripts/hook_chunks.mjs`) gains a banner rebuilding
   `import.meta.url` from `__filename` (empty under esbuild's `cjs` format) and
   marks `yaml` external for this chunk (a declared runtime dependency of the
   package; inlined it doubled the chunk to 472,201 bytes).

## The prior decision this follows

An AI council of two providers decided on 2026-10-18, for the egress engine,
that room under this ceiling is made by moving a module into a conditional
chunk rather than by raising the ceiling, and asked that each chunk carry a
measured budget of its own. That decision is recorded as D9 in
`agents/roadmaps/road-to-an-update-that-installs-itself-only-when-it-is-safe.md`
and as the second entry of the `chunks` array in the budget file. This change
applies that mechanism to a concern for the first time.

## Questions to answer

1. Does any of this expand the authority of the agent, of the hook system, or
   of a concern — including the `globalThis` move in (4) and the digest check
   in (1)?
2. Is the failure mode of a missing, mis-digested or malformed chunk correct?
   The claim under review is that it costs latency and never the concern's
   effect, because the spawn path sits behind it.
3. Does moving the stdin override to a process-global weaken the isolation the
   per-concern re-serialisation provides, or create a path by which one
   concern can observe or alter another's envelope?
4. Is the chunk's `yaml` external safe in a published install, where the chunk
   sits at `<package>/dist/hooks/` and `yaml` is a declared dependency?
5. Anything else you would refuse this on.

## The gated diff

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f3f1bb383..4a27c2615 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -14,8 +14,8 @@
             "from": 1500000,
             "to": 1550000,
             "by": "agent, during the inbox-2026-10 drain",
-            "what_was_added": "Nothing in this commit. The 1,500,000 ceiling was red on the very commit that registered it: measured 1,511,489 bytes at 22b19e520, which is the merge of the PR that introduced the budget. Its derivation read 1,469,738 bytes on the PR branch, whose base predated three PRs that had merged meanwhile — the failure-event binding of #2160 (sixteen concerns on a new slot), the touched-file quality pass of #2152, and the evidence classification of #2153 — and #2162 landed after it. The gate ran on each PR's pre-merge tree and never on the merge result, so every one of those PRs was green alone and the trunk was red the moment they were together.",
-            "why_it_could_not_be_avoided": "The bytes are deliberately merged capability, not an accident to trim: the composition check above shows one parser and no duplicate dependency, so there is nothing to remove that would not remove a feature. The alternative — reverting a merged lane to fit a ceiling derived against a base that no longer exists — would discard working code to satisfy a number that never described this tree.",
+            "what_was_added": "Nothing in this commit. The 1,500,000 ceiling was red on the very commit that registered it: measured 1,511,489 bytes at 22b19e520, which is the merge of the PR that introduced the budget. Its derivation read 1,469,738 bytes on the PR branch, whose base predated three PRs that had merged meanwhile \u2014 the failure-event binding of #2160 (sixteen concerns on a new slot), the touched-file quality pass of #2152, and the evidence classification of #2153 \u2014 and #2162 landed after it. The gate ran on each PR's pre-merge tree and never on the merge result, so every one of those PRs was green alone and the trunk was red the moment they were together.",
+            "why_it_could_not_be_avoided": "The bytes are deliberately merged capability, not an accident to trim: the composition check above shows one parser and no duplicate dependency, so there is nothing to remove that would not remove a feature. The alternative \u2014 reverting a merged lane to fit a ceiling derived against a base that no longer exists \u2014 would discard working code to satisfy a number that never described this tree.",
             "what_would_have_caught_it": "Measuring the ceiling against the merge result rather than the PR branch. A ceiling derived on a branch is a statement about that branch; the trunk is what the gate defends, and the two diverge exactly when several lanes land in one day."
         }
     ],
@@ -31,10 +31,16 @@
             "max_bytes": 28000,
             "registered_at": "2026-10-18",
             "derivation": "Measured 18,478 bytes on 2026-10-18 (the rule table, the token grammar and the commit scanner, with the per-rule linearity prose moved to a test-only module). The ceiling is that reading plus the queued engine work of road-to-one-detector-and-the-senders-we-own (validated identifier rules about 4.3 KB, known values, the invisible-character rescan and the variant suffix about 1-2 KB each), rounded up. An AI council of two providers chose on 2026-10-18 to move the engine out of the dispatch bundle into this conditional chunk rather than raise the dispatch ceiling, and asked that the chunk carry a measured budget of its own so the move does not just relocate uncontrolled growth. A raise follows the same rule as max_bytes: a raise_log entry naming the chunk (`chunk`: this entry) and what was added."
+        },
+        {
+            "entry": "src/scripts/chat_history.ts",
+            "max_bytes": 232000,
+            "registered_at": "2026-10-20",
+            "derivation": "Measured 209,890 bytes on 2026-10-20, with `yaml` external (inlined it is 472,201 \u2014 a second copy of the parser the dispatch bundle already carries). The ceiling is that reading plus about 10 %, rounded, because this chunk carries a 2,300-line concern plus the memory lookup and FTS index it reads, all of which still grow. WHY IT WAS MOVED: `chat-history` is bound on `session_start` and on no other event, while its closure was 121,219 bytes of a 1,549,961-byte dispatch bundle that every hook event loads \u2014 39 bytes under the ceiling, with road-to-an-update-that-installs-itself-only-when-it-is-safe step 3.1 queued behind it. This is the mechanism an AI council of two providers chose on 2026-10-18 for `egress_engine` (roadmap decision D9: make room first, a raise only as the evidence-backed fallback), applied to the largest narrow-event module the metafile ranks. UNLIKE THE OTHER TWO CHUNKS this one carries a CONCERN, so there is a correct path behind the fast one: `_run_concern` tries the static registry, then `loadLazyConcern`, then the historical spawn-per-concern path. A missing or mis-digested chunk costs latency, never the concern's effect."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
     "max_yaml_packages": 1,
-    "max_yaml_packages_note": "The dispatch path reads YAML for the hook manifest, the host-lowering table and the settings contract. One reader covers all three. Two cost 95,846 bytes for a single call site and were invisible until an external rescore counted them — which is why this is a cap rather than prose. The package set the cap counts over is YAML_PACKAGES in the gate.",
+    "max_yaml_packages_note": "The dispatch path reads YAML for the hook manifest, the host-lowering table and the settings contract. One reader covers all three. Two cost 95,846 bytes for a single call site and were invisible until an external rescore counted them \u2014 which is why this is a cap rather than prose. The package set the cap counts over is YAML_PACKAGES in the gate.",
     "what_this_does_not_bound": "Latency. A smaller bundle is not a measured speed-up; src/config/hook-latency-budget.json owns the wall-clock axis and is not derived from this file. Nor does it bound dist/install/install.mjs or dist/mcp/server.mjs, which carry their own module graphs."
 }
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 5faf7f0e9..b0437af0e 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -47,7 +47,7 @@ import {
 } from "./state_io.js";
 import { log_dispatch_issue, fix_hint } from "./dispatch_issues.js";
 import { shapeAndRecord, type ConcernMessage } from "./injection_budget.js";
-import { CONCERN_REGISTRY, type ConcernMain } from "./concern_registry.js";
+import { resolveConcernMain, type ConcernMain } from "./concern_registry.js";
 import {
   setHookStdinOverride,
   clearHookStdinOverride,
@@ -679,8 +679,8 @@ function _run_concern(concern: ConcernDef, envelope: JsonObject): RunResult {
   // In-process fast path — the default whenever the concern is in the
   // static registry (all manifest concerns; parity is CI-enforced).
   if (process.env["AGENT_CONFIG_HOOKS_ISOLATED"] !== "1") {
-    const inproc = CONCERN_REGISTRY[String(concern["script"])];
-    if (inproc !== undefined) {
+    const inproc = resolveConcernMain(String(concern["script"]));
+    if (inproc !== null) {
       return _run_concern_inproc(inproc, concern, envelope);
     }
   }
```

## Files to read for the rest

- `src/scripts/hooks/lazy_concern.ts`
- `src/scripts/hooks/concern_registry.ts`
- `src/scripts/hooks/hook_stdin.ts`
- `src/scripts/hook_chunks.mjs`
- `src/scripts/_lib/session_tag.ts`
- `tests/scripts/hooks/lazy_concern.test.ts`
- `tests/scripts/hooks/hook_stdin_cross_graph.test.ts`
- `tests/hooks/concern_registry_parity.test.ts`
