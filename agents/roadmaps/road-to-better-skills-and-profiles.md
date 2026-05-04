---
complexity: structural
---

# Road to Better Skills (Thinking Layer)

**Status:** READY FOR EXECUTION — decisions synthesized 2026-05-01,
re-scoped 2026-05-01 to Thinking Layer only after AI #5 review.
**Started:** 2026-05-01
**Trigger:** Multi-AI review of the skill ecosystem (personas, stakeholder lens,
per-skill tools, orchestration), benchmarked against `alirezarezvani/claude-skills`.
**Mode:** Block sequencing locked for Thinking Layer (B → A → C → D-pilot → F).
Distribution/adoption/orchestration blocks (H · I · G · Q) moved to sibling
roadmap `road-to-distribution-and-adoption.md` and stay **out-of-horizon**.
Blocks unlock only after Phase 1 of `road-to-post-pr29-optimize.md` ships.

## Purpose

Consolidate feedback from multiple AI reviewers on the **skill / persona / orchestration
layer** of `event4u/agent-config`, synthesize cross-source themes, and propose
ICE-prioritized actions to make the skill ecosystem deeper, better-orchestrated,
and more discoverable — without copying claude-skills' breadth.

**Out of scope** for this roadmap (handled separately):

- Post-PR-29 engine / governance optimize (becomes its own roadmap, *next*).
- PR-#29 follow-ups (GT-6 SIGTERM, scope-sizing rule) — captured here as
  context only; they belong in the post-PR-29 optimize roadmap.

## Decisions (synthesized 2026-05-01)

Synthesized from Claude + ChatGPT review rounds. Identity is **OSS-light
governed alternative** (locked in `road-to-governance-cleanup.md`, F1).
Sequencing depends on Phase 1 of `road-to-post-pr29-optimize.md` shipping
first — no skill/persona work begins while the always-rule budget is over
49k or while the packaging bug is unfixed.

### Strategic — settled

