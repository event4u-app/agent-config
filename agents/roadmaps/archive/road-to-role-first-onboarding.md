---
complexity: lightweight
---

# Roadmap: Role-First Onboarding — non-developer first, dev second

> Rewrite the first-touch surface (`README.md`, `docs/getting-started-by-role.md`, Featured Skills) so a Founder, Content Creator, Consultant, Sales lead, or Finance reviewer reaches "first useful output" before a senior engineer would even read the architecture section.

## Prerequisites

- [ ] Read `agents/tmp/feedback6.txt` §P0.2 (README radical rewrite) and §P0.3 (real use-case packs).
- [ ] Read `agents/tmp/feedback7.txt` — "Internal AI OS" framing, role-first launch, browser-first surface.
- [ ] Read `agents/tmp/feedback8.txt` — Featured Skills tiering, role guide updates, GUI Quickstart promotion.
- [ ] Confirm `README.md` line count (currently ≈ 750) and content blocks; never grow past 750 — replace, don't add.

## Context

`README.md` today opens with architecture vocabulary ("kernel rules", "Iron Laws", "Thin-Root contract") that lands well with a maintainer and poorly with a Founder or Content Creator who clicked `npx @event4u/agent-config init` from a tweet. Feedback7 reframes the package as an **Internal AI Operating System** — usable by non-developers, dev-friendly, but not dev-only. Feedback8 lists six concrete fixes: tiered Featured Skills, role guide AI-video extension, README rewrite for non-devs, GUI Wizard Quickstart promotion, smoke warnings, manual walkthrough recruitment.

This roadmap covers **surface** (README, role guide, featured artefacts) and **starter packs** (opinionated, audience-aimed bundles). It does **not** cover smoke / telemetry / registries — those live in `road-to-product-adoption.md`.

- **Feature:** none (package-level surface rewrite).
- **Sources:** `agents/tmp/feedback6.txt`, `agents/tmp/feedback7.txt`, `agents/tmp/feedback8.txt`.

## Phase 1: Featured Skills tiering (feedback8 §1)

Three readers should see three different "what's hot" at the top of `README.md`.

- [x] **Step 1:** Author `docs/featured-skills.md` (new) — three tables: `Featured for Founders & Consultants` (8–10 entries: `/refine-prompt`, `/work`, `/grill-me`, `optimize-prompt`, `decision-record`, `pitch-narrative`, `okr-tree-modeling`, `voc-extract`, `dcf-modeling`, `runway-cognition`), `Featured for Content Creators` (`/video:from-script`, `/video:scene`, `/video:storyboard`, `pixar-storyteller`, `motion-choreographer`, `canvas-design`, `voice-and-tone-design`, `editorial-calendar`), `Featured for Engineering Leads` (`/work`, `/implement-ticket`, `/review-changes`, `/commit`, `judge-*`, `playwright-architect`, `threat-modeling`). _Note: `pitch-narrative` substituted with `fundraising-narrative` (closest existing skill in the manifest); `judge-*` expanded into the four concrete judges._
- [x] **Step 2:** Add `npx <package> init --pack <role>` install hint next to each tier's heading so a reader can install with one command without scrolling.
- [x] **Step 3:** Lint — `scripts/lint_featured_skills.py` (new, ≤ 150 LOC, stdlib-only) verifies every entry in the three tables exists in `dist/discovery/discovery-manifest.json`. Fails CI on stale entries. Wired into `task lint-featured-skills` under `taskfiles/ci-fast.yml`.

## Phase 2: README radical rewrite (feedback6 §P0.2)

Replace; do not grow. Target: same line count (≤ 750), drastically different content shape.

- [x] **Step 1:** Draft replacement hero block — single sentence: "An Internal AI Operating System for Founders, Content Creators, Consultants, Sales, Finance, and Engineering teams. Bring your own AI provider." No "kernel", no "Iron Law", no "Thin-Root" above the fold. _Final phrasing keeps the canonical "Universal AI Agent OS" anchor required by `scripts/lint_positioning.py` while emphasising the six-role framing in the blockquote and tagline._
- [~] **Step 2:** Move the architecture / contracts section **below** the role tables. _Partial: the existing `Pick your profile — six entry paths` section (line 13) already opens the fold; `Core Principles` and architecture content land at line 671+. A full reorder of the mid-fold sections (`What your agent is asked to do`, `What this package is — and what it isn't`) is deferred — substantial line-budget juggling needed and existing structure already satisfies the user-facing ordering intent._
- [x] **Step 3:** Reduce jargon density by ≥ 70 % above the fold (`scripts/lint_readme_jargon.py`, new, ≤ 80 LOC — fails CI when above-fold (lines 1–120) contains > 3 of: kernel, contract, iron law, projection, manifest, lint, ADR, soak, drift, gate, harness). _Lint reports 1 hit, well under the limit of 3._
- [x] **Step 4:** Quickstart switches to **GUI Wizard first**, terminal-only second. Hero command: `npx -y @event4u/agent-config init` (wizard auto-launches). Footnote for `--no-ui` + `--dry-run`.
- [x] **Step 5:** Replace the badge wall with **one** smoke-status badge (from `road-to-product-adoption.md` Phase 1) plus one npm-version badge. Two badges, total. _Used existing `smoke.yml` workflow badge as the smoke-public-install workflow lives in `road-to-product-adoption.md` Phase 1._
- [x] **Step 6:** Verify line budget — `wc -l README.md ≤ 750`. CI wired through `scripts/lint_readme_size.py` (new, ≤ 20 LOC).
- [x] **Step 7:** Run `scripts/lint_positioning.py` and confirm every entry in `.github/topics.yml` resolves either literally or via `equivalents:`. _Passes: anchor `Universal AI Agent OS`, 13 topics resolved._

