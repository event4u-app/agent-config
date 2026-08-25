---
complexity: structural
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-10-01
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this addition carries no roadmap of its own to retire: the run archived only status: draft roadmaps, which were never counted and therefore cannot serve as an offset. The addition is sanctioned on its own terms -- its G0 gate passed against the live tree, so the defect it names is confirmed rather than hypothesised, and the estate decision it waits on is recorded as a blocker rather than assumed."
---
# Road to web launch readiness — a site-type-conditional pre-ship audit

> **CLOSED 2026-08-25 BY APPROVED RESCOPE — original scope NOT completed.** The
> phrase is chosen over "completed" deliberately, and both council seats asked
> for exactly this distinction: 15 of 19 items are met, **4 are descoped**, and
> the experiment this roadmap was built to run has not run.
>
> | | |
> |---|---|
> | closed_by | `council-approved-rescope` (AI council 2/2, 2026-08-25) |
> | original_scope_completed | **false** |
> | met | 15 / 19 |
> | descoped | 4 / 19 — steps **3.2**, **3.3**, criteria **AC-5** (remainder), **AC-6** |
> | benchmark_claim_resolved | **false** — `claim:web-launch-readiness-finds-more` stays `unbacked` |
> | command_state | ships **default-off**, and is gated from changing |
>
> **The arithmetic reconciles to 19, and it is spelled out because a seat caught
> it not doing so.** The openai seat observed that descoping two steps from
> 15/19 accounts for only 17 and asked what happened to the other two. Measured
> answer: the 19 checkboxes are **13 phase steps** plus **6 acceptance
> criteria**; 11 steps and 4 criteria are met, and the four outstanding items are
> steps 3.2 and 3.3 plus criteria AC-5 and AC-6. Each of the four now carries an
> explicit disposition at its own line. Nothing is left undisposed, and no
> criterion was rewritten to match what shipped.
>
> **What was actually delivered** is the implementation half: the
> `web-launch-readiness` command, its site-type-conditional check config, the
> three benchmark fixtures with a checked-in 19-row ground truth and one decoy,
> and 18 tests of which the two load-bearing ones were sabotage-proved. What was
> **not** delivered is the comparative benchmark that would say whether any of it
> finds more than a bare audit prompt.
>
> **Why closure was legitimate rather than convenient.** The remaining two steps
> are an experiment this session is structurally barred from running: it authored
> the checks, the fixtures **and** the ground truth they are scored against. An
> earlier council (2/2) ruled it may park them for that conflict but that calling
> the parking *completion* was owner-reserved. The maintainer's standing
> delegation for the autonomous drain run supplied that authority in terms that
> name scope re-cuts explicitly, and a second council (2/2) then approved the
> move **with binding conditions**, all applied here. Full reasoning, including
> the one condition that was refused and why, is at
> `### blocker: b-benchmark-owner-rescope`.
>
> **The promotion gate is the control that makes this safe.** The claim may not
> leave `unbacked`, the command may not become default-on, and no comparative
> claim may be published, until
> `agents/roadmaps/later/road-to-web-launch-readiness-benchmark.md` records a
> verdict from an execution that satisfies its independence condition. That file
> also carries the accountable trigger and the eligibility rule that keep it from
> becoming abandoned work.

> **Source:** agents/tmp.old/checklist/roadmap-web-launch-readiness.md

## Goal

One new skill, `web-launch-readiness`, audits the *web surface* of a consumer
project before it ships: indexability, custom error routes, per-route metadata,
image alternative text, canonical URLs, sitemap/robots coherence, required legal
pages, and analytics/consent wiring. Every check is **conditional on site type**,
carries a remediation and a verification step, and reports findings with evidence
rather than a todo list. Default-off until the pre-registered benchmark returns a
positive result.

## Context — what is verified in the tree

The source document shipped this as an unverified hypothesis behind its own
verification gate (its "Gate G0"). **That gate was run at landing and it
PASSED** — the defect is real and confirmed, not hypothesised. The measurement,
recorded verbatim so a later reader can re-run it:

1. **The web-surface vocabulary is absent from the estate.** Over
   `src/skills/ src/rules/ src/domains/`, case-insensitive, counting files:

   | Term | Files matching |
   |---|---|
   | `robots` | **0** |
   | `noindex` | **0** |
   | `meta description` | **0** |
   | `lighthouse` | **0** |
   | `alt text` | 7 |
   | `404` | 19 |

   The four zeroes are the finding. `alt text` and `404` match in unrelated
   contexts (accessibility prose and HTTP-status tables), not as launch checks.

2. **The nearest-named skill is a different domain.**
   `src/skills/launch-readiness/SKILL.md` is 220 lines and scores **0** on every
   one of `404 · robots · noindex · canonical · meta · alt text · analytics ·
   legal`. Its own description reads: "Use before merging a release-shaped PR —
   pre-merge checklist, rollout plan, rollback criteria, ops handoff." It is
   release engineering, not a web-surface audit.

3. **No sibling covers it either.** `gtm-launch` is launch waves;
   `operational-readiness` is go/no-go adjudication; `accessibility-auditor` is
   WCAG conformance. `frontend-render-security` covers XSS-shaped render risk.
   None audits indexability or per-route metadata.

