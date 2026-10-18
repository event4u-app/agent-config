---
adr: 291
status: accepted
date: 2026-10-18
decision: existing-installs-are-asked-never-flipped
supersedes: —
superseded_by: —
phase: road-to-an-update-that-installs-itself-only-when-it-is-safe · blocker auto-default-for-existing-installs
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/council/auto-default-existing-installs-20261018.md
    - agents/evidence/council/auto-default-existing-installs-20261018.question.md
    - agents/evidence/council/owner-blocker-routing-20261016.md
    - agents/roadmaps/road-to-an-update-that-installs-itself-only-when-it-is-safe.md
    - agents/evidence/analysis/mid-session-swap-probe-2026-10-18.md
review_trigger: >-
  Reopened if a ring-0 or later unattended release rolls back or breaks a live
  session, or if consumer reports show the one-time invitation is read as a
  silent change. A proposal to make `auto` the default for an existing install
  without its answer — option (c) — is a reopen of this record, not an
  implementation detail.
---

# ADR-291 — Existing installs are asked once, never flipped

## Status

Accepted 2026-10-18. Decided by the AI council (2/2, `anthropic` + `openai`,
both (a)), under the owner's delegation of 2026-10-18 ("versuche die offenen
entscheidungen im ai council zu lösen"). Resolves the blocker <!-- md-language-check: ignore -->
`auto-default-for-existing-installs`.

## Context

`update.mode: auto | ask | notify | off` ships as an opt-in; an absent key
behaves as today. Nothing is backported (`SECURITY.md:21-22`), and the update
notice reaches only CLI users on a TTY. A mid-session swap failed 490 of 4,190
hook invocations, so the unattended path does not swap until a machine-wide
live-session register exists.

## Decision

1. `auto` may become the default for **new** installs.
2. An **existing** install is never moved to `auto` without its answer. It is
   asked **once**, with a permanent "never".
3. The invitation is shown only after the ring-0 exit (four consecutive
   unattended releases with zero rollbacks and zero probe errors) and after the
   live-session register (updater step 1.4) exists.
4. Only in the host-native, interactive moment step 4.3 describes; never under
   CI, headless, non-TTY, `--json` or a subagent run.
5. Dismissal, a timeout or any uncertainty keeps `notify`. "Never" is binding:
   no re-asking under any circumstance.

## Consequences

Step 4.3's default is settled. An install that never answers stays on
`notify`, which is today's behaviour.

## Alternatives considered

- **(b)** `ask` is terminal — leaves installs whose users never update by hand
  permanently unpatched under a no-backport policy.
- **(c)** `auto` everywhere after ring 0 — converts existing installs without
  consent; refused by both seats and by `non-destructive-by-default`.

## Evidence

The council record and prompt beside it, and the mid-session swap probe.

## References

- `non-destructive-by-default` — the floor point 2 keeps.
