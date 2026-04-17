# README & Docs Improvement Roadmap

Source: GPT competitive analysis + SWOT (April 2026) comparing agent-config against
anthropics/skills, cloudflare/skills, github/awesome-copilot, hoodini/ai-agents-skills.

**Overall score: 8.5/10** — strongest at governance, linter maturity, and multi-agent
distribution. Weakest at adoption friction, distribution elegance, and external discoverability.

## Goal

Transform README from "internal system documentation" into "compelling product page"
that makes someone want to install this in 30 seconds. Move all system internals into docs/.

**Market position:** Not a skill collection — a **Governed Agent OS for Development Teams**.

---

## SWOT Analysis

### Strengths

| # | Strength | Detail |
|---|---|---|
| S1 | **Governance is our unfair advantage** | Rules + Skills + Commands + Linter + CI = enforced practices, not documented practices |
| S2 | **System design, not collection** | Runtime, Tool Layer, Observability, Feedback Loop, Lifecycle — this is an OS |
| S3 | **Multi-agent compatibility** | Augment, Claude Code, Copilot, Cursor, Cline, Windsurf, Gemini — tool-agnostic |
| S4 | **Cost control (extremely rare)** | Settings + guards + default-off. Separation: collect vs inject. Almost no competitor has this |
| S5 | **Team scalability** | CI-ready, structured skills, reproducible behavior — enterprise-ready, not dev-toy |

### Weaknesses

| # | Weakness | Detail |
|---|---|---|
| W1 | **Entry barrier too high** | Too many concepts (Rules, Skills, Runtime, Lifecycle...) — looks overengineered to newcomers |
| W2 | **Distribution not optimal** | No 1-click install, no clear marketplace flow. "Install system" instead of "install plugin" |
| W3 | **No clear minimal mode** | Everything is there → feels heavy. Missing: light version, starter config |
| W4 | **Too few external examples** | No demo repos, case studies, or real workflow examples. Hard to understand concrete usage |
| W5 | **Over-governance risk** | Too many rules → agent feels "strict". Risk: too much asking, too much analysis |

### Opportunities

| # | Opportunity | Detail |
|---|---|---|
| O1 | **Plugin/Marketplace model** | Biggest lever. Copilot + Augment + Claude plugins → gamechanger for adoption |
| O2 | **"Agent OS for Teams" positioning** | Not "Skill Collection" but "Agent Operating System for Development Teams" |
| O3 | **Cost-Aware AI as USP** | While others build more features, we control costs AND quality |
| O4 | **Enterprise/Team adoption** | Perfect for teams, processes, standards — much stronger than solo-dev toys |
| O5 | **Developer Judgment as differentiator** | `improve-before-implement` + `validate-feature-fit` = qualitative superiority |

### Threats

| # | Threat | Detail |
|---|---|---|
| T1 | **Big players (GitHub/Anthropic/OpenAI)** | If they combine governance + skills + plugins → they can overtake fast |
| T2 | **Plugin ecosystem wins without us** | If we don't participate → lose installation, adoption, visibility |
| T3 | **Overengineering** | If we keep stacking features → nobody uses it fully, too complex |
| T4 | **Fragmentation** | Multi-agent is strength, but can become: too many targets, too much maintenance |

---

## Competitor Analysis

### Summary

| System | Their strength | Their weakness | vs us |
|---|---|---|---|
| **anthropics/skills** | Official reference, simple install | No governance, no linter, no lifecycle | We are clearly stronger |
| **cloudflare/skills** | Clear domain focus, good examples | Not a generic platform, no governance | We are broader, they are clearer |
| **awesome-copilot** | Huge collection, high visibility | No consistency, no quality assurance | We are much cleaner |
| **hoodini/ai-agents-skills** | Multi-agent, easy to use | No governance, no runtime, no lifecycle | We are much deeper |
| **Plugin marketplaces** | Simple install, standardized | Little governance, little depth | They win adoption, we win quality |

### Detailed assessments

**anthropics/skills** — Official reference repo for Agent Skills.
- Good: official character, simple install, clear structure.
- Missing: governance, linter, lifecycle, feedback system.
- They are: canonical reference. We are: opinionated operating model.
- **Winner: us** (system depth).

