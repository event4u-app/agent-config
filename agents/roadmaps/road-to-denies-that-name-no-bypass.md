---
complexity: lightweight
status: ready
tree_pin: ea21dd17a4
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner search found none: grep -rlF -e KILL_SWITCH -e lint_deny_text -e neutralizeBoundary -e pendingFileFor over agents/roadmaps/*.md, later/ and stubs/ returned no roadmap owning a deny text, a fence or the session-id fallback; the adjacent later/road-to-typed-grants-that-persist owns grant objects, not deny wording. Active because the operator asked this round's findings to be executed (/roadmap:process-full in the same invocation)."
relates:
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: "Owns the self-approval question (who may write a grant); this file owns only what a refusal says and what an empty session id falls back to."
---
# Road to denies that name no bypass

> **Source:** `agents/tmp.old/inbox-2026-11-zc/` (topic t2, an external-harness
> comparison and its supplied plan), every step reproduced against `ea21dd17a4`.

## Goal

A refusal must not hand the agent its own way around. Today the credential guard
prints the variable that disables it, and the lint written to catch exactly that
passes. Two other guards tell the agent to delete their own manifest entry. A
quoted fence around recalled memory can be closed from inside the quoted text. A
missing session id makes two different sessions share one approval record. Each
of these defects is small, and each has a reproduction recorded below.

## Phase 1 — refusals that do not teach the bypass

- [x] **1.1 The credential guard stops printing its kill switch.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/block_credential_reads.ts -->
      `src/scripts/hooks/block_credential_reads.ts:125` ends its refusal with
      `maintainer override: ${KILL_SWITCH}=1`, where `KILL_SWITCH` is the env var
      that disables it (`:68`). The refusal keeps its reason and the alternative,
      and names no variable.
      The test file gains a case asserting the refusal contains no
      `AGENT_CONFIG_ALLOW_`, shown red first.
      verify: `npx vitest run tests/scripts/hooks/block_credential_reads.test.ts` -> 0
      Done 2026-11-08: the refusal ends `(block-credential-reads)`; the new test was shown red first.
- [x] **1.2 `lint_deny_text` resolves the constants a deny interpolates.** Today <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/block_credential_reads.ts -->
      it reports "no blocking concern names its own bypass (9 concern(s)
      scanned)" with exit 0 over the defect in 1.1, because it reads the template
      literal unresolved (`src/scripts/lint_deny_text.ts:14-18`, `:212`). It
      resolves `${NAME}` against the module's own string constants before matching,
      and its header states what it can and cannot see.
      verify: the lint fails on the tree before 1.1 lands and passes after; its
      test carries a template-literal fixture.
      Done 2026-11-08: red on the tree before 1.1/1.3 with four findings, not two. The
      sibling search found `block_speaking_inbox_dir.ts` printing its switch the same way.
      Council round 1 added shadowing, escapes and plain-string cases; self-test 14/14.
- [x] **1.3 No deny tells the agent to remove its own entry.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/block_credential_reads.ts -->
      `block_no_verify.ts:721` and `block_kernel_rule_writes.ts:248-249` say "disable
      or remove the entry in src/scripts/hook_manifest.yaml". The bypass is a
      human action, so the text names the owner path (a maintainer PR) and not the
      file edit. The 1.2 lint adds the manifest path to what a deny may not name.
      verify: the lint fails on the old wording; the two hooks' tests pass.
      Done 2026-11-08: both denies now name a maintainer change reviewed in its own PR.
- [x] **1.4 The deny drill fails when there is nothing to drill.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/block_credential_reads.ts -->
      `tests/hooks/rule_trips.test.ts:19-24` skips green, with a warning, when the
      built bundle is absent. On CI an absent bundle is an error.
      verify: the test fails with `CI=1` and no bundle, and passes with the bundle.
      Done 2026-11-08, narrower than reported: the vitest global setup rebuilds a
      missing bundle, so under vitest the skip was not reachable. The test now throws
      on CI if that rebuild ever fails instead of skipping green.

## Phase 2 — fences and fallbacks

- [x] **2.1 Recalled memory is fenced so the text cannot close the fence.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/block_credential_reads.ts -->
      `src/scripts/hooks/memory_recall_hook.ts:430-438` wraps each description in
      `"…"`; a description containing `"` ends the quote early. Use the shared
      boundary helper the subagent capsule already has
      (`_lib/subagent_capsule.ts:671-695`, `neutralizeBoundary`), moved where
      both import it.
      verify: a recall test with a description carrying `"` and an instruction
      after it keeps the instruction inside the fence; shown red first.
      Done 2026-11-08 by a same-width `"` → `'` replacement, not the capsule helper:
      that helper defangs a tag, not a quote. Sibling search for the construct: 1 site.
- [x] **2.2 An empty session id refuses instead of sharing a file.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/block_credential_reads.ts -->
      `src/scripts/git_authorization_hook.ts:116-121` (`ledgerFileFor`) and
      `:124-128` (`pendingFileFor`) both fall back to one shared file when the
      session id is empty, so two sessions read each other's authorization record.
      Both return no path and the caller fails closed. The supplied plan named only
      the first site; the second was found by reproduction.
      The test file gains an empty-id case asserting no shared file is read or written.
      verify: `npx vitest run tests/scripts/git_authorization.test.ts` -> 0
      Done 2026-11-08. Premise corrected: nothing enforces git authorization since
      ADR-254, so the shared file leaked turn stamps, grants and pending records, never
      a push. Council (2026-11-08, two seats): remove both fallbacks. No id → no record.

## Non-goals

- Who may issue a grant, including the billing yes the agent can write today
  (`council:grant-billing`, `src/cli/registry.ts:142`). That question was ruled
  on by the owner before and is carried by `later/road-to-typed-grants-that-persist.md`.
- Any added question to the user. The ask count stays as it is.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A refusal that no longer helps the maintainer | product | Removing the variable name from 1.1 leaves a maintainer without the switch they set on purpose | The switch stays documented in the hook's header and in the guard's doc, not in the agent-facing text | Phase 1 — refusals that do not teach the bypass |
| 2 | A fail-closed fallback that blocks a host without session ids | implementation | 2.2 turns a shared file into a refusal; a host that never sends a session id would refuse every git act | Test the hosts the manifest binds; where a host sends no id, record it and keep the refusal visible rather than silent | Phase 2 — fences and fallbacks |
| 3 | A resolver that over-matches | implementation | 1.2 resolving constants could flag a deny that only mentions a variable by purpose | Match only resolved env-var names and the manifest path, with fixtures for both sides | Phase 1 — refusals that do not teach the bypass |

## Acceptance Criteria

- [x] AC-1 — No blocking concern's refusal names the variable or file edit that
      disables it, and `lint_deny_text` proves it over resolved text.
- [x] AC-2 — Recalled memory and session-scoped approval records cannot be
      reached from outside their own fence or session.
