---
adr: 285
status: accepted
date: 2026-10-15
decision: one-dispatcher-stage-is-the-only-rewriter
supersedes: —
superseded_by: —
phase: road-to-placeholders-on-the-wire · Phase 1 (step 1.1)
type: structural
reopen_policy: unclassified
protected_dimensions: [none]
review_trigger: >-
  Reopened when a concern needs to change a tool input, a tool result or a
  prompt for a reason the egress stage cannot carry — a second transformation
  with its own rule set, not a second egress class — or when a host is found to
  apply two rewrite fields from one hook reply in an order this record does not
  predict. Also reopened if `rewrite-concern-refused` in `lint_hook_manifest`
  is removed or stops failing its own test, because then the rule below is
  prose with nothing behind it. Not reopened by the stage growing new classes:
  that is the stage's own work, not a second writer.
provenance:
  kind: agentic
  decision_makers: [agent]
  human_directed: true
  agentic_mode: single
evidence:
  strength: E1
  basis:
    - docs/contracts/egress-placeholders-v1.md
    - docs/contracts/hook-architecture-v1.md
    - agents/evidence/analysis/host-input-rewrite-probe-2026-08-23.md
    - src/scripts/hooks/rtk_wrap_hook.ts
    - tests/scripts/lint_hook_manifest.test.ts
---

# ADR-285 — One dispatcher stage is the only rewriter

## Context

A host hook can replace a tool input (`updatedInput`, probed on Claude Code
2.1.241) and, on the same host, a tool result. This dispatcher emits neither.
`docs/contracts/hook-architecture-v1.md` records the rewrite half of composition
as open: many concerns run per event and reduce to one exit code, and nothing
says what happens when two of them want to rewrite the same input.

On 2026-08-23 the AI council (2/2) kept `rtk_wrap_hook` advisory and recorded a
rewrite as rejected for now, on two named grounds, with a reopening condition:

1. **No composition rule.** Two concerns rewriting one input have no answer.
2. **A hook that silently changes what runs.** A default-off hook that rewrites
   a command is a different safety posture from one that warns.

`road-to-placeholders-on-the-wire` needs a rewrite: tool results carrying a
listed value reach the model as a placeholder token
(`docs/contracts/egress-placeholders-v1.md`), and a token in a tool input comes
back as its value at the one restore point. Neither works without first
answering the two grounds above.

## Decision

The question is removed rather than answered: **no concern may produce a
rewrite.**

- A rewrite — of a prompt, a tool input or a tool result — is produced by one
  dispatcher-owned stage, the egress stage. It runs before the concern loop
  (building the views concerns receive) and at emission (building what goes back
  to the host). It is the only code that writes a rewrite field.
- A concern that declares a rewrite, or whose script names a host rewrite field,
  fails `lint_hook_manifest` with `rewrite-concern-refused`. The dispatcher
  forwards no rewrite key from a concern reply, so a concern that emits one
  anyway changes nothing.
- **A block outranks a rewrite.** When the reduced verdict is a block, the stage
  emits no rewrite: the call does not run, so there is nothing to rewrite.
- **An `ask` or a `deny` outranks an `allow`**, unchanged
  (`composePermissionDecision`). A restored input never travels with an allow
  that a confirmation would have stopped, and a restore never grants a call.

**Answer to ground 1.** One writer has nothing to compose with. Two transforms
of one input are two passes of the same stage over the same rule table, and the
table already resolves overlapping spans (the more sensitive class wins, then a
validated span, then the longer one).

**Answer to ground 2.** The stage never changes what the agent decided to run.
It replaces a value the model never needed to see with a token, and at the one
restore point turns the model's token back into the value the model was shown
as that token. Every restore of an identifier into a call that is not a
consequence-free local read, build or file write composes to `ask` and shows
the restored input (D4 of the roadmap), and a credential token restores into one
place only. Until Phase 3 of the roadmap the stage emits nothing to the host at
all: Phase 1 builds views and counts, and `observe` mode changes no view.

## Consequences

- `rtk_wrap_hook` stays a warning. A command-rewriting nudge would be a second
  transformation with its own rule set, which is this record's reopening
  condition, not something it authorises.
- Any future need to rewrite for a non-egress reason is a change to this record,
  not a new concern.
- The stage's own correctness carries the whole rewrite surface, so it is
  governed like a concern: an admission row, a kill switch, a settings block
  (step 1.4 of the roadmap).

## Alternatives considered

- **Last writer wins, in manifest order.** Rejected: a reorder of the manifest
  silently changes what runs, which is ground 2 in another form.
- **Concerns rewrite, the dispatcher merges by field.** Rejected: two concerns
  editing one string have no merge, and the merge rule would be the composition
  answer ground 1 says is missing.
- **Keep rewrites out entirely.** Rejected for egress: the alternative to a
  placeholder on a tool result is a raw value at the provider, which is the
  threat `docs/threat-model.md` row j names.

## Not reopened

The permission-composition answer (`one ask or deny beats every allow`) is
unchanged and is cited, not re-decided.