**cloudflare/skills** — Domain-specific skill repo for Cloudflare products.
- Good: clear focus, real use cases, good examples.
- Missing: generic platform, governance layer.
- They are: product skills. We are: platform.
- **Winner: us** (strategically), **them** (clarity of purpose).

**awesome-copilot** — Community collection of skills, agents, hooks, workflows.
- Good: huge collection, high visibility, community-driven.
- Missing: consistency, quality assurance, structure.
- They are: inspiration. We are: execution system.
- **Winner: us** (quality), **them** (reach).

**hoodini/ai-agents-skills** — Curated multi-agent skill collection.
- Good: multi-tool support, easy to use.
- Missing: governance, linter, runtime, lifecycle.
- They are: easy entry. We are: much more capable.
- **Winner: us**.

**Plugin/Marketplace ecosystems** — Native distribution channels.
- Good: simple install, standardized, low entry barrier.
- Missing: governance, depth.
- They are: distribution king. We are: system king.
- **Winner: them** (adoption), **us** (quality). **This is the gap to close.**

---

## Competitor README Learnings

### Cloudflare/skills — Goldstandard for scanability
- Lists *concrete* skills with one-line descriptions as a table
- 4 installation methods shown side-by-side, no explanation needed
- Zero system vocabulary — just: "Here are skills. Here's how to install them."
- Skills are grouped by domain (Workers, AI, Pages, etc.)

### Anthropic/skills — Goldstandard for simplicity
- Opens with "Skills teach Claude how to..." — instantly understandable
- "Try in Claude Code / Claude.ai / API" as primary structure
- "Creating a Basic Skill" section shows HOW, not just WHAT
- Minimal README, maximum clarity

### GitHub/awesome-copilot — Goldstandard for discoverability
- Website link prominent at the top
- `llms.txt` for machine-readable access
- Browse links in every table row
- Curated categories with clear descriptions

### Key takeaway
All three focus on **"what you get"** (benefit). Our README currently focuses on
**"what the system provides"** (inventory). The shift is: user-benefit framing.

---

## Onboarding Gap Analysis

**Key insight:** The problem is NOT installation — it's **onboarding**.

| Area | Status | Assessment |
|---|---|---|
| Installation | Good | Plugin manifests exist, Composer/npm hooks work |
| System quality | Very good | Governance, linter, CI, runtime — all strong |
| Onboarding | Medium | No quickstart, no visible quick win, no "aha moment" |
| Adoption | Needs work | Entry barrier too high, no minimal mode |

### Why entry barrier is high (root causes)

**1. Too many concepts at once** — A new user sees: Rules, Skills, Commands, Guidelines,
Runtime, Execution Metadata, Tool Layer, Observability, Feedback, Lifecycle, Cost Control.
For us: logical architecture. For newcomers: overload.

**2. No clear starting point** — User asks "what do I do now?" and gets "understand the system"
instead of "step 1 → step 2 → step 3 → you see the difference".

**3. Too much system language** — "governed system", "lifecycle", "execution metadata",
"feedback loop" are correct but not onboarding-friendly.

**4. No visible quick win** — Other repos say "install → you can immediately do X".
We say "here's a system that improves agent behavior". Stronger — but less directly tangible.

**5. Target audience not explicit** — Perfect for teams and processes, but individual devs
ask "is this for me?" and don't find a clear answer.

**Important:** This is NOT a flaw — it's the price of quality, governance, and system thinking.
The fix: **simplify the entry, not the system.**

### What's missing for "best-in-class" installation

**1. "1-minute setup" experience** — Top systems: copy → paste → works.
We are still: understand → configure → activate.

**2. No "default mode"** — User doesn't know: what's minimally useful? What's recommended?
What's advanced?

**3. No "hello world" moment** — Missing: "do this → you immediately see the difference".

**4. Plugin ≠ automatically understood** — Even with better installation, users don't
automatically understand: what's active, what happens, why it's better.

### Concrete onboarding improvements needed

**Quickstart section in README** (biggest lever) — Must go to the very top:
```
## Quickstart (2 minutes)
1. Install: <one command>
2. That's it. Your agent now:
   - Analyzes code before changing it
   - Follows your team's coding standards
   - Runs quality checks automatically
   - Creates structured PRs from Jira tickets
```

**Explicit modes** — Make the progression crystal clear:
```
Minimal (recommended to start): governance only, no runtime, lowest tokens
Balanced: runtime enabled, limited observability
Full: all features, full feedback + lifecycle
```

