---
name: council
tier: 1
description: Council orchestrator — routes to default, pr, design, optimize, analysis, debate
cluster: council
type: orchestrator
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "external second opinion, cross-AI review, devil's advocate on a plan/roadmap/diff, council on PR/design/optimize, polling another model"
  trigger_context: "user wants an outside critique on an artefact (roadmap, diff, prompt, files, PR, design doc, optimization target) without polluting the reviewer with the host agent's framing"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# /council

Top-level orchestrator for the `/council` family. Replaces 4 standalone
commands with a single entry point + sub-command dispatch. Each lens
shares the same transport, neutrality preamble, and cost gate; the
sub-command swaps the mode-specific addendum.

## Architecture — master / wrapper split

`/council default` is the **master orchestrator**. It owns the full flow:

1. Resolve the target + capture the original ask.
2. Check the council is configured + price table fresh.
3. Cost confirmation (ALWAYS ASK for billable members).
4. Run the CLI.
5. Render the report (5 / 5a / 5b — render → critical lens → user options).
6. Hard floor — text only.

The other three sub-commands (`pr`, `design`, `optimize`) are **wrappers**.
Each wrapper resolves its lens-specific input (PR target, design artefact,
optimization target + metric), captures a wrapper-specific `original_ask`,
then delegates to `/council default` with `mode_override=<lens>`. The
lens-specific neutrality addendums live in **one** place —
[`scripts/ai_council/prompts.py:_MODE_TABLE`](../../scripts/ai_council/prompts.py) —
and are selected by the `mode_override` value. Wrappers never re-implement
cost-gate, CLI invocation, render, or the host-verdict pass; those flow
through the master verbatim.

Invariants:

- Wrapper step numbers (`cost gate from /council default Step 3`,
  `render via Step 5/5a/5b of /council default`) anchor to the master, not
  the wrapper, so the master is the single source of truth for flow shape.
- A new lens = a new entry in `_MODE_TABLE` + a new wrapper file that
  follows the `pr.md` / `design.md` / `optimize.md` shape. No new master.
- Behavioural changes to the orchestration (e.g. new render step) land in
  `default.md` + `_MODE_TABLE`; the wrappers inherit automatically.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/council default` | `commands/council/default.md` | Generic neutral lens — prompt, roadmap, diff, or files |
| `/council pr` | `commands/council/pr.md` | Pull a GitHub PR via `gh` and run the council on the diff with PR-specific framing |
| `/council design` | `commands/council/design.md` | Run the council on a design doc / ADR / architecture proposal |
| `/council optimize` | `commands/council/optimize.md` | Run the council on an optimization target — ranked, evidence-based suggestions |
| `/council analysis` | `commands/council/analysis.md` | Run the council on a local analysis output — dedup, evidence quality, roadmap-ready Top-N |
| `/council debate` | `commands/council/debate.md` | Multi-round debate with progressive cost disclosure — initial positions + rebuttals across N rounds |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Advisor mode (replace-mode personas)

Any sub-command above can run in **advisor mode** by enabling one or
more advisors in `agents/.ai-council.yml` under `advisors:` (Contrarian,
First-Principles, Expansionist, Outsider, Executor). An enabled advisor
swaps its bound member's plain call for the same provider running the
advisor persona — **same call count, same budget**. `council:estimate`
surfaces every active swap on a dedicated line. Full contract: skills
`ai-council` § "Thinking-style advisors" and
[`docs/contracts/ai-council-config.md`](../../docs/contracts/ai-council-config.md).

## Dispatch

1. Parse the user's argument: `/council <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. default — neutral lens on a prompt / roadmap / diff / files
   > 2. pr — review a GitHub PR (read-only by default)
   > 3. design — review a design doc / ADR / architecture proposal
   > 4. optimize — ranked, evidence-based optimization advice
   > 5. analysis — critique a local analysis output (project-analyze, audits)
   > 6. debate — multi-round rebuttals with progressive cost disclosure

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it. The PR sub-command can post **one** comment per
  invocation, opt-in only.
- **Do NOT chain sub-commands.** One `/council <sub>` per turn.
- **Hard floor — text only.** `/council` produces text and (under
  `pr` with explicit opt-in) one PR comment. It does NOT edit files,
  approve / merge PRs, or run optimizations.
- If the user invokes `/council` with no argument, **show the menu** —
  do not guess which sub-command they meant.
