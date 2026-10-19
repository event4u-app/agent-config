# Type reconstruction — verdict of the first run (2026-10-19)

Pre-registration: `internal/bench/type-reconstruction-PREREG.md` and
`type-reconstruction/thresholds.json`, both committed in `1ba3ec047` before any
generated font existed. Neither file is changed by this commit.

## Verdict: `partial`

One family of three passes all four frozen thresholds. Per the pre-registration,
`partial` produces **no claim** in `docs/CLAIMS.md`.

| run | fixture | M1 median IoU (≥ 0.75) | M2 median stem dev (≤ 0.05) | M3 median sidebearing dev (≤ 20) | M4 gate pass rate (≥ 0.75) | family |
|---|---|---|---|---|---|---|
| F1 | serif (`pt-serif`) | **0.672** | 0.0065 | **24.3** | 0.75 | fail |
| F2 | geometric sans (`poppins`) | 0.752 | 0.0056 | 12.4 | 1.00 | pass |
| F3 | humanist sans (`lato`) | **0.715** | 0.0095 | 17.2 | 1.00 | fail |

No held-out glyph was missing in any run. M1 was the deciding metric, as the
calibration predicted: F2 clears 0.75 by 0.002, so the one pass is narrow and is
reported as such. The real-family control gates are in each `grade.json` under
`gates_real_control`; they are not part of the verdict.

## What was run, by whom

- **Input.** Each run received only `lettering.png` — the word `Hobnail` rendered
  by `render_word.py` → `render_png.mjs` (byte-identical copies retained here as
  `FN/input-lettering.png`) — and the identical brief from the pre-registration.
- **Generating sessions.** Path A of `type-design` was started by one generating
  session, which traced all three images and wrote their specs, and stopped when
  its parent session died. A second generating session continued from those
  traces in a fresh directory holding only the three run directories, a copy of
  the skill and the toolchain. Both ran as subagents told not to read the
  fixtures, the bench directory, `provenance/` or the notices; that instruction
  is model-carried and nothing enforces it. The second session reported two
  slips outside its directory (an `ls` of a browser cache, a `readlink` of the
  CLI binary), neither touching a fixture path.
- **Leak grep at hand-off.** Every file in the generation directory was grepped
  for each fixture name and file name (`poppins`, `lato`, `pt-serif`,
  `PT_Serif`, `fixtures/fonts`, `mapping`) before hand-off: 0 hits. The run IDs
  F1–F3 are opaque; their mapping to fixtures was held by the orchestrator only.
- **Grader.** `grade.py` run by the orchestrating session, reading the two font
  files and `thresholds.json` only — never the generating session's notes, spec
  or QA report.

## Generated fonts — retained by digest, not committed

The generated fonts are typeface binaries and the fixture bound
(`tests/fixtures/fonts/README.md`) admits only the three held-out families, so
they are identified by SHA-256 rather than committed:

| run | `font.ttf` SHA-256 |
|---|---|
| F1 | `65a0064ea187e2ad28e93191896d6618b9725b7843656c9fce88a5e4ef7cc774` |
| F2 | `732f75236d4fe2f5f25983aa33f6a2085b28b1b4b11900b7296b65854442ee9e` |
| F3 | `c0abee20df8fa268030ecf89eed5bc3896fd3aee8f3f5aacc4397e57a94e2049` |

## Gate findings from the generating side (QA reports, `FN/qa-report.md`)

- **Gate 3 ink area per glyph group fails in all three**, and the generating
  session left it open rather than move letters away from the source: in each
  image the source's own `n` and `l` differ in ink share by more than ±12 %
  around any group median allows. This is a finding about the gate's threshold
  against real families, not about these fonts alone; the gate is unchanged
  here because a threshold edit after a run is exactly what the pre-registration
  forbids.
- **Gate 5 witness.** The published CLI the generating session had (16.5.0)
  emits no `face_state` field, so its QA reports record gate 5 as open. Re-run
  by the orchestrator with this branch's CLI on the same proof SVGs, all 27
  `<text>` elements read `face_state: "loaded"` in every run; the proof PNGs are
  retained as `FN/proof-1x-light.png`. A consumer on a published version cannot
  get this reading until the witness changes from Phase 1 ship in a release.
- Gate 6 (fidelity on the source letters): word IoU 0.988 / 0.992 / 0.992.

## Retained

Per run: `input-lettering.png`, `grade.json` (raw grader output, per-glyph
values), `qa-report.md` (scratch paths replaced by `$RUN` / `$SCRATCH`),
`proof-1x-light.png`. Fixture identities: the table above and
`tests/fixtures/fonts/fixtures.json`.
