<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-21 for step 0.2 of
road-to-a-retro-the-merge-runs, committed verbatim so the verdicts in
agents/evidence/ratifications/retro-settings-and-verb-20261021.md can be read
against what was asked. -->

# Ratification review: the `retro.enabled` setting and the `retro` command verb (ADR-292)

Repository: event4u/agent-config, a governed rule/skill/hook suite for AI coding tools. This is a review of ONE governance change on its own: the settings-and-verb half of commit `5100656c9` (already on `main`), isolated from the rest of that commit. The diff below is complete for these eight files, as that commit introduced them: `docs/decisions/ADR-292-retro-switch-and-verb.md`, `docs/contracts/settings-classes.md`, `src/config/agent-settings.template.yml`, `src/config/discovery/command-verbs.yml`, `src/scripts/_lib/agent_settings.ts`, `src/server/schemas/settings.ts`, `docs/settings-reference.md`, `tests/lib/agent_settings.test.ts`. The same commit's runtime code (the retro scripts and hooks) is NOT included and is not under review here.

## What the change does

1. Adds the setting `retro.enabled`, classified **class C** in `docs/contracts/settings-classes.md` (a human-set key an agent may never write; `settings:set` refuses class C keys), with default `true`, following the existing `continuity.auto_record` pattern of a class C key whose `on` default is a documented decision. The owner directive of 2026-10-12 asked for the retro to be on by default and switchable off.
2. Adds `retro.enabled` to `MERGEABLE_KEYS` in `src/scripts/_lib/agent_settings.ts`, so a user-global `retro.enabled: false` cascades into every project instead of being discarded (only keys on that list cascade from the user-global file; adding one needs an ADR — this is that ADR).
3. Adds the verb `retro` to `src/config/discovery/command-verbs.yml` as the ADR-041 § 5 addendum route for a new visible command verb.

## Background a reviewer may need

