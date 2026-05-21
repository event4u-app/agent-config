---
complexity: structural
---

# Road to Microck Harvest

**Status:** READY FOR EXECUTION — decisions synthesized 2026-05-05 from
AI Council (claude-sonnet-4-5 + gpt-4o, $0.0424 actual run).
**Started:** 2026-05-05
**Trigger:** User ask — "make this the ultimate package, harvest
everything useful from `Microck/ordinary-claude-skills`."
**Mode:** Hard cap **5 adoptions per six-week plate** (council
unanimous). Phase 1 ships under the Reference-Guideline Sunset Policy
(see § Decisions). Phase 2 is **out-of-horizon** and unlocks only
after Phase 1 evidence (lint clean, integration confirmed, no skill
> 400 lines without externalization).

## Purpose

Port the highest-leverage skills from Microck's 415-skill mirror into
`event4u/agent-config` without inheriting Microck's curation problems
(non-curated, broken paths, no linter — see
`agents/evidence/analysis/compare-microck-ordinary-claude-skills.md`). The
content-level harvest, ICE-scoring, and DROP list live in
`agents/evidence/analysis/compare-microck-deepscan-harvest.md`.

**Out of scope for this roadmap:**

- Wing-2/3/4 cognition skills (`agile-product-owner`,
  `creating-financial-models`, `competitive-ads-extractor`, …) —
  defer to wing-specific roadmaps.
- Vendor-locked wrappers (shopify-*, paypal, benchling, latchbio,
  positron, gerrit, …) — violate `augment-portability`.
- Document-conversion skills (`pdf-processing`, `docx`, `xlsx`,
  `excel-analysis`) — superseded by `road-to-markitdown-adoption`.
- Meta/skill-authoring skills (`skill-developer`, `skill-builder`,
  `template-skill`, …) — our `skill-writing` + `skill-quality` rule
  + `lint-skills` already cover this surface.

## Decisions (synthesized 2026-05-05 from council)

| Question | Decision | Source |
|---|---|---|
| **Plate cap** | Hard cap of **5 adoptions** per six-week plate. | Council unanimous (Sonnet + GPT-4o). |
| **Phase-1 picks** | `defense-in-depth`, `testing-anti-patterns`, `repomix`, `mcp-builder`, `error-handling-patterns` (chunked). | Council intersection + tiebreak (`mcp-builder` over `code-review-excellence`). |
| **Sunset Policy** | Any skill > 400 lines or labeled `patterns` / `guidelines` MUST externalize the catalogue, define a refresh trigger, and a sunset criterion. | Sonnet, structural mitigation. |
| **Wing-2/3/4 cognition** | DROP from this harvest. Wings own their cognition design via roles + rules, not Microck stubs. | Council unanimous. |
| **Meta/skill-authoring** | DROP. We are upstream. | Both members. |
| **No auto-promotion** | Phase 2 unlocks only on Phase 1 evidence (lint + tests + 6-week stability). | Sonnet maintenance-debt argument. |

## Reference-Guideline Sunset Policy (hard rule)

Any new skill in this roadmap **> 400 lines** or labeled `patterns` /
`guidelines` MUST ship with:

1. **Externalization** — link to authoritative external docs for the
   catalogue. Skill keeps the *decision framework*, not the encyclopedia.
2. **Refresh trigger** — explicit event (e.g. ≥30% deprecated examples,
   upstream major) that triggers a rewrite.
3. **Sunset criterion** — when external docs cover the catalogue,
   archive the body, replace with a 50-line pointer skill.

Phase-1 enforcement target: `error-handling-patterns`.

## Horizon (6-week visible plate)

Phase 1 is the visible plate. Phase 2 + 3 are **out-of-horizon**.

## Phase 1 — Five-skill adoption plate (READY)

- [x] **P1.1 — `defense-in-depth` skill.** Port the 130-line four-layer
  validation pattern as `.agent-src.uncompressed/skills/defense-in-depth/`.
  Strip Microck-specific refs, add ADOPT citation
  (Microck commit SHA + path), pass `lint-skills` + `check-portability`.
  Effort: 0.5 day.
- [x] **P1.2 — `testing-anti-patterns` skill.** Port Iron Laws + gate
  functions for mock abuse / test-only methods. Cross-link with
  existing `judge-test-coverage` and `pest-testing`. Pass linters.
  Effort: 0.5 day.
- [x] **P1.3 — `repomix` tool wrapper skill.** Port 5.6 KB CLI wrapper.
  Verify the `repomix` binary is documented as an optional
  dependency (not silently installed). Effort: 0.25 day.
- [x] **P1.4 — `mcp-builder` skill.** Port 13 KB MCP server authoring
  guide. Adapter pass on external file refs (replace with
  in-skill snippets or link to upstream). Cross-link with existing
  `mcp` consumer skill. Effort: 1.5 days.
