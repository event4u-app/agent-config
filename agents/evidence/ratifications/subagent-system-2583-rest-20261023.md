---
proposed_by: road-to-a-tick-the-shipped-path-earns 1.4 (the raise_log entry of the egress_engine chunk)
implemented_by: claude-opus-5.5 session on feat/subagent-system-2583-rest
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 3 of 2026-10-23
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: 5e35246af7f65cafe9fe55a9f987a3108e671a8bc673d570e1f20b659b0ce9c2
---

<!-- evidence-type: ratification -->

# Ratification — the raise_log correction in the hook bundle budget

`check_kernel_edit_ratified` gates five hook-plumbing files on this branch:
`src/config/hook-bundle-budget.json`, `src/scripts/_lib/egress_rules.ts`,
`src/scripts/hook_manifest.yaml`, its compiled projection `src/scripts/hook_manifest.json`, and
`src/scripts/hooks/dispatch_hook.ts`. The `subject:` digest covers all five, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`.
The last four are unchanged since `subagent-system-2583-rest-20261022.md`.

## What was ratified

A text-only correction inside the `egress_engine` chunk's 2026-10-22 `raise_log` entry: neither
`what_was_added` nor `why_it_could_not_be_avoided` names the invisible-character normalisation of
one-detector 2.5 any more, because `egress_engine.ts` does not import `egress_normalize.ts`. No
ceiling, byte figure or other field changed.

## How it got here

Two rounds over the same correction, CLI subscription transport, USD 0.00. Prompts committed
verbatim: `agents/evidence/council/subagent-system-2583-rest-ratification-r2-20261023.question.md`
and `…-r3-20261023.question.md`.

- **Round 2, split:** anthropic ratified; openai did not, because `why_it_could_not_be_avoided`
  still named the normalisation. Fixed in the next commit.
- **Round 3, both seats ratified,** with no further finding.

## Seat answers

The raw responses are gitignored and pruned after the retention window, so each is pinned here
by its SHA-256.

| Round | Response file (`agents/runtime/council/responses/`) | SHA-256 |
|---|---|---|
| 2 | `subagent-system-2583-rest-ratification-r2-20261023.md` | `dd76dfca5ee4a70e6b52c5def9f78d85f5cbef70dc68c138ada9540f9fec9b57` |
| 3 | `subagent-system-2583-rest-ratification-r3-20261023.md` | `779c0d4b7bf52abad7ef4de0f19ed5686aeb903d58595de0882f004cc5bf211e` |
