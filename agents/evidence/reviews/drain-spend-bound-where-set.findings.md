# Findings: drain-spend-bound-where-set
<!-- completion-review: v1 | reviewed: 2026-10-06 | scope: 6430bca3658160fe3ebd0b6852388634f91172c60e74a22575c2707ac24bb2bf | diff: 56710bff21c652bd4cab1b5e8fd77bf18b595dae | reviewer: r2-fresh-subagent-drain-spend-bound-where-set | prompt_hash: 6f8e883f4fe1fa6548c584b2ed32c8505cabfd8eea2a584d26fd3c25382b9324 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-spend-bound-where-set"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-06 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 56710bff21c652bd4cab1b5e8fd77bf18b595dae
  scope_hash: 6430bca3658160fe3ebd0b6852388634f91172c60e74a22575c2707ac24bb2bf
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-06T15:35:10Z
-->

<!-- re-bound 2026-10-06, in place (contract §2.1, the normal path for a fix
pass that changes the scope — not a re-dispatch): the header above now reads
scope 6430bca3.../diff 56710bff2 (was f4c1b511.../e926fe79 at dispatch). The
reviewer's original table (3 findings, all `open`) is preserved verbatim
below; only this header's scope:/diff: and each row's Status/Reason/Ref
changed. The header itself is restored from the dispatcher's original write:
the reviewer's own final write had replaced it with a bare table, dropping
the mandatory §2.1 marker — caught and fixed here rather than left for the
gate to find. -->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | tests/_lib/hermetic-env.ts:65 | `CONFIG_HOME_VAR` hardcodes the literal string `'EVENT4U_CONFIG_HOME'` instead of importing the canonical `EVENT4U_HOME_ENV` constant from `src/scripts/_lib/user_global_paths.ts` — the very constant `src/server/writeRoot.test.ts` (same diff) correctly imports as `EVENT4U_HOME_ENV as CONFIG_HOME_VAR`. Six other new/changed test files (`ledger_is_hermetic.test.ts`, `ledger_without_limit.test.ts`, `no_default_spend_bound.test.ts`, `cmd_update.test.ts`, `serverInfo.test.ts`, `token.test.ts`) all depend on this duplicated literal via re-export from `hermetic-env.ts`. This file's entire purpose is to stop a billable-seat test from writing real spend records into the developer's actual `~/.event4u/agent-config/` ledger (the exact incident its own docstring documents); if the production env-var name ever changes, this duplicate silently stops matching what `user_global_paths.event4u_root()` reads. (Partially self-defending: `ledger_is_hermetic.test.ts` throws if `LEDGER_PATH` doesn't start under the pinned home, so a drift would likely fail loud rather than silently corrupt a real ledger — but the DRY violation itself, in a file authored specifically to prevent this class of defect, is a bug-producing pattern.) | fixed | 8a5d82fdc — tried the straightforward import fix and reverted it: it pre-caches `user_global_paths.ts`'s `node:os` import in the setupFiles phase, before any test file's own `vi.mock('node:os', ...)` factory is wired up, so `src/server/writeRoot.test.ts` and `tests/server/serverInfo.test.ts` silently read the real homedir instead of their mock (reproduced directly). Kept the literal; added a drift-guard assertion in `tests/scripts/hermetic_env.test.ts` (an ordinary test file, no such side effect) that `CONFIG_HOME_VAR === user_global_paths.EVENT4U_HOME_ENV`, verified red against a deliberately mismatched literal, then green. |
| 2 | low | docs/decisions/INDEX.md:175,224 | Both the ADR-230 and the new ADR-279 rows embed an un-escaped `\|` pipe character, quoted verbatim from ADR-230's own original § Decision table (`"...both disabled) \| Ask, as before"`), inside the `superseded_scope`/`supersedes_scope` frontmatter prose that `regenerate_index` copies straight into a generated Markdown table cell. An unescaped `\|` splits a table row into an extra column, producing a malformed/misaligned row — visibly, the ADR-230 cell renders as the doubled "ADR-279 (ADR-279 (no-spend-bound-by-default) supersedes the third row of this record's § Decision table (\"...both disabled)" / "Ask, as before\") ...". The companion ADR-279-no-spend-bound-by-default.md body (hand-authored) escapes the same quoted text as `\|` in its own table, showing the author knew to escape it there; the auto-generated INDEX.md row does not. | fixed | aac8f4808 — fixed the shared generator (`supersessionCell()` in `src/scripts/adr/regenerate_index.ts`), not the two frontmatter fields: a `\|` escape on the scope half of the cell only, never on `refs`. Added a regression test, verified red against the unescaped baseline with the exact pipe-inside-a-quote shape that triggered this, then regenerated `docs/decisions/INDEX.md` — the diff touches only the two affected rows. |
| 3 | low | src/scripts/_cli/cmd_explain.ts:338,359-362 | `_explain_config` already resolves `settings` via `_load_user_settings(project_root)` (line 268), which calls `load_agent_settings({ project_path: p })` and short-circuits to `{}` without calling the loader at all when no project-local `.agent-settings.yml` exists (lines 240-243). The new `printConfiguredBudgets(print, project_root)` call (line 338) ignores that already-resolved `settings` and performs its own independent `load_agent_settings({ cwd: project_root })` call (line 362) with a different parameter shape. This is a redundant settings read/parse on every `explain config` invocation, and — since the two calls use different parameters and `_load_user_settings`'s existence pre-check never consults the full cascade — the "configured cost.budgets" line can end up reflecting a different resolved settings view than the `profile`/`preset` lines printed just above it in the same command's output. | fixed | 56710bff2 — `printConfiguredBudgets` now takes the already-resolved `settings` value instead of re-deriving it from `project_root`; removes the redundant parse and the divergence risk in the same stroke. `tests/scripts/_cli/cmd_explain_cost_line.test.ts` (unchanged) still passes, along with the other two `cmd_explain` test files. |
