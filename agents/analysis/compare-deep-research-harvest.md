# Comparison — Deep-Research & Analysis harvest (ginobefun + Weizhena + mcpmarket)

**Generated:** 2026-05-06
**Sources scanned:**

- `ginobefun/deep-reading-analyst-skill` (GitHub) — 136 KB, 1 SKILL + 9 reference modules
- `Weizhena/Deep-Research-skills` (GitHub) — 64 KB, 5 commands + 2 personas + Python validator
- `mcpmarket.com/tools/skills/deep-analysis-2` — **inaccessible** (Vercel/Cloudflare CAPTCHA on every fetch path; generic name resolves to multiple authors with conflicting variants — out of scope, documented for traceability)

**Trigger:** User ask — port the highest-leverage deep-research / deep-analysis skills into `event4u/agent-config` and ship one unified roadmap. Council asked to break ties.

## Source quality at a glance

| Dimension | ginobefun | Weizhena | mcpmarket |
|---|---|---|---|
| Curation | high — single SKILL + nine cohesive reference modules | high — small, focused, parallel-research-oriented | n/a (blocked) |
| Project-agnostic | yes (no vendor refs) | partially — `~/.claude/` paths, Claude Opus model id hard-coded in `web-search-agent` | n/a |
| Sunset risk | three files >400 lines (SKILL 501, scqa 499, output_templates 402) | one file >300 lines (validator 160) | n/a |
| Net-new gap filled | content-analysis arsenal (SCQA, 5W2H, Mental Models, Six Hats, Inversion, First Principles, Systems, Critical Thinking) | multi-item parallel-research orchestrator with field-typed JSON output + report generator | n/a |
| Overlap with existing | small (`sequential-thinking` is step-by-step, not framework-driven; `adversarial-review` / `judge-bug-hunter` are diff-bound, not pre-mortem on decisions) | small (`/research-deep` overlaps `analysis-skill-router`'s routing surface but adds parallel execution and field-typed output) | n/a |

## Cross-checked overlap with existing 134 skills

- `sequential-thinking` — step-by-step reasoning. **No** mental-models catalog, no SCQA, no depth-level orchestrator.
- `analysis-skill-router`, `analysis-autonomous-mode` — routing, not framework arsenal.
- `project-analysis-*` (8 skills) — codebase-bound, not content/article analysis.
- `adversarial-review`, `judge-bug-hunter` — diff/code stress-tests; not pre-mortem on decisions or content.
- `bug-analyzer`, `systematic-debugging` — incident-driven; not free-form deep-dive.
- **No equivalent for:** SCQA, 5W2H, Mental Models catalog, Six Hats, Inversion-as-decision-tool, First Principles, Systems Thinking, Critical Thinking, Cross-source comparison, multi-item parallel research orchestrator, field-typed JSON research validation, markdown report generator from JSON.

## ICE-scored candidates

ICE = Impact (1–10) · Confidence (1–10) · Ease (1–10). `≥ 200` = candidate Phase 1, `100–199` = Phase 2 backlog, `< 100` = drop.

### Tier S — Phase-1 ADOPT (after council synthesis)

| # | Candidate | Source | Lines | I·C·E | Score | Notes |
|---|---|---|---|---|---|---|
| 1 | `deep-reading-analyst` skill (chunked) | ginobefun SKILL.md | 501 | 9·9·6 | **486** | Sunset trigger — split: ≤300-line core SKILL (depth orchestrator + framework dispatch) + reference modules linked via SHA-pinned upstream URL |
| 2 | `mental-models` guideline | ginobefun mental_models.md | 298 | 9·9·9 | **729** | Pure adopt, in budget — Munger toolkit, cross-discipline cognition |
| 3 | `scqa-framework` guideline | ginobefun scqa_framework.md | 499 | 8·9·6 | **432** | **Full adopt as GUIDELINE under authoritative-link Sunset exception** (council Sonnet — splitting kills the value because the examples ARE the framework) |
| 4 | `inversion-thinking` guideline | ginobefun inversion_thinking.md | 362 | 8·9·8 | **576** | Pure adopt — pre-mortem / failure-mode for decisions. Distinct from `adversarial-review` (diff-bound) |
| 5 | `/research` command (refactored) | Weizhena research_SKILL.md | 145 | 8·8·7 | **448** | Adopt `/research` only — refactor `~/.claude/` → project-agnostic paths. Validator + `/research-deep` + `/research-report` deferred to Phase 2 (Python+path portability debt — council Sonnet) |

**Phase-1 total:** 5 adoptions (matches hard cap). Estimated effort: ~4.5 d.

### Tier A — Phase-2 backlog

| # | Candidate | Source | Lines | Score |
|---|---|---|---|---|
| 6 | `5w2h-analysis` guideline | ginobefun | 376 | 280 |
| 7 | `six-hats` guideline | ginobefun | 356 | 256 |
| 8 | `systems-thinking` guideline | ginobefun | 214 | 245 |
| 9 | `first-principles` guideline | ginobefun | 154 | 200 |
| 10 | `critical-thinking` guideline | ginobefun | 114 | 192 |
| 11 | `comparison-matrix` guideline | ginobefun | 330 | 180 |
| 12 | `/research-deep` + `/research-report` (refactored, validator rebuilt) | Weizhena | 100 + 93 + 160 (py) | 160 |

### Tier C — DROP

| Candidate | Reason |
|---|---|
| `output_templates` (ginobefun, 402 lines) | Overlaps with `agent-docs-writing` skill + `project-docs` templates. Sunset trigger + marginal ROI. Salvage: extract Executive Summary + SWOT as ≤100-line snippets in P2 if needed. |
| `web-search-agent` persona (Weizhena) | Hard-codes Claude Opus model id, vendor-specific routes (semantic-scholar, csdn, juejin). Violates `augment-portability`. Inspiration captured in existing `analysis-skill-router`. |
| `web-search-opencode`, `web-researcher.toml` (Weizhena) | OpenCode/Codex-tool-specific — out of scope for tool-agnostic suite. |
| `research-add-fields`, `research-add-items` (Weizhena) | Trivial 30-line stubs — fold into `/research` as flags rather than separate commands. |
| `validate_json.py` (Weizhena, 160 LOC) | Hard `~/.claude/skills/research/` path assumption + Pydantic dependency. Phase-2 rebuild as JSON Schema reference (no runtime dependency). |

## Council synthesis (2026-05-06)

Two members polled (claude-sonnet-4-5 + gpt-4o, $0.0528 actual). Verdicts:

| Question | Sonnet | GPT-4o | Decision |
|---|---|---|---|
| Confirm Phase-1 plate of 5 | MIXED — approve 1, 2, 5; swap 3 + 4 | MIXED — accept; lean toward `research-suite` over `inversion-thinking` | Accept Sonnet's structural arguments — concrete portability evidence beats abstract "concrete > abstract" preference. |
| Tiebreak `research-suite` vs `inversion-thinking` | Swap research-suite OUT (Python validator portability debt) → first-principles IN | Swap inversion-thinking OUT → research-suite IN | Compromise: Adopt `/research` command (145 lines, refactored) + keep `inversion-thinking`. Defer validator/report to Phase 2. Drops first-principles to Phase-2 backlog (still high score). |
| Sunset split for `deep-reading-analyst` | Approve ≤300 core + SHA-linked references | Approve splits with version-controlled links | Approved. |
| Sunset split for `scqa-framework` | **Challenge** — adopt full 499 as GUIDELINE (examples ARE the framework) | (no specific objection) | Accept Sonnet — full adopt as guideline under "authoritative-link" Sunset exception (reference material exempt from runtime line-budget intent). |
| DROP `output_templates` | Confirm with documented loss | Confirm with cross-check | DROPPED. Salvage extraction parked in Phase 2 if `agent-docs-writing` shows a gap. |
| DROP `web-search-agent` persona | Confirm — portability disqualifying | Confirm | DROPPED. |

## Provenance

- Council question: `agents/council-questions/deep-research-harvest-prioritization.md`
- Council response: `agents/council-responses/deep-research-harvest-prioritization.json`
- Sibling roadmaps: `agents/roadmaps/road-to-microck-harvest.md`, `agents/roadmaps/road-to-markitdown-adoption.md`