| Question | Decision | Rationale |
|---|---|---|
| **Persona introduction (A1 in this roadmap)** | **In scope.** Block A is #1 leverage point per all three reviewers. Persona = "who is thinking", missing layer. Use the 9-section claude-skills spine, prune to a leaner 6-section variant: identity · mission · critical rules · capabilities · workflows · success metrics. Drop "communication style" / "advanced capabilities" / "learning" — covered by existing `direct-answers`, `language-and-tone`, `verify-before-complete` rules. |
| **PO/discovery/stakeholder skills scope** | **In scope** for this package. Block C ships: `po-discovery`, `risk-officer`, `decision-record`, `tech-debt-tracker`, `migration-architect`, `incident-commander`, `stakeholder-tradeoff`, `code-review-multi-lens`. Stops short of C-level / marketing / compliance — those stay claude-skills' lane (AI #1 + AI #2 non-goals). |
| **Per-skill Python tools (D1)** | **Net-new surface, hard-bounded pilot (revised 2026-05-01 after AI #5 review).** Stdlib-only, CLI-first, `--help` + `--json`, `snake_case_verb_noun.py`, embedded sample data, scoring 0–100. Engine CLI stays separate (orchestration). **Pilot exactly 3 tools (Block D weeks 1–3)** with a hard kill-switch: if the pilot misses the eval thresholds (≥85% pass-rate, ≥+30% delta) or exceeds the maintenance budget (1 day/week per tool average), Block D pauses and remaining tools move **out-of-horizon**. No "pilot 3 then scale" auto-promotion. Each pilot tool ships with mandatory test coverage; linter (`scripts/lint_skill_tools.py`) blocks tools that import non-stdlib modules, exceed 200 LOC, or lack a `--json` mode. |
| **Star/adoption signal goal** | **Yes — but secondary to depth.** Identity is OSS-light. Block H targets 200 stars / 5 external consumers / 1 talk in 6 months. Hard cap: 1 day/week per person on marketing. A+C+D ship regardless of H success. |
| **Audience (A5)** | **Primary = teams with own stack** (Galawork pattern, leverages override system). **Secondary = agencies** (multi-tenant override consumers). Solo devs and enterprise/compliance: explicit non-targets. |
| **UI/frontend skills (Block F)** | **In scope** for this package, not a sibling. UI-track engine work in `road-to-post-pr29-optimize.md` already shipped `react-shadcn-ui`. Block F adds `livewire-developer`, `tailwind-engineer`, `accessibility-auditor`, `playwright-engineer`, `ui-component-architect`, `form-handler`. Pre-condition: Block E phase 4 from sibling roadmap. |
| **Roadmap horizon** | **6-week visible cap** per AI #2. Anything past 6 weeks labelled **out-of-horizon**. Existing 178-step plans collapsed to: current 6-week plate + out-of-horizon backlog. Reflected in `agents/roadmaps-progress.md` columns. |
| **Skill versioning** | **No per-skill semver.** Package version = skill version (current model). Defer until external consumer asks. State-schema versioning (work_engine) stays as-is. |

### Benchmark adoption — what to borrow as-is

| Item | Decision | Notes |
|---|---|---|
| **Persona spine** | **6-section leaner variant** (above). Adopt frontmatter as-is: `name · description · color · emoji · vibe · tools`. |
| **Orchestration pattern names** | **Borrow verbatim.** Solo Sprint · Domain Deep-Dive · Multi-Agent Handoff · Skill Chain. Map to existing `/work` (Solo Sprint), `/implement-ticket` (Skill Chain), `/review-changes` (Multi-Agent Handoff). New: Domain Deep-Dive command. Handoff format already matches existing report-step contract. |
| **Eval thresholds** | **Adopt with one delta.** ≥85% pass-rate with-skill, ≥+30% delta vs baseline, flake variance <20%, quality tiers POWERFUL/SOLID/GENERIC/WEAK with only POWERFUL shipping. Routed through `lint-skills` extension, **not** a new harness. |
| **Context-first pattern** | **Reuse existing `agents/contexts/`** as the equivalent surface. No new `<domain>-context.md` files. Document the equivalence in the skill template. |
| **`/plugin-audit`-style pipeline** | **Orchestrate existing checks.** New `/skill-audit` command runs `lint-skills` → `check-refs` → `check-portability` → security-scan → eval-gate as 5-phase pipeline with explicit verdict. No new linters. |
| **Reference-separation `references/`** | **Adopt.** SKILL.md ≤10KB hard cap (extends existing `size-enforcement` rule). Deep content in `references/`, templates in `templates/`, tools in `scripts/`. Migration: only when a skill exceeds 10KB. No retro-split. |

### Block sequencing — locked

This roadmap covers the **Thinking Layer (Ready for execution)** only.
Distribution / adoption / orchestration tracks moved to a sibling roadmap
`road-to-distribution-and-adoption.md` (created 2026-05-01) and stay
**out-of-horizon** until the Thinking Layer ships Block A + C.

**Thinking Layer — Ready (6-week visible plate):**

| Order | Block | Dependency | Effort | Status |
|---|---|---|---|---|
| 1 | **B — Skill reorg** (domain folders + `domain:` frontmatter) | None — preparation for A | 1 week | Ready |
| 2 | **A — Personas** (schema + 8 backend personas) | After B | 2–3 weeks | Ready |
| 3 | **C — Stakeholder/PO skills** (8 skills, parallel start with A's last week) | After A weeks 1–2 | 4–6 weeks | Ready |
| 4 | **D — Python tools** (stdlib-only, hard-pilot 3, kill-switch on miss) | After A | 3 weeks pilot, then re-decide | Ready (pilot only) |
| 5 | **F — UI skills** (livewire/tailwind/a11y/playwright/ui-arch/form-handler) | Pre-condition for engine R1 phase 4 | 4–5 weeks | Ready (gated by sibling roadmap) |

**Distribution / adoption — Out-of-horizon (sibling roadmap):**

| Block | Horizon | Sibling roadmap section |
|---|---|---|
| **H — Marketing** (README + bundles + Medium + comparison page) | Out-of-horizon | `road-to-distribution-and-adoption.md` § H |
| **I — Multi-tool expansion** (Aider, Kilo Code, OpenCode, Codex) | Out-of-horizon | `road-to-distribution-and-adoption.md` § I |
| **G — Orchestration DSL** (YAML pipelines + `/orchestrate`) | Out-of-horizon | `road-to-distribution-and-adoption.md` § G |
| **Q — Audit-as-Memory** (persistent log + promotion gate) | Out-of-horizon | `road-to-distribution-and-adoption.md` § Q |

**178-step backlog refactor (added 2026-05-01 after AI #5 review).**
The legacy 178-step plans embedded later in this file (and any
sibling-roadmap counterparts) are obsolete after this split. A
follow-up commit replaces them with: (a) a 6-week plate matching the
table above, expanded into checklist items per block; (b) an
**out-of-horizon** backlog under each block with no checklist items (so
`agents/roadmaps-progress.md` does not score them as work-in-progress).
Until that refactor lands, the legacy step lists are retained as
historical context but explicitly tagged `legacy — superseded by Block
sequencing table above`.

### Out of scope (confirmed)

- C-level / advisor skills (CEO/CTO/CFO advisors).
- Marketing skills (content-creator, SEO-audit, email-sequence).
- Compliance domain (ISO/MDR/FDA) unless override-only.
- "Self-improving agent" framing — Block Q is the honest version.
- Plugin-marketplace spam (target: 3–5 bundles, not 20).
- 235+ skill catalogue size — target 100–130 high-quality.
- Cross-session memory beyond Block Q's audit log.
- Embedding-based skill discovery (defer — both projects weak).

### Risk register (delta from AI #2)

Confirmed; no changes. The eight risks (persona-schema bikeshed, Block D
explosion, marketing eats engineering, engine R1 drag, 178-step demotivation,
override bloat, 0 stars, copy-by-claude-skills) stay with AI #2's mitigations.

**Sequencing locked. Block B starts once Phase 1 of
`road-to-post-pr29-optimize.md` ships.**

## Phase 1: Thinking Layer execution

Block-level + sub-step checklist. The order matches the locked
sequencing table above (B → A → C → D-pilot → F). Sub-steps live
inline so the dashboard reflects real progress, not just five
oversized buckets. Block-level rows act as completion markers — they
flip to `[x]` only after every sub-step under them ships.

### Block B — Skill reorg (1 week, prep for A)

- [ ] **B** — Skill reorg complete (block marker; flips when B1–B4 are all done). Gated on `road-to-post-pr29-optimize.md` Phase 1 shipping.
- [ ] **B1** — Domain taxonomy locked in `docs/contracts/skill-domains.md` (which domains, naming, no overlap).
- [ ] **B2** — `domain:` frontmatter field added to `lint-skills`; CI fails on missing or unknown value.
- [ ] **B3** — Existing 128 skills back-filled with `domain:` (mass edit + lint-green). No file moves yet.
- [ ] **B4** — Skill folders reorganised into domain folders under `.agent-src.uncompressed/skills/<domain>/`; symlinks + tool projections regenerated; `task ci` green.

### Block A — Personas (2–3 weeks)

- [ ] **A** — Personas shipped (block marker; flips when A1–A6 are all done). Starts after B lands.
- [ ] **A1** — Persona schema locked: 6-section spine (identity · mission · critical rules · capabilities · workflows · success metrics); frontmatter `name · description · color · emoji · vibe · tools`; template under `.agent-src.uncompressed/personas/_template/`.
- [ ] **A2** — `lint-skills` extended with persona-specific checks (required sections, frontmatter, `vibe` enum).
- [ ] **A3** — 4 backend personas drafted (first batch — pick from: backend-architect, api-designer, db-migrator, queue-tuner, php-modernizer, eloquent-tamer, security-engineer, perf-investigator).
- [ ] **A4** — 4 remaining personas drafted (second batch from the same list).
- [ ] **A5** — Persona discovery surface: `available_personas` block in `AGENTS.md` template; persona-aware skill suggestions in `command-suggestion`.
- [ ] **A6** — Persona usage docs in `docs/personas.md` (when to invoke, how `/mode` interacts, override pattern).

### Block C — Stakeholder / PO skills (4–6 weeks, parallel start with A's last week)

- [ ] **C** — Stakeholder skills shipped (block marker; flips when C1–C8 are all done).
- [ ] **C1** — `po-discovery` (problem framing, user-story shaping, AC tightening).
- [ ] **C2** — `risk-officer` (risk surfacing, blast-radius framing, mitigations).
- [ ] **C3** — `decision-record` (ADR drafting, locking trade-offs, supersession chains).
- [ ] **C4** — `tech-debt-tracker` (debt surfacing, prioritisation, repayment-plan framing).
- [ ] **C5** — `migration-architect` (rollout shape, deprecation cycle, dual-write windows).
- [ ] **C6** — `incident-commander` (incident framing, comms cadence, post-mortem skeleton).
- [ ] **C7** — `stakeholder-tradeoff` (multi-stakeholder framing, trade-off matrix).
- [ ] **C8** — `code-review-multi-lens` (security · perf · readability · tests · architecture composite verdict).

### Block D — Python tools pilot (3 weeks, hard-bounded, kill-switch on miss)

- [ ] **D** — Pilot evaluated (block marker; flips after D5 verdict, regardless of pass/fail). Starts after A.
- [ ] **D1** — `scripts/lint_skill_tools.py` linter: stdlib-only check, `--help` + `--json` required, ≤ 200 LOC cap, `snake_case_verb_noun.py` naming, embedded sample data.
- [ ] **D2** — Pilot tool 1 (named in working-notes; e.g. `score_skill_relevance.py`) shipped with mandatory test coverage and eval baseline.
- [ ] **D3** — Pilot tool 2 shipped with same bar.
- [ ] **D4** — Pilot tool 3 shipped with same bar.
- [ ] **D5** — Eval gate: ≥ 85% pass-rate, ≥ +30% delta vs baseline, ≤ 1 day/week/tool maintenance. Pass → continue Block D scope discussion. Miss → kill-switch fires; remaining tools demoted **out-of-horizon**; capture lessons in `agents/roadmaps/sessions/`.

### Block F — UI skills (4–5 weeks, gated by sibling roadmap)

- [ ] **F** — UI skills shipped (block marker; flips when F1–F6 are all done). Pre-condition: engine R1 phase 4 from `road-to-post-pr29-optimize.md`.
- [ ] **F1** — `livewire-developer` (component shape, lifecycle, event flow).
- [ ] **F2** — `tailwind-engineer` (utility-first patterns, design-token discipline, no inline-style drift).
- [ ] **F3** — `accessibility-auditor` (WCAG checklist, keyboard nav, ARIA boundaries).
- [ ] **F4** — `playwright-engineer` (locator strategy, fixtures, flake-prevention patterns).
- [ ] **F5** — `ui-component-architect` (component-tree shape, composition vs inheritance, slot patterns).
- [ ] **F6** — `form-handler` (validation, error display, submission lifecycle, optimistic UI).

Distribution / adoption / orchestration blocks (H · I · G · Q) live
in `road-to-distribution-and-adoption.md` and are out of scope for
this phase.

## Sources (append per AI)

| # | Source / model | Date | Scope | Status |
|---|---|---|---|---|
| 1 | AI #1 (compared with `alirezarezvani/claude-skills`) | 2026-05-01 | Full PR #29 + repo structure + persona/skill comparison | Captured below |
| 2 | AI #2 (deep comparison + roadmap-architect hat) | 2026-05-01 | Repo dimensions table, PR #29 critique, claude-skills weaknesses, proposed roadmap blocks A–F | Captured below (multi-part) |
| 3 | AI #3 (positioning recommendation) | 2026-05-01 | One-paragraph strategic stance + top-3 next-improvement framing | Captured below |
| 4 | Benchmark — `alirezarezvani/claude-skills` (deep read, not external AI) | 2026-05-01 | `ORCHESTRATION.md`, persona `TEMPLATE` + 3 reference personas, `SKILL-AUTHORING-STANDARD.md`, `SKILL_PIPELINE.md`, `/plugin-audit`, multi-tool `INSTALLATION.md` | Captured below |

## Raw feedback — AI #1

**Comparison subject:** `alirezarezvani/claude-skills` (11.2k stars, 235 skills, 9 domains).

### Strengths called out for agent-config

- Compression pipeline (verbose ↔ token-optimized).
- Override system (project-level customization of shared skills).
- 4-gate promotion pipeline (quality, universality, completeness, promotion).
- Behavioural-regression testing via Golden Transcripts (PR #29).
- State-schema with strict envelope validation + migration.

### Gaps where claude-skills is judged superior

- **Personas:** 0 in agent-config vs. 3 + templates in claude-skills.
- **Stakeholder/PO/strategy skills:** 0 vs. 16 product-team + 34 C-level.
- **Per-skill Python tools:** 0 (only engine CLI) vs. 305 stdlib-only tools.
- **Adoption signal:** 0 stars vs. 11.2k.
- **Domain breadth:** Laravel/PHP-anchored vs. 9 domains.

### Critique of PR #29 itself

- Scope too broad — 10 commits, 5 logical themes, hard to review.
- GT-5 (graceful-shutdown gate) is deterministic but **not a real SIGTERM kill** —
  documented gap.
- 178-step roadmap across 5 parallel roadmaps = over-planning; later steps drift
  before earlier ones are done.
- Phases 3–7 produce **no consumer-visible value** — internal only. Visibility
  arrives when UI tickets are supported, but UI skills don't yet exist.

### Top recommendations (AI #1)

1. **Block A — Personas:** introduce 8 backend-focused personas. Largest leverage.
2. **Block C — Stakeholder/PO/discovery skills:** `po-discovery`,
   `risk-officer`, `decision-record`, `tech-debt-tracker`, `migration-architect`.
3. **Block D — Per-skill Python tools:** at least one executable tool per skill,
   stdlib-only.

### Explicit non-goals (AI #1)

- Do **not** copy claude-skills' C-level / marketing / compliance skills.
- Identity stays *governed backend engineering* — keep the focus sharp.

### AI #1 verdict on claude-skills

Acknowledged weaknesses:
- No quality gate.
- No compression.
- Maintenance risk: 235 skills with effectively one author.

## Raw feedback — AI #2

**Hat:** Critical reviewer + roadmap architect. Honesty level: ungeschönt.

### Repo dimensions called out (selected)

| Dimension | agent-config | claude-skills |
|---|---|---|
| Stars / forks | 0 / 0 | 11.2k / 1.4k |
| Skills | 93 | 235+ |
| Personas | 0 | 3 + templates |
| Domain breadth | Laravel/PHP-tight | 9 domains |
| Compression pipeline | ✅ | ❌ |
| Override system | ✅ | ❌ |
| Quality gates / linter | ✅ FAIL=0 | ⚠️ yamllint only |
| Test count | 794 (PR #29) | informal |
| Stakeholder / PO sight | ❌ weak | ✅ strong |

### Strengths emphasized (agent-config)

- Compression pipeline judged "rare engineering discipline" (`.augment.uncompressed/` →
  compiled → 7 tool projections).
- Governance gates are "real, not cosmetic": Promotion / Quality / Universality / Completeness.
- Override system framed as "multi-tenancy for agent config" — uncommon in industry.
- PR #29 Golden Transcripts judged "behavioural regression testing on a level not
  seen in AI-tooling repos".
- Identity clarity: *audit-disciplined, NOT Lovable-mimicry* — explicit non-goals.

### Gaps & weaknesses (agent-config)

- **No personas, period.** Skills/Rules/Guidelines/Commands exist; role identities don't.
  Quote: *"Skills = how to execute. Agents = what to do. Personas = who is thinking."*
  The *who* is missing.
- **Stakeholder / PO / PM skills are scarce.** Existing `improve-before-implement`,
  `refine-ticket`, `estimate-ticket`, `bug-analyzer` are all developer-side. Missing:
  PO discovery, stakeholder communication, roadmap-communicator, discovery, risk-officer.
- **No C-level / strategy layer.** No CTO/COO/CPO advisor, no tech-debt-tracker,
  no migration-architect, no incident-commander.
- **Domain lock-in to Laravel/PHP.** Sharp focus internally, but excludes ~90% of the
  coding world if open-source growth is the goal.
- **Marketing / reach.** 0 stars / 0 forks / 0 issues. README starts with "Galawork API"
  (PR template artifact?), no marketplace plugin listings, no Medium/Twitter presence,
  examples are very Laravel-specific.
- **Skills are a flat list, not a hierarchy.** 93 skills in one folder vs. claude-skills'
  domain grouping (`engineering-team/`, `product-team/`, `marketing-skill/`, etc.).
  Hurts discovery for both humans and agents.
- **No per-skill Python tools.** Engine CLI exists but serves engine ops, not the
  consumer as *tool-for-skill-execution*. claude-skills ships 305 stdlib-only tools.
- **No orchestration layer.** No explicit grammar for *Solo Sprint* / *Domain Deep-Dive* /
  *Multi-Agent Handoff* / *Skill Chain*. Workflows like `/implement-ticket` exist
  but multi-skill / multi-persona handoffs aren't named.

### PR #29 critique (AI #2)

- **GT-5 is a known weakness — by your own admission.** Resume guarantee is
  deterministic but **not real** (no actual SIGTERM kill). Risk: a race-condition
  between state-write and signal-handling at real kill won't be caught. Recommend
  a later GT-6 with a real kill.
- **Scope too broad for a draft PR.** 10 commits, 5 logical themes (chat-history-fix,
  roadmap planning, CLI dispatcher, R1 P1, R1 P2). "Scope: broad on purpose" doesn't
  fully justify it; future PRs should split.
- **Roadmap inflation.** 178 steps across 5 roadmaps = ~18-month plan in a field that
  moves quarterly. By step 50, steps 80-100 will have drifted. Recommendation:
  6-week horizon hard, everything beyond marked *out-of-horizon*.
- **Phases 3-7 produce zero consumer-visible value.** All internal engine refactor.
  Legitimate infrastructure investment, but if not balanced with user-facing skills,
  the project "dies of engineering without users".

**Verdict (AI #2):** Engineering A+, consumer visibility C.

### claude-skills weaknesses (AI #2)

- "40% time savings, 30% quality lift" is marketing language, not measurable engineering.
- No compression — token cost scales with breadth.
- No quality / promotion / universality gates.
- Skills often generic (`senior-architect` is shallow vs. agent-config's `eloquent`).
- Maintenance risk: 235 skills, effectively one author.
- No override system — consumer customization = fork divergence = merge hell.
- `self-improving-agent` is gimmicky without a strict promotion gate.
- One worth borrowing: `skill-security-auditor` — scans skills for malicious code
  before install.

### Top recommendations (AI #2)

1. Add a **persona layer** on top of the existing governance engine. Largest leverage.
2. Build **stakeholder / PO / discovery / risk-officer** skills.
3. Group skills by **domain hierarchy**, not flat folder.
4. Define an **orchestration grammar** (Solo Sprint / Deep Dive / Handoff / Chain).
5. Constrain **roadmap horizon to 6 weeks** + label deeper plans as out-of-horizon.
6. **Marketing model is a separate question** — pick one (Galawork-internal vs. OSS growth).
7. Backlog **GT-6 real-SIGTERM** test as a follow-up to PR #29.
8. Borrow `skill-security-auditor` *concept* (not the file).

### Explicit non-goals (AI #2)

- Don't become claude-skills (don't add C-level / marketing / compliance skills).
- Don't break Laravel/PHP focus to chase breadth.

### AI #2 (continued) — what to borrow from claude-skills

1. Personas (immediately).
2. Domain-grouping of skills (by stakeholder role).
3. Marketing discipline (README scannable, not readable).
4. Multi-tool pragmatism (more editors).
5. Per-skill Python tools.
6. Plugin marketplace listing (`/plugin install …@event4u-config`).

### AI #2 (continued) — pro/contra summary

**agent-config wins:** engineering discipline (compression, linter, promotion gate,
override, freeze-guard), Laravel/PHP depth, reproducibility (PR #29 GTs),
token-efficiency, multi-tenant via overrides, single source of truth, Docker/Pest/
PHPStan workflows, workflow commands.

**claude-skills wins:** domain breadth (9 domains), personas, stakeholder lens,
marketing reach, tool adoption (12), plugin marketplace UX, 305 Python CLI tools,
compliance coverage, domain bundles for discovery, 4 explicit orchestration patterns.

**Both weak:** real-world evals (no "100 sessions, 80 % success" metric), cost tracking
per session (no token budgets), multi-agent coordination protocol with state hand-off,
skill discovery beyond frontmatter (no embedding-based search), versioning of individual
skills (agent-config has *state* schema v0→v1, but skills themselves have no versions).

### AI #2 (continued) — strategic decisions to settle BEFORE any block executes

1. **Identity:** Galawork-internal · OSS product · OSS-light ("governed alternative").
   AI #2 recommends OSS-light: less skills, higher quality, compression magic,
   override-system as the moat.
2. **Audience:** solo devs · teams with own stack (Galawork pattern) · enterprise+
   compliance · agencies. AI #2 recommends *teams with own stack* primary, *agencies*
   secondary — both leverage the override system.
3. **Wow-moment in first 5 min:** today the value is *invisible* (PHPStan-baseline-
   discipline). Needs a visible demonstrable moment, e.g. `/refine-ticket` with
   stakeholder lens, `/architecture-review` multi-persona, `/pre-pr-audit` with RACI +
   tradeoff + auto-ADR.

### AI #2 (continued) — proposed roadmap blocks

| Block | Goal | Effort | Est. metric |
|---|---|---|---|
| **A — Personas** | 8 backend-focused personas + schema + lint + activation (`/persona <name>`) | 2-3 weeks | One `/persona X` replaces 8× "think like a senior". |
| **B — Domain reorganization** | Skills regrouped into `engineering/{backend,quality,devops}`, `product/`, `process/`, `meta/`, `discovery/`. Phase via `domain:` frontmatter → folders → marketplace bundles. | 1 week | <30 s navigation in README to right family. |
| **C — Stakeholder/PO/discovery skills** | `po-discovery`, `stakeholder-tradeoff`, `risk-officer`, `decision-record`, `tech-debt-tracker`, `migration-architect`, `incident-commander`, `code-review-multi-lens`. Each with at least one Python tool. | 4-6 weeks (2 people parallel) | Agent steps to stakeholder lens at least once per typical session (measured via GTs). |
| **D — Python tools per skill** | At least one stdlib-only tool per skill, `--help` + `--json`. Standardised folder layout, linter extension, `tool-registry.json`, marketplace listing. | 6-8 weeks | 60-80 of 93 skills have a useful tool in 6 months. |
| **E — Engine R1 phases 3-7 + GT-6** | Module lift, directive sets (ui, ui-trivial, mixed), wrapper writes v1, GT verify, legacy removal. Each phase tied to user-visible value. GT-6 = real SIGTERM kill. | 6-10 weeks | Phase 7 done with no behavioural drift, UI tickets functional. |
| **F — UI/frontend skills (NEW)** | `livewire-developer`, `tailwind-engineer`, `accessibility-auditor`, `playwright-engineer`, `ui-component-architect`, `form-handler`. Pre-condition for Block E phase 4. | 4-5 weeks | UI tickets in `/implement-ticket` work. |
| **G — Orchestration DSL** | YAML pipelines in `.agent-src.uncompressed/orchestrations/<name>.yml` chaining persona+skills with structured hand-off (Markdown + JSON sidecar) and `/orchestrate <name>` slash. Audit-trail in `.work-state.json`. | 3-4 weeks | 3-5 documented orchestrations, ≥1 in regular Galawork use. |
| **H — Marketing & reach** | README restructure (5-line pitch, diff vs claude-skills, 2-min Quick Win, architecture diagram), plugin-marketplace listings + bundles (`backend-engineering`, `product-discovery`, `quality-eng`), 1 Medium article per quarter, Laracon talk submission, comparison page (SEO), 3-5 showcase consumers. | ~1 day/week over 6 months | 200 stars in 6 months · 5+ external consumers · 1 talk accepted. |
| **I — Multi-tool expansion** | Add Aider (`CONVENTIONS.md`), Kilo Code (`.kilocode/rules/`), OpenCode (`.opencode/skills/`), Codex (`.codex/skills/`) as projections from the existing single source via `task generate-tools`. | 2 weeks | ≥10 tools, all projected from one source. |
| **Q — Audit-as-Memory** | Persistent audit log `agents/audit/<date>/<session-id>.json` + `audit:search` CLI; per-skill `memory:lookup` returning relevant decisions from last 30 days; promotion gate that proposes a rule when 2+ audits show the same pattern (manual maintainer promotion); `task audit:dashboard` static HTML output. | 4-6 weeks | 1-3 rules per month emerge from audit log; per-module skill-hit-rate measurable. |

## Raw feedback — AI #3

**Stance:** "Don't copy claude-skills."

**Recommended positioning (verbatim intent):**

> `agent-config` stays the strict, testable, CI-secured agent-governance system —
> but adopts from `claude-skills` the strong **persona dramaturgy**, **domain
> breadth**, **orchestration patterns**, and **skill-catalog depth**.

**Most important next improvement (AI #3 — single recommendation):**

The next leverage point is **not "more skills"**. It is:

1. **Better thinking roles** (richer persona authoring, not just labels).
2. **Persona gates** (personas that enforce constraints, not just communication style).
3. **Better intent orchestration** (the agent picks the right persona/skill chain
   from the user's intent — currently hard-coded in commands).

### AI #3 — implicit answers to the open strategic questions

| Open question (from window) | AI #3 signal | Confidence |
|---|---|---|
| Identity (internal · OSS · OSS-light) | "stays strict, testable, CI-secured" — leans **OSS-light governed alternative** | medium (single source but explicit) |
| Should we copy claude-skills' breadth? | **No.** Adopt patterns, not catalogue size. | high (explicit "don't copy") |
| What is the differentiator? | governance + tests + CI — keep it | high (explicit) |

### AI #3 — what is *not* in this feedback

- No PR-#29-level critique (no GT-5 / SIGTERM / scope opinion).
- No effort estimates, no ICE scoring.
- No concrete skill names or block list.
- No marketing / reach view.

Treat as **strategic-stance input**, not implementation guidance.

## Raw benchmark — alirezarezvani/claude-skills (deep read)

**Type:** External repository benchmark, not AI feedback. Goal per user:
*"übernehmen (angepasst, nicht einfach kopieren), was wir brauchen können. Wir
wollen können was das Paket kann, aber in unserem System und besser."*

### Architecture mapped — three named layers

claude-skills separates concerns into three explicit layers. agent-config has
the *bottom* layer strong, the *middle* layer absent (implicit in commands),
the *top* layer absent entirely:

| Layer | claude-skills | agent-config today |
|---|---|---|
| **Top — Personas** ("who is thinking") | `agents/personas/<name>.md` — 3 personas + template, 9-section spine | absent (only `role-mode-adherence` + role contracts as primitives) |
| **Middle — Orchestration** ("how layers compose") | `orchestration/ORCHESTRATION.md` — 4 named patterns + handoff format | implicit in `/work` and `/implement-ticket`; no named patterns; handoff via state envelope |
| **Bottom — Skills** ("how to execute") | `SKILL-AUTHORING-STANDARD.md` — 10 patterns, ≤10KB cap, references/ split | strong: linter, FAIL=0 gate, compression, override system, promotion gate |

### Persona spine — 9 sections, identical across all 3 reference personas

Frontmatter: `name · description · color · emoji · vibe · tools`. Body:

1. **Identity & Memory** (role · personality · what they retain · grounded experience)
2. **Core Mission** (3 mission areas, prioritized)
3. **Critical Rules** (hard constraints, organized by category)
4. **Capabilities** (domain expertise, sub-organized)
5. **Workflows** (numbered, each `When: [trigger] → 1-N steps`)
6. **Communication Style** (with quoted example utterances)
7. **Success Metrics** (measurable outcomes)
8. **Advanced Capabilities** (deeper expertise, on-demand)
9. **Learning & Memory** (what they retain, pattern recognition)

### Orchestration — 4 named patterns + handoff format

| Pattern | Use | Closest agent-config equivalent today |
|---|---|---|
| **Solo Sprint** — one operator, multiple phases, persona switches per phase | MVPs, side projects | `/work` cycle; persona switch implicit |
| **Domain Deep-Dive** — one persona, multiple skills stacked | architecture review, audits | `/implement-ticket` with consult-skills |
| **Multi-Agent Handoff** — different personas review each other's work | high-stakes decisions | `/review-changes` with 4 judges (closest match) |
| **Skill Chain** — no persona, sequential skills | repeatable processes | `/implement-ticket` phase pipeline |

**Phase handoff format (verbatim):**

```
Phase [N] complete.
Decisions: [list]
Artifacts: [list]
Open items: [list]
Switching to: [persona] + [skills]
```

This shape matches agent-config's existing **report-step** contract closely
(decisions / artifacts / open follow-ups). Convergent finding: handoff
format is solved problem; only the **persona-switch slot** is missing.

### Skill authoring standard — 10 patterns

1. **Context-first** — skill checks `<domain>-context.md` before asking; only asks for gaps. 5 named domain context files (company, marketing, project, product, regulatory).
2. **Practitioner voice** — opens with `You are an expert in X. Your goal is Y.` Anti-patterns: "comprehensive coverage of...", "It is recommended that...".
3. **Multi-mode workflows** — every skill has 2-3 entry points (build / optimize / situation-specific).
4. **Related skills navigation** — 3-7 cross-refs, each `WHEN to use` + `NOT for` (disambiguation), bidirectional.
5. **Reference separation** — SKILL.md ≤10KB; deep content in `references/`, templates in `templates/`, automation in `scripts/`.
6. **Proactive triggers** — 4-6 conditions skill surfaces *unasked* (e.g. "Conversion rate >40% — likely underpriced").
7. **Output artifacts table** — request → concrete deliverable mapping (4-6 per skill).
8. **Quality loop** — self-verify with confidence tags (🟢 verified · 🟡 medium · 🔴 assumed).
9. **Communication standard** — `BOTTOM LINE → WHAT (with confidence) → WHY → HOW TO ACT (owner + deadline) → DECISION (options + tradeoffs)`.
10. **Python tools** — stdlib-only · CLI-first · `--help` + JSON output · sample data embedded · scoring 0-100 · `snake_case_verb_noun.py`.

### Skill production pipeline — 9 phases, mandatory

`Intent → Research → Draft → Eval → Iterate → Compliance → Package → Deploy → Verify`

- Iteration cap: 5 iterations / 3 hours per skill before escalation.
- **Eval gate:** ≥85% pass rate with-skill, ≥+30% delta vs baseline; flake variance <20%.
- **Compliance gate:** 8-point check (no malware, no secrets, accurate description, stdlib-only, valid YAML, refs resolve, ≤500 lines body, samples + expected output).
- **Real-world verify (Phase 9):** marketplace install, 3 should-trigger + 2 should-not prompts, end-to-end functional test, cross-platform verify.
- **Quality tiers:** POWERFUL (85+) / SOLID (70-84) / GENERIC (55-69) / WEAK (<55). Only POWERFUL ships.
- **Description optimization loop:** 20 trigger queries (10 should + 10 should-not), automated description tuning until ≥18/20.

### Plugin-audit command — 8-phase audit pipeline

`/plugin-audit <skill-path>` runs sequentially, auto-fixes non-critical, asks
only on breaking changes / new dependencies:

1. Discovery (classify type + domain)
2. Structure validation (linter, ≥75)
3. Quality scoring (≥60, letter grade A-F)
4. Script testing (all PASS, no PARTIAL)
5. Security audit (0 CRITICAL, 0 HIGH; never auto-fixed)
6. Marketplace compliance (plugin.json strict format, version match)
7. Ecosystem integration (cross-platform sync, command + agent links)
8. Domain-appropriate code review (engineer for engineering/, PM for product-team/, etc.)

Verdict matrix with explicit blocker list. Closest agent-config equivalent:
`task ci` + `lint-skills` + `check-refs` + `check-portability` — but those
run flat, not as an **orchestrated audit pipeline with per-phase gates**.

### Multi-tool installer surface — verified 12 platforms vs agent-config 7

claude-skills (live README, verified 2026-05-01) ships native install paths
for 12 platforms:

1. **Claude Code** — `/plugin marketplace add` + per-bundle install
2. **OpenAI Codex** — `npx agent-skills-cli add … --agent codex` or `./scripts/codex-install.sh`
3. **Gemini CLI** — `./scripts/gemini-install.sh`
4. **OpenClaw** — `bash <(curl … openclaw-install.sh)`
5. **Hermes Agent** — `python scripts/sync-hermes-skills.py`
6. **Cursor** — `./scripts/install.sh --tool cursor --target .` (`.mdc` rules)
7. **Aider** — `--tool aider` (writes `CONVENTIONS.md`)
8. **Windsurf** — `--tool windsurf` (`.windsurf/skills/`)
9. **Kilo Code** — `--tool kilocode` (`.kilocode/rules/`)
10. **OpenCode** — `--tool opencode` (`.opencode/skills/`)
11. **Augment** — `--tool augment` (`.augment/rules/`)
12. **Antigravity** — `--tool antigravity` (`~/.gemini/antigravity/skills/`)

agent-config today (`task generate-tools` + `scripts/install.sh|.py`):

1. **Augment Code** — native source, `.augment/`
2. **Claude Code** — `.claude/rules/`, `.claude/skills/` (symlinks + Agent Skills standard)
3. **Cursor** — `.cursor/rules/` (symlinks)
4. **Cline** — `.clinerules/` (symlinks)
5. **Windsurf** — `.windsurfrules` (concatenated)
6. **Gemini CLI** — `GEMINI.md` (symlink → AGENTS.md)
7. **Claude.ai Web / Skills API** — `dist/cloud/<skill>.zip` (T3-H gated)

| Bucket | Targets | Count |
|---|---|---|
| **claude-skills only** | Codex · OpenClaw · Hermes Agent · Aider · Kilo Code · OpenCode · Antigravity | **7** |
| **Overlap (both)** | Claude Code · Cursor · Windsurf · Gemini CLI · Augment | **5** |
| **agent-config only** | Cline · Claude.ai Cloud bundles | **2** |

### Installer / CLI architecture comparison

| Aspect | claude-skills | agent-config |
|---|---|---|
| **Source-of-truth model** | Per-tool conversion via `./scripts/convert.sh --tool all` writes 156 native files into 7+ tool dirs | Single source `.agent-src/` → `task generate-tools` projects to all targets via symlinks/concat |
| **Universal CLI** | `npx agent-skills-cli add <repo> --agent <name>` | `./agent-config <command>` (project-local wrapper around `task` + Python) |
| **Per-tool install** | `./scripts/install.sh --tool <name> --target <dir>` (with `--force`) | `bash scripts/install.sh` (payload sync) + `python scripts/install.py` (bridge files) |
| **Bridges** (tool-side hooks/configs) | None documented (skills only) | `.claude/settings.json` with chat-history hooks, `.github/copilot-instructions.md`, `.agent-settings.yml` from template |
| **Cloud surface** | Marketplace listing (`/plugin marketplace add`) | Cloud bundles (`task build-cloud-bundles-all` → ZIPs for Claude.ai Web / Skills API, T3-H gated) |
| **Install verifiability** | `find .cursor/rules -name "*.mdc" \| wc -l` spot-check | `task ci` (sync-check, consistency, check-compression, lint-skills, tests) |
| **Per-skill executable tools** | 305 stdlib-only Python scripts ship with skills | Engine + linters at package level; no per-skill scripts |

**Read:** claude-skills wins on **breadth** (per-platform native targets + universal `npx` entry) and **per-skill executability** (305 tools — separately tracked under "Per-skill executable tools" theme). agent-config wins on **architecture** (single source, no per-tool drift), **CI rigor** (FAIL=0 gate), and **bridge depth** (chat-history hooks, settings template, cost profiles, two-stage installer with idempotent migration). Convergent verdict: **add targets via projection layer, do not adopt the hand-rolled per-tool installer model**.

## Synthesized themes (updated as feedback accumulates)

| Theme | Source(s) | Confidence | Notes |
|---|---|---|---|
| Persona layer is a strategic gap | AI #1, AI #2, AI #3, Benchmark | **high** (3-source + concrete schema) | All three rank persona work as #1 next leverage point. Benchmark adds the *9-section spine* (identity / mission / rules / capabilities / workflows / comms / metrics / advanced / learning) — a ready-to-adapt template, not a blank schema. |
| Persona *gates* (enforce constraints, not just style) | AI #3, Benchmark | medium (cross-source — benchmark formalises) | AI #3's "persona refuses tasks outside its scope" maps directly to benchmark's `Critical Rules` section (hard constraints, by category). Folds cleanly into existing `role-mode-adherence`. |
| Intent orchestration (auto-pick persona/skill chain) | AI #2, AI #3, Benchmark | **high** (3-source — benchmark names the patterns) | AI #2 → YAML DSL. AI #3 → intent classifier. Benchmark → 4 named patterns (Solo Sprint · Domain Deep-Dive · Multi-Agent Handoff · Skill Chain) + verbatim handoff format. Convergent. Existing report-step contract already matches handoff shape; only the persona-switch slot is missing. |
| Adopt patterns, not catalogue size | AI #2, AI #3 | **high** (cross-source agreement) | AI #2 non-goal #3 ("don't chase 235+"). AI #3: "don't copy claude-skills". Settles the breadth-vs-depth axis: depth wins. Reinforced by benchmark read confirming most catalogue weight is C-level / marketing — out-of-scope per AI #1+AI #2 non-goals. |
| Identity = OSS-light governed alternative | AI #2, AI #3 | medium (cross-source, AI #3 implicit) | AI #2 explicit recommendation. AI #3 reinforces ("strict, testable, CI-secured"). Still a user decision, but the single-source flag is gone. |
| PO / discovery / stakeholder skills missing | AI #1, AI #2 | **high** (cross-source agreement) | Both flag developer-side bias. Concrete candidates: po-discovery, risk-officer, decision-record, roadmap-communicator. |
| Per-skill executable tools (stdlib-only) | AI #1, AI #2, Benchmark | **high** (3-source + concrete pattern) | AI #1 + AI #2 name 305 vs ~0. Benchmark adds the *contract*: stdlib-only · CLI-first · `--help` + JSON · embedded sample data · scoring 0-100 · `snake_case_verb_noun.py`. Lowers ADR risk: pattern is borrowable as-is, only "engine-CLI vs per-skill tool" tension remains. |
| PR #29 scope was too broad | AI #1, AI #2 | **high** (cross-source agreement) | Already shipped. Informs PR-sizing rule for future R1 phases. |
| GT-5 lacks real SIGTERM kill | AI #1, AI #2 | **high** (cross-source + already documented) | Both raise it. Backlog candidate as GT-6. |
| Phases 3-7 produce no consumer-visible value | AI #1, AI #2 | **high** (cross-source agreement) | Pure infra work; needs counter-balance with user-facing skill / persona delivery in same window. |
| Skills are flat, not domain-grouped | AI #2, Benchmark | medium (cross-source) | AI #2: discovery / mental-model issue. Benchmark: 9 explicit domain folders (engineering, product-team, content, etc.) — concrete grouping precedent. Cheap to fold into `domain:` frontmatter → folders. |
| No explicit orchestration grammar | AI #2, Benchmark | medium (cross-source — names settle) | AI #2: Solo Sprint / Deep Dive / Handoff / Chain naming. Benchmark: same 4 patterns documented + verbatim handoff format. Names borrowable as-is; spec, not refactor. |
| Roadmap horizon should be ≤ 6 weeks | AI #2 | low (single source) | Recommends "out-of-horizon" label past 6 weeks. Conflicts with current multi-roadmap planning style. |
| Marketing / reach gap (0 stars) | AI #2 | low (single source) | Treat as strategic question, not a backlog item. Open: is OSS growth a goal? |
| README starts with "Galawork API" | AI #2 | low (single source) | Possible PR-template artifact; cheap verification. |
| `skill-security-auditor` concept worth borrowing | AI #2, Benchmark | medium (cross-source — benchmark = pipeline) | AI #2: scan skills for malicious code pre-install. Benchmark: `/plugin-audit` 8-phase pipeline (discovery · structure ≥75 · quality ≥60 · script test · security 0-crit/0-high · marketplace · ecosystem · domain review). Borrowable as orchestrated audit, not flat lint. |
| UI/frontend skills missing entirely | AI #2 | low (single source) | Pre-condition for engine R1 phase 4 (directive set `ui`). Candidates: livewire, tailwind, a11y, playwright, ui-arch, form-handler. |
| Identity decision required (internal vs OSS-light) | AI #2 | low (single source, strategic) | Blocks marketing/reach work. AI #2 recommendation: OSS-light "governed alternative". |
| Audience decision required (teams + agencies) | AI #2 | low (single source, strategic) | Drives override-system framing. |
| "Wow-moment in 5 minutes" missing | AI #2 | low (single source) | Today's value is invisible (PHPStan baseline). Needs visible demo flow. |
| Multi-tool expansion (7 verified missing targets) | AI #2, Benchmark (verified 2026-05-01) | high (cross-source, target list confirmed against live README) | claude-skills-only: Codex · OpenClaw · Hermes Agent · Aider · Kilo Code · OpenCode · Antigravity. Overlap (5): Claude Code · Cursor · Windsurf · Gemini CLI · Augment. agent-config-only (2): Cline · Claude.ai Cloud bundles. Existing projection layer makes adding targets cheap; architecturally agent-config is *cleaner* (single source → projections vs hand-rolled per-tool scripts). See "Multi-client expansion — verified gap & action plan" section for A1–A8. |
| Plugin marketplace listing | AI #2 | low (single source) | `/plugin install …@event4u-config`. Tied to identity decision #1. |
| Skill versioning gap (both projects weak) | AI #2 | low (single source) | State-schema is versioned; skills aren't. Open question if needed. |
| Eval harness gap (no real-world success metric) | AI #2, Benchmark | medium (cross-source — concrete contract) | AI #2: "100 sessions, X % pass" style. Benchmark adds *thresholds*: ≥85% pass with-skill, ≥+30% delta vs baseline, flake variance <20%, quality tiers POWERFUL/SOLID/GENERIC/WEAK with only POWERFUL shipping. No longer hand-wavy; lifts decision-cost. |
| Cost-tracking per session (both weak) | AI #2 | low (single source, both-weak) | Token budgets. Defer. |
| Multi-agent coordination protocol (both weak) | AI #2 | low (single source, both-weak) | State-handoff between agents. Defer. |
| Skill discovery via embeddings (both weak) | AI #2 | low (single source, both-weak) | Beyond frontmatter trigger. Defer. |
| Orchestration DSL (YAML pipelines + hand-off) | AI #2 | low (single source) | Block G. Cross-skill / cross-persona pipelines with structured hand-off. |
| Audit-as-Memory needs concrete impl | AI #2 | low (single source) | Block Q. Operationalises existing "audit IS the memory" stance with persistent log + promotion. |
| Cross-session memory absent today | AI #2 | low (single source) | `.work-state.json` is per-phase only. Tied to Block Q. |
| Showcase consumers (3-5 public) needed | AI #2 | low (single source) | Part of Block H. Galawork is showcase #1. |
| Comparison page for SEO ("claude-skills alternative") | AI #2 | low (single source) | Part of Block H. Honest, not bashing. |
| Context-first skill pattern (`<domain>-context.md`) | Benchmark | low (single source — but novel) | Skill checks for project context file before asking. 5 named domains (company / marketing / project / product / regulatory). Maps cleanly to existing `agents/contexts/` directory. Cheap upgrade to skill spine. |
| Practitioner-voice opener (`You are an expert in X. Your goal is Y.`) | Benchmark | low (single source) | Voice convention with explicit anti-patterns. Borrowable as skill-linter rule (style check, not blocker). |
| Multi-mode workflow entry points (build / optimize / situational) | Benchmark | low (single source) | Each skill has 2-3 named entry points. Reduces "one skill, one path" rigidity. Folds into skill template. |
| Related-skills navigation (3-7 cross-refs, `WHEN`/`NOT for`) | Benchmark | low (single source) | Bidirectional disambiguation block. Existing `check-refs` linter could enforce shape. |
| Output-artifacts table (request → deliverable) | Benchmark | low (single source) | 4-6 per skill. Forces concrete promise; helps eval harness scoring. |
| Confidence tags in skill output (🟢/🟡/🔴) | Benchmark | low (single source) | Quality-loop self-verification convention. Aligns with existing `verify-before-complete` evidence gate. |
| Communication standard (`BOTTOM LINE → WHAT → WHY → HOW → DECISION`) | Benchmark | low (single source) | Ordered output structure for skill replies. Already partially present in `direct-answers` rule + report-step contract. |
| Description-optimisation loop (≥18/20 trigger queries) | Benchmark | low (single source) | 10 should-trigger + 10 should-not, automated description tuning. Operationalises existing `description-assist` skill into a measurable gate. |
| 9-phase production pipeline (Intent→Verify) | Benchmark | low (single source) | Iteration cap: 5 / 3h before escalation. Closest agent-config equivalent: `task ci`. Worth folding into a `/skill-author` orchestration. |
| Reference-separation cap (SKILL.md ≤10KB, deep content in `references/`) | Benchmark | low (single source) | Hard size cap with structured overflow. Existing `size-enforcement` rule covers the cap; `references/` directory pattern is the new piece. |
| Architecturally cleaner projection (vs claude-skills hand-rolled installers) | Benchmark | low (single source — strategic asset) | Worth surfacing in README/H block as a *differentiator*. agent-config's `task generate-tools` is single-source-of-truth; claude-skills duplicates per platform. |

## Open questions for the user

> **Resolved 2026-05-01.** All items (persona scope, PO/discovery scope,
> Python tools surface, audience, UI scope, roadmap horizon, skill
> versioning, persona-spine adoption, orchestration-pattern names, eval
> thresholds, context-first reuse, plugin-audit pipeline,
> reference-separation cap) are answered in the "Decisions
> (synthesized)" section near the top of this file. Kept here as
> historical context for the synthesis trail.

### AI #2 (continued) — ICE prioritization (Impact × Confidence × Ease, 1-10 each)

> **Benchmark adjustment (2026-05-01):** the 9-section persona spine and the 4
> orchestration-pattern names lift Block A and Block G from "design from
> scratch" to "adapt existing template". Effective ease score for both rises
> by ~1 point (A: 7→8 · G: 5→6); confidence on Block D rises by ~1 (9→10) now
> that the per-skill tool *contract* is concrete. ICE is not rerun until the
> user closes the feedback window — captured here as a noted adjustment, not
> applied to the table below.

| # | Block | Impact | Conf | Ease | Score | When |
|---|---|---|---|---|---|---|
| 1 | A — Personas | 10 | 9 | 7 | 630 | Now |
| 2 | B — Skill reorg | 7 | 9 | 8 | 504 | Before A, as preparation |
| 3 | C — Stakeholder skills | 9 | 8 | 6 | 432 | Parallel to A |
| 4 | D — Python tools | 9 | 9 | 5 | 405 | After A, parallel to C |
| 5 | H — Marketing | 8 | 6 | 7 | 336 | Once A+C+D ~30 % done |
| 6 | Q — Audit-Memory | 8 | 7 | 5 | 280 | Q3 |
| 7 | G — Orchestration | 7 | 7 | 5 | 245 | Q3 |
| 8 | F — UI skills | 6 | 8 | 5 | 240 | Q3-Q4 (parallel to E phase 4) |
| 9 | I — Multi-tool | 5 | 8 | 6 | 240 | Q4 |
| 10 | E — Engine R1 done | 6 | 9 | 4 | 216 | Already running, continue |

### AI #2 (continued) — recommended 6-month plan

| Month | Focus |
|---|---|
| **1 — Prep & quick wins** | Block B (skill reorg) · Block A (persona schema + 3-4 first personas) · README refresh (Block H part 1) |
| **2-3 — Core investment** | Block A (all 8 personas done) · Block C (4-5 stakeholder skills) · Block D (10-15 Python tools) · Block E phase 3 |
| **4-5 — Expand** | Block C (remaining skills) · Block D (+15-20 tools) · Block H (Medium articles, plugin bundles) · Block E phases 4-5 |
| **6 — Polish & reach** | Block Q (audit-as-memory) · Block G (orchestration DSL) · Block I (more tools) · Block H (talk submission) |

### AI #2 (continued) — explicit non-goals (extended)

1. No C-level / advisor skills (COO, CEO, CFO). If consumer-internal need: via override system.
2. No marketing skills (content-creator, SEO-audit, email-sequence) — that is claude-skills' lane.
3. Do not chase 235+ skills. Target 100-130 high-quality skills, curated depth over breadth.
4. No "self-improving agent" marketing stunt. Honest version is Block Q (audit-as-memory).
5. No plugin-marketplace spam. 3-5 meaningful bundles, not 20 micro-bundles.
6. No compliance domain (ISO/MDR/FDA) unless Galawork-internal need; if so, internal or override.

### AI #2 (continued) — risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Persona-schema becomes a 3-week bikeshed | Medium | High | Time-box: 5 days schema, then lock |
| Block D explodes (tools harder to maintain than expected) | High | Medium | stdlib-only, small, mandatory test coverage; linter blocks complex tools |
| Marketing eats engineering time | High | High | Hard cap: 1 day/week per person, no more |
| Engine R1 (Block E) drags, blocks UI skills | Medium | High | Prepare UI skills (F) without engine hooks; only engine-integration waits on E |
| 178-step roadmap demotivates | High | Medium | Cap visible roadmap to 6 weeks, label rest as "out-of-horizon" |
| Override system bloats because everyone wants own personas | Medium | Medium | Whitelist fields only; strict schema validation |
| 0 stars stays 0 despite Block H | Low | Medium | Accept — Block H is not make-or-break, A+C+D are |
| claude-skills copies compression | Low | High | Speed: agent-config is 1+ year ahead |

### AI #2 — final answer to "is PR #29 still improvable via claude-skills?"

**Yes, but not how it sounds.** PR #29 is good engineering and should merge as-is,
with two small follow-ups:

1. GT-6 with real SIGTERM kill in a follow-up PR.
2. Cap visible roadmap to 6 weeks, label deeper plans "out-of-horizon".

claude-skills shows three gaps to close independently of PR #29: **(1) Personas
(Block A — top priority) · (2) Stakeholder/PO lens (Block C — parallel) · (3)
Python tools per skill (Block D — biggest consumer ROI).**

One-liner: *agent-config + Personas + Stakeholder skills + Python tools = the
governed alternative to claude-skills that engineering teams actually want.*

### AI #2 (continued) — concrete first week (if work were to start now)

1. **Day 1-2:** Persona schema (`PERSONA-SCHEMA.md`), discuss with 2-3 devs.
2. **Day 3-5:** First persona — `senior-backend-architect`, all fields, all links to existing skills.
3. **Day 6-7:** Merge PR #29 (with the two follow-up conditions above).
4. **Day 8-10:** README restructure draft.
5. **Day 11-15:** Personas 2-4.
6. **Day 16-20:** Block-D pilot — pick 3 existing skills, build one tool each, measure usefulness.
7. **Day 21:** Retro — is the pace realistic, what is slower than expected?

## Multi-client expansion — verified gap & action plan

**Note:** Captured only. No phase scaffolding yet — promote to a separate roadmap (or new phase here) when the user signals.
**Verified:** 2026-05-01 against `alirezarezvani/claude-skills` live README.

### Gap (verified)

7 platforms in claude-skills, not yet in agent-config:

| # | Platform | Native target dir / format | Effort | Notes |
|---|---|---|---|---|
| 1 | **Aider** | `CONVENTIONS.md` (concatenated) | XS | Single file, similar to Windsurf strategy. Reuses concat helper. |
| 2 | **OpenAI Codex** | `~/.codex/` or project-local skills dir | S | CLI agent; needs format check (Markdown skills, possibly with frontmatter). |
| 3 | **Kilo Code** | `.kilocode/rules/` (symlinks) | XS | VS Code extension. Symlink strategy identical to Cursor. |
| 4 | **OpenCode** | `.opencode/skills/` (symlinks) | XS | Symlink strategy identical to `.claude/skills/`. |
| 5 | **OpenClaw** | TBD — verify install script + dir layout | M | Less mature; format may shift. Defer until format stabilizes. |
| 6 | **Hermes Agent** | Python sync script writes to global skills dir | M | Global install; conflicts with project-local model. Needs design call. |
| 7 | **Antigravity** | `~/.gemini/antigravity/skills/` (global) | M | Global install + Gemini-derived. May fold into Gemini CLI target. |

**Cheap wins (XS/S, ~5 added in <1 day):** Aider, Cursor-clones (Kilo Code, OpenCode), Codex.
**Defer (M, design questions):** OpenClaw (format stability), Hermes/Antigravity (global vs project-local).

### Architecture decision (locked)

Add new targets to **`scripts/compress.py`'s `generate_tools()` projection
engine**, not via per-tool hand-rolled installer scripts. claude-skills'
hand-rolled approach is what we'd be importing for breadth — but it's
exactly the drift surface our single-source model was built to avoid.

### Action items A1–A8

- **A1** — Audit each target's exact format (frontmatter? naming? subdirs?). Source: each tool's docs, not assumed equivalence to Cursor/Cline.
- **A2** — Extend `generate_tools()` with symlink targets for Kilo Code (`.kilocode/rules/`) + OpenCode (`.opencode/skills/`). Reuse Cursor/Cline strategy.
- **A3** — Add Aider concat target (`CONVENTIONS.md`). Reuse Windsurf strategy with new output filename.
- **A4** — Add Codex target (format TBD per A1). May be new strategy or symlink-clone.
- **A5** — Extend `scripts/install.sh` with `--tool <name>` flag (claude-skills' interface) so users can target one platform instead of all 7+. Backward-compatible default = all.
- **A6** — Update `task generate-tools` summary table (`docs/architecture.md` + AGENTS.md "Multi-agent tool support" table).
- **A7** — CI: add smoke test per new target (file count > 0, no broken symlinks). Extend `tests/test_install.sh`.
- **A8** — Defer OpenClaw / Hermes / Antigravity to a follow-up phase pending format-stability + global-install design.

### Installer / CLI gap (verified, no action needed)

Reviewed claude-skills' installer + CLI surface against agent-config's:

- **Universal CLI (`npx agent-skills-cli`)** — agent-config has `./agent-config <command>` (project-local wrapper). No npm publish needed; the gap is *discoverability*, not capability. Defer to identity-decision phase.
- **Per-tool install** — claude-skills uses `./scripts/install.sh --tool <name> --target <dir>`. agent-config has `bash scripts/install.sh` (payload) + `python scripts/install.py` (bridges, settings, hooks). **Two-stage is richer**, not worse. A5 backports the `--tool` flag; the bridge layer stays.
- **CI verifiability** — agent-config wins (`task ci` is a FAIL=0 gate; claude-skills relies on file-count spot checks). No change.
- **Cloud bundles** — agent-config wins (T3-H gated cloud ZIPs); claude-skills has marketplace listing only. Tied to identity decision.

**Verdict:** installer architecture is **better** in agent-config; the only borrowable improvement is the `--tool` flag (A5). CLI commands are roughly equivalent in capability; agent-config is local-only by design (no npm dep), claude-skills is npx-distributable.

## Proposed actions

Block sequence is locked B → A → C → D-pilot → F per the table in
"Decisions (synthesized)". ICE prioritisation below confirms each
block fits inside the 6-week visible plate (`road-to-governance-cleanup.md`
horizon rule); blocks below the median ICE are **inside the plate
anyway** — sequencing is fixed by dependency, ICE is a sanity check
that the dependency chain itself is worth running, not a re-ordering
gate.

### ICE table for Phase 1

Impact (1–5: leverage on the Thinking Layer goal — depth + identity),
Confidence (1–5: clarity of deliverable + dependencies known), Ease
(1–5: estimated effort inverted — 5 = ≤ 1 week, 1 = ≥ 5 weeks).
Score = I × C × E. **Median score 48.** Sequencing is locked by
dependency (B → A → C → D → F), not by ICE; the table is a sanity
check on the chain.

| Block | I | C | E | Score | Notes |
|---|---:|---:|---:|---:|---|
| **B — Skill reorg** | 3 | 5 | 5 | **75** | Highest ease; unblocks A; cheap once `domain:` taxonomy is locked |
| **A — Personas** | 5 | 4 | 3 | **60** | #1 leverage per all three reviewers; spine + 8 personas; medium effort |
| **C — Stakeholder skills** | 4 | 4 | 2 | **32** | High value but 8 skills × 4–6 weeks; longest single block |
| **D — Python tools (pilot)** | 3 | 3 | 3 | **27** | Net-new surface; hard-bounded pilot; eval gate decides scale-out |
| **F — UI skills** | 4 | 4 | 2 | **32** | Gated by sibling roadmap; 6 skills × 4–5 weeks |

**Inside-plate set:** all five blocks. The 6-week plate is satisfied
by B + A (4 weeks combined) plus the parallel start of C in A's
last week. C's tail (4–6 weeks) overflows the plate by design and
becomes the first work item of the **next** plate; same for D and F.

**Sequencing read:** B and A together are the **must-ship slice**
of this plate. C, D, F are listed inside Phase 1 because they are
ready to start, not because they all complete inside 6 weeks.

## Risk register

Forward-looking risks for Phase 1 execution. AI #2's eight-row
historical register stays in the AI feedback section below; this is
the **consolidated operational view** the executor reads before
starting a block. Risk numbers are stable identifiers — referenced
by sub-step working notes and post-mortems.

| # | Risk | Block | Likelihood | Impact | Mitigation | Owner-marker |
|---|---|---|---:|---:|---|---|
| R1 | **Persona-schema bikeshed** — 6-section spine vs claude-skills' 9-section drains 2+ weeks before any persona ships | A | M | M | A1 locks the schema in week 1; PR template requires schema citation; deviations require new ADR, not section-level edits | A1 |
| R2 | **Block D explosion** — pilot 3 tools succeeds, momentum pushes scope to 20+ tools without re-evaluating the kill-switch | D | H | H | D5 eval gate is **hard**: pass continues pilot scope discussion only, never auto-promotes. New tools after pilot require an explicit ADR + ICE entry | D5 |
| R3 | **`domain:` taxonomy churn** — domain folders renamed mid-flight after some skills moved, breaking symlinks and tool projections | B | M | H | B1 locks taxonomy in `docs/contracts/skill-domains.md` **before** any file move; renames after B4 require a contract bump (`stable` policy) | B1 |
| R4 | **Override bloat** — consumer projects override every persona to fit local naming, defeating the shared layer | A · C | M | M | A1 schema documents override surface (frontmatter override only, body override = full replace); `override-management` skill called out in persona docs | A1 + C |
| R5 | **Block C scope drift** — `code-review-multi-lens` swells into a meta-skill that subsumes the four existing judges (`judge-bug-hunter`, `judge-security-auditor`, `judge-test-coverage`, `judge-code-quality`) | C | M | M | C8 explicitly framed as **composite verdict** orchestrating the four existing judges, not a replacement; `subagent-orchestration` is the dispatch surface | C8 |
| R6 | **Personas misread as agents** — readers expect persona invocation to spawn a sub-agent, not a mode the host agent adopts | A | H | M | A6 docs lead with "personas are modes, not agents"; `mode` command is the canonical invocation; persona description warns against agent-style framing | A6 |
| R7 | **Linter false positives in `lint_skill_tools.py`** — stdlib-only check trips on legitimate `dataclasses` / `typing` usage | D | L | L | D1 allowlist explicit (stdlib + typing + dataclasses + json + argparse); test fixture covers all allowed imports; new rejections require linter ADR | D1 |
| R8 | **F gate slips** — engine R1 phase 4 from sibling roadmap delays, F sits idle while C is still running, momentum collapses | F | M | M | F-block scheduling is **dependent**, not parallel; if R1 phase 4 slips > 2 weeks, F is explicitly deferred to the next plate, not held in limbo | F |
| R9 | **Sub-step inflation** — Phase 1 grew from 5 block-steps to ~30 sub-steps; future blocks tempted to follow the same density and the dashboard becomes noise again | Phase 1 | M | M | Sub-steps in this roadmap reflect actual deliverables (one persona, one skill, one tool); future blocks expand similarly **only** when each sub-step maps to a shippable artefact, not a planning checkpoint | (template) |
| R10 | **Phase 1 unlock criteria slip** — Block B starts before `road-to-post-pr29-optimize.md` Phase 1 ships green CI | B | L | H | Block B row carries an explicit gating note; PR opening Block B work requires a cite-line to a green-CI sha on `main` for the post-pr29 plate | B |
| R11 | **Marketing pull on Block A** — distribution roadmap (sibling) starts pulling persona work into Block H demos before A6 ships | A · sibling H | M | M | Sibling roadmap H phases gated on "Thinking Layer Blocks A + C ≥80% shipped"; A6 is the explicit unlock for marketing reuse | A6 |
| R12 | **Copy-by-claude-skills** — claude-skills picks up the OSS-light governed alternative framing and ships a thinner copy under their brand | identity | L | M | Identity locked in `road-to-governance-cleanup.md` F1 (OSS-light governed alternative); differentiator is governance + override + compression, not skill count; `agent-config` ships discipline, not breadth | (identity) |

## Next step

> Refactor the 178-step backlog to "current 6-week plate +
> out-of-horizon backlog" (Decisions, Roadmap horizon). Then start
> Block B (skill reorg) once Phase 1 of `road-to-post-pr29-optimize.md`
> lands.
