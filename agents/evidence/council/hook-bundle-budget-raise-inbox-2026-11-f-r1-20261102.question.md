<!-- evidence-type: analysis -->

# Ratification review — `hook-bundle-budget.json` max_bytes 1,562,000 → 1,563,000 — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. The change edits `src/config/hook-bundle-budget.json`, a file on the ratification gate's hook-plumbing list, so it needs a two-provider verdict under ADR-268 § 4: an agent may change the hook plumbing but may not ratify its own change.

## The diff to the gated file

```diff
-  "max_bytes": 1562000,
+  "max_bytes": 1563000,
   ...
+    {
+      "date": "2026-11-02",
+      "from": 1562000,
+      "to": 1563000,
+      "by": "agent, analysis/inbox-2026-11-f",
+      "what_was_added": "Nothing from this branch: the bundle measures 1,562,998 bytes with and without its one bundle-adjacent change (install_reach_checks.ts reverted to origin/main, same byte count). The 998 bytes arrived with main merges after the 2026-11-01 raise (b51c393683..44d244dbcb), which touched hook-reachable sources incl. host_docs_pages.yaml (+9 rows), code_graph_refresh_hook.ts and runtime_wiring_checks.ts.",
+      "why_it_could_not_be_avoided": "The overage is on main; this branch cannot shrink code it did not add without a drive-by refactor of another change.",
+      "what_would_have_caught_it": "The composition gate on the merges that grew it; it appears not to run in the remote checks those merges passed."
+    }
```

## Measurements taken by the implementing session

- `./scripts-run src/scripts/check_hook_bundle_composition` on the branch (origin/main `44d244dbcb` merged in): bundle 1,562,998 bytes, ceiling 1,562,000.
- The same command after replacing the branch's only edited bundle-adjacent source (`src/scripts/_lib/install_reach_checks.ts`) with its `origin/main` content: 1,562,998 bytes.
- `grep` for the branch's new identifiers (`cloud-reach`, `CLAUDE_CODE_REMOTE`) in the rebuilt `dist/hooks/dispatch.js`: 0 hits.

## The rest of the branch (not gated, context only)

A read-only `doctor` check `cloud-reach` (`src/scripts/_lib/cloud_reach.ts`), a non-gate probe script `src/scripts/cloud_clone_probe.ts`, documentation `docs/setup/cloud-sessions.md`, roadmap files, and a lowered `gate-violation-baselines.json` count.

## What to answer

1. Does the raise or its `raise_log` entry contain a defect or a false statement? Name it.
2. Does the change expand any agent's or hook's authority — what an agent may do or decide, or what a hook may cause?
3. Your verdict, as one of: `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`.
