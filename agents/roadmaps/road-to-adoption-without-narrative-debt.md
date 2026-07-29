---
complexity: structural
status: ready
---

# Road to adoption without narrative debt — win users on the proof identity, not on unbacked headline numbers

> Close the adoption gap (7 stars / 1 fork at 8.0.0) without adopting the one
> thing the package explicitly positions against: unverifiable headline numbers.
> The category's growth playbook is viral-thread + big-number marketing (an ECC
> that self-claims "211.9K stars" while a directory counts 6,080; a swarm tool
> citing an "84.8%" with no reproducible method). This roadmap builds a
> distribution engine whose every public number resolves to evidence — turning
> the proof surface itself into the growth wedge.

## Goal

Ship a distribution motion — wedge, story, discoverability, activation-measured
onboarding — that grows real installs while every public claim stays bound to
`docs/CLAIMS.md`, so adoption is earned on falsifiability rather than borrowed
from inflated metrics.

> **Sequencing + polish gate (council 2026-07-08, per
> `archive/road-to-composition-ratchet.md`):** this roadmap is the next one to
> execute. While it has open phases, no new settings-UI / theming /
> config-management polish features ship — exceptions: bug fixes, completing
> broken first-run flows, CI/claims infrastructure. Gate exits when 3 external
> adoptions are documented or this roadmap is archived. Maintainer discipline,
> advisory — no CI teeth.

## Context (measured, do not relitigate)

- Adoption today: 7 stars, 1 fork; 8.0.0 solo-merged (1 participant, no external
  reviewers, 37 checks green). Distribution scaffolding shipped in 8.0.0:
  Starlight site on GitHub Pages, proof demo GIF, `init --fleet` multi-repo
  rollout, awesome-list draft, B9 install-friction study instruments.
- The proven, honest value wedge is narrow and real: on weak/cheap hosts, the
  `essential` tier transplants scope/downstream discipline at 1.71–3.3× cost,
  auto-off on measured-null hosts. That is the lede — not "264 skills."
- Absence signal: agent-config surfaces in NO third-party directory
  (SkillsLLM, ClaudePluginHub) or comparison roundup where ECC / claude-flow /
  claude-obsidian all appear. Discoverability, not quality, is the first gap.
- House constraint (non-negotiable): no public number without a resolving CLAIMS
  pointer (`docs/proof.md` § 1, `check-claims` fails the build). Growth tactics
  that require an unbacked number are out of scope by construction.

## Prerequisites

- [x] Proof surface + CLAIMS ledger + honest-null benchmark live.
- [x] 8.0.0 distribution scaffolding merged (site, GIF, fleet, awesome draft).
- [x] A single-install wedge artifact (this roadmap, Phase 1).
      <!-- met 2026-07-25: verified live, not inherited from the Phase-1 [x] —
      docs/wedge/production-validator/{README.md,production-validator.md,
      first-run-check.sh} present, the one-command curl install is in README
      §quickstart, and tests/scripts/subagent_distribution.test.ts (byte-equality
      + wedge-only invariants) is 5/5 green this run. -->

## Phase 0 — Quick wins already verified missing (autonomous, hours not weeks)

Added per council (claude-sonnet-4-5 + gpt-4o, 2026-07-08): these ARE adoption
work — nobody can find the site or feel the value today — and they block
nothing downstream. All verified open on 2026-07-08.

- [ ] **Link the deployed docs site everywhere it should be:** the Starlight
      site (`https://event4u-app.github.io/agent-config`) has ZERO inbound
      links today (`grep github.io README.md docs/ package.json` → empty).
      Add it to README (top), `package.json` `homepage`, GitHub repo About +
      topics, and the Glama listing description.
      <!-- PARTIAL 2026-07-09: README (top "Try it in 30 seconds" + a docs-site
      link in "Prove it") and `package.json` `homepage` → the Starlight site are
      DONE (the zero-inbound-links gap is closed on the two autonomous surfaces).
      GitHub About (`.github/about.yml` homepage → deliberately event4u.app, a
      branding call) + the Glama listing description are DEFERRED — maintainer
      positioning/external. Item stays open until those land. -->
