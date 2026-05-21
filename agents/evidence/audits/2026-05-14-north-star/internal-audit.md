# Internal Audit — Five Perspectives

**Date:** 2026-05-14
**Method:** Five role-passes through the repo as it exists at v2.10.0.
Each pass names the pain point a senior-level practitioner in that role
would refuse to let ship. No hedging, no "but we already have X" excuses
unless X actually closes the gap end-to-end.

Baseline counts at audit time:

- 61 rules · 208 skills · 217 Python scripts in `scripts/`
- 5 active roadmaps (155 steps) · 1 archived
- 13 council findings open from `2026-05-14-v2-analysis`
- 91 linter WARN, `task ci` exits 0 (per finding U2)

---

## Pass 1 — Developer (senior IC, six months in)

| # | Pain | Evidence | Brutal verdict |
|---|---|---|---|
| D1 | Skill set is too large to learn | 208 SKILL.md files; many overlapping (triad `project-analysis-*` / `universal-project-analysis` / `analysis-skill-router`; council session orchestrators; persona writers); no map of "which 30 are essential" | A senior on day-1 cannot tell which skills the agent will actually pick. Onboarding mode = read everything. We're a library, not a curated kit. |
| D2 | Frontmatter contract not enforced semantically | `lint-skills` checks fields exist, not whether description triggers fire; trigger overlap exists (`auto-rules-overlap.json` produces 30+ collision pairs we don't act on) | Adding a new skill = guessing about trigger neighborhood. No `distinguishes_from` to encode the disambiguation. |
| D3 | `.agent-src/` / `.augment/` / `.claude/` / `.cursor/` / `.clinerules/` regeneration is opaque | `task sync` + `task generate-tools` work, but the diff is huge and unreviewable when something goes wrong | A bisect across 4 generated trees is hostile. We need per-tool diff fixtures. |
| D4 | Iron Law surface is large for kernel | 9 always-loaded rules + tier-1 + tier-2 routing; agent-portability test passes but token cost of "always loaded" is not measured anywhere | We assume the kernel is small enough. Caveman measured. Harmonist split with `## Deep Reference`. We do neither. |
| D5 | No `CONTRIBUTING.md` flow for outside PR | Council F1: single-author; D3: CONTRIBUTING references a council pattern not yet codified | An external contributor cannot land a skill without a private chat. Bus factor 1 is structural. |
| D6 | 217 Python scripts | Many one-off; no `scripts/_lib` discipline that would survive author rotation | `script-writing` skill exists but enforcement is by review, not test. |

**Sharpest dev complaint:** "I cannot tell whether my new skill conflicts
with three existing ones without running collision detection by hand."

---

## Pass 2 — Tester (QA-lead, owns the trust line)

| # | Pain | Evidence | Brutal verdict |
|---|---|---|---|
| T1 | No selection-accuracy number | Council F5 / D2 / R3 protocol locked but not implemented; "did the agent pick the right skill for this prompt?" is unmeasured | We claim coverage; we cannot defend it. Industry-standard: 50–200 prompt fixture set, expected skill / rule fires, percentage measured. |
| T2 | Golden outcomes cover rules, not skills | `tests/golden/outcomes/*.json` exist for ~6 always-rules (ask-when-uncertain, direct-answers, …); zero for 208 skills | The skill layer is unit-tested only for structure. Behavioural drift undetected. |
| T3 | 91 linter WARN, CI green | `task lint-skills` outputs 91 warnings; `task ci` exit 0 — warn-vs-error boundary porous | A test suite that warns and ships is not a gate. Per finding U2, this is the cheapest fix in the audit and still open. |
| T4 | No per-tool projection fidelity test | Pipeline C (multi-tool projection) regenerates 4 tool trees; we compare bytes via `task verify-projection`, not behaviour | Two trees that differ in body but project identical triggers / decisions = false positive. Two trees that look identical but route differently = silent regression. |
| T5 | Telemetry contract has no end-to-end test | `artifact-engagement-recording` rule + `telemetry:record` calls; nothing asserts the calls actually fire end-to-end on `/implement-ticket` or `/work` runs | The "did the rule activate?" question is asked by the rule itself. Self-reporting is not measurement. |
| T6 | No regression test for description / trigger edits | A trigger phrase change in `direct-answers` description has no auto-test that the rule still fires on the original corpus | `description-assist` skill helps authoring; not enforcement. |

**Sharpest tester complaint:** "I cannot prove a single skill description
change is safe. We diff bytes; we don't diff behaviour."

---

## Pass 3 — Product Owner (owns user outcome)

| # | Pain | Evidence | Brutal verdict |
|---|---|---|---|
| P1 | No north-star metric | Mission stated in `docs/contracts/package-self-orientation.md`; success criterion = ? | A package preaching token economy with no measured token saving is a contradiction. Pick one number and own it. |
| P2 | Adoption funnel undefined | `README.md` install path, `onboard` skill, `.agent-settings.yml` — but no "first 24 hours" path articulated | We do not know what success on day 1 looks like for a new user. | <!-- ref-ignore -->
| P3 | Roadmap count high, finished count low | 5 active roadmaps × 155 steps, 0 / 155 done (per current dashboard); 1 archived (`road-to-productization`) | Velocity is invisible to outside observer. Council F7 / U4 (roadmap trajectory) is the formal version of this. |
| P4 | No "what's new in 2.10" | Tag exists; CHANGELOG has entries; no "for a user who installed 2.8, this is what changed for you" | Internal users (matze4u and downstream) re-read PRs. External users see nothing. |
| P5 | Persona axis (11 review lenses) is invisible | `personas:` mechanic exists; no user-facing "which persona should I activate for code review?" doc | Power feature, undocumented surface. KW-plugins style "one plugin per role" makes the same axis discoverable. |
| P6 | "Senior dev" goal is not a measurable bar | The user-facing prompt is "be a senior dev assistant". Senior on what axis? Throughput? Correctness? Token cost? Review depth? | A POdef needs at least three KPIs and a primary. |

**Sharpest PO complaint:** "I cannot tell a stakeholder what this package
improved month-over-month."

---

## Pass 4 — Strategist (positioning, competition, moat)

| # | Pain | Evidence | Brutal verdict |
|---|---|---|---|
| S1 | One-liner missing | `event4u/agent-config — shared skill / rule / command suite for AI coding tools` is accurate, not differentiating | Caveman: "why use many token when few do trick". Harmonist: "186 specialist agents, schema-routed". Ruflo: "30+ plugins, swarm + cost". Ours: feature list. |
| S2 | TAM ambiguous | We project to 4 tools (Augment / Claude / Cursor / Windsurf+Cline). README does not state which is the primary support tier. | A new user on Cursor cannot tell if they are first-class or fallback. |
| S3 | Moat = Iron Law + persona depth, undermarketed | Strongest differentiators are buried in `.augment/rules/` and `docs/personas.md` | Public README leads with install, not with "this is the rule-discipline framework". |
| S4 | No competitive table | We've never written "ours vs caveman vs ruflo vs harmonist". Internal `competitive-positioning` skill exists; no produced output | We compete on multi-tool reach, mechanical Iron Law, and persona depth. None of that is on the README. |
| S5 | Adoption story trails KW-plugins | One-install + role bundle (engineering / PM / design) is a 30-second on-ramp. We require onboarding wizard + `.agent-settings.yml`. | Defensible for sophisticated users; loses to KW-plugins for the first 10 minutes. |
| S6 | Marketing surface = README + repo | No release note format, no changelog post template, no "what shipped this month" | `release-comms` skill exists; never invoked. Tooling without the practice. |

**Sharpest strategist complaint:** "We are best-in-class at three things
and famous for none of them."

---

## Pass 5 — AI Specialist (the lens that owns model behavior)

| # | Pain | Evidence | Brutal verdict |
|---|---|---|---|
| A1 | Skills loaded whole | Even with `## Deep Reference` available as a discipline (we cite harmonist), no skill uses it. The 25 largest skills are 300–500 lines, loaded fully when matched. | Caveman compresses output. Harmonist compresses essentials-vs-deep. We compress neither at the skill body level. |
| A2 | No model-tier hint per skill | `subagent-orchestration` reads `.agent-settings.yml.subagent_models`; the skill itself does not declare its cost class | Routing decisions are global, not per-skill. A `quality-tools` lint check and a `risk-officer` cross-cut analysis pick the same model class. |
| A3 | Iron Law enforcement is agent-side | Rules say "ALWAYS / NEVER"; the runtime relies on the agent reading them. No stop-hook equivalent of harmonist's `.cursor/hooks/stop.json`. | Iron Laws are as strong as the worst agent that reads them. |
| A4 | Mechanical post-write gate missing | `verify-before-complete` rule defines the gate; `verify-completion-evidence` skill defines the procedure; no runtime hook blocks the "done" token without evidence | Compliance proven by golden outcomes (test-time), not runtime (user-time). |
| A5 | `caveman.speak_scope` is opt-in `off` by default | The token-economy practice we cite as best-in-class is shipped behind a flag most users never flip | We have the skill (`caveman-speak` rule) and don't dogfood it. Caveman ships it default-on. |
| A6 | No PROJECT PRECEDENCE preamble for subagents | Skills like `subagent-orchestration` invoke subagents; no required first-line `AGENT: <slug>` marker; no injected project-rule preamble | A subagent runs on generic Augment defaults and may violate the host project's invariants without noticing. |
| A7 | Memory system asymmetric | MCP memory has trust score / contradictions / dedup — strong; no CLI fallback (cf. harmonist `python3 memory.py append`); offline users cannot write | A subset of users (offline, pre-MCP, package-only) have no memory write path. |
| A8 | No correlation-id mechanism | Memory entries have IDs; no session-level join key linking decision + pattern + telemetry across one task | Cross-cut analysis ("which sessions invoked persona X and finished with negative outcome") is impossible. |

**Sharpest AI specialist complaint:** "Our Iron Laws are advisory, our
compression is opt-in, our gates run at release-time not user-time."

---

## Composite — the four gaps every role names

Triangulating across all five passes:

| Gap | Roles that name it | Severity |
|---|---|---|
| **Measurement** — no selection accuracy, no token saving, no cost surface, no behavioural fidelity | Tester (T1, T2, T4, T5, T6), PO (P1, P6), Strategist (S1, S6), AI (A5) | **Critical** |
| **Mechanical enforcement** — Iron Laws are agent-side; no runtime stop-hook; no `AGENT: <slug>` marker | Tester (T3, T5), AI (A3, A4, A6) | **Critical** |
| **Schema rigor** — no `distinguishes_from`, no model-tier, no `## Deep Reference`, no schema version | Developer (D1, D2, D4), AI (A1, A2) | **High** |
| **Adoption ramp** — no role bundles, no "standalone + supercharged" table, no day-1 path | Developer (D5), PO (P2, P5), Strategist (S5) | **High** |

These four gaps are the North Star inputs. See
[`north-star-plan.md`](north-star-plan.md) for the import sequence,
roadmap mapping, and which existing roadmaps absorb the work vs which
need new files.
