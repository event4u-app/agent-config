---
model_tier: medium
name: fix-route
pack: engineering-base
tier: 2
visibility: internal
sub: route
cluster: fix
description: Classify a vaguely-described problem and dispatch to the right fix sub-command (or name the specialist skill when it is not a fix task)
argument-hint: "[free-text problem description]"
suggestion:
  eligible: false
  trigger_description: "something's broken but I'm not sure which fixer — throw me a problem and route it"
  trigger_context: "user describes a problem without naming a specific fix sub-command"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /fix route

The classify-and-dispatch front door for the `/fix` family. Adapted from the
ecosystem source's `/smart-fix` — folded into the `fix` verb (ADR-041
controlled-verb vocabulary) rather than a new top-level verb. It runs the
`/fix` auto-detection over a free-text problem and routes; when the problem is
not a fix task, it names the right specialist instead of forcing a fix sub.

## Instructions

1. Read the free-text problem.
2. Run the `/fix` cluster's detection table (see the cluster head) over it:
   CI failure → `fix ci`; broken cross-refs → `fix refs`; PR review threads →
   `fix pr-comments`; code-comment noise → `fix comments`; seeder/FK →
   `fix seeder`; type/lint/format errors → `fix quality`; project-leak in the
   shared package → `fix portability`.
3. **HIGH confidence** → route to that sub-command and follow its instructions.
4. **Not a fix task** (a new feature, an analysis, a design question) → do NOT
   force a fix sub; name the correct surface instead (`/feature`, a
   `project-analysis-*` skill, `improve-before-implement`, etc.) and stop.
5. **LOW confidence / ≥ 2 conflict** → print the fix menu and ask; in
   non-interactive mode emit `ambiguous_routing` and stop (per the
   non-interactive-contract). Never guess past LOW.

## Rules

- **Dispatch only — no fixing here.** This sub classifies and hands off; the routed sub-command does the work under its own rules.
- **One route per turn.** Do NOT chain.
- **Do NOT commit or push** — the routed sub-command's rules govern that.
