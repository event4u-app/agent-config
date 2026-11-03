---
complexity: lightweight
status: later
tree_pin: 81788b6e63
review_by: 2027-01-31
entry_condition:
  what: "road-to-host-and-media-steps-that-say-what-ran has archived, and the council has ratified the model-capabilities schema bump in 2.1"
  when: "after that roadmap archives"
  who: AI council
execution:
  mode: phase-checkpoints
estate_growth_exempt: "+1 later roadmap: the media remainder of round inbox-2026-11-r. Each item needs a test-pinned schema bump or a new command, neither of which fits the small active sibling. Owner search at 81788b6e63 (grep -rliF for model-capabilities, video verify, cost_per_second, as_of over agents/roadmaps, later, stubs) found only later/road-to-billing-cliff-detection.md, which owns the credits cliff stop, not the cost unit."
relates:
  - slug: road-to-host-and-media-steps-that-say-what-ran
    relation: depends
    note: "Carries the small media fixes; this file holds the ones that need a schema or a command."
depends:
  - road-to-host-and-media-steps-that-say-what-ran
---
# Road to video claims with a date

> **Source:** `agents/tmp.old/inbox-2026-11-r/` — Spur B (model truth in the
> media stack), re-verified at `81788b6e63`.
> **Arrivals:** 1 — `inbox-2026-11-r` (2026-11-03).

## Goal

A video model's limits carry the date and source they were read from, cost is
stated in the unit the provider bills, the duration grid lives where planners
read it, and a rendered clip can be checked against its plan.

## Phase 1 — Verify a rendered clip

Evidence (read): `src/domains/ai-video/video/` — `command.md`, `from-script`,
`from-song`, `scene`, `stitch`, `storyboard`; no `verify`, while `image/verify`
exists.

- [ ] **1.1 `/video:verify`.** Keyframes at the planned timestamps go through
      `image-analyser`; output is a deviation list and one re-roll line per
      clip. Drafted per `artifact-drafting-protocol`.
      verify: a fixture clip with a known deviation produces exactly that deviation row

## Phase 2 — Manifests that say when they were true

Evidence (read): `src/scripts/ai-video/model-capabilities/higgsfield.json` —
`cost_per_second_usd: null`; no manifest carries `as_of` or `allowed_durations`;
schema v2 is pinned by `tests/scripts/ai_video_model_capabilities_schema.test.ts:63`.

- [ ] **2.1 Schema v3: `as_of`, `source`, `allowed_durations`, `cost_unit`.**
      Planners read `allowed_durations` instead of `[min,max]`; the adapter
      clamp becomes a refusal once every manifest carries the grid.
      verify: `npx vitest run tests/scripts/ai_video_model_capabilities_schema.test.ts` -> 0 on v3
- [ ] **2.2 Dated provider grammar** in `motion-choreographer` and
      `prompt-engineering-image`: each provider row carries the date it was
      last checked.
      verify: `grep -c 'checked:' src/skills/motion-choreographer/SKILL.md` -> ≥1

## Decisions

| # | Decision | Decided by | Revisit-if |
|---|---|---|---|
| D1 | A live web lookup of model limits is only a suggestion with its source, never an automatic overwrite: it would add egress to a media path | rule `lethal-trifecta-guard` | — |
| D2 | Not folded into `later/road-to-corpus-refresh-cadence-shape.md`: that roadmap covers skill corpora, not video manifests (the source's fold target was wrong) | tree evidence | — |