**Before/After comparison** — Instant "why should I care":
```
Without: agent guesses, inconsistent output, no validation
With: analyzes first, validates changes, follows team standards
```

**"You don't need everything" message** — Explicitly state:
```
Start with Rules + Skills. Everything else is optional.
You do NOT need Runtime, Observability, or Lifecycle to get value.
```

**"What happens automatically?" transparency** — Build trust:
```
- Rules are always active (no config needed)
- Skills are used when relevant (agent decides)
- No hidden execution
- No automatic context expansion (cost_profile=minimal by default)
```

---

## Strategic Priorities (from SWOT + Onboarding Analysis)

These are the 4 highest-impact moves:

### Priority 1: Perfect Quickstart (addresses W1, W3, Onboarding)
**If you improve only ONE thing, improve this.**
Build a 2-minute quickstart that delivers an "aha moment".
Not more features, not more docs — just: install → see the difference.
→ Not started. This is the #1 lever for adoption.

### Priority 2: Minimal mode / explicit progression (addresses W1, W3, O4)
Offer clear modes: Minimal → Balanced → Full.
Minimal = governance only, zero overhead. New users start here.
The `cost_profile=minimal` setting is a foundation, but needs to be more visible.
→ **Partially done.** Profile system consolidated: `cost_profile` canonical, `minimal`
is default, matrix documented in `.augment/templates/agent-settings.md`, `bin/install.php`
accepts `--profile=<minimal|balanced|full>`. Remaining: README quickstart integration,
mode badges, explicit progression callout.

### Priority 3: Plugin distribution (addresses W2, O1, T2)
Real plugin/marketplace distribution. Biggest lever for frictionless install.
Currently: "install system" → Target: "install plugin".
→ Partially done (plugin manifests exist), needs real marketplace registration.

### Priority 4: Developer Judgment as USP (addresses O5, S1)
The `improve-before-implement` and `validate-feature-fit` skills are unique.
No competitor has this. Double down — make it visible in README and marketing.
→ Partially done (skills exist), not visible to outsiders.

---

## Phase 0: Quickstart & Onboarding ✅ DONE

**SWOT link:** W1 (entry barrier), W3 (no minimal mode), Onboarding gap
**Priority:** 1 — single biggest lever for adoption

### Tasks

- [x] Add "Quickstart (2 minutes)" section at the TOP of README (renamed from "Installation" — line 13; first heading after hero)
- [x] Add "What changes immediately" section right after quickstart (README "What your agent learns" table, line 61 — 7-row before/after comparison)
- [x] Add "You don't need everything" callout (README line 74, explicitly says "Start with Rules + Skills. Everything else is optional.")
- [x] Add "What happens automatically?" transparency block (covered by "You don't need everything" section + Core Principles section)
- [x] Add explicit mode progression: Minimal → Balanced → Full (README line 78 table with token overhead)

---

## Phase 1: README Tagline & Hero Section ✅ DONE

**SWOT link:** W1 (entry barrier), O2 (positioning)

**Problem:** "policy-driven execution system" is abstract jargon. No one searches for this.
New visitors don't understand what they get within 5 seconds.

### Tasks

- [x] Replace tagline with benefit-oriented one-liner (README line 3: "Teach your AI agents Laravel, PHP, testing, Git workflows, and 90+ more skills — with quality guardrails built in.")
- [x] Replace blockquote with a human-readable elevator pitch (README line 5: "Your agent learns to write Laravel code, run tests, create PRs, fix CI — and follows your team's coding standards while doing it.")
- [x] Keep the stats line (93 Skills · 31 Rules · …) — it's effective social proof (README line 8)
- [ ] Consider adding a badge row: CI status, skill count, license, Agent Skills standard (deferred — requires badges infrastructure)

---

## Phase 2: "What You Get" Instead of "What's Inside" ✅ DONE

**SWOT link:** W1 (entry barrier), W4 (external examples), O2 (positioning)

**Problem:** Current "What's inside" table lists system layers (Rules, Skills, Runtime, Tools,
Observability). A visitor wants to know: "What will my agent be able to do?"

### Tasks