4. **The repo already ships web-surface skills for consumer projects**, so the
   "this repo has no app runtime" objection does not hold: `accessibility-auditor`,
   `frontend-render-security`, `tailwind-engineer`, `react-shadcn-ui`, `blade-ui`,
   `iconography`, `design-review` all exist and all advise on a consumer's web
   surface. (The source's own objection also named `web-perf`; that skill does
   **not** exist in this tree — the objection was weaker than it claimed.)

**Verdict recorded at landing: CREATE `src/skills/web-launch-readiness/`, do not
extend `launch-readiness`.** Different domain, and folding a web audit into a
release-engineering checklist blurs a clean seam that currently reads correctly
from its description alone.

**Highest-value single item: the staging-leftover class** — a `noindex` meta tag
or a blocking `robots.txt` surviving into production. It has the highest damage
potential of anything in the checklist (a launched site invisible to search, with
no error surfaced anywhere) and the estate has literally zero coverage of it.
Phase 2 ships it first, alone, and it is the one check that must work before any
other lands.

## Design directive — conditional, not flat

Carried over from the source and binding on Phase 2: the checklist is
**conditional on site type**, never a flat list. A flat twenty-point list mixes
local-business items (team photo, map and directions, local business schema) with
app/SaaS items, and presents them at equal weight — which is the defect that
motivated the skill. Site type is inferred or asked as step 1, and every check
declares what it applies to.

Every rule carries three things or it does not ship: an **explanation** (why this
matters), a **remediation** (what to change), and a **verification step** (how to
confirm it is fixed). A rule with a finding and no remediation is a nag.

*(Design shape adapted from Source B, an external open-source checklist corpus
studied for its priority model and per-rule verifiability discipline. Its rule
corpus is **not** imported — see Phase 0.3.)*

## Phase 0 — Registration before any skill file exists

- [x] **0.1 Record the G0 measurement as a dated evidence artefact** under
      `agents/evidence/analysis/`, with the per-term file counts above and the
      command that produced them.
      verify: **`agents/evidence/analysis/web-surface-coverage-g0-2026-08-25.md`,
      re-measured at `4014008f7` rather than copied from the Context table above.**
      All six counts reproduce exactly — `robots` 0, `noindex` 0,
      `meta description` 0, `lighthouse` 0, `alt text` 7, `404` 19 — on a
      different day and a different commit, which is what makes the finding a
      measurement rather than a memory. The nearest-named skill re-scored 0 on
      all eight axes at 220 lines.

      **Two terms were measured beyond the roadmap's list and are recorded as
      NOT evidence**, so a later reader does not add them and reach a different
      conclusion: `canonical` matches **115** files in a completely different
      sense (*"the canonical rule"*, *"the canonical source of truth"*) — a term
      whose count is dominated by a homonym cannot serve as coverage evidence in
      either direction. `sitemap` matches 2: non-zero but tiny, recorded so the
      next measurement does not read 2 as a change from an unrecorded 0.
- [x] **0.2 Register the site-type axis** in
      `src/config/web-launch-readiness.json` (`schema_version`,
      `registered_at`, `owner`, `review_by`, per the budget-ownership pattern of
      `hook-latency-budget.json`). Enum: `local-business | marketing-site |
      saas-app | docs | internal-tool`. Every check declares an `applies_to`
      list and a `tier` of `critical | high | medium | situational`.
      verify: **`src/config/web-launch-readiness.json` + 18 schema tests.**
      7 checks, 5 site types, 4 tiers; every check carries `applies_to`, `tier`,
      `why`, `remediation` and `verification`, each asserted non-empty and over
      20 characters — a one-word remediation is the boilerplate a schema test
      exists to reject, not a remediation.

      **The load-bearing assertion is not the schema, it is the DIRECTIVE.** A
      config where every check applied to every type would be schema-valid and
      would have silently violated *conditional, not flat*. So a test asserts at
      least one check is non-universal, and two worked examples are pinned in
      opposite directions: per-route metadata does **not** apply to `saas-app` or
      `internal-tool` (an authenticated app's routes are not indexed, so the work
      has no consumer), while alternative text applies to **every** type
      including `internal-tool` — an internal user with a screen reader is still
      a user, and a conditional axis must not become an excuse.

      `not_in_scope` is registered too, so a later contributor does not add by
      analogy: performance budgets and Lighthouse scoring are a different
      instrument with a different failure mode (a score is a gradient, these
      checks are binary), and `lighthouse` matching 0 files is **not** an
      argument for adding it here.
- [x] **0.3 Record the no-import decision.** The external corpus is a study
      object and a per-defect harvest source only; its rule set is not imported.
      Rules enter one at a time, each against a named defect.
      verify: **recorded in `web-launch-readiness.json` § `no_import_decision`,
      and the location is a correction the step needs rather than a liberty
      taken.** 0.3 sits in Phase 0, whose Exit reads *"zero skill code written"* —
      so its own verify line names an artefact its own phase forbids. The
      DECISION is what the step is about; it is recorded in the earliest durable
      place that exists, and the skill body restates it at 2.1 when there is a
      body.

      The rule as recorded: the external corpus is a study object and a
      per-defect harvest source; its rule set is **not** imported; rules enter
      one at a time, each against a named defect, each carrying its own
      remediation and verification. The reason is written beside it — a bulk
      import arrives with its authors' assumptions about site type, jurisdiction
      and stack, and the conditional axis is the first thing it flattens.
      One-at-a-time keeps the axis honest because every entry must answer
      `applies_to` before it lands.

      The 50-check ceiling is **enforced** rather than stated: a schema test
      asserts `checks.length < 50`. Currently 7.
