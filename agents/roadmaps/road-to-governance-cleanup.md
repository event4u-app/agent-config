# Road to Governance Cleanup

**Status:** PHASE 1 EXECUTING — decisions synthesized 2026-05-01 from
two external AI reviews (Claude, ChatGPT) plus self-synthesis. Sequencing
locked. ICE table populated. Open questions closed. User promoted Phase 1
out of capture-only 2026-05-02.
**Started:** 2026-05-01
**Trigger:** User-driven optimize pass: command count fragmentation, rule/skill
naming overlap, Augmentcode 49k always-rule budget breach. Plus benchmark optimize-lens
on `alirezarezvani/claude-skills` (governance shape, not skill depth). Identity
drift surfaced 2026-05-01: package positioned as Laravel/PHP-first while substance
is framework-agnostic.
**Mode:** Phase 1 execution (F1, F3, F2-top-3, F4, F5, F6, F7) — sequencing
locked per Order-of-Operations (F1 → F3 → F2/F4/F5/F6/F7). Phase 2 (F2
remaining 12 clusters) stays capture-only until Phase 1 ships.

## Purpose

Seven structural findings on the *governance layer* of `event4u/agent-config` —
rule budget, command fragmentation, naming overlap, guideline-layer ambiguity,
discovery surface, hidden char consumption, identity drift. Each finding ships
with 2-4 named options + trade-offs, no pre-selected path. ICE scoring deferred
until user chooses options.

This roadmap is **structural cleanup**, not feature work. Sister tracks:

- `road-to-post-pr29-optimize.md` — engine/governance/docs (post-1.14.0, 4 AI sources)
- `road-to-better-skills-and-profiles.md` — persona / skill-depth / orchestration

**Out of scope** for this roadmap (handled separately):

- Persona work, stakeholder skills, Python tools per skill (better-skills track).
- Engine R1 phases 3–7, work-engine modularization (optimize track).
- OSS distribution strategy, Medium articles, sponsorship (better-skills track).
  Note: README/docs *positioning surface* moved IN scope via Finding 7.

**Phase 1 (F1, F3, F2-top-3, F4, F5, F6, F7) is approved for execution.**
Phase 2 (F2 remaining 12 clusters) waits one release cycle.

## Horizon (6-week visible plate)

Per `road-to-better-skills-and-profiles.md` "Roadmap horizon" decision —
6 weeks is the visible commitment plate; anything outside is **out-of-horizon** (beyond 6 weeks).

**Inside the plate (this 6-week window):**

- F1 (always-rule budget) — CRITICAL, blocks every other rule edit.
- F3 (naming convention rename pass) — gated on F1.1 + F1.2.
- F2 phase 1 (top-3 verb clusters: `/fix`, `/optimize`, `/feature`).
- F4 (guideline relocation + ship-metadata).
- F5 (discovery index generator).
- F6 (description-budget linter pass).
- F7 (identity reframe — README, getting-started, topics, AGENTS.md).

**Outside the plate (out-of-horizon, next release window):**

- F2 phase 2 (remaining 12 verb clusters) — waits one deprecation cycle.
- Augmentcode budget recheck on next upstream release.

## Sources

| # | Source | Date | Scope | Status |
|---|---|---|---|---|
| 1 | Hard data audit (this repo) | 2026-05-01 | Rule chars, command count, skill count, naming-overlap grep | Captured below |
| 2 | Benchmark — `alirezarezvani/claude-skills` (optimize-lens) | 2026-05-01 | Top-level concepts, command count, always-active surface, discovery path | Captured below |
| 3 | Identity audit (README, docs, github-topics) | 2026-05-01 | Laravel/PHP-first positioning vs framework-agnostic substance | Captured as Finding 7 |

## Hard data (verified)

| Metric | Value | Augmentcode budget | Status |
|---|---:|---:|---|
| Always-active rules (count) | 18 | — | — |
| Always-active rules (chars, compressed) | **93,652** | **~49,000** | ❌ **191 % over** |
| Always-active rules (chars, uncompressed) | 97,612 | — | — |
| All rules combined (compressed) | 199,530 | — | — |
| Commands total | **77** | — | claude-skills: ~10 |
| Skills total | 128 | — | — |
| Guidelines total | 46 | — | — |
| Hard rule↔skill name collision | **1** | — | `verify-before-complete` |

**Top-5 always-rules eat ~40k chars on their own:** `chat-history` (10.3k) ·
`autonomous-execution` (9.6k) · `language-and-tone` (8.1k) · `non-destructive-by-default`
(6.5k) · `command-suggestion` (6.0k).

## Finding 1 — Always-rule budget breach (CRITICAL)

**Diagnosis:** 18 always-active rules sum to 93,652 chars (compressed), 191 % over
the ~49k char budget Augmentcode considers safe. Compression alone cannot close
the gap (existing pass already saves only ~5 %).