- [x] Rename "What's inside" → "What your agent learns" (README heading, line 61)
- [x] Replace abstract layer table with benefit-oriented bullets or table (7-row before/after table covers: analyze-first, coding standards, Pest tests, Conventional Commits, quality tools, PR descriptions, verify-before-complete)
- [x] Move the layer/architecture table into docs/architecture.md (already done in prior phase)
- [x] Before/after comparison directly in the README (that is the "What your agent learns" table itself)

---

## Phase 3: Featured Skills & Commands Table ✅ DONE

**SWOT link:** W1 (entry barrier), W4 (external examples), O5 (developer judgment visibility)

**Problem:** "93 Skills" is impressive but abstract. Cloudflare lists every skill with a
one-line description. We should show the best ones.

### Tasks

- [x] Add "Featured Skills" section to README with 10-15 top skills
  - Table format: | Skill | What it does |
  - Examples:
    - `laravel` — Writes Laravel code following framework conventions and project architecture
    - `pest-testing` — Writes Pest tests with clear intent, good coverage, and project conventions
    - `eloquent` — Eloquent models, relationships, scopes, eager loading, type safety
    - `create-pr` — Creates GitHub PRs with structured descriptions from Jira tickets
    - `commit` — Stages and commits changes following Conventional Commits
    - `fix-ci` — Fetches CI errors from GitHub Actions and fixes them
    - `fix-pr-comments` — Fixes and replies to all open review comments on a PR
    - `quality-fix` — Runs PHPStan/Rector/ECS and fixes all errors
    - `bug-analyzer` — Root cause analysis from Sentry errors or Jira tickets
    - `docker` — Dockerfile, docker-compose, container management
    - `security` — Auth, policies, CSRF, rate limiting, secure coding
    - `api-design` — REST conventions, versioning, deprecation
    - `database` — MariaDB optimization, indexing, query performance
- [x] Add "Featured Commands" section with 8-10 top commands
  - Table format: | Command | What it does |
  - Examples:
    - `/commit` — Stage and commit with Conventional Commits
    - `/create-pr` — Create PR with Jira-linked description
    - `/fix-ci` — Fetch and fix GitHub Actions failures
    - `/fix-pr-comments` — Fix and reply to review comments
    - `/compress` — Compress skills for token efficiency
    - `/quality-fix` — Run and fix all quality checks
    - `/review-changes` — Self-review before creating a PR
    - `/jira-ticket` — Read ticket from branch, implement feature
- [x] Link each skill/command name to its SKILL.md for browsability (like GitHub/awesome-copilot)
- [x] Add "→ Browse all 93 skills" link at the bottom of the table

---

## Phase 4: Simplify Installation Section ✅ DONE

**SWOT link:** W2 (distribution), O1 (plugin model)
**Status:** Implemented in PR #6.

**Principle:** Install natively, onboard optionally, explain later.

### What was done

- [x] README shows one-line install per tool in a compact table
- [x] No build-tool dependency for install (no Task, Make, npm, Composer required)
- [x] docs/installation.md restructured: recommended path per tool → alternatives as fallback
- [x] `first-run` clearly marked as optional (not part of install path)
- [x] 3 test prompts shown directly in README (no tools required to try them)
- [x] Consumer settings templates referenced in installation docs
- [x] "Install from Git URL" added as VS Code/Copilot alternative

### Installation maturity criteria (from GPT review)

| Criterion | Status |
|---|---|
| One recommended install path per tool | ✅ Done |
| No build-tool dependency for install | ✅ Done |
| One copy-paste block per tool | ✅ Done |
| First-run separated from install | ✅ Done |
| Consumer repo stays clean | ✅ Done (plugin = zero local files) |
| "No Task / No Make required" explicitly stated | ✅ Done |
| Profile quick-reference in docs/installation.md | ✅ Done |
| "First test" section directly after install in docs | ✅ Done |
| `task first-run` clearly optional | ✅ Done |

### GPT final validation (April 2026)

GPT confirmed the installation is now on the right track. Key feedback:
- Plugin-first strategy: ✅ correct approach
- No build-tool dependency: ✅ confirmed as critical
- First-run as optional: ✅ confirmed ("only if optional")
- Fallback available: ✅ confirmed

GPT suggested speculative install commands (`claude plugins install <url>`, Augment JSON config)
that don't match real CLI syntax. **Ignored** — we use actual plugin commands.

---

## Phase 4b: Installation Maturity — Next Level (future)

