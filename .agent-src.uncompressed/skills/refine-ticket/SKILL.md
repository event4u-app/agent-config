---
name: "refine-ticket"
description: "Refine a Jira/Linear ticket before planning — 'refine ticket', 'tighten AC on PROJ-123', 'ist das Ticket klar?' — rewritten ticket, Top-5 risks, persona voices, sub-skills orchestrated, close-prompt."
personas:
  - developer
  - senior-engineer
  - product-owner
  - stakeholder
  - critical-challenger
  - ai-agent
source: package
execution:
  type: assisted
  handler: internal
  allowed_tools: []
---

# Refine Ticket

> Move a ticket from "raw idea" to "implementation-ready" in one run.
> Produces a rewritten ticket, Top-5 risks, and persona voices.
> Orchestrates `validate-feature-fit` and `threat-modeling` as sub-skills
> — never duplicates their logic. Output is copy-paste ready; the user
> decides write-back.

## When to use

- The user hands over a Jira / Linear ticket key, URL, branch name, or
  pasted ticket text and asks for a sanity check before planning.
- A ticket looks too vague, too broad, or smells wrong.
- Before `/feature-plan` or `/feature-explore` on a ticket-anchored scope.
- The user says "tighten the AC", "poke holes in this ticket",
  "is this ready to plan?", "ist das Ticket klar genug?",
  "verbessere das Ticket".

## When NOT to use (near-misses)

| Phrasing | Route to |
|---|---|
| "plan this feature" | `/feature-plan` (downstream) |
| "estimate this ticket" | `/estimate-ticket` (sibling, Phase 4) |
| "is this a duplicate feature?" | `validate-feature-fit` (sub-skill) |
| "threat-model this change" | `threat-modeling` (sub-skill) |
| "investigate this bug" | `/bug-investigate` (bug-focused) |

`/refine-ticket` **orchestrates** these — it does not replace them.

## Inputs (four equivalent paths)

Reuses the `jira-ticket` command's loader. Accepts:

1. **Ticket key** — `/refine-ticket PROJ-123`
2. **Branch detection** — `/refine-ticket` with no arg; regex
   `[A-Z]+-[0-9]+` against `git branch --show-current`
3. **Pasted text** — `/refine-ticket` followed by a markdown block
4. **URL** — `/refine-ticket https://acme.atlassian.net/browse/PROJ-123`

If none resolve to a ticket, fall back to conversational discovery
(`feature-explore`-style): ask one focused question, then continue.

## Procedure

### 1. Load ticket

Delegate to `jira-ticket` §1-3:
- Extract ticket ID (branch / URL / arg).
- Fetch via Jira API (`GET /issue/{id}`) — summary, description,
  issue type, priority, status, comments, linked issues.
- Scan description + comments for Sentry URLs; pull stacktrace /
  tags when present.

If pasted text: skip API, parse markdown, extract title + AC
bullets + body.

### 2. Inspect ticket + detect orchestration triggers

Check the loaded ticket for clarity signals before orchestrating:
- Does the summary match the description body?
- Are AC bullets concrete (observable / testable) or vague ("works well")?
- Is the scope one feature, or multiple tangled together?
- Any sentence that references an existing module name, feature flag, or domain concept?

Then scan the body for:

| Condition | Sub-skill to fire |
|---|---|
| ≥ 2 existing feature names mentioned (grep `agents/contexts/`, recent module names) | `validate-feature-fit` |
| Keywords `auth`, `webhook`, `upload`, `queue`, `secret`, `tenant`, `admin`, `PII`, `public endpoint`, `billing` | `threat-modeling` |
| Inside a repo (`.git/` present) | Load `agents/contexts/*.md` for domain vocabulary; scan recent branches + commits for naming conventions |
| Outside a repo | Generic lens; skip repo-aware enrichment |

### 3. Orchestrate

Invoke each triggered sub-skill with the ticket as input. **Cite,
don't copy** — the output references findings by sub-skill name and
file:line where applicable. If a sub-skill reports zero findings,
note "fired → clean" in the orchestration section.

### 4. Apply personas

Load the persona set from frontmatter (Core-6 default). Each persona
reviews the ticket through its lens and produces one paragraph:

- **Developer** — implementability, unknowns, test seams
- **Senior Engineer** — architectural fit, blast radius, hidden deps
- **Product Owner** — value, user story integrity, AC completeness
- **Stakeholder** — deadline fit, business impact, comms plan
- **Critical Challenger** — devil's advocate; what's wrong with this?
- **AI Agent** — automation hooks, tool boundaries, clarity for agents

