---
complexity: structural
---

# Road to Deep-Research Adoption

**Status:** READY FOR EXECUTION — decisions synthesized 2026-05-06 from
AI Council (claude-sonnet-4-5 + gpt-4o, $0.0528 actual run).
**Started:** 2026-05-06
**Trigger:** User ask — "make this the ultimate package, harvest the
deep-research / deep-analysis skills from
`ginobefun/deep-reading-analyst-skill`,
`Weizhena/Deep-Research-skills`, and `mcpmarket/deep-analysis-2`."
**Mode:** Hard cap **5 adoptions per six-week plate** (council
unanimous). Phase 1 ships under the Reference-Guideline Sunset Policy
(see § Decisions). Phase 2 is **out-of-horizon** and unlocks only
after Phase 1 evidence (lint clean, integration confirmed, no skill
> 400 lines without an authoritative-link Sunset exception).

## Purpose

Port the highest-leverage content-analysis frameworks (SCQA, Mental
Models, Inversion) and the `/research` command surface into
`event4u/agent-config` without inheriting upstream curation problems
(blocked sources, vendor-locked personas, Python validator with
Claude-Desktop path assumptions). The full ICE-scoring, council
synthesis, and DROP list live in
`agents/analysis/compare-deep-research-harvest.md`.

**Out of scope for this roadmap:**

- Phase-2 frameworks (5W2H, Six Hats, Systems Thinking, First
  Principles, Critical Thinking, Comparison Matrix) — gated on
  Phase-1 evidence.
- `/research-deep` + `/research-report` + `validate_json.py` — Python
  validator and Claude-Desktop path assumptions deferred to Phase 2
  (P2.4 closed: ported as `/research:deep` + `/research:report`,
  validator replaced by JSON-Schema + `jq` escape hatch).
- `web-search-agent` persona — vendor-locked routes + Claude Opus
  model id violate `augment-portability`. DROPPED.
- `output_templates` (ginobefun, 402 lines) — overlaps with
  `agent-docs-writing` + `project-docs`. DROPPED, salvage extraction
  parked in Phase 2 if a gap shows up.
- `mcpmarket/deep-analysis-2` — Cloudflare-blocked, unverifiable.

## Decisions (synthesized 2026-05-06 from council)

| Question | Decision | Source |
|---|---|---|
| **Plate cap** | Hard cap of **5 adoptions** per six-week plate. | Council unanimous (Sonnet + GPT-4o). |
| **Phase-1 picks** | `deep-reading-analyst` (chunked), `mental-models`, `scqa-framework` (full guideline), `inversion-thinking`, `/research` (refactored). | Council intersection + tiebreak (Sonnet's portability evidence wins over GPT-4o's "concrete > abstract" preference). |
| **`research-suite` scope** | Adopt `/research` command only. Defer `/research-deep`, `/research-report`, `validate_json.py` to Phase 2 — Python+`~/.claude/` path debt. | Sonnet structural argument. |
| **`scqa-framework` Sunset** | Full 499-line adopt as **GUIDELINE** under authoritative-link Sunset exception. Splitting kills the value — the examples ARE the framework. | Sonnet. |
| **`deep-reading-analyst` Sunset** | Split: ≤300-line core SKILL (depth orchestrator + framework dispatch) + reference modules linked via SHA-pinned upstream URL. | Sonnet, split-at-depth-dispatch boundary. |
| **`output_templates` DROP** | Confirmed. Salvage extraction (Executive Summary + SWOT) parked in Phase 2 if `agent-docs-writing` shows a gap. | Both members. |
| **`web-search-agent` DROP** | Confirmed. Portability disqualifying; no salvage. | Both members. |
| **`mcpmarket/deep-analysis-2`** | Document as inaccessible (Vercel/Cloudflare). Out of scope. | Source-availability check. |
| **No auto-promotion** | Phase 2 unlocks only on Phase 1 evidence (lint + integration + 6-week stability). | Sonnet maintenance-debt argument. |

## Reference-Guideline Sunset Policy (hard rule)

Any new artifact in this roadmap **> 400 lines** MUST ship with one
of the two Sunset paths:

1. **Split path** — when the bulk is *executable* dispatch, split the
   skill: ≤300-line core (decision framework) + linked reference
   modules. Used in P1.1 (`deep-reading-analyst`).
2. **Authoritative-link path** — when the bulk is *reference content*
   whose value IS the examples, keep the full body and link the
   upstream source SHA-pinned in the frontmatter. Used in P1.3
   (`scqa-framework`). Reference material is exempt from the
   runtime-line-budget intent of the 400-line rule.

Both paths require the frontmatter fields `external_source` (SHA URL),
`refresh_trigger` (event that mandates rewrite), and `sunset_criterion`
(when to archive and replace with a 50-line pointer).

## Horizon (6-week visible plate)

Phase 1 is the visible plate. Phase 2 + 3 are **out-of-horizon**.

## Phase 1 — Five-artifact adoption plate (READY)

