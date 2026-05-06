# Council question — Deep-Research & Analysis harvest prioritization

## Context

`event4u/agent-config` is a governed multi-department skill suite (134
skills, 55 rules, ~63 commands) with a project-agnostic floor
(`augment-portability`) and a Sunset Policy (any artifact >400 lines
must externalize bulk to authoritative links). The user (Matze) asked
to deep-scan three "Deep Research / Deep Analysis" sources and
produce one unified roadmap, autonomy on, council to break ties.

Sources scanned:

| Source | Status | Volume | Quality |
|---|---|---|---|
| `ginobefun/deep-reading-analyst-skill` (GitHub) | OK | 136 KB · 1 SKILL + 9 reference modules | high — content-analysis arsenal, 4 depth levels, real reference frameworks |
| `Weizhena/Deep-Research-skills` (GitHub) | OK | 64 KB · 5 commands + 1 persona + Python validator | high — orchestration of multi-item parallel research with field-typed JSON output |
| `mcpmarket.com/tools/skills/deep-analysis-2` | **BLOCKED** | — | Vercel/Cloudflare CAPTCHA — cannot fetch via curl, web-fetch, or web-search snippet. Generic name resolves to multiple authors with conflicting variants. **Out of scope.** |

## Existing surface (cross-checked for overlap)

- `sequential-thinking` — step-by-step reasoning; **no** mental-models catalog, no SCQA, no depth-level orchestrator
- `analysis-skill-router`, `analysis-autonomous-mode` — routing, not framework arsenal
- `project-analysis-*` (8 skills) — codebase-bound, not content/article analysis
- `adversarial-review`, `judge-bug-hunter` — diff/code stress-tests, not pre-mortem on decisions/content
- `bug-analyzer`, `systematic-debugging` — incident-driven, not free-form deep-dive
- **No equivalent for:** SCQA, 5W2H, Mental Models catalog, Six Hats, Inversion-as-decision-tool, First Principles, Systems Thinking, Critical Thinking, Cross-source comparison, Multi-item parallel research orchestrator, Field-typed JSON research validation, Markdown report generator from JSON

## Curated short-list (ICE-scored draft)

ICE = Impact (1–10) · Confidence (1–10) · Ease (1–10), `≥ 200` = adopt
Phase 1, `100–199` = Phase 2 backlog, `< 100` = drop.

### Tier S — likely Phase-1 ADOPT

| # | Candidate | Source | Lines | I·C·E | Score | Notes |
|---|---|---|---|---|---|---|
| 1 | `deep-reading-analyst` skill | ginobefun | 501 | 9·9·6 | **486** | Sunset trigger — must split: lean SKILL ≤300 lines + framework dispatch via reference links |
| 2 | `mental-models` guideline | ginobefun mental_models.md | 298 | 9·9·9 | **729** | Pure adopt, in budget — Munger toolkit, cross-discipline cognition |
| 3 | `scqa-framework` guideline | ginobefun scqa_framework.md | 499 | 8·9·6 | **432** | Sunset trigger — split core (~300) + extended examples link |
| 4 | `research-suite` (3 commands + validator) | Weizhena | 145+100+93 + 160 py | 9·8·5 | **360** | `/research` + `/research-deep` + `/research-report` — needs ~/.claude path rewrites and project-agnostic refactor |
| 5 | `inversion-thinking` guideline | ginobefun inversion_thinking.md | 362 | 8·9·8 | **576** | Pure adopt — pre-mortem / failure-mode for decisions, distinct from `adversarial-review` (diff-bound) |

**Phase-1 total effort:** ~4.5 d. Total adoptions: 5 (matches hard cap).

### Tier A — Phase-2 backlog

| # | Candidate | Source | Lines | Score |
|---|---|---|---|---|
| 6 | `5w2h-analysis` guideline | ginobefun | 376 | 280 |
| 7 | `six-hats` guideline | ginobefun | 356 | 256 |
| 8 | `systems-thinking` guideline | ginobefun | 214 | 245 |
| 9 | `first-principles` guideline | ginobefun | 154 | 200 |
| 10 | `critical-thinking` guideline | ginobefun | 114 | 192 |
| 11 | `comparison-matrix` guideline | ginobefun | 330 | 180 |

### Tier C — DROP

| Candidate | Reason |
|---|---|
| `output_templates` (ginobefun) | Overlaps with `project-docs` templates and `agent-docs-writing` skill; 402 lines triggers Sunset; ROI marginal |
| `web-search-agent` persona (Weizhena) | Vendor-specific module routing (academic-papers, chinese-tech, csdn, juejin) violates `augment-portability`; opinions lock to Claude/Opus model. Inspiration noted, persona itself dropped. |
| `web-search-opencode`, `web-researcher.toml` (Weizhena) | OpenCode/Codex-tool-specific — out of scope, we ship a tool-agnostic skill suite |
| `research-add-fields`, `research-add-items` (Weizhena) | Trivial 30-line stubs — fold into `/research` as flags rather than separate commands |

## Council ask

1. Confirm the Phase-1 plate of 5 (deep-reading-analyst, mental-models, scqa-framework, research-suite, inversion-thinking) or propose substitutions from Tier A.
2. Tiebreak the **research-suite-vs-inversion-thinking** seat if you'd swap (inversion has higher score but more abstract; research-suite is concrete and unblocks net-new workflow).
3. Verify the DROPs — particularly `output_templates` (any value we'd lose if dropped?) and `web-search-agent` persona (any way to salvage scenario routing without portability violation?).
4. Sunset Policy: confirm the split strategy for `deep-reading-analyst` SKILL (≤300 lines core, references link to source SHA) and `scqa-framework` (≤300 lines core, examples linked) — or recommend alternative.

## Constraints

- Hard cap 5 adoptions / 6-week phase
- Project-agnostic floor — no Claude-only / OpenCode / Codex assumptions
- Sunset Policy mandatory >400 lines
- No version-numbers / release-tags in roadmap (per `scope-control` § no-versions-in-roadmaps)
- Trackable headings (`## Phase <id>`) + `[ ] / [x]` checkboxes per `roadmap-progress-sync`