- [x] **0.4 Pre-register the benchmark and its null path** in `docs/CLAIMS.md`,
      status `unbacked`, BEFORE any skill code. Question: does the skill find
      more real launch defects than a bare "audit this site before launch"
      prompt on the same model? Design: three fixture sites of known defect
      state (one local-business-shaped static site, one SaaS-shaped app, one
      docs site), seeded with a staging `noindex`, a missing custom 404,
      missing metadata on two routes, three images without alternative text, a
      missing privacy-page link, and **one site-type-irrelevant decoy** (a
      missing team photo on the SaaS app, which must NOT be flagged). Metrics:
      precision and recall against ground truth, with the decoy false-positive
      as a **hard gate** — flagging it is a classification failure and DROPS the
      claim regardless of recall.
      verify: **`claim:web-launch-readiness-finds-more` in `docs/CLAIMS.md`,
      status `unbacked`, registered with zero skill code written** — Phase 0's
      exit condition is what makes this a pre-registration rather than a
      description of what the skill turned out to do. `check_claims` resolves it
      (88 ledger entries, 24 unbacked) and `docs/proof.md` was regenerated in the
      same change.

      **The decoy is a GATE, not a metric, and that is the reason this claim can
      fail while scoring well.** Flagging the site-type-irrelevant decoy — a
      missing team photo on the SaaS app — DROPS the claim *regardless of
      recall*. A skill that finds everything by flagging everything is the
      failure mode a recall threshold cannot see.

      Three falsification paths are fixed before data, and the third is not a
      drop: an unbuildable fixture makes the claim **UNDERPOWERED**, because a
      fixture that cannot be built to a ground truth says nothing about the
      skill. Scope is stated in the entry — three fixtures on one model is one
      measurement, not a general result about audit skills.

**Exit:** evidence note, config, no-import decision and claim merged; zero skill
code written.
**Rollback:** delete three files; nothing consumes them yet.

## Phase 1 — The estate decision

- [x] **1.1 Resolve `b-estate-decision-web-launch`** (below) before the skill
      file lands. This phase has no other step by design: the blocker is the
      phase.
      verify: **resolved 2026-08-25 — NO skill slot, the domain ships as a
      command.** AI council 2/2, decision and reasoning recorded in the blocker
      below.

      The step's Exit offered two outcomes — *"a recorded yes or no"*, with a no
      parking the file to `later/`. The council returned a **third**: a no to the
      *container* and a yes to the *capability*, with `later/` refused explicitly
      because parking implies the problem is timing or evidence and it is
      neither. That third disposition is why Phase 2 is re-scoped rather than
      this roadmap being parked.

**Exit:** a recorded yes or no. A no parks this roadmap to `later/` with the
disposition as the reason, which is a publishable outcome and not a failure.

## Phase 2 — The COMMAND, staging-leftover check first

> **RE-SCOPED 2026-08-25 from "the skill" to "the command", on the AI council 2/2
> verdict recorded at `b-estate-decision-web-launch`.** Every step below keeps
> its content, its tiering and its verification; what changes is the container
> and, with it, the invocation model. A command is called deterministically by
> `production-validator` (which carries unscoped `Bash`), where a skill would
> have depended on probabilistic activation — and one seat's decisive point was
> that the existing routing demonstrably is **not** firing for web-facing
> deploys, since `launch-readiness` already exists and scores 0 of 8. A container
> that depends on that same routing would not have closed the gap.
>
> Reading the steps below: "the skill" means the command's implementation, and
> `src/skills/web-launch-readiness/` means the command's home under
> `src/domains/`. The steps are NOT re-written line by line, because rewriting
> eleven verify lines to change one noun would bury the decision in a diff; it is
> recorded once, here, where a reader meets it before the steps.

- [x] **2.1 Ship the indexability check alone.** `src/skills/web-launch-readiness/`
      with site-type classification as step 1 and exactly one check: no
      `noindex` and no blocking `robots.txt` on the production build.
      Verification method: static grep over the build output plus a fetch of
      `/robots.txt`. Tier `critical`, `applies_to` all site types.
      verify: **both states demonstrated**, as
      `src/scripts/check_web_launch_readiness.ts` — a COMMAND, per the Phase 2
      re-scope, not `src/skills/`.

      Staging fixture → **2 critical findings, each with a location**:
      `index.html:7` (the `noindex` meta) and `robots.txt:2` (the blanket
      `Disallow: /`), exit **1**. Clean fixture → **none**, exit **0**.

      **The clean fixture deliberately keeps `Disallow: /admin/`.** A check
      matching any `Disallow` would pass a naive clean fixture and still be
      wrong, so the discrimination is asserted rather than the absence: blanket
      block versus path rule.

      The `applies_to` axis is exercised on the same tree: audited as `saas-app`
      it skips `per-route-metadata` and `canonical-and-sitemap-coherence` with
      *"site type is saas-app"*; audited as `marketing-site` the same directory
      skips nothing. Same files, different answer — which is what makes the axis
      conditional rather than incidental.

      **The honesty property this needed and the step did not name:** the six
      unimplemented checks are reported as `NOT YET IMPLEMENTED (applicable, not
      audited)` and are **never** counted as PASSED. An unimplemented check
      reporting clean is the silent-green defect this repository already names,
      and a one-check command is exactly where it would first appear.