| Option | Idea | Trade-off |
|---|---|---|
| **A — Tiering** | Split into "safety floor" (always: ≤49k) + "operational guidance" (auto-trigger). Keep always: `non-destructive-by-default`, `scope-control`, `commit-policy`, `ask-when-uncertain`, `direct-answers`, `language-and-tone` (trimmed), `verify-before-complete`. Demote to auto: `chat-history`, `command-suggestion`, `model-recommendation`, `onboarding-gate`, `ui-audit-before-build`. | 18→~7 always-rules, ~35k chars. Risk: auto-trigger precision must rise. |
| **B — Body relocation to `agents/contexts/`** | Large always-rules keep header + Iron Law inline; mechanics, tables, examples move to `agents/contexts/<rule>-mechanics.md`. Rule references context. | All rules stay always; each <2k. Risk: agent must read context → more tool calls. Effective char saving only if context loads stay rare. |
| **C — Hard merge of overlapping rules** | `autonomous-execution` + `commit-policy` + `non-destructive-by-default` + `scope-control` share ~30 % textual overlap (all four answer "may the agent do this autonomously?"). Merge into single `agent-authority.md` with clear sections. | -10 to -15k chars; fewer cross-refs to maintain. Risk: 1 large rule replaces 4 small ones — harder to audit per concern. |
| **D — Always-rule-only aggressive compression profile** | Separate compression pass with stricter budget targeting only `type: always`. | Fast; diminishing returns (existing compression already ~5 %). No 50k saving on its own. |

**Synthesis read:** **A + C combined** is the only path that reaches <49k without
function loss. B+D alone are insufficient.

## Finding 2 — 77 commands fragment intent

**Diagnosis:** claude-skills runs ~10 orchestrator-style commands; agent-config
runs 77 atom-style commands, many of which are sibling variants of the same verb.
User cognitive load: high; new-user onboarding: hard.

**Verb-noun collapse candidates (15 clusters, no functionality lost):**

| Today | Collapse to | Net |
|---|---|---:|
| `feature-explore` · `feature-plan` · `feature-refactor` · `feature-roadmap` | `/feature [explore\|plan\|refactor\|roadmap]` | 4→1 |
| `chat-history` · `chat-history-resume` · `chat-history-clear` · `chat-history-checkpoint` | `/chat-history [show\|resume\|clear\|checkpoint]` | 4→1 |
| `fix-ci` · `fix-pr-comments` · `fix-pr-bot-comments` · `fix-pr-developer-comments` · `fix-portability` · `fix-references` · `fix-seeder` | `/fix [ci\|pr\|portability\|refs\|seeder]` | 7→1 |
| `optimize-agents` · `optimize-augmentignore` · `optimize-rtk-filters` · `optimize-skills` | `/optimize [agents\|augmentignore\|rtk\|skills]` | 4→1 |
| `agents-audit` · `agents-cleanup` · `agents-prepare` | `/agents [audit\|cleanup\|prepare]` | 3→1 |
| `memory-add` · `memory-full` · `memory-promote` · `propose-memory` | `/memory [add\|load\|promote\|propose]` | 4→1 |
| `roadmap-create` · `roadmap-execute` | `/roadmap [create\|execute]` | 2→1 |
| `module-create` · `module-explore` | `/module [create\|explore]` | 2→1 |
| `tests-create` · `tests-execute` | `/tests [create\|execute]` | 2→1 |
| `context-create` · `context-refactor` | `/context [create\|refactor]` | 2→1 |
| `override-create` · `override-manage` | `/override [create\|manage]` | 2→1 |
| `copilot-agents-init` · `copilot-agents-optimize` | `/copilot-agents [init\|optimize]` | 2→1 |
| `commit` · `commit-in-chunks` | `/commit [--in-chunks]` | 2→1 |
| `do-and-judge` · `do-in-steps` · `judge` · `review-changes` | `/judge [solo\|steps\|on-diff]` + `/review` (separate) | 4→2 |
| `create-pr` · `create-pr-description` | `/create-pr [--description-only]` | 2→1 |

**Net:** 77 → ~38–42 top-level commands. Sub-commands surface via `/cmd <Tab>`.
Old commands stay as deprecation shims for one cycle.

| Option | Idea | Trade-off |
|---|---|---|
| **A — Full collapse** | All 15 clusters in one go | -35 commands; one cycle of deprecation noise; clear new mental map |
| **B — Top-3 clusters only** | `/fix`, `/optimize`, `/feature` first | -13 commands; low risk; restructure pattern is learned before scale-out |
| **C — Discovery command instead** | `/help <intent>` central entry, all 77 commands stay | Zero migration; underlying problem unsolved |

## Finding 3 — Naming overlap between rules and skills

**Diagnosis:** One hard collision (`verify-before-complete` exists as rule AND
skill); four soft overlaps where rule and skill/command share a domain name
without a clarifying convention.

