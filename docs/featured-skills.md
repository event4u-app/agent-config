# Featured Skills

A curated subset of the ~218 active skills. Three tiers, one per primary audience. Full catalog lives in [`dist/agent-src/skills/`](../dist/agent-src/skills/); see also [`docs/catalog.md`](catalog.md) for the complete index and [`docs/featured-commands.md`](featured-commands.md) for command-level highlights.

> **Eval-gated messaging note.** Until `task bench --corpus non-dev` reports `selection_accuracy >= 0.60` (see `road-to-product-adoption.md` Phase 1), this page is documentation, not marketing. The entries below are the candidates the corpus tests against; their description quality is what the eval validates.

Each row links to the canonical artefact under `dist/agent-src/`. Substitutions vs. the original roadmap proposal: `pitch-narrative` → [`fundraising-narrative`](../dist/agent-src/skills/fundraising-narrative/SKILL.md) (closest existing skill; pitch-narrative is not yet authored).

---

## Featured for Founders & Consultants

**Install:** `npx -y @event4u/agent-config init --pack founder-strategy`
(Consultants: pair with `--pack product-discovery` for discovery / interview tooling.)

**You reach for this when:** you switch between investor pitch, hiring decision, product spec, and unit-economics modeling in the same week — and need cross-domain skills that respect a board-defensible bar.

| Artefact | What it does |
|---|---|
| [`/refine-prompt`](../dist/agent-src/skills/refine-prompt/SKILL.md) | Reconstruct a free-form prompt into actionable AC + assumptions + confidence band before the engine plans |
| [`/work`](../dist/agent-src/commands/work.md) | Drive a free-form prompt end-to-end through refine → score → plan → implement → test → verify → report |
| [`/grill-me`](../dist/agent-src/commands/grill-me.md) | Interactive grill-style interview that sharpens a fuzzy plan / idea into a copyable Markdown pitch |
| [`/optimize-prompt`](../dist/agent-src/commands/optimize-prompt.md) | Optimize a raw prompt for ChatGPT / Claude / Gemini via the 4-D methodology |
| [`decision-record`](../dist/agent-src/skills/decision-record/SKILL.md) | Lock a trade-off — options · trade-offs · consequences — before the ADR file is written |
| [`fundraising-narrative`](../dist/agent-src/skills/fundraising-narrative/SKILL.md) | Why-now / why-us / why-this framing, market-size reasoning, traction-story construction |
| [`okr-tree-modeling`](../dist/agent-src/skills/okr-tree-modeling/SKILL.md) | Decompose a company objective into team OKRs; audit a draft tree for measurability and laddering |
| [`voc-extract`](../dist/agent-src/skills/voc-extract/SKILL.md) | Extract Voice-of-Customer themes from existing artefacts — GH issues, PR threads, Sentry patterns |
| [`dcf-modeling`](../dist/agent-src/skills/dcf-modeling/SKILL.md) | Valuation cognition for a CFO / finance-partner — DCF, WACC, terminal value, sensitivity |
| [`runway-cognition`](../dist/agent-src/skills/runway-cognition/SKILL.md) | Cash runway, burn shape, fundraise triggers, layoff-vs-cut-vs-grow decisions |