Optional: `--personas=+qa` adds the QA persona (edge cases, regression
risk, test matrix).

### 5. Synthesize + close-prompt

Produce the three-section output (template below). After rendering,
emit the close-prompt (below). Do **not** write to Jira. Do **not**
open a planning doc.

## Output template

Frozen per Q25 (see
[`road-to-ticket-refinement.md`](../../../agents/roadmaps/road-to-ticket-refinement.md)).

````markdown
## Refined ticket

**Title:** <rewritten title>

<rewritten description — tightened AC, explicit out-of-scope,
open questions surfaced>

## Top-5 risks

1. <risk> — <mitigation / deferral>
2. <risk> — <mitigation / deferral>
3. <risk> — <mitigation / deferral>
4. <risk> — <mitigation / deferral>
5. <risk> — <mitigation / deferral>

## Persona voices

- **Developer** — <one paragraph>
- **Senior Engineer** — <one paragraph>
- **Product Owner** — <one paragraph>
- **Stakeholder** — <one paragraph>
- **Critical Challenger** — <one paragraph>
- **AI Agent** — <one paragraph>
- **[qa]** — *(only when `--personas=+qa`)* <one paragraph>

## Orchestration notes

- `validate-feature-fit` — <fired / skipped; key findings or "clean">
- `threat-modeling` — <fired / skipped; key findings or "clean">
- Repo-aware — <on / off; contexts loaded>
````

The "Refined ticket" section is wrapped in a **copyable Markdown box**
so the user can grab it verbatim.

## Close-prompt (mandatory final step)

After the output, emit exactly this numbered prompt:

```
> Next action for this ticket:
>
> 1. Comment on Jira — I'll post the refined version as a comment (original untouched)
> 2. Replace description — I'll overwrite the Jira description; original saved in a comment
> 3. Nothing — I'll handle it myself / leave the ticket as is
```

Per user interaction rules, accept number or free text. Options 1
and 2 require `jira-ticket` write permissions; if missing, degrade
to copy-paste instructions and note why.

## Output format

1. **Refined ticket** section with rewritten title + description, wrapped in a copyable markdown block.
2. **Top-5 risks** as a numbered list, each item paired with a mitigation or deferral.
3. **Persona voices** — one paragraph per persona from the active set; no skipped personas without explicit reason.
4. **Orchestration notes** naming every sub-skill that fired or was skipped, with a one-line reason.
5. **Close-prompt** with exactly three numbered options (comment / replace / nothing); no fourth option in v1.

## Gotcha

- The model tends to invent risks that sound plausible but aren't anchored in the ticket text. Every risk in Top-5 must cite a phrase, AC bullet, or sub-skill finding — no hypotheticals.
- Persona voices degrade into generic platitudes when the ticket is already tight. If a persona has nothing real to flag, write one sentence stating that — do not pad.
- Sub-skills (`validate-feature-fit`, `threat-modeling`) cost tokens; orchestrate only when the trigger matrix actually matches, not defensively on every run.
- Branch-detection matches the first `[A-Z]+-[0-9]+` in the branch name; chained keys (e.g. `feat/PROJ-1-and-PROJ-2`) pick the first and note the rest.

## Do NOT

- Do NOT write back to Jira in v1 — output is copyable markdown; write-back is user-gated via the close-prompt.
- Do NOT chain into `/estimate-ticket` or `/feature-plan` automatically — separate invocations by design (Q5 decision).
- Do NOT duplicate logic from `validate-feature-fit` or `threat-modeling` — orchestrate by reference, cite findings, don't re-derive them.
- Do NOT skip the close-prompt, even when the ticket looks fine and the user seems eager to move on — the prompt is the contract.
- Do NOT emit persona voices outside the active set; if the user passed `--personas=+qa`, add QA, otherwise do not.

## See also

- [`jira-ticket`](../../commands/jira-ticket.md) — ticket loader
- [`validate-feature-fit`](../validate-feature-fit/SKILL.md) — orchestrated sub-skill
- [`threat-modeling`](../threat-modeling/SKILL.md) — orchestrated sub-skill
- [`feature-explore`](../../commands/feature-explore.md) — upstream idea capture; hints at `/refine-ticket` when input looks like a ticket
- [`feature-plan`](../../commands/feature-plan.md) — downstream planning
- [`adversarial-review`](../adversarial-review/SKILL.md) — same `critical-challenger` persona, different stage (post-plan)
- [`road-to-ticket-refinement.md`](../../../agents/roadmaps/road-to-ticket-refinement.md) — governing roadmap
- [`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md) — this skill was drafted under it