- Class C keys: the agent never writes them; a human edits the file or uses the GUI. Class B keys may be written by the agent once after asking and must have a conservative default; that is why "on by default" could not be class B.
- What `retro.enabled: true` turns on (described for context; not in this diff): a merge-triggered and a daily local retro that writes local, gitignored queue files and intake signals, makes no automatic change to rules, skills or always-loaded files, and performs one disclosed network read (asking GitHub, through the user's own `gh` login, whether a PR merged). `false` stops all automatic paths; an explicit `/retro` still runs.

## The question

Does this settings-and-verb change expand any agent authority — what an agent may decide, write, or do without a human — beyond what existed before it? State any defect you find with file and line. Then give exactly one verdict line, from this closed vocabulary:

`VERDICT: ratified` — it expands authority, and the expansion is acceptable as recorded;
`VERDICT: confirmed-non-expanding` — it touches a governance surface but expands no authority;
`VERDICT: refused` — it must not stand as is (say what would change that);
`VERDICT: non-convergent` — you cannot reach a verdict from what you were shown (say what is missing).

## Diff

```diff
diff --git a/docs/contracts/settings-classes.md b/docs/contracts/settings-classes.md
index db9dd4a98..92a1d42ec 100644
--- a/docs/contracts/settings-classes.md
+++ b/docs/contracts/settings-classes.md
@@ -249,8 +249,10 @@ dispatch runs, not WHETHER the layer exists, so they keep their own C rows.
 |---|---|
 | A — preference | 9 |
 | B — consent | 3 |
-| C — guarded | 102 |
-| **Total** | **114** |
+| C — guarded | 103 |
+| **Total** | **115** |
+
+It rose to 115 on 2026-10-20 when `road-to-a-retro-the-merge-runs` step 0.2 added `retro.enabled` (ADR-292) — one C, `consent`: it arms automatic producers on the merge, push and first-session paths, and it ships `true` by the owner's directive of 2026-10-12, which is the documented-decision shape `continuity.auto_record` already has. A class-B key could not carry that default; the class C fence keeps an agent from switching it either way, and `MERGEABLE_KEYS` lets a user-global `false` hold.
 
 It rose to 114 on 2026-10-20 when `road-to-an-update-that-installs-itself-only-when-it-is-safe` step 4.1 added `update.mode` — one C, `consent`: it is a standing authorisation to replace the user's global install, and `auto` is an action they cannot un-see, so no agent write path may reach it. An absent key resolves to `notify`, which installs nothing.
 
@@ -399,9 +401,9 @@ the template, which is the drift this contract exists to prevent.
 |---|---|
 | derivable | 37 |
 | un-inferrable | 10 |
-| consent | 49 |
+| consent | 50 |
 | policy | 18 |
-| **Total** | **114** |
+| **Total** | **115** |
 
 First measured 2026-08-12 at 140 leaves (derivable 88 · consent 38 ·
 un-inferrable 9 · policy 5), from the table below rather than predicted — the
@@ -586,6 +588,7 @@ Rows follow template order, so a diff against the template reads straight down.
 | `commands.create_pr.screenshots` | C | `false` | puts captured screenshots into a published PR body | consent |
 | `continuity.auto_record` | C | `"on"` | arms an automatic producer on the normal session-end path | consent |
 | `continuity.run_checkpoints` | C | `"on"` | disabling it removes a recovery artifact a killed run resumes from | consent |
+| `retro.enabled` | C | `true` | arms automatic producers on the merge, push and first-session paths (ADR-292) | consent |
 | `memory.redact_patterns` | C | `[]` | deny-list of secret and PII regexes | policy |
 | `memory.session_index` | A | `"off"` | injects a compact index at session start | derivable — the row cap and index cost the mechanism already computes; the flag only holds an unproven ship-criterion open |
 | `memory.learn_on_session_end` | B | `false` | turns on automatic memory writes at session end | consent |
diff --git a/docs/decisions/ADR-292-retro-switch-and-verb.md b/docs/decisions/ADR-292-retro-switch-and-verb.md
new file mode 100644
index 000000000..7445d79a4
--- /dev/null
+++ b/docs/decisions/ADR-292-retro-switch-and-verb.md
@@ -0,0 +1,107 @@
+---
+adr: 292
+status: accepted
+date: 2026-10-20
+decision: retro-switch-and-verb
+supersedes: —
+superseded_by: —
+phase: road-to-a-retro-the-merge-runs · step 0.2
+type: structural
+reopen_policy: unclassified
+protected_dimensions: none
+provenance:
+  kind: human
+  decision_makers: [owner]
+  human_directed: true
+evidence:
+  strength: E1
+  basis:
+    - agents/evidence/owner-directives/2026-10-12-retro-inbox-2026-10-o.md
+    - agents/roadmaps/road-to-a-retro-the-merge-runs.md
+    - docs/contracts/retro-v1.md
+    - docs/contracts/settings-classes.md
+    - docs/decisions/ADR-041-controlled-command-verbs.md
+review_trigger: >-
+  Reopened if the 30-day dogfood of road-to-a-retro-the-merge-runs step 5.2
+  shows net cost with no landed learning, if a user needs a retro value the
+  contract fixes as a constant, or if a host already reserves the verb `retro`.
+---
+
+# ADR-292 — One switch for the retro, on by default, and the verb `retro`
+
+## Status
+
+Accepted 2026-10-20. The default and the verb follow the repository owner's
+directive of 2026-10-12, filed verbatim under
+`agents/evidence/owner-directives/`: a retro after every merged pull request,
+startable by hand, **on by default and switchable off by a setting**. The shape
+of the switch (one key, class C, user-global cascade) is the roadmap's D2,
+carried out here. This record is also the ADR-041 § 5 addendum for the new verb.
+
+## Context
+
+The retro (`docs/contracts/retro-v1.md`) runs on three automatic paths and one
+manual command. "On by default" fits no class without a decision: class B
+requires a conservative default and the build breaks otherwise
+(`docs/contracts/settings-classes.md` § B), so the one admissible shape is class
+C with a documented default, the pattern `continuity.auto_record` already
+follows. A user-global `retro.enabled: false` would be discarded silently unless
+the key is on `MERGEABLE_KEYS` (`src/scripts/_lib/agent_settings.ts`), and
+adding a key there requires an ADR. `retro` is not an approved command verb, and
+ADR-041 § 5 requires an ADR for a new one.
+
+## Decision
+
+1. **`retro.enabled`, class C, default `true`.** One key. Budgets, the catch-up
+   window and triage thresholds stay contract constants, not settings (D2).
+   Class C means an agent cannot set it: `settings:set` refuses it, and a person
+   changes it by hand or through the GUI.
+2. **It cascades from the user-global file.** `retro.enabled` joins
+   `MERGEABLE_KEYS`, so `false` in the user-global file switches the retro off in
+   every checkout. A project value still wins over the user-global one.
+3. **`false` stops every automatic path** — the merge path, the forge-merge
+   marker, the daily sweep and its probe. It does not stop an explicit `/retro`:
+   a person asking for one retro has asked, and a manual run never re-enables an
+   automatic path.
+4. **The automatic paths stay local but for one read.** Everything the retro
+   writes lives in the git common directory. The one network access is the
+   daily probe asking GitHub, through the user's own `gh` login, whether a PR a
+   push recorded has merged — repository and PR number, inside one
+   three-second budget for the whole probe. `false` stops it with the rest.
+   The queue line the probe emits asks for the retro after the user's first
+   task and grants no delegation; whether a subagent may run it is the
+   delegation policy's question, not this switch's.
+5. **The verb `retro` is approved** for the visible command `/retro`
+   (ADR-041 § 5). It names the activity the owner asked for; no existing verb
+   (`review`, `audit`, `memory`) carries "examine finished work and draw at most
+   one learning" without overloading a cluster that means something else.
+
+## Consequences
+
+The key exists before any automatic path reads it, so the first path that lands
+lands switchable. Existing installs carry no value and resolve to the default,
+which is the behavior the owner asked for. The verb lands in the same change as
+the key rather than in a PR of its own: the roadmap bundles both into one record
+because neither is useful without the other.
+
+## Alternatives considered
+
+- **Class B with default `false`** — contradicts directive (e); the build
+  forbids a permissive class-B default, and a conservative one is the opposite
+  of what was asked.
+- **Four keys** (paths, budget, window, transcripts) — each extra class-C key is
+  a GUI surface and a governance row; the owner asked for one switch (D2).
+- **A sub-command under `/memory`** — the owner named the command `retro`; the
+  memory cluster promotes lessons, it does not examine finished work.
+
+## Evidence
+
+The owner directive file (verbatim turns of 2026-10-12) and the roadmap's
+decision table (D1, D2, D3).
+
+## References
+
+- `docs/contracts/retro-v1.md`, `docs/contracts/settings-classes.md`
+- `src/scripts/_lib/agent_settings.ts` (`MERGEABLE_KEYS`)
+- `src/config/discovery/command-verbs.yml`
+- ADR-041 § 5
diff --git a/docs/settings-reference.md b/docs/settings-reference.md
index e1ab415ae..bbab3f45a 100644
--- a/docs/settings-reference.md
+++ b/docs/settings-reference.md
@@ -276,6 +276,12 @@ explanation lives now that the file no longer carries it as comments.
 |---|---|---|---|---|---|
 | `reasoning.enabled` | C | boolean | `true` |  | Master switch for the Reasoning Discipline Protocol (RDP). false = the whole layer is inert (zero overhead). |
 
+## retro
+
+| Key | Class | Type | Default | Allowed values | What it does |
+|---|---|---|---|---|---|
+| `retro.enabled` | C | boolean | `true` |  | Automatic retro after merged work (ADR-292, docs/contracts/retro-v1.md). true (default, owner directive 2026-10-12) = a merged PR and the first session of a new local day enqueue finished work; a deterministic triage picks what is worth one learning, and nothing behavior-changing is applied without a person. The one network read is the daily probe asking GitHub, through your own gh login, whether a pushed PR merged (repository and PR number only, three-second budget). false = no automatic path runs — no merge enqueue, no forge-merge marker, no daily probe and no network read; an explicit /retro still runs on request. Class C: an agent cannot set it; it cascades from the user-global file. |
+
 ## roadmap
 
 | Key | Class | Type | Default | Allowed values | What it does |
diff --git a/src/config/agent-settings.template.yml b/src/config/agent-settings.template.yml
index 18539b2f9..0c9e142b6 100644
--- a/src/config/agent-settings.template.yml
+++ b/src/config/agent-settings.template.yml
@@ -1171,6 +1171,19 @@ continuity:
   #   off = no checkpoint; every other session-end handler is unaffected.
   run_checkpoints: "on"
 
+# Automatic retro after merged work (ADR-292, docs/contracts/retro-v1.md).
+retro:
+  # On by default by the owner's directive of 2026-10-12. A merged pull request
+  # and the first session of a new local day enqueue finished work; a
+  # deterministic triage picks what is worth one learning, and nothing that
+  # changes behavior is applied without a person. The one network read is the
+  # daily probe asking GitHub, through your own gh login, whether a pushed PR
+  # merged (repository and PR number only, three-second budget).
+  #   true  = (default) the automatic paths run.
+  #   false = no automatic path runs; an explicit /retro still runs on request.
+  # Set it in the user-global settings file to switch it off everywhere.
+  enabled: true
+
 # --- Memory ---
 #
 # Engineering memory consolidation behaviour. Memory is entirely
diff --git a/src/config/discovery/command-verbs.yml b/src/config/discovery/command-verbs.yml
index 4527d61d6..d53f95921 100644
--- a/src/config/discovery/command-verbs.yml
+++ b/src/config/discovery/command-verbs.yml
@@ -44,6 +44,7 @@ approved_verbs:
   - mode
   - optimize
   - roadmap
+  - retro      # /retro — examine finished work (ADR-292, addendum to ADR-041 § 5)
 
 # Leading tokens banned for NEW visible commands regardless of the allowlist.
 banned_prefixes:
diff --git a/src/scripts/_lib/agent_settings.ts b/src/scripts/_lib/agent_settings.ts
index 180cdbf9b..df7de8780 100644
--- a/src/scripts/_lib/agent_settings.ts
+++ b/src/scripts/_lib/agent_settings.ts
@@ -310,6 +310,11 @@ export const MERGEABLE_KEYS: readonly string[] = [
     // nothing, and `installerThinsHost` still refuses a template-only value.
     'lean_projection.mode',
     'lean_projection.hosts',
+    // `retro.enabled` is the one switch over the automatic retro (ADR-292). It
+    // ships `true`, so the only value worth writing is `false`, and a user who
+    // writes it once in the user-global file expects every checkout to honour
+    // it — without this row the off switch would be discarded silently.
+    'retro.enabled',
 ];
 
 /** The shipped template, relative to the package root. */
diff --git a/src/server/schemas/settings.ts b/src/server/schemas/settings.ts
index 4c9bf812f..3f3107c9f 100644
--- a/src/server/schemas/settings.ts
+++ b/src/server/schemas/settings.ts
@@ -435,6 +435,11 @@ export const settingsSchema = z.object({
             'Deterministic run-checkpoint production at session end (road-to-continuity-writer-activation Phase 1.4). on (default) = a session above the recycle threshold and inside a running roadmap contract leaves agents/runtime/state/checkpoints/<run>.json, so a killed run resumes from a derived checkpoint rather than from bookkeeping. off = no checkpoint; continuity writing, the recycle advisory and the context-fill surface are unaffected. Default ON because it is the behavior the tree already had — the switch exists to make the three session-end handlers independently disableable, not to change what ships.',
         ),
     }),
+    retro: z.object({
+        enabled: z.boolean().default(true).describe(
+            'Automatic retro after merged work (ADR-292, docs/contracts/retro-v1.md). true (default, owner directive 2026-10-12) = a merged PR and the first session of a new local day enqueue finished work; a deterministic triage picks what is worth one learning, and nothing behavior-changing is applied without a person. The one network read is the daily probe asking GitHub, through your own gh login, whether a pushed PR merged (repository and PR number only, three-second budget). false = no automatic path runs — no merge enqueue, no forge-merge marker, no daily probe and no network read; an explicit /retro still runs on request. Class C: an agent cannot set it; it cascades from the user-global file.',
+        ),
+    }).default({}),
     memory: z.object({
         redact_patterns: z.array(z.string()).default([]).describe(
             'Regex patterns (one per line) that scrub matches from chat-history transcripts and memory before they hit disk. Use for secrets, customer names, internal URLs. Patterns are anchored and case-insensitive.',
diff --git a/tests/lib/agent_settings.test.ts b/tests/lib/agent_settings.test.ts
index 8e8d776a0..0796b67cf 100644
--- a/tests/lib/agent_settings.test.ts
+++ b/tests/lib/agent_settings.test.ts
@@ -338,6 +338,9 @@ describe('MERGEABLE_KEYS', () => {
             // and it was the one layer being filtered.
             'lean_projection.mode',
             'lean_projection.hosts',
+            // ADR-292: the retro's one switch ships `true`, so `false` is the only
+            // value worth writing, and it must hold from the user-global file.
+            'retro.enabled',
         ]);
     });
 
```
