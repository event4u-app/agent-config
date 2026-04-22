# Self-Improvement Pipeline

Five-stage flow that turns real project experience into reviewed
rule / skill / command / guideline changes. No autonomous self-edits;
every upstream change ships via a human-reviewed PR.

Referenced by `road-to-curated-self-improvement.md`. Consumed by the
existing skills `capture-learnings`, `learning-to-rule-or-skill`,
`skill-improvement-pipeline`, and `upstream-contribute` — each becomes
a stage, not a standalone invocation.

## The five stages

```
Project event ── capture ── classify ── propose ── gate ── upstream
    │              │            │           │         │         │
 (bug,         learning-    scope:     proposal     human    upstream-
  success,     to-rule-or-  project-   doc          review    contribute
  review       skill        vs-        (full        +gate     PR
  pattern)                  package    evidence)    script
```

Each stage has a fixed input and a fixed output so the flow is
resumable and auditable. A stage that cannot produce its output
blocks — it does not hand a half-filled doc to the next stage.

### Stage 1 — Capture

- **Trigger:** a rule-worthy event. Bug pattern repeats, review
  finding recurs, a successful pattern is worth codifying.
  The existing `capture-learnings` rule signals the event.
- **Input:** raw observation (PR link, log line, review comment).
- **Output:** learning note at `agents/learnings/<date>-<slug>.md`
  with frontmatter `source`, `evidence[]` (≥1 link), `stage: captured`.
- **Guardrails:** nothing is written into `.agent-src/` at this stage.
  Learnings live in the consumer repo until promoted.

### Stage 2 — Classify

- **Trigger:** explicit invocation or pipeline progression.
- **Input:** learning note from Stage 1.
- **Output:** same file, frontmatter extended with:
  - `scope: project | package`
  - `type: rule | skill | command | guideline`
  - `stage: classified`
- **Guardrails:** classification is reversible. A `package`-scoped
  learning with single-repo evidence is auto-demoted to `project`
  at the gate.

### Stage 3 — Propose

- **Trigger:** classified learning enters the drafter.
- **Executor:** `learning-to-rule-or-skill` skill drafts the artefact
  body; `skill-improvement-pipeline` refines it.
- **Input:** classified learning + any referenced existing artefact.
- **Output:** proposal doc at
  `agents/proposals/<proposal_id>.md` following
  [`proposal.example.md`](../../templates/agents/proposal.example.md).
  Frontmatter `stage: proposed`.
- **Guardrails:** the draft body and the proposal doc are a single
  file. An artefact draft without its proposal wrapper is rejected.

### Stage 4 — Gate

- **Trigger:** proposal doc committed or staged.
- **Executor:** `scripts/check_proposal.py`.
- **Input:** proposal doc from Stage 3.
- **Output:** verdict recorded in the proposal doc section 9
  (`pass | request changes | block`). Frontmatter `stage: gated`
  only after a `pass`.
- **Gate checks (all must pass):**
  1. At least **2 independent evidence** entries (distinct PRs,
     issues, or incidents).
  2. `skill_linter` zero errors on the draft body.
  3. `check_portability` zero violations (no project identifiers
     on `package`-scoped proposals).
  4. `check_references` resolves every link.
  5. `size-enforcement` within the budget for the artefact type.
  6. `preservation-guard` justifies any replacement (section 6 of
     the proposal doc).
- **Guardrails:** the gate is not a rubber stamp. A `block` verdict
  stays in the proposal as history; the pipeline restarts at
  Stage 3 if the author wants to revise.

### Stage 5 — Upstream

- **Trigger:** gate passed AND a human approver signed off.
- **Executor:** `upstream-contribute` skill. Refuses invocation if
  the proposal frontmatter is not `stage: gated`.
- **Input:** gated proposal doc.
- **Output:** PR against `event4u/agent-config` carrying the
  proposal doc as the PR body. Standard package CI runs.
  Frontmatter `stage: upstream` and `upstream_pr_url` set.
- **Guardrails:** no `upstream-contribute` invocation ever edits
  `.agent-src.uncompressed/` in the consumer repo. Writes happen
  in the fork / PR branch of the package repo only.

## Stage ownership

| Stage | Human role | Automation |
|---|---|---|
| 1 Capture | Any contributor | `capture-learnings` rule auto-triggers |
| 2 Classify | Drafter | `learning-to-rule-or-skill` suggests |
| 3 Propose | Drafter + reviewer | `skill-improvement-pipeline` refines |
| 4 Gate | Gate script | fully automated, block is final |
| 5 Upstream | Approver | `upstream-contribute` opens the PR |

## When to skip stages

- **Typo / wording fix** — direct PR, no proposal needed. Pipeline
  is for behaviour-changing proposals.
- **Documentation-only fix** — direct PR.
- **Adding a missing example** — direct PR if the rule semantics
  do not change.

When in doubt, run the pipeline. Overhead is bounded; churn from
unreviewed upstream changes is not.

## Anti-patterns

- **Do NOT** open an upstream PR without a proposal doc. Reviewers
  need the evidence in one place.
- **Do NOT** promote a learning with one piece of evidence. Two
  independent sources is the minimum; the gate enforces it.
- **Do NOT** edit `.agent-src.uncompressed/` directly in a consumer
  project "just to try it out". Drafts live in `agents/proposals/`.
- **Do NOT** treat a `block` verdict as a personal rejection. The
  gate checks structural shape, not author intent.

## See also

- [`road-to-curated-self-improvement.md`](../../../agents/roadmaps/road-to-curated-self-improvement.md) — roadmap this guideline implements
- [`proposal.example.md`](../../templates/agents/proposal.example.md) — the template every proposal derives from
- [`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md) — Understand → Research → Draft sequence used inside Stage 3
- [`preservation-guard`](../../rules/preservation-guard.md) — invoked by the gate to check replacement proposals