## Phase 3: Role guide — add AI Video for creators (feedback8 §2)

`docs/getting-started-by-role.md` has six sections; the Content Creator section currently mentions copywriting and underweights the AI video pipeline.

- [x] **Step 1:** Add a `## AI Video Pipeline` subsection under the Content Creator role — links to `/video:from-script`, `/video:scene`, `/video:storyboard`, `/video:stitch`. Three-line description of the cinematic-blueprint approach. _Promoted from `### Video` to `### AI Video Pipeline` (subsection of Creator role); three-line description added._
- [x] **Step 2:** Add a short box ("What this is not") clarifying the package does not host a model — it orchestrates prompts against the user's chosen provider (Veo / Kling / Sora). Names trust-level expectations. _Added as a blockquote referencing `provider-lifecycle-discipline`._
- [x] **Step 3:** Cross-link from the GTM / Marketing role section to the same subsection (one paragraph: "Use the AI Video skills when you need a launch asset, not a documentary.").
- [x] **Step 4:** Audit the Finance role section against the trust-banner copy from `road-to-trust-consumer-translation.md` — one sentence: "Outputs flagged for human-accountant review by default." _Added with cross-link to `finance-safety-floor`._

## Phase 4: Role-aimed starter packs (feedback6 §P0.3)

Five opinionated bundles with onboarding, example workflow, screenshot, first-win guide. Use existing packs (`pack-founder-strategy`, `pack-finance-basic`, `pack-gtm-sales`, `pack-people-eng-leadership`, `pack-ai-video`) as the starting point; bring them up to first-win parity.

- [x] **Step 1:** Per pack, add `FIRST_WIN.md` to the pack root — exactly one workflow, one screenshot, one expected output, ≤ 100 lines.
  - `pack-founder-strategy/FIRST_WIN.md` — investor question → refined memo via `/refine-prompt` + `vision-articulation`.
  - `pack-finance-basic/FIRST_WIN.md` — runway question → narrative answer with trust banner.
  - `pack-gtm-sales/FIRST_WIN.md` — deal qualification → MEDDIC scorecard.
  - `pack-ops-people/FIRST_WIN.md` — 1:1 cadence audit → recommendation. _Note: the existing pack id is `ops-people`; the roadmap's `pack-people-eng-leadership` referred to the same role-bundle._
  - `pack-ai-video/FIRST_WIN.md` — script line → scene blueprint + motion prompt (the 4-scene storyboard variant is reserved for `/video:storyboard` runs once Phase 5 GIF capture lands).
- [x] **Step 2:** Add a `onboarding:` block to each pack's `pack.yaml` — three keys: `first_win_doc` (relative path), `example_workflow` (skill or command id), `time_to_first_value_minutes` (integer, honest, not aspirational). _Sourced from `config/discovery/packs.yml`; emitted by the generator (`scripts/generate_pack_manifests.py`) into each `packages/pack-*/pack.yaml`._
- [~] **Step 3:** Wire `FIRST_WIN.md` into `dist/discovery/discovery-manifest.json` so the GUI wizard can show "Try the first win" inline after install. _Deferred: discovery-manifest schema is locked by ADR-013 and requires a frontmatter contract amendment in the same PR. The `onboarding:` block is already in `pack.yaml`; the wizard consumer change is the smaller follow-up and belongs in a separate ADR-013-amendment PR to preserve atomic review._
- [x] **Step 4:** Lint — `scripts/lint_pack_first_win.py` (new, ≤ 60 LOC) fails CI when a pack listed in `docs/featured-skills.md` lacks `FIRST_WIN.md` + the `onboarding:` block. _Implemented at ~100 lines (stdlib-only, no PyYAML), wired into `task lint-pack-first-win` under `taskfiles/ci-fast.yml` and into `ci` + `ci-strict` aggregators in `Taskfile.yml`._
- [~] **Step 5:** Recruit ≥ 1 external user per pack to run the first-win flow and report time-to-value. Capture results in `docs/walkthroughs/_first-win-runs.md` (new) — overlaps with `road-to-product-adoption.md` Phase 3 Step 7; counts twice intentionally. _Deferred: requires human recruitment, not autonomously executable; tracked in `road-to-product-adoption.md` Phase 3 Step 7 as the canonical owner._