| Rule (always) | Sibling artifact | Overlap |
|---|---|---|
| `verify-before-complete` | `verify-before-complete` (skill) | **hard** — skill is the procedure, rule is the obligation. Confusion risk. |
| `chat-history` | `chat-history`, `-resume`, `-clear`, `-checkpoint` (commands) | **soft** — rule = policy, commands = UI. Different concerns, identical names. |
| `ui-audit-before-build` | `existing-ui-audit` (skill) | **soft** — rule says "do it", skill is the tool. Inconsistent naming. |
| `command-suggestion` | `slash-commands` (rule) + `command-routing` (skill) | **conceptual** — three artifacts in one domain, no naming spine. |
| `commit-policy` | `commit`, `commit-in-chunks` (commands) | **soft** — policy vs. tools. |

| Option | Idea | Trade-off |
|---|---|---|
| **A — Naming convention** | Rules: policy verbs (`*-policy`, `*-floor`, `*-gate`). Skills: tool nouns (`existing-ui-audit`, `verify-completion-evidence`). Rename ~6 artifacts. | Clear mental map. Cost: ~6 renames + cross-ref updates everywhere. |
| **B — Suffix convention** | Rules keep names; skills get `-tool` or `-procedure` suffix. | Lower migration; suffix noise in every skill name. |
| **C — Status quo + glossary** | Don't rename; document the distinction in a README glossary. | Zero migration; confusion persists. |

## Finding 4 — Guidelines are an ambiguous third artifact type

**Diagnosis:** 46 guidelines exist with no frontmatter trigger. Unclear whether
they are passive references (cited from skills/rules), auto-injected context, or
documentation. No rule classifies them. Hidden char consumption risk if any
agent tooling auto-loads them.

| Option | Idea | Trade-off |
|---|---|---|
| **A — Guidelines = referenced only** | Explicit declaration: never auto-loaded; only skill/rule body links to them. Move to `docs/guidelines/`. | Clear = doc layer. Loses the "agent-aware" framing. |
| **B — Guidelines = skill sub-layer** | Skills load their guidelines explicitly via path. Linter checks path existence. | Keeps current shape; adds linter rule. |
| **C — Dissolve guidelines** | Inline content into the skills that cite them; delete guideline files. | -46 files; +verbose skills; lossy if multiple skills cite the same guideline. |

## Finding 5 — Discovery surface for 304 artifacts

**Diagnosis:** 53 rules + 77 commands + 128 skills + 46 guidelines = 304
artifacts. README and AGENTS.md list neither all of them nor the trigger
conditions. claude-skills covers ~10 commands + ~30 skills with a single README;
agent-config has 10× the surface and no central index.

| Option | Idea | Trade-off |
|---|---|---|
| **A — Auto-generated `agents/index.md`** | Generator scans `.agent-src.uncompressed/`, emits one row per artifact: name · type · trigger · 1-line purpose · link. Re-runs in `task ci`. | Single discovery entry; bonus: generator can flag naming-convention violations. |
| **B — Per-type indexes** | `agents/index-rules.md`, `-skills.md`, `-commands.md`, `-guidelines.md`. | Smaller files; user has to know which type to look at. |
| **C — README expansion** | Inline-list everything in README. | Zero new infra; README breaks the 500-line linter cap immediately. |

## Finding 6 — Hidden char consumption in `available_skills` block

**Diagnosis:** Augmentcode emits an `<available_skills>` block with all 128
skill names + descriptions in the system prompt. Estimated size ~25-35k chars
*on top of* the 93k always-rule budget. The 49k Augmentcode limit nominally
covers rules; the actual per-turn budget is well above 120k once skills are
counted.

`optimize-augmentignore` command exists. Open question: is it being run as part
of regular project hygiene, or is it dormant?

| Option | Idea | Trade-off |
|---|---|---|
| **A — Schedule augmentignore reviews** | Include in `task ci` or a periodic command. Each consumer project keeps its `.augmentignore` aggressive. | Reduces per-turn overhead by 10-20k for small projects. |
| **B — Ship default `.augmentignore` per stack** | Templates per stack (Laravel, Next.js, etc.); installer applies. | Lower friction for new projects; needs stack detection. |
| **C — Description budgets per skill** | Hard cap on skill `description:` length (e.g. 200 chars); enforce via linter. | -5 to -10k chars on the available_skills block; mechanical. |

## Finding 7 — Identity drift: positioned as Laravel/PHP-first, substance is universal

