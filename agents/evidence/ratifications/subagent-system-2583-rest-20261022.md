---
proposed_by: roadmaps of PR #2583 (road-to-a-cold-start-paid-once, road-to-one-detector-and-the-senders-we-own), conditions of the 2026-10-22 ratification
implemented_by: claude-opus-5.5 session on feat/subagent-system-2583-rest, with delegated worker sessions
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 1 of 2026-10-22
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: df2fa29c2379cc5997aa526559efb9341263a41489948eca62d71cbce8a1b9a4
---

<!-- evidence-type: ratification -->

# Ratification — the gated hook plumbing of feat/subagent-system-2583-rest

`check_kernel_edit_ratified` gates four hook-plumbing files on this branch:
`src/scripts/_lib/egress_rules.ts`, `src/scripts/hook_manifest.yaml`, its compiled projection
`src/scripts/hook_manifest.json`, and `src/scripts/hooks/dispatch_hook.ts`. The `subject:` digest
covers all four, computed with
`./scripts-run src/scripts/ratification_subject --files <the four>`.

## What was ratified

The change answers three of the four non-blocking conditions the 2026-10-22 ratification
(`subagent-system-2583-20261022.md`) carried:

- **Payload access by projection** (condition 4). `payload_fields: [k, …]` in the manifest; the
  dispatcher hands a concern each tool body reduced to those keys, a non-object body as the
  content-free stub. `spawn-guard-shadow` declares the five addressing fields it reads. Blocking
  and fail-closed concerns are never narrowed; the lint refuses a malformed declaration and one
  on a guard.
- **The IBAN table names its registry release** (condition 3): `IBAN_REGISTRY_RELEASE = 103`,
  pinned to the table's digest by a test.
- **The ledger-tail read** (condition 2) is replaced by a digest-keyed index in the consumer
  code, shown to the seats beside the gated diff.

Condition 1 (`rate_limit` unobserved live) is not changed by this diff.

## How it got here

One round, both seats ratified. The prompt, committed verbatim:
`agents/evidence/council/subagent-system-2583-rest-ratification-r1-20261022.question.md`. CLI
subscription transport, USD 0.00.

Non-blocking findings the seats named, all in non-gated consumer code, and what became of them:

| Seat | Finding | Disposition |
|---|---|---|
| openai | an empty session id wrote an unreachable name entry | fixed, `667ec17701` (test › a named spawn with an empty session id writes no register entry) |
| openai, anthropic | an index entry was rewritten in place, so a reader could see it empty | fixed, `667ec17701`: temp file plus rename |
| openai | a registry `false` overridden by the live probe was reported as `registry` | fixed, `667ec17701` |
| anthropic | `payload_fields` names are not checked against real body keys | left: a misspelt name narrows further, never widens; noted |
| anthropic | a crash between the ledger line and the index write loses one index entry | left: the guard then classifies the send `message_or_resume`, the safe reading |
| anthropic | `git rev-parse` over 2 s yields `head: null` | left: null makes the reconstructed verdict an incomplete join, never a resume |
| openai | the compiled manifest and the Release 103 comparison were reported, not shown | left: `check_generator_sync` and the pinned digest test carry them in CI |

## Conditions carried, non-blocking

- **`rate_limit` is still unobserved live**; the host-rate marker's spelling assumption stands
  unverified until a real plan-limit `StopFailure` is seen.
- **The `worker_resume` live probe has two effects under one flag** (anthropic): setting the
  agent-teams variable also enables the reuse precondition and the state stamps. Both are
  digested and advisory; release notes should say so.

## Seat answers

The raw responses are gitignored and pruned after the retention window, so each is pinned here
by its SHA-256; a kept copy reproduces the digest or it is not the answer the verdict rests on.

| Round | Response file (`agents/runtime/council/responses/`) | SHA-256 |
|---|---|---|
| 1 | `subagent-system-2583-rest-ratification-r1-20261022.md` | `11cb7e60736a8f66d1c045e18dce7e2dea6c227f33f743f7d0e83173283f2d4f` |