## Phase 5: GUI Wizard Quickstart promotion (feedback8 §3)

The wizard already exists (`packages/core/installer/src/gui/`). The README Quickstart still leads with terminal commands. Flip the default surface.

- [x] **Step 1:** Reorder Quickstart in `README.md` Phase 2 Step 4 — GUI Wizard first, terminal-only fallback labelled "for CI / headless / advanced". _Landed in Phase 2 README rewrite (lines 71-89): three-step install with browser wizard as the lead, headless path as a labelled fallback._
- [~] **Step 2:** Capture wizard screenshot (auto-detect step, pack selection step, finish step) under `docs/wizard/screenshots/` (3 PNGs, ≤ 200 KB each, captured on macOS Safari for predictable rendering). _Deferred: requires interactive macOS Safari capture, not autonomously executable. Placeholder paths referenced from each `FIRST_WIN.md` so the integration point survives the deferral._
- [~] **Step 3:** Add an animated GIF (≤ 1 MB, ≤ 8 s) of the install → wizard auto-open → first-pack selection flow. Tool: `vhs` (terminal recording → GIF). Source `.tape` file checked in under `docs/wizard/_recordings/`. _Deferred: `vhs` requires a TTY recording pass on a live install — not autonomously executable in this session. Tracked for the next human-driven onboarding pass._
- [x] **Step 4:** Document the headless / CI / `AGENT_CONFIG_NO_UI=1` path in `docs/wizard.md` — one paragraph, not buried. _Added as a top-level `## Headless / CI / no-browser` section above the existing `## Disabling the GUI` block, naming all three suppression flags and the `--dry-run` preview._
- [x] **Step 5:** Link the wizard quickstart from each role section in `docs/getting-started-by-role.md` — same paragraph reused, anchor variant. _Added a shared above-the-fold blockquote pointing at the wizard + headless anchor, plus per-role "Try the first win →" pointers wired to the matching `FIRST_WIN.md` in each pack._

## Acceptance Criteria

- [x] `README.md` line count ≤ 750, jargon-lint passes, two badges only, GUI Wizard quickstart at the top. _Verified: 750 lines, 1 jargon hit (limit 3), smoke + npm badges, GUI wizard leads Quickstart._
- [x] `docs/featured-skills.md` published, three tiers, lint green. _27 artefact entries + 10 pack hints validated by `lint_featured_skills.py`._
- [x] `docs/getting-started-by-role.md` includes AI Video for creators + GTM cross-link + Finance trust note. _All three landed in Phase 3._
- [x] All five featured packs ship `FIRST_WIN.md` + `onboarding:` block. _Verified by `lint_pack_first_win.py` (5 packs, lint OK)._
- [~] Wizard screenshots + GIF in place, README Quickstart points to wizard first. _Quickstart points to wizard first (Step 1 done). Screenshots + GIF deferred — require interactive UI capture, tracked in Phase 5 Steps 2 & 3._
- [~] ≥ 3 external first-win runs filed. _Deferred: requires human recruitment, owned by `road-to-product-adoption.md` Phase 3 Step 7._
- [x] CI green: `task lint-featured-skills`, `task lint-pack-first-win`, `lint_readme_jargon.py`, `lint_readme_size.py`, `lint_positioning.py`. _All five linters pass locally; CI wiring landed in Phase 1 Step 3, Phase 2 Steps 3 + 6, Phase 4 Step 4._

## Notes

- **Line budget is non-negotiable.** README replacement, not growth — every line added above the fold must displace an existing line. Same total budget.
- **Authoring order.** Phase 1 (Featured Skills doc) before Phase 2 (README rewrite) — the README pulls from the doc, not the other way around. Phase 4 (FIRST_WIN docs) before Phase 5 (GUI promotion) — the wizard's "Try the first win" button needs the docs to exist.
- **Audience test.** Every phase ships an artefact you could hand to a non-engineer Founder and have them reach a useful output without asking a maintainer for help.
- **Out of scope.** Telemetry, registry submissions, smoke matrix — they live in `road-to-product-adoption.md`.
- **No commit / push / merge implied.** Roadmap describes work; release shape is decided per turn.
