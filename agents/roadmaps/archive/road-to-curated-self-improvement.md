# Roadmap: Curated Self-Improvement — closed-loop learning with a human gate

> Make the package improve itself from **real project experience**,
> through a structured proposal → review → gate → upstream loop.
> Never allow unreviewed self-mutation.

## Prerequisites

- [x] [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) master frame adopted
- [x] `learning-to-rule-or-skill` skill exists — captures a learning as a rule/skill draft
- [x] `skill-improvement-pipeline` skill exists — runs drafts through validation
- [x] `upstream-contribute` skill exists — contributes drafts from consumer projects back to the package
- [x] `preservation-guard`, `augment-portability`, `size-enforcement` rules active — gates against drift and bloat

## Vision

Today three skills cover parts of the loop — capture, refine, contribute
— but they are invoked ad hoc, produce unstructured PRs, and have no
shared proposal schema. This roadmap ties them into a **single curated
pipeline** with explicit stages, a governance gate, and a success
signal that feeds back into the evals.

The goal is *organizational engineering memory that grows*, not *an
agent that edits its own rules*.

## Non-goals (explicit)

- **No** autonomous rule changes. Every upstream change is a PR reviewed
  by a human; the agent drafts, the human decides.
- **No** consumer-project drift flowing silently into the package. Every
  proposal must carry evidence and pass the portability check.
- **No** replacement of `learning-to-rule-or-skill`, `skill-improvement-pipeline`,
  or `upstream-contribute`. They become stages of a pipeline, not
  standalone invocations.
- **No** measurement that pretends outcome attribution is solved.
  Success signals are heuristics (per Q2 in the master frame).

## The pipeline

```
Project event ── capture ── classify ── propose ── gate ── upstream
    │              │            │           │         │         │
 (bug,         learning-    scope:     structured   human    upstream-
  success,     to-rule-or-  project-   proposal     review    contribute
  review       skill        vs-                     +gate     PR
  pattern)                  package
```

Each stage has a fixed output so the pipeline is resumable and auditable.

### Stage 1 — Capture

**Trigger:** a rule-worthy event (bug pattern repeated, review finding
recurs, successful pattern worth codifying). Invoked by the `capture-learnings`
rule already active.

**Output:** learning note in `agents/learnings/{date}-{slug}.md` with
frontmatter `source`, `evidence` (links), `stage: captured`.

### Stage 2 — Classify

**Trigger:** an accumulated learning note.

**Output:** decision `scope: project | package`.
- `project`: stays in the consumer's memory layer (see [`road-to-engineering-memory.md`](road-to-engineering-memory.md))
- `package`: advances to Stage 3

Classification uses a fixed checklist: is the pattern language-agnostic?
applicable to ≥2 project types? free of project names/domains?

### Stage 3 — Propose

**Trigger:** a learning classified as `scope: package`.

**Output:** a **proposal document** in the consumer project's
`agents/proposals/{id}.md` following a fixed template:
`problem`, `evidence`, `proposed artefact`, `artefact type`
(rule / skill / guideline / command), `draft`, `portability check`,
`acceptance criteria`.

Draft uses `learning-to-rule-or-skill` + `skill-improvement-pipeline`
as today, but the output lands in the proposal doc — not yet in the
package.

### Stage 4 — Gate

**Trigger:** proposal is ready for review.

**Gate checks** (run by a new `scripts/check_proposal.py`, executed in
the consumer repo before the upstream PR opens):
- Proposal template complete (all required fields)
- Portability: no project names, domains, stack references
- Size: within `size-enforcement` budget for the declared artefact type
- Evidence: at least one concrete example link
- Non-overlap: no existing skill/rule covers the same trigger (fuzzy match)

Failures block Stage 5. A human can override with a justification note.

### Stage 5 — Upstream

**Trigger:** gate passed and human sign-off.

**Output:** PR into `event4u/agent-config` created by `upstream-contribute`,
carrying the proposal doc as the PR body. Standard package CI
(`skill-linter`, `check-portability`, `check-refs`) must pass.

## Phases

### Phase 1 — proposal template + gate

- [x] New proposal template under `templates/agents/` (name: `proposal`) *(2026-04-22: [`proposal.example.md`](../../.agent-src.uncompressed/templates/agents/proposal.example.md))*
- [x] `scripts/check_proposal.py` implementing the Stage 4 checks *(2026-04-22: [`scripts/check_proposal.py`](../../scripts/check_proposal.py) — frontmatter + sections + evidence-count + no-TODO markers + success-signal checks; verdict PASS/BLOCK; exit 1 on block)*
- [x] New agent-infra guideline `self-improvement-pipeline` documenting the five stages *(2026-04-22: [`self-improvement-pipeline.md`](../../docs/guidelines/agent-infra/self-improvement-pipeline.md))*