- [x] **README aha-moment pass (maintainer's own standing ask):** restructure
      the README opening to lead with the felt value + the 30-second install,
      before the governance/proof framing — WITHOUT introducing any number
      that lacks a CLAIMS pointer. The proof identity stays; it moves from
      lede to substantiation. Keep the honest-provenance note intact.
      <!-- PARTIAL 2026-07-09: an ADDITIVE "Try it in 30 seconds" teaser now sits
      directly under the profile picker, ABOVE the proof-identity line — surfacing
      the felt value + the one-command wedge + the docs site, with no new unbacked
      number (check-claims green), honest-provenance note intact. A deeper
      destructive restructure of the maintainer's proof-identity lede is a
      voice/positioning call left to the maintainer, so this stays open. -->
      <!-- done 2026-07-25: the DESTRUCTIVE restructure the 2026-07-09 pass deferred
      is now landed — the opening body was reordered, not just appended to. New order
      after the H1 + CI badges: (1) the 30-second wedge teaser, (2) the proof-demo GIF,
      (3) the "every claim machine-checked" line as SUBSTANTIATION, (4) the profile
      picker, (5) the artefact-count badges last. The catalog no longer leads.
      Verified: numeral multiset byte-identical before/after (no number added or
      removed, so no unbacked number can have been introduced), honest-provenance note
      intact, check-claims + update_counts --check + both count-messaging gates +
      check-refs + check-md-language + build-proof-check all green, and the
      lint-positioning verdict is byte-identical to the pre-edit one (no new drift).
      BOUNDARY, stated rather than glossed: the H1 still leads with the proof framing.
      It is the canonical positioning anchor that lint_positioning binds to
      package.json + .github/about.yml, both of which are ALREADY drifted from it
      (pre-existing red, unrelated to this roadmap) — rewriting it is a branding
      decision plus that debt, so it stays the maintainer's call. -->
- [ ] **Donation path exists at all (added 2026-07-29):** the stated
      monetisation decision is **donation-only** — no paid tier, no
      dual-licensing, ever — and `.github/FUNDING.yml` does not exist, so the
      in-repo sponsor button is absent. This is execution, not design: a
      two-line file plus a short, guilt-free funding paragraph in the README.
      Two facts an agent must **not** invent and the maintainer has to supply:
      whether GitHub Sponsors is enabled for the org, and the donation target if
      it is not. Verify by loading the rendered repo page and seeing the button.
      Cut rationale (a council explicitly declined to roadmap this on its own):
      [`elder-ponytail-harvest-cut`](../settings/contexts/elder-ponytail-harvest-cut.md).
      Note also settled there: the license is **already MIT**, so the drafted
      AGPL→permissive relicensing question is moot.
- [x] **Release-notes discoverability:** verify the site's proof/benchmark
      pages are linked from the README claims section (one hop from "every
      claim machine-checked" to the evidence).
      <!-- done 2026-07-09: the README "Prove it" section links docs/proof.md AND
      the deployed docs site; the claims-machine-checked line is one hop from the
      evidence. -->

**Exit:** the site is reachable from README/package/topics; README leads with
value + install; no unbacked number introduced (`check-claims` green).
**Rollback:** `git revert` — prose/metadata only.

## Phase 1 — One 30-second wedge, not the whole platform

- [x] Ship ONE dead-simple entry that delivers a felt win in one command:
      the production-validator single-install subagent (`@production-validator
      check this branch is actually done`) — no profile, no packs, no wizard.
      The 264-skill platform is the second date, not the first.
      <!-- done 2026-07-20 (verified, largely pre-existing): curl one-liner in
      README "Try it in 30 seconds" + docs/wedge/production-validator/
      (README + pre-projected subagent file), byte-equality + wedge-only
      invariants locked by tests/scripts/subagent_distribution.test.ts
      (green this run). ADR-109 wedge-only distribution is the install path;
      no CLI flag by design. -->
- [x] The wedge's README promise is a CLAIMS-backed sentence, not a feature
      list: what it catches, on what host class, with the evidence pointer.
      <!-- done 2026-07-20: claim `wedge-hollow-detection` added to docs/CLAIMS.md
      (evidence: internal/bench/orchestration/pv-a3-results.md, measured token
      deltas, scoped to the two planted fixtures on a Claude Code host) and
      markered into docs/wedge/production-validator/README.md; check_claims
      green (4 markered claims bound). -->
- [x] Instrument activation: does a fresh installer reach a successful first run?
      Wire the B9 install-friction instruments to a local, opt-in,
      default-off counter (no telemetry-by-default — that would violate the
      package's own posture).
      <!-- done 2026-07-20: docs/wedge/production-validator/first-run-check.sh —
      opt-in by construction (runs only when invoked), one aggregate local line
      (date + outcome, no user/host/repo data), zero network; wedge README
      documents it; outcome vocabulary (ready/not-ready/abandoned) matches the
      B9 runbook. Exercised end-to-end in a scratch repo. -->
- [ ] **Run B9 for real (HUMAN GATE — needs a real external person):** the
      install-friction study has instruments, protocol, and report template
      but ZERO completed sessions (`agents/recruit-sessions/` holds only
      templates, verified 2026-07-08) — the most-repeated open ask across
      every external review. Recruit ≥1 external developer, run the runbook
      against the wedge install, record the session in
      `agents/recruit-sessions/`, and fold findings into the wedge before
      Phase 2 publicity.

**Exit:** a one-command wedge install with a backed promise + a measurable
first-run success signal.
**Rollback:** unlist the wedge; platform install unaffected.

## Phase 2 — Discoverability where the category is browsed

- [ ] Submit to the third-party surfaces the competitors appear in
      (awesome-lists, plugin directories, marketplace catalogs) — the awesome
      draft from 8.0.0 is the seed. Each listing's claims match CLAIMS verbatim.
      <!-- BLOCKED 2026-07-20: outward-facing submissions are a Hard-Floor
      action (submit/post) — maintainer executes; listing texts can reuse the
      launch-story canonical body + CLAIMS verbatim. -->
      <!-- GROUNDWORK DONE 2026-07-25 (the submission itself stays Hard-Floor):
      the listing text the maintainer would paste was in violation of this very
      step's "claims match CLAIMS verbatim" clause. docs/distribution/registries.md
      carried a "PR body update — 3.2.0 reality" block describing version 3.2.0
      with figures like "4929 tests" and role experiences that no longer exist,
      while the package is at 9.7.0 — unresolvable numbers on a public growth
      surface. Replaced with a ledger-bound, version-agnostic body carrying NO
      artefact count and NO version (claims: no-runtime-daemon,
      positioning-honest-nulls, and the measured 1.71x corpus cost). Note: the
      roadmap prose elsewhere says "1.71-3.3x" — only 1.71x is ledger-backed, so
      3.3x was deliberately NOT propagated; the launch story already had this right.
      Also corrected: the status table claimed awesome-mcp-servers PR #6865 was
      "PR open" — verified live, it was CLOSED UNMERGED on 2026-06-11, so that
      entry is NOT live. Structural fix so this cannot rot again:
      docs/distribution/registries.md added to check_artefact_count_messaging
      SURFACES, proven to bite (a planted "264 skills" fails with file:line).
      HONEST READ on this step's exit criterion: mcp.so + mcpservers.org +
      glama.ai are listed, but those are MCP-server directories; the CATEGORY
      surfaces this step names (where the competitors appear) remain unsubmitted,
      so ">= 3 category directories" is NOT met. Only the Hard-Floor submission
      remains agent-blocked. -->
- [ ] Publish ONE launch story built entirely on reproducible artifacts: the
      cost-factor sweep (11.7× → 1.71–3.3×, auto-off on null hosts) with the
      "verify it yourself on a fresh checkout" block. The hook is the honesty,
      including the published nulls — the anti-thread thread.
      <!-- PARTIAL 2026-07-20: story drafted per the announcements convention
      (docs/announcements/2026-07-honest-cost-sweep-launch.md — canonical body
      + HN/Reddit/Dev.to variants + post-time checklist), every number
      ledger-bound. Posting to external channels is the maintainer's Hard-Floor
      call — same drafted-not-posted pattern as 2026-05-non-dev-launch.md. -->
- [x] Cross-link the Starlight site's proof page as the primary CTA, not the
      feature catalog.
      <!-- done 2026-07-20: README top teaser + "Prove it" now point at
      /agent-config/proof/ as the primary entry; the new
      docs/us-vs-the-category.md frames it. -->

**Exit:** listed in ≥3 category directories; one launch story live with a
reproducible-on-checkout claim table.
**Rollback:** none — content/listings only.

## Phase 3 — Turn the proof surface into the differentiator narrative

- [x] Add a public, honest "us vs the category" page seeded from
      `docs/proof.md` § 4, extended for the adoption context: every row is a
      claim WE can resolve on a fresh checkout; the category column is only what
      is publicly observable; never a named competitor, never a counter-number.
      <!-- done 2026-07-20: docs/us-vs-the-category.md (frame + adopter reading)
      + 2 new adoption-context rows in docs/comparison.yaml (wedge,
      persona-null); table stays single-sourced on the proof page —
      check-comparison: 6/6 rows checkable, build_proof regenerated. -->
- [x] Make the demo GIF the hero: the trust surface running green, every
      "verify it yourself" command from a real run (already CI-re-executed).
      <!-- done 2026-07-20: docs/media/proof-demo.gif now sits directly under the
      README top teaser (it previously had zero README presence). -->
- [x] One-line positioning, testable: "The only agent layer that publishes the
      runs where it changed nothing." If a reader can falsify that (find a
      competitor publishing honest nulls), the line updates — that's the point.
      <!-- done 2026-07-20: ledger claim `positioning-honest-nulls`
      (kind: comparative, falsifiability clause in the claim text itself),
      markered on docs/us-vs-the-category.md; check_claims green. -->
- [x] Publish the persona placebo-benchmark verdict as an adoption asset:
      `later/road-to-opt-council-deliberation` Phase 4 runs a pre-registered
      3-arm benchmark (method-personas / famous-figure framing / bare
      multi-provider calls) whose outcome is publishable in BOTH
      directions — a measured lift or an honest null on persona prompts —
      and lands as a proof artifact either way. Turn that artifact into
      one story on the proof surface ("a council implementation with
      falsifiable verdicts — including the persona-theater question"):
      content from already-budgeted work, zero extra measurement spend.
      Gated on that benchmark's verdict existing; either outcome ships.
      <!-- done 2026-07-20: gate met — the verdict EXISTS as a backed honest
      null (claim `persona-identity-placebo-null`, archived
      road-to-opt-council-deliberation Phase 4). Shipped as: a comparison-table
      row, the us-vs-the-category story paragraph ("a council implementation
      with falsifiable verdicts — including the persona-theater question") and
      a launch-story section. Zero extra measurement spend. -->

**Exit:** a differentiator page whose every claim is CI-drift-checked; the
positioning line is itself falsifiable.
**Rollback:** none — positioning only.

## Phase 4 — Convert the wedge to the platform (measured, not assumed)

- [ ] For installers who adopted the wedge, measure whether they progress to a
      profile/pack install (local opt-in counter, aggregate only). Do NOT assume
      the funnel — measure it; if the wedge does not convert, that is a finding,
      not a failure to paper over.
      <!-- BLOCKED 2026-07-20: needs real wedge adopters over time; the opt-in
      local instrument now exists (first-run-check.sh, Phase 1) but there are
      zero external installs to measure yet. -->
- [ ] If conversion is real: document the wedge→profile path in ONBOARDING.
      If not: keep the wedge as a standalone product and stop implying the
      platform is the destination.

**Exit:** a measured wedge→platform conversion signal + a documented path (or a
recorded decision to keep the wedge standalone).
**Rollback:** none — measurement + docs only.

## Acceptance criteria

- Every public growth surface (wedge README, listings, launch story,
  differentiator page) binds its numbers to `docs/CLAIMS.md`; `check-claims`
  stays green. No borrowed or aggregate star-count-style metric appears anywhere.
- A one-command wedge exists with a measurable first-run success signal.
- agent-config is listed in ≥3 third-party directories the category uses.
- Any telemetry is opt-in, default-off, aggregate — adoption instrumentation
  does not contradict the no-runtime / privacy posture.
- The positioning claims are themselves falsifiable, not superlatives.

> **Exhibit inputs (2026-07-27, from sibling roadmaps).** Two filed
> adoption exhibits await Phase-2/launch use:
> `agents/evidence/reports/coworker-capability-audit.md` (honest
> eight-capability table on an external category rubric — six N/A/No
> rows, two Strong; the concession IS the positioning artifact) and
> `agents/evidence/reports/what-you-get-adoption-input.md`
> (prevented-failure-mode rows, every cell ledger-backed).

> **Funnel-lesson input (2026-07-27, from
> `archive/road-to-persona-catalog-disposition.md`).** The persona-catalog intake's
> top non-technical lesson: a contribution funnel (issue-form intake →
> originality gate → external-PR stream) drove Source R's external
> contribution volume (headline figure unverified — directional, not
> evidence). The GATE half is already shipped here (`lint_originality.ts` +
> committed `agents/reports/originality.*`); the FUNNEL half — a contributor
> intake path that routes submissions through that gate — is adoption work
> and is owned by this roadmap: a candidate Phase-2/Phase-4 lever once
> external interest materializes. No new mechanism before then.

> **Status (2026-07-20).** Second autonomous slice landed: Phase 1 is done
> except the B9 human session (wedge verified shipping + lock-test green;
> CLAIMS-backed promise `wedge-hollow-detection`; opt-in local first-run
> instrument). Phase 3 is fully done (us-vs-the-category page + 2 new
> CI-checked comparison rows, GIF hero, falsifiable positioning claim
> `positioning-honest-nulls`, persona-null story — its gate was met, the
> verdict exists as a backed honest null). Phase 2: proof-page CTA done;
> launch story DRAFTED (posting = maintainer Hard-Floor call); directory
> submissions remain maintainer-executed. Still open and NOT autonomously
> completable: Phase-0 maintainer positioning calls, B9
> (`real-external-participant`), submissions/posting, Phase-4 conversion
> measurement (needs real adopters).

> **Status (2026-07-09).** Only the verified-missing Phase-0 discoverability
> quick-win is landed autonomously: the deployed docs site is now linked from
> the README (top teaser + "Prove it") and `package.json` `homepage`, closing
> the zero-inbound-links gap on the two code-owned surfaces; no unbacked number
> was introduced (`check-claims` green). The bulk of the roadmap remains open
> and is NOT autonomously completable: the wedge scope-cut, the README
> aha-moment restructure, and the GitHub-About/Glama listing are maintainer
> positioning/branding calls; running B9 and winning real adopters need a real
> external participant (`real-external-participant`, owner: user). A pre-existing
> `lint-positioning` drift (package.json/about.yml descriptions vs the README
> canonical anchor + the `ai-agent` topic absent from the README) is unrelated
> to this slice and is itself a branding-anchor decision for the maintainer.

## Blockers

### blocker: wedge-scope-cut
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 1
- **What to do:** resist shipping the platform as the wedge. Cut to ONE subagent,
  one command, one backed promise. The discipline is saying no to 263 skills on
  the first screen.
- **Resolved when:** a single-install wedge exists that a stranger can succeed
  with in under a minute, with no profile/pack choice required.
- **Resolution (2026-07-10, template rule 22 sweep):** not a human gate — the
  decision is already made IN this blocker's own text (ONE subagent, one
  command, one backed promise; no profile/pack choice). Nothing remains to
  decide or authorize; the constraint is agent-executable and now governs
  Phase 1 as its scope criterion. The "Resolved when" line stays the phase's
  agent-checkable exit signal.

### blocker: activation-instrumentation-posture
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phases 1, 4 (the measured funnel)
- **What to do:** design the first-run/conversion counters as local, opt-in,
  default-off, aggregate — reconcile with the maintainer-telemetry posture
  before shipping any counter. If it cannot be done without default-on
  collection, ship the funnel un-instrumented and say so.
- **Resolved when:** an activation signal exists that a privacy-conscious
  installer would leave enabled.
- **Resolution (2026-07-10, template rule 22 sweep):** not a human gate — the
  design rule is fully specified here (local, opt-in, default-off, aggregate;
  else ship un-instrumented and say so) and matches the existing
  `telemetry.artifact_engagement` default-off posture. The agent builds to
  this constraint; no open decision remains. The privacy constraint governs
  Phases 1 + 4 as an acceptance criterion.

### blocker: real-external-participant
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 1 (B9 real session) and thereby the Phase 2 launch story's
  install-friction evidence
- **What to do:** recruit one real external developer (not the maintainer, not
  an agent) for a ~30-minute wedge-install session per
  `agents/recruit-sessions/_install-friction-runbook.md`. This cannot be
  produced by the repo itself — it is the single most-repeated open ask across
  all external reviews of 8.0.0.
- **Resolved when:** ≥1 completed session record exists under
  `agents/recruit-sessions/` with findings distributed per
  `_findings-distribution.md`.