- [x] **2.2 Add the remaining critical and high tiers** — HTTPS enforcement,
      custom 404, per-route title and description, alternative text on content
      images, `lang`/charset/viewport. Each with explanation, remediation and
      verification per the design directive.
      verify: **both states for all eight**, asserted as a loop over the check
      ids rather than one assertion per check, so a check added to the config
      without a fixture fails this test rather than passing unnoticed.
      `defects-marketing/` fires every one; `clean-marketing/` passes every one;
      `saas-app/` supplies the skipped-with-reason case
      (`site type is saas-app`).

      Two checks that a presence test would have got wrong, and each has its own
      assertion because getting them right is the whole value:

      - **`alt=""` is a PASS.** `clean-marketing/about.html` carries it
        deliberately. Flagging it would push authors to write filler alt text,
        which is worse for a screen reader than the empty string that tells it
        to skip.
      - **A title present on every page but SHARED is still a per-route
        finding.** Presence is the easy half; a layout with one hard-coded title
        passes a presence check and is exactly what *per-route* excludes. Both
        locations are reported.

      Two checks were added to the config to cover the step's list —
      `https-enforcement` (critical: mixed content breaks the padlock silently
      while the page still looks fine) and `document-head-basics`
      (`lang`/charset/viewport, one line each, invisible on the developer's
      machine).

      `defects-marketing/SEEDED.md` is a **checked-in manifest**, so a fixture
      that stops firing a check is a visible diff rather than a quietly weaker
      test. It also records what is deliberately NOT seeded there:
      `staging-noindex-leftover` has its own fixture, and seeding it twice would
      make the two non-independent.

      **One real defect, found by the fixture rather than by review.**
      `analytics-and-consent-wiring` passed on a tree seeded to fire it, because
      `SEEDED.md` contains the word *consent* and the consent scan read prose as
      an implementation. Prose is now excluded from **both** sides — a README
      naming an analytics vendor must not count as analytics either.
- [x] **2.3 Add medium and situational tiers**, including the region axis for
      legal pages (DE: Impressum and Datenschutz as `critical` for
      DE-targeted sites).
      verify: `saas-app` reports `per-route-metadata` and
      `canonical-and-sitemap-coherence` as skipped with the reason `site type is
      saas-app` verbatim, and a companion assertion proves no skipped check ever
      appears among the findings.

      **The region axis is a tier ESCALATION, not a second `applies_to`**, and
      the distinction is the design decision here: `applies_to` decides
      *whether* a check applies, a region decides *how severely*. A legal page
      is not more or less applicable in Germany — it is more or less optional,
      because TMG 5 and DSGVO Art. 13 make it owed. Modelling it as an
      escalation keeps one check with one implementation and puts the
      jurisdiction on the consequence.

      Demonstrated in both directions: `required-legal-pages` is
      **situational** at `--region unspecified` and **critical** at `--region
      de`, with the reason carried into the report header so a reader seeing two
      different tiers for one check knows which axis moved it.

      **And the escalation changes the EXIT CODE** — a test asserts the blocking
      count is exactly one higher under `de`. A tier label nothing acts on is
      decoration; this one is the difference between a launch that stops and one
      that does not.

      An unregistered region is a hard `DeadScopeError`, never a silent fallback
      to `unspecified`: a typo'd `--region` must not quietly downgrade a legally
      owed page.
- [x] **2.4 Tiered output shape.** Report order: critical, high, medium,
      situational-applicable, situational-skipped-with-reason.
      verify: **order asserted by index comparison rather than by a snapshot**,
      and the difference is deliberate: a snapshot pins the whole string, so any
      wording edit reds it and the ORDER — the thing the step actually
      specifies — is not what fails. The test asserts
      `CRITICAL < NOT YET IMPLEMENTED < SKIPPED` positionally, and separately
      that the report opens with `site type: <type>` so a reader knows which
      axis produced it. Skip-reason text is pinned exactly
      (`site type is saas-app`) because 2.3 requires the type verbatim.
- [x] **2.5 Default-off** until the Phase 3 benchmark returns positive.
      verify: **with no settings file at all, a run pointed at the FAILING
      fixture exits 0, prints `DEFAULT-OFF` with the reason, and does not print
      `CRITICAL`.** Pointing the disabled run at the fixture that would fire is
      the load-bearing part: a test that disabled a clean tree would pass
      whether or not the flag worked.

      Enabled only by the exact key `web_launch_readiness.enabled: true`;
      `enabled: false` and the near-miss `web_launch:` both leave it off.
      `--force` is the explicit override the fixtures use.

**Exit:** skill ships, flag off, under 50 checks, every check verifiable.
**Rollback:** delete the skill directory; the config and claim survive as a
recorded null.

## Phase 3 — Benchmark and verdict

