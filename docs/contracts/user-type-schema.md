---
stability: beta
keep-beta-until: 2026-08-14
---

# User-type Schema — runtime review-lens axis

> **Status:** active · **Stability:** beta · **Owner:** step-6-user-types-axis
> · **Linter:** `scripts/skill_linter.py § lint_usertype`
> · **Source-of-truth dir:** `.agent-src.uncompressed/user-types/`
> · **Sibling axis (distinct):** install-time `user-types/` (package root) — see [`adr-install-user-type-axis`](adr-install-user-type-axis.md)
> · **ADR:** [`adr-user-types-axis`](adr-user-types-axis.md)

Locks the canonical user-type shape. A user-type is a **runtime review
lens** simulating a real end-user of the software under review (a
galabau field crew, a metalworking shop, a truck driver). It is the
twin of `personas/` along a different axis: persona = *how* we review
(methodology — qa, senior-engineer); user-type = *who* we simulate
(end-user — domain workflow + operational reality).

## § 1 — Frontmatter

| Key | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | lowercase-hyphenated, must match filename stem |
| `kind` | const `user-type` | yes | discriminator — locks this file as a review-lens user-type, separates it from the install-time user-type-axis YAMLs |
| `description` | string | yes | one sentence, ≤ 160 chars (linter cap matches persona) |
| `version` | string | yes | semver; bump on breaking changes |
| `source` | enum | yes | `package` \| `project` — project-specific is the typical case (consumer-domain end-users) |

`user-types:` is NOT a skill-frontmatter key in v1. The axis is
CLI-only (`/refine-ticket --user-type=<id>`). Skill-level defaults are
deferred to v2 — see [`adr-user-types-axis`](adr-user-types-axis.md).

## § 2 — Required section spine (locked)

User-types share the spine across the axis — no Core/Specialist split,
no tier enum. Every user-type carries all seven sections:

1. **Focus** — one paragraph. Who this lens is, the operational
   context they work in, and what no other lens catches. End with one
   sentence pinning the boundary: review-lens only, never operational
   instruction source.
2. **Daily Workflow** — concrete day-shape, not generic prose. What
   they do at 06:00, 10:00, 15:00; what they look at, what they touch,
   what they wait for.
3. **Vocabulary** — domain terms the software must use (or must NOT
   substitute). Bilingual where the trade is bilingual. Plain-language
   over engineer-language where the user is non-technical.
4. **Operational Constraints** — mobile / offline / gloves / noise /
   PPE / time pressure / connectivity / lighting / dead-zones /
   hours-of-service / break-windows / shop-floor vs office split.
   Each constraint is a UI / flow signal, not generic empathy.
5. **Unique Questions** — ≥ 3 questions no persona asks verbatim.
   Each must be falsifiable against the ticket under review. (Linter
   warns < 3, matches persona heuristic.)
6. **Ticket Red Flags** — what this lens would flag as missing or
   unrealistic when reviewing a ticket. Bullet list, each item names a
   concrete signal a generic reviewer would miss.
7. **Anti-Patterns** — what this lens must refuse to do. Guardrails
   are non-negotiable here: **review-only, never operational
   instruction**. No trade execution (welding procedure, electrical
   work, structural advice). No dangerous how-to. No medical / legal
   / engineering advice. Generic prose ("consider usability") is
   itself an anti-pattern.

`Composes well with` is permitted as an optional eighth section
(advisory pairings with personas), not budget-counted.

## § 3 — Size budget

| Section count | Line cap | Rationale |
|---|---|---|
| 7 | ≤ 120 | Matches the persona core budget. Spine is wider than a
core persona (7 vs 5 sections) but narrower than a wing-3/4 specialist
(no Critical Rules + Workflows blocks). 120 is the larger of the two
candidate caps and the persona core uses it for a 5-section spine —
the extra two sections need the headroom. |

Enforced by `lint-skills` against the full file including frontmatter
and trailing blank line.

## § 4 — Anti-Generic Quality Bar (merge gate)

Every user-type must encode **≥ 5 concrete, domain-specific review
points** across `Daily Workflow`, `Vocabulary`, `Operational
Constraints`, and `Ticket Red Flags`. Generic prose is REJECTED at
lint or review time:

- ❌ "consider mobile usability"  →  ✅ "capacitive touch fails with
  wet leather gloves at 4 °C; tap targets ≥ 60 px or voice command"
- ❌ "think about offline"  →  ✅ "no signal in cellar yards; queue
  changes locally, conflict-resolve on the morning brief"
- ❌ "users want reports"  →  ✅ "end-of-day proof = timestamped photo
  + customer signature + GPS fix; anything less is a billing dispute"

The Reviewer test: a generic reviewer persona could not have produced
the `Unique Questions` or `Ticket Red Flags` of this file. If they
could, the file is generic.

## § 5 — Guardrails (encoded in every Anti-Patterns block)

User-types are review lenses, not operational manuals. Every file's
`## Anti-Patterns` section MUST explicitly forbid:

- Trade-execution instructions (welding procedure, electrical work,
  structural advice, anything that could harm if followed)
- Dangerous how-to (chemical handling, equipment operation, work-at-
  height procedures)
- Medical / legal / engineering advice that requires a licensed
  practitioner

Allowed and encouraged: workflow realism, ticket gap analysis,
terminology correction, mobile / offline / safety / approval signals
as ticket-requirement signals.

## § 6 — Schema enforcement

The linter (`scripts/skill_linter.py § lint_usertype`) enforces:

- frontmatter shape (table in § 1)
- `kind` const value
- required sections per § 2
- size budget per § 3
- ≥ 3 bullets in `Unique Questions`
- `id` matches filename stem
- description ≤ 160 chars

Authors must use the template at
`.agent-src.uncompressed/user-types/_template/user-type.md`.

## § 7 — Versioning

Section rename / add / remove → ADR + linter update + user-type
migrations in the same PR. Size-cap tightening is breaking when it
forces existing user-types to lose content; size-cap loosening is
non-breaking. The `kind` const is locked — renaming requires a major
version bump and a separate ADR.

## See also

- [`persona-schema`](persona-schema.md) — sister axis (methodology vs end-user)
- [`adr-user-types-axis`](adr-user-types-axis.md) — why the axis split exists
- [`adr-install-user-type-axis`](adr-install-user-type-axis.md) — the install-time `user_type` axis (distinct layer, same vocabulary)
- `.agent-src.uncompressed/user-types/README.md` — authoring entry point
- `.agent-src.uncompressed/user-types/_template/user-type.md` — template starter
