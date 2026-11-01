---
complexity: structural
status: later
tree_pin: 20076a8d5b
execution:
  mode: phase-checkpoints
entry_condition:
  what: >-
    An owner-directive record under agents/evidence/owner-directives/ that names
    road-to-docs-that-sell is on main, so the roadmap can be promoted
    above the WIP cap of five (8 active at the pin) without an agent authorising
    its own growth. The owner request of 2026-11-01 is the substance; the record
    is the form the estate gate reads.
  when: >-
    As soon as the owner merges that record. Phase 0 decisions may be taken
    before promotion; no copy is written before Phase 0 closes.
  who: >-
    The owner, for the directive record and for the owner-reserved rulings in
    Phase 0 (0.1, 0.2, 0.8); the council, for the reversible rulings (0.3–0.7).
review_by: 2026-11-29
estate_growth_exempt: >-
  later_roadmaps +1: owner-requested plan (2026-11-01) to rewrite README, the
  docs site and the user docs. Not added active because the estate holds 8
  active roadmaps against a WIP cap of 5 and an active addition needs an owner
  directive already on main; parked here until that record lands rather than
  offset by archiving unrelated work.
relates:
  - slug: road-to-listings-the-owner-submits
    relation: disjoint
    note: "registry and marketplace submissions stay there; this file only makes the README and site they point at worth landing on (Phase 10.4)"
  - slug: road-to-17-0-follow-ups
    relation: disjoint
    note: "its step 6.4 (retire 'zero runtime' from the docs site) is executed here as 2.4; close it there by reference when 2.4 lands"
  - slug: road-to-contract-integrity
    relation: disjoint
    note: "its README/Cookbook family-first item F2 is satisfied by Phase 7 if still open at that time"
  - slug: road-to-a-showcase-the-owner-paid-for
    relation: disjoint
    note: "a paid benchmark showcase would feed 6.7 and 7.3 with stronger numbers; this plan ships without it and never invents one"
---
# Road to docs that sell

> **Source:** owner request of 2026-11-01 in a working session: rework the README
> and every user document, rebuild the Starlight site to at least the quality of
> the sibling event4u data-helpers docs (info-banner, clean structure), embed
> `.github/assets/info-image.png` in README and docs, and write for people who
> decide in fifteen seconds — "make Agent Config a must-have". The request came
> with an external growth review (see Provenance). Every fact below was
> re-derived from the tree at `20076a8d5b` over five analysis rounds; none is
> taken from the review or from existing prose.

## Goal

Truthful docs. A newcomer on GitHub, npm
or the docs site grasps in one screen what it does, installs it with one
command, and learns its cost and removal — every sentence true and gate-kept.

## Provenance

An external growth review (pasted by the owner, not committed) argued that the
project has a distribution and positioning problem rather than a capability
problem, and proposed a hero claim, a 90-day launch plan, standalone "entry
point" skills and benchmark headlines. Adopted: the positioning diagnosis, the
"show, don't list" principle, the first-screen install, feature-level entry
pages. Rejected after checking the tree: unmeasured headline percentages,
separate installable products for engine-bound features (ADR-209, ADR-133,
ADR-108), and any growth target as an acceptance criterion (ADR-286 D2/D4).

## What the analysis found (at the pin)

- **README** (576 lines, 4,845 words against a frozen 4,849-word budget): the
  H1 sells "machine-checked claims", the real one-liner sits at L207; three
  contradictory install-scope statements (L150, L202, L398); stale "Upgrade to
  14.x" at 19.1.0; three broken links; Zed/JetBrains/Aider listed as compiled
  hosts though export-only; about 60 relative `docs/` links that the npm page
  resolves only through GitHub.
- **Site** (`site/`, Starlight 0.42, GitHub Pages): 20 short hand-written pages
  plus 5 synced maintainer dumps (proof 524, benchmark 1,009, CLAIMS 1,541,
  catalog 803 lines); no logo, no info-banner; "zero runtime" still on the
  landing, intro and architecture pages against ADR-249; "7+ hosts" against 20.
  `sync-docs.mjs` duplicates H1s and leaves sibling relative links unrewritten;
  `check_site_links` skips relative links; `site.yml` never runs on `docs/**`.