- [x] **P1.1 — `deep-reading-analyst` skill (CHUNKED, Sunset split path).**
  Author ≤300-line core SKILL in
  `.agent-src.uncompressed/skills/deep-reading-analyst/`. Core handles
  the depth-level orchestrator (Quick / Standard / Deep / Research)
  and the framework dispatch table. Reference modules
  (`mental_models`, `scqa`, `inversion`, `six_hats`,
  `systems_thinking`, `first_principles`, `critical_thinking`,
  `5w2h`, `comparison_matrix`) link to the SHA-pinned ginobefun URL
  in the SKILL frontmatter. Pass `lint-skills` + `check-portability`.
  Effort: 1.5 days.
- [x] **P1.2 — `mental-models` guideline.** Pure adopt of the 298-line
  module as `docs/guidelines/agent-infra/mental-models.md`. Strip
  ginobefun-specific phrasing, add ADOPT citation footer
  (commit SHA + path). Cross-link from `deep-reading-analyst` SKILL,
  `refine-prompt` skill, and `judge-bug-hunter` skill. Effort: 0.5 day.
- [x] **P1.3 — `scqa-framework` guideline (full adopt, Sunset
  authoritative-link path).** Adopt full 499-line module as
  `docs/guidelines/agent-infra/scqa-framework.md`. Frontmatter must
  include `external_source` (SHA URL), `refresh_trigger`,
  `sunset_criterion`. Cross-link from `agent-docs-writing`,
  `requesting-code-review`, `refine-prompt`, `refine-ticket`. Effort:
  0.5 day.
- [x] **P1.4 — `inversion-thinking` guideline.** Pure adopt of the
  362-line module as `docs/guidelines/agent-infra/inversion-thinking.md`.
  Strip overlap-prone phrasing with `adversarial-review`; the
  guideline targets pre-mortem on **decisions**, not diff stress-tests
  on **code**. Cross-link from `refine-prompt`, `refine-ticket`,
  `threat-modeling`, `improve-before-implement`. Effort: 0.5 day.
- [x] **P1.5 — `/research` command (refactored).** Port Weizhena's
  145-line `/research` command as
  `.agent-src.uncompressed/commands/research.md`. Refactor every
  `~/.claude/` path to `$PROJECT_ROOT/agents/research/`. Drop the
  Pydantic validator dependency — replace with a JSON-Schema
  reference link (no runtime dependency). Defer `/research-deep` and
  `/research-report` to Phase 2. Pass `lint-skills` +
  `check-portability`. Effort: 1.0 day.
- [x] **P1.6 — Suite integration.** Add the new skill, three
  guidelines, and one command to the index (`AGENTS.md` skill /
  guideline / command counts). Regenerate compressed output (`task
  sync`), regenerate tool projections (`task generate-tools`), run
  full CI (`task ci`).
  **Closure (2026-05-08):** counts synced to skills=145, commands=104,
  guidelines=62; `task ci` green locally (1m 44s); compressed mirrors
  + hashes regenerated; `marketplace.json` clean; ownership matrix +
  index regenerated.

## Phase 2 — Out-of-horizon (gated on Phase 1 evidence)

- [x] **P2.1 — `5w2h-analysis` guideline.** Adopt 376-line module.
  Cross-link from `refine-ticket`, `bug-investigate`.
  **Closure (2026-05-09):** authored as
  `docs/guidelines/agent-infra/5w2h-analysis.md` (261 lines, under
  400-line Sunset threshold so no frontmatter required); 7-question
  framework + Quick / Deep templates + integration cross-links
  (Critical Thinking, SCQA, Inversion); ADOPT citation footer.
- [x] **P2.2 — `six-hats` guideline.** Adopt 356-line module. Cross-link
  from `council` orchestrator skill (multi-perspective decision aid).
  **Closure (2026-05-09):** authored as
  `docs/guidelines/agent-infra/six-hats.md` (354 lines, under 400-line
  Sunset threshold); six perspectives (White / Red / Black / Yellow /
  Green / Blue) with per-hat templates, four usage patterns, and
  cross-links to `ai-council`, `/council`, plus `first-principles`,
  `systems-thinking`, `critical-thinking` for the integration map.
- [x] **P2.3 — `systems-thinking` + `first-principles` +
  `critical-thinking` guidelines.** Triple adopt — small files, high
  ROI as a "decision-reasoning triad" alongside `mental-models` and
  `inversion-thinking`.