**Status:** Not started. Depends on plugin/marketplace ecosystem maturity.

These concepts were suggested by GPT analysis and are valid architectural ideas,
but require stable plugin APIs before implementation. Tracked here for when the
ecosystem is ready.

### Concept 1: Auto-detection (for consumer projects)

Detect which agent tool the CONSUMER uses and show the right install path.

Detection signals (in consumer project, not our repo):
- `.vscode/settings.json` with plugin configs → VS Code/Copilot
- Augment settings with enabledPlugins → Augment
- Claude config files → Claude Code
- None of the above → generic fallback

**Caution:** Detection must run in the consumer's project context, not in our repo.
The GPT-suggested `detect-agent.sh` assumed our repo context — needs redesign for consumers.

Tasks:
- [ ] Design detection logic for consumer project context
- [ ] Implement `scripts/detect-agent.sh` (runs in consumer project)
- [ ] Implement `scripts/show-install-guide.sh` (context-aware recommendations)
- [ ] Wire into `task install-guide` (optional)
- [ ] Depends on: stable plugin API formats for all 3 tools

### Concept 2: Install checker (for consumer projects)

Validate whether agent-config is correctly installed in a consumer project.

Checks per environment:
- Plugin manifest present and referenced?
- `.agent-settings` present? Profile set?
- Plugin enabled in tool config?

**Key requirement:** Must produce actionable output, not just "FAIL".
Example: `FAIL: .agent-settings missing → Create with: cost_profile=minimal`

Tasks:
- [ ] Design check logic per tool
- [ ] Implement `scripts/install-check.sh`
- [ ] Wire into `task install-check` (optional)
- [ ] Consider: run as post-install hook?
- [ ] Depends on: stable plugin config formats

### Concept 3: Centralized plugin definition

Instead of maintaining separate manifests in `.augment-plugin/`, `.claude-plugin/`,
`.github/plugin/`, define ONE canonical plugin in `plugin/agent-config/plugin.json`
and have tool-specific manifests reference it.

```
plugin/
  agent-config/
    plugin.json        ← canonical definition
    agents/
    skills/
    commands/

.augment-plugin/plugin.json   → references plugin/agent-config
.claude-plugin/plugin.json    → references plugin/agent-config
.github/plugin/marketplace.json → references plugin/agent-config
```

**Benefit:** Single source of truth for plugin identity, version, components.
**Risk:** Plugin formats may not support cross-references. Speculative until APIs stabilize.

Tasks:
- [ ] Investigate: do plugin formats support source/reference paths?
- [ ] If yes: create `plugin/agent-config/plugin.json` as canonical
- [ ] If no: keep tool-specific manifests, sync via build script
- [ ] Depends on: stable plugin API formats

### Installation maturity success criteria (next level)

| Criterion | Status |
|---|---|
| Auto-detection of consumer environment | Not started |
| Install checker with actionable output | Not started |
| One canonical plugin ID across all tools | Partially (manifests exist, not centralized) |
| Post-install validation hook | Not started |
| Consumer install in under 30 seconds | ✅ Done (plugin path) |
| Consumer install with zero build tools | ✅ Done |

---

## Phase 5: Reduce Jargon in README ✅ DONE

**SWOT link:** W1 (entry barrier), W5 (over-governance perception), T3 (overengineering)

**Problem:** GPT analysis flagged "Governed Agent System", "Lifecycle", "Feedback loop",
"execution metadata", "cost profile" as internal jargon that raises adoption barriers.

### Tasks

- [x] Remove or replace jargon in README:
  - "Governed Agent System" kept in title only, not repeated elsewhere ✓
  - "Runtime" / "Tools" / "Observability" not used as standalone rows — only user-facing profile table ✓
  - "Execution pipeline, dispatcher, handlers, safety controls" — absent from README ✓
  - "Metrics, events, feedback, lifecycle reports" replaced with plain language ("Reports, suggestions in chat, CI summaries" in profile table)
- [x] The "What's inside" table is now user-facing (`## What your agent learns` benefit table — 7 rows, no internal layer names)
- [x] "Core Principles": kept concrete; "Data collection ≠ context injection" replaced with "nothing runs until you ask for it"

---

## Phase 6: Add Discoverability Aids ✅ DONE (logo deferred)

**SWOT link:** W4 (external examples), T2 (plugin ecosystem), O1 (marketplace)