→ Pack details: [`packages/founder-strategy/`](../packages/founder-strategy/) · Role guide: [`docs/getting-started-by-role.md#founder`](getting-started-by-role.md#founder-early-stage-operator-wearing-every-hat)

---

## Featured for Content Creators

**Install:** `npx -y @event4u/agent-config init --pack ai-video`
(Writers / marketers without video: pair with `--pack gtm-marketing` for editorial / brand tooling.)

**You reach for this when:** you draft blog posts, marketing emails, launch copy, release announcements, or produce AI-generated video — and need brand-voice discipline plus a cinematic-grade prompting pipeline more than code-quality enforcement.

| Artefact | What it does |
|---|---|
| [`/video:from-script`](../dist/agent-src/commands/video/from-script.md) | End-to-end pipeline: script → character-locked image → motion + audio prompt → provider render → stitched clip |
| [`/video:scene`](../dist/agent-src/commands/video/scene.md) | Render a single scene from an existing blueprint against the configured provider adapter |
| [`/video:storyboard`](../dist/agent-src/commands/video/storyboard.md) | Expand a one-line idea into the 12-block Cinematic Scene Blueprint (provider-agnostic) |
| [`pixar-storyteller`](../dist/agent-src/skills/pixar-storyteller/SKILL.md) | Turn an idea into a Pixar-style animation prompt — character sheet, scene, image, video — anchored in emotional beat, want, obstacle |
| [`motion-choreographer`](../dist/agent-src/skills/motion-choreographer/SKILL.md) | Turn a locked still + blueprint into a provider-tuned motion prompt — camera, primary + secondary motion, physics, native-audio sync |
| [`canvas-design`](../dist/agent-src/skills/canvas-design/SKILL.md) | Create static visual art — posters, marketing visuals, brand assets, PDF / PNG design pieces |
| [`voice-and-tone-design`](../dist/agent-src/skills/voice-and-tone-design/SKILL.md) | Define and audit brand voice — voice attributes, tone-by-context matrix, consistency review |
| [`editorial-calendar`](../dist/agent-src/skills/editorial-calendar/SKILL.md) | Cadence shape — evergreen vs campaign vs reactive, beat-mapping across channel stages, content-debt management |

`AIV_DRYRUN=true` is the mandatory default for video pipelines — no provider call, no spend until you opt in.

→ Pack details: [`packages/ai-video/`](../packages/ai-video/) · Role guide: [`docs/getting-started-by-role.md#creator`](getting-started-by-role.md#creator-writer-marketer-indie-content-shop)

---

## Featured for Engineering Leads

**Install:** `npx -y @event4u/agent-config init --pack engineering-base`
(Stack-specific add-ons: `--pack laravel`, `--pack nextjs`, `--pack symfony`, `--pack react`, `--pack typescript`.)

**You reach for this when:** you write code daily and want testing / quality / git / CI / security guardrails baked into the agent's behavior — covering both the daily loop (`/work`, `/commit`) and the review surface (`/review-changes`, judges).

| Artefact | What it does |
|---|---|
| [`/work`](../dist/agent-src/commands/work.md) | Free-form prompt end-to-end loop — refine → plan → implement → test → verify, confidence-band gated |
| [`/implement-ticket`](../dist/agent-src/commands/implement-ticket.md) | Drive a Jira / Linear ticket end-to-end — same loop, ticket-anchored |
| [`/review-changes`](../dist/agent-src/commands/review-changes.md) | Self-review local changes before creating a PR — dispatches to five specialized judges and consolidates verdicts |
| [`/commit`](../dist/agent-src/commands/commit.md) | Stage and commit all uncommitted changes — splits into logical commits following Conventional Commits |
| [`judge-bug-hunter`](../dist/agent-src/skills/judge-bug-hunter/SKILL.md) | Correctness review — null-safety, edge cases, off-by-one, races, error handling |
| [`judge-code-quality`](../dist/agent-src/skills/judge-code-quality/SKILL.md) | Readability review — naming, single-responsibility, DRY, dead code, codebase-convention drift |
| [`judge-security-auditor`](../dist/agent-src/skills/judge-security-auditor/SKILL.md) | Security review — authZ, injection, secrets, unsafe deserialization, SSRF, XSS, mass assignment |
| [`judge-test-coverage`](../dist/agent-src/skills/judge-test-coverage/SKILL.md) | Test review — missing assertions, uncovered branches, over-mocking, regression coverage |
| [`playwright-architect`](../dist/agent-src/skills/playwright-architect/SKILL.md) | Shape a Playwright suite — locator strategy, Page Object boundaries, fixture composition, flake prevention |
| [`threat-modeling`](../dist/agent-src/skills/threat-modeling/SKILL.md) | Pre-implementation threat model — trust boundaries + abuse cases mapped to files, BEFORE the first line of code |

→ Pack details: [`packages/engineering-base/`](../packages/engineering-base/) · Role guide: [`docs/getting-started-by-role.md#developer`](getting-started-by-role.md#developer-the-original-audience)

---

## Lint contract

Every entry above MUST resolve in [`dist/discovery/discovery-manifest.json`](../dist/discovery/discovery-manifest.json). The check is automated:

```bash
task lint-featured-skills
# or directly:
python3 scripts/lint_featured_skills.py
```

CI runs this in `taskfiles/ci-fast.yml`. Stale entries (renamed / removed skill or command) fail the build. See [`scripts/lint_featured_skills.py`](../src/scripts/lint_featured_skills.py) for the matcher.

→ Browse all ~218 active skills: [`dist/agent-src/skills/`](../dist/agent-src/skills/) · all ~129 commands: [`dist/agent-src/commands/`](../dist/agent-src/commands/)
