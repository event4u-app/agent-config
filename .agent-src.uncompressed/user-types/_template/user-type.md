---
id: {user-type-id}
kind: user-type
description: "One sentence — who this lens simulates and the operational reality they bring; ≤ 160 chars."
version: "1.0"
source: project
---

# {Human-readable user-type name}

## Focus

One paragraph. Who this lens is, the operational context they work
in (site, shop, vehicle, office), and what no persona catches.
State the workflow shape and the time pressure that frames every
decision they make.

End with one sentence pinning the boundary: this lens is a **review
lens only**, never an operational instruction source. No trade
execution. No dangerous how-to.

## Daily Workflow

Concrete day-shape. What happens at 06:00, 10:00, 15:00. Who they
talk to, what they touch, what they wait for. Avoid generic prose
("they manage tasks"). Encode the actual rhythm.

- {Morning routine — concrete trigger, tool, deliverable.}
- {Mid-day workflow — concrete trigger, tool, deliverable.}
- {End-of-day proof / close-out — concrete artefact + verification step.}

## Vocabulary

Domain terms the software must use (or must NOT substitute).
Bilingual where the trade is bilingual. Plain-language over
engineer-language where the user is non-technical.

- {Term 1 — what it means, why the substitution fails.}
- {Term 2.}
- {Term 3.}

## Operational Constraints

Each constraint is a UI / flow signal, not generic empathy.

- {Mobile / offline / connectivity / dead-zone constraint.}
- {PPE / gloves / noise / lighting / weather constraint.}
- {Time-pressure / hours-of-service / break-window constraint.}
- {Hardware constraint — device, screen size, input mode.}
- {Optional: legal / safety / certification constraint.}

## Unique Questions

Three or more questions no persona asks verbatim. Each must be
falsifiable against the ticket under review.

- {Question 1 — direct, scoped, answerable from the ticket.}
- {Question 2.}
- {Question 3.}
- {Optional Question 4.}

## Ticket Red Flags

What this lens flags as missing or unrealistic when reviewing a
ticket. Bullet list — each item names a concrete signal a generic
reviewer would miss.

- {Red flag 1 — concrete signal + why it matters in this domain.}
- {Red flag 2.}
- {Red flag 3.}

## Anti-Patterns

Non-negotiable. Guardrails are encoded here.

- **Review-only, never operational.** No trade execution
  instructions (welding procedure, electrical work, structural
  advice). No dangerous how-to. No medical / legal / engineering
  advice that requires a licensed practitioner.
- **No generic prose.** "Consider usability" / "think about offline"
  fails the Anti-Generic Quality Bar — every observation cites a
  concrete signal.
- {Anti-pattern 3 — domain-specific failure mode this lens refuses to validate.}
- {Anti-pattern 4 — optional.}

---

*Author note (delete before publishing): this template targets the
7-section spine locked in
[`docs/contracts/user-type-schema.md`](../../../docs/contracts/user-type-schema.md).
Stay within the **≤ 120 line** budget (file total, including
frontmatter). Replace every `{placeholder}` with concrete content
that passes the Anti-Generic Quality Bar (≥ 5 concrete review
points; ≥ 3 Unique Questions). Run `task lint-skills` before
commit.*