**Problem:** GitHub/awesome-copilot has website links, llms.txt, and browse links.
We have none of these.

### Tasks

- [x] `llms.txt` in repo root — machine-readable skill index, auto-generated from frontmatter
- [x] GitHub Topics documented in `docs/github-topics.md` with 11 recommended topics + UI/CLI/API instructions (setting requires repo admin action outside this PR)
- [x] Skill catalog page at `docs/skills-catalog.md` — auto-generated from SKILL.md frontmatter via `scripts/generate_catalog.py` (Task target: `task generate-catalog`). README links to it.
- [ ] Consider adding a simple logo or banner image for visual identity (deferred — creative work, not mechanical)

---

## Phase 7: docs/ Structure Polish ✅ DONE

**SWOT link:** W1 (entry barrier), W4 (external examples)

**Problem:** The 5 docs pages are good but could be tighter. Some content may need
cross-linking improvements.

### Tasks

- [x] Review docs/installation.md — covers Composer, npm, Git submodule, plugin marketplace (verified current)
- [x] Review docs/architecture.md — system layers, tool matrix (verified current)
- [x] Review docs/development.md — Taskfile targets documented (verified current)
- [x] Review docs/customization.md — override examples (verified current)
- [x] Review docs/quality.md — linting, CI, compression system (verified current)
- [x] Add docs/skills-catalog.md (auto-generated via `scripts/generate_catalog.py`)
- [x] Ensure every docs page has a "← Back to README" link (added to architecture, customization, development, installation, quality; getting-started already has `→ Full documentation`; skills-catalog and github-topics have the link)
- [x] Cross-links: README links to all 7 docs pages + llms.txt; every doc page links back to README

---

## Success Criteria

After all phases:

- [x] New visitor has "aha moment" within 2 minutes of reading README (Quickstart + "What your agent learns" Before/After table + 3 try-it prompts from installer)
- [x] Quickstart is the first section after the tagline (line 13)
- [x] Before/After comparison makes value immediately visible ("Without agent-config | With agent-config" table)
- [x] "You don't need everything" is explicitly stated (dedicated section)
- [x] Modes (Minimal/Balanced/Full) are clearly documented (table with token overhead column)
- [x] Installation takes 1-2 lines of code (primary path: `composer require` + `vendor/bin/agent-config install`)
- [x] Top 15 skills are visible without clicking any links ("Featured Skills" table)
- [x] No internal jargon in README — all system details live in docs/
- [x] README is at 205 lines (criterion allows "slightly more" for quickstart + before/after; within acceptance)
- [x] All docs pages are cross-linked and navigable ("Back to README" links on all pages)
- [x] README linter passes with 0 warnings (`task lint-readme` → `No issues found`)

## Scoring Target

| Area | Current | Target | Key SWOT driver |
|---|---|---|---|
| Strategic quality | 9/10 | 9.5/10 | S1, S2 (maintain) |
| Governance/Linter maturity | 9.5/10 | 9.5/10 | S1 (maintain) |
| Skill quality / Process maturity | 9/10 | 9.5/10 | S5, O5 |
| Ecosystem/Plugin maturity | 6.5/10 | 8/10 | W2, O1, T2 |
| Adoption / Installability | 7/10 | 9/10 | W1, W2, W3 |
| Clarity of positioning | 8.5/10 | 9.5/10 | W1, O2 |
| **Overall** | **8.5/10** | **9.2/10** | |

## Final Assessment

**What we are:** Governed Agent OS for Development Teams.
**What we are NOT:** A skill collection, a prompt pack, or a plugin marketplace.

**Core insight:** The problem is NOT installation — it's **onboarding**.
Installation is technically good. But users don't understand what they get, why it matters,
or how to start. The fix: simplify the entry, not the system.

**#1 priority:** Perfect Quickstart — 2 minutes to "aha moment".
**#2 priority:** Explicit modes (Minimal → Balanced → Full) — reduce perceived complexity.
**#3 priority:** Plugin distribution — frictionless install for CLI tools.
**#4 priority:** Developer Judgment visibility — show our unique differentiator.

**Biggest gap to close:** Onboarding & adoption — everything else is already strong.
**Biggest risk:** Overengineering (T3) — adding complexity without simplifying entry.
**Biggest opportunity:** Quickstart + Minimal mode = accessible AND powerful.
