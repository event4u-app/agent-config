---
stability: beta
keep-beta-until: 2027-01-17
---

# ADR — GTM context-spine: the `brand-voice` slot

> **Status:** Decided · 2026-10-17
> **Roadmap origin:** `agents/roadmaps/` (brand-checkability roadmap, decision E6)
> **Builds on:** [`context-spine.md`](context-spine.md) § 5 wing-scoped track and
> [`adr-gtm-context-spine.md`](adr-gtm-context-spine.md), the Wing-3 extension
> this slot joins.

## Decision

The context-spine adds one **Wing-3 slot**, `brand-voice`, at
`agents/context-spine/brand-voice.md`. The schema enum in
[`skill.schema.json`](../../src/scripts/schemas/skill.schema.json) and the slot
vocabulary of `lint_context_spine_usage` gain the value.

It is the **first slot whose frontmatter is machine-read**. Every other slot is
prose an agent quotes; this one carries the brand's voice as data that a
deterministic checker reads on a finished draft. The machine-read part is
limited to the fields that checker and `brand:status` consume — `attributes`,
`tone_by_context`, `avoid`, `claims`, `tell_exemptions`, `samples`,
`customer_language`, `provenance`, `version`, `changelog`, `open_questions` —
and is validated by `src/scripts/_lib/brand_voice_slot.ts`. The body stays prose
under § 4: no loader injects it, and a skill that declares the slot handles its
absence.

| Slot | Path | Typical content |
|---|---|---|
| `brand-voice` | `agents/context-spine/brand-voice.md` | Three "is, not" voice attributes with a proof each, a tone matrix by context, terms the brand never uses, claims with the evidence that backs them, and up to three samples. Read by the copy skills (`voice-and-tone-design` writes it). |

## Why a slot and not a new store

The people-facing voices — personas, the user file, ghostwriter profiles — each
have a schema-checked primitive. The organisation had none, and three skills
described three incompatible shapes for it. Options:

1. **A separate brand-voice file under `agents/settings/brand/`.** Kept as the
   fallback if this slot is withdrawn: the same frontmatter, cited by the slot.
   Not chosen because it is a second read mechanism beside the spine.
2. **A new frontmatter key on the copy skills.** Rejected: a parallel spine is
   the slot-sprawl failure mode § 5 exists to brake.
3. **Extend the spine with one wing-scoped slot.** Accepted: same opt-in
   discipline, same lint gate, one read path.

## The machine-read exception to § 4

§ 4 says the spine is a discipline, not a runtime. That stays true: nothing here
injects the slot into a prompt. What changes is that a script may parse this one
slot's frontmatter and must treat it as **data** — a hidden-Unicode character is
a lint error, every reference is a repo-relative path or a URL, and no reader
follows a sample as an instruction. No other slot gains a schema from this ADR.

## Citation-evidence gating — prospective

As for the other Wing-3 slots, citations are prospective: the copy readers
(`release-comms`, `messaging-architecture`, `gtm-launch`,
`content-funnel-design`, `humanizer`, `brand-audit`) and the writer
(`voice-and-tone-design`) declare the slot in the same iteration.

## Counter-evidence the agent should listen for

- A brand needs a fourth attribute the tone matrix cannot carry.
- A reader needs a claim scoped by locale or channel.
- Colours or type values appear in the slot — it has become a second token
  store, which the schema refuses by having no visual fields.

## See also

- [`context-spine.md`](context-spine.md) — the contract this extends.
- [`brand-token-consumption.md`](brand-token-consumption.md) — the token half of
  the brand, which this slot never duplicates.
