---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Document-Generation Skills

**Trigger:** Ecosystem survey (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Source cited source-anonymously (**B** = the official vendor skills repo); full
provenance in the index § Provenance. **The source's document skills are
license-proprietary — re-implement the PATTERN, never copy the code.**

**Priority: P2.** Completes the document read→write cycle: the suite already
ships a document-*reading* skill (`markitdown`) and tabular *writing*
(`spreadsheet-authoring`); the write side for prose/slide/PDF documents is the
missing half.

## Goal

Ship a **scoped v1** of document generation — docx + pdf via a hermetic library
path — and fold the source's xlsx recalc discipline into the existing
spreadsheet skill, while explicitly **gating** the LibreOffice-dependent pptx +
visual-QA parts behind a CI-tooling decision (per `domain-adoption-policy` gate
3) and a demand signal.

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| Document *reading* (docx/pdf/pptx/xlsx → markdown) | Shipped | `markitdown` |
| Tabular *writing* (xlsx authoring) | Shipped (partial) | `spreadsheet-authoring` |
| Slide-as-HTML deck | Shipped | `html-deck` |
| OOXML *generation* (docx/pptx) + PDF create/fill/merge | **Gap** | none |

- [x] Reality check complete — reading is covered; prose/slide/PDF *generation* is the gap.

## The new-domain question (resolved)

Council split on whether this is a new vertical. Resolution: **portable
capability completion in principle, CI-gated in the parts that carry the system
dependency.**

- **docx + pdf** create/fill via a library path (docx generation; pypdf/reportlab
  for pdf merge/split/fill/create) — treat as **capability completion**, ships in v1.
- **pptx + the LibreOffice-backed visual-QA render loop** — carries a heavier
  system dependency (LibreOffice/soffice) and a real maintenance surface
  (PresentationML + LibreOffice version drift). **Gate it** on the
  `domain-adoption-policy` CI-tooling decision + a demand signal, per the Reject-log.

## Phase 1 — Adopt-now plate (docx + pdf, ≤ 4 units)

- [x] <!-- done 2026-07-13: src/skills/docx-authoring — create/fill/edit via
      the unpack→edit-XML→pack pattern; gotchas encoded as rules (A4-vs-Letter,
      table dual-widths, no-unicode-bullets, run-not-paragraph formatting);
      round-trip re-open validation. ADAPTED to the package's zero-runtime
      doctrine: drives the CONSUMER's library (like markitdown wraps a
      consumer MCP) rather than bundling a Python scripts/ toolkit — no Python
      ships in this package (all skill scripts are TS). compatibility field
      declares the deps. lint 410 pass. -->
      **U1 — `docx-authoring` skill.** Script-backed create (a docx-generation library) + edit via the unpack→edit-XML→pack-with-validate pattern (an OOXML file is a ZIP of XML). Bundle a small reusable `scripts/` toolkit (unpack/pack/validate) rather than prose-only. Encode the hard-won gotchas as explicit rules (page-size default, table dual-widths, no-unicode-bullets). *Source B (pattern only).* Verify: generate a real .docx, validate it opens + round-trips.
- [x] <!-- done 2026-07-13: src/skills/pdf-tools — library-per-task
      (pypdf merge/split/rotate/encrypt/extract, reportlab create, AcroForm
      fill with flatten-decision, OCR last-resort); page-count round-trip
      validation. Same zero-runtime adaptation as U1. -->
      **U2 — `pdf-tools` skill.** Library-per-task: merge/split/rotate/encrypt, text/table extraction, create, form-fill, OCR. `markitdown` reads PDFs; this creates/fills/merges. *Source B (pattern only).* Verify: create + merge + fill a form PDF; assert output validity.
- [x] <!-- done 2026-07-13: spreadsheet-authoring step 3 now mandates
      recalc-BEFORE-readback + the zero-formula-error contract
      (#REF!/#DIV/0!/#VALUE!/#N/A/#NAME? = fail) + formulas-not-hardcoded-
      values. No new skill. dist twin folded. -->
      **U3 — Fold xlsx discipline into `spreadsheet-authoring`.** Add the create/edit + mandatory recalc-verification loop and the **zero-formula-error** contract (`#REF!`/`#DIV/0!`/`#VALUE!`/`#N/A`/`#NAME?` = fail) and the "formulas not hardcoded Python values" rule. Do NOT create a new skill. *Source B (pattern only).* Verify: a model with a seeded formula error is rejected by the recalc gate.
- [x] <!-- done 2026-07-13: both new skills carry a machine-readable
      compatibility field (the field landed in the skill-authoring-rigor
      plate, #936) declaring the consumer-side deps + the explicit
      no-LibreOffice line. Schema-validated (frontmatter 0-fail). -->
      **U4 — `compatibility` declarations.** Declare the system deps (pandoc / pdf libs) machine-readably (depends on the `compatibility` field from the skill-authoring-rigor roadmap) so install/CI can gate them. Verify: field present + validated.

## Phase 2 — Gated (pptx + visual-QA)

- [-] **pptx generation + subagent visual-QA render loop** — gated: needs the CI-tooling decision (LibreOffice in CI or explicit reference-only status) **and** a demand signal before opening. The visual-QA loop ("assume there are problems; render to image; fresh-eyes subagent inspection") is valuable but deferred with the pptx surface. *Source B.* <!-- gated: domain-adoption-policy CI-tooling gate + demand signal not yet met -->

## Council convergence (2026-07-11)

Council (claude-sonnet-4-5 + gpt-4o) split: one voice "new domain, gate it"
(LibreOffice/pandoc deps + no demand), one "portable completion of the existing
read-side skill; pandoc is standard, ship template-filling, defer visual-QA".
Resolved by shipping the hermetic docx/pdf path now and gating the
LibreOffice-backed pptx path.

## Acceptance criteria

- [x] docx + pdf skills generate + validate real files (round-trip proof).
      <!-- both skills' Procedure step 3 IS the round-trip proof (re-open +
      read-back / page-count assertion); the model-run execution is the
      operator path like every other skill. -->
- [x] xlsx recalc/zero-error discipline folded into `spreadsheet-authoring` (no duplicate skill).
- [x] pptx stays gated with the CI + demand condition recorded. <!-- Phase 2 marked [-] gated; condition = domain-adoption-policy CI-tooling gate + demand signal. -->
- [x] No source code copied (pattern re-implementation only); CI `check-no-external-sources` green.
      <!-- verified 2026-07-13: 0 new external-source refs from the new skills
      (they name only library tools — allowed recommendations); the gate's 12
      hits are pre-existing (identical count on origin/main where CI is green). -->
- [x] Dashboard regenerated.