- [x] **P2.4 — `/research:deep` + `/research:report` (refactored, validator
  rebuilt).** Rebuild `validate_json.py` as a JSON-Schema reference or
  native PHP-typed classes (no Python runtime). Refactor remaining
  `~/.claude/` paths.
  **Closure (2026-05-09):** ported as cluster sub-commands
  `.agent-src.uncompressed/commands/research/deep.md` +
  `.agent-src.uncompressed/commands/research/report.md`. Validator
  replaced with the JSON-Schema reference at
  `contexts/contracts/research-schema.md` + `jq -e` well-formedness
  escape hatch (jq optional, agent skips gracefully). `web-search-agent`
  persona dropped — native web-search tool only. `generate_report.py`
  replaced with agent-side rendering + optional `jq` template
  (`report-template.jq`). Council validation (GPT-5 + Gemini-2.5-Pro
  convergent on 2026-05-09, $0.0359 actual)
  confirmed colon syntax (`/research:deep` · `/research:report`),
  `--batch-confirm=each|once|auto` flag, and `jq`-template fallback.
  `command-clusters.md` registry updated (cluster head + 2 subs).
  `add-items` / `add-fields` intentionally **not** ported.
- [-] **P2.5 — `output_templates` salvage.** Only if `agent-docs-writing`
  audit reveals a gap — extract Executive Summary + SWOT as
  ≤100-line snippets.
  **Closure (2026-05-09, DROPPED — audit gate negative):** audited
  `agent-docs-writing` (256 lines, 8-layer hierarchy + procedure
  +rules); the skill scopes **doc placement and freshness**, not
  document templates. Searched the full source tree (`.agent-src.uncompressed/`,
  `docs/`) for `swot` and `executive summary` — zero hits. Analytical
  reasoning is already covered by the eight in-tree guidelines
  (`5w2h-analysis`, `six-hats`, `systems-thinking`, `first-principles`,
  `critical-thinking`, `mental-models`, `inversion-thinking`,
  `scqa-framework`); research-report shaping is owned by
  `/research:report` (P2.4). Adding a 100-line SWOT/Executive-Summary
  snippet to fill a non-existent gap would inflate the guideline
  count without ROI. Salvage **not** performed; consistent with the
  Phase-1 DROP rationale (`output_templates`, 402 lines, dropped for
  overlap with `agent-docs-writing` + `project-docs`).

## Phase 3 — Sunset enforcement and periodic rescan (recurring — out of roadmap scope)

Phase 3 items are **recurring calendar / external-trigger work**, not
one-shot deliverables. They are intentionally not closeable inside this
roadmap and were dropped on 2026-05-09 with the rationale below;
tracking moves to ad-hoc reminders / future ICE rescans.

- [-] **P3.1 — Sunset audit pass.** After Phase 1 has been live for
  one quarter, audit every adopted artifact against the Sunset Policy
  (`scqa-framework` first — authoritative-link path needs an annual
  refresh-trigger check).
  **Closure (2026-05-09, DROPPED — recurring):** quarterly audit
  has no fixed deliverable inside this roadmap; folded into the
  general Sunset-Policy maintenance cadence. The `refresh_trigger` +
  `sunset_criterion` frontmatter on each adopted artifact carries the
  audit signal forward without a roadmap checkbox.
- [-] **P3.2 — `mcpmarket/deep-analysis-2` retry.** Re-attempt access
  every six months. If the source becomes available and curation
  quality is high, ICE-score against this roadmap's DROP list.
  **Closure (2026-05-09, DROPPED — recurring + external-gated):**
  source remains Cloudflare-blocked; retry is an external-trigger
  watch task, not roadmap work. If the source unblocks, a fresh
  ICE-scoring round opens a new harvest roadmap.
- [-] **P3.3 — Cross-suite signal capture.** If Phase-2 candidates ship
  in `road-to-better-skills-and-profiles` Block D pilot or any other
  active plate, record the cross-link and skip duplication.
  **Closure (2026-05-09, DROPPED — moot):** Phase 2 already shipped
  in this roadmap (P2.1 – P2.4); no cross-suite duplication remains
  to capture. Future cross-suite signals are handled inline by the
  receiving roadmap, not retroactively here.

## Risk register

| Risk | Mitigation |
|---|---|
| Sunset bitrot — `scqa-framework` upstream may drift | `refresh_trigger` + `sunset_criterion` enforced in frontmatter; quarterly Sunset-Policy maintenance cadence. |
| `deep-reading-analyst` core drifts from referenced modules | SHA-pinned upstream URL; refresh trigger fires on ginobefun major rewrite. |
| `/research` path-refactor leaks Claude-Desktop assumptions | `check-portability` linter run in P1.5 closure; CI gate enforces on every later touch. |
| `inversion-thinking` overlaps with `adversarial-review` | Explicit framing in guideline header — pre-mortem on **decisions**, not diff stress-tests. Cross-link, don't merge. |
| Hidden duplicates with our 134 skills | `lint-skills` + `check-refs` run in P1.6 closure; CI gate enforces on every later touch. |
| Phase-2 auto-promotion creep | Phase 2 stays out-of-horizon; promotion requires explicit Phase 1 evidence in closure note. |

## Provenance

- Analysis: `agents/analysis/compare-deep-research-harvest.md`
- Sibling roadmaps: `agents/roadmaps/archive/road-to-microck-harvest.md`, `agents/roadmaps/archive/road-to-markitdown-adoption.md`
