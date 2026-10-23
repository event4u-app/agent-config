---
proposed_by: roadmaps of PR #2583 (road-to-a-cold-start-paid-once, road-to-one-detector-and-the-senders-we-own, road-to-free-hands-a-paid-head-checks)
implemented_by: claude-opus-5.5 session on feat/subagent-system-2583, with delegated worker sessions
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), rounds 1-3 of 2026-10-22
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: 97978d036ce433a7cc3f381c184c9de46da7adc125e42bb2a407bd8731867054
---

<!-- evidence-type: ratification -->

# Ratification — the gated hook plumbing of feat/subagent-system-2583

`check_kernel_edit_ratified` gates five hook-plumbing files on this branch:
`src/config/hook-bundle-budget.json`, `src/scripts/_lib/egress_rules.ts`,
`src/scripts/hook_manifest.yaml`, its compiled projection
`src/scripts/hook_manifest.json`, and `src/scripts/hooks/egress_stage.ts`. The
`subject:` digest above covers all five, computed with
`./scripts-run src/scripts/ratification_subject --files <the five>`.

## What was ratified

- **`spawn-guard-shadow`** (cold-start 3.3, 4.5): `SendMessage` joins its tools, it reads
  `input` and `result` bodies, and it binds `post_tool_use` on claude and cowork. A completed
  named spawn writes a `subagent_named` line holding the hashed agent id and a session-bound
  digest of the name — never the name, the prompt, the result or the raw id. The shadow line
  gains `rate_window`. Advisory, exit 0 on every path.
- **`host-rate-marker`** (cold-start 4.3): `StopFailure` aliased onto `agent_error` for claude;
  a `rate_limit` failure writes a host-sourced `quota_parked` marker. Record-only.
- **Egress engine chunk ceiling** 28,000 → 32,000 B, with its raise-log entry; the chunk
  measures 30,493 B.
- **Identifier and credential rows** in `egress_rules.ts` (one-detector 2.3, free-hands 1.2),
  with the IBAN country table extended through rounds 5 and 6 of the earlier review.
- **`egressInjection`** contains a throwing engine — constructor or call — and withholds
  visibly (one-detector risk 7).

## How it got here

Rounds 1–6 of the earlier review (2026-10-19 … 2026-10-22) covered the identifier rows; round 6
found the last table defect closed and refused only for missing evidence. This review showed
the full gated diff, the consumer code and the test and gate output in every round. Prompts,
committed verbatim:
`agents/evidence/council/subagent-system-2583-ratification-r1-20261022.question.md`, `-r2-`, `-r3-`.

| Round | Verdict | Blocking finding |
|---|---|---|
| 1 | refused 2/2 | `TokenScope` was constructed outside the guard, so a constructor fault escaped the concern |
| 2 | refused 2/2 | `recordNamedSpawn` wrote the worker name verbatim from model-controlled tool input |
| 3 | ratified 2/2 | — |

Both blocking findings were fixed test-first (`9c2260c940`, `7d1db2e068`), each test seen red
before its fix. CLI subscription transport, $0.

## Conditions carried, non-blocking

Named by the seats as gaps this change does not close:

- **`rate_limit` is unobserved live.** The one forced `StopFailure` carried `server_error`; if the
  host spells the plan-limit class differently, no marker is written and `rate_window` reads
  `clear`. Validate before any enforcing use.
- **The 1 MiB ledger-tail read** can miss a real resume under heavy traffic. The cold-start
  roadmap records that an indexed register or a measured miss rate is owed before the guard
  flips from shadow to blocking.
- **The IBAN table names no registry release**, so a stale row cannot be told from a pinned one.
- **Payload access is enforced by implementation, not by data minimisation**: the hook receives
  full bodies and keeps only digests; a regression test guards that, a projection would not
  need one.
- **Evidence prose drift**: the round-3 prompt quoted the dispatch bundle at 1,548,222 B; the gate
  at that revision read 1,548,460 B (ceiling 1,550,000 B).

## Seat answers

The raw responses are gitignored and pruned after the retention window, so each is pinned here
by its SHA-256; a kept copy reproduces the digest or it is not the answer the verdict rests on.

| Round | Response file (`agents/runtime/council/responses/`) | SHA-256 |
|---|---|---|
| 1 | `subagent-system-2583-ratification-r1-20261022.md` | `47227d8409391c431e188f6ee32d3c6b0a9c1438974706b32747a8636154a720` |
| 2 | `subagent-system-2583-ratification-r2-20261022.md` | `69f2df4746df0e7d168f61213bdaef9acd4a4aaf66ca7fba5b14b1df0f6b499b` |
| 3 | `subagent-system-2583-ratification-r3-20261022.md` | `d85cefd89749e983b52d585ebece98c0661423c5b9a64be36e86f503a408a35e` |