**Diagnosis:** The package's actual capability surface is framework-agnostic
(engine, personas, memory, governance, work_engine, six dedicated
project-analysis skills covering Laravel · Symfony · Zend/Laminas · Next.js ·
React · Node/Express). Yet the **positioning layer** (README tagline, docs
audience tables, GitHub topics, getting-started flow) consistently frames the
package as Laravel/PHP-first with everything else demoted to second-class.
This contradicts the substance and locks the package out of mindshare in
JS/TS/Python/Go/Rust/Symfony shops. Stack-specific skills (`laravel`,
`eloquent`, `pest-testing`, `php-coding`) are correctly scoped and stay —
the problem is exclusively at the **identity / marketing surface**.

**Verified hits (audit, 2026-05-01):**

| File | Line | Drift |
|---|---:|---|
| `README.md` | 3 | Tagline opens "Teach your AI agents Laravel, PHP, testing…" |
| `README.md` | 5 | Sub-tagline: "Your agent learns to write Laravel code…" |
| `README.md` | 22 | First install snippet: `# PHP\ncomposer require…` |
| `README.md` | 270-272 | "**built for PHP / Laravel teams**", "primary audience" |
| `README.md` | 277-279 | Audience matrix: Laravel = "✅ Primary"; JS/TS = "☑️ noise" |
| `README.md` | 292-294, 299 | Skill/command examples are 100 % Laravel/PHP |
| `docs/getting-started.md` | 6 | First onboarding block is `composer require` |
| `docs/architecture.md` | 62, 65 | Skill/guideline sample descriptions only Laravel/PHP |
| `docs/github-topics.md` | 30 | "`laravel` — Primary domain — Laravel projects are the main audience" |

**Counter-evidence (substance is already universal):**

- 6 `project-analysis-*` skills cover Laravel, Symfony, Next.js, React, Node/Express, Zend/Laminas.
- `analysis-skill-router` routes by detected stack, not by hardcoded Laravel.
- `directives/ui/*` dispatcher selects `blade-ui` · `flux` · `livewire` · `react-shadcn-ui` based on detected frontend stack.
- AGENTS.md (this repo): "**No PHP, no Laravel**, no JavaScript runtime dependencies." — already correct for the package self-description.
- Engine, memory, governance, work_engine, refine-prompt, refine-ticket, role-modes, contexts, telemetry — none are Laravel-coupled.

| Option | Idea | Trade-off |
|---|---|---|
| **A — Full universal reframe** | README tagline becomes stack-neutral ("Teach your AI agents your engineering standards, in any language"). Audience matrix lists Laravel · Symfony · Next.js · React · Node · Zend/Laminas as **co-equal primary**. GitHub topics drop `laravel` from "primary domain" framing, list it among supported frameworks. `getting-started.md` opens with stack-detection logic instead of `composer require` first. | Strongest re-positioning, biggest discoverability lift outside PHP. Cost: rewrite ~5 user-facing docs + topic curation. Risk: existing PHP audience may feel demoted. |
| **B — Two-track positioning** | Top of README: "Universal — works with any stack". Section "Reference implementation: Laravel" later, with Pest/PHPStan/Rector as the "fully-fleshed example". JS/TS/Symfony/Next get parallel sections at same depth, even if currently shorter. | Honest about current depth (Laravel skills are deepest), opens door without overclaiming. Migration cost lower than A. |
| **C — Stack-aware framing in docs** | Keep current README-A1 wording, but make it **dynamic**: stack-detection in the installer chooses which examples appear in `docs/getting-started.md` and the rendered `AGENTS.md`. The package self-presents to the project's stack. | Smallest text change; biggest infra change. Risk: positioning still leans PHP for anyone who reads the un-detected README first (e.g. on GitHub). |
| **D — Audit-only, defer reframe** | Document the drift, keep current copy, write a non-binding ADR. Useful if identity question (in `road-to-better-skills-and-profiles.md` open questions) is still unsettled. | Zero risk, zero progress. Only valid as a holding pattern until identity is decided. |

**Synthesis read:** **A + B together** is the consistent path — A is the
re-frame, B is the honest "Laravel is the most-fleshed-out reference impl"
caveat. C is an optional later addition (dynamic docs) but not a substitute.
D is only acceptable if the identity question stays explicitly open.

**Out of scope for this finding:**

- Renaming or removing stack-specific skills (`laravel`, `eloquent`, `pest-testing`, `php-coding`) — they stay as-is, they're correctly scoped tools.
- Building new framework-specific skill suites (Django, Rails, Spring, …) — that is `road-to-better-skills-and-profiles.md` territory.
- Translating user-facing docs to other languages — out of scope.