- [x] **P1.5 — `error-handling-patterns` skill (CHUNKED, Sunset-Policy
  applied).** Author 200-line core skill (decision framework: when
  to use exceptions vs. result-types vs. retries). Externalize the
  638-line pattern catalogue to authoritative upstream docs (php.net,
  Python docs, MDN). Define refresh trigger + sunset criterion in
  frontmatter. Effort: 1.5 days.
- [x] **P1.6 — Suite integration.** Add the 5 new skills to the index
  (`AGENTS.md` skill counts), regenerate compressed output (`task sync`),
  regenerate tool projections (`task generate-tools`), run full CI
  (`task ci`). No PR until evidence is captured.

### Closure note (Phase 1)

**Closed:** 2026-05-08. Five skills ported under Sunset Policy:
`defense-in-depth`, `testing-anti-patterns`, `repomix`, `mcp-builder`,
`error-handling-patterns`. All ≤ 200 lines (errorhandling reduced
from 636 → ~150 via Sunset Policy externalization). Microck commit
SHA `8f5c83174f7aa683b4ddc7433150471983b93131` recorded in
`agents/settings/contexts/skills-provenance.yml`. Skill count: 145 → 150.
Local `task ci` green after consistency commit. Phase 2 + 3 stay
out-of-horizon per six-week stability gate.

## Phase 2 — Out-of-horizon (six-week gate waived 2026-05-09 by user; processed in same chat)

- [x] **P2.1 — Re-evaluate `code-review-excellence`.** **DROP.** Delta
  against existing `requesting-code-review` + `receiving-code-review`
  + six `judge-*` skills was redundant; no net-new framework.
- [x] **P2.2 — `async-python-patterns` (chunked).** **ADOPTED** under
  Sunset Policy as decision framework only (gather / TaskGroup / wait,
  structured concurrency, timeouts, sync-bridging); cookbook
  externalized to upstream Python / library docs.
- [x] **P2.3 — `secrets-management` overlap audit.** **ADOPTED** as
  multi-cloud (Vault, AWS, Azure, GCP) + CI + Kubernetes decision
  framework; provider deep-dives externalized. Cross-linked with
  `aws-infrastructure` + `security-audit`.
- [-] **P2.4 — `slo-implementation` + `distributed-tracing`.**
  **DEFERRED** — architectural prerequisite (observability plate) not
  in place. Queued behind a future `road-to-observability-plate`.
- [x] **P2.5 — `prompt-engineering-patterns` portability check.**
  **ADOPTED.** Survived `check-portability`; ships as production-LLM
  prompt design framework, distinct from `prompt-optimizer` (end-user
  polish) and `refine-prompt` (engine-inbound ticket refinement).

## Phase 3 — Sunset enforcement and periodic rescan (closed in same chat)

- [x] **P3.1 — Sunset audit pass.** Verified all 8 Microck adoptions
  (Phase 1 + 2) ship ≤ 200 lines with frontmatter `refresh_trigger` +
  `sunset_criterion` per Sunset Policy. No follow-up archival needed.
- [x] **P3.2 — Microck periodic rescan.** Confirmed source SHA
  `8f5c83174f7aa683b4ddc7433150471983b93131` consistent with Phase 1
  capture; no net-new high-leverage candidates beyond DROP list.
- [x] **P3.3 — Cross-suite signal capture.** Cross-links recorded in
  `agents/evidence/analysis/compare-microck-deepscan-harvest.md` for all P2/P3
  verdicts; no duplication detected against active roadmaps.

### Closure note (Phase 2 + 3)

**Closed:** 2026-05-09. User waived six-week stability gate
("vergiss die 6 wochen") and authorized autonomous Phase 2+3
execution. Three skills adopted (`async-python-patterns`,
`secrets-management`, `prompt-engineering-patterns`); one DROP
(`code-review-excellence`); one DEFERRED (`slo-implementation` +
`distributed-tracing`, gated on observability plate). Skill count:
150 → 153. Microck SHA unchanged
(`8f5c83174f7aa683b4ddc7433150471983b93131`). All adoptions ≤ 200
lines under Sunset Policy. `task lint-skills` + `lint-marketplace`
clean; provenance + marketplace + counts in sync.

## Risk register

| Risk | Mitigation |
|---|---|
| Pattern-catalogue bitrot (5 mini-wikis to maintain) | Sunset Policy enforced from Phase 1; CI-checkable line-count + frontmatter `refresh_trigger` field. |
| Microck citation rot (broken paths) | Pin commit SHA in every ADOPT skill's provenance footer. |
| Phase-2 auto-promotion creep | This roadmap's Phase 2 stays out-of-horizon; promotion requires explicit Phase 1 evidence written into the closure note. |
| Hidden duplicates with our 134 | `lint-skills` + `check-refs` run mandatory in P1.6 before any merge. |

## Provenance

- Analysis: `agents/evidence/analysis/compare-microck-deepscan-harvest.md`
- Original Microck verdict: `agents/evidence/analysis/compare-microck-ordinary-claude-skills.md`
- Sibling roadmap (markitdown adoption): `agents/roadmaps/archive/road-to-markitdown-adoption.md`