- [x] **3.1 Build the three fixture sites** to the Phase 0.4 ground-truth list,
      served locally in CI rather than deployed.
      verify: **`tests/fixtures/web-launch-benchmark/`** — `local-business/`,
      `saas-app/`, `docs/`, plus `GROUND-TRUTH.md` with **19 numbered defect rows
      and one decoy**, and 18 tests asserting every row is actually in the tree.
      Static directories, served locally; nothing is deployed.

      **The manifest is checked in so neither arm's author can move the target
      after seeing a score** — and a fixture that quietly stops carrying a defect
      is a visible diff rather than a weaker benchmark.

      **The decoy is present in exactly one fixture** (`saas-app`, a missing team
      photo) and the test asserts it from the CONFIG, not from memory: no
      configured check id may match `team|photo|portrait|about-us`. If a future
      check ever asked for team imagery the decoy would stop being a decoy, and
      the benchmark would silently start scoring it.

      **Both load-bearing tests were sabotage-proved rather than assumed
      sensitive.** Rewriting `docs/sitemap.xml` so the canonical host matches →
      1 failed. Adding a `team-photo-present` check to the config → 1 failed.
      Restored → 18 passed. A test never seen red has unknown sensitivity.

      Two rows are seeded because a presence check would miss them: an Impressum
      **without** a Datenschutz page (the common real-world DE shape), and a
      canonical that is **present and wrong** — copied from the marketing site,
      so the page that gets indexed is not the page anyone chose.
- [-] **3.2 Run the comparator arm** — identical model, bare audit prompt, same
      site access.
      verify: both arms' raw outputs are archived with the run.

      **DESCOPED 2026-08-25 by AI council 2/2** under the maintainer's standing
      delegation — NOT done, and not silently dropped. The step is transferred
      to `agents/roadmaps/later/road-to-web-launch-readiness-benchmark.md`,
      which carries the protocol verbatim and now carries the promotion gate
      that keeps this transfer from becoming an abandonment. See
      `b-benchmark-owner-rescope` for the decision and both seats' reasoning.

      Protocol preserved verbatim in
      `agents/roadmaps/later/road-to-web-launch-readiness-benchmark.md`; see
      `b-benchmark-owner-rescope` below for the verdict that put it there and
      for why this roadmap stays open rather than closing around it.
- [-] **3.3 Resolve the claim** — PROVE, DROP, or UNDERPOWERED. The decoy gate
      is checked first: a decoy false positive is DROP regardless of the recall
      delta.
      verify: the verdict PR flips the claim status; on DROP the skill stays
      default-off and the null is recorded rather than noted.

      **DESCOPED 2026-08-25 by AI council 2/2**, same decision as 3.2.
      `claim:web-launch-readiness-finds-more` stays `unbacked` and the command
      stays default-off, which is already its shipped state — an honest
      **interim** state, and explicitly not completion.

      **`unbacked` is the claim's repository disposition, NOT an experimental
      verdict.** The openai seat asked for the two to be kept apart in writing,
      because calling `unbacked` an "honest-null verdict" would let a reader
      infer the benchmark ran and returned nothing. It did not run. No
      superiority, parity, or failure conclusion may be drawn in either
      direction.

**Exit:** a resolved verdict in either direction. **NOT reached, and descoped
rather than met** — see `b-benchmark-owner-rescope`. The exit condition is
transferred intact to the parked roadmap; it is not weakened here.

## Blockers

### blocker: b-benchmark-owner-rescope
- **Blocks:** 3.2, 3.3, AC-6, and the closure of this roadmap.
- **Owner:** user.
- **Resolved when:** the owner either (a) approves moving 3.2 and 3.3 into
  `agents/roadmaps/later/road-to-web-launch-readiness-benchmark.md` as satisfying
  this roadmap's scope, or (b) directs that the benchmark run and the roadmap
  stay open until it does.
- **What to do:** put exactly these two options to the owner, in one numbered
  question — (1) approve moving 3.2 and 3.3 into
  `agents/roadmaps/later/road-to-web-launch-readiness-benchmark.md` as
  satisfying this roadmap's scope, so it may be archived; (2) keep this roadmap
  open until the benchmark actually runs. Do not run 3.2 in the meantime: the
  council's parking decision stands on its own and forbids the authoring session
  from executing either arm, whichever way the closure question is answered.
- **Recommendation:** option (1) — approve the move. The implementation half is
  done and independently testable; what remains is an experiment whose validity
  depends on being run by someone else, and holding a completed body of work
  open to wait for a different session's calendar does not make the experiment
  any more likely to happen. Option (2) is the right call only if you want the
  benchmark visible in the ACTIVE estate as pressure to schedule it.
- **If you do nothing:** the roadmap stays open indefinitely with two steps
  nobody in this repository is permitted to execute, the dashboard carries a
  permanently-13-of-19 entry, and `claim:web-launch-readiness-finds-more` sits
  `unbacked` with no owner — which over time reads as an abandoned claim rather
  than a pending one. The command itself is unaffected either way: it ships
  default-off and stays that way until the claim resolves.
