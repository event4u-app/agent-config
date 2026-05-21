---
complexity: lightweight
---

# Road to Markitdown Adoption

**Status:** ALL PHASES CLOSED 2026-05-08 — full execution via
`/roadmap:process-full` (autonomous mode, AI-council on, token spend
opted in by user). Phases 1, 2, and 3 landed in a single PR; horizon
markers preserved for archival reference but did not gate execution.
**Started:** 2026-05-05
**Closed:** 2026-05-08
**Trigger:** User pointed at the Microck markitdown skill stub and
asked whether the upstream Microsoft tool is worth integrating to
reduce token consumption on PDF / DOCX / XLSX / PPTX / image
ingestion. Council confirmed Option A (peer-side MCP server,
markdown-only skill); brief calibrated; this roadmap is the
implementation plate.
**Mode:** Full execution. Original Phase-1-only gate from 2026-05-05
overridden by user directive on 2026-05-08 ("Full ist Full, ALLE
Phasen") — captured as roadmap-process-loop hardening so future
`/roadmap:process-full` runs ignore horizon markers by construction.

## Purpose

Ship a senior-tier markitdown skill that lets the agent convert
PDF, DOCX, XLSX, PPTX, EPUB, images, and audio into LLM-friendly
Markdown via the upstream `markitdown-mcp` server, **without
shipping any Python runtime in our package**. The skill carries
the four-layer security defense from `compare-microsoft-markitdown.md`
§ Lens 3 (skill checklist + narrow API + Docker read-only + localhost
binding), the calibrated token-saving claim from § Lens 1, and the
markdown-output-explosion mitigations from § Lens 2.

The win is **3-5× comprehension lift** on text-heavy structured
documents and **10-50× token reduction** on image-heavy formats
(PPTX, scanned PDFs). On plain-text-heavy PDFs the gain is
smaller (1.5-2×) — claim is calibrated, not inflated.

## Horizon (6-week visible plate)

Per `road-to-better-skills-and-profiles.md` "Roadmap horizon"
decision — 6 weeks is the visible commitment plate; anything
outside is **out-of-horizon**.

**Inside the plate (this 6-week window):**

- **Phase 1 (A1–A6) — Ship the skill + smoke test.** Author
  `.agent-src.uncompressed/skills/markitdown/SKILL.md` (senior-
  tier, all four security layers in `Procedure`), add a smoke-test
  recipe with one tiny PDF + PPTX + DOCX fixture, verify
  `lint-skills` + `check-portability` + `check-references` pass,
  document the upstream version pin, sync to `.agent-src/` +
  `.augment/` + `.claude/` + `.cursor/` + `.clinerules/` +
  `.windsurfrules`. Estimated effort: 0.5–1 dev day.

**Outside the plate (out-of-horizon, gated on Phase 1 evidence):**

- **Phase 2 (B1–B4) — Plugin allowlist + measurement corpus.**
  Add `markitdown-ocr` as the only first-party allowlisted plugin,
  publish a tiny benchmarking corpus (3 PDFs, 2 PPTXs, 1 DOCX
  with track-changes, 1 XLSX) the user can run locally to ground
  the token-saving claim with real numbers, document Azure DI
  fallback as cost-aware path. Estimated effort: 1 dev day.
- **Phase 3 (C1–C3) — Provenance index + cross-skill cross-refs.**
  Wire `markitdown` into `analyze-reference-repo`, `pdf-analysis`,
  `existing-ui-audit`, and other skills that today fall back to
  raw-text extraction. Update their Related-Skills blocks to
  reference `markitdown` as the preferred path for non-text
  formats. Estimated effort: 0.5 dev day.

## Phase 1 — Ship the skill + smoke test (READY)

- [x] **A1 — Skill location.** Author at
  `.agent-src.uncompressed/skills/markitdown/SKILL.md`, senior-tier,
  Wing-1 engineering, dispatched by `analyze-reference-repo` plus
  future ingestion skills.
- [x] **A2 — Frontmatter pin + triggers.** Pin
  `last_verified_with: markitdown-mcp@<tag-or-sha>` (set at author
  time from upstream releases page). Description triggers on
  "convert PDF / DOCX / XLSX / PPTX to markdown", "extract from
  <office format>", "OCR this image", "transcribe this audio".
- [x] **A3 — Four-layer defense in Procedure.** Ship verbatim from
  `compare-microsoft-markitdown.md` § Lens 3 — skill checklist
  before invocation, narrow-API rule (`convert_local()` for
  workspace, `convert_response()` for pre-fetched HTTPS, never
  bare `convert()`), Docker `-v $(pwd):/workdir:ro` read-only
  mount, `--http --host 127.0.0.1` localhost-only binding.
- [x] **A4 — Markdown-output-explosion mitigations in Procedure.**
  From § Lens 2 — DOCX revision-history strip, PPTX presenter-notes
  flag, XLSX `data_only=True` for formulas, OLE-object strip
  warning.
- [x] **A5 — Three install recipes + per-host wiring.** Docker
  (recommended, default), `pipx install markitdown-mcp`
  (lightweight peer-side), `uv pip install markitdown-mcp`
  (uv-native). Per-host wiring snippets for Claude Desktop,
  Cursor, Cline, Windsurf MCP clients.
- [x] **A6 — Smoke-test fixture set.** Under
  `tests/fixtures/markitdown/` (1 small PDF, 1 small PPTX, 1 small
  DOCX — under 50 KB each, MIT-cleared content), plus
  `tests/test_markitdown_skill.py` that asserts SKILL.md
  frontmatter passes `skill_linter.py` and renders without
  `check-references` errors. Fixtures generated locally, not
  vendored from third parties.

**Exit criteria for Phase 1:**

1. `task lint-skills` passes including the new skill.
2. `task check-refs` passes — every reference in the skill resolves.
3. `task check-portability` passes — no project names, domains, or
   stack-specifics leaked into the skill text.
4. `task test` passes including the new fixture-based smoke test.
5. The skill text manually walks an agent through one successful
   PDF conversion in a clean checkout, end-to-end, with the
   four-layer defense applied.
6. The token-saving claim in the skill body matches the calibrated
   number from `compare-microsoft-markitdown.md` § Lens 1
   (3-5× comprehension lift / 10-50× tokens on image-heavy) — **not**
   the inflated "5-15× typical" first draft.

**Rollback trigger:** if upstream `markitdown-mcp` ships a
breaking-change minor (e.g., 0.1.x → 0.2.x) before our Phase 1
lands, **pin to the last known-good tag** and document the gap in
the skill body until we re-verify against the new minor. Do NOT
chase the upstream main branch.

## Phase 2 — Plugin allowlist + measurement corpus (out-of-horizon)

Captured for later. Decision shape:

- [x] **B1 — Plugin allowlist.** Add `markitdown-ocr` (first-party
  Microsoft) as the only vetted plugin in the skill body. All
  third-party `#markitdown-plugin` results require user
  confirmation per use, not blanket trust.
- [x] **B2 — Measurement corpus.** Publish
  `tests/fixtures/markitdown-corpus/` with 3 PDFs (text-heavy,
  image-heavy, scanned), 2 PPTXs (text + image), 1 DOCX with
  revision history on, 1 XLSX with formulas — all MIT-cleared.
  Add a `task benchmark-markitdown` that converts each, counts
  tokens against a tokenizer, and prints the measured ratio per
  format. Lets the user ground the claim on their own machine,
  not on our brief.
- [x] **B3 — Azure DI fallback.** Document Azure Document
  Intelligence as a cost-aware fallback for scanned PDFs that
  defeat `pdfplumber` — explicit per-page billing warning,
  opt-in only.
- [x] **B4 — Learning hook.** Cross-link from
  `learning-to-rule-or-skill` so future ingestion-related
  learnings route through markitdown first before re-inventing
  per-format extractors.

**Gate:** Phase 1 ships and at least one consumer (us, dogfooding)
runs the smoke test successfully. No Phase-2 work until that
evidence exists.

## Phase 3 — Provenance index + cross-skill cross-refs (out-of-horizon)

- [x] **C1 — Cross-skill links.** `analyze-reference-repo`
  SKILL.md gains a "Use markitdown for non-text formats" line in
  its Related-Skills block; the same for any analysis skill that
  today reads PDFs raw.
- [x] **C2 — Skill-provenance index (optional).** At
  `agents/settings/contexts/skills-provenance.yml` with `author`, `source`,
  `license`, `last_verified` per externally-derived skill — pulls
  the ADAPT #2 idea from `compare-microck-ordinary-claude-skills.md`
  forward without polluting individual SKILL.md files.
- [x] **C3 — Root-doc mention.** Update root `AGENTS.md` and
  `README.md` distribution table to mention markitdown as the
  recommended ingestion path for non-text formats; do NOT
  advertise it as a competitive feature (it's an upstream
  dependency, not our IP).

## Decision log

- **2026-05-05 — Option A confirmed** by AI-Council
  (claude-sonnet-4-5 + gpt-4o), peer-side MCP server, markdown-only
  skill, no Python deps in our package.
- **2026-05-05 — Token claim calibrated.** Original draft "5-15×
  typical" replaced with measured-where-possible language:
  "3-5× comprehension lift on text-heavy, 10-50× tokens on
  image-heavy, 1.5-2× tokens on plain-text PDFs". Per
  `compare-microsoft-markitdown.md` § Lens 1.
- **2026-05-05 — Layered defense locked.** Four layers: skill
  checklist, narrow API, Docker read-only mount, localhost-only.
  Per `compare-microsoft-markitdown.md` § Lens 3 + AI-Council Q2
  Sonnet response.
- **2026-05-05 — Microck rejected as methodology source.**
  Aggregator with passive maintenance and broken file references
  in the markitdown stub (per `compare-microck-ordinary-claude-skills.md`).
  We source from `microsoft/markitdown` upstream only.
- **2026-05-05 — No `task install-markitdown` helper.** Council
  Q4: shipping a Python install task crosses our governance
  boundary (markdown-only skill suite). Three install recipes
  in skill body instead.

## Out-of-scope

- Embedding `markitdown` as a vendored Python dependency in our
  composer/npm packages — explicitly rejected by the council and
  by our cognition-only floor for distribution.
- Building our own conversion engine — wasted effort against a
  120k-star Microsoft-maintained tool.
- Wiring markitdown into the existing MCP-server roadmap
  (`road-to-mcp-server.md`) — orthogonal concerns; markitdown is
  a *consumer-side* MCP server users install peer-side, our MCP
  server is a *producer-side* skill-discovery server. Cross-link
  in skill bodies if useful, no roadmap dependency.

## Pinned references

- Compare doc — Microck: `agents/evidence/analysis/compare-microck-ordinary-claude-skills.md`
- Compare doc — markitdown upstream: `agents/evidence/analysis/compare-microsoft-markitdown.md`
- Upstream tool: https://github.com/microsoft/markitdown (MIT,
  120k stars at fetch time 2026-05-05)
- Upstream MCP server: `packages/markitdown-mcp/README.md` in
  same repo
- Iron Laws relied on: `non-destructive-by-default`,
  `skill-quality` § Structural Malice Floor, `verify-before-complete`
