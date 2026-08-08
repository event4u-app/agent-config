# Do skill descriptions reach the model? — the census's own falsifier, run

> **Produced by:** P2.1 of `road-to-rule-delivery-integrity`.
> **Observed:** 2026-08-08 · Claude Code `2.1.226` · repo `9.27.0`.
> **What it closes:** the `NOT MEASURED` clause `report_skill_activation` prints
> about itself — *"whether each skill reached the model WITH its description. The
> host's injected catalogue is not persisted in the transcript, so the bare-name
> hypothesis is a single-session observation."*

## The two candidate causes, and which one this rules out

The census reports 288 skills shipped, 0 with a machine-matchable trigger key, 12
invocations across 30 sessions, 4 distinct skills. If selection is that low, the
description is the only routing surface — so either

- **(A) the projection is missing descriptions**, i.e. our own artifact defect, or
- **(B) the descriptions exist but the host's injected catalogue omits them**,
  i.e. a delivery defect our projection cannot fix.

## Result — (A) is refuted

**Measured, deterministic, reproducible:** every installed skill carries a
`description:` in its frontmatter.

| Corpus | Entries | With `description:` | Without |
|---|---|---|---|
| `.claude/skills/*/SKILL.md` | **414** | **414** | **0** |

(414 rather than 288 because the projection also wraps commands as skills.)

**Observed, first-party, this session:** the injected catalogue this session
received is **mixed** — some entries carry their description, a substantial
majority arrive as bare names. Sampled against disk:

| Catalogue entry | Arrived with a description? | Has one on disk? |
|---|---|---|
| `accessibility-auditor` | yes | yes |
| `context-document` | yes | yes |
| `mcp` | yes | yes |
| `comp-banding` | **no** | yes |
| `composer-packages` | **no** | yes |
| `condense-memory` | **no** | yes |
| `contract-review` | **no** | yes |
| `dcf-modeling` | **no** | yes |

Five of eight sampled entries reached the model without a description that exists
on disk. **So the loss is host-side.** Hypothesis (A) — our projection is
incomplete — is refuted by the 414/414 count; (B) stands.

## Scope and honesty about this result

- **The 414/414 count is a measurement.** Re-runnable, deterministic, no
  interpretation.
- **The catalogue side is a single-session observation, and stays one.** The
  injected catalogue is not persisted anywhere the repo can read, so the sampled
  table is evidence, not a rate. No total "N of 414 arrived bare" figure is
  claimed here, because producing one by counting entries out of a context window
  by hand is exactly the kind of unverifiable number this repo has been burned by.
- **A hook cannot close this further.** A `pre_tool_use` / `user_prompt_submit`
  hook never receives the system prompt or the injected catalogue; it sees the
  prompt and the tool call. The host's `InstructionsLoaded` hook logs *instruction
  files* (CLAUDE.md, `.claude/rules/`), which is a different surface — useful for
  P1.2, useless here. So the mechanism P2.1 originally proposed ("log the
  injected catalogue once per session") has **no available implementation**; what
  closed the question was reading the catalogue that arrived and comparing it to
  disk.

## Consequence — this changes P3.2's `skill` disposition

`road-to-rule-delivery-integrity` P3.2 offers three dispositions for a
keyword-only rule: `digest`, `skill`, `drop`. The `skill` disposition moves a
rule body behind a skill description and relies on description-based activation
to bring it back.

That surface **demonstrably does not always deliver the description**. Moving an
obligation there is therefore not a neutral relocation — it can silently convert
an always-loaded rule into an unreachable one. Two consequences, both now binding
in the roadmap:

1. `digest` is the default disposition for anything load-bearing.
2. A `skill` disposition needs a named reason per row, and never for an
   obligation whose loss is silent (a safety floor, an authority gate).

## What would upgrade this from observation to rate

A host-side change, not one this repo can make: the catalogue would have to be
persisted (an `InstructionsLoaded`-style event for the skill catalogue, or a
`/context`-style dump the session can write out). Until then the honest position
is: descriptions are complete on disk, delivery is lossy, and the size of the
loss is unmeasured.
