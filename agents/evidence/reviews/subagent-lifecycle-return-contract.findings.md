# Completion review — the subagent return-channel contract addendum

**Skipped:** no code surface for this completion — the diff is two context contracts, one roadmap file, one evidence file and the two generated projections, and the gate itself measures zero code paths of seven changed files, scope 11858534bc8a963a1581019a5e547e179551a60d1e51e8fb95db49084a3b6e1b, declared 2026-08-18

## Why a skip rather than a review

The change adds rule (f) to the spawn contract and a `Durable copy` section to
the response contract, closes Phase 2 Step 1 of
`road-to-subagent-lifecycle-integrity`, and appends a dated numbering correction
to the Phase 0 evidence file. It ships no executable surface: no script, no hook,
no manifest entry, no config key, no test, no frontmatter field.
`check_completion_review` classifies the diff as zero code paths of seven
changed files, which is the condition this declaration covers.

Deliberately so, and the addendum says it in its own text: the clause is
prompt-carried, therefore unenforced, and the `subagent_stop` concern that would
read the disk copy when a message is empty is named as planned and not shipped.
A skip here is not a gap in coverage — a code review has nothing to read.

## What replaces it — the verification behind the content

- **The premise is a measurement, not a doc claim.** Phase 0 Step 3 reproduced
  the failure on host 2.1.229 with a matched control dispatched in the same
  turn: the treatment arm returned `(no output)` after 3 tool uses and 18,242
  tokens, the control ending on assistant text returned the full report. Both
  numbers are read from
  `agents/evidence/investigations/subagent-lifecycle-phase0-return-channel.md`
  § F1, and the ledger records in § F2 pin the two arms by duration.
- **The clause did not already exist.** `grep -rn "never end on a tool
  call\|text-only\|tool_use block" src/ docs/` returned five hits, none of them
  about a subagent return shape (a roadmap-routing row, a council comment, a
  turn-end-gate code comment, a design-capture example, a command-cluster line).
- **The section anchor resolves.** `check_references` scanned 1328 references
  with no breakage, which covers the new
  `subagent-response-contract.md#durable-copy--the-envelope-on-disk-before-the-message`
  link and the two relative paths into `agents/evidence/investigations/`.
- **No inbound citation needed updating.** `skill:subagent-orchestration` cites
  the spawn contract by section name (`§ Worker-prompt rules`), not by
  enumerating (a) through (e), so adding (f) leaves every pointer valid. The
  same grep found the other citers to be `verify-budget`, `subagent-steering`,
  `auto-orchestration-v1` and ADR-105, all section-level or whole-file.
- **The projection is regenerated, not hand-edited.** `task sync` reports every
  `.md` projection matching its source, then `task generate-tools`, then
  `./agent-config roadmap:progress` — in that order, because the dashboard
  generator runs the dist copy and would otherwise publish pre-edit output.
- `task preflight` exits 0, including `lint_regression` (no regressions),
  `skill_linter --changed`, the safety-floor guard (4 rule files guarded, none
  touched) and the kernel-rule bundle check (no kernel rule touched).

## What this change deliberately does not do

- **It does not wire `validateResponse`.** That function still has zero runtime
  consumers (V2 of the roadmap) and wiring it is Phase 2 Step 2, which is gated
  on a verdict split that needs the Phase-1 baseline.
- **It does not implement the disk write.** `response-envelope.json` is a fixed
  filename so the durable channel is findable rather than nominal; nothing in
  the tree writes, reads, or validates it, and both contract sections say so in
  the same paragraph that introduces it.
- **It does not close Phase 2.** Steps 2 and 3 stay open and stay gated.

## Standing caveat

A skip declaration is a statement about the diff surface, not a claim that the
prose is correct. Every claim above names the command, file, or section that
decides it, so a later reader can refute a row without trusting this artefact.
