---
type: "auto"
tier: "2a"
description: "A repository's own playbook outranks a shipped skill for the same task — run its configured steps first, and treat an observed playbook as advisory"
triggers:
  - keyword: "playbook"
  - keyword: "generator"
  - keyword: "scaffold"
  - phrase: "our own generator"
  - phrase: "add a component"
  - phrase: "new package"
  - phrase: "unser generator"
applies_to_user_types:
  - "developer"
  - "maintainer"
# obligation: the precedence question comes due when a task arrives that both a
# playbook and a shipped skill answer — once per task, not per turn or per edit.
enforced_by:
  - "instruction-only: no gate can tell a playbook-first run from a skill-first one — both produce a diff, and which answer was consulted leaves no artefact"
obligation_frequency: "per-task"
# frequency-override: the prose heuristic reads the Iron Law's "when both match a
# task" as a turn-level phrase. It is not: the precedence question is settled once
# per task, and re-deciding it on every turn of the same task would be the churn
# this rule exists to prevent.
routes_to:
  - "skill:playbook-authoring"
workspaces: [engineering]
packs: [engineering-base]
---

# Playbook Precedence

A shipped skill is a generic answer to a generic question. A **playbook** (ADR-244) is *this*
repository's answer to the same question, carrying decisions the repository already made —
file layout, barrel exports, test co-location, naming — that no generic skill can know.
When both match a task, running the generic one produces output that looks right and is
wrong for this repository.

## The Iron Law

```
A MATCHING PLAYBOOK GOES FIRST. THE SHIPPED SKILL COVERS ONLY WHAT IT DOES NOT.
`configured` STEPS ARE RUN. AN `observed` PLAYBOOK IS ADVISORY — READ IT, AND THE
SHIPPED SKILL'S GATES STILL APPLY IN FULL.
NEVER RUN A PLAYBOOK'S COMMAND SILENTLY — PROPOSE IT, THE HUMAN RUNS IT.
NEVER SYNTHESISE A COMMAND A PLAYBOOK DID NOT NAME.
```

## Routing — matched on scope, dispatched on grade

A playbook matches when its `scope` contains the current `scope_root`, or is the literal
`repo`. **The `grade` axis then decides what the match buys:**

| `grade` | What the agent does | Why |
|---|---|---|
| `configured` | run its steps first; the shipped skill covers only the remainder | every step's `invokes` id was resolved in the tree, so the procedure is verified, not inferred |
| `observed` | read it, follow it as advice, keep every shipped-skill gate | at least one id did not resolve — the steps are a hypothesis, and a hypothesis does not get to suspend a gate |

The grade is written by [`playbook-authoring`](../skills/playbook-authoring/SKILL.md), which
refuses to write `configured` for a generator it did not see. That refusal is what makes
this table safe to act on: without it, precedence would be granted on a claim rather than
on evidence.

## When NOT to fire

- **No playbook matches** the task's scope — unchanged behaviour, and the absence is not a
  reason to write one mid-task.
- **The task is not what the playbook covers.** A playbook for adding a component says
  nothing about deleting one; a partial scope match is not a match.
- **The playbook's own § What this playbook does NOT cover** names the current task — it
  ends where it says it ends, which is why that section is mandatory.

## Failure modes

- Running a `configured` command **silently** because the playbook looks authoritative. It
  is still a command the human runs; propose-never-silent-run is unchanged.
- Treating an `observed` playbook as `configured` because its steps read confidently.
- **Synthesising a neighbouring command** — the playbook names `turbo gen component`, the
  agent runs `turbo gen page` because the task mentioned a page. A command the playbook did
  not name has no repository authority behind it.
- Reaching for the shipped skill first *and then* reconciling with the playbook. The
  reconciliation never happens; the generic output is already written.

## Provenance

The precedence shape — prefer a repository's local generator over a general one, and let the
local answer bound the generic one — is taken from an external reference's generator skill.
The source is deliberately not named here: per
[`source-confidentiality`](source-confidentiality.md), a shipped artifact does not carry
derivation attribution to a named external project. The attribution lives with the
maintainer-side record.

## See also

- [`playbook-authoring`](../skills/playbook-authoring/SKILL.md) — writes the playbooks and owns the grade.
- **ADR-244** — the artefact class, its home, and the two deferred generator kinds. Cited by number rather than linked: `docs/` is not projected into a consumer install, so a relative link here resolves in this repository and nowhere else.
- [`agents-md-thin-root`](../skills/agents-md-thin-root/SKILL.md) § Workspace files — the per-workspace pointer list.
- [`standards-from-config`](../skills/standards-from-config/SKILL.md) — the Class-A rule this applies to procedure.

## Honest enforcement — `instruction-only`

Nothing can see which answer was consulted. A playbook-first run and a
skill-first run both produce a diff, and the precedence decision leaves no
artefact a gate could read — so this rule is model-carried, and saying so is
cheaper than a check that would have to guess.