**Cross-roadmap note:** the identity question ("Galawork-internal vs OSS
product vs OSS-light") is open in `road-to-better-skills-and-profiles.md`.
Finding 7 here is the *positioning surface* — even after the identity is
decided, the surface needs reframing. The two questions are independent.

## claude-skills optimize-lens — what they do better, what we keep

| Aspect | claude-skills | agent-config | Read |
|---|---|---|---|
| Top-level artifact types | 3 (skill / agent / command), clear separation | 4 (rule / skill / command / guideline), unclear mandate | Finding 4 |
| Command count | ~10, each is an orchestrator | 77, many are atom operations | Finding 2 |
| Always-active layer | Single `CLAUDE.md`, ~10-15k | 18 files, 93k | Finding 1 |
| Discovery path | `/plugin-audit`, `/skill-create`, README → one entry | 304 artifacts, no index | Finding 5 |
| Naming overlap | Minimal (skill ≠ command clearly) | Hard + soft overlaps in multiple domains | Finding 3 |
| Hidden prompt consumption | Few skills, short descriptions | 128 skills surfaced with full descriptions | Finding 6 |

**What we do NOT copy from claude-skills:** their rule-less `CLAUDE.md` model
(unstable at scale), their thin test layer, their absent compression pipeline.
Their *governance shape* is borrowable; their *engineering discipline* is
weaker than ours.

## Synthesized themes

| Theme | Confidence | Why |
|---|---|---|
| Always-rule budget exceeds Augmentcode envelope | **High (1 source, hard data)** | Measured: 93,652 chars vs ~49k. Not a hypothesis. |
| Command surface fragments intent | **High (data + benchmark)** | 77 vs ~10; 15 collapse clusters identified. |
| Naming has no convention spine | **Medium** | 1 hard + 4 soft collisions. Not blocking, but compounding. |
| Guideline layer is undefined | **Medium** | 46 files with no trigger semantics. |
| Discovery surface unmapped | **Medium** | 304 artifacts, no index. |
| `available_skills` block is hidden tax | **Low (single source, estimated)** | Char count not measured per project. Verify before acting. |
| Identity drift: Laravel/PHP-first positioning vs universal substance | **High (audit, 9 verified hits)** | Measured against 6 project-analysis skills + framework-agnostic engine. Surface contradicts substance. |

## Decisions (synthesized 2026-05-01)

Synthesized from two independent AI reviews (Claude, ChatGPT) + self-read.
Cross-source agreement was high on F1, F2, F7; medium on F3, F5; low on F4,
F6 (single-source / mechanical). The seven findings form one cleanup release;
order of operations is locked below.

### F1 — Always-rule budget breach → **A + C-router combined**

- **Tier (A):** Demote to auto-trigger: `chat-history`, `command-suggestion`,
  `model-recommendation`, `onboarding-gate`, `ui-audit-before-build`,
  `chat-history` (trimmed). Keep always: `non-destructive-by-default`,
  `scope-control`, `commit-policy`, `ask-when-uncertain`, `direct-answers`,
  `language-and-tone` (trimmed), `verify-before-complete`.
- **C-router (revised 2026-05-01 after AI #5 review):** Do **not** fully
  merge the four safety rules into one `agent-authority.md`. The rules
  have distinct safety roles and merging destroys auditability:
    - `non-destructive-by-default` — absolute Hard Floor (own file)
    - `scope-control` — work boundaries (own file, trimmed)
    - `commit-policy` — commit-exception logic (own file, trimmed)
    - `autonomous-execution` — trivial-vs-blocking surface (auto-trigger,
      moved out of always-tier)
  - `agent-authority.md` becomes a **short always-active Priority Index**
    (~1.5k chars max): one-line per rule, authority band, link. Acts as
    the router agents read first; full bodies live in their own files.
- **Compression pass (D):** Run an always-only stricter compression profile
  *after* A + C-router; treat the saving as gravy, not the plan.
- **Skip (B):** Body-relocation is rejected — relocates pages, not authority;
  agents would still pay the cost on every read.

**Budget caps (added 2026-05-01 after AI #5 review) — all enforced by
`lint-skills` extension and CI:**

| Cap | Value | Rationale |
|---|---|---|
| Always-rules total | ≤ **49,000** chars | Existing constraint |
| Single always-rule | ≤ **8,000** chars | Prevents Monsterregel rebound |
| Top-5 always-rules combined | ≤ **28,000** chars | Distribution guard |
| `agent-authority.md` (router) | ≤ **1,500** chars | Index discipline |

**Confidence:** High. Per-rule caps and the router decision close the
two AI #5 risks (auditability loss · Monsterregel rebound). Cross-source
agreement that the total budget is the binding constraint.

### F2 — 77 commands → **B then A (phased collapse)**

- **Phase 1 (this release):** Top-3 verb clusters — `/fix` · `/optimize` ·
  `/feature`. Net: -13 commands. Sub-commands surface via `<Tab>` /
  `--<subcmd>`.
- **Phase 2 (next release):** Remaining 12 clusters listed in Finding 2.
  Net: -22 more commands. Final: 77 → ~38–42 top-level.
- **Old commands stay as deprecation shims for ONE release cycle**, then
  removed. No permanent aliases.
- **Reject C (`/help` only):** does not solve the underlying fragmentation;
  worst of both worlds (surface stays, indirection added).

**Confidence:** High. Cross-source agreement on phased over Big-Bang.

### F3 — Naming overlap → **A (naming convention)**

Rules use **policy verbs** (`*-policy`, `*-floor`, `*-gate`, `*-authority`).
Skills use **tool nouns** (`existing-ui-audit`, `verify-completion-evidence`).

| Rename | From | To |
|---|---|---|
| 1 | `verify-before-complete` (skill) | `verify-completion-evidence` |
| 2 | `ui-audit-before-build` (rule) | `ui-audit-gate` |
| 3 | merged authority rule | `agent-authority` |
| 4 | `chat-history` (rule, after tiering to auto) | `chat-history-policy` |
| 5 | `command-suggestion` (rule) | `command-suggestion-policy` |
| 6 | `slash-commands` (rule) | `slash-command-routing-policy` |

Cross-refs updated by `check-refs` linter; one deprecation cycle for old
names. **Reject B (suffix):** noise everywhere. **Reject C (glossary):**
does not solve confusion at the agent-loading layer.

**Confidence:** Medium. Single-source data but mechanical fix.

### F4 — Guidelines → **A (referenced only) + ship-metadata**

Guidelines are **never auto-loaded**; only skill/rule body links to them.
Move all 46 guideline files from `.agent-src.uncompressed/guidelines/` to
`docs/guidelines/`. Linter rule: skill/rule referencing a guideline must
use a `docs/guidelines/<name>.md` path; broken paths fail CI.

**Ship-metadata (added 2026-05-01 after AI #5 review).** Each guideline
declares in frontmatter:

```yaml
ship: true   # included in distributed package, linkable from public README
ship: false  # internal authoring/process only, excluded from package archives
```

- `ship: true` → projected to `docs/guidelines/` and shipped in npm +
  Composer archives. Public README can link.
- `ship: false` → stays under `agents/internal-guidelines/` (gitignored
  by package archive globs); README linker fails CI on links to these.
- Default during migration: **`ship: false`** unless explicitly opted in.
  Forces a per-file ship review rather than blanket exposure.

**Reject B (skill sub-layer):** keeps ambiguity, adds linter mass without
solving the load-semantics question. **Reject C (dissolve):** loses
content reuse across multiple skills; many guidelines are cited 3-5 times.

**Confidence:** Medium. Ship-metadata closes the AI #5 risk that
internal process docs leak into the distributed package.

### F5 — Discovery surface → **A (internal index) + public `docs/catalog.md`**

Two artefacts, one generator (`scripts/generate_index.py`):

| Artefact | Audience | Source scope | Rendered fields |
|---|---|---|---|
| `agents/index.md` | Internal authors | All artefacts in `.agent-src.uncompressed/` | name · type · trigger · 1-line purpose · ship-flag · link |
| `docs/catalog.md` | Package consumers | Only `ship: true` guidelines + all rules/skills/commands marked public | name · type · trigger · 1-line purpose · contract-stability · link |

Both run in `task ci` as a sync-check (drift = build break). The public
catalog is the single entry point linked from the public README; internal
index is for maintainers and never linked from the public surface.

Bonus pass: generator flags naming-convention violations (F3), unused
guideline files (F4), and broken public links (F4 ship-metadata) — one
tool, four guards.

**Reject B (per-type indexes):** smaller files but 4× the navigation hops.
**Reject C (README inline):** breaks the 500-line README cap immediately.

**Confidence:** Medium-high. Public/internal split closes the AI #5
risk that consumers cannot find the shipped contract surface, and the
README catalog link replaces ad-hoc deep-links.

### F6 — Hidden char consumption (`available_skills`) → **A + C combined**

- **A — Schedule augmentignore reviews:** `optimize-augmentignore` command
  surfaces in `task ci` as an advisory check (warn, not fail). New consumer
  projects run it in their onboarding.
- **C — Description-length budget:** Hard cap of **200 chars** per skill
  `description:`. Enforced by `lint-skills`. Existing 128 skills audited in
  the same pass; over-budget descriptions rewritten before this release ships.
- **Defer B (per-stack `.augmentignore` defaults):** good idea, requires
  reliable stack detection. Move to `road-to-better-skills-and-profiles.md`
  follow-up; not blocking this cleanup.

**Confidence:** Medium. Char saving is mechanical (~5-10k); review cadence
is operational.

### F7 — Identity drift → **A + B combined**

- **A — Universal reframe:** README tagline becomes stack-neutral. Audience
  matrix lists Laravel · Symfony · Next.js · React · Node · Zend/Laminas as
  co-equal. GitHub topics drop "primary domain — Laravel" framing.
  `getting-started.md` opens with stack detection, not `composer require`.
- **B — Laravel as flagship reference:** Explicit, honest framing —
  "Reference implementation: Laravel (deepest skill set: Pest, PHPStan,
  Rector, Eloquent, Livewire/Flux). Other stacks have parallel sections
  at matching depth as they grow." Pairs A's reach with B's honesty about
  current stack-skill density.
- **Reject C (dynamic stack-aware framing):** good infra, separate roadmap
  item. Does not block the surface fix.
- **Reject D (audit-only defer):** identity question is decided
  (OSS-light governed alternative — see post-pr29-optimize and
  better-skills-and-profiles); positioning surface must follow.

Stack-specific skills (`laravel`, `eloquent`, `pest-testing`, `php-coding`)
**stay as-is** — they are correctly scoped tools, not identity surface.

**Confidence:** High. Cross-source agreement (Claude + ChatGPT both A+B).

### Cross-cutting decisions

- **Migration cycle policy:** **One release** of deprecation shims for
  renamed/collapsed commands and renamed rules. Removed in the next.
  Permanent aliases rejected — they are a maintenance tax forever.
- **Scope-creep guard:** **Hard-stop at 7 findings.** New findings during
  execution become follow-up roadmap items, not in-flight scope expansion.
- **Order of operations (locked):**
  1. **F1 (budget)** — critical safety; everything else assumes the agent
     can load its own rules.
  2. **F3 (naming)** — must precede F2 because the merged `agent-authority`
     rule (F1-C) is the largest naming change.
  3. **F2 phase 1 (top-3 clusters)** — visible to users; deprecation shims
     give one cycle of grace.
  4. **F4 (guidelines move)** — pure file relocation; safe after F3
     cross-refs are updated.
  5. **F5 (index generator)** — runs in `task ci`; depends on F1+F3+F4
     for stable artifact names.
  6. **F6 (description budget)** — mechanical sweep; runs as a
     `lint-skills` extension.
  7. **F7 (identity reframe)** — README + getting-started + topics; safe
     last because it touches no agent-loaded content.
  8. **F2 phase 2 (remaining 12 clusters)** — next release, after one
     deprecation cycle.

## ICE prioritization

| # | Finding | Option | Impact | Conf | Ease | Score | When |
|---|---|---|---:|---:|---:|---:|---|
| 1 | F1 — Always-rule budget | A + C | 10 | 9 | 5 | 450 | Phase 1 (this release) |
| 2 | F3 — Naming convention | A | 7 | 8 | 7 | 392 | Phase 1 (precedes F2) |
| 3 | F2 — Command collapse (top-3) | B | 8 | 9 | 7 | 504 | Phase 1 |
| 4 | F4 — Guideline status | A | 6 | 7 | 8 | 336 | Phase 1 |
| 5 | F5 — Discovery index | A | 7 | 7 | 6 | 294 | Phase 1 |
| 6 | F6 — Description budget | A + C | 6 | 8 | 8 | 384 | Phase 1 |
| 7 | F7 — Universal identity reframe | A + B | 9 | 9 | 6 | 486 | Phase 1 (last) |
| 8 | F2 — Command collapse (rest) | A (12 clusters) | 7 | 8 | 6 | 336 | Phase 2 (next release) |

## Phase 1: Cleanup execution

- [x] F1.1 — Draft `agent-authority.md` as the C-router Priority Index (≤ 1,500 chars, always-active): one row per authority rule with its band (Hard Floor · Permission Gate · Commit Default · Trivial-vs-Blocking) and link. Iron Laws preserved verbatim **in their own files** — the router never restates them. *(Landed 2026-05-02: 1468 chars source/compressed, lint + check-refs + check-compression green, projected to `.augment/rules/`.)*
- [x] F1.2 — Demote to `type: auto`: `autonomous-execution`, `chat-history-cadence`, `chat-history-ownership`, `chat-history-visibility`, `command-suggestion`, `model-recommendation`, `onboarding-gate`, `ui-audit-before-build`, `user-interaction`, `think-before-action`, `token-efficiency`, `minimal-safe-diff`, `context-hygiene`. *(Landed 2026-05-02: Keep-list of 7 + router enforced; expanded set vs roadmap-original list is mathematically required to hit 49k cap given the locked keep list.)*
- [x] F1.3 — Trim `language-and-tone` to <6k always-char (relocate examples to `docs/guidelines/language-and-tone-examples.md`) *(Landed 2026-05-02: 8141 → 6568 chars; failure-mode list and wrong-vs-correct snippets relocated to `docs/guidelines/language-and-tone-examples.md`.)*
- [x] F1.4 — Run always-only compression profile; verify ≤ 49k total *(Landed 2026-05-02: total = **37,879 chars** across 8 always-rules — 11,121 chars under the 49,000 cap. agent-authority 1468 · ask-when-uncertain 5188 · commit-policy 4505 · direct-answers 4765 · language-and-tone 6568 · non-destructive-by-default 6516 · scope-control 4391 · verify-before-complete 4478.)*
- [x] F1.5 — Add CI guard `tests/test_always_budget.py` failing if total > 49k *(Landed 2026-05-02: 3 guards — total ≤ 49k · per-rule ≤ 8k · top-5 ≤ 28k. All green.)*
- [ ] F3.1 — Rename per F3 table; create deprecation stubs for old names *(requires: F1.1 + F1.2 done — `agent-authority.md` must exist and `chat-history` must be demoted to `type: auto` before the rename pass; otherwise the F3 table targets unstable artefact names)*
- [ ] F3.2 — Update `check-refs` to enforce policy-verb (rules) vs tool-noun (skills) split
- [ ] F2.1 — Implement `/fix`, `/optimize`, `/feature` orchestrators with sub-command dispatch
- [ ] F2.2 — Convert old commands to deprecation shims (one-line stub → routes to new)
- [ ] F2.3 — Update README + AGENTS.md command examples
- [ ] F4.1 — Move `.agent-src.uncompressed/guidelines/` → `docs/guidelines/`
- [ ] F4.2 — Update all skill/rule cross-refs to `docs/guidelines/<name>.md`
- [ ] F4.3 — Add `check-refs` rule rejecting old guideline paths
- [ ] F5.1 — Implement `scripts/generate_index.py` → `agents/index.md`
- [ ] F5.2 — Wire into `task ci` as drift check
- [ ] F6.1 — Audit all 128 skill descriptions; rewrite over-budget ones
- [ ] F6.2 — Add 200-char cap to `lint-skills`
- [ ] F6.3 — Surface `optimize-augmentignore` as advisory in `task ci`
- [ ] F7.1 — Rewrite README tagline + sub-tagline to stack-neutral
- [ ] F7.2 — Replace audience matrix with co-equal stack list + "Reference impl: Laravel" section
- [ ] F7.3 — Rewrite `docs/getting-started.md` opening: stack detection first
- [ ] F7.4 — Update `docs/architecture.md` sample descriptions to mixed stacks
- [ ] F7.5 — Update `docs/github-topics.md` to drop "primary domain" framing
- [ ] F7.6 — Audit AGENTS.md (root) for residual Laravel-first language

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| F1-C merged authority rule loses Iron-Law prominence | Medium | High | `iron-law-prominence-linter` runs against the new file; one Iron Law per section, banner format preserved |
| **R-Ordering — F3 rename pass runs before F1 tier/merge completes** (e.g. `chat-history` renamed to `chat-history-policy` while still in always-tier; `agent-authority.md` referenced by F3 table before F1.1 created it) | Medium | High | F3.1 carries a hard pre-condition on F1.1 + F1.2 (see Phase 1 checklist); locked Order-of-Operations (Cross-cutting decisions) sequences F1 → F3 → F2; PR-template requires reviewer to confirm all `F1.*` boxes ticked before opening any `F3.*` PR; `check-refs` fails CI if a rename targets a non-existent post-F1 artefact |
| F3 renames break user muscle memory | High | Medium | Deprecation shims one cycle; CHANGELOG with sed-friendly find/replace block |
| F2 sub-command dispatch confuses tab-completion | Medium | Medium | Test `/fix <Tab>` UX in two clients (Claude Code, Cursor) before release |
| F4 guideline relocation breaks cited cross-refs | Low | Medium | `check-refs` runs as part of the move PR; CI breaks on drift |
| F7 reframe alienates existing PHP audience | Low | Medium | "Reference impl: Laravel" section makes the depth honest, not demoted |
| Cleanup release becomes too large | High | Medium | Phase 2 of F2 deferred to next release; everything else fits one PR per finding |
| Augmentcode budget changes upstream | Low | Low | Budget cap is configurable in the CI guard; recheck on every Augmentcode release |

## Next steps

1. **Open execution PR for Phase 1**, finding-by-finding (one PR per finding to keep review tight).
2. **Run cross-roadmap dependency check** before each PR (confirm no overlap with `road-to-post-pr29-optimize.md` for `agent-authority` or `chat-history` work).
3. **Update `roadmaps-progress.md`** dashboard after each finding lands.
4. **Plan Phase 2 (F2 remaining 12 clusters)** for the next release window.

## Out of scope (explicit)

- New rules, new skills, new commands — this track is structural cleanup, not
  expansion.
- Engine changes (`work_engine`, dispatcher, directives) — handled in
  `road-to-post-pr29-optimize.md`.
- Persona introduction, stakeholder skills, Python-tool layer — handled in
  `road-to-better-skills-and-profiles.md`.
- OSS distribution strategy, Medium articles, sponsorship — still out of scope.
  **Note:** the *positioning surface* (README tagline, audience matrix, docs
  framing, GitHub topics) is now in scope via Finding 7; the *identity decision*
  (Galawork-internal vs OSS product) stays in `road-to-better-skills-and-profiles.md`.