- **docs/** (~93 top-level files): ten duplicate clusters; `installation.md`
  contradicts itself on scope; uninstall docs say no command exists while
  `agent-config uninstall` (`src/scripts/_cli/cmd_uninstall.ts`) does;
  `--tools=gemini` is not a valid id (`gemini-cli`).
- **CLI first five minutes:** `--help` lists ~125 commands grouped by
  implementation, six entry commands without an order, `init --help` prints the
  bash installer's usage, `doctor` shows a red check before anything is
  installed and writes files while labelled read-only.
- **Images:** `info-image.png` (owner-supplied, 1774×887, 3.8 MB) shows
  unmeasured figures ("-58% errors", "+47% test coverage", "+63% reliability"),
  mock code in a language the repo does not contain, and the review's own
  advice text; `info-banner.png` says "Stored in your repo" against ADR-020.
  No gate reads image text.
- **Evidence that is real:** the production-validator hollow-detection result,
  the advisory-vs-blocking conformance rows, the honest-null benchmark set, the
  proof GIF, and a deterministic `code-graph map --demo` on fixture data with
  fake authors — the strongest visual the project owns, not yet hosted.
- **Cost truth:** the full package runs at ~11.7× vanilla tokens on the Haiku
  sweep, the essential cut at 3.3× with nearly the same lift; Sonnet was null;
  nobody reading the README learns this.

## Phase 0 — Decisions before copy

Each ruling is recorded as a dated note under `docs/decisions/` (or an ADR where
it changes a recorded decision) before any phase that depends on it starts.

- [x] **0.1 info-image.png.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> Owner ruling. Facts: the owner asked for it in
      README and docs; its three percentages have no backed claim, its code
      panel and advice paragraph are not product copy, ADR-249's surface test
      forbids unverified runtime properties on public surfaces. Options:
      (a) re-render without the benchmark bar, the mock code and the advice
      text, then embed; (b) embed as is; (c) do not embed.
      **Decided 2026-11-01 by the owner: (a).** The re-rendered image replaces
      `.github/assets/info-image.png` (9.1) and is embedded as the "how it fits
      together" visual on README (7.3), landing (6.2) and Introduction — never
      as the hero; alt text names the components it shows.
- [ ] **0.2 info-banner.png.** Owner ruling on the two false lines ("Stored in
      your repo" vs global-only ADR-020; "Built for Claude, Codex & local
      agents" vs 20 written hosts): re-render, or keep with a caption that
      states the truth. It stays the hero on README, landing and Introduction.
- [ ] **0.3 One-liner.** Pick the H1 tail that becomes byte-identical in
      README, `package.json` description and `.github/about.yml` (≤200 chars,
      no serial comma, no jargon list word). Candidate set and reasoning in
      Appendix A; recommended: "make your AI coding agents check their work
      before they say done". Record the retired tail.
- [ ] **0.4 README order lock.** Council re-evaluation of
      `readme_audience_order.test` and the anchor table in
      `docs/readme-split-plan.md`: keep "Use it → Prove it → Contribute before
      Quickstart" as short router sections, or move Quickstart ahead. Record
      the outcome with a `revisit-if`; if anchors move, the linter change ships
      with 7.2.
- [ ] **0.5 Install-scope sentence.** One canonical sentence, derived from
      ADR-020, ADR-293 and `src/scripts/install.ts:1692-1831`, stating what is
      written globally, what lands in a repo and whether `init --project` is a
      user command. Every later phase copies this sentence; none paraphrases it.
- [ ] **0.6 Entry-command story.** Which single command the docs teach first
      (`init`), and what `install`, `setup`, `first-run`, `config` become in user
      copy (aliases, advanced, hidden). Phase 4 implements it; Phases 6–7
      describe it.
- [ ] **0.7 Canonical-page map.** For each of the ten duplicate clusters
      (getting started, profiles, flows, catalogs, benchmark, MCP, proof,
      migration, censuses, governance) one canonical page and a fate for every
      other member (merge, pointer stub, move to maintainers, keep generated).
      Phase 2 fixes only surviving pages; Phase 8 executes the map.
- [ ] **0.8 Feature entry points vs the reach freeze.** Owner ruling: feature
      pages on the docs site are allowed; linking the existing per-skill
      Claude.ai ZIPs (`cloud-release.yml`) for `code-review` and
      `security-audit` as named entry points is a launch-shaped act while
      ADR-133 holds and ADR-134 has lapsed. Options: link them, or keep them in
      the installation reference only.

## Phase 1 — Close the blind spots first

Every later phase merges through these gates, so they land before any copy.

- [x] **1.1 Site CI sees docs.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_site_links.ts --> `site.yml` and `deploy-site.yml` trigger on
      every path `sync-docs.mjs` reads (today `docs/**`, `docs/media/**`); the
      missing `docs/guides/works-with-agent-switch.md` filter is the regression
      case. verify: a PR touching only a synced doc runs the site build.
- [x] **1.2 Relative links are checked.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_site_links.ts --> `check_site_links` resolves relative
      hrefs against the page URL instead of skipping them (`:68`), and checks
      `#fragment` targets on internal pages. verify: a seeded broken relative
      link and a seeded dead fragment both fail its self-test; the current
      build passes or its real breakages are fixed in the same change.
- [x] **1.3 README-only PRs run the README gates.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_site_links.ts --> `lint_positioning` and
      `check_claims` run on PRs touching `README.md`, `package.json` or
      `.github/about.yml` (today they ride workflows without those paths).
      verify: workflow path filters list the three files.
- [x] **1.4 Numbers on the site need a claim.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_site_links.ts --> The `check_claims` witness
      sweep (ratio, magnitude, self-count) extends to hand-written
      `site/src/content/docs/**`, with the same `claim:` marker escape. verify:
      a seeded "40% fewer bugs" in a site page fails; the existing pages pass or
      are fixed.
- [x] **1.5 Hard-coded path inventory.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_site_links.ts --> A committed maintainer report lists
      every doc path named by `src/scripts`, `tests`, `.github` and
      `src/config/gate-coverage.yml` (`update_counts` TARGETS,
      `check_supervision_claim_atomicity` PUBLIC_SURFACES, role-doc links,
      contract tests). Phases 6 and 8 update an entry in the same change that
      moves its page. verify: the report regenerates byte-identically.

## Phase 2 — Truth fixes on surviving pages

Only pages that survive the 0.7 map are edited; doomed pages are left for
Phase 8.

- [ ] **2.1 Uninstall is documented.** Replace every "no uninstall command"
      (`docs/installation.md:1050-1058`, the site installation page) with
      `agent-config uninstall` and its flags, plus the one full-removal
      sequence: global purge, project leftovers, the hooks block in
      `~/.claude/settings.json`, removing the npm package. verify: the sequence
      run in a throwaway HOME leaves no agent-config path behind.
- [ ] **2.2 One scope sentence everywhere.** README L150/L202/L398,
      `docs/getting-started.md:44`, `docs/installation.md` L239/L784 and the
      site pages carry the 0.5 sentence. verify: a grep for "project-local
      (default" and "Project-installed mode (recommended" returns nothing.
- [ ] **2.3 Host facts match the code.** `--tools=gemini` → `gemini-cli`
      (installation.md, per-ide gemini page); one Claude Code plugin stance
      (shim, not a content channel, per ADR-209); export-only hosts named as
      such; the Codex row checked against `codex_skill_finder.ts` and
      ADAPTER_REGISTRY; "7+ hosts" replaced by the backed host count with its
      claim marker. verify: `./scripts-run src/scripts/lint_supported_tools_matrix` -> 0
      and the grep for `--tools=gemini` and "7+ host" over README, docs/ and
      site/ returns nothing.
- [ ] **2.4 No "zero runtime" on public pages.** Remove or relabel as policy
      every no-runtime/no-daemon assertion in `site/astro.config.mjs`,
      `index.mdx`, `introduction.md`, `architecture/overview.md`,
      `docs/us-vs-the-category.md` and `docs/positioning-evidence.md` per the
      ADR-249 surface test. verify: grep for "zero runtime|no runtime|no
      daemon" outside `docs/decisions/` and `docs/archive/` returns nothing.
- [ ] **2.5 Stale and broken.** "Upgrade to 14.x", the dangling "those four",
      the three broken README links, `docs/github-topics.md` contradicting
      `.github/topics.yml`, the `python` npm keyword, and the homepage mismatch
      between `package.json` and `.github/about.yml`. verify: readme_linter
      and `lint_topics_yaml` green; the three links resolve.
- [ ] **2.6 What leaves your machine.** One page listing every network call
      with its default and kill switch: the daily update check (on), advisory
      refresh, upgrade verification, council (own keys), the optional cloud
      MCP; telemetry off. Sourced from `agent-settings.template.yml` and
      `SECURITY.md`. verify: each row cites the setting or file it comes from.

## Phase 3 — Message and copy foundation

- [ ] **3.1 Message house.** A maintainer doc (`docs/maintainers/message-house.md`)
      with three personas (solo developer, mixed-tool tech lead, non-engineer
      profile user) and their install fear, the 0.3 one-liner, three pillars
      — checks its work, every tool you use, focused and leaves cleanly — each
      bound to a `backed` CLAIMS id, and the honest trade-offs (token cost,
      blocking only on Claude Code). Draft in Appendix A. verify: every
      capability sentence carries a CLAIMS id whose status is `backed`.
- [ ] **3.2 One before/after, reused.** The narrated scenario grounded in the
      `wedge-hollow-detection` claim: before, the agent says "done" on a stub;
      after, `production-validator` answers NOT READY with file and line. Told
      as a scenario, never as invented terminal output, with the Claude-only
      turn-end block stated as such. Used verbatim on README, landing and
      Introduction.
- [ ] **3.3 Plain vocabulary.** A docs-voice guide listing the words user copy
      avoids and their replacements (governed, projection, kernel, wedge,
      judges, council, Iron Law, ADR numbers), the sentence rules (one-sentence
      lead, code first, no serial comma in README), and where jargon is allowed
      (Reference, Maintainers). verify: `./scripts-run src/scripts/lint_readme_jargon` -> 0
- [ ] **3.4 Day-one commands.** The five commands a newcomer needs, verified
      against the command registry visibility (`visible`/`advanced`): `/work`,
      `/implement-ticket`, `/review-changes`, `/commit`, and
      `agent-config doctor`. Each with one sentence of what it does for them.
- [ ] **3.5 The two honest answers.** "Why not a short CLAUDE.md?" answered
      from the benchmark row where kernel plus one rule kept most of the lift at
      3.3×, plus what the router and hooks add beyond a static file; "What does
      it cost?" answered per profile from `docs/benchmark.md` with the Haiku
      scope caveat. verify: every figure carries a claim marker or a benchmark
      anchor.

## Phase 4 — The CLI tells the same story

Docs cannot fix a confusing first five minutes; this phase lands before the
pages that describe the CLI. Each step ships with a test that was red first.

- [ ] **4.1 Help grouped by task.** Default `agent-config --help` groups
      commands by what a user wants (Get started, Daily use, Inspect, Configure,
      Maintain), shows at most 60 lines, keeps internals under `help
      --tier=all`, and drops ADR numbers and implementation labels from
      descriptions. verify: a snapshot test of the default help.
- [ ] **4.2 `init --help` is about `init`.** It prints `agent-config init`
      usage and the flags a user passes, not `bash scripts/install`. verify:
      snapshot test.
- [ ] **4.3 Dry run says what it would do.** `init --dry-run` honours
      `--offline`, lists the files it would write per tool, prints lowercase
      booleans and never suggests a repo-internal path. verify: test on a temp
      HOME asserts the listed paths and that nothing was written.
- [ ] **4.4 `doctor` before install.** On a machine with no install it reports
      one neutral "not installed — run agent-config init" state without red
      checks, and in its default mode writes no files and starts no other
      vendors' CLIs, or its help stops calling it read-only. verify: a
      filesystem diff of a temp HOME and project before and after.
- [ ] **4.5 Small honesty fixes.** `first-run --help` prints help; the
      unknown-command hint names `agent-config help`; `doctor --help` and
      `code-graph --help` describe their flags and verbs.
- [ ] **4.6 One line for legacy keys.** Removed-key warnings collapse into one
      summary line with the command that cleans them, instead of ~45 lines on
      every invocation. verify: test with a legacy settings fixture.

## Phase 5 — Site engine

- [x] **5.1 Manifest-driven sync.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: site/sync-docs.mjs --> `sync-docs.mjs` reads a manifest (or a
      `site:` frontmatter key) instead of a five-entry array, writes nested
      routes, and replaces the per-file `.gitignore` lines with one generated
      subtree. verify: adding a page needs one manifest line and nothing else.
- [x] **5.2 Link classifier.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: site/sync-docs.mjs --> Every link is resolved relative to its source
      file and classified: synced page → site route; other `docs/` file →
      GitHub blob under `docs/`; anything else → GitHub blob. The build fails on
      any remaining relative `.md` link. Fixes the first-dot-only escape at
      `:53`. verify: unit tests per class plus the 1.2 checker.
- [x] **5.3 Synced pages look native.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: site/sync-docs.mjs --> The first H1 becomes the title and is
      stripped from the body, the first paragraph becomes the description,
      `editUrl` points at the `docs/` source, and generated pages show a
      visible "generated from … — edit the source" aside.
- [x] **5.4 Hosted demo map.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: site/sync-docs.mjs --> The site build runs `code-graph map --demo` into
      `site/public/demo-map/` with a size budget, and the page keeps its
      "sample data" chip. verify: the deployed URL returns 200 and the artefact
      stays under the budget.

## Phase 6 — The docs site, rebuilt

Quality bar: the sibling data-helpers site (splash hero, info-banner under the
hero, feature cards, one striking example reused everywhere, collapsed sidebar,
code-first pages, deep links) — without its broken next-step links.

- [ ] **6.1 Brand.** An SVG logo from the AC mark (already traced inline in
      `code_graph/map.ts`), favicon, GitHub and Sponsor social links (from
      `.github/FUNDING.yml`), the 0.3 one-liner as description, and an
      Open Graph image derived from the info-banner.
- [ ] **6.2 Landing page.** Splash hero with the one-liner and Get started /
      GitHub actions; the info-banner directly under the hero; a six-card
      feature grid mapped to real commands (plan, implement, review, check
      "done", map your code, commit and PR); the 3.2 before/after; five "why"
      bullets including the cost line; the 0.1 image in a "how it fits
      together" section; next-step cards. verify: link check green.
- [ ] **6.3 Sidebar.** At most eight groups, only Get started expanded: Get
      started · Workflows · Your tool · Features · Configure · Trust & cost ·
      Reference · Maintainers. No group with a single page.
- [ ] **6.4 Get started.** Introduction (banner, one-liner, before/after),
      Install (Steps; Tabs for desktop wizard, headless/CI, curl), Your first
      task, Choose a profile, Requirements, Update, Uninstall (2.1). Each page
      opens with one sentence and reaches a command within the first screen.
- [ ] **6.5 Your tool.** One page per tier (full projection, plugin, bundle,
      export-only) with a Tab per host: what is written where, whether hooks can
      block, the restart or upload step. Sourced from `surface-matrix.yml`,
      `install.ts` and `docs/enforcement-by-host.md`, after the per-ide fixes
      of 8.4.
- [ ] **6.6 Feature pages.** Implement (`/work`, `/implement-ticket`), Review
      (`/review-changes`, `production-validator`), Code map (hosted demo,
      screenshots), Security, Roadmaps, Cost and budget, Second opinion
      (council), Memory, Design system. Each states what it does, when to use
      it, one example, what it needs (engine, API keys, host) and its limits.
      These are the entry points the review asked for, as pages.
- [ ] **6.7 Trust & cost.** A human-written "Benchmark & cost, explained" page
      above the generated ledger, "What leaves your machine" (2.6),
      "Enforcement by host", and the proof page; the generated proof,
      benchmark, claims and catalog move under Reference with the 5.3 aside.
- [ ] **6.8 Reference and Maintainers.** CLI reference generated from the
      command registry rather than hand-listed; settings reference; glossary
      (from `docs/CONCEPTS.md`); Taskfile reference and source-of-truth pages
      move to the collapsed Maintainers group.
- [ ] **6.9 Voice pass.** Every user-facing page follows 3.3. verify: grep for
      "ADR-" and "Iron Law" outside Reference and Maintainers returns nothing;
      every page has `title` and `description`.

## Phase 7 — README, rewritten to shrink

The size gate says "replace, do not grow"; depth moves to the site.

- [ ] **7.1 Word budget first.** A per-section word table summing to at most
      4,400 words (gate 4,849) is added to `docs/readme-split-plan.md` before
      drafting.
- [ ] **7.2 First screen.** Info-banner, H1 with the 0.3 tail, one badge row,
      one value sentence, the install fence (`npx -y @event4u/agent-config
      init`) and one line saying what happens next. If 0.4 moved anchors, the
      lint and test changes ship here.
- [ ] **7.3 Body.** Proof GIF; "What changes" (3.2 plus the default-vs-with
      table); the 0.1 image; "What it costs" (3.5, five lines); code map
      screenshot linking the hosted demo; profiles; workflows; the audience
      router sections; Quickstart; Supported tools; Requirements; Development;
      LEGAL_NOTICE link. Outline in Appendix A.
- [ ] **7.4 Built for the npm page.** Each section ends with an absolute deep
      link to its site page; no relative `docs/` links remain except the
      allowlist the gates require. verify: grep for `](docs/` matches only the
      allowlist.
- [ ] **7.5 Gate anchors kept.** Count badges, the supported-tools table, the
      default-scope sentence, the host-cost link, the Codex row and the legal
      notice stay where their tests read them; any moved anchor updates
      `update_counts` TARGETS in the same change.
- [ ] **7.6 Metadata in one change.** `package.json` description and keywords,
      `.github/about.yml` description and homepage, `.github/topics.yml` (the
      two video topics questioned against the new headline). verify:
      `lint_positioning` and `lint_topics_yaml` green.

## Phase 8 — docs/ consolidation

- [ ] **8.1 Execute the canonical map.** Each cluster ends with one canonical
      page; merged pages become one-line pointer stubs; every move updates its
      1.5 inventory entry and its gate in the same change. Generated files
      (`llms.txt`, `docs/skills-catalog.md`, `docs/catalog.md`, `docs/proof.md`)
      are never hand-edited.
- [ ] **8.2 Maintainer and record docs move out of the user path.** Censuses,
      audits, runbooks and internal reports move under `docs/maintainers/` (or
      stay as records) so `docs/` top level is the user set.
- [ ] **8.3 Root files.** `ONBOARDING.md` (an internal orchestration report)
      moves to maintainers; root `MIGRATION.md` vs `docs/MIGRATION.md` resolves
      with a check of the npm `files` list and consumer impact; references in
      `check_bundle_path_leakage.ts` and `report_obligation_carriers.ts`
      follow.
- [ ] **8.4 Per-tool pages fixed at the source.** The 23 `docs/setup/per-ide/`
      pages agree with global-only install, the plugin stance and the real
      layouts, so 6.5 can sync them.

## Phase 9 — Visual assets

- [x] **9.0 Re-rendered info-image.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> Per 0.1: a new
      `.github/assets/info-image.png` without the benchmark bar
      ("-58% / +47% / +63%"), without the mock code panel and without the
      review's advice paragraph; remaining labels name only shipped features
      (code review, security audit, code map, cost report, roadmaps, council,
      memory, skills). verify: every label maps to a real command or skill and
      the image carries no number.
- [x] **9.1 Web-sized images.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> Optimised copies (WebP or compressed PNG, at
      most 300 KB each) of the banner and the 0.1 image for README and site;
      originals stay in `.github/assets/`; alt text describes the content.
- [ ] **9.2 Reproducible map captures.** A Playwright script captures the demo
      map's graph with blast radius, ERD, history, matrix and knowledge views
      plus a short clip, replacing the five stale self-map screenshots. Each
      embed gets its ADR-125 human confirmation before it ships.
- [ ] **9.3 Setup wizard strip.** The existing `wizard-browser.spec.ts`
      dry-run screenshots are exported behind an env flag into one strip for
      the Install page.
- [x] **9.4 Social preview.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> A 1280×640 preview from the banner; uploading it
      in the repository settings is an owner step.

## Phase 10 — Discoverability inside the decisions

- [ ] **10.1 Feature pages carry search titles.** Each 6.6 page has a
      descriptive title and description (for example "AI code review that
      demands evidence"), so a search for the feature lands on the page.
- [ ] **10.2 Per-skill ZIPs, if 0.8 allows.** Run the cloud-compatibility audit
      for `code-review` and `security-audit`; if eligible and 0.8 says link,
      the Review and Security pages link the release ZIPs, otherwise the
      installation reference keeps them.
- [ ] **10.3 MCP path documented.** The Review page shows how to read the
      skill through `agent-config mcp-server` (`read_skill`) without the full
      install, stating that it is read-only.
- [ ] **10.4 Hand-off to listings.** The listings roadmap gets a note that the
      new README and site are in place; no submission happens here.

## Phase 11 — A newcomer can do it

- [ ] **11.1 Walkthrough.** A fresh session, given only the site URL, installs
      into a throwaway HOME, runs one task and uninstalls, recording time and
      every point of confusion; each finding is fixed or recorded.
- [ ] **11.2 Independent read.** A reviewer session that did not write the copy
      reads README and landing page with a neutral prompt that states no
      expected outcome; the prompt is committed with its findings.
- [ ] **11.3 Final sweep.** The README, site, claims, language and link gates
      run narrowly on the final change and are green.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Marketing copy outruns the evidence | product | Persuasive wording drifts into numbers or runtime properties nobody measured, the failure ADR-249 and the claims ledger exist to stop | 1.4 extends the claims sweep to the site; 3.1 binds every pillar to a backed id; 0.1 keeps unmeasured image text out | Phase 0 — Decisions before copy |
| 2 | Moving pages breaks gates | implementation | Gates and tests hard-code doc paths; a consolidation silently drops a page from a scan floor or turns a gate red | 1.5 inventory; every move updates its entry in the same change | Phase 1 — Close the blind spots first |
| 3 | Copy describes a CLI that changes underneath | implementation | Pages written before the help and entry commands settle need rewriting | 0.6 decides the story; Phase 4 lands before Phases 6–7 | Phase 4 — The CLI tells the same story |
| 4 | README grows past its frozen budget | implementation | Adding a value table, cost block and demo pushes the README over 4,849 words | 7.1 budget table first; depth moves to the site | Phase 7 — README, rewritten to shrink |
| 5 | Screenshots leak private data | product | Automated captures of real maps or UIs embed paths or names | Captures come from the fixture demo; each embed gets ADR-125 confirmation | Phase 9 — Visual assets |

## Acceptance Criteria

- [ ] AC-1 — README, `package.json` and `.github/about.yml` carry the same
      one-liner; the README's first screen holds the value sentence and the
      install command; the size, jargon, positioning, supported-tools,
      audience-order and claims gates are green.
- [ ] AC-2 — The docs site shows a logo and the info-banner on the landing page
      and Introduction, has at most eight sidebar groups with only Get started
      expanded, and builds with a link check that covers relative links and
      fragments.
- [ ] AC-3 — No public page asserts "zero runtime", a wrong tool id, a missing
      uninstall command or an install scope other than the 0.5 sentence.
- [ ] AC-4 — Every number on README and hand-written site pages carries a claim
      marker resolving to a backed entry, and every embedded image passed its
      0.1/0.2 ruling and, where it shows data, its ADR-125 confirmation.
- [ ] AC-5 — Each of the ten duplicate clusters has exactly one canonical page;
      the scan floors of `update_counts` and the supervision-claim gate hold.
- [ ] AC-6 — Default `agent-config --help` fits in 60 lines grouped by task, and
      `doctor` on a fresh HOME exits without a red check and writes nothing.
- [ ] AC-7 — The 11.1 walkthrough reaches a first task and a clean uninstall
      using only the site, with its findings fixed or recorded.

## Appendix A — Copy drafts (inputs for 0.3, 3.1, 7.3)

**H1 tail candidates** (`Agent Config — …`):

1. make your AI coding agents check their work before they say done
   *(recommended: names the shared pain, matches the strongest backed proof,
   carries no number, does not over-claim on advisory hosts)*
2. AI coding agents that plan first, test properly and verify before they finish
3. your engineering habits installed into every AI coding tool you use
4. skills, rules and workflows that keep AI coding agents honest in any tool
5. one install that teaches Claude Code, Cursor and Copilot to plan, test and verify

**Sub-line:** "Install once. Your AI coding tools plan, test and verify before
they say done." (88 characters)

**Pillars:** checks its work (`wedge-hollow-detection`,
`discipline-lift-weak-host`, `conformance-advisory-vs-blocking`) · every tool
you use (`host-agent-count`) · focused and leaves cleanly
(`surgical-uninstall`, `uninstall-purge-inventory-bounded`,
`default-install-context-cost`) · roof: we publish our nulls
(`positioning-honest-nulls`). Re-check each id's status at write time.

**README outline:** banner → H1 → one badge row → value sentence + install
fence → proof GIF → Try it in 30 seconds → What changes → how-it-fits image →
What it costs → See what a change touches → Pick your profile → Workflows →
Use it in your project → Prove it → Contribute → Quickstart → What it is and
isn't → Demo → Customize → Supported tools → Works with agent-switch → Who this
is for → Documentation → Troubleshooting → Development → Requirements → Funding
→ License.

**Newcomer FAQ seeds:** what it is · which tools · how to install · where it
writes · token cost · does it make the model smarter (no — discipline on weaker
models, null on a strong one) · enforced or advisory · how to remove it · what
it sends over the network · is it for non-developers.
