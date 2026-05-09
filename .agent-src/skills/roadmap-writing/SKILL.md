---
name: roadmap-writing
description: "Use when authoring or rewriting a roadmap in agents/roadmaps/ — phase prose, goal sentence, acceptance criteria, council notes — even when the user just says 'write a plan for X' or 'draft a roadmap'."
source: package
---

<!-- cloud_safe: degrade -->

# roadmap-writing

## When to use

* Authoring a new roadmap file in `agents/roadmaps/{name}.md` (or
  module-scoped under `app/Modules/{Module}/agents/roadmaps/`)
* Rewriting an existing roadmap (phase restructure, goal pivot,
  council-pass integration — not a checkbox flip)
* Drafting a phase block, exit criteria, or rollback section that
  will land inside an existing roadmap

Do NOT use this skill when:

* Flipping checkboxes, regenerating the dashboard, archiving on
  completion → use [`roadmap-management`](../roadmap-management/SKILL.md)
* Updating AGENTS.md / module docs / contexts → use
  [`agent-docs-writing`](../agent-docs-writing/SKILL.md)
* Capturing an architectural decision → use
  [`adr-create`](../adr-create/SKILL.md)

## Roadmap-writing vs roadmap-management — critical test

| Intent | Artifact |
|---|---|
| "I need to write the plan body" | **roadmap-writing** (this skill) |
| "I need to track progress / regenerate dashboard / archive" | **roadmap-management** |

This skill owns the **prose authoring** axis: structure, goal
sentence, phase blocks, acceptance criteria. The execution and
dashboard-sync axis stays in `roadmap-management`.

## Procedure

### 0. Drafting protocol

Authoring or materially rewriting a roadmap must go through
Understand → Research → Draft per the
[`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md)
rule. Inspect existing roadmaps under `agents/roadmaps/` for overlap
or supersession before opening a new one.

### 1. Read the canonical template first

The structure, frontmatter, lifecycle, and complexity-tier rules live
in [`.agent-src.uncompressed/templates/roadmaps.md`](../../templates/roadmaps.md).
Read it before authoring. Do not restate its rules in the roadmap
body — link the template if a phase needs to override one.

### 2. Pick complexity tier honestly

Default `lightweight` (≤ 6 phases, ≤ 600 lines). Only use
`structural` when the change touches a contract, kernel rule, or
budget invariant — the complexity linter enforces it. Standard:
[`roadmap-complexity-standard`](../../../docs/contracts/roadmap-complexity-standard.md).

### 3. Write the goal first

One sentence, top of file, decidable: "Reduce X by Y on flow Z."
Vague goals ("improve roadmaps") force every reader to re-derive
intent. If the goal needs three sentences, the roadmap is two
roadmaps.

### 4. Phase blocks carry checkboxes

Every non-intro phase contains at least one `- [ ]`. Decision tables
and council-pass notes capture the *why*; checkboxes capture the
*what to do next*. Without checkboxes the phase is invisible to
`agents/roadmaps-progress.md` — enforced by
[`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)
Iron Law #2.

### 5. Exit & rollback per phase

Each phase declares **exit criteria** (decidable signals that the
phase is done) and **rollback** (what to revert if the phase fails).
A phase without exit criteria is open-ended; a phase without
rollback assumes success.

## Output format

A single Markdown file at `agents/roadmaps/{name}.md`:

1. Frontmatter (`status`, `complexity`)
2. `# Road to {short title}`
3. One-sentence outcome blockquote
4. `## Goal` — decidable target
5. `## Prerequisites` — checkboxes
6. `## Context` — why now, links to tickets
7. Numbered `## Phase N — {name}` sections with checkboxes,
   exit criteria, rollback
8. `## Acceptance criteria` — final gates

## Frugality Standards

Apply the [Frugality Charter](../../contexts/contracts/frugality-charter.md)
to every roadmap you author.

**Examples in this artifact:**
- Per the charter's default-terse rule, the goal sentence states the
  outcome — no "This roadmap exists because…" ramp-up.
- Per the cite-don't-restate principle, link the canonical template
  for structural rules; do not paste them into the roadmap.
- Per the post-action summary suppression, council-pass integration
  notes append to the existing phase block — no new "Summary of
  council passes" section.
- Per the cheap-question check, never propose a "lightweight vs.
  structural" numbered choice when the diff makes the answer
  decidable.

**Pre-save self-check:**
1. Does the goal sentence open with the outcome, or with backstory?
2. Does any phase block restate template rules instead of linking
   them?
3. Are checkboxes present in every non-intro phase?
4. Are exit criteria decidable, or vibe-based ("looks good")?
5. Is content duplicated from another roadmap (supersession instead)?

## Do NOT

* Author a roadmap without a goal sentence.
* Restate `templates/roadmaps.md` rules inside the roadmap body.
* Include version numbers, target releases, or git tags — banned by
  template rule 13 + [`scope-control`](../../rules/scope-control.md#git-operations--permission-gated).
* Plan automatic branch switches mid-roadmap (template rule 14).
* Ship a phase without checkboxes (`roadmap-progress-sync` Iron Law #2).
* Write merge, push, or commit steps into the roadmap. Roadmaps plan
  **work**; merge / push / commit are delivery decisions owned by the
  user (`commit-policy` Iron Law). A roadmap is "implementation-complete"
  once its checkboxes are ticked and verification has been run — merge
  timing is tracked outside the roadmap.
* Use ALL-CAPS Iron-Law fenced blocks — those belong in
  [`kernel-membership`](../../../docs/contracts/kernel-membership.md)-listed
  rules, not roadmaps.

## Gotchas

- **No checkboxes in a phase** — `agents/roadmaps-progress.md` cannot
  count the phase; the dashboard reports zero open work even though
  the phase has prose. Enforced by `roadmap-progress-sync` Iron Law #2.
- **Vague goal sentence** — "Improve roadmap quality" forces every
  reader to re-derive intent and blocks decidable acceptance.
- **Restating template rules** — pasting structural rules into the
  roadmap body creates two sources of truth that drift over months.
- **Version numbers in phase names** — `Phase 1 — v1.8.0` violates
  template rule 13 and `scope-control § git-operations`.
- **Author-during-execution branch switches** — the agent should not
  propose a new branch mid-roadmap; that decision is fenced to
  authoring time.
- **Merge / commit steps in roadmap body** — checkboxes like
  "merge PR #X" or "commit phase Y" couple roadmap closure to git
  operations the user has not authorized. Roadmap completion is
  decoupled from delivery; ship-the-PR is its own decision.

## Examples

Browse `agents/roadmaps/` (active plate) and `agents/roadmaps/archive/`
(closed work) for canonical structural / tactical / structural-with-council
examples.
