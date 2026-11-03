<!-- evidence-type: analysis -->

# Ratification review — hook-bundle ceiling raised for a shadow strike ledger — round 7

You are an independent reviewer for a change in the `event4u/agent-config` repository. `src/config/hook-bundle-budget.json` is on the ratification gate's list (hook plumbing), so the change needs a two-provider verdict under ADR-268 § 4.

subject: 139be6984907f497e2872b5ae19b3c1b6230b58b091ab1ebf4b22d2ba0616ab5

(The digest covers `src/config/hook-bundle-budget.json` at commit `97cfe64cd1`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Context

Round 6 reviewed the full change (a shadow strike ledger fed by the verification recorder, and the bundle ceiling raised from 1,567,400 to 1,578,600 with a `raise_log` entry): one seat returned ratified, the other approved and asked for (a) the raise_log's headroom sentence to state the true figure — 1,578,600 − 1,578,313 = 287 bytes, where it said "about 500" — and (b) a test proving a failing ledger write leaves the recorder untouched.

## What changed since round 6

Only these two. The gated file's diff against round 6 is the one sentence below; the code it pays for is unchanged. The new test (ledger path made a directory so every write fails; the recorder still exits 0 and records the run) is outside the gated file and passes.

## What to answer

1. Is the gated file now accurate and the raise justified as recorded?
2. Does the change expand any agent's authority, or weaken any existing gate?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff of the gated file since round 6, and its full diff against main

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index c62a384227..9010525d22 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -162,7 +162,7 @@
             "by": "agent, analysis/inbox-2026-11-strike (road-to-a-strike-the-session-keeps 3.2)",
             "what_was_added": "The strike ledger on the verification recorder's post_tool_use path: `_lib/strike_ledger.ts` (signature normalisation, the SAME/NEW/FIXED/FLAKY fold over per-agent edit counters, TTL expiry and size caps, with every edit counter a surviving entry depends on kept, and an allowlist rebuild of every persisted entry) and `_lib/strike_ledger_io.ts` (non-blocking locked write of agents/state/strike-ledger.json, fed the run the recorder appended), 8,898 B. The gate measured 1,578,313 bytes; the base at b234d08480 measured 1,569,415 here, 2,015 over the 1,567,400 ceiling before this change. That base overage is the growth merged between the 2026-11-02 raise (47161a7b70, measured 1,566,892) and b234d08480: +2,523 B from the non-merge commits in that range touching bundled sources — 7742bad8c4, 5dbafe73c5, 850c3619eb, dcb61c6f98 (provider-home and profile fixes) and e8ee59465f, 8afea9f246, e00a48598f — none of which carried a raise_log entry.",
             "why_it_could_not_be_avoided": "The ledger has to observe the run in the same hook invocation that records it: the recorder clears its runs at every turn boundary, which is the defect the ledger exists to outlive, so a later reader in another process would see nothing. A lazy chunk would need its own manifest concern (+1 on the concern_count ratchet) and a second stdin parse of the same event for 8 KB. The base overage is included rather than left red, because a ceiling below the trunk's own reading fails every branch cut from it.",
-            "what_would_have_caught_it": "For the base overage: measuring the ceiling on the merge result, as the first raise_log entry already says. For the ledger: nothing earlier — the growth is the feature. Sized to the measurement plus about 500 bytes of rebuild jitter."
+            "what_would_have_caught_it": "For the base overage: measuring the ceiling on the merge result, as the first raise_log entry already says. For the ledger: nothing earlier — the growth is the feature. Sized to the final measurement (1,578,313) plus 287 bytes of rebuild jitter."
         }
     ],
     "chunks": [
```

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index d4a864631a..9010525d22 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1567400,
+    "max_bytes": 1578600,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -154,6 +154,15 @@
             "what_was_added": "Profile awareness on the session-register path, which runs on session_start: `session_profile` in `_lib/session_register.ts` (reads only the environment) plus `install/agentSwitchProfile.ts` (2,033 B), newly pulled into the bundle so the profile is parsed by the one existing matching rule rather than a second copy; and `_lib/provider_home.ts` (903 B), the single resolver for `CLAUDE_CONFIG_DIR` / `CODEX_HOME` that `claude_plugin.claude_config_dir` now delegates to. Measured 1,566,892 bytes by the gate, 4,892 over the 1,562,000 ceiling; the base sat at 1,561,506.",
             "why_it_could_not_be_avoided": "Room was looked for first: `sessions_cli.ts` (16,380 B) rides in through `env_session_id` and `other_worktree_branches_detailed`, but extracting those is an unrelated refactor of two hooks and a CLI; the schema-flag code added to it is tree-shaken because the bundled entry never reaches `cmd_list`. Inlining a reduced agent-switch path match would save about 1.5 KB at the cost of a second matching rule that drifts from the first. The profile must be recorded when the session registers, in the hook, because a later reader runs in another process with another environment.",
             "what_would_have_caught_it": "Nothing earlier: the growth is the feature. Sized to the measurement plus about 500 bytes of rebuild jitter."
+        },
+        {
+            "date": "2026-11-03",
+            "from": 1567400,
+            "to": 1578600,
+            "by": "agent, analysis/inbox-2026-11-strike (road-to-a-strike-the-session-keeps 3.2)",
+            "what_was_added": "The strike ledger on the verification recorder's post_tool_use path: `_lib/strike_ledger.ts` (signature normalisation, the SAME/NEW/FIXED/FLAKY fold over per-agent edit counters, TTL expiry and size caps, with every edit counter a surviving entry depends on kept, and an allowlist rebuild of every persisted entry) and `_lib/strike_ledger_io.ts` (non-blocking locked write of agents/state/strike-ledger.json, fed the run the recorder appended), 8,898 B. The gate measured 1,578,313 bytes; the base at b234d08480 measured 1,569,415 here, 2,015 over the 1,567,400 ceiling before this change. That base overage is the growth merged between the 2026-11-02 raise (47161a7b70, measured 1,566,892) and b234d08480: +2,523 B from the non-merge commits in that range touching bundled sources — 7742bad8c4, 5dbafe73c5, 850c3619eb, dcb61c6f98 (provider-home and profile fixes) and e8ee59465f, 8afea9f246, e00a48598f — none of which carried a raise_log entry.",
+            "why_it_could_not_be_avoided": "The ledger has to observe the run in the same hook invocation that records it: the recorder clears its runs at every turn boundary, which is the defect the ledger exists to outlive, so a later reader in another process would see nothing. A lazy chunk would need its own manifest concern (+1 on the concern_count ratchet) and a second stdin parse of the same event for 8 KB. The base overage is included rather than left red, because a ceiling below the trunk's own reading fails every branch cut from it.",
+            "what_would_have_caught_it": "For the base overage: measuring the ceiling on the merge result, as the first raise_log entry already says. For the ledger: nothing earlier — the growth is the feature. Sized to the final measurement (1,578,313) plus 287 bytes of rebuild jitter."
         }
     ],
     "chunks": [
```