- **Status:** resolved 2026-08-25 — **option (1), approve the move.** AI
  council 2/2 convergent, under the maintainer's standing delegation for the
  autonomous drain run, whose terms are quoted in the council question:
  *"Anything that would normally end in 'ask the user' … is instead put to the
  AI Council. The council's recorded decision substitutes for user sign-off and
  is documented as such."* Convergence summary, inlined rather than linked
  because council sessions are gitignored and auto-pruned: **2026-08-25,
  members `anthropic/claude-sonnet-4-5` and `openai/codex-default`, 3 rounds,
  blind chairman, both seats present, quorum concluded 2/2, $0.059 actual.**

  **What changed since the earlier session declined.** Nothing about the merits.
  The earlier council ruled it *may* park 3.2/3.3 for conflict-of-interest but
  that treating the parking as completion was owner-reserved — because no
  delegation existed. The delegation now exists and names scope re-cuts
  explicitly. That is the changed premise and the only thing this decision rests
  on: the COI finding is carried forward intact rather than re-litigated, and
  the mechanism-match half is unchanged.

  **Both seats attached binding conditions; the verdict was Option 1 *with*
  conditions, not Option 1 plain. All are applied in this change:**

  1. 3.2 and 3.3 are marked `[-]` **DESCOPED**, never `[x]`, each linking the
     parked roadmap and this decision.
  2. AC-5 and AC-6 stand **verbatim** and are recorded unmet. Both seats
     refused rewriting them into criteria the delivered work satisfies —
     *"Reviewer A's pattern allows future roadmaps to retroactively redefine
     unmet criteria as met."*
  3. The arithmetic reconciles to 19 — 15 met, 4 descoped — because the openai
     seat caught that descoping two steps leaves 17 of 19 and asked what
     happened to the other two. Answer, measured rather than assumed: the 19
     boxes are 13 phase steps plus 6 acceptance criteria; the four outstanding
     items are steps 3.2 and 3.3 and criteria AC-5 and AC-6, and all four now
     carry an explicit disposition. Nothing is left undisposed.
  4. An enforceable **promotion gate** replaces a passive `revisit-if` as the
     primary control, per the openai seat: the claim may not leave `unbacked`
     and the command may not become default-on until an independent verdict
     exists. Recorded at AC-6 and at the parked roadmap.
  5. The parked roadmap gains an **accountable trigger** and an
     **evaluator-eligibility rule**, so `later/` is not a graveyard.

  **One condition was REFUSED, and the refusal is the openai seat's.** The
  anthropic seat asked this council to freeze the parked roadmap's seven
  protocol items before archival, so that the future evaluator runs this
  session's experiment rather than inventing one. The openai seat refused on a
  stronger argument, and it is adopted: *"Having this ground-truth-aware council
  select sample sizes, metrics, or thresholds would freeze contamination into
  the experiment rather than eliminate it."* The conflict of interest that bars
  this session from **running** the arms bars it equally from **parameterising**
  them — which is the anthropic seat's own premise applied one step earlier than
  it applied it. The seven items therefore stay open, and the parked roadmap now
  names who may close them.

  **Revisit-if:** an eligible ground-truth-blind protocol designer and evaluator
  become available; the claim or the command is proposed for promotion or
  default-on use; any fixture, ground truth, or protocol input changes; or the
  parked roadmap lacks an accountable owner at the next roadmap review.

- **Why it reached the owner and not the council (2026-08-25).** The council was
  asked and **declined the closure half of the question**, 2/2 convergent. It
  ruled it may park the two steps for conflict-of-interest reasons — the session
  that authored the checks, the fixtures AND the ground truth may not also run
  and adjudicate the experiment that grades them — but that treating the parking
  as *completion* is **owner-reserved**, because this roadmap carries **no cut
  line** and removing two required phases redefines what completion means. One
  seat: *"The council can park for COI. The owner decides whether that satisfies
  the roadmap."* The other, independently: *"the council may recommend Option A,
  but only the owner can approve the scope change."*

  The routing-assurance precedent decided earlier the same day does **not**
  carry: that roadmap's own text declared stopping at its cut line a valid end
  state, and this one says nothing of the kind.

  **What the council DID settle, and it is acted on here:** Option C — run the
  arms now, adjudicate later — was rejected rather than taken as the compromise
  it looks like. Executing the arms is only mechanical once seven protocol items
  are frozen (comparator prompt text, context packaging, model snapshot and
  sampling, retry policy, whether a finding must name the correct page,
  semantic-match and partial-credit rules, who scores ambiguous output), and
  every one of them can be chosen with knowledge of the expected defects.
  *Archiving raw output creates auditability; it cannot undo an execution choice
  made with knowledge of the answer.* The seven are recorded in the parked
  roadmap as its blocker's resolution condition.

  **Three statuses this roadmap now keeps apart**, per the council's framing —
  conflating them is the failure mode: **implementation complete** (yes, Phase 2
  and 3.1), **validation unresolved** (yes, the claim is `unbacked`), **roadmap
  complete** (no, and not callable so without the owner).

### blocker: b-estate-decision-web-launch
- **Status:** resolved 2026-08-25 — **NO to a standalone skill slot; the domain
  ships as a COMMAND.** AI council 2/2, and it is a packaging rejection rather
  than a rejection of web-launch validation.

  **The evidence establishes a coverage gap, not a skill-shaped gap.** Both seats
  reached that independently and in the same words. G0's four zeroes and the
  nearest skill's 0-of-8 show that nothing covers this domain; they do not show
  that a separately discoverable reasoning workflow is what covers it. One seat:
  the Phase 0 deliverables — a site-type-conditional config, 7 deterministic
  checks, 4 tiers, 18 schema tests, a 50-check ceiling, a benchmark with a hard
  pass/fail gate — are *"the signature of a linter, not a skill.
  `check_secret_leak` doesn't need a skill slot; neither does this."*

  **`later/` was refused explicitly.** Both seats: parking implies the problem is
  timing or insufficient evidence. It is neither — the evidence is sufficient and
  points at a different container. So the skill packaging is **DROPPED**, and the
  domain proceeds.

  **The open question one seat left was answered from the tree, not by theory.**
  It asked whether `production-validator` — the agent that would invoke this —
  can call a command, or needs a skill to act, and said the exemption claim's
  merit turns on it. `src/subagents/production-validator.md` carries **unscoped
  `Bash`**, deliberately and with a comment saying so. It can invoke a command
  directly. The orchestration argument for a skill therefore has no subject.

  **Consequence for the ratchet, which is the reason this blocker existed:**
  `skill_count` stays **299**. No `estate_growth_exempt` claim is needed, and no
  retirement has to pay for an addition that is not being made. The admission
  ledger gets a **declined** row rather than an admission — the first entry in
  `agents/decisions/skill-admissions.jsonl` will be a recorded *no*, which is
  what that ledger was built for and what it has never yet held.

  **Reopening is conditional, not forbidden.** One seat set the bar: reopen only
  if testing demonstrates failures in discovery, orchestration or interpretation
  that cannot reasonably be fixed in the validator or the command contract — and
  a reopened admission must cite **that packaging evidence**, never the original
  0-of-8 coverage gap again.
