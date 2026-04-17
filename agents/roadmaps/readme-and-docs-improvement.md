# README & Docs Improvement Roadmap

Source: GPT competitive analysis (April 2026) comparing agent-config against
anthropics/skills, cloudflare/skills, github/awesome-copilot, hoodini/ai-agents-skills.

**Overall score: 8.5/10** — strongest at governance, linter maturity, and multi-agent
distribution. Weakest at adoption friction, distribution elegance, and external discoverability.

## Goal

Transform README from "internal system documentation" into "compelling product page"
that makes someone want to install this in 30 seconds. Move all system internals into docs/.

## Competitor Learnings

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

## Phase 1: README Tagline & Hero Section

**Problem:** "policy-driven execution system" is abstract jargon. No one searches for this.
New visitors don't understand what they get within 5 seconds.

### Tasks

- [ ] Replace tagline with benefit-oriented one-liner
  - Current: "A policy-driven execution system for AI agents that enforces quality, consistency, and developer-like behavior."
  - Target direction: "Teach your AI agents Laravel, PHP, testing, Git workflows, and 90+ more skills — with quality guardrails built in."
  - Alternative: "90+ production-ready skills for AI coding agents — governed by rules, verified by CI."
  - Keep it concrete: mention Laravel, PHP, testing (the primary domain)
- [ ] Replace blockquote with a human-readable elevator pitch
  - Current: "Not just a collection of prompts — a governed skill framework with runtime execution, tooling, observability, and feedback."
  - Target: Something like "Your agent learns to write Laravel code, run tests, create PRs, fix CI — and follows your team's coding standards while doing it."
- [ ] Keep the stats line (93 Skills · 31 Rules · ...) — it's effective social proof
- [ ] Consider adding a badge row: CI status, skill count, license, Agent Skills standard

---

## Phase 2: "What You Get" Instead of "What's Inside"

**Problem:** Current "What's inside" table lists system layers (Rules, Skills, Runtime, Tools,
Observability). A visitor wants to know: "What will my agent be able to do?"

### Tasks

- [ ] Rename "What's inside" → "What your agent learns" or "What you get"
- [ ] Replace abstract layer table with benefit-oriented bullets or table
  - Instead of "Rules | 31 | Always-active behavior constraints"
  - Write: "✅ Analyzes code before changing it — no blind edits"
  - Write: "✅ Writes Pest tests following your project conventions"
  - Write: "✅ Creates PRs with structured descriptions from Jira tickets"
  - Write: "✅ Runs PHPStan, Rector, ECS — fixes errors automatically"
  - Write: "✅ Follows Conventional Commits, suggests reviewers"
  - Show 6-8 concrete benefits, then link to full skill list
- [ ] Move the layer/architecture table into docs/architecture.md (already done)
- [ ] Consider a "before/after" comparison:
  - Before: "Agent writes code that doesn't match team conventions"
  - After: "Agent follows PHP coding guidelines, runs quality checks, creates clean PRs"

---

## Phase 3: Featured Skills & Commands Table

**Problem:** "93 Skills" is impressive but abstract. Cloudflare lists every skill with a
one-line description. We should show the best ones.

### Tasks

- [ ] Add "Featured Skills" section to README with 10-15 top skills
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
- [ ] Add "Featured Commands" section with 8-10 top commands
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
- [ ] Link each skill/command name to its SKILL.md for browsability (like GitHub/awesome-copilot)
- [ ] Add "→ Browse all 93 skills" link at the bottom of the table

---

## Phase 4: Simplify Installation Section

**Problem:** Installation currently shows 6 code blocks. Cloudflare uses expandable sections
or tabs. We should show the simplest path first, details behind a link.

### Tasks

- [ ] Show ONE primary installation path prominently (Composer — our main audience is PHP)
  ```
  composer require --dev event4u/agent-config
  bash vendor/event4u/agent-config/scripts/setup.sh
  ```
- [ ] Show other methods as a compact list with links:
  - npm: `npm install @event4u/agent-config`
  - Plugin (Augment/Claude/Copilot): → docs/installation.md
  - Git Submodule: → docs/installation.md
  - Manual: → docs/installation.md
- [ ] Remove the 3 plugin code blocks from README — they're in docs/installation.md already
- [ ] Keep the "→ Full details: docs/installation.md" link

---

## Phase 5: Reduce Jargon in README

**Problem:** GPT analysis flagged "Governed Agent System", "Lifecycle", "Feedback loop",
"execution metadata", "cost profile" as internal jargon that raises adoption barriers.

### Tasks

- [ ] Remove or replace these terms in README:
  - "Governed Agent System" → keep in title but don't repeat
  - "Runtime" row in table → merge into Skills or remove (it's an implementation detail)
  - "Tools" row → merge into description ("integrates with GitHub + Jira")
  - "Observability" row → remove from README, keep in docs/architecture.md
  - "Execution pipeline, dispatcher, handlers, safety controls" → not needed in README
  - "Metrics, events, feedback, lifecycle reports" → not needed in README
- [ ] The "What's inside" table should have at most 4-5 rows, all user-facing:
  - Skills, Rules, Commands, Guidelines — that's it for README
  - Everything else lives in docs/architecture.md
- [ ] "Core Principles" section: keep but make less abstract
  - "Analyze before implementing — no guessing" → good, keep
  - "Data collection ≠ context injection" → too technical for README, move to docs

---

## Phase 6: Add Discoverability Aids

**Problem:** GitHub/awesome-copilot has website links, llms.txt, and browse links.
We have none of these.

### Tasks

- [ ] Consider adding `llms.txt` to repo root (machine-readable skill index)
- [ ] Add GitHub Topics to the repo: `agent-skills`, `ai-coding`, `laravel`, `php`, `governance`
- [ ] Consider a `skills/` or `catalog/` index page that lists all skills with descriptions
  - Could be auto-generated from SKILL.md frontmatter
  - Link from README: "→ Browse all skills"
- [ ] Consider adding a simple logo or banner image for visual identity

---

## Phase 7: docs/ Structure Polish

**Problem:** The 5 docs pages are good but could be tighter. Some content may need
cross-linking improvements.

### Tasks

- [ ] Review docs/installation.md — ensure it covers every method cleanly
- [ ] Review docs/architecture.md — move jargon from README here
- [ ] Review docs/development.md — ensure task commands are complete and current
- [ ] Review docs/customization.md — ensure override examples are concrete
- [ ] Review docs/quality.md — ensure CI steps match actual Taskfile
- [ ] Add docs/skills-catalog.md (auto-generated or manually curated skill index)
- [ ] Ensure every docs page has a "← Back to README" link at the top
- [ ] Ensure cross-links between docs pages work (e.g., quality.md → development.md)

---

## Success Criteria

After all phases:

- [ ] A new visitor understands what they get within 10 seconds
- [ ] Installation takes 2 lines of code (primary path)
- [ ] Top skills are visible without clicking any links
- [ ] No internal jargon in README — all system details live in docs/
- [ ] README is under 120 lines
- [ ] All docs pages are cross-linked and navigable
- [ ] README linter passes with 0 warnings

## Scoring Target

| Area | Current | Target |
|---|---|---|
| Ökosystem-/Plugin-Reife | 6.5/10 | 8/10 |
| Adoption / Installierbarkeit | 7/10 | 9/10 |
| Klarheit der Positionierung | 8.5/10 | 9.5/10 |
| **Gesamt** | **8.5/10** | **9.2/10** |
