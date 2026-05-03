---
name: council
description: Council orchestrator — routes to default, pr, design, optimize
cluster: council
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "external second opinion, cross-AI review, devil's advocate on a plan/roadmap/diff, council on PR/design/optimize, polling another model"
  trigger_context: "user wants an outside critique on an artefact (roadmap, diff, prompt, files, PR, design doc, optimization target) without polluting the reviewer with the host agent's framing"
---

# /council

Top-level orchestrator for the `/council` family. Replaces 4 standalone
commands with a single entry point + sub-command dispatch. Each lens
shares the same transport, neutrality preamble, and cost gate; the
sub-command swaps the mode-specific addendum.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/council default` | `council-default.md` | Generic neutral lens — prompt, roadmap, diff, or files |
| `/council pr` | `council-pr.md` | Pull a GitHub PR via `gh` and run the council on the diff with PR-specific framing |
| `/council design` | `council-design.md` | Run the council on a design doc / ADR / architecture proposal |
| `/council optimize` | `council-optimize.md` | Run the council on an optimization target — ranked, evidence-based suggestions |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

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

## Migration

The 3 standalone `/council-*` commands continue to work for one release
cycle as deprecation shims. They emit a notice and route to the same
content. New invocations should use `/council <sub>`. The
previously-bare `/council` (default lens) is now `/council default`;
bare `/council` invocations show the menu.

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