- **Owner:** maintainer
- **Blocks:** Phase 1.1, and therefore every step from Phase 2.1 onward.
- **What it is:** whether the estate takes a new skill for this domain at all.
- **Why it is deliberately recorded as WEAK:** the source document deferred to
  an estate constraint of "~130 skills". That figure is **not registered
  anywhere in this tree** — it does not appear in
  `src/config/estate-count-budget.json`, which is the only estate-count budget
  config, and whose `target` block carries no skill number at all (only
  `active_roadmaps: 15` and `open_blockers: 12`, and its own `_comment` says
  those are "PROPOSALS, NOT REGISTERED … Nothing reads these values"). So the
  constraint this blocker exists to respect has no citable source. It is kept
  open anyway, because "the number is unregistered" is an argument about the
  *evidence* for a ceiling, not a licence to add skills without a decision.
- **What to do:**
  1. Read the G0 measurement in `## Context` above — the four zero-match terms
     are the whole evidential basis for a new skill.
  2. Decide whether this domain earns a skill slot, noting that the "~130
     skills" ceiling the source deferred to is not registered anywhere in the
     tree (see the WEAK note above).
  3. Record the decision, with a date, as this blocker's `Status`.
  4. On a yes, Phase 2 proceeds. On a no, move this file to `later/` with the
     disposition as the stated reason.
- **Recommendation:** record a yes. The G0 gate passed with four zero-coverage
  terms, the nearest-named skill scores zero on all eight web-surface checks,
  and the ceiling that would argue against it has no citable source. The risk
  of the addition is bounded by the Phase 3 benchmark, which is pre-registered
  with a hard DROP gate.
- **If you do nothing:** the roadmap stalls at Phase 1 indefinitely. No skill
  ships, the staging-`noindex` class stays at zero coverage, and the G0
  evidence note ages until someone re-runs it. Phase 1 is deliberately a
  single step so this stall is visible on the dashboard rather than buried
  mid-phase.
- **Resolved when:** a maintainer records a yes or a no, with a date, in this
  blocker. A yes unblocks Phase 2. A no moves this file to `later/`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Site-type misclassification flags irrelevant items | product | A SaaS app told to add a team photo teaches the developer to ignore the whole report — the exact defect that motivated the skill | Site type is step 1; every check declares `applies_to`; the benchmark's decoy false-positive is a hard DROP gate (0.4, 3.3) | Phase 0 — Registration before any skill file exists |
| 2 | Check corpus accretes toward the external rule set | implementation | A 385-rule corpus imported wholesale would duplicate existing coverage and blow the skill's scope | No-import decision recorded (0.3); per-defect entry only; shipped count capped under 50 and asserted in Phase 2 | Phase 0 — Registration before any skill file exists |
| 3 | Overlap with an existing skill emerges later | product | A future `accessibility-auditor` or `frontend-render-security` change could absorb part of this surface | G0 measurement is a dated, reproducible artefact (0.1) that can be re-run to detect the overlap appearing | Phase 0 — Registration before any skill file exists |
| 4 | Estate decision never arrives | implementation | The roadmap stalls at Phase 1 indefinitely with a blocker resting on an unregistered number | Phase 1 is a single step so the stall is visible rather than buried; a no is a defined outcome that parks the file | Phase 1 — The estate decision |
| 5 | Benchmark fixtures drift from real sites | implementation | Three synthetic fixtures may not represent real launch defects, making a PROVE verdict overfit | Ground truth is a checked-in manifest per fixture (3.1); both arms' raw output archived (3.2); UNDERPOWERED is a registered verdict | Phase 3 — Benchmark and verdict |

## Acceptance Criteria

