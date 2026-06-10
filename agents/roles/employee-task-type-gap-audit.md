# Employee task-type gap audit

> Phase 3 of `road-to-session-profile-observability`. Confirms the five
> reviewer-named employee workflows each resolve to an **existing** role prompt
> under `agents/roles/*/prompts/` — assumption checked against the shipped tree,
> not assumed. One genuine gap was found and closed with **one** additive prompt
> (no orchestration, no new system — per the roadmap's explicit scope cap).

## Mapping — the five workflows

| # | Reviewer workflow | Resolves to (role / prompt) | Covered? |
|---|---|---|---|
| 1 | **Ticket summary** | `support/summarise-ticket-thread` (+ `support/customer-recap`) | ✅ existing |
| 2 | **Customer reply** | `support/draft-reply` · `sales/answer-customer` · `galabau/customer-email-reply` | ✅ existing (three role-shaped variants) |
| 3 | **Meeting prep** | `sales/prep-discovery-call` · `leadership/one-on-one-prep` · `consultant/client-brief-refine` | ✅ existing |
| 4 | **Proposal draft** | `sales/draft-offer` · `galabau/offer-from-brief` · `consultant/deck-outline` / `investor-memo` | ✅ existing |
| 5 | **Incident review** | `leadership/incident-review` | ➕ **added this phase** |

Four of five were already shipped across the support / sales / galabau /
consultant / leadership role libraries — the gap audit refuted the
"workflows are merely assumed" worry for those four.

## The one genuine gap — and why it was distinct

The roadmap flagged "incident review" as the candidate gap, **distinct from**
`support/escalation-risk-analysis` and `leadership/risk-analysis-memo`. Reading
both confirmed the distinction:

- `escalation-risk-analysis` — **forward-looking triage on a live ticket**: will
  this escalate (SLA breach / named exec / churn language / compliance)?
- `risk-analysis-memo` — **forward-looking decision framing**: best / base /
  downside on a decision *not yet made*, with the named bet + inversion check.

Neither is a **retrospective** incident review. A postmortem looks *backwards*:
what already happened, the timeline (and the detection gap inside it), the root
cause as a system/process gap, contributing factors, what went well, and **owned
corrective actions**. That is a genuinely different artefact, so exactly one
prompt was added.

## What was added (and the placement rationale)

`agents/roles/leadership/prompts/incident-review.md` — one additive prompt
following the `role-experience` contract (`name` / `intent` / `inputs` /
`output_shape` / `skill_hint: decision-record`). Placed under **leadership**
because:

- It is a management/retrospective writing artefact — "structured document from
  fuzzy notes", which is the leadership persona's whole job.
- It pairs naturally with the existing **forward** risk artefact on the same
  role: `risk-analysis-memo` (forecast) ↔ `incident-review` (retrospective).
- Support's prompts are all live-ticket-facing (reply / recap / handoff /
  escalation); a blameless postmortem is a different altitude.

The prompt is deliberately **blameless** (systems and gaps, never people),
**honest** (never invents a metric or a root cause the notes do not support),
and **standalone** — no state-machine, no orchestration. Anything that wants a
multi-step ticket→summary→reply→review loop is explicitly out of scope (a
separate flow-engine surface, per the roadmap's out-of-scope list).

## Verification

- `lint_role_experiences` — all roles pass (leadership now 6 prompts, within the
  5–10 band).
- `check_role_doc_links` — 86 links OK.
- The new prompt carries all five required frontmatter keys; `skill_hint:
  decision-record` resolves to an existing skill (`src/skills/decision-record`).