### Phase 2 — wire existing skills into stages

- [x] `capture-learnings` rule writes to `agents/learnings/` *(2026-04-22: [`capture-learnings`](../../.agent-src.uncompressed/rules/capture-learnings.md#where-learnings-are-written) gained a "Where learnings are written" section — `agents/learnings/<YYYY-MM-DD>-<kebab-slug>.md`, frontmatter schema, consumer-owned directory)*
- [x] `learning-to-rule-or-skill` skill consumes a learning note and emits a proposal doc draft *(2026-04-22: [step 8 "Write the proposal"](../../.agent-src.uncompressed/skills/learning-to-rule-or-skill/SKILL.md) — output is `agents/proposals/<id>.md` matching `proposal.example.md`; mandatory fields enumerated; `check_proposal.py` is the hard gate before handoff to `upstream-contribute`)*
- [x] `upstream-contribute` skill refuses to open a PR unless the proposal doc passes `check_proposal.py` *(2026-04-22: [step 6b in `upstream-contribute`](../../.agent-src.uncompressed/skills/upstream-contribute/SKILL.md) runs `check_proposal.py` when `agents/proposals/{slug}.md` exists; non-zero exit → hard refusal, no branch/PR)*

### Phase 3 — success signal

- [x] Merged upstream proposals are tagged with the originating
  project (metadata only, no identifiers in the package) *(2026-04-22: [`check_proposal.py`](../../scripts/check_proposal.py) enforces `Originating project: <slug>` in Section 10 once `stage: upstream` — empty or `<placeholder>` slot blocks the gate; template placeholder in [`proposal.example.md`](../../.agent-src.uncompressed/templates/agents/proposal.example.md))*
- [x] Tag feeds Q2 outcome measurement (per master frame) *(2026-04-22: [`memory_report.py --quarterly`](../../scripts/memory_report.py) buckets entries into ISO quarters using `created`/`superseded_at`; output consumed by the weekly drift workflow)*
- [x] Retired proposals (rule/skill removed later) are linked from
  the original proposal for learning *(2026-04-22: Section 10 of [`proposal.example.md`](../../.agent-src.uncompressed/templates/agents/proposal.example.md) documents the `Retired:` / `Superseded-by:` link; retirement PRs update the original proposal in-place — no new file)*

### Phase 4 — drift prevention

- [x] Weekly CI job in the package repo: list proposals accepted in the
  last quarter vs. rules/skills retired. Flag imbalance. *(2026-04-22: [`proposal-drift.yml`](../../.agent-src.uncompressed/templates/github-workflows/proposal-drift.yml) — Monday 07:00 UTC, quarterly counts from `memory_report.py`, open proposals by stage, opens/updates a single `proposal-drift` tracking issue; never blocks a PR)*
- [x] Proposal rate per consumer project capped — soft limit surfaces
  in `check_proposal.py` to prevent one project over-fitting the package *(2026-04-22: [`_proposal_rate_warning`](../../scripts/check_proposal.py) in `check_proposal.py` — warns when ≥6 proposals authored in the last 90 days in the same directory; warning only, never blocks)*

## Integration with existing artefacts

- **`learning-to-rule-or-skill`** — becomes Stage 3 drafter; output format changes to proposal template
- **`skill-improvement-pipeline`** — becomes Stage 3 refiner, runs inside the proposal doc
- **`upstream-contribute`** — becomes Stage 5 only; refuses earlier stages
- **`preservation-guard`** — gate uses it to block proposals that would replace existing artefacts without justification

## Open questions

- **Reverse flow:** how does a retired package artefact flow back into
  consumer projects that depended on it? Deferred — probably a
  migration note in the retirement PR.
- **Evidence quality:** one link is the minimum, but not the bar. A
  future heuristic may require ≥2 independent projects before a
  proposal reaches Stage 4.
- **Attribution:** should consumer projects get credit in the changelog?
  Yes, but only with explicit opt-in per project.

## Acceptance criteria

Phase 1 is shipped when: the proposal template exists, the gate
script passes its own tests, the guideline documents all five stages,
and one real learning from this repo's own history is walked through
the pipeline as a worked example.

## See also

- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame
- [`road-to-engineering-memory.md`](road-to-engineering-memory.md) — project memory (what stays local, what flows upstream)
- [`road-to-role-modes.md`](road-to-role-modes.md) — role contracts that produce capture-ready outputs
- [`road-to-stronger-skills.md`](road-to-stronger-skills.md) — quality bar proposals must meet