- [x] AC-1 — The G0 evidence note, the site-type config, the no-import decision
      and the benchmark claim all exist and predate the first skill commit in
      history.
      **Met.** All four landed in the Phase-0 change (merged as #1630) with zero
      implementation code, and the first implementation commit is in THIS change.
      The ordering is the pre-registration, and it is checkable in `git log`.
- [x] AC-2 — `b-estate-decision-web-launch` carries a recorded disposition with
      a date and a named decider.
      **Met.** `Status: resolved 2026-08-25 — NO to a standalone skill slot; the
      domain ships as a COMMAND`, decided by AI council 2/2, with the reasoning
      and the reopening condition recorded at the blocker.
- [x] AC-3 — The indexability check reports a critical finding with a
      `file:line` on a staging-`noindex` fixture and reports none on a clean
      one — both states demonstrated in the PR.
      **Met.** `index.html:7` and `robots.txt:2`, exit 1; clean fixture exit 0
      with no findings. Both runs are quoted in the PR body.
- [x] AC-4 — Every shipped check carries an explanation, a remediation, a
      verification step and a non-empty `applies_to`, asserted by a schema test
      rather than by review.
      **Met** by the 18-case schema test that landed with the config, which also
      rejects any field under 20 characters — a one-word remediation is the
      boilerplate the assertion exists to catch. The command's own tests
      re-assert `remediation` and `verification` length on every emitted finding,
      so the contract holds at the output as well as in the config.
- [-] AC-5 — A SaaS-app fixture reports local-business items as
      situational-skipped with the site type as the skip reason, and the
      benchmark decoy is not flagged.
      **PARTIALLY MET / REMAINDER DESCOPED 2026-08-25, AI council 2/2.** The
      criterion is left standing verbatim rather than rewritten to match what
      shipped: both seats refused the rewrite, on the ground that redefining an
      unmet criterion as met is the precedent that lets any future roadmap
      retro-fit its own acceptance. The first half is met; the second half was
      descoped with 3.2/3.3 and is transferred to the parked roadmap.

      **First half MET, second half NOT REACHABLE HERE.** The SaaS-app fixture
      skips `per-route-metadata` and `canonical-and-sitemap-coherence` with
      `site type is saas-app` verbatim, asserted per-item.

      The decoy half belongs to Phase 3: the decoy is *a missing team photo on
      the SaaS app*, and nothing can flag or not-flag it until the checks that
      could see it exist (`image-alternative-text` is unimplemented) and the
      benchmark runs. Recorded as partially met rather than checked off, because
      an AC that folds two phases into one line would otherwise read as green on
      half its evidence.
- [-] AC-6 — The benchmark claim carries a resolved verdict; on DROP the skill
      remains default-off and the null is recorded.
      **NOT EVALUATED — DESCOPED 2026-08-25, AI council 2/2.** The criterion
      stands verbatim and is recorded unmet. No verdict exists because the
      benchmark did not run: `claim:web-launch-readiness-finds-more` remains
      `unbacked` and the command remains default-off, which is its shipped state
      and **not** a DROP verdict. The distinction is the openai seat's, and it is
      load-bearing — a reader who takes `unbacked` for a resolved null would
      believe an experiment happened.

      **Promotion gate, and it is the enforceable half of this disposition.**
      The claim may not leave `unbacked`, the command may not become default-on,
      and no comparative claim about this command may be published, until the
      parked roadmap records a verdict from an execution that satisfies its own
      independence condition. This gate is stated here as well as at the parked
      roadmap deliberately: the archived file is what a future reader finds
      first.

## Corrections applied at landing (2026-08-24)

Recorded rather than silently fixed, per this repository's convention.

| What | Was | Now | Why |
|---|---|---|---|
| File format | A bespoke YAML-in-fenced-block document with numbered prose sections (`## 1. Defect hypothesis`, `## 3. Proposal`) | Standard roadmap shape: real frontmatter, `## Goal`, `## Context`, phases with `- [ ]` steps each carrying `verify:`, Blockers, Risk Register, Acceptance Criteria | The source was a proposal memo, not a roadmap. Its `id:`/`type:`/`depends_on:` block was inside a ```yaml fence and so was not frontmatter at all — no gate would have read it, and `lint_roadmap_complexity` needs a real `complexity:` key. |
| Gate G0 | Unrun, with a blank SHA line to fill in, and every estate claim marked conditional on it | Run at landing; the measurement recorded verbatim in `## Context` with per-term file counts | The gate was the document's own precondition for existing. Landing it unrun would have shipped a roadmap whose entire premise was still a hypothesis. It passed. |
| Estate constraint | "estate targets (~130 skills, <=50 rules)" cited as a binding constraint | Recorded in `b-estate-decision-web-launch` as **unregistered**: the figure appears nowhere in the tree, and `estate-count-budget.json`'s `target` block carries no skill number | The constraint had no citable source. Stated as a weak blocker rather than dropped, since the absence of evidence for a ceiling is not a licence to skip the decision. |
| Scope objection | Implicitly conceded ("this repo has no app runtime") | Recorded as failing, with seven named counter-examples | The repo already ships seven skills advising on a consumer's web surface. The objection was self-refuting against the tree. |
| `web-perf` | Named as existing coverage | Recorded as **not present** in this tree | Checked at landing: `src/skills/web-perf` does not exist. The source's own objection cited a skill that is not there, which makes the objection weaker than it claimed rather than stronger. |
| Risk Register | Absent | Added, five rows, all `product` or `implementation` | `lint_plan_risk_register.ts:288-293` admits only those two values, and a roadmap without the section fails the register floor. |
| Blockers section | Absent; the estate decision sat in prose as "pending estate-budget decision" | One `### blocker:` record with owner, blocks-list and a resolution condition | A prose dependency is not a tracked one. |

**Verified at landing, not inherited.** Every count in `## Context` was measured
in this worktree: the four zero-match terms, the 220-line length and eight
zero-scores of `src/skills/launch-readiness/SKILL.md`, that skill's description
verbatim, the presence of the six sibling skills named, and the absence of both
`src/skills/web-launch-readiness` and `src/skills/web-perf`.
