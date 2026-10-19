<!-- evidence-type: analysis -->
# `type-design` — one path A run and one path B run (2026-10-19)

Evidence for AC-5 of `road-to-type-with-a-witness`. Both runs executed the skill
as written in this branch, in scratch directories outside the tree, through
subagents with the pinned peer-side toolchain. The fonts are typeface binaries
and are identified by SHA-256, not committed (the fixture bound admits only the
benchmark's held-out families).

## Path A — from a wordmark

- Source: a monoline wordmark reading `MONOLITH` (SVG, drawn for this run; rights
  class `own`, licence `unknown`, recorded as unknown in the name table).
- Brief: tier `latin-basic`, locked signature glyph `M`.
- `font.ttf` SHA-256 `e4c56586b2287a482e6d91b9ad55f67ca283762193c4ce52040ea9d9bf077f60`.
- QA report names coverage tier `latin-basic` and maturity `prototype`.

| gate | result |
|---|---|
| 1 outline hygiene + coverage (87/87) | pass |
| 2 vertical metrics | pass |
| 3 stems, overshoot | pass |
| 3 ink area per glyph group | **fail** after 3 repair rounds — the source letters I L M N T sit −31 % … +27 % from their group median and gate 6 holds them to the wordmark |
| 4 spacing, kerning, collisions, features, shaping | pass |
| 5 witness | `face_state: "loaded"` on 27/27 `<text>` — read with this branch's CLI; the published 16.5.0 the run had emits no `face_state` field |
| 6 source fidelity | pass — locked `M` 0.9992 (≥ 0.95), word 0.970 (≥ 0.85), lowest glyph 0.932 (`O`, ≥ 0.90); overlay produced and looked at |
| 7 metric-matched fallback | pass — size-adjust 104.34 % over Arial |

## Path B — from a written brief

- Family `Kettle Display`, rights `own`, licence OFL-1.1, tier `latin-basic`,
  maturity `prototype`. `font.ttf` SHA-256
  `367078ceed14fd97f701ff84ee946156171ccea7bbad79f7c574cac487837edd`.
- Control glyphs `n o H O` were built first and proofed: `proof/control.svg`
  witnessed at 08:57:48, 8/8 `<text>` `face_state: "loaded"`; the full font was
  built at 09:03:58. **The approval of the four controls was given by the
  commissioning session, not by a human** — the run was autonomous, so the
  ordering is evidenced and the approver is an agent.
- Gates: all pass except gate 3 ink area per glyph group (26 outliers; three
  repair rounds produced unacceptable proportions and were reverted). Gate 5
  `loaded` on 27/27. Gate 6 not applicable to path B.

## Two findings across both runs

1. **Gate 3 ink area fails on every run**, including the three benchmark
   reconstructions (`internal/bench/type-reconstruction/run-2026-10-19/VERDICT.md`),
   because real letterforms do not sit within ±12 % of a group median. The
   threshold is unchanged here; whether to move it is a decision for the
   benchmark's next registration, not a post-hoc edit.
2. **The `loaded` reading needs a CLI that has not shipped.** The witness's
   `face_state` arrives with Phase 1 of this roadmap; a consumer on 16.5.0 gets
   `first_family_resolved` only, which the skill does not accept as `loaded`.
